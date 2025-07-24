// Player errors (1-10)
pub const ERROR_PLAYER_NOT_EXIST: u32 = 1;
pub const ERROR_PLAYER_ALREADY_EXIST: u32 = 2;
pub const ERROR_INSUFFICIENT_BALANCE: u32 = 3;

// Security errors (10-20)
pub const ERROR_OVERFLOW: u32 = 11;
pub const ERROR_DIVISION_BY_ZERO: u32 = 12;
pub const ERROR_UNDERFLOW: u32 = 13;

// Staking errors (20-30)
pub const ERROR_INSUFFICIENT_STAKE: u32 = 21;
pub const ERROR_INVALID_STAKE_AMOUNT: u32 = 22;
pub const ERROR_STAKE_TOO_SMALL: u32 = 23;
pub const ERROR_STAKE_TOO_LARGE: u32 = 24;
pub const ERROR_NO_STAKE_TO_WITHDRAW: u32 = 25; 