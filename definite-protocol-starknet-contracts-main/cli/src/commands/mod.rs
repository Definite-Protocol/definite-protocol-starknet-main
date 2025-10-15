use clap::Subcommand;
use anyhow::Result;

pub mod user_simple;
pub mod protocol;
pub mod contract;
pub mod analytics;
pub mod dev;
pub mod config;

use crate::Cli;

#[derive(Subcommand, Clone)]
pub enum UserCommands {
    /// Deposit STRK tokens to receive hSTRK
    Deposit {
        #[arg(help = "Amount of STRK to deposit")]
        amount: String,
        #[arg(long, help = "Recipient address (defaults to caller)")]
        recipient: Option<String>,
        #[arg(long, help = "Maximum slippage in basis points")]
        max_slippage: Option<u16>,
    },
    /// Withdraw STRK tokens by burning hSTRK
    Withdraw {
        #[arg(help = "Amount of hSTRK to burn")]
        shares: String,
        #[arg(long, help = "Minimum STRK amount to receive")]
        min_amount: Option<String>,
    },
    /// Check token balances and positions
    Balance {
        #[arg(help = "Address to check (defaults to configured address)")]
        address: Option<String>,
        #[arg(long, help = "Show detailed breakdown")]
        detailed: bool,
    },
    /// View transaction history
    History {
        #[arg(help = "Address to check (defaults to configured address)")]
        address: Option<String>,
        #[arg(long, short, help = "Number of transactions to show")]
        limit: Option<u32>,
        #[arg(long, help = "Filter by transaction type")]
        filter: Option<String>,
    },
    /// Calculate potential yields and returns
    Simulate {
        #[arg(help = "Amount to simulate")]
        amount: String,
        #[arg(long, help = "Time period in days")]
        days: Option<u32>,
        #[arg(long, help = "Show detailed breakdown")]
        detailed: bool,
    },
}

#[derive(Subcommand, Clone)]
pub enum ProtocolCommands {
    /// View protocol status and health metrics
    Status {
        #[arg(long, help = "Show detailed metrics")]
        detailed: bool,
        #[arg(long, help = "Refresh interval in seconds")]
        watch: Option<u64>,
    },
    /// Monitor risk metrics and circuit breakers
    Risk {
        #[arg(long, help = "Show historical risk data")]
        history: bool,
        #[arg(long, help = "Set risk alert thresholds")]
        alerts: bool,
    },
    /// View and manage rebalancing operations
    Rebalance {
        #[command(subcommand)]
        action: RebalanceCommands,
    },
    /// Emergency protocol controls
    Emergency {
        #[command(subcommand)]
        action: EmergencyCommands,
    },
    /// View protocol fees and revenue
    Fees {
        #[arg(long, help = "Time period in days")]
        period: Option<u32>,
        #[arg(long, help = "Show fee breakdown")]
        breakdown: bool,
    },
}

#[derive(Subcommand, Clone)]
pub enum RebalanceCommands {
    /// Check if rebalancing is needed
    Check,
    /// Execute manual rebalancing
    Execute {
        #[arg(long, help = "Force execution even if not needed")]
        force: bool,
        #[arg(long, help = "Dry run mode")]
        dry_run: bool,
    },
    /// View rebalancing history
    History {
        #[arg(long, short, help = "Number of entries to show")]
        limit: Option<u32>,
    },
    /// Configure rebalancing parameters
    Config {
        #[arg(long, help = "Check interval in seconds")]
        interval: Option<u64>,
        #[arg(long, help = "Execution threshold")]
        threshold: Option<String>,
    },
}

#[derive(Subcommand, Clone)]
pub enum EmergencyCommands {
    /// Pause protocol operations
    Pause {
        #[arg(help = "Component to pause (vault, rebalancing, all)")]
        component: String,
    },
    /// Resume protocol operations
    Resume {
        #[arg(help = "Component to resume (vault, rebalancing, all)")]
        component: String,
    },
    /// Emergency withdrawal for all users
    EmergencyWithdraw,
    /// Close all positions immediately
    ClosePositions {
        #[arg(long, help = "Position type (perpetuals, options, all)")]
        position_type: Option<String>,
    },
}

