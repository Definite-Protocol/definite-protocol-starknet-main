use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

/// CLI configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Starknet RPC URL
    pub rpc_url: String,
    
    /// Account address
    pub account_address: String,
    
    /// Private key (encrypted or plain)
    pub private_key: String,
    
    /// Chain ID
    pub chain_id: String,
    
    /// Network name
    pub network: String,
    
    /// Contract addresses
    pub contracts: ContractAddresses,
    
    /// Default transaction settings
    pub transaction: TransactionConfig,
    
    /// Display preferences
    pub display: DisplayConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractAddresses {
    pub vault: String,
    pub hstrk_token: String,
    pub strk_token: String,
    pub price_oracle: String,
    pub risk_manager: String,
    pub perpetual_hedge: String,
    pub options_strategy: String,
    pub rebalancing_engine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionConfig {
    /// Default gas limit
    pub gas_limit: u64,
    
    /// Default max fee per gas
    pub max_fee_per_gas: String,
    
    /// Transaction timeout in seconds
    pub timeout: u64,
    
    /// Number of confirmation blocks to wait
    pub confirmations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayConfig {
    /// Number of decimal places for amounts
    pub decimal_places: u8,
    
    /// Use colors in output
    pub use_colors: bool,
    
    /// Show detailed information by default
    pub verbose: bool,
    
    /// Date format string
    pub date_format: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            rpc_url: "https://starknet-sepolia.infura.io/v3/f96264cf853c424ab5678e8301ca0462".to_string(),
            account_address: "0x01f411b366890429179d868cfc5ae89cd22c595cdcd31859f54759c16a9cc20e".to_string(),
            private_key: "0x3f9721e722755ce2f6d925fff04676805c8d4cdd8d1b3931753e917a85f4ce2".to_string(),
            chain_id: "0x534e5f5345504f4c4941".to_string(),
            network: "sepolia".to_string(),
            contracts: ContractAddresses::default(),
            transaction: TransactionConfig::default(),
            display: DisplayConfig::default(),
        }
    }
}

impl Default for ContractAddresses {
    fn default() -> Self {
        ContractAddresses {
            vault: "0x04ca6a156f683ce0e1340a4488c608b67c55cfd8c5bd646a30aea7bced164aa4".to_string(), // Deployed Protocol Vault
            hstrk_token: "0x0142895eab6ca66eeaf80d5f6bca8dd57559c80f1954f6e6aaf49e8aa76eb4f8".to_string(), // Deployed hSTRK token
            strk_token: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d".to_string(), // STRK token on sepolia
            price_oracle: "0x0225cf5aa1cf009052c3359e0f7b9156cc3e65bf39b64bef14566c19476768fe".to_string(), // Deployed Price Oracle
            risk_manager: "0x02b7ed5e0c9b8e22fb5f10c0c1bd1cc2ce32958c3f9eb5db313a6120bd524a9d".to_string(), // Deployed Risk Manager
            perpetual_hedge: "0x004fbb92f86eaeb8f9ebc34765ae0b791b880634be2e6508baeb5d3e9fff5061".to_string(),
            options_strategy: "0x02501c12f953d491c49a35040aea4d6b8f02b28e8eb9f50705853acd819feb8c".to_string(),
            rebalancing_engine: "0x06063a8abd3c7be5ce3119ccd6d2379fe8faa8f4781850fb01997b3b0ceee6ad".to_string(),
        }
    }
}

impl Default for TransactionConfig {
    fn default() -> Self {
        TransactionConfig {
            gas_limit: 1000000,
            max_fee_per_gas: "1000000000".to_string(), // 1 gwei
            timeout: 300, // 5 minutes
            confirmations: 1,
        }
    }
}

impl Default for DisplayConfig {
    fn default() -> Self {
        DisplayConfig {
            decimal_places: 6,
            use_colors: true,
            verbose: false,
            date_format: "%Y-%m-%d %H:%M:%S UTC".to_string(),
        }
    }
}

impl Config {
    /// Load configuration from file or create default
    pub fn load(config_path: Option<&str>) -> Result<Self> {
        let path = Self::get_config_path(config_path)?;
        
        if path.exists() {
            let content = fs::read_to_string(&path)
                .context("Failed to read config file")?;
            
            toml::from_str(&content)
                .context("Failed to parse config file")
        } else {
            // Create default config
            let config = Config::default();
            config.save(Some(path.to_str().unwrap()))?;
            Ok(config)
        }
    }
    
    /// Save configuration to file
    pub fn save(&self, config_path: Option<&str>) -> Result<()> {
        let path = Self::get_config_path(config_path)?;
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create config directory")?;
        }
        
        let content = toml::to_string_pretty(self)
            .context("Failed to serialize config")?;
        
        fs::write(&path, content)
            .context("Failed to write config file")?;
        
