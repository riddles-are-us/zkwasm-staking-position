use serde::Serialize;
use zkwasm_rest_abi::StorageData;
use crate::error::*;
use crate::math_safe::{safe_add, safe_sub};

#[derive(Serialize, Clone, Debug, Default)]
pub struct PlayerData {
    pub points: u64,      // User points/score (static, for point withdrawals only)
    pub idle_funds: u64,  // Idle funds available for certificate purchases and withdrawals
}

pub trait Owner: Sized {
    fn new(pkey: &[u64; 4]) -> Self;
    fn get(pkey: &[u64; 4]) -> Option<Self>;
}

impl Owner for StakingPlayer {
    fn new(pkey: &[u64; 4]) -> Self {
        StakingPlayer::new_from_pid(StakingPlayer::pkey_to_pid(pkey))
    }

    fn get(pkey: &[u64; 4]) -> Option<Self> {
        StakingPlayer::get_from_pid(&StakingPlayer::pkey_to_pid(pkey))
    }
}

impl PlayerData {
    pub fn new() -> Self {
        PlayerData {
            points: 0,
            idle_funds: 0,
        }
    }

    /// Calculate effective points (static points only for certificate system)
    pub fn calculate_effective_points(&self, _current_time: u64) -> Result<u64, u32> {
        Ok(self.points)
    }

    /// Add amount to idle funds (deposits, certificate interest, redemption)
    pub fn add_idle_funds(&mut self, amount: u64) -> Result<(), u32> {
        self.idle_funds = safe_add(self.idle_funds, amount)?;
        Ok(())
    }

    /// Spend idle funds (for certificate purchases)
    pub fn spend_idle_funds(&mut self, amount: u64) -> Result<(), u32> {
        if self.idle_funds < amount {
            return Err(ERROR_INSUFFICIENT_BALANCE);
        }
        self.idle_funds = safe_sub(self.idle_funds, amount)?;
        Ok(())
    }


}

impl StorageData for PlayerData {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        PlayerData {
            points: *u64data.next().unwrap(),
            idle_funds: *u64data.next().unwrap(),
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.points);
        data.push(self.idle_funds);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ERROR_INSUFFICIENT_BALANCE;

    #[test]
    fn test_player_data_new() {
        let player_data = PlayerData::new();
        assert_eq!(player_data.points, 0);
        assert_eq!(player_data.idle_funds, 0);
    }

    #[test]
    fn test_calculate_effective_points() {
        let player_data = PlayerData {
            points: 17280,
            idle_funds: 5000,
        };
        
        // Certificate system: points are static
        let effective_points = player_data.calculate_effective_points(1000).unwrap();
        assert_eq!(effective_points, 17280); // Should return static points
    }

    #[test]
    fn test_idle_funds_operations() {
        let mut player_data = PlayerData::new();
        
        // Test adding idle funds
        player_data.add_idle_funds(1000).unwrap();
        assert_eq!(player_data.idle_funds, 1000);
        
        // Test adding more funds
        player_data.add_idle_funds(500).unwrap();
        assert_eq!(player_data.idle_funds, 1500);
        
        // Test spending idle funds
        player_data.spend_idle_funds(300).unwrap();
        assert_eq!(player_data.idle_funds, 1200);
        
        // Test adding to idle funds (for certificate operations)
        player_data.add_idle_funds(800).unwrap();
        assert_eq!(player_data.idle_funds, 2000);
    }

    #[test]
    fn test_spend_idle_funds_insufficient_balance() {
        let mut player_data = PlayerData {
            points: 1000,
            idle_funds: 500,
        };
        
        // Try to spend more than available
        let result = player_data.spend_idle_funds(1000);
        assert_eq!(result.unwrap_err(), ERROR_INSUFFICIENT_BALANCE);
        
        // Balance should remain unchanged
        assert_eq!(player_data.idle_funds, 500);
    }

    #[test]
    fn test_storage_data_serialization() {
        let player_data = PlayerData {
            points: 12345,
            idle_funds: 67890,
        };
        
        // Serialize
        let mut data = Vec::new();
        player_data.to_data(&mut data);
        assert_eq!(data, vec![12345, 67890]);
        
        // Deserialize
        let mut iter = data.iter_mut();
        let restored = PlayerData::from_data(&mut iter);
        assert_eq!(restored.points, 12345);
        assert_eq!(restored.idle_funds, 67890);
    }

    #[test]
    fn test_overflow_prevention() {
        let mut player_data = PlayerData {
            points: u64::MAX - 100,
            idle_funds: u64::MAX - 100,
        };
        
        // These operations should not overflow
        let result1 = player_data.add_idle_funds(50);
        assert!(result1.is_ok());
        assert_eq!(player_data.idle_funds, u64::MAX - 50);
        
        // This should cause overflow error
        let result2 = player_data.add_idle_funds(100);
        assert_eq!(result2.unwrap_err(), ERROR_OVERFLOW);
    }
}

pub type StakingPlayer = zkwasm_rest_abi::Player<PlayerData>; 