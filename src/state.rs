use serde::Serialize;
use zkwasm_rest_abi::{StorageData, MERKLE_MAP};
use std::cell::RefCell;
use crate::error::*;
use crate::player::{StakingPlayer, Owner};

#[derive(Serialize)]
pub struct QueryState {
    counter: u64,
    total_players: u64,
    total_staked: u64,
}

#[derive(Serialize, Clone)]
pub struct GlobalState {
    pub counter: u64,
    pub total_players: u64,
    pub total_staked: u64,       // Total staked amount
    pub txsize: u64,
    pub txcounter: u64,
}

impl GlobalState {
    pub fn new() -> Self {
        GlobalState {
            counter: 0,
            total_players: 0,
            total_staked: 0,
            txsize: 0,
            txcounter: 0,
        }
    }

    pub fn snapshot() -> String {
        let state = GLOBAL_STATE.0.borrow();
        let query_state = QueryState {
            counter: state.counter,
            total_players: state.total_players,
            total_staked: state.total_staked,
        };
        serde_json::to_string(&query_state).unwrap()
    }

    pub fn get_state(pid: Vec<u64>) -> String {
        let player = StakingPlayer::get(&pid.try_into().unwrap());
        serde_json::to_string(&player).unwrap()
    }

    pub fn preempt() -> bool {
        let mut state = GLOBAL_STATE.0.borrow_mut();
        let counter = state.counter;
        let txsize = state.txsize;
        let withdraw_size = crate::settlement::SettlementInfo::settlement_size();
        if counter % 600 == 0 || txsize >= 40 || withdraw_size > 40 {
            state.txsize = 0;
            return true;
        } else {
            return false;
        }
    }

    pub fn flush_settlement() -> Vec<u8> {
        crate::settlement::SettlementInfo::flush_settlement()
    }

    pub fn rand_seed() -> u64 {
        0
    }

    pub fn store() {
        let mut data = vec![];
        GLOBAL_STATE.0.borrow_mut().to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&[0, 0, 0, 0], data.as_slice());
    }

    pub fn initialize() {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let mut data = kvpair.get(&[0, 0, 0, 0]);
        if !data.is_empty() {
            let mut u64data = data.iter_mut();
            *GLOBAL_STATE.0.borrow_mut() = Self::from_data(&mut u64data);
        }
    }

    pub fn get_counter() -> u64 {
        GLOBAL_STATE.0.borrow().counter
    }
}

impl StorageData for GlobalState {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let counter = *u64data.next().unwrap();
        let total_players = *u64data.next().unwrap();
        let total_staked = *u64data.next().unwrap();
        let txsize = *u64data.next().unwrap();
        let txcounter = *u64data.next().unwrap();
        
        GlobalState {
            counter,
            total_players,
            total_staked,
            txsize,
            txcounter,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.counter);
        data.push(self.total_players);
        data.push(self.total_staked);
        data.push(self.txsize);
        data.push(self.txcounter);
    }
}

pub struct SafeState(pub RefCell<GlobalState>);
unsafe impl Sync for SafeState {}

lazy_static::lazy_static! {
    pub static ref GLOBAL_STATE: SafeState = SafeState(RefCell::new(GlobalState::new()));
}

// Staking Transaction constants
const TICK: u64 = 0;
const INSTALL_PLAYER: u64 = 1;
const WITHDRAW: u64 = 2;
const DEPOSIT: u64 = 3;

pub struct Transaction {
    command: crate::command::Command,
    nonce: u64,
}

impl Transaction {
    pub fn decode_error(e: u32) -> &'static str {
        crate::command::decode_error(e)
    }

    pub fn decode(params: &[u64]) -> Self {
        use crate::command::{Command, Deposit, Withdraw};
        use zkwasm_rest_abi::enforce;
        
        let command = params[0] & 0xff;
        let nonce = params[0] >> 16;
        
        let command = if command == WITHDRAW {
            enforce(params.len() == 5, "withdraw needs 5 params");
            Command::Withdraw(Withdraw {
                data: [params[2], params[3], params[4]]
            })
        } else if command == DEPOSIT {
            enforce(params.len() == 5, "deposit needs 5 params");
            enforce(params[3] == 0, "check deposit index"); // only token index 0 is supported
            Command::Deposit(Deposit {
                data: [params[1], params[2], params[4]]
            })
        } else if command == TICK {
            Command::Tick
        } else if command == INSTALL_PLAYER {
            Command::InstallPlayer
        } else {
            panic!("unsupported transaction command");
        };

        Transaction { command, nonce }
    }

    pub fn create_player(&self, pkey: &[u64; 4]) -> Result<(), u32> {
        let player = StakingPlayer::get_from_pid(&StakingPlayer::pkey_to_pid(pkey));
        match player {
            Some(_) => Err(ERROR_PLAYER_ALREADY_EXIST),
            None => {
                let mut player = StakingPlayer::new(pkey);
                player.data = crate::player::PlayerData::new();
                player.store();
                
                let mut state = GLOBAL_STATE.0.borrow_mut();
                state.total_players += 1;
                
                Ok(())
            }
        }
    }

    pub fn inc_tx_number(&self) {
        let mut state = GLOBAL_STATE.0.borrow_mut();
        state.txsize += 1;
        state.txcounter += 1;
    }

    pub fn tick(&self) {
        let mut state = GLOBAL_STATE.0.borrow_mut();
        state.counter += 1;
    }

    pub fn process(&self, pkey: &[u64; 4], rand: &[u64; 4]) -> Vec<u64> {
        use crate::command::{Command, CommandHandler};
        use crate::config::ADMIN_PUBKEY;
        use zkwasm_rest_convention::event::clear_events;
        use zkwasm_rust_sdk::require;
        
        let pid = StakingPlayer::pkey_to_pid(pkey);
        let counter = GLOBAL_STATE.0.borrow().counter;
        
        let e = match &self.command {
            Command::InstallPlayer => {
                self.create_player(pkey).map_or_else(|e| e, |_| 0)
            }
            Command::Tick => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                self.tick();
                0
            }
            // Activity commands removed - handled in TypeScript service
            Command::Withdraw(withdraw) => {
                withdraw.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::Deposit(deposit) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                deposit.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
        };
        
        if e == 0 {
            match self.command {
                Command::Tick => (),
                _ => {
                    self.inc_tx_number();
                }
            }
        }
        
        let eventid = {
            let state = GLOBAL_STATE.0.borrow();
            (state.counter << 32) + state.txcounter
        };
        clear_events(vec![e as u64, eventid])
    }
}


