use anyhow::{Result, Context};
use owo_colors::OwoColorize;
use indicatif::{ProgressBar, ProgressStyle};
use dialoguer::{Confirm, Input};
use starknet::providers::{Provider, JsonRpcClient};
use starknet::accounts::{Account, ExecutionEncoding, SingleOwnerAccount};
use starknet::signers::{LocalWallet, SigningKey};
use starknet::core::types::{FieldElement, BlockId, BlockTag};
use num_bigint::BigUint;
use std::str::FromStr;

use crate::{Cli, theme};
use crate::contracts::vault::VaultContract;
use crate::contracts::token::TokenContract;
use crate::utils::{format_amount, parse_amount, get_account};
use super::UserCommands;

pub async fn handle_command(command: UserCommands, cli: &Cli) -> Result<()> {
    match command {
        UserCommands::Deposit { amount, recipient, max_slippage } => {
            deposit(amount, recipient, max_slippage, cli).await
        }
        UserCommands::Withdraw { shares, min_amount } => {
            withdraw(shares, min_amount, cli).await
        }
        UserCommands::Balance { address, detailed } => {
            balance(address, detailed, cli).await
        }
        UserCommands::History { address, limit, filter } => {
            history(address, limit, filter, cli).await
        }
        UserCommands::Simulate { amount, days, detailed } => {
            simulate(amount, days, detailed, cli).await
        }
    }
}

async fn deposit(
    amount: String,
    recipient: Option<String>,
    max_slippage: Option<u16>,
    cli: &Cli,
) -> Result<()> {
    println!("{}", "Initiating STRK deposit to Definite Protocol".color(theme::PRIMARY));
    
    let amount_wei = parse_amount(&amount)?;
    let slippage = max_slippage.unwrap_or(100); // 1% default
    
    // Create progress bar
    let pb = ProgressBar::new(5);
    pb.set_style(theme::progress_style());
    
    pb.set_message("Connecting to Starknet");
    pb.inc(1);
    
    let account = get_account(cli).await?;
    
    pb.set_message("Checking STRK balance");
    pb.inc(1);
    
    let balance = strk_token.balance_of(account.address()).await?;
    if balance < amount_wei {
        pb.finish_with_message("Insufficient STRK balance");
        return Err(anyhow::anyhow!(
            "Insufficient STRK balance. Have: {}, Need: {}",
            format_amount(balance),
            format_amount(amount_wei)
        ));
    }
    
    pb.set_message("Checking allowance");
    pb.inc(1);
    
    let allowance = strk_token.allowance(account.address(), vault.address()).await?;
    if allowance < amount_wei {
        println!("{}", "Approving STRK spending...".color(theme::INFO));
        strk_token.approve(vault.address(), amount_wei).await?;
    }
    
    pb.set_message("Calculating exchange rate");
    pb.inc(1);
    
    let exchange_rate = vault.calculate_exchange_rate().await?;
    let expected_hstrk = amount_wei * BigUint::from(1000000000000000000u64) / exchange_rate;
    
    println!();
    println!("{}", "Deposit Summary:".color(theme::ACCENT));
    println!("  STRK Amount: {}", format_amount(amount_wei.clone()).color(theme::PRIMARY));
    println!("  Expected hSTRK: {}", format_amount(expected_hstrk.clone()).color(theme::PRIMARY));
    println!("  Exchange Rate: {}", format!("{:.6}", exchange_rate.to_f64().unwrap_or(0.0) / 1e18).color(theme::SECONDARY));
    println!("  Max Slippage: {}%", (slippage as f64 / 100.0).color(theme::SECONDARY));
    println!();
    
    if !Confirm::new()
        .with_prompt("Proceed with deposit?")
        .default(true)
        .interact()?
    {
        pb.finish_with_message("Deposit cancelled");
        return Ok(());
    }
    
    pb.set_message("Executing deposit transaction");
    pb.inc(1);
    
    let tx_hash = vault.deposit(amount_wei, recipient).await?;
    
    pb.finish_with_message("Deposit completed successfully");
    
    println!();
    println!("{}", "Deposit Successful!".color(theme::SUCCESS));
    println!("Transaction Hash: {}", tx_hash.color(theme::ACCENT));
    println!("Expected hSTRK: {}", format_amount(expected_hstrk).color(theme::PRIMARY));
    
    Ok(())
}

