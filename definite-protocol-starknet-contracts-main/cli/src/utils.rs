use anyhow::{Result, Context};
use starknet::core::types::FieldElement;
use starknet::accounts::{Account, SingleOwnerAccount};
use starknet::providers::jsonrpc::{HttpTransport, JsonRpcClient};
use starknet::signers::{LocalWallet, SigningKey};
use num_bigint::BigUint;
use num_traits::ToPrimitive;
use std::str::FromStr;

use crate::{Cli, config::Config};

/// Parse amount string to BigUint (assumes 18 decimals)
pub fn parse_amount(amount_str: &str) -> Result<BigUint> {
    let amount_f64 = amount_str.parse::<f64>()
        .context("Invalid amount format")?;
    
    if amount_f64 < 0.0 {
        return Err(anyhow::anyhow!("Amount cannot be negative"));
    }
    
    // Convert to wei (18 decimals)
    let amount_wei = (amount_f64 * 1e18) as u128;
    Ok(BigUint::from(amount_wei))
}

/// Format BigUint amount to human readable string
pub fn format_amount(amount: BigUint) -> String {
    let amount_f64 = amount.to_f64().unwrap_or(0.0) / 1e18;
    
    if amount_f64 >= 1_000_000.0 {
        format!("{:.2}M", amount_f64 / 1_000_000.0)
    } else if amount_f64 >= 1_000.0 {
        format!("{:.2}K", amount_f64 / 1_000.0)
    } else if amount_f64 >= 1.0 {
        format!("{:.6}", amount_f64)
    } else {
        format!("{:.8}", amount_f64)
    }
}

/// Format percentage with appropriate precision
pub fn format_percentage(value: f64) -> String {
    if value >= 100.0 {
        format!("{:.1}%", value)
    } else if value >= 10.0 {
        format!("{:.2}%", value)
    } else {
        format!("{:.3}%", value)
    }
}

/// Format duration in human readable format
pub fn format_duration(seconds: u64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    
    if days > 0 {
        format!("{}d {}h", days, hours)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}

/// Get configured Starknet account
pub async fn get_account(cli: &Cli) -> Result<SingleOwnerAccount<JsonRpcClient<HttpTransport>, LocalWallet>> {
    use starknet::providers::Provider;

    let config = Config::load(cli.config.as_deref())?;

    // Create provider
    let rpc_url = url::Url::parse(&config.rpc_url)
        .context("Invalid RPC URL")?;
    let provider = JsonRpcClient::new(HttpTransport::new(rpc_url));

    // Create signer from private key
    let signing_key = SigningKey::from_secret_scalar(
        FieldElement::from_hex_be(&config.private_key)?
    );
    let signer = LocalWallet::from(signing_key);

    // Fetch chain ID from provider (enterprise-grade approach)
    let chain_id = provider.chain_id().await
        .context("Failed to fetch chain ID from provider. Please verify RPC URL is accessible.")?;

    // Create account
    let account = SingleOwnerAccount::new(
        provider,
        signer,
        FieldElement::from_hex_be(&config.account_address)?,
        chain_id,
        starknet::accounts::ExecutionEncoding::New,
    );

    Ok(account)
}

/// Validate Starknet address format
pub fn validate_address(address: &str) -> Result<FieldElement> {
    if address.starts_with("0x") {
        FieldElement::from_hex_be(address)
            .context("Invalid address format")
    } else {
        FieldElement::from_hex_be(&format!("0x{}", address))
            .context("Invalid address format")
    }
}

/// Convert hex string to FieldElement
pub fn hex_to_felt(hex: &str) -> Result<FieldElement> {
    let clean_hex = if hex.starts_with("0x") {
        &hex[2..]
    } else {
        hex
    };
    
    FieldElement::from_hex_be(&format!("0x{}", clean_hex))
        .context("Invalid hex string")
}

/// Convert FieldElement to hex string
pub fn felt_to_hex(felt: FieldElement) -> String {
    format!("0x{:064x}", felt)
}

/// Calculate APY from daily rate
pub fn calculate_apy(daily_rate: f64) -> f64 {
    (1.0 + daily_rate).powf(365.0) - 1.0
}

/// Calculate daily rate from APY
pub fn calculate_daily_rate(apy: f64) -> f64 {
    (1.0 + apy).powf(1.0 / 365.0) - 1.0
}

/// Format timestamp to human readable date
pub fn format_timestamp(timestamp: u64) -> String {
    use chrono::{DateTime, Utc, TimeZone};
    
    let dt = Utc.timestamp_opt(timestamp as i64, 0)
        .single()
        .unwrap_or_else(|| Utc::now());
    
    dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
}

/// Calculate time until timestamp
pub fn time_until(timestamp: u64) -> String {
    use chrono::{DateTime, Utc, TimeZone};
    
    let now = Utc::now().timestamp() as u64;
    if timestamp <= now {
        return "Expired".to_string();
    }
    
    let diff = timestamp - now;
    format_duration(diff)
}

/// Validate and parse slippage basis points
pub fn parse_slippage_bps(slippage_str: &str) -> Result<u16> {
    let slippage = slippage_str.parse::<f64>()
        .context("Invalid slippage format")?;
    
    if slippage < 0.0 || slippage > 100.0 {
        return Err(anyhow::anyhow!("Slippage must be between 0% and 100%"));
    }
    
    Ok((slippage * 100.0) as u16)
}

/// Format slippage basis points to percentage
pub fn format_slippage_bps(bps: u16) -> String {
    format!("{:.2}%", bps as f64 / 100.0)
}

/// Calculate price impact
pub fn calculate_price_impact(
    amount_in: BigUint,
    amount_out: BigUint,
    expected_out: BigUint,
) -> f64 {
    if expected_out == BigUint::from(0u32) {
        return 0.0;
    }
    
    let actual = amount_out.to_f64().unwrap_or(0.0);
    let expected = expected_out.to_f64().unwrap_or(0.0);
    
    if expected == 0.0 {
        return 0.0;
    }
    
    ((expected - actual) / expected) * 100.0
}

/// Truncate string to specified length with ellipsis
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

/// Format large numbers with appropriate units
pub fn format_large_number(value: f64) -> String {
    if value >= 1_000_000_000.0 {
        format!("{:.2}B", value / 1_000_000_000.0)
    } else if value >= 1_000_000.0 {
        format!("{:.2}M", value / 1_000_000.0)
    } else if value >= 1_000.0 {
        format!("{:.2}K", value / 1_000.0)
    } else {
        format!("{:.2}", value)
    }
}

/// Check if string is valid JSON
pub fn is_valid_json(s: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(s).is_ok()
}

/// Pretty print JSON string
pub fn pretty_print_json(json_str: &str) -> Result<String> {
    let value: serde_json::Value = serde_json::from_str(json_str)
        .context("Invalid JSON")?;
    
    serde_json::to_string_pretty(&value)
        .context("Failed to format JSON")
}
