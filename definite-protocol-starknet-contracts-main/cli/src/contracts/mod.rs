pub mod vault;
pub mod token;
pub mod oracle;
pub mod risk;
pub mod hedging;
pub mod rebalancing;

use anyhow::Result;
use starknet::core::types::FieldElement;
use starknet::accounts::Account;
use num_bigint::BigUint;

/// Common contract interface
pub trait Contract {
    fn address(&self) -> FieldElement;
    fn name(&self) -> &str;
}

/// Contract deployment configuration
#[derive(Debug, Clone)]
pub struct DeploymentConfig {
    pub network: String,
    pub owner: FieldElement,
    pub initial_params: std::collections::HashMap<String, String>,
}

/// Contract call result
#[derive(Debug)]
pub struct CallResult {
    pub success: bool,
    pub return_data: Vec<FieldElement>,
    pub gas_used: Option<u64>,
    pub transaction_hash: Option<FieldElement>,
}

/// Utility functions for contract interaction
pub mod utils {
    use super::*;
    use starknet::core::types::{FieldElement, BlockId, BlockTag};
    use starknet::providers::Provider;
    
    /// Convert BigUint to FieldElement
    pub fn bigint_to_felt(value: &BigUint) -> Result<FieldElement> {
        let bytes = value.to_bytes_be();
        if bytes.len() > 32 {
            return Err(anyhow::anyhow!("Value too large for FieldElement"));
        }
        
        let mut padded = [0u8; 32];
        let start = 32 - bytes.len();
        padded[start..].copy_from_slice(&bytes);
        
        Ok(FieldElement::from_bytes_be(&padded)?)
    }
    
    /// Convert FieldElement to BigUint
    pub fn felt_to_bigint(felt: FieldElement) -> BigUint {
        BigUint::from_bytes_be(&felt.to_bytes_be())
    }
    
    /// Format contract address for display
    pub fn format_address(address: FieldElement) -> String {
        format!("0x{:064x}", address)
    }
    
    /// Parse address from string
    pub fn parse_address(address: &str) -> Result<FieldElement> {
        if address.starts_with("0x") {
            FieldElement::from_hex_be(address).map_err(|e| anyhow::anyhow!("Invalid address: {}", e))
        } else {
            FieldElement::from_hex_be(&format!("0x{}", address)).map_err(|e| anyhow::anyhow!("Invalid address: {}", e))
        }
    }
    
    /// Get current block number
    pub async fn get_current_block<P: Provider>(provider: &P) -> Result<u64> {
        let block = provider.get_block_with_tx_hashes(BlockId::Tag(BlockTag::Latest)).await?;
        match block {
            starknet::core::types::MaybePendingBlockWithTxHashes::Block(block) => Ok(block.block_number),
            starknet::core::types::MaybePendingBlockWithTxHashes::PendingBlock(_) => Ok(0), // Return 0 for pending blocks
        }
    }
    
    /// Wait for transaction confirmation
    pub async fn wait_for_transaction<P: Provider>(
        provider: &P,
        tx_hash: FieldElement,
        max_retries: u32,
    ) -> Result<bool> {
        for _ in 0..max_retries {
            match provider.get_transaction_receipt(tx_hash).await {
                Ok(_) => return Ok(true),
                Err(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
            }
        }
        Ok(false)
    }
}

/// Contract addresses for different networks
pub mod addresses {
    use starknet::core::types::FieldElement;
    use std::collections::HashMap;
    
    pub struct NetworkAddresses {
        pub vault: FieldElement,
        pub hstrk_token: FieldElement,
        pub strk_token: FieldElement,
        pub price_oracle: FieldElement,
        pub risk_manager: FieldElement,
        pub perpetual_hedge: FieldElement,
        pub options_strategy: FieldElement,
        pub rebalancing_engine: FieldElement,
    }
    
    pub fn get_addresses(network: &str) -> Option<NetworkAddresses> {
        match network {
            "mainnet" => Some(NetworkAddresses {
                vault: FieldElement::from_hex_be("0x1").unwrap(), // Placeholder
                hstrk_token: FieldElement::from_hex_be("0x2").unwrap(),
                strk_token: FieldElement::from_hex_be("0x3").unwrap(),
                price_oracle: FieldElement::from_hex_be("0x4").unwrap(),
                risk_manager: FieldElement::from_hex_be("0x5").unwrap(),
                perpetual_hedge: FieldElement::from_hex_be("0x6").unwrap(),
                options_strategy: FieldElement::from_hex_be("0x7").unwrap(),
                rebalancing_engine: FieldElement::from_hex_be("0x8").unwrap(),
            }),
            "testnet" => Some(NetworkAddresses {
                vault: FieldElement::from_hex_be("0x11").unwrap(), // Placeholder
                hstrk_token: FieldElement::from_hex_be("0x12").unwrap(),
                strk_token: FieldElement::from_hex_be("0x13").unwrap(),
                price_oracle: FieldElement::from_hex_be("0x14").unwrap(),
                risk_manager: FieldElement::from_hex_be("0x15").unwrap(),
                perpetual_hedge: FieldElement::from_hex_be("0x16").unwrap(),
                options_strategy: FieldElement::from_hex_be("0x17").unwrap(),
                rebalancing_engine: FieldElement::from_hex_be("0x18").unwrap(),
            }),
            "devnet" => Some(NetworkAddresses {
                vault: FieldElement::from_hex_be("0x21").unwrap(), // Placeholder
                hstrk_token: FieldElement::from_hex_be("0x22").unwrap(),
                strk_token: FieldElement::from_hex_be("0x23").unwrap(),
                price_oracle: FieldElement::from_hex_be("0x24").unwrap(),
                risk_manager: FieldElement::from_hex_be("0x25").unwrap(),
                perpetual_hedge: FieldElement::from_hex_be("0x26").unwrap(),
                options_strategy: FieldElement::from_hex_be("0x27").unwrap(),
                rebalancing_engine: FieldElement::from_hex_be("0x28").unwrap(),
            }),
            _ => None,
        }
    }
}
