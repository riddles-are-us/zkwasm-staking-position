use serde::Serialize;
use zkwasm_rest_abi::StorageData;
use zkwasm_rest_convention::objects::IndexedObject;
use zkwasm_rest_convention::event::insert_event;
use crate::certificate::{ProductType, Certificate};
use crate::config::{
    EVENT_PRODUCT_TYPE_CREATED, EVENT_PRODUCT_TYPE_MODIFIED, EVENT_CERTIFICATE_PURCHASED, 
    EVENT_INTEREST_CLAIMED, EVENT_PRINCIPAL_REDEEMED, 
    EVENT_INDEXED_OBJECT, PRODUCT_TYPE_INFO, CERTIFICATE_INFO,
    EVENT_DEPOSIT, EVENT_WITHDRAWAL, EVENT_POINTS_WITHDRAWAL, 
    EVENT_ADMIN_WITHDRAWAL, EVENT_RESERVE_RATIO_CHANGE
};

// Re-export clear_events from zkwasm_rest_convention
pub use zkwasm_rest_convention::event::clear_events;

/// Product Type Event for IndexedObject
#[derive(Serialize, Clone)]
pub struct ProductTypeEvent {
    pub id: u64,
    pub duration_ticks: u64,
    pub apy: u64,
    pub min_amount: u64,
    pub is_active: bool,
}

impl StorageData for ProductTypeEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let id = *u64data.next().unwrap();
        let duration_ticks = *u64data.next().unwrap();
        let apy = *u64data.next().unwrap();
        let min_amount = *u64data.next().unwrap();
        let is_active = *u64data.next().unwrap() != 0;

        ProductTypeEvent {
            id,
            duration_ticks,
            apy,
            min_amount,
            is_active,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.id);
        data.push(self.duration_ticks);
        data.push(self.apy);
        data.push(self.min_amount);
        data.push(if self.is_active { 1 } else { 0 });
    }
}

impl IndexedObject<ProductTypeEvent> for ProductTypeEvent {
    const PREFIX: u64 = 1;
    const POSTFIX: u64 = 0;
    const EVENT_NAME: u64 = EVENT_PRODUCT_TYPE_CREATED;
}

/// Certificate Event for IndexedObject
#[derive(Serialize, Clone)]
pub struct CertificateEvent {
    pub id: u64,
    pub owner: [u64; 2],
    pub product_type_id: u64,
    pub principal: u64,
    pub purchase_time: u64,
    pub maturity_time: u64,
    pub locked_apy: u64,
    pub total_interest_claimed: u64,
    pub status: u64, // CertificateStatus as u64
}

impl StorageData for CertificateEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let id = *u64data.next().unwrap();
        let owner = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let product_type_id = *u64data.next().unwrap();
        let principal = *u64data.next().unwrap();
        let purchase_time = *u64data.next().unwrap();
        let maturity_time = *u64data.next().unwrap();
        let locked_apy = *u64data.next().unwrap();
        let total_interest_claimed = *u64data.next().unwrap();
        let status = *u64data.next().unwrap();

        CertificateEvent {
            id,
            owner,
            product_type_id,
            principal,
            purchase_time,
            maturity_time,
            locked_apy,
            total_interest_claimed,
            status,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.id);
        data.push(self.owner[0]);
        data.push(self.owner[1]);
        data.push(self.product_type_id);
        data.push(self.principal);
        data.push(self.purchase_time);
        data.push(self.maturity_time);
        data.push(self.locked_apy);
        data.push(self.total_interest_claimed);
        data.push(self.status);
    }
}

impl IndexedObject<CertificateEvent> for CertificateEvent {
    const PREFIX: u64 = 2;
    const POSTFIX: u64 = 0;
    const EVENT_NAME: u64 = EVENT_CERTIFICATE_PURCHASED;
}

