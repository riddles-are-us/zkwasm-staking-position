use crate::error::*;
use crate::state::GLOBAL_STATE;
use crate::player::StakingPlayer;
use crate::math_safe::{safe_add, safe_sub, safe_mul};
use zkwasm_rest_abi::WithdrawInfo;
use crate::settlement::SettlementInfo;
use crate::config::{POINTS_DIVISOR, MIN_POINTS_WITHDRAWAL};
use crate::cert_manager::{ProductTypeManager, CertificateManager};
use crate::event::{emit_product_type_indexed_object,
                   emit_interest_claim_event, emit_principal_redemption_event,
                   emit_certificate_indexed_object};

#[derive(Clone)]
pub enum Command {
    // Standard withdraw and deposit  
    Withdraw(Withdraw),
    WithdrawPoints(WithdrawPoints),
    Deposit(Deposit),
    // Standard player install and timer
    InstallPlayer,
    Tick,
    // Certificate system commands
    CreateProductType(CreateProductType),
    ModifyProductType(ModifyProductType),
    PurchaseCertificate(PurchaseCertificate),
    ClaimInterest(ClaimInterest),
    RedeemPrincipal(RedeemPrincipal),
    // Admin functions
    AdminWithdrawToMultisig(AdminWithdrawToMultisig),
    SetReserveRatio(SetReserveRatio),
}

pub trait CommandHandler {
    fn handle(&self, pid: &[u64; 2], nonce: u64, rand: &[u64; 4], counter: u64) -> Result<(), u32>;
}

#[derive(Clone)]
pub struct Withdraw {
    pub data: [u64; 3],
}

impl CommandHandler for Withdraw {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                let amount = self.data[0] & 0xffffffff;

                // Certificate system: Check if user has enough idle funds to withdraw
                if player.data.idle_funds < amount {
                    return Err(ERROR_INSUFFICIENT_BALANCE);
                }

                // Certificate system: Withdraw from idle funds (no time restrictions)
                player.data.spend_idle_funds(amount)?;
                
                // Update global statistics
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.total_funds = safe_sub(state.total_funds, amount)?;
                
                let withdrawinfo = WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 0);
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
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
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
                
                // Certificate system: use static points (no interest calculation)
                let current_points = player.data.calculate_effective_points(_counter)?;
                
                // Check if user has enough points
                if current_points < required_points {
                    return Err(ERROR_INSUFFICIENT_POINTS);
                }

                // Deduct points (no interest calculation, no timestamp update needed)
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
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut admin = StakingPlayer::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);
        let mut player = StakingPlayer::get_from_pid(&[self.data[0], self.data[1]]);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                let amount = self.data[2];
                
                // Validate deposit amount
                if amount == 0 {
                    return Err(ERROR_INVALID_STAKE_AMOUNT);
                }
                
                // Certificate system: Add to idle funds instead of staking
                player.data.add_idle_funds(amount)?;
                
                // Update global statistics - track total deposited funds
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.total_funds = safe_add(state.total_funds, amount)?;
                
                player.store();
                admin.store();
                Ok(())
            }
        }
    }
}

// Certificate system command structures

#[derive(Clone)]
pub struct CreateProductType {
    pub data: [u64; 4], // [duration_ticks, apy, min_amount, is_active]
}

impl CommandHandler for CreateProductType {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        // Verify admin permissions (this should be checked in state.rs)
        let mut player = StakingPlayer::get_from_pid(pid).unwrap();
        player.check_and_inc_nonce(nonce);
        
        let duration_ticks = self.data[0];
        let apy = self.data[1];
        let min_amount = self.data[2];
        let is_active = self.data[3] != 0; // 0 = false, 非0 = true
        
        let product_type_id = ProductTypeManager::create_product_type(duration_ticks, apy, min_amount, is_active)?;
        
        // Emit IndexedObject event for the new product type
        if let Some(product_type) = ProductTypeManager::get_product_type(product_type_id) {
            emit_product_type_indexed_object(&product_type);
        }
        
