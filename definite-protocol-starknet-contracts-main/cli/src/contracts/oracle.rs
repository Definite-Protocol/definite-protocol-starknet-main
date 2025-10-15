use anyhow::Result;
use starknet::core::types::FieldElement;
use starknet::accounts::Account;

use super::Contract;

/// Price Oracle contract interface
pub struct OracleContract<A: Account> {
    address: FieldElement,
    account: A,
}

impl<A: Account> OracleContract<A> {
    pub async fn new(account: &A) -> Result<OracleContract<A>> 
    where
        A: Clone,
    {
        let address = FieldElement::from_hex_be("0x4")?; // Placeholder
        
        Ok(OracleContract {
            address,
            account: account.clone(),
        })
    }
}

impl<A: Account> Contract for OracleContract<A> {
    fn address(&self) -> FieldElement {
        self.address
    }
    
    fn name(&self) -> &str {
        "PriceOracle"
    }
}