#[derive(Subcommand, Clone)]
pub enum ContractCommands {
    /// Deploy protocol contracts
    Deploy {
        #[arg(long, help = "Deployment configuration file")]
        config: Option<String>,
        #[arg(long, help = "Network to deploy to")]
        network: Option<String>,
        #[arg(long, help = "Dry run mode")]
        dry_run: bool,
    },
    /// Verify deployed contracts
    Verify {
        #[arg(help = "Contract address to verify")]
        address: String,
        #[arg(long, help = "Contract name")]
        name: Option<String>,
    },
    /// Call contract functions
    Call {
        #[arg(help = "Contract address")]
        address: String,
        #[arg(help = "Function name")]
        function: String,
        #[arg(help = "Function arguments")]
        args: Vec<String>,
    },
    /// Send transactions to contracts
    Send {
        #[arg(help = "Contract address")]
        address: String,
        #[arg(help = "Function name")]
        function: String,
        #[arg(help = "Function arguments")]
        args: Vec<String>,
        #[arg(long, help = "Gas limit")]
        gas_limit: Option<u64>,
    },
}

#[derive(Subcommand, Clone)]
pub enum AnalyticsCommands {
    /// Generate performance reports
    Performance {
        #[arg(long, help = "Time period in days")]
        period: Option<u32>,
        #[arg(long, help = "Export format (json, csv, pdf)")]
        format: Option<String>,
    },
    /// Analyze portfolio composition
    Portfolio {
        #[arg(long, help = "Show historical data")]
        history: bool,
        #[arg(long, help = "Include risk metrics")]
        risk: bool,
    },
    /// Track yield and returns
    Yield {
        #[arg(long, help = "Time period in days")]
        period: Option<u32>,
        #[arg(long, help = "Compare with benchmarks")]
        benchmark: bool,
    },
    /// Monitor protocol metrics
    Metrics {
        #[arg(long, help = "Metric type (tvl, volume, fees, apy)")]
        metric: Option<String>,
        #[arg(long, help = "Real-time monitoring")]
        live: bool,
    },
}

#[derive(Subcommand, Clone)]
pub enum DevCommands {
    /// Run comprehensive tests
    Test {
        #[arg(long, help = "Test type (unit, integration, all)")]
        test_type: Option<String>,
        #[arg(long, help = "Generate coverage report")]
        coverage: bool,
    },
    /// Build and compile contracts
    Build {
        #[arg(long, help = "Build mode (debug, release)")]
        mode: Option<String>,
        #[arg(long, help = "Target network")]
        target: Option<String>,
    },
    /// Generate documentation
    Docs {
        #[arg(long, help = "Output format (html, markdown)")]
        format: Option<String>,
        #[arg(long, help = "Include private functions")]
        private: bool,
    },
    /// Lint and format code
    Lint {
        #[arg(long, help = "Auto-fix issues")]
        fix: bool,
    },
}

#[derive(Subcommand, Clone)]
pub enum ConfigCommands {
    /// Initialize configuration
    Init {
        #[arg(long, help = "Configuration template")]
        template: Option<String>,
    },
    /// Show current configuration
    Show {
        #[arg(long, help = "Show sensitive values")]
        show_secrets: bool,
    },
    /// Set configuration values
    Set {
        #[arg(help = "Configuration key")]
        key: String,
        #[arg(help = "Configuration value")]
        value: String,
    },
    /// Get configuration values
    Get {
        #[arg(help = "Configuration key")]
        key: String,
    },
    /// Validate configuration
    Validate,
}

// Command handlers
pub async fn handle_user_command(command: UserCommands, cli: &Cli) -> Result<()> {
    user_simple::handle_user_command(command, cli).await
}

pub async fn handle_protocol_command(command: ProtocolCommands, cli: &Cli) -> Result<()> {
    protocol::handle_protocol_command(command, cli).await
}

pub async fn handle_contract_command(command: ContractCommands, cli: &Cli) -> Result<()> {
    contract::handle_contract_command(command, cli).await
}

pub async fn handle_analytics_command(command: AnalyticsCommands, cli: &Cli) -> Result<()> {
    analytics::handle_analytics_command(command, cli).await
}

pub async fn handle_dev_command(command: DevCommands, cli: &Cli) -> Result<()> {
    dev::handle_dev_command(command, cli).await
}

pub async fn handle_config_command(command: ConfigCommands, cli: &Cli) -> Result<()> {
    config::handle_config_command(command, cli).await
}
