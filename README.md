<div align="center">

# Definite Protocol

**Delta-Neutral Yield Protocol on Starknet**

[![Cairo](https://img.shields.io/badge/Cairo-2.11.4-orange)](https://www.cairo-lang.org/)
[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-purple)](https://www.starknet.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-green.svg)](tests/)

[Website](#) • [Documentation](#) • [Twitter](#) • [Discord](#)

</div>

---

## Overview

Definite Protocol is a sophisticated delta-neutral hedging system on Starknet that enables users to earn yield on STRK tokens while maintaining protection against price volatility. Users deposit STRK and receive hSTRK (hedged STRK) tokens, while the protocol automatically manages delta-neutral positions through perpetual futures and options strategies.

### Key Features

- **Delta-Neutral Exposure**: Earn yield without directional price risk
- **Automated Hedging**: Perpetual futures and options strategies managed automatically
- **Real-Time Risk Management**: Autonomous risk scoring with circuit breakers
- **Multi-Source Price Feeds**: Pragma Network integration with DEX fallbacks
- **Keeper-Based Rebalancing**: Automated delta-neutral maintenance
- **Enterprise-Grade Security**: Comprehensive access controls and emergency mechanisms

---

## Architecture

### Core Smart Contracts

The protocol consists of 7 production-ready smart contracts deployed on Starknet Sepolia:

#### 1. hSTRK Token Contract
**Address**: `0x03b041b0d7074032d3101b271b20fecdb2312d44e404adb0637d52979483a93e`
**Class Hash**: `0x019ef3a0c38abad5d55fad620cfab3d6fc9a752e0790722b19e6dc3560ec2507`

ERC20 token representing hedged STRK positions. Minted on deposit, burned on withdrawal.

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x03b041b0d7074032d3101b271b20fecdb2312d44e404adb0637d52979483a93e)

#### 2. Protocol Vault Contract
**Address**: `0x00826891ff0947da14fbd236dea07332bd56b9a98af378b00b5c6d5a3ad066e4`
**Class Hash**: `0x01227f6eb809782b3e3595526d263732c39c3a5b5dab0f7b2e0db2e621c7b2ab`

Main entry point for deposits and withdrawals. Manages STRK/hSTRK exchange rates and fee collection.

**Configuration**:
- Performance Fee: 20% (2000 bps)
- Management Fee: 1% (100 bps)
- Exit Fee: 0.1% (10 bps)
- Minimum Deposit: 10 STRK

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x00826891ff0947da14fbd236dea07332bd56b9a98af378b00b5c6d5a3ad066e4)

#### 3. Price Oracle Contract
**Address**: `0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757`
**Class Hash**: `0x0706e20e9215cee313447a34f5f3d008dcc51a759867a83c2e401395812d4072`

Multi-source price oracle with Pragma Network integration and DEX TWAP fallbacks.

**Features**:
- Primary: Pragma Network oracle
- Fallback: Ekubo, MySwap, JediSwap TWAP
- Staleness checks and deviation limits
- Confidence scoring

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757)

#### 4. Risk Manager Contract
**Address**: `0x04f433954e9713a6533a6c4df9d82b459cadc39db8bb18baa25c7f23b9a8ad01`
**Class Hash**: `0x05f7caa8303c41d50bb0e4d73714a89f06bad2e37a2ed9cf7e32ff5efdf23f8b`

Autonomous risk assessment and circuit breaker system.

**Risk Metrics**:
- Leverage ratio monitoring
- Liquidity ratio tracking
- Drawdown analysis
- Correlation risk assessment
- Volatility risk scoring

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x04f433954e9713a6533a6c4df9d82b459cadc39db8bb18baa25c7f23b9a8ad01)

#### 5. Perpetual Hedge Contract
**Address**: `0x024f767a6f9af8406beaac4d37c668b6ef200c40b17244fe868f0500a49f5463`
**Class Hash**: `0x079b7cc5bea1ccf5ca65366d84a62d71182f10c267ed8da8e45abbc46a74c25d`

Manages short perpetual positions for delta-neutral hedging.

**Features**:
- Multi-DEX support (Ekubo, MySwap, JediSwap)
- Automated funding rate collection
- Position health monitoring
- Liquidation protection

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x024f767a6f9af8406beaac4d37c668b6ef200c40b17244fe868f0500a49f5463)

#### 6. Options Strategy Contract
**Address**: `0x0621b06f163bfe023f3c87da714cb59da1988b7e76beb95d2f81c8d946dc59c3`
**Class Hash**: `0x02923be3dc76f64e78a8b72a1ecbda76958ee269c19c6049231869db7f3079be`

Systematic put selling strategy for volatility premium capture.