/// Interest Claim Event
#[derive(Serialize, Clone)]
pub struct InterestClaimEvent {
    pub user_id: [u64; 2],
    pub certificate_id: u64,
    pub amount: u64,
    pub txid: u64,
    pub counter: u64,
}

impl StorageData for InterestClaimEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let user_id = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let certificate_id = *u64data.next().unwrap();
        let amount = *u64data.next().unwrap();
        let txid = *u64data.next().unwrap();
        let counter = *u64data.next().unwrap();

        InterestClaimEvent {
            user_id,
            certificate_id,
            amount,
            txid,
            counter,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.user_id[0]);
        data.push(self.user_id[1]);
        data.push(self.certificate_id);
        data.push(self.amount);
        data.push(self.txid);
        data.push(self.counter);
    }
}

impl IndexedObject<InterestClaimEvent> for InterestClaimEvent {
    const PREFIX: u64 = 3;
    const POSTFIX: u64 = 0;
    const EVENT_NAME: u64 = EVENT_INTEREST_CLAIMED;
}

/// Principal Redemption Event
#[derive(Serialize, Clone)]
pub struct PrincipalRedemptionEvent {
    pub user_id: [u64; 2],
    pub certificate_id: u64,
    pub amount: u64,
    pub txid: u64,
    pub counter: u64,
}

impl StorageData for PrincipalRedemptionEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let user_id = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let certificate_id = *u64data.next().unwrap();
        let amount = *u64data.next().unwrap();
        let txid = *u64data.next().unwrap();
        let counter = *u64data.next().unwrap();

        PrincipalRedemptionEvent {
            user_id,
            certificate_id,
            amount,
            txid,
            counter,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.user_id[0]);
        data.push(self.user_id[1]);
        data.push(self.certificate_id);
        data.push(self.amount);
        data.push(self.txid);
        data.push(self.counter);
    }
}

impl IndexedObject<PrincipalRedemptionEvent> for PrincipalRedemptionEvent {
    const PREFIX: u64 = 4;
    const POSTFIX: u64 = 0;
    const EVENT_NAME: u64 = EVENT_PRINCIPAL_REDEEMED;
}

/// Emit function for ProductType IndexedObject
pub fn emit_product_type_indexed_object(product_type: &ProductType) {
    let mut data = Vec::new();
    data.push(PRODUCT_TYPE_INFO); // object index
    data.push(product_type.id); // product type ID for proper indexing
    
    // Add product type data - this will be the structure stored in IndexedObject
    product_type.to_data(&mut data);
    
    insert_event(EVENT_INDEXED_OBJECT, &mut data);
}

/// Emit function for Certificate IndexedObject
pub fn emit_certificate_indexed_object(certificate: &Certificate) {
    let mut data = Vec::new();
    data.push(CERTIFICATE_INFO); // object index
    data.push(certificate.id); // certificate ID for proper indexing
    
    // Add certificate data - this will be the structure stored in IndexedObject
    certificate.to_data(&mut data);
    
    insert_event(EVENT_INDEXED_OBJECT, &mut data);
}

/// Helper function to emit Interest Claim event
pub fn emit_interest_claim_event(
    user_id: [u64; 2],
    certificate_id: u64,
    amount: u64,
    txid: u64,
    counter: u64
) {
    let mut data = vec![user_id[0], user_id[1], certificate_id, amount, txid, counter];
    
    insert_event(EVENT_INTEREST_CLAIMED, &mut data);
}

/// Helper function to emit Principal Redemption event
pub fn emit_principal_redemption_event(
    user_id: [u64; 2],
    certificate_id: u64,
    amount: u64,
    txid: u64,
    counter: u64
) {
    let mut data = vec![user_id[0], user_id[1], certificate_id, amount, txid, counter];
    
    insert_event(EVENT_PRINCIPAL_REDEEMED, &mut data);
}

