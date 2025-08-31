use crate::error::*;
use crate::state::GLOBAL_STATE;
use crate::player::StakingPlayer;
use crate::math_safe::{safe_add, safe_sub, safe_mul};
use zkwasm_rest_abi::WithdrawInfo;
use crate::settlement::SettlementInfo;
use crate::config::{TICKS_PER_WEEK, POINTS_PER_USDT, MIN_USDT_EXCHANGE, POINTS_DIVISOR, MIN_POINTS_WITHDRAWAL};

#[derive(Clone)]
pub enum Command {
    // Standard withdraw and deposit  
    Withdraw(Withdraw),
    WithdrawUsdt(WithdrawUsdt),
    WithdrawPoints(WithdrawPoints),
    Deposit(Deposit),
    // Standard player install and timer
    InstallPlayer,
    Tick,
}

pub trait CommandHandler {
    fn handle(&self, pid: &[u64; 2], nonce: u64, rand: &[u64; 4], counter: u64) -> Result<(), u32>;
}

#[derive(Clone)]
pub struct Withdraw {
    pub data: [u64; 3],
}

impl CommandHandler for Withdraw {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                let amount = self.data[0] & 0xffffffff;

                // Check if user has enough staked amount to withdraw
                if player.data.total_staked < amount {
                    return Err(ERROR_INSUFFICIENT_STAKE);
                }

                // Check if 7 days have passed since last stake time (7 days = 120960 counters)
                if player.data.last_stake_time > 0 && counter < player.data.last_stake_time + TICKS_PER_WEEK {
                    return Err(ERROR_WITHDRAW_TOO_EARLY);
                }

                // Update points first (calculate interest), then reduce stake
                player.data.remove_stake(amount, counter)?;
                
                // Update global statistics
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.total_staked = safe_sub(state.total_staked, amount)?;
                
                let withdrawinfo = WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 0);
                SettlementInfo::append_settlement(withdrawinfo);
                player.store();

                Ok(())
            }
        }
    }
}

#[derive(Clone)]
pub struct WithdrawUsdt {
    pub data: [u64; 3],
}

impl CommandHandler for WithdrawUsdt {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                let usdt_amount = self.data[0] & 0xffffffff;

                // Validate USDT amount
                if usdt_amount == 0 {
                    return Err(ERROR_INVALID_USDT_AMOUNT);
                }
                
                if usdt_amount < MIN_USDT_EXCHANGE {
                    return Err(ERROR_USDT_AMOUNT_TOO_SMALL);
                }

                // Calculate required points for the USDT amount
                let required_points = safe_mul(usdt_amount, POINTS_PER_USDT)?;
                
                // Calculate current effective points (including interest)
                let current_points = player.data.calculate_effective_points(counter)?;
                
                // Check if user has enough points
                if current_points < required_points {
                    return Err(ERROR_INSUFFICIENT_POINTS);
                }

                // Update points with interest but don't change last_stake_time (for USDT exchange)
                player.data.update_points(counter)?;       
                player.data.points = safe_sub(player.data.points, required_points)?;
                
                // Create withdrawal info with token index 1<<8 for USDT 
                let withdrawinfo = WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 1<<8);
                SettlementInfo::append_settlement(withdrawinfo);
                player.store();

                Ok(())
            }
        }
    }
}

#[derive(Clone)]
pub struct WithdrawPoints {
    pub data: [u64; 3],
}

impl CommandHandler for WithdrawPoints {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                let points_amount = self.data[0] & 0xffffffff;

                // Validate points amount
                if points_amount == 0 {
                    return Err(ERROR_INVALID_POINTS_AMOUNT);
                }
                
                if points_amount < MIN_POINTS_WITHDRAWAL {
                    return Err(ERROR_POINTS_AMOUNT_TOO_SMALL);
                }

                // Calculate required points (points_amount * 17280)
                let required_points = safe_mul(points_amount, POINTS_DIVISOR)?;
                
                // Calculate current effective points (including interest)
                let current_points = player.data.calculate_effective_points(counter)?;
                
                // Check if user has enough points
                if current_points < required_points {
                    return Err(ERROR_INSUFFICIENT_POINTS);
                }

                // Update points with interest but don't change last_stake_time (for points withdrawal)
                player.data.update_points(counter)?;       
                player.data.points = safe_sub(player.data.points, required_points)?;
                
                // Create withdrawal info with token index 2<<8 for points
                let withdrawinfo = WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 2<<8);
                SettlementInfo::append_settlement(withdrawinfo);
                player.store();

                Ok(())
            }
        }
    }
}

impl WithdrawPoints {
    // Admin version - can withdraw any amount without checking player balance (mint from thin air)
    pub fn handle_admin(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut admin = StakingPlayer::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);

        let withdrawinfo = WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 2<<8);
        SettlementInfo::append_settlement(withdrawinfo);
        admin.store();

        Ok(())
    }
}

#[derive(Clone)]
pub struct Deposit {
    pub data: [u64; 3],
}

impl CommandHandler for Deposit {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut admin = StakingPlayer::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);
        let mut player = StakingPlayer::get_from_pid(&[self.data[0], self.data[1]]);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                let amount = self.data[2];
                
                // Validate stake amount
                if amount == 0 {
                    return Err(ERROR_INVALID_STAKE_AMOUNT);
                }
                
                // Add stake (calculate interest first, then increase stake amount)
                player.data.add_stake(amount, counter)?;
                
                // Update global statistics
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.total_staked = safe_add(state.total_staked, amount)?;
                
                player.store();
                admin.store();
                Ok(())
            }
        }
    }
}

pub fn decode_error(e: u32) -> &'static str {
    match e {
        ERROR_PLAYER_NOT_EXIST => "PlayerNotExist",
        ERROR_PLAYER_ALREADY_EXIST => "PlayerAlreadyExist",
        ERROR_INSUFFICIENT_BALANCE => "InsufficientBalance",
        ERROR_INSUFFICIENT_STAKE => "InsufficientStake",
        ERROR_INVALID_STAKE_AMOUNT => "InvalidStakeAmount",
        ERROR_STAKE_TOO_SMALL => "StakeTooSmall",
        ERROR_STAKE_TOO_LARGE => "StakeTooLarge",
        ERROR_NO_STAKE_TO_WITHDRAW => "NoStakeToWithdraw",
        ERROR_WITHDRAW_TOO_EARLY => "WithdrawTooEarly",
        ERROR_OVERFLOW => "MathOverflow",
        ERROR_UNDERFLOW => "MathUnderflow",
        ERROR_DIVISION_BY_ZERO => "DivisionByZero",
        ERROR_INSUFFICIENT_POINTS => "InsufficientPoints",
        ERROR_INVALID_USDT_AMOUNT => "InvalidUsdtAmount",
        ERROR_USDT_AMOUNT_TOO_SMALL => "UsdtAmountTooSmall",
        ERROR_INVALID_POINTS_AMOUNT => "InvalidPointsAmount",
        ERROR_POINTS_AMOUNT_TOO_SMALL => "PointsAmountTooSmall",
        _ => "Unknown",
    }
} 