async fn withdraw(
    shares: String,
    min_amount: Option<String>,
    cli: &Cli,
) -> Result<()> {
    println!("{}", "Initiating hSTRK withdrawal from Definite Protocol".color(theme::PRIMARY));
    
    let shares_wei = parse_amount(&shares)?;
    
    let pb = ProgressBar::new(4);
    pb.set_style(theme::progress_style());
    
    pb.set_message("Connecting to protocol");
    pb.inc(1);
    
    let account = get_account(cli).await?;
    let vault = VaultContract::new(&account).await?;
    let hstrk_token = TokenContract::new(&account, vault.hstrk_token_address()).await?;
    
    pb.set_message("Checking hSTRK balance");
    pb.inc(1);
    
    let balance = hstrk_token.balance_of(account.address()).await?;
    if balance < shares_wei {
        pb.finish_with_message("Insufficient hSTRK balance");
        return Err(anyhow::anyhow!(
            "Insufficient hSTRK balance. Have: {}, Need: {}",
            format_amount(balance),
            format_amount(shares_wei)
        ));
    }
    
    pb.set_message("Calculating withdrawal amount");
    pb.inc(1);
    
    let exchange_rate = vault.calculate_exchange_rate().await?;
    let expected_strk = shares_wei.clone() * exchange_rate / BigUint::from(1000000000000000000u64);
    
    if let Some(min_str) = min_amount {
        let min_wei = parse_amount(&min_str)?;
        if expected_strk < min_wei {
            pb.finish_with_message("Expected amount below minimum");
            return Err(anyhow::anyhow!(
                "Expected STRK amount {} below minimum {}",
                format_amount(expected_strk),
                format_amount(min_wei)
            ));
        }
    }
    
    println!();
    println!("{}", "Withdrawal Summary:".color(theme::ACCENT));
    println!("  hSTRK Amount: {}", format_amount(shares_wei.clone()).color(theme::PRIMARY));
    println!("  Expected STRK: {}", format_amount(expected_strk.clone()).color(theme::PRIMARY));
    println!("  Exchange Rate: {}", format!("{:.6}", exchange_rate.to_f64().unwrap_or(0.0) / 1e18).color(theme::SECONDARY));
    println!();
    
    if !Confirm::new()
        .with_prompt("Proceed with withdrawal?")
        .default(true)
        .interact()?
    {
        pb.finish_with_message("Withdrawal cancelled");
        return Ok(());
    }
    
    pb.set_message("Executing withdrawal transaction");
    pb.inc(1);
    
    let tx_hash = vault.withdraw(shares_wei).await?;
    
    pb.finish_with_message("Withdrawal completed successfully");
    
    println!();
    println!("{}", "Withdrawal Successful!".color(theme::SUCCESS));
    println!("Transaction Hash: {}", tx_hash.color(theme::ACCENT));
    println!("Expected STRK: {}", format_amount(expected_strk).color(theme::PRIMARY));
    
    Ok(())
}