/// Helper function to emit Certificate Purchase event (following launchpad pattern)
pub fn emit_certificate_purchase_event(
    user_id: [u64; 2],
    certificate_id: u64,
    product_type_id: u64,
    amount: u64,
    txid: u64,
    counter: u64
) {
    let mut data = vec![user_id[0], user_id[1], certificate_id, product_type_id, amount, txid, counter];
    
    insert_event(EVENT_CERTIFICATE_PURCHASED, &mut data);
}

/// Helper function to emit Deposit event (following launchpad pattern)
pub fn emit_deposit_event(
    admin_id: [u64; 2],
    user_id: [u64; 2], 
    amount: u64,
    txid: u64,
    counter: u64
) {
    let mut data = vec![admin_id[0], admin_id[1], user_id[0], user_id[1], amount, txid, counter];
    
    insert_event(EVENT_DEPOSIT, &mut data);
}

/// Helper function to emit Withdrawal event (following launchpad pattern)
pub fn emit_withdrawal_event(
    user_id: [u64; 2],
    amount: u64,
    address_parts: [u64; 3], // [first, middle, last]
    txid: u64,
    counter: u64
) {
    let mut data = vec![user_id[0], user_id[1], amount, address_parts[0], address_parts[1], address_parts[2], txid, counter];
    
    insert_event(EVENT_WITHDRAWAL, &mut data);
}

/// Helper function to emit Points Withdrawal event (following launchpad pattern)
pub fn emit_points_withdrawal_event(
    user_id: [u64; 2],
    points_amount: u64,
    address_parts: [u64; 3], // [first, middle, last]
    txid: u64,
    counter: u64
) {
    let mut data = vec![user_id[0], user_id[1], points_amount, address_parts[0], address_parts[1], address_parts[2], txid, counter];
    
    insert_event(EVENT_POINTS_WITHDRAWAL, &mut data);
}

/// Helper function to emit Admin Withdrawal event (following launchpad pattern)
pub fn emit_admin_withdrawal_event(
    admin_id: [u64; 2],
    amount: u64,
    txid: u64,
    counter: u64
) {
    let mut data = vec![admin_id[0], admin_id[1], amount, txid, counter];
    
    insert_event(EVENT_ADMIN_WITHDRAWAL, &mut data);
}

/// Helper function to emit Product Type Created event (following launchpad pattern)
pub fn emit_product_type_created_event(
    admin_id: [u64; 2],
    product_type_id: u64,
    duration_ticks: u64,
    apy: u64,
    min_amount: u64,
    is_active: bool,
    counter: u64
) {
    let mut data = vec![admin_id[0], admin_id[1], product_type_id, duration_ticks, apy, min_amount, if is_active { 1 } else { 0 }, counter];
    
    insert_event(EVENT_PRODUCT_TYPE_CREATED, &mut data);
}

/// Helper function to emit Product Type Modified event (following launchpad pattern)
pub fn emit_product_type_modified_event(
    admin_id: [u64; 2],
    product_type_id: u64,
    new_apy: u64,
    new_duration_ticks: u64,
    new_min_amount: u64,
    is_active: bool,
    counter: u64
) {
    let mut data = vec![admin_id[0], admin_id[1], product_type_id, new_apy, new_duration_ticks, new_min_amount, if is_active { 1 } else { 0 }, counter];
    
    insert_event(EVENT_PRODUCT_TYPE_MODIFIED, &mut data);
}

/// Helper function to emit Reserve Ratio Change event (following launchpad pattern)
pub fn emit_reserve_ratio_change_event(
    admin_id: [u64; 2],
    old_ratio: u64,
    new_ratio: u64,
    counter: u64
) {
    let mut data = vec![admin_id[0], admin_id[1], old_ratio, new_ratio, counter];
    
    insert_event(EVENT_RESERVE_RATIO_CHANGE, &mut data);
}

/// Helper function to insert regular events
pub fn insert_event_wrapper(event_type: u64, data: &[u64]) {
    let mut data_vec = data.to_vec();
    insert_event(event_type, &mut data_vec);
}