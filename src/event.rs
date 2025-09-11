use serde::Serialize;
use zkwasm_rest_abi::StorageData;
use zkwasm_rest_convention::objects::IndexedObject;
use zkwasm_rest_convention::event::insert_event;
use crate::certificate::{ProductType, Certificate};
use crate::config::{
    EVENT_PRODUCT_TYPE_CREATED, EVENT_CERTIFICATE_PURCHASED, 
    EVENT_INTEREST_CLAIMED, EVENT_PRINCIPAL_REDEEMED, 
    EVENT_INDEXED_OBJECT, PRODUCT_TYPE_INFO, CERTIFICATE_INFO
};

// Re-export clear_events from zkwasm_rest_convention
pub use zkwasm_rest_convention::event::clear_events;

/// Product Type Event for IndexedObject
#[derive(Serialize, Clone)]
pub struct ProductTypeEvent {
    pub id: u64,
    pub duration_days: u64,
    pub apy: u64,
    pub min_amount: u64,
    pub is_active: bool,
}

impl StorageData for ProductTypeEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let id = *u64data.next().unwrap();
        let duration_days = *u64data.next().unwrap();
        let apy = *u64data.next().unwrap();
        let min_amount = *u64data.next().unwrap();
        let is_active = *u64data.next().unwrap() != 0;

        ProductTypeEvent {
            id,
            duration_days,
            apy,
            min_amount,
            is_active,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.id);
        data.push(self.duration_days);
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
    pub last_interest_claim: u64,
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
        let last_interest_claim = *u64data.next().unwrap();
        let status = *u64data.next().unwrap();

        CertificateEvent {
            id,
            owner,
            product_type_id,
            principal,
            purchase_time,
            maturity_time,
            locked_apy,
            last_interest_claim,
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
        data.push(self.last_interest_claim);
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
    pub timestamp: u64,
}

impl StorageData for InterestClaimEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let user_id = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let certificate_id = *u64data.next().unwrap();
        let amount = *u64data.next().unwrap();
        let txid = *u64data.next().unwrap();
        let timestamp = *u64data.next().unwrap();

        InterestClaimEvent {
            user_id,
            certificate_id,
            amount,
            txid,
            timestamp,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.user_id[0]);
        data.push(self.user_id[1]);
        data.push(self.certificate_id);
        data.push(self.amount);
        data.push(self.txid);
        data.push(self.timestamp);
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
    pub timestamp: u64,
}

impl StorageData for PrincipalRedemptionEvent {
    fn from_data(u64data: &mut std::slice::IterMut<u64>) -> Self {
        let user_id = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let certificate_id = *u64data.next().unwrap();
        let amount = *u64data.next().unwrap();
        let txid = *u64data.next().unwrap();
        let timestamp = *u64data.next().unwrap();

        PrincipalRedemptionEvent {
            user_id,
            certificate_id,
            amount,
            txid,
            timestamp,
        }
    }

    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.user_id[0]);
        data.push(self.user_id[1]);
        data.push(self.certificate_id);
        data.push(self.amount);
        data.push(self.txid);
        data.push(self.timestamp);
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
    counter: u64
) {
    let mut data = Vec::new();
    data.push(user_id[0]);
    data.push(user_id[1]);
    data.push(certificate_id);
    data.push(amount);
    data.push(counter); // Use counter as txid
    data.push(counter); // timestamp
    
    insert_event(EVENT_INTEREST_CLAIMED, &mut data);
}

/// Helper function to emit Principal Redemption event
pub fn emit_principal_redemption_event(
    user_id: [u64; 2],
    certificate_id: u64,
    amount: u64,
    counter: u64
) {
    let mut data = Vec::new();
    data.push(user_id[0]);
    data.push(user_id[1]);
    data.push(certificate_id);
    data.push(amount);
    data.push(counter); // Use counter as txid
    data.push(counter); // timestamp
    
    insert_event(EVENT_PRINCIPAL_REDEEMED, &mut data);
}

/// Helper function to insert regular events
pub fn insert_event_wrapper(event_type: u64, data: &[u64]) {
    let mut data_vec = data.to_vec();
    insert_event(event_type, &mut data_vec);
}