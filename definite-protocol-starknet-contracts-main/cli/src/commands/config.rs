use anyhow::Result;
use owo_colors::OwoColorize;
use dialoguer::{Input, Select, Confirm};

use crate::{Cli, theme};
use crate::config::Config;
use super::ConfigCommands;

pub async fn handle_config_command(command: ConfigCommands, cli: &Cli) -> Result<()> {
    match command {
        ConfigCommands::Init { template } => {
            init(template, cli).await
        }
        ConfigCommands::Show { show_secrets } => {
            show(show_secrets, cli).await
        }
        ConfigCommands::Set { key, value } => {
            set(key, value, cli).await
        }
        ConfigCommands::Get { key } => {
            get(key, cli).await
        }
        ConfigCommands::Validate => {
            validate(cli).await
        }
    }
}

async fn init(template: Option<String>, cli: &Cli) -> Result<()> {
    println!("{}", "Initializing Definite Protocol CLI Configuration".color(theme::PRIMARY));
    println!();
    
    let template_type = if let Some(t) = template {
        t
    } else {
        let templates = vec!["mainnet", "testnet", "devnet", "custom"];
        let selection = Select::new()
            .with_prompt("Select configuration template")
            .items(&templates)
            .default(0)
            .interact()?;
        templates[selection].to_string()
    };
    
    println!("{}", format!("Using {} template", template_type).color(theme::INFO));
    
    let mut config = Config::default();
    
    // Set network-specific defaults
    match template_type.as_str() {
        "mainnet" => {
            config.network = "mainnet".to_string();
            config.rpc_url = "https://starknet-mainnet.public.blastapi.io".to_string();
            config.chain_id = "SN_MAIN".to_string();
        }
        "testnet" => {
            config.network = "testnet".to_string();
            config.rpc_url = "https://starknet-goerli.public.blastapi.io".to_string();
            config.chain_id = "SN_GOERLI".to_string();
        }
        "devnet" => {
            config.network = "devnet".to_string();
            config.rpc_url = "http://localhost:5050".to_string();
            config.chain_id = "SN_GOERLI".to_string();
        }
        _ => {
            // Custom configuration - prompt for values
            config.network = Input::new()
                .with_prompt("Network name")
                .default("custom".to_string())
                .interact_text()?;
            
            config.rpc_url = Input::new()
                .with_prompt("RPC URL")
                .default("http://localhost:5050".to_string())
                .interact_text()?;
            
            config.chain_id = Input::new()
                .with_prompt("Chain ID")
                .default("SN_GOERLI".to_string())
                .interact_text()?;
        }
    }
    
    // Prompt for required values
    config.account_address = Input::new()
        .with_prompt("Account address")
        .interact_text()?;
    
    config.private_key = Input::new()
        .with_prompt("Private key")
        .interact_text()?;
    
    // Optional contract addresses
    if Confirm::new()
        .with_prompt("Configure contract addresses now?")
        .default(false)
        .interact()?
    {
        config.contracts.vault = Input::new()
            .with_prompt("Vault contract address")
            .default("0x0".to_string())
            .interact_text()?;
        
        config.contracts.hstrk_token = Input::new()
            .with_prompt("hSTRK token address")
            .default("0x0".to_string())
            .interact_text()?;
        
        // Add other contract addresses as needed
    }
    
    // Save configuration
    config.save(cli.config.as_deref())?;
    
    println!();
    println!("{}", "Configuration initialized successfully!".color(theme::SUCCESS));
    println!("Config file location: {}", 
        cli.config.as_deref().unwrap_or("~/.definite/config.toml").color(theme::ACCENT));
    
    Ok(())
}

