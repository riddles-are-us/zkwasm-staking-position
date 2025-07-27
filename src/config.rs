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
    actions: [&'static str; 3],
    name: [&'static str; 1],
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        actions: ["deposit", "withdraw", "withdraw_usdt"],
        name: ["zkwasm_staking"],
    };
}

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }

    // enable timer tick for auto-finalization
    pub fn autotick() -> bool {
        true
    }
}

// Staking platform constants
pub const MAX_STAKE_AMOUNT: u64 = 1_000_000_000; // Maximum stake amount

// USDT exchange constants
// 10w (100,000) * 17280 (ticks per day) = 1,728,000,000 points = 1 USDT
pub const POINTS_PER_USDT: u64 = 1_728_000_000; // 10w * 17280
pub const MIN_USDT_EXCHANGE: u64 = 1; // Minimum 1 USDT exchange

// Time conversion helpers (5 seconds per tick)
pub const SECONDS_PER_TICK: u64 = 5;
pub const TICKS_PER_MINUTE: u64 = 12;
pub const TICKS_PER_HOUR: u64 = 720;
pub const TICKS_PER_DAY: u64 = 17280;
pub const TICKS_PER_WEEK: u64 = 120960;    // 7 days
pub const TICKS_PER_MONTH: u64 = 518400;   // 30 days

// Staking configuration
pub struct StakingConfig {
    pub max_stake: u64,
    pub interest_rate_per_tick: u64,  // Interest rate per tick (points growth rate)
}

lazy_static::lazy_static! {
    pub static ref STAKING_CONFIG: StakingConfig = StakingConfig {
        max_stake: MAX_STAKE_AMOUNT,
        interest_rate_per_tick: 1, // Each tick, each unit of stake earns 1 point
    };
}

impl StakingConfig {
    /// Convert seconds to ticks
    pub fn seconds_to_ticks(seconds: u64) -> u64 {
        seconds / SECONDS_PER_TICK
    }
    
    /// Convert ticks to seconds
    pub fn ticks_to_seconds(ticks: u64) -> u64 {
        ticks * SECONDS_PER_TICK
    }
    
    /// Calculate expected points for a given stake amount and time
    pub fn calculate_expected_points(&self, stake_amount: u64, ticks: u64) -> u64 {
        stake_amount * ticks * self.interest_rate_per_tick
    }
    
    /// Validate stake amount
    pub fn validate_stake_amount(amount: u64) -> bool {
        amount > 0 && amount <= MAX_STAKE_AMOUNT
    }
} 