        Ok(())
    }
    
    /// Get configuration file path
    fn get_config_path(config_path: Option<&str>) -> Result<PathBuf> {
        if let Some(path) = config_path {
            Ok(PathBuf::from(path))
        } else {
            // Use default config location
            let home = dirs::home_dir()
                .context("Could not find home directory")?;
            
            Ok(home.join(".definite").join("config.toml"))
        }
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.account_address.is_empty() {
            return Err(anyhow::anyhow!("Account address is required"));
        }
        
        if self.private_key.is_empty() {
            return Err(anyhow::anyhow!("Private key is required"));
        }
        
        if self.rpc_url.is_empty() {
            return Err(anyhow::anyhow!("RPC URL is required"));
        }
        
        // Validate addresses format
        crate::utils::validate_address(&self.account_address)
            .context("Invalid account address")?;
        
        // Validate contract addresses if not zero
        for (name, address) in [
            ("vault", &self.contracts.vault),
            ("hstrk_token", &self.contracts.hstrk_token),
            ("strk_token", &self.contracts.strk_token),
            ("price_oracle", &self.contracts.price_oracle),
            ("risk_manager", &self.contracts.risk_manager),
            ("perpetual_hedge", &self.contracts.perpetual_hedge),
            ("options_strategy", &self.contracts.options_strategy),
            ("rebalancing_engine", &self.contracts.rebalancing_engine),
        ] {
            if address != "0x0" && !address.is_empty() {
                crate::utils::validate_address(address)
                    .with_context(|| format!("Invalid {} contract address", name))?;
            }
        }
        
        Ok(())
    }
    
    /// Update configuration value
    pub fn set_value(&mut self, key: &str, value: &str) -> Result<()> {
        match key {
            "rpc_url" => self.rpc_url = value.to_string(),
            "account_address" => self.account_address = value.to_string(),
            "private_key" => self.private_key = value.to_string(),
            "chain_id" => self.chain_id = value.to_string(),
            "network" => self.network = value.to_string(),
            "contracts.vault" => self.contracts.vault = value.to_string(),
            "contracts.hstrk_token" => self.contracts.hstrk_token = value.to_string(),
            "contracts.strk_token" => self.contracts.strk_token = value.to_string(),
            "contracts.price_oracle" => self.contracts.price_oracle = value.to_string(),
            "contracts.risk_manager" => self.contracts.risk_manager = value.to_string(),
            "contracts.perpetual_hedge" => self.contracts.perpetual_hedge = value.to_string(),
            "contracts.options_strategy" => self.contracts.options_strategy = value.to_string(),
            "contracts.rebalancing_engine" => self.contracts.rebalancing_engine = value.to_string(),
            "transaction.gas_limit" => {
                self.transaction.gas_limit = value.parse()
                    .context("Invalid gas limit value")?;
            }
            "transaction.max_fee_per_gas" => self.transaction.max_fee_per_gas = value.to_string(),
            "transaction.timeout" => {
                self.transaction.timeout = value.parse()
                    .context("Invalid timeout value")?;
            }
            "transaction.confirmations" => {
                self.transaction.confirmations = value.parse()
                    .context("Invalid confirmations value")?;
            }
            "display.decimal_places" => {
                self.display.decimal_places = value.parse()
                    .context("Invalid decimal places value")?;
            }
            "display.use_colors" => {
                self.display.use_colors = value.parse()
                    .context("Invalid use_colors value")?;
            }
            "display.verbose" => {
                self.display.verbose = value.parse()
                    .context("Invalid verbose value")?;
            }
            "display.date_format" => self.display.date_format = value.to_string(),
            _ => return Err(anyhow::anyhow!("Unknown configuration key: {}", key)),
        }
        
        Ok(())
    }
    
    /// Get configuration value
    pub fn get_value(&self, key: &str) -> Result<String> {
        let value = match key {
            "rpc_url" => &self.rpc_url,
            "account_address" => &self.account_address,
            "private_key" => "***HIDDEN***", // Don't show private key
            "chain_id" => &self.chain_id,
            "network" => &self.network,
            "contracts.vault" => &self.contracts.vault,
            "contracts.hstrk_token" => &self.contracts.hstrk_token,
            "contracts.strk_token" => &self.contracts.strk_token,
            "contracts.price_oracle" => &self.contracts.price_oracle,
            "contracts.risk_manager" => &self.contracts.risk_manager,
            "contracts.perpetual_hedge" => &self.contracts.perpetual_hedge,
            "contracts.options_strategy" => &self.contracts.options_strategy,
            "contracts.rebalancing_engine" => &self.contracts.rebalancing_engine,
            "transaction.gas_limit" => return Ok(self.transaction.gas_limit.to_string()),
            "transaction.max_fee_per_gas" => &self.transaction.max_fee_per_gas,
            "transaction.timeout" => return Ok(self.transaction.timeout.to_string()),
            "transaction.confirmations" => return Ok(self.transaction.confirmations.to_string()),
            "display.decimal_places" => return Ok(self.display.decimal_places.to_string()),
            "display.use_colors" => return Ok(self.display.use_colors.to_string()),
            "display.verbose" => return Ok(self.display.verbose.to_string()),
            "display.date_format" => &self.display.date_format,
            _ => return Err(anyhow::anyhow!("Unknown configuration key: {}", key)),
        };
        
        Ok(value.to_string())
    }
}
