use anyhow::Result;
use starknet::core::types::{FieldElement, BlockId, BlockTag};
use starknet::accounts::{Account, Call, ConnectedAccount};
use starknet::providers::Provider;
use num_bigint::BigUint;

use super::{Contract, utils};

/// ERC20 Token contract interface
pub struct TokenContract<A: Account> {
    address: FieldElement,
    account: A,
}

impl<A: Account + ConnectedAccount + Sync> TokenContract<A> {
    pub async fn new(account: &A, token_address: FieldElement) -> Result<TokenContract<A>> 
    where
        A: Clone,
    {
        Ok(TokenContract {
            address: token_address,
            account: account.clone(),
        })
    }
    
    /// Get token balance for an address
    pub async fn balance_of(&self, owner: FieldElement) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("balance_of")?,
                calldata: vec![owner],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Ok(BigUint::from(0u32));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Get allowance for spender
    pub async fn allowance(&self, owner: FieldElement, spender: FieldElement) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("allowance")?,
                calldata: vec![owner, spender],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Ok(BigUint::from(0u32));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Approve spender to spend tokens
    pub async fn approve(&self, spender: FieldElement, amount: BigUint) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let amount_felt = utils::bigint_to_felt(&amount)?;
        
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("approve")?,
            calldata: vec![spender, amount_felt],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Transfer tokens
    pub async fn transfer(&self, to: FieldElement, amount: BigUint) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let amount_felt = utils::bigint_to_felt(&amount)?;
        
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("transfer")?,
            calldata: vec![to, amount_felt],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Get total supply
    pub async fn total_supply(&self) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("total_supply")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Ok(BigUint::from(0u32));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Get token name
    pub async fn name(&self) -> Result<String> {
        // Implementation would decode the ByteArray return from the contract
        Ok("Token".to_string()) // Placeholder
    }
    
    /// Get token symbol
    pub async fn symbol(&self) -> Result<String> {
        // Implementation would decode the ByteArray return from the contract
        Ok("TKN".to_string()) // Placeholder
    }
    
    /// Get token decimals
    pub async fn decimals(&self) -> Result<u8> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("decimals")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Ok(18); // Default to 18 decimals
        }
        
        Ok(call_result[0].to_bytes_be()[31])
    }
}

impl<A: Account> Contract for TokenContract<A> {
    fn address(&self) -> FieldElement {
        self.address
    }
    
    fn name(&self) -> &str {
        "ERC20Token"
    }
}
