use serde::Serialize;
use zkwasm_rest_abi::{StorageData, MERKLE_MAP};
use std::cell::RefCell;
use crate::error::*;
use crate::player::{StakingPlayer, Owner};

#[derive(Serialize)]
pub struct QueryState {
    // Time/Block info
    counter: u64,
    // User statistics
    total_players: u64,
    // Fund tracking
    total_funds: u64,
    interest_claimed: u64,
    cumulative_admin_withdrawals: u64,
    total_recharge_amount: u64,
    reserve_ratio: u64,
}

#[derive(Serialize, Clone)]
pub struct GlobalState {
    pub counter: u64,
    pub total_players: u64,
    pub total_funds: u64,        // Total deposited funds (idle funds + certificates)
    pub txsize: u64,
    pub txcounter: u64,
    // Certificate system counters (minimal addition)
    pub product_type_counter: u64,   // Product type ID counter
    pub certificate_counter: u64,    // Certificate ID counter
    // Reserve ratio and admin withdrawal tracking
    pub reserve_ratio: u64,          // Reserve ratio in basis points (e.g., 1000 = 10%)
    pub cumulative_admin_withdrawals: u64,  // Total amount admin has withdrawn
    pub interest_claimed: u64,       // Total interest claimed by users
    pub total_recharge_amount: u64,  // Total amount recharged via product 0
}

impl Default for GlobalState {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalState {
    pub fn new() -> Self {
        GlobalState {
            counter: 0,
            total_players: 0,
            total_funds: 0,
            txsize: 0,
            txcounter: 0,
            product_type_counter: 1, // Start from 1 for product types
            certificate_counter: 1,  // Start from 1 for certificates
            reserve_ratio: 1000,    // Default 10% reserve ratio
            cumulative_admin_withdrawals: 0,
            interest_claimed: 0,
            total_recharge_amount: 0,
        }
    }