        player.store();
        Ok(())
    }
}

#[derive(Clone)]
pub struct ModifyProductType {
    pub data: [u64; 5], // [product_type_id, new_apy, new_duration, new_min_amount, is_active]
}

impl CommandHandler for ModifyProductType {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        // Verify admin permissions (this should be checked in state.rs)
        let mut player = StakingPlayer::get_from_pid(pid).unwrap();
        player.check_and_inc_nonce(nonce);
        
        let product_type_id = self.data[0];
        let new_apy = self.data[1];
        let new_duration = self.data[2];
        let new_min_amount = self.data[3];
        let is_active = self.data[4] != 0; // 0 = false, 非0 = true
        
        ProductTypeManager::modify_product_type(product_type_id, new_apy, new_duration, new_min_amount, is_active)?;
        
        // Emit IndexedObject event for the updated product type
        if let Some(product_type) = ProductTypeManager::get_product_type(product_type_id) {
            emit_product_type_indexed_object(&product_type);
        }
        
        player.store();
        Ok(())
    }
}

#[derive(Clone)]
pub struct PurchaseCertificate {
    pub data: [u64; 2], // [product_type_id, amount]
}

impl CommandHandler for PurchaseCertificate {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                
                let product_type_id = self.data[0];
                let amount = self.data[1];
                
                // Validate amount
                if amount == 0 {
                    return Err(ERROR_INVALID_PRINCIPAL_AMOUNT);
                }
                
                // Certificate system: Check user has sufficient idle funds
                if player.data.idle_funds < amount {
                    return Err(ERROR_INSUFFICIENT_BALANCE);
                }
                
                // Create certificate
                let cert_id = CertificateManager::purchase_certificate(*pid, product_type_id, amount)?;
                
                // Emit certificate indexed object event
                if let Ok(certificate) = CertificateManager::validate_certificate_ownership(pid, cert_id) {
                    emit_certificate_indexed_object(&certificate);
                }
                
                // Deduct from idle funds first
                player.data.spend_idle_funds(amount)?;
                
                // Update global statistics
                let mut state = GLOBAL_STATE.0.borrow_mut();
                
                if product_type_id == 0 {
                    // Special handling for product type 0 (recharge product)
                    // User's funds convert from "user principal" to "external recharge funding"
                    state.total_funds = safe_sub(state.total_funds, amount)?; // 减少用户本金
                    state.total_recharge_amount = safe_add(state.total_recharge_amount, amount)?; // 增加回充资金
                } else {
                    // Normal certificate purchase - funds stay in system, no change to total_funds needed
                    // (user idle_funds decreased, but money is still in the system as locked certificate)
                }
                
                player.store();
                Ok(())
            }
        }
    }
}

#[derive(Clone)]
pub struct ClaimInterest {
    pub certificate_id: u64,
}

impl CommandHandler for ClaimInterest {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                
                let cert_id = self.certificate_id;
                
                // Certificate system: Claim all available interest (no external claim)
                let actual_amount = CertificateManager::claim_interest(pid, cert_id)?;
                
                // Add interest to user's idle funds
                player.data.add_idle_funds(actual_amount)?;
                
                // Update global statistics - only track interest claimed, don't add to total_funds
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.interest_claimed = safe_add(state.interest_claimed, actual_amount)?;
                
                // Emit interest claim event
                emit_interest_claim_event(*pid, cert_id, actual_amount, counter);
                
                player.store();
                Ok(())
            }
        }
    }
}

#[derive(Clone)]
pub struct RedeemPrincipal {
    pub certificate_id: u64,
}

impl CommandHandler for RedeemPrincipal {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], counter: u64) -> Result<(), u32> {
        let mut player = StakingPlayer::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                
                let cert_id = self.certificate_id;
                
                // Certificate system: Redeem principal to idle funds (no external withdrawal)
                let principal_amount = CertificateManager::redeem_principal(pid, cert_id)?;
                
