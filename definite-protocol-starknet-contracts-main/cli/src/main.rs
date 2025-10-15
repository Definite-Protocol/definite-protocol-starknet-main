use clap::{Parser, Subcommand};
use owo_colors::OwoColorize;
use std::process;

mod commands;
mod config;
mod contracts;
mod theme;
mod utils;

use commands::{
    UserCommands, ProtocolCommands, ContractCommands,
    AnalyticsCommands, DevCommands, ConfigCommands,
    handle_user_command, handle_protocol_command, handle_contract_command,
    handle_analytics_command, handle_dev_command, handle_config_command
};
use theme::Theme;

#[derive(Parser)]
#[command(
    name = "definite",
    about = "Advanced CLI for Definite Protocol - Delta-neutral hedging on Starknet",
    version = "1.0.0",
    author = "Definite Protocol Team"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    #[arg(short, long, global = true)]
    verbose: bool,
    
    #[arg(short, long, global = true, value_name = "FILE")]
    config: Option<String>,
    
    #[arg(long, global = true)]
    network: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// User operations (deposit, withdraw, balance)
    User {
        #[command(subcommand)]
        action: UserCommands,
    },
    /// Protocol management and monitoring
    Protocol {
        #[command(subcommand)]
        action: ProtocolCommands,
    },
    /// Contract deployment and interaction
    Contract {
        #[command(subcommand)]
        action: ContractCommands,
    },
    /// Analytics and reporting
    Analytics {
        #[command(subcommand)]
        action: AnalyticsCommands,
    },
    /// Development tools
    Dev {
        #[command(subcommand)]
        action: DevCommands,
    },
    /// Configuration management
    Config {
        #[command(subcommand)]
        action: ConfigCommands,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    
    // Initialize theme and logging
    Theme::init();
    if cli.verbose {
        tracing_subscriber::fmt::init();
    }
    
    // Print banner
    print_banner();
    
    // Execute command
    let result = match cli.command {
        Commands::User { ref action } => handle_user_command(action.clone(), &cli).await,
        Commands::Protocol { ref action } => handle_protocol_command(action.clone(), &cli).await,
        Commands::Contract { ref action } => handle_contract_command(action.clone(), &cli).await,
        Commands::Analytics { ref action } => handle_analytics_command(action.clone(), &cli).await,
        Commands::Dev { ref action } => handle_dev_command(action.clone(), &cli).await,
        Commands::Config { ref action } => handle_config_command(action.clone(), &cli).await,
    };
    
    match result {
        Ok(_) => {
            println!("{}", "Operation completed successfully".color(theme::SUCCESS));
        }
        Err(e) => {
            eprintln!("{} {}", "Error:".color(theme::ERROR), e);
            process::exit(1);
        }
    }
}

fn print_banner() {
    let banner = r#"
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║    ██████╗ ███████╗███████╗██╗███╗   ██╗██╗████████╗███████╗ ║
    ║    ██╔══██╗██╔════╝██╔════╝██║████╗  ██║██║╚══██╔══╝██╔════╝ ║
    ║    ██║  ██║█████╗  █████╗  ██║██╔██╗ ██║██║   ██║   █████╗   ║
    ║    ██║  ██║██╔══╝  ██╔══╝  ██║██║╚██╗██║██║   ██║   ██╔══╝   ║
    ║    ██████╔╝███████╗██║     ██║██║ ╚████║██║   ██║   ███████╗ ║
    ║    ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚══════╝ ║
    ║                                                              ║
    ║           Delta-Neutral Hedging Protocol on Starknet        ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    "#;
    
    println!("{}", banner.color(theme::PRIMARY));
    println!("{}", "Advanced CLI for sophisticated DeFi operations".color(theme::SECONDARY));
    println!();
}
