use anyhow::Result;
use starknet::core::types::FieldElement;
use starknet::accounts::Account;

use super::Contract;

/// Risk Manager contract interface
pub struct RiskContract<A: Account> {
    address: FieldElement,
    account: A,
}

impl<A: Account> RiskContract<A> {
    pub async fn new(account: &A) -> Result<RiskContract<A>> 
    where
        A: Clone,
    {
        let address = FieldElement::from_hex_be("0x5")?; // Placeholder
        
        Ok(RiskContract {
            address,
            account: account.clone(),
        })
    }
}

impl<A: Account> Contract for RiskContract<A> {
    fn address(&self) -> FieldElement {
        self.address
    }
    
    fn name(&self) -> &str {
        "RiskManager"
    }
}
