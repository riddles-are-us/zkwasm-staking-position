use serde::Serialize;

lazy_static::lazy_static! {
    pub static ref ADMIN_PUBKEY: [u64; 4] = {
        let bytes = include_bytes!("./admin.pubkey");
        let u64s = unsafe { std::slice::from_raw_parts(bytes.as_ptr() as *const u64, 4) };
        u64s.try_into().unwrap()
    };
}

#[derive(Serialize, Clone)]
pub struct Config {
    actions: [&'static str; 10],
    name: [&'static str; 1],
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        actions: [
            "deposit", 
            "withdraw", 
            "withdraw_points",
            "create_product_type",
            "modify_product_type", 
            "purchase_certificate",
            "claim_interest",
            "redeem_principal",
            "admin_withdraw_to_multisig",
            "set_reserve_ratio"
        ],
        name: ["zkwasm_solar_mining"],
    };
}

// Certificate system: Multisig address for withdrawals (pre-parsed for efficiency)
// TODO: Replace with actual production multisig address parts before deployment
// Use ts/src/address_parser.ts to convert address to these parts
pub const CERTIFICATE_MULTISIG_FIRST: u64 = 0x00000000;   // First 4 bytes (reversed)
pub const CERTIFICATE_MULTISIG_MIDDLE: u64 = 0x0000000000000000; // Middle 8 bytes (reversed) 
pub const CERTIFICATE_MULTISIG_LAST: u64 = 0x0000000000000000;   // Last 8 bytes (reversed)

// Event types for certificate system (following zkwasm-launchpad pattern)
pub const EVENT_PRODUCT_TYPE_CREATED: u64 = 6;
pub const EVENT_PRODUCT_TYPE_MODIFIED: u64 = 7;
pub const EVENT_CERTIFICATE_PURCHASED: u64 = 8;
pub const EVENT_INTEREST_CLAIMED: u64 = 9;
pub const EVENT_PRINCIPAL_REDEEMED: u64 = 10;
pub const EVENT_INDEXED_OBJECT: u64 = 5; // Consistent with launchpad

// Missing direct events (following zkwasm-launchpad pattern)
pub const EVENT_DEPOSIT: u64 = 11;
pub const EVENT_WITHDRAWAL: u64 = 12; 
pub const EVENT_POINTS_WITHDRAWAL: u64 = 13;
pub const EVENT_ADMIN_WITHDRAWAL: u64 = 14;
pub const EVENT_RESERVE_RATIO_CHANGE: u64 = 15;

// Certificate info constants for IndexedObject (following launchpad pattern)
pub const PRODUCT_TYPE_INFO: u64 = 1;
pub const CERTIFICATE_INFO: u64 = 2;

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }

    // enable timer tick for auto-finalization
    pub fn autotick() -> bool {
        true
    }
}

/// Get pre-parsed multisig address parts for withdrawals
/// Avoids expensive string parsing in smart contract execution
/// Use ts/src/address_parser.ts to generate these constants from address strings
pub fn get_multisig_address_parts() -> (u64, u64, u64) {
    (CERTIFICATE_MULTISIG_FIRST, CERTIFICATE_MULTISIG_MIDDLE, CERTIFICATE_MULTISIG_LAST)
}

/// Validate reserve ratio (must be <= 50%)
pub fn validate_reserve_ratio(reserve_ratio: u64) -> bool {
    reserve_ratio <= MAX_RESERVE_RATIO
}

// Points withdrawal constants (for static points system)
pub const POINTS_DIVISOR: u64 = 17280;
pub const MIN_POINTS_WITHDRAWAL: u64 = 1; // Minimum 1 effective point withdrawal (will require 17280 actual points)

// Time conversion helpers (5 seconds per tick) - used by certificate system
pub const SECONDS_PER_TICK: u64 = 5;
pub const TICKS_PER_DAY: u64 = 17280;

// Reserve ratio and recharge system constants
pub const MAX_RESERVE_RATIO: u64 = 5000; // Max 50% reserve ratio
pub const RECHARGE_PRODUCT_DURATION: u64 = 36500; // 100 years in days
pub const RECHARGE_PRODUCT_APY: u64 = 0; // 0% APY for recharge products

/// Calculate available funds for admin withdrawal with reserve ratio
/// Formula: (total_funds + total_recharge_amount - cumulative_admin_withdrawals) * (1 - reserve_ratio)
pub fn calculate_available_funds(
    total_funds: u64,
    cumulative_admin_withdrawals: u64,
    total_recharge_amount: u64,
    reserve_ratio: u64
) -> Result<u64, u32> {
    use crate::math_safe::{safe_sub, safe_add, safe_mul};
    use crate::error::ERROR_UNDERFLOW;
    
    // Calculate base user withdrawable funds: 先加后减
    let funds_with_recharge = safe_add(total_funds, total_recharge_amount)?;
    
    // 判断是否小于admin提取金额，如果是则返回0
    let user_withdrawable = if funds_with_recharge >= cumulative_admin_withdrawals {
        safe_sub(funds_with_recharge, cumulative_admin_withdrawals)?
    } else {
        0 // Admin提取超过了总资金，用户无资金可提取
    };
    
    // Apply reserve ratio for admin borrowable funds
    let multiplier = safe_sub(10000u64, reserve_ratio).map_err(|_| ERROR_UNDERFLOW)?;
    let available_before_division = safe_mul(user_withdrawable, multiplier)?;
    
    Ok(available_before_division / 10000)
} 