**Strategy**:
- Protective put selling
- Delta hedging
- Greeks portfolio management
- IV threshold-based execution

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x0621b06f163bfe023f3c87da714cb59da1988b7e76beb95d2f81c8d946dc59c3)

#### 7. Rebalancing Engine Contract
**Address**: `0x07ddb8a8b1d0fd77e02bb645d22674e66844a6143acff84d7ea7f5c193b22c40`
**Class Hash**: `0x0265d00727fd750c43c98ccbbc26cb10a3d2da1294e98f7bec4cb40b350830f1`

Keeper-based automated rebalancing system for maintaining delta-neutral exposure.

**Parameters**:
- Check interval: Configurable
- Execution threshold: Configurable (bps)
- Max slippage: Configurable (bps)

[View on Starkscan →](https://sepolia.starkscan.co/contract/0x07ddb8a8b1d0fd77e02bb645d22674e66844a6143acff84d7ea7f5c193b22c40)

---

## Network Information

**Network**: Starknet Sepolia Testnet
**Chain ID**: `SN_SEPOLIA`
**RPC Endpoint**: `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/c74NJJI9JjRLdNwXjvlm9lhVJAbyJYck`
**Deployer Address**: `0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5`

**External Contracts**:
- STRK Token: `0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D`

---

## Technology Stack

### Smart Contracts
- **Cairo**: 2.11.4
- **Scarb**: 2.12.2
- **Starknet**: 2.11.4
- **OpenZeppelin**: 2.0.0
- **Snforge**: 0.49.0

### Frontend Application
- **React**: 18.3.1
- **TypeScript**: 5.5.3
- **Vite**: 5.4.2
- **Starknet.js**: 7.6.4
- **StarknetKit**: 2.12.2
- **Starknet React**: 5.0.3
- **TailwindCSS**: 3.4.1
- **Recharts**: 3.2.0

### CLI Tool
- **Rust**: 1.70+
- **Starknet-rs**: Latest
- **Tokio**: Async runtime
- **Clap**: CLI framework

---

## Getting Started

### Prerequisites

```bash
# Install Scarb (Cairo package manager)
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Install Starkli (Starknet CLI)
curl https://get.starkli.sh | sh
starkliup

# Install Node.js (v18+)
# Install Rust (for CLI)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Smart Contract Development

```bash
# Clone repository
git clone <repository-url>
cd definite-protocol-starknet-main

# Build contracts
scarb build

# Run tests
scarb test

# Run specific test
snforge test test_deposit --exact
```

### Frontend Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run integration tests
npm run test:integration
```

### CLI Tool

```bash
# Build CLI
cd definite-protocol-starknet-contracts-main/cli
cargo build --release

# Install globally
cargo install --path .

# Initialize configuration
definite config init

# Check protocol status
definite protocol status --detailed

# Deposit STRK
definite user deposit 100.0

# Check balance
definite user balance --detailed
```

---

## Usage Examples

### Depositing STRK

```typescript
import { Contract, Account } from 'starknet';
import vaultAbi from './abis/protocol_vault.json';

const vaultAddress = '0x00826891ff0947da14fbd236dea07332bd56b9a98af378b00b5c6d5a3ad066e4';
const vault = new Contract(vaultAbi.abi, vaultAddress, account);

// Deposit 100 STRK
const amount = 100n * 10n**18n;
const result = await vault.deposit(amount);
```

### Withdrawing STRK

```typescript
// Withdraw 50 hSTRK shares
const shares = 50n * 10n**18n;
const result = await vault.withdraw(shares);
```

### Checking Position

```typescript
// Get user balance
const balance = await hstrkToken.balance_of(userAddress);

// Get exchange rate
const rate = await vault.calculate_exchange_rate();

// Calculate STRK value
const strkValue = (balance * rate) / 10n**18n;
```

---

## Project Structure

```
definite-protocol-starknet-main/
├── contracts/cairo/src/          # Smart contracts
│   ├── tokens/                   # hSTRK token
│   ├── vault/                    # Protocol vault
│   ├── oracle/                   # Price oracle
│   ├── risk/                     # Risk manager
│   ├── hedging/                  # Hedging strategies
│   └── rebalancing/              # Rebalancing engine
├── src/                          # Frontend application
│   ├── components/               # React components
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Service layer
│   ├── contracts/                # Contract ABIs & config
│   └── pages/                    # Application pages
├── tests/                        # Integration tests
├── scripts/                      # Deployment scripts
├── definite-protocol-starknet-contracts-main/
│   ├── cli/                      # Rust CLI tool
│   └── tests/                    # Cairo tests
└── DEPLOYMENT_ADDRESSES.json     # Contract addresses
```

---

## How It Works

### 1. User Deposits STRK

Users deposit STRK tokens into the Protocol Vault and receive hSTRK tokens in return at the current exchange rate.

```
User → [Deposit 100 STRK] → Protocol Vault → [Mint 100 hSTRK] → User
```

### 2. Protocol Hedges Exposure

The protocol automatically opens hedging positions to maintain delta-neutral exposure:

- **Perpetual Futures**: Short STRK perpetuals to hedge spot exposure
- **Options Strategy**: Sell protective puts to capture volatility premium
- **Rebalancing**: Automated keeper system maintains delta-neutral state

### 3. Yield Generation

The protocol generates yield through multiple sources:

- **Funding Rate Arbitrage**: Collect funding rates from perpetual positions
- **Volatility Premium**: Capture premium from systematic put selling
- **Basis Trading**: Exploit spot-futures basis differentials

### 4. Risk Management

Continuous risk monitoring and automated responses:

- **Risk Scoring**: Real-time calculation of protocol risk (0-100)
- **Circuit Breakers**: Automatic pause on high-risk conditions
- **Position Monitoring**: Health checks and liquidation protection
- **Emergency Controls**: Multi-level emergency response system

### 5. User Withdraws

Users can withdraw at any time by burning hSTRK tokens:

```
User → [Burn 50 hSTRK] → Protocol Vault → [Return 50.5 STRK] → User
                                          (includes accrued yield)
```

---

## Frontend Application

### Features

- **Wallet Integration**: ArgentX and Braavos wallet support via StarknetKit
- **Real-Time Dashboard**: Live protocol metrics and performance charts
- **Deposit/Withdraw Interface**: Intuitive UI for protocol interactions
- **Position Tracking**: Monitor your hSTRK holdings and yield
- **Analytics**: Comprehensive yield performance and TVL charts
- **Network Warnings**: Automatic network detection and warnings

### Supported Wallets

- **ArgentX**: Ready Wallet (formerly Argent)
- **Braavos**: Braavos Wallet

### Running the Frontend

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview

# Run tests
npm test
npm run test:ui
```

Access the application at `http://localhost:5173`

---

## CLI Tool

### Installation

```bash
cd definite-protocol-starknet-contracts-main/cli
cargo build --release
cargo install --path .
```

### Command Categories

#### User Operations
- `definite user deposit <amount>` - Deposit STRK tokens
- `definite user withdraw <shares>` - Withdraw STRK tokens
- `definite user balance [address]` - Check balances
- `definite user history [address]` - View transaction history
- `definite user simulate <amount>` - Simulate potential yields

#### Protocol Management
- `definite protocol status` - View protocol status
- `definite protocol risk` - Monitor risk metrics
- `definite protocol rebalance check` - Check rebalancing needs
- `definite protocol rebalance execute` - Execute rebalancing
- `definite protocol fees` - Analyze fee collection

#### Contract Interaction
- `definite contract deploy <contract>` - Deploy contracts
- `definite contract verify <address>` - Verify contract
- `definite contract call <address> <function>` - Call contract function
- `definite contract read <address> <function>` - Read contract state

#### Analytics
- `definite analytics performance` - Performance reports
- `definite analytics portfolio` - Portfolio analysis
- `definite analytics yield` - Yield tracking
- `definite analytics risk` - Risk analysis

#### Development Tools
- `definite dev test` - Run tests
- `definite dev build` - Build contracts
- `definite dev docs` - Generate documentation

#### Configuration
- `definite config init` - Initialize configuration
- `definite config show` - Show current configuration
- `definite config set <key> <value>` - Set configuration value

---

## Testing

### Smart Contract Tests

```bash
# Run all tests
scarb test

# Run specific test file
snforge test test_erc20

# Run with coverage
scarb test --coverage

# Run integration tests
snforge test --fork SEPOLIA_LATEST
```

### Frontend Tests

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with UI
npm run test:ui

# Run with coverage
npm test -- --coverage
```

### Integration Tests

The project includes comprehensive integration tests that verify:

- Contract deployment and accessibility
- Contract class hash verification
- Contract interaction and state changes
- Circular dependency resolution
- RPC connection and block retrieval

```bash
npm run test:integration
```

---

## Security

### Access Control

All contracts implement role-based access control:

- **Owner**: Full administrative access
- **Keeper**: Rebalancing execution rights
- **User**: Deposit and withdrawal rights

### Emergency Mechanisms

- **Pause Functionality**: Emergency pause for all user-facing functions
- **Circuit Breakers**: Automatic pause on risk threshold breach
- **Emergency Withdrawal**: Special withdrawal mode during emergencies
- **Position Closure**: Emergency position closure capability

### Audit Status

- **Status**: Not yet audited
- **Testnet Deployment**: Starknet Sepolia
- **Mainnet Deployment**: Pending audit completion

---

## Deployment

### Contract Deployment Order

Due to circular dependencies, contracts must be deployed in this specific order:

1. **PriceOracle** - Deploy first (no dependencies)
2. **hSTRKToken** - Deploy with temporary vault address
3. **ProtocolVault** - Deploy with hSTRK token address
4. **Update hSTRKToken** - Set correct vault address via `set_protocol_vault()`
5. **RiskManager** - Deploy with vault and oracle addresses
6. **PerpetualHedge** - Deploy with vault and oracle addresses
7. **OptionsStrategy** - Deploy with vault and oracle addresses
8. **RebalancingEngine** - Deploy with all contract addresses

### Deployment Script

```bash
# Using deployment script
./scripts/deploy_complete_protocol.py

# Or using sncast
./deploy_with_sncast.sh

# Or using starkli
./deploy_starkli.sh
```

### Verification

```bash
# Verify all contracts
definite contract verify-all

# Verify specific contract
definite contract verify <address>
```

---

## API Reference

### Protocol Vault

#### deposit(amount: u256) → u256
Deposit STRK tokens and receive hSTRK shares.

**Parameters**:
- `amount`: Amount of STRK to deposit (in wei)

**Returns**: Amount of hSTRK shares minted

**Requirements**:
- Amount must be >= minimum deposit (10 STRK)
- User must have approved vault to spend STRK
- Protocol must not be paused

#### withdraw(shares: u256) → u256
Burn hSTRK shares and receive STRK tokens.

**Parameters**:
- `shares`: Amount of hSTRK shares to burn

**Returns**: Amount of STRK tokens returned

**Requirements**:
- User must have sufficient hSTRK balance
- Protocol must not be paused

#### calculate_exchange_rate() → u256
Get current STRK per hSTRK exchange rate.

**Returns**: Exchange rate (18 decimals)

### hSTRK Token

Standard ERC20 interface with additional protocol-specific functions:

- `mint(to: ContractAddress, amount: u256)` - Mint tokens (vault only)
- `burn(from: ContractAddress, amount: u256)` - Burn tokens (vault only)
- `pause()` - Pause transfers (owner only)
- `unpause()` - Resume transfers (owner only)

### Price Oracle

#### get_price(asset: ContractAddress) → PriceData
Get current price for an asset.

**Returns**: PriceData struct with price, timestamp, and confidence

#### update_price_from_pragma(asset: ContractAddress)
Update price from Pragma Network oracle.

#### update_price_from_dex_twap(asset: ContractAddress)
Update price from DEX TWAP (fallback).

---

## Performance Metrics

### Expected Yields

- **Base APY**: 5-15% (from funding rates)
- **Volatility Premium**: 3-8% (from options strategy)
- **Total Expected APY**: 8-23%

*Note: Yields are variable and depend on market conditions*

### Risk Metrics

- **Target Delta**: 0 (delta-neutral)
- **Maximum Leverage**: 3x
- **Liquidation Threshold**: 120%
- **Rebalancing Threshold**: 10% delta deviation

---

## Roadmap

### Phase 1: Testnet Launch (Current)
- ✅ Core contracts deployed
- ✅ Frontend application live
- ✅ CLI tool available
- ✅ Integration tests passing

### Phase 2: Security & Optimization
- ⏳ Smart contract audit
- ⏳ Gas optimization
- ⏳ Enhanced monitoring
- ⏳ Keeper network integration

### Phase 3: Mainnet Preparation
- ⏳ Mainnet deployment
- ⏳ Liquidity bootstrapping
- ⏳ Marketing campaign
- ⏳ Community building

### Phase 4: Advanced Features
- ⏳ Additional hedging strategies
- ⏳ Multi-asset support
- ⏳ Governance token
- ⏳ DAO formation

---

## Contributing

We welcome contributions from the community!

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/definite-protocol-starknet.git
cd definite-protocol-starknet

# Install dependencies
npm install
cd definite-protocol-starknet-contracts-main/cli && cargo build

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test
scarb test
npm test

# Submit a pull request
```

### Contribution Guidelines

- Follow Cairo and TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Follow the existing code style
- Keep commits atomic and well-described

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact & Community

- **Website**: [Coming Soon]
- **Twitter**: [Coming Soon]
- **Discord**: [Coming Soon]
- **Documentation**: [Coming Soon]
- **GitHub**: [Repository URL]

---

## Acknowledgments

- **Starknet Foundation** - For the amazing L2 infrastructure
- **OpenZeppelin** - For secure contract libraries
- **Pragma Network** - For oracle infrastructure
- **Cairo Community** - For development support

---

## Disclaimer

This software is provided "as is", without warranty of any kind. Use at your own risk. The protocol is currently deployed on testnet and has not been audited. Do not use with real funds until a full security audit has been completed.

---

<div align="center">

**Built with ❤️ on Starknet**

</div>