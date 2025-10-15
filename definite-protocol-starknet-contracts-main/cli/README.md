# Definite Protocol CLI

Advanced command-line interface for interacting with the Definite Protocol - a sophisticated delta-neutral hedging system on Starknet.

## Features

- **User Operations**: Deposit, withdraw, check balances, simulate yields
- **Protocol Management**: Monitor status, risk metrics, rebalancing operations
- **Contract Interaction**: Deploy, verify, and interact with smart contracts
- **Analytics**: Performance reports, portfolio analysis, yield tracking
- **Development Tools**: Testing, building, documentation generation
- **Configuration Management**: Network settings, contract addresses, preferences

## Installation

### Prerequisites

- Rust 1.70+ 
- Cargo package manager

### Build from Source

```bash
git clone <repository-url>
cd cli
cargo build --release
```

The binary will be available at `target/release/definite`.

### Install Globally

```bash
cargo install --path .
```

## Quick Start

### 1. Initialize Configuration

```bash
definite config init
```

Choose a template (mainnet, testnet, devnet) and provide your account details.

### 2. Check Protocol Status

```bash
definite protocol status --detailed
```

### 3. Check Your Balance

```bash
definite user balance --detailed
```

### 4. Deposit STRK Tokens

```bash
definite user deposit 100.0
```

### 5. Simulate Potential Yields

```bash
definite user simulate 1000.0 --days 30 --detailed
```

## Command Reference

### User Commands

#### Deposit STRK Tokens
```bash
definite user deposit <amount> [--recipient <address>] [--max-slippage <bps>]
```

#### Withdraw STRK Tokens
```bash
definite user withdraw <shares> [--min-amount <amount>]
```

#### Check Balances
```bash
definite user balance [address] [--detailed]
```

#### View Transaction History
```bash
definite user history [address] [--limit <count>] [--filter <type>]
```

#### Simulate Yields
```bash
definite user simulate <amount> [--days <period>] [--detailed]
```

### Protocol Commands

#### View Protocol Status
```bash
definite protocol status [--detailed] [--watch <seconds>]
```

#### Monitor Risk Metrics
```bash
definite protocol risk [--history] [--alerts]
```

#### Rebalancing Operations
```bash
# Check if rebalancing is needed
definite protocol rebalance check

# Execute rebalancing
definite protocol rebalance execute [--force] [--dry-run]

# View rebalancing history
definite protocol rebalance history [--limit <count>]

# Configure rebalancing parameters
definite protocol rebalance config [--interval <seconds>] [--threshold <value>]
```

#### Emergency Controls
```bash
# Pause protocol components
definite protocol emergency pause <component>

# Resume operations
definite protocol emergency resume <component>

# Emergency withdrawal mode
definite protocol emergency emergency-withdraw

# Close positions
definite protocol emergency close-positions [--position-type <type>]
```

#### Fee Analysis
```bash
definite protocol fees [--period <days>] [--breakdown]
```

### Contract Commands

#### Deploy Contracts
```bash
definite contract deploy [--config <file>] [--network <name>] [--dry-run]
```

#### Verify Contracts
```bash
definite contract verify <address> [--name <contract-name>]
```

#### Call Contract Functions
```bash
definite contract call <address> <function> [args...]
```

#### Send Transactions
```bash
definite contract send <address> <function> [args...] [--gas-limit <limit>]
```

### Analytics Commands

#### Performance Reports
```bash
definite analytics performance [--period <days>] [--format <json|csv|pdf>]
```

#### Portfolio Analysis
```bash
definite analytics portfolio [--history] [--risk]
```

#### Yield Tracking
```bash
definite analytics yield [--period <days>] [--benchmark]
```

#### Protocol Metrics
```bash
definite analytics metrics [--metric <type>] [--live]
```

### Development Commands

#### Run Tests
```bash
definite dev test [--test-type <unit|integration|all>] [--coverage]
```

#### Build Contracts
```bash
definite dev build [--mode <debug|release>] [--target <network>]
```

#### Generate Documentation
```bash
definite dev docs [--format <html|markdown>] [--private]
```

#### Lint Code
```bash
definite dev lint [--fix]
```

### Configuration Commands

#### Initialize Configuration
```bash
definite config init [--template <type>]
```

#### Show Configuration
```bash
definite config show [--show-secrets]
```

#### Set Configuration Values
```bash
definite config set <key> <value>
```

#### Get Configuration Values
```bash
definite config get <key>
```

#### Validate Configuration
```bash
definite config validate
```

## Configuration

The CLI uses a TOML configuration file located at `~/.definite/config.toml` by default.

### Example Configuration

```toml
rpc_url = "https://starknet-mainnet.public.blastapi.io"
account_address = "0x..."
private_key = "0x..."
chain_id = "SN_MAIN"
network = "mainnet"

[contracts]
vault = "0x..."
hstrk_token = "0x..."
strk_token = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
price_oracle = "0x..."
risk_manager = "0x..."
perpetual_hedge = "0x..."
options_strategy = "0x..."
rebalancing_engine = "0x..."

[transaction]
gas_limit = 1000000
max_fee_per_gas = "1000000000"
timeout = 300
confirmations = 1

[display]
decimal_places = 6
use_colors = true
verbose = false
date_format = "%Y-%m-%d %H:%M:%S UTC"
```

## Network Support

- **Mainnet**: Production Starknet network
- **Testnet**: Starknet Goerli testnet
- **Devnet**: Local development network
- **Custom**: User-defined network configuration

## Security

- Private keys are stored locally in the configuration file
- Consider using environment variables for sensitive data
- Always verify contract addresses before interacting
- Use testnet for development and testing

## Troubleshooting

### Common Issues

1. **Configuration not found**: Run `definite config init` to create initial configuration
2. **Invalid address format**: Ensure addresses start with `0x` and are valid hex
3. **Network connectivity**: Check RPC URL and network status
4. **Insufficient balance**: Verify STRK balance before deposits
5. **Transaction failures**: Check gas limits and network congestion

### Debug Mode

Enable verbose logging with the `--verbose` flag:

```bash
definite --verbose user balance
```

### Getting Help

```bash
# General help
definite --help

# Command-specific help
definite user --help
definite protocol status --help
```

## Development

### Building

```bash
cargo build
```

### Testing

```bash
cargo test
```

### Linting

```bash
cargo clippy
```

### Formatting

```bash
cargo fmt
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- GitHub Issues: [Repository Issues](https://github.com/definite-protocol/cli/issues)
- Documentation: [Protocol Docs](https://docs.definite-protocol.com)
- Discord: [Community Discord](https://discord.gg/definite-protocol)
