use crate::error::*;
use crate::config::MAX_STAKE_AMOUNT;

/// Staking-specific mathematical functions

/// Safe addition with overflow check
pub fn safe_add(a: u64, b: u64) -> Result<u64, u32> {
    a.checked_add(b).ok_or(ERROR_OVERFLOW)
}

/// Safe subtraction with underflow check
pub fn safe_sub(a: u64, b: u64) -> Result<u64, u32> {
    a.checked_sub(b).ok_or(ERROR_UNDERFLOW)
}

/// Safe multiplication with overflow check
pub fn safe_mul(a: u64, b: u64) -> Result<u64, u32> {
    a.checked_mul(b).ok_or(ERROR_OVERFLOW)
}

/// Safe division with zero check
pub fn safe_div(a: u64, b: u64) -> Result<u64, u32> {
    if b == 0 {
        return Err(ERROR_DIVISION_BY_ZERO);
    }
    Ok(a / b)
}

/// Validate stake amount
pub fn validate_stake_amount(amount: u64) -> Result<(), u32> {
    if amount == 0 {
        return Err(ERROR_INVALID_STAKE_AMOUNT);
    }
    
    if amount > MAX_STAKE_AMOUNT {
        return Err(ERROR_STAKE_TOO_LARGE);
    }
    
    Ok(())
}

/// Calculate interest points based on stake amount and time delta
pub fn calculate_interest_points(stake_amount: u64, time_delta: u64) -> Result<u64, u32> {
    safe_mul(stake_amount, time_delta)
}

/// Calculate effective points (current points + interest from current stake)
pub fn calculate_effective_points(current_points: u64, stake_amount: u64, time_delta: u64) -> Result<u64, u32> {
    let interest_points = calculate_interest_points(stake_amount, time_delta)?;
    safe_add(current_points, interest_points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_add() {
        assert_eq!(safe_add(1, 2).unwrap(), 3);
        assert_eq!(safe_add(u64::MAX, 1), Err(ERROR_OVERFLOW));
    }

    #[test]
    fn test_safe_sub() {
        assert_eq!(safe_sub(5, 3).unwrap(), 2);
        assert_eq!(safe_sub(3, 5), Err(ERROR_UNDERFLOW));
    }

    #[test]
    fn test_safe_mul() {
        assert_eq!(safe_mul(2, 3).unwrap(), 6);
        assert_eq!(safe_mul(u64::MAX, 2), Err(ERROR_OVERFLOW));
    }

    #[test]
    fn test_safe_div() {
        assert_eq!(safe_div(6, 2).unwrap(), 3);
        assert_eq!(safe_div(6, 0), Err(ERROR_DIVISION_BY_ZERO));
    }

    #[test]
    fn test_validate_stake_amount() {
        // Valid amounts
        assert!(validate_stake_amount(1).is_ok());  // Any positive amount is valid
        assert!(validate_stake_amount(MAX_STAKE_AMOUNT).is_ok());
        assert!(validate_stake_amount(50000).is_ok());
        
        // Invalid amounts
        assert_eq!(validate_stake_amount(0), Err(ERROR_INVALID_STAKE_AMOUNT));
        assert_eq!(validate_stake_amount(MAX_STAKE_AMOUNT + 1), Err(ERROR_STAKE_TOO_LARGE));
    }

    #[test]
    fn test_calculate_interest_points() {
        // Test normal case
        assert_eq!(calculate_interest_points(1000, 10).unwrap(), 10000);
        assert_eq!(calculate_interest_points(5000, 100).unwrap(), 500000);
        
        // Test overflow
        assert_eq!(calculate_interest_points(u64::MAX, 2), Err(ERROR_OVERFLOW));
    }

    #[test]
    fn test_calculate_effective_points() {
        // Test normal case
        assert_eq!(calculate_effective_points(1000, 2000, 5).unwrap(), 11000); // 1000 + (2000 * 5)
        
        // Test with zero current points
        assert_eq!(calculate_effective_points(0, 1000, 10).unwrap(), 10000);
        
        // Test overflow in interest calculation
        assert_eq!(calculate_effective_points(1000, u64::MAX, 2), Err(ERROR_OVERFLOW));
        
        // Test overflow in final addition
        assert_eq!(calculate_effective_points(u64::MAX, 1, 1), Err(ERROR_OVERFLOW));
    }
} 