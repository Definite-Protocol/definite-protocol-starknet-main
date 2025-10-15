use anyhow::{Result, Context};
use starknet::core::types::{FieldElement, BlockId, BlockTag};
use starknet::accounts::{Account, Call, ConnectedAccount};
use starknet::providers::Provider;
use num_bigint::BigUint;
use num_traits::ToPrimitive;

use super::{Contract, CallResult, utils};

/// Protocol Vault contract interface
pub struct VaultContract<A: Account> {
    address: FieldElement,
    account: A,
}

impl<A: Account + ConnectedAccount + Sync> VaultContract<A> {
    pub async fn new(account: &A) -> Result<VaultContract<A>> 
    where
        A: Clone,
    {
        // In a real implementation, this would load the address from config
        let address = FieldElement::from_hex_be("0x1")?; // Placeholder
        
        Ok(VaultContract {
            address,
            account: account.clone(),
        })
    }
    
    pub fn with_address(account: A, address: FieldElement) -> VaultContract<A> {
        VaultContract { address, account }
    }
    
    /// Deposit STRK tokens and receive hSTRK
    pub async fn deposit(
        &self,
        amount: BigUint,
        recipient: Option<String>,
    ) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let amount_felt = utils::bigint_to_felt(&amount)?;
        let recipient_felt = if let Some(addr) = recipient {
            utils::parse_address(&addr)?
        } else {
            self.account.address()
        };
        
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("deposit")?,
            calldata: vec![amount_felt, recipient_felt],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Withdraw STRK tokens by burning hSTRK
    pub async fn withdraw(&self, shares: BigUint) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let shares_felt = utils::bigint_to_felt(&shares)?;
        
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("withdraw")?,
            calldata: vec![shares_felt],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Calculate current exchange rate (assets per share)
    pub async fn calculate_exchange_rate(&self) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("calculate_exchange_rate")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Err(anyhow::anyhow!("No return data from exchange rate call"));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Get total assets under management
    pub async fn total_assets(&self) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("total_assets")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Err(anyhow::anyhow!("No return data from total assets call"));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Get total shares outstanding
    pub async fn total_shares(&self) -> Result<BigUint> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("total_shares")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.is_empty() {
            return Err(anyhow::anyhow!("No return data from total shares call"));
        }
        
        Ok(utils::felt_to_bigint(call_result[0]))
    }
    
    /// Collect management fees
    pub async fn collect_management_fee(&self) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("collect_management_fee")?,
            calldata: vec![],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Get vault configuration
    pub async fn get_vault_config(&self) -> Result<VaultConfig> {
        let call_result = self.account.provider().call(
            starknet::core::types::FunctionCall {
                contract_address: self.address,
                entry_point_selector: starknet::core::utils::get_selector_from_name("get_vault_config")?,
                calldata: vec![],
            },
            BlockId::Tag(BlockTag::Latest),
        ).await?;
        
        if call_result.len() < 6 {
            return Err(anyhow::anyhow!("Insufficient return data from vault config call"));
        }
        
        Ok(VaultConfig {
            management_fee_bps: utils::felt_to_bigint(call_result[0]),
            performance_fee_bps: utils::felt_to_bigint(call_result[1]),
            deposit_limit: utils::felt_to_bigint(call_result[2]),
            min_deposit: utils::felt_to_bigint(call_result[3]),
            withdrawal_delay: utils::felt_to_bigint(call_result[4]),
            emergency_mode: call_result[5] != FieldElement::ZERO,
        })
    }
    
    /// Get hSTRK token address
    pub fn hstrk_token_address(&self) -> FieldElement {
        // In a real implementation, this would be fetched from the contract
        FieldElement::from_hex_be("0x2").unwrap() // Placeholder
    }
    
    /// Get STRK token address
    pub fn strk_token_address(&self) -> FieldElement {
        // In a real implementation, this would be fetched from the contract
        FieldElement::from_hex_be("0x3").unwrap() // Placeholder
    }
    
    /// Emergency pause the vault
    pub async fn emergency_pause(&self) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("emergency_pause")?,
            calldata: vec![],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
    
    /// Resume vault operations
    pub async fn resume_operations(&self) -> Result<FieldElement> where <A as Account>::SignError: 'static {
        let call = Call {
            to: self.address,
            selector: starknet::core::utils::get_selector_from_name("resume_operations")?,
            calldata: vec![],
        };
        
        let result = self.account.execute(vec![call]).send().await?;
        Ok(result.transaction_hash)
    }
}

impl<A: Account> Contract for VaultContract<A> {
    fn address(&self) -> FieldElement {
        self.address
    }
    
    fn name(&self) -> &str {
        "ProtocolVault"
    }
}

/// Vault configuration structure
#[derive(Debug, Clone)]
pub struct VaultConfig {
    pub management_fee_bps: BigUint,
    pub performance_fee_bps: BigUint,
    pub deposit_limit: BigUint,
    pub min_deposit: BigUint,
    pub withdrawal_delay: BigUint,
    pub emergency_mode: bool,
}

/// Yield report structure
#[derive(Debug, Clone)]
pub struct YieldReport {
    pub period_start: u64,
    pub period_end: u64,
    pub total_yield: BigUint,
    pub funding_yield: BigUint,
    pub volatility_yield: BigUint,
    pub fees_collected: BigUint,
    pub apy: f64,
}

impl VaultConfig {
    pub fn management_fee_percentage(&self) -> f64 {
        self.management_fee_bps.to_f64().unwrap_or(0.0) / 10000.0
    }
    
    pub fn performance_fee_percentage(&self) -> f64 {
        self.performance_fee_bps.to_f64().unwrap_or(0.0) / 10000.0
    }
}