    pub fn snapshot() -> String {
        let state = GLOBAL_STATE.0.borrow();
        
        let query_state = QueryState {
            counter: state.counter,
            total_players: state.total_players,
            total_funds: state.total_funds,
            interest_claimed: state.interest_claimed,
            cumulative_admin_withdrawals: state.cumulative_admin_withdrawals,
            total_recharge_amount: state.total_recharge_amount,
            reserve_ratio: state.reserve_ratio,
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
            true
        } else {
            false
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
        let total_funds = *u64data.next().unwrap();
        let txsize = *u64data.next().unwrap();
        let txcounter = *u64data.next().unwrap();
        
        let product_type_counter = *u64data.next().unwrap();
        let certificate_counter = *u64data.next().unwrap();
        
        // Handle backward compatibility - set defaults if data not available
        let reserve_ratio = u64data.next().copied().unwrap_or(1000);
        let cumulative_admin_withdrawals = u64data.next().copied().unwrap_or(0);
        let interest_claimed = u64data.next().copied().unwrap_or(0);
        let total_recharge_amount = u64data.next().copied().unwrap_or(0);
        
        GlobalState {
            counter,
            total_players,
            total_funds,
            txsize,
            txcounter,
            product_type_counter,
            certificate_counter,
            reserve_ratio,
            cumulative_admin_withdrawals,
            interest_claimed,
            total_recharge_amount,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.counter);
        data.push(self.total_players);
        data.push(self.total_funds);
        data.push(self.txsize);
        data.push(self.txcounter);
        data.push(self.product_type_counter);
        data.push(self.certificate_counter);
        data.push(self.reserve_ratio);
        data.push(self.cumulative_admin_withdrawals);
        data.push(self.interest_claimed);
        data.push(self.total_recharge_amount);
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
const WITHDRAW_POINTS: u64 = 5;

// Certificate system transaction constants
const CREATE_PRODUCT_TYPE: u64 = 6;
const MODIFY_PRODUCT_TYPE: u64 = 7;
const PURCHASE_CERTIFICATE: u64 = 10;
const CLAIM_INTEREST: u64 = 11;
const REDEEM_PRINCIPAL: u64 = 12;
// Admin functions
const ADMIN_WITHDRAW_TO_MULTISIG: u64 = 13;
const SET_RESERVE_RATIO: u64 = 14;

pub struct Transaction {
    command: crate::command::Command,
    nonce: u64,
}

impl Transaction {
    pub fn decode_error(e: u32) -> &'static str {
        crate::command::decode_error(e)
    }

    pub fn decode(params: &[u64]) -> Self {
        use crate::command::{
            Command, Deposit, Withdraw, WithdrawPoints,
            CreateProductType, ModifyProductType, PurchaseCertificate,
            ClaimInterest, RedeemPrincipal, AdminWithdrawToMultisig,
            SetReserveRatio
        };
        use zkwasm_rest_abi::enforce;
        
        let command = params[0] & 0xff;
        let nonce = params[0] >> 16;
        
        let command = if command == WITHDRAW {
            enforce(params.len() == 5, "withdraw needs 5 params");
            Command::Withdraw(Withdraw {
                data: [params[2], params[3], params[4]]
            })
        } else if command == WITHDRAW_POINTS {
            enforce(params.len() == 5, "withdraw_points needs 5 params");
            Command::WithdrawPoints(WithdrawPoints {
                data: [params[2], params[3], params[4]]
            })
        } else if command == DEPOSIT {
            enforce(params.len() == 5, "deposit needs 5 params");
            enforce(params[3] == 0, "check deposit index"); // only token index 0 is supported
            Command::Deposit(Deposit {
                data: [params[1], params[2], params[4]] // [userPid[0], userPid[1], amount]
            })
        } else if command == CREATE_PRODUCT_TYPE {
            enforce(params.len() == 6, "create_product_type needs 6 params");
            Command::CreateProductType(CreateProductType {
                data: [params[2], params[3], params[4], params[5]] // [duration_ticks, apy, min_amount, is_active]
            })
        } else if command == MODIFY_PRODUCT_TYPE {
            enforce(params.len() == 7, "modify_product_type needs 7 params");
            Command::ModifyProductType(ModifyProductType {
                data: [params[2], params[3], params[4], params[5], params[6]] // [product_type_id, new_apy, new_duration, new_min_amount, is_active]
            })
        } else if command == PURCHASE_CERTIFICATE {
            enforce(params.len() == 4, "purchase_certificate needs 4 params");
            Command::PurchaseCertificate(PurchaseCertificate {
                data: [params[2], params[3]] // [product_type_id, amount]
            })
        } else if command == CLAIM_INTEREST {
            enforce(params.len() == 2, "claim_interest needs 2 params");
            // params[1] = certificate_id
            Command::ClaimInterest(ClaimInterest {
                certificate_id: params[1]
            })
        } else if command == REDEEM_PRINCIPAL {
            enforce(params.len() == 2, "redeem_principal needs 2 params");
            // params[1] = certificate_id
            Command::RedeemPrincipal(RedeemPrincipal {
                certificate_id: params[1]
            })
        } else if command == ADMIN_WITHDRAW_TO_MULTISIG {
            enforce(params.len() == 2, "admin_withdraw_to_multisig needs 2 params");
            // params[1] = amount
            Command::AdminWithdrawToMultisig(AdminWithdrawToMultisig {
                amount: params[1]
            })
        } else if command == SET_RESERVE_RATIO {
            enforce(params.len() == 2, "set_reserve_ratio needs 2 params");
            // params[1] = reserve_ratio
            Command::SetReserveRatio(SetReserveRatio {
                reserve_ratio: params[1]
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
            Command::Withdraw(withdraw) => {
                withdraw.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::WithdrawPoints(withdraw_points) => {
                if *pkey == *ADMIN_PUBKEY {
                    // Admin can withdraw negative amounts (add points) without checks
                    withdraw_points.handle_admin(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
                } else {
                    // Regular user with normal checks
                    withdraw_points.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
                }
            }
            Command::Deposit(deposit) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                deposit.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            // Certificate system commands
            Command::CreateProductType(create_product_type) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                create_product_type.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::ModifyProductType(modify_product_type) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                modify_product_type.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::PurchaseCertificate(purchase_certificate) => {
                purchase_certificate.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::ClaimInterest(claim_interest) => {
                claim_interest.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::RedeemPrincipal(redeem_principal) => {
                redeem_principal.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::AdminWithdrawToMultisig(admin_withdraw) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                admin_withdraw.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
            }
            Command::SetReserveRatio(set_reserve_ratio) => {
                unsafe { require(*pkey == *ADMIN_PUBKEY) };
                set_reserve_ratio.handle(&pid, self.nonce, rand, counter).map_or_else(|e| e, |_| 0)
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


