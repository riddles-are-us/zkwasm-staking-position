use crate::error::*;
use crate::state::GLOBAL_STATE;
use crate::player::StakingPlayer;
use crate::math_safe::{safe_add, safe_sub};
use zkwasm_rest_abi::WithdrawInfo;
use crate::settlement::SettlementInfo;

#[derive(Clone)]
pub enum Command {
    // Standard withdraw and deposit  
    Withdraw(Withdraw),
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
        ERROR_OVERFLOW => "MathOverflow",
        ERROR_UNDERFLOW => "MathUnderflow",
        ERROR_DIVISION_BY_ZERO => "DivisionByZero",
        _ => "Unknown",
    }
} 