                // Principal is returned to user's idle funds
                // No changes to total_funds needed as money stays in system
                
                // Add principal to user's idle funds
                player.data.add_idle_funds(principal_amount)?;
                
                // Emit principal redemption event
                emit_principal_redemption_event(*pid, cert_id, principal_amount, counter);
                
                player.store();
                Ok(())
            }
        }
    }
}

#[derive(Clone)]
pub struct AdminWithdrawToMultisig {
    pub amount: u64, // Amount to withdraw to multisig address
}

#[derive(Clone)]
pub struct SetReserveRatio {
    pub reserve_ratio: u64, // Reserve ratio in basis points (e.g., 1000 = 10%)
}

impl CommandHandler for AdminWithdrawToMultisig {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        // Verify admin permissions (this should be checked in state.rs)
        let mut admin = StakingPlayer::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);
        
        let amount = self.amount;
        
        // Validate amount is not zero
        if amount == 0 {
            return Err(ERROR_INVALID_STAKE_AMOUNT);
        }
        
        // Calculate available funds for admin withdrawal (based on user withdrawable funds)
        let mut state = GLOBAL_STATE.0.borrow_mut();
        let max_available = crate::config::calculate_available_funds(
            state.total_funds,
            state.cumulative_admin_withdrawals,
            state.total_recharge_amount,
            state.reserve_ratio
        )?;
        
        // Check if requested amount exceeds maximum available with reserve ratio
        if amount > max_available {
            return Err(ERROR_INSUFFICIENT_BALANCE);
        }
        
        // Update global statistics - track cumulative withdrawals
        state.cumulative_admin_withdrawals = safe_add(state.cumulative_admin_withdrawals, amount)?;
        
        // Get pre-parsed multisig address parts to avoid trace-expensive parsing
        let (first, middle, last) = crate::config::get_multisig_address_parts();
        
        // Create withdrawal info to multisig address (token index 0 for USDT)
        let withdrawinfo = WithdrawInfo::new(&[first, middle, last], 0);
        SettlementInfo::append_settlement(withdrawinfo);
        
        admin.store();
        Ok(())
    }
}

impl CommandHandler for SetReserveRatio {
    fn handle(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        // Verify admin permissions (this should be checked in state.rs)
        let mut admin = StakingPlayer::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);
        
        let reserve_ratio = self.reserve_ratio;
        
        // Validate reserve ratio
        if !crate::config::validate_reserve_ratio(reserve_ratio) {
            return Err(ERROR_INVALID_STAKE_AMOUNT); // Reuse existing error code
        }
        
        // Update reserve ratio
        let mut state = GLOBAL_STATE.0.borrow_mut();
        state.reserve_ratio = reserve_ratio;
        
        admin.store();
        Ok(())
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
        ERROR_INVALID_POINTS_AMOUNT => "InvalidPointsAmount",
        ERROR_POINTS_AMOUNT_TOO_SMALL => "PointsAmountTooSmall",
        // Certificate system errors
        ERROR_PRODUCT_TYPE_NOT_EXIST => "ProductTypeNotExist",
        ERROR_PRODUCT_TYPE_INACTIVE => "ProductTypeInactive",
        ERROR_CERTIFICATE_NOT_EXIST => "CertificateNotExist",
        ERROR_CERTIFICATE_NOT_OWNED => "CertificateNotOwned",
        ERROR_CERTIFICATE_NOT_MATURED => "CertificateNotMatured",
        ERROR_CERTIFICATE_ALREADY_REDEEMED => "CertificateAlreadyRedeemed",
        ERROR_INSUFFICIENT_INTEREST => "InsufficientInterest",
        ERROR_INVALID_PRINCIPAL_AMOUNT => "InvalidPrincipalAmount",
        ERROR_PRINCIPAL_AMOUNT_TOO_SMALL => "PrincipalAmountTooSmall",
        ERROR_INVALID_APY => "InvalidApy",
        ERROR_INVALID_DURATION => "InvalidDuration",
        _ => "Unknown",
    }
} 