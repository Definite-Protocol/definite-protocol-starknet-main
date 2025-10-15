use anyhow::Result;
use starknet::core::types::FieldElement;
use starknet::accounts::Account;

use super::Contract;

/// Hedging contracts interface
pub struct HedgingContract<A: Account> {
    address: FieldElement,
    account: A,
}

impl<A: Account> HedgingContract<A> {
    pub async fn new(account: &A) -> Result<HedgingContract<A>> 
    where
        A: Clone,
    {
        let address = FieldElement::from_hex_be("0x6")?; // Placeholder
        
        Ok(HedgingContract {
            address,
            account: account.clone(),
        })
    }
}

impl<A: Account> Contract for HedgingContract<A> {
    fn address(&self) -> FieldElement {
        self.address
    }
    
    fn name(&self) -> &str {
        "HedgingStrategy"
    }
}
