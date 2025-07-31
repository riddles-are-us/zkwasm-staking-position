use serde::Serialize;
use zkwasm_rest_abi::StorageData;
use crate::error::*;
use crate::math_safe::{safe_add, safe_sub, safe_mul};

#[derive(Serialize, Clone, Debug, Default)]
pub struct PlayerData {
    pub points: u64,           // User points/score
    pub last_stake_time: u64,  // Last stake timestamp (for withdrawal time restriction)
    pub last_update_time: u64, // Last points update timestamp (for interest calculation)
    pub total_staked: u64,     // Total staked amount
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
            last_stake_time: 0,
            last_update_time: 0,
            total_staked: 0,
        }
    }

    /// Calculate effective points = points + current_staked_amount * delta_time
    pub fn calculate_effective_points(&self, current_time: u64) -> Result<u64, u32> {
        // Use last_update_time for interest calculation, not last_stake_time
        let reference_time = if self.last_update_time > 0 {
            self.last_update_time
        } else {
            self.last_stake_time
        };
        
        if reference_time == 0 || current_time <= reference_time {
            return Ok(self.points);
        }
        
        let delta_time = safe_sub(current_time, reference_time)?;
        let interest_points = safe_mul(self.total_staked, delta_time)?;
        safe_add(self.points, interest_points)
    }

    /// Update points with interest calculation
    pub fn update_points(&mut self, current_time: u64) -> Result<(), u32> {
        // Use last_update_time for interest calculation, not last_stake_time
        let reference_time = if self.last_update_time > 0 {
            self.last_update_time
        } else {
            self.last_stake_time
        };
        
        if reference_time > 0 && current_time > reference_time {
            let delta_time = safe_sub(current_time, reference_time)?;
            let interest_points = safe_mul(self.total_staked, delta_time)?;
            self.points = safe_add(self.points, interest_points)?;
        }
        
        // Update the last_update_time to current_time to prevent double counting
        self.last_update_time = current_time;
        Ok(())
    }

    /// Add stake amount
    pub fn add_stake(&mut self, amount: u64, current_time: u64) -> Result<(), u32> {
        // Update points first (calculate interest)
        self.update_points(current_time)?;
        
        // Add stake amount
        self.total_staked = safe_add(self.total_staked, amount)?;
        
        // Update both stake time and update time
        self.last_stake_time = current_time;
        self.last_update_time = current_time;
        
        Ok(())
    }

    /// Remove stake amount (without updating last_stake_time)
    pub fn remove_stake(&mut self, amount: u64, current_time: u64) -> Result<(), u32> {
        // Update points first (calculate interest), but don't update last_stake_time
        self.update_points(current_time)?;
        
        // Check if there's enough staked amount
        if self.total_staked < amount {
            return Err(ERROR_INSUFFICIENT_STAKE);
        }
        
        // Reduce stake amount
        self.total_staked = safe_sub(self.total_staked, amount)?;
        
        Ok(())
    }

}

impl StorageData for PlayerData {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        PlayerData {
            points: *u64data.next().unwrap(),
            last_stake_time: *u64data.next().unwrap(),
            last_update_time: *u64data.next().unwrap(),
            total_staked: *u64data.next().unwrap(),
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.points);
        data.push(self.last_stake_time);
        data.push(self.last_update_time);
        data.push(self.total_staked);
    }
}

pub type StakingPlayer = zkwasm_rest_abi::Player<PlayerData>; 