async fn balance(
    address: Option<String>,
    detailed: bool,
    cli: &Cli,
) -> Result<()> {
    let account = get_account(cli).await?;
    let check_address = if let Some(addr) = address {
        FieldElement::from_hex_be(&addr)?
    } else {
        account.address()
    };
    
    println!("{}", format!("Account Balance: {}", check_address).color(theme::PRIMARY));
    println!();
    
    let vault = VaultContract::new(&account).await?;
    let strk_token = TokenContract::new(&account, vault.strk_token_address()).await?;
    let hstrk_token = TokenContract::new(&account, vault.hstrk_token_address()).await?;
    
    let strk_balance = strk_token.balance_of(check_address).await?;
    let hstrk_balance = hstrk_token.balance_of(check_address).await?;
    let exchange_rate = vault.calculate_exchange_rate().await?;
    
    let strk_value = hstrk_balance.clone() * exchange_rate / BigUint::from(1000000000000000000u64);
    let total_value = strk_balance.clone() + strk_value.clone();
    
    println!("{}", "Token Balances:".color(theme::ACCENT));
    println!("  STRK: {}", format_amount(strk_balance).color(theme::PRIMARY));
    println!("  hSTRK: {}", format_amount(hstrk_balance.clone()).color(theme::PRIMARY));
    println!("  hSTRK Value: {}", format_amount(strk_value).color(theme::SECONDARY));
    println!("  Total Value: {}", format_amount(total_value).color(theme::SUCCESS));
    
    if detailed {
        println!();
        println!("{}", "Detailed Information:".color(theme::ACCENT));
        println!("  Exchange Rate: {}", format!("{:.6}", exchange_rate.to_f64().unwrap_or(0.0) / 1e18).color(theme::SECONDARY));
        
        let total_supply = hstrk_token.total_supply().await?;
        let total_assets = vault.total_assets().await?;
        
        if total_supply > BigUint::from(0u32) {
            let share_percentage = (hstrk_balance * BigUint::from(10000u32)) / total_supply;
            println!("  Protocol Share: {}%", (share_percentage.to_f64().unwrap_or(0.0) / 100.0).color(theme::SECONDARY));
        }
        
        println!("  Total Protocol Assets: {}", format_amount(total_assets).color(theme::INFO));
        println!("  Total hSTRK Supply: {}", format_amount(total_supply).color(theme::INFO));
    }
    
    Ok(())
}

async fn history(
    address: Option<String>,
    limit: Option<u32>,
    filter: Option<String>,
    cli: &Cli,
) -> Result<()> {
    println!("{}", "Fetching transaction history...".color(theme::PRIMARY));
    
    // Implementation would fetch transaction history from Starknet
    // This is a placeholder for the actual implementation
    
    println!("{}", "Transaction history feature coming soon!".color(theme::WARNING));
    println!("This will show:");
    println!("  - Deposit transactions");
    println!("  - Withdrawal transactions");
    println!("  - Yield accrual events");
    println!("  - Rebalancing impacts");
    
    Ok(())
}

async fn simulate(
    amount: String,
    days: Option<u32>,
    detailed: bool,
    cli: &Cli,
) -> Result<()> {
    let amount_wei = parse_amount(&amount)?;
    let period_days = days.unwrap_or(30);
    
    println!("{}", format!("Simulating {} STRK deposit for {} days", format_amount(amount_wei.clone()), period_days).color(theme::PRIMARY));
    println!();
    
    let account = get_account(cli).await?;
    let vault = VaultContract::new(&account).await?;
    
    let exchange_rate = vault.calculate_exchange_rate().await?;
    let hstrk_amount = amount_wei.clone() * BigUint::from(1000000000000000000u64) / exchange_rate.clone();
    
    // Simulate yields (placeholder calculations)
    let annual_apy = 0.12; // 12% APY
    let daily_rate = annual_apy / 365.0;
    let period_return = (1.0 + daily_rate).powf(period_days as f64) - 1.0;
    
    let expected_yield = amount_wei.to_f64().unwrap_or(0.0) * period_return;
    let final_value = amount_wei.to_f64().unwrap_or(0.0) + expected_yield;
    
    println!("{}", "Simulation Results:".color(theme::ACCENT));
    println!("  Initial Deposit: {}", format_amount(amount_wei).color(theme::PRIMARY));
    println!("  hSTRK Received: {}", format_amount(hstrk_amount).color(theme::PRIMARY));
    println!("  Period: {} days", period_days.color(theme::SECONDARY));
    println!("  Estimated APY: {}%", (annual_apy * 100.0).color(theme::SUCCESS));
    println!("  Expected Yield: {}", format!("{:.6} STRK", expected_yield / 1e18).color(theme::SUCCESS));
    println!("  Final Value: {}", format!("{:.6} STRK", final_value / 1e18).color(theme::SUCCESS));
    
    if detailed {
        println!();
        println!("{}", "Yield Breakdown:".color(theme::ACCENT));
        println!("  Funding Rate Arbitrage: ~60%");
        println!("  Volatility Premium: ~25%");
        println!("  Liquidity Provision: ~15%");
        println!();
        println!("{}", "Risk Factors:".color(theme::WARNING));
        println!("  Smart Contract Risk: Low");
        println!("  Market Risk: Hedged (Delta-neutral)");
        println!("  Liquidity Risk: Low");
        println!("  Counterparty Risk: Medium");
    }
    
    Ok(())
}