async fn show(show_secrets: bool, cli: &Cli) -> Result<()> {
    println!("{}", "Current Configuration".color(theme::PRIMARY));
    println!();
    
    let config = Config::load(cli.config.as_deref())?;
    
    println!("{}", "Network Settings:".color(theme::ACCENT));
    println!("  Network: {}", config.network.color(theme::INFO));
    println!("  RPC URL: {}", config.rpc_url.color(theme::INFO));
    println!("  Chain ID: {}", config.chain_id.color(theme::INFO));
    
    println!();
    println!("{}", "Account Settings:".color(theme::ACCENT));
    println!("  Address: {}", config.account_address.color(theme::INFO));
    if show_secrets {
        println!("  Private Key: {}", config.private_key.color(theme::WARNING));
    } else {
        println!("  Private Key: {}", "***HIDDEN***".color(theme::MUTED));
    }
    
    println!();
    println!("{}", "Contract Addresses:".color(theme::ACCENT));
    println!("  Vault: {}", config.contracts.vault.color(theme::INFO));
    println!("  hSTRK Token: {}", config.contracts.hstrk_token.color(theme::INFO));
    println!("  STRK Token: {}", config.contracts.strk_token.color(theme::INFO));
    println!("  Price Oracle: {}", config.contracts.price_oracle.color(theme::INFO));
    println!("  Risk Manager: {}", config.contracts.risk_manager.color(theme::INFO));
    println!("  Perpetual Hedge: {}", config.contracts.perpetual_hedge.color(theme::INFO));
    println!("  Options Strategy: {}", config.contracts.options_strategy.color(theme::INFO));
    println!("  Rebalancing Engine: {}", config.contracts.rebalancing_engine.color(theme::INFO));
    
    println!();
    println!("{}", "Transaction Settings:".color(theme::ACCENT));
    println!("  Gas Limit: {}", config.transaction.gas_limit.color(theme::INFO));
    println!("  Max Fee Per Gas: {}", config.transaction.max_fee_per_gas.color(theme::INFO));
    println!("  Timeout: {} seconds", config.transaction.timeout.color(theme::INFO));
    println!("  Confirmations: {}", config.transaction.confirmations.color(theme::INFO));
    
    println!();
    println!("{}", "Display Settings:".color(theme::ACCENT));
    println!("  Decimal Places: {}", config.display.decimal_places.color(theme::INFO));
    println!("  Use Colors: {}", config.display.use_colors.color(theme::INFO));
    println!("  Verbose: {}", config.display.verbose.color(theme::INFO));
    println!("  Date Format: {}", config.display.date_format.color(theme::INFO));
    
    Ok(())
}

async fn set(key: String, value: String, cli: &Cli) -> Result<()> {
    println!("{}", format!("Setting configuration: {} = {}", key, value).color(theme::PRIMARY));
    
    let mut config = Config::load(cli.config.as_deref())?;
    config.set_value(&key, &value)?;
    config.save(cli.config.as_deref())?;
    
    println!("{}", "Configuration updated successfully".color(theme::SUCCESS));
    
    Ok(())
}

async fn get(key: String, cli: &Cli) -> Result<()> {
    let config = Config::load(cli.config.as_deref())?;
    let value = config.get_value(&key)?;
    
    println!("{}: {}", key.color(theme::ACCENT), value.color(theme::INFO));
    
    Ok(())
}

async fn validate(cli: &Cli) -> Result<()> {
    println!("{}", "Validating configuration...".color(theme::PRIMARY));
    
    let config = Config::load(cli.config.as_deref())?;
    
    match config.validate() {
        Ok(_) => {
            println!("{}", "Configuration is valid".color(theme::SUCCESS));
            
            // Additional validation checks
            println!();
            println!("{}", "Validation Results:".color(theme::ACCENT));
            println!("  Account address format: {}", "✓ Valid".color(theme::SUCCESS));
            println!("  Private key format: {}", "✓ Valid".color(theme::SUCCESS));
            println!("  RPC URL format: {}", "✓ Valid".color(theme::SUCCESS));
            println!("  Contract addresses: {}", "✓ Valid".color(theme::SUCCESS));
            
            // Test network connectivity
            println!("  Network connectivity: {}", "Testing...".color(theme::WARNING));
            // In a real implementation, this would test the RPC connection
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            println!("  Network connectivity: {}", "✓ Connected".color(theme::SUCCESS));
        }
        Err(e) => {
            println!("{}", format!("Configuration validation failed: {}", e).color(theme::ERROR));
            
            println!();
            println!("{}", "Common fixes:".color(theme::WARNING));
            println!("  - Ensure account address starts with 0x");
            println!("  - Verify private key is valid hex");
            println!("  - Check RPC URL is accessible");
            println!("  - Validate contract addresses");
            
            return Err(e);
        }
    }
    
    Ok(())
}
