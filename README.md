<img width="1920" height="1080" alt="1" src="https://github.com/user-attachments/assets/fe764921-f2f9-4af6-8b75-fb46ec4fa029" />

<div align="center">
  
# Definite Protocol
**Delta-Neutral Yield Protocol on Starknet**

[![Cairo](https://img.shields.io/badge/Cairo-2.11.4-orange)](https://www.cairo-lang.org/)
[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-purple)](https://www.starknet.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-green.svg)](tests/)

<img width="200" height="200" alt="seffaf-logo-definite" src="https://github.com/user-attachments/assets/7a75f3e5-827f-4677-8c99-5716d6363d34" />


[Website](#) • [Documentation](#) • [Twitter](#) • [Discord](#)

</div>

---

## Overview

<img width="1920" height="1080" alt="2" src="https://github.com/user-attachments/assets/baa5a9dd-0a84-4a22-9fdf-745f30a7df2c" />

---
Definite Protocol is a sophisticated delta-neutral hedging system on Starknet that enables users to earn yield on STRK tokens while maintaining protection against price volatility. Users deposit STRK and receive hSTRK (hedged STRK) tokens, while the protocol automatically manages delta-neutral positions through perpetual futures and options strategies.
---

### Key Features

<img width="1920" height="1080" alt="4" src="https://github.com/user-attachments/assets/b5a0388e-9a49-4bfd-9425-76765f7617cf" />


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

<img width="1920" height="1080" alt="5" src="https://github.com/user-attachments/assets/498c478f-e651-4daa-9520-8415f2a57d23" />


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

<img width="1920" height="1080" alt="10" src="https://github.com/user-attachments/assets/f2bd1143-6169-492b-8d9f-fb7dfba1911c" />

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
- **GitHub**: [Repository URL](https://github.com/Definite-Protocol/definite-protocol-starknet-main)

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

#### Oracle Services
- **Pragma Network**: Decentralized oracle
  - Contract: `0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757`
  - Real-time price feeds
  - Multi-source aggregation
  - HTTP API: `https://api.devnet.pragma.build/node/v1`

- **CoinGecko API**: Backup price source
  - Endpoint: `https://api.coingecko.com/api/v3`
  - Cryptocurrency market data

- **Binance API**: Backup price source
  - Endpoint: `https://api.binance.com/api/v3`
  - Exchange price data

#### Database & Backend
- **Supabase 2.57.4**: Backend-as-a-Service
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication
  - Row-level security
  - RESTful API
  - Migrations support

#### Payment Gateway
- **Chipi Pay**: Fiat on/off ramp
  - Testnet API: `https://api-testnet.chipi.pay/v1`
  - Production API: `https://api.chipi.pay/v1`
  - USDC payments on Starknet
  - Gift card to crypto conversion
  - Mexican Peso (MXN) support

#### Block Explorers
- **Starkscan**: Starknet block explorer
  - Sepolia: `https://sepolia.starkscan.co`
  - Mainnet: `https://starkscan.co`
  - Contract verification
  - Transaction tracking

- **Voyager**: Alternative Starknet explorer
  - Integrated via @starknet-react/core

### DEX Integrations (Protocol Level)

#### Perpetual Futures
- **zkLend**: Lending and perpetuals protocol
- **MySwap**: DEX with perpetual trading

#### Options Trading
- **Carmine Options AMM**: Options protocol
  - Put and call options
  - Automated market making
  - Greeks calculation

#### Spot Trading & Price Feeds
- **Ekubo Protocol**: DEX for TWAP price feeds
- **MySwap**: DEX for TWAP price feeds
- **JediSwap**: DEX for TWAP price feeds

### Development Tools

#### Version Control
- **Git**: Source control
- **GitHub**: Repository hosting

#### Package Managers
- **npm**: Node.js package manager
- **Cargo**: Rust package manager
- **Scarb**: Cairo package manager

#### Deployment Tools
- **Starkli 0.8.1**: Starknet CLI tool
  - Contract declaration
  - Contract deployment
  - Account management

- **sncast**: Starknet Foundry deployment tool
  - Automated deployments
  - Script execution

#### Python Tools (Deployment Scripts)
- **Python 3.x**: Scripting language
- **starknet.py**: Python Starknet library

### Monitoring & Analytics (Planned)

#### Error Tracking
- **Sentry**: Error monitoring (configured, not yet active)
  - Real-time error tracking
  - Performance monitoring

#### Metrics
- **Custom metrics endpoint**: Protocol metrics collection

### Security & Compliance

#### Encryption
- **AES-256-GCM**: Encryption algorithm
  - 32-byte key length
  - Authenticated encryption

#### Rate Limiting
- **Custom implementation**:
  - 15-minute windows
  - 100 requests per window (testnet)
  - 50 requests per window (mainnet)

#### CORS
- **Configured origins**:
  - Development: localhost:3000, localhost:5173, localhost:5174
  - Production: definite-protocol.com domains

### Network Infrastructure

#### Testnet Configuration
- **Network**: Starknet Sepolia
- **RPC**: Alchemy (primary), Blast API (fallback)
- **Deployer**: `0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5`

#### Mainnet Configuration (Planned)
- **Network**: Starknet Mainnet
- **Chain ID**: SN_MAIN
- **RPC**: Blast API mainnet endpoint

### Summary Statistics

- **Total Technologies**: 100+ libraries, frameworks, and services
- **Programming Languages**: 4 (Cairo, TypeScript, Rust, Python)
- **Blockchain Networks**: 2 (Starknet Sepolia, Starknet Mainnet planned)
- **External APIs**: 6 (Pragma, CoinGecko, Binance, Chipi Pay, Alchemy, Blast)
- **Smart Contracts Deployed**: 7 production contracts
- **Frontend Dependencies**: 40+ packages
- **CLI Dependencies**: 30+ Rust crates
- **Testing Frameworks**: 3 (Snforge, Vitest, Testing Library)

---

## Inspiration


<img width="1920" height="1080" alt="3" src="https://github.com/user-attachments/assets/c7788710-b655-46b9-b125-f2fa1b8ce1a8" />


The inspiration for Definite Protocol came from observing a critical gap in the DeFi ecosystem: users who want to earn yield on their crypto assets are forced to accept directional price risk. Traditional staking and yield farming strategies expose users to the full volatility of the underlying asset, which can wipe out gains during market downturns.

We were particularly inspired by:

1. **Traditional Finance Delta-Neutral Strategies**: Hedge funds have used delta-neutral strategies for decades to generate consistent returns regardless of market direction. We wanted to bring this sophisticated approach to DeFi.

2. **The Need for Stable Yields**: During the 2022 crypto bear market, we witnessed countless users lose their staking rewards and more due to asset price depreciation. A delta-neutral approach would have protected them.

3. **Starknet's Technical Capabilities**: The launch of Cairo 2.0 and Starknet's improved performance made it possible to implement complex financial strategies on-chain with reasonable gas costs.

4. **The STRK Token Opportunity**: With STRK being a relatively new token with active perpetual markets and options trading, we saw the perfect opportunity to build a delta-neutral protocol specifically for the Starknet ecosystem.

5. **Reflect Protocol**: This project, which does what we do on Solana in a slightly different way but using the same methods, is one of our sources of inspiration.

The vision was clear: create a protocol where users can deposit STRK tokens and earn yield through funding rate arbitrage and volatility premium capture, while the protocol automatically maintains a delta-neutral position to eliminate price risk.

---

## What It Does

<img width="1920" height="1080" alt="9" src="https://github.com/user-attachments/assets/510fa363-0cac-487c-9ee3-3683ac057dc8" />


Definite Protocol is a fully automated delta-neutral yield generation system for STRK tokens. Here's exactly what it does:

### For Users

**Deposit & Earn**:
- Users deposit STRK tokens into the Protocol Vault
- Receive hSTRK (hedged STRK) tokens representing their position
- Earn yield from multiple sources without exposure to STRK price movements
- Withdraw anytime by burning hSTRK tokens to receive STRK plus accrued yield

**Yield Sources**:
1. **Funding Rate Arbitrage** (5-15% APY): The protocol collects funding rates from short perpetual positions every 8 hours
2. **Volatility Premium Capture** (3-8% APY): Systematic put selling captures option premiums when implied volatility is high
3. **Basis Trading**: Exploits price differences between spot and futures markets

**Expected Total APY**: 8-23% (variable based on market conditions)

### Under the Hood

**Automated Hedging System**:
- When users deposit 100 STRK, the protocol immediately opens short perpetual positions to hedge the exposure
- Options strategies are deployed when implied volatility exceeds thresholds (>60% IV)
- Delta exposure is continuously monitored and rebalanced every 5 minutes
- Target delta: 0 (completely neutral to STRK price movements)

**Risk Management**:
- Real-time risk scoring (0-100 scale) based on leverage, liquidity, drawdown, correlation, and volatility
- Automated circuit breakers pause operations when risk exceeds safe thresholds
- Position health monitoring prevents liquidations
- Emergency mechanisms allow for safe protocol shutdown if needed

**Multi-Source Price Feeds**:
- Primary: Pragma Network oracle for institutional-grade price data
- Fallback: DEX TWAP from Ekubo, MySwap, and JediSwap
- Price validation and staleness checks prevent manipulation
- Confidence scoring ensures data reliability

**Keeper-Based Rebalancing**:
- Automated keepers check delta exposure every 5 minutes
- Rebalancing executes when delta deviation exceeds 10% threshold
- Batch operations optimize gas costs
- Slippage protection on all trades

### Technical Implementation

**7 Production Smart Contracts**:
1. **hSTRK Token**: ERC20 yield-bearing token with pause mechanism
2. **Protocol Vault**: Main contract handling deposits, withdrawals, and fee management
3. **Price Oracle**: Multi-source price feeds with validation
4. **Risk Manager**: Autonomous risk scoring and circuit breakers
5. **Perpetual Hedge**: Short perpetual position management
6. **Options Strategy**: Systematic put selling for premium capture
7. **Rebalancing Engine**: Automated delta-neutral maintenance

**Frontend Application**:
- React-based web interface with StarknetKit wallet integration
- Real-time dashboard showing protocol metrics, TVL, and yields
- Intuitive deposit/withdraw interface
- Position tracking and analytics
- Yield performance charts

**CLI Tool**:
- Rust-based command-line interface for power users
- Complete protocol management capabilities
- Analytics and reporting tools
- Development and testing utilities

---

## How We Built It

<img width="1920" height="1080" alt="Partnership and KPI" src="https://github.com/user-attachments/assets/117ea2fb-9880-452e-a83d-ed60137abd0e" />


### Phase 1: Architecture & Planning (Week 1)

**Migration from Algorand**:
- The protocol was originally conceived for Algorand but we decided to migrate to Starknet for better DeFi infrastructure
- Analyzed existing Algorand contracts (hALGO protocol, price oracles, risk managers)
- Removed all Algorand-specific code (PyTeal implementations)
- Designed new architecture optimized for Starknet's account abstraction and Cairo

**Technical Stack Selection**:
- **Cairo 2.11.4**: Latest stable version with improved developer experience
- **OpenZeppelin 2.0.0**: For battle-tested ERC20 and access control patterns
- **Scarb 2.12.2**: Modern Cairo package manager
- **Snforge 0.49.0**: Testing framework with fork support

### Phase 2: Smart Contract Development (Weeks 2-4)

**Contract Implementation**:
1. Started with hSTRK Token - simplified ERC20 with protocol-specific features
2. Built Price Oracle with Pragma Network integration and DEX fallbacks
3. Implemented Protocol Vault with deposit/withdraw logic and fee management
4. Created Perpetual Hedge contract for short position management
5. Developed Options Strategy for systematic put selling
6. Built Risk Manager with autonomous scoring and circuit breakers
7. Implemented Rebalancing Engine with keeper-based automation

**Technical Challenges Solved**:

**Challenge 1: Cairo 2.11.4 Compatibility**
- **Problem**: OpenZeppelin components had breaking changes in 2.0.0
- **Solution**: Implemented manual owner management pattern instead of using components
- **Result**: Full compatibility with latest Cairo version

**Challenge 2: Signed Integer Support**
- **Problem**: Cairo lacks native i256 type needed for delta calculations
- **Solution**: Created custom implementation using u256 + boolean sign pattern
- **Result**: Maintains precision while working within Cairo's type system

**Challenge 3: Circular Dependencies**
- **Problem**: hSTRK Token needs Vault address, Vault needs Token address
- **Solution**: Deploy hSTRK with temporary address, then update via `set_protocol_vault()`
- **Result**: Clean deployment process documented in deployment scripts

**Challenge 4: Storage API Migration**
- **Problem**: LegacyMap deprecated in favor of new Map type
- **Solution**: Updated all storage declarations to use Map with proper trait imports
- **Result**: Future-proof storage implementation

**Challenge 5: Real ERC20 Transfers**
- **Problem**: Need actual token transfers, not mocks
- **Solution**: Implemented full ERC20 dispatcher pattern with approval flows
- **Result**: Production-ready token interactions

### Phase 3: Frontend Development (Week 5)

**Technology Choices**:
- **React 18.3.1**: Latest stable version with concurrent features
- **TypeScript 5.5.3**: Type safety for complex contract interactions
- **StarknetKit 2.12.2**: Official wallet connection library
- **Starknet React 5.0.3**: React hooks for Starknet
- **TailwindCSS 3.4.1**: Utility-first styling
- **Recharts 3.2.0**: Data visualization

**Features Implemented**:
- Wallet integration (ArgentX, Braavos)
- Real-time protocol dashboard
- Deposit/withdraw interface
- Position tracking
- Yield performance charts
- TVL analytics
- Network warnings

### Phase 4: CLI Tool Development (Week 6)

**Rust Implementation**:
- Built comprehensive CLI with Clap framework
- Implemented async operations with Tokio
- Created pastel theme with owo-colors
- Integrated starknet-rs for contract interactions
- Added configuration management with TOML

**Command Categories**:
- User operations (deposit, withdraw, balance)
- Protocol management (status, risk, rebalancing)
- Contract interaction (deploy, verify, call)
- Analytics (performance, portfolio, yield)
- Development tools (test, build, docs)

### Phase 5: Testing & Deployment (Week 7)

**Testing Strategy**:
- Unit tests for all contract functions
- Integration tests for cross-contract interactions
- Fork tests on Sepolia testnet
- Frontend component tests with Vitest
- End-to-end user flow testing

**Deployment Process**:
1. Deployed Price Oracle first (no dependencies)
2. Deployed hSTRK Token with temporary vault address
3. Deployed Protocol Vault with all dependencies
4. Updated hSTRK Token with correct vault address
5. Deployed Risk Manager, Perpetual Hedge, Options Strategy
6. Deployed Rebalancing Engine last (depends on all contracts)
7. Verified all contracts on Starkscan

**Network Configuration**:
- Starknet Sepolia testnet
- Alchemy RPC endpoint for reliability
- Multiple deployment scripts (starkli, sncast, Python)

### Phase 6: Documentation & Polish (Week 8)

**Documentation Created**:
- Comprehensive README with all contract addresses
- CLI documentation with command reference
- API reference for all contract functions
- Deployment guides
- Architecture documentation
- State tracking document

**Quality Assurance**:
- Code review of all contracts
- Security pattern verification
- Gas optimization analysis
- Documentation completeness check

---

## Challenges We Ran Into

<img width="1920" height="1080" alt="8" src="https://github.com/user-attachments/assets/896f277e-2910-47eb-9937-849bc3447ab0" />

### 1. Cairo Type System Limitations

**Challenge**: Cairo doesn't have a native signed 256-bit integer type (i256), which is essential for delta calculations in hedging strategies.

**Impact**: Delta exposure can be positive or negative, and we needed to track this precisely for rebalancing decisions.

**Solution**:
- Implemented custom signed integer pattern using u256 + boolean sign flag
- Created helper functions for arithmetic operations
- Maintained precision while working within Cairo's constraints

**Learning**: Sometimes you need to build your own primitives when the language doesn't provide them.

### 2. OpenZeppelin Component Integration

**Challenge**: OpenZeppelin 2.0.0 introduced breaking changes in component architecture that conflicted with our contract design.

**Impact**: Initial hSTRK token implementation failed to compile due to component trait conflicts.

**Solution**:
- Simplified hSTRK token to use manual owner management
- Implemented ERC20 functionality directly without components
- Maintained security while avoiding component complexity

**Learning**: Don't over-engineer - sometimes a simpler approach is more maintainable.

### 3. Circular Dependency Resolution

**Challenge**: Protocol Vault needs hSTRK token address for minting, but hSTRK token needs Vault address for access control.

**Impact**: Impossible to deploy both contracts simultaneously.

**Solution**:
- Deploy hSTRK with temporary vault address (deployer address)
- Deploy Protocol Vault with hSTRK address
- Call `set_protocol_vault()` on hSTRK to update to correct address
- Document this process clearly for future deployments

**Learning**: Circular dependencies require creative deployment strategies.

### 4. Storage API Migration

**Challenge**: Cairo deprecated LegacyMap in favor of new Map type, requiring different trait imports.

**Impact**: All storage operations failed with "trait not found" errors.

**Solution**:
- Updated all storage declarations from LegacyMap to Map
- Added proper trait imports: StoragePointerReadAccess, StoragePointerWriteAccess
- Updated all read/write operations to use new API

**Learning**: Stay current with language updates and migration guides.

### 5. Multi-Source Oracle Integration

**Challenge**: Integrating multiple price sources (Pragma, Ekubo, MySwap, JediSwap) with fallback logic.

**Impact**: Complex error handling and confidence scoring needed.

**Solution**:
- Implemented primary/fallback pattern with Pragma as primary
- Added staleness checks and deviation limits
- Created confidence scoring system
- Built comprehensive event logging for debugging

**Learning**: Robust oracle systems require multiple data sources and validation.

### 6. Real Token Transfer Implementation

**Challenge**: Moving from mock implementations to real ERC20 transfers with approval flows.

**Impact**: Initial implementations didn't actually move tokens.

**Solution**:
- Implemented full ERC20 dispatcher pattern
- Added approval checks before transfers
- Created proper error handling for insufficient balance/allowance
- Tested with real STRK token on testnet

**Learning**: Production code requires real implementations, not mocks.

### 7. Gas Optimization for Rebalancing

**Challenge**: Rebalancing operations were expensive due to multiple contract calls.

**Impact**: High gas costs would make the protocol uneconomical.

**Solution**:
- Implemented batch operations where possible
- Optimized storage access patterns
- Used events instead of storage for historical data
- Minimized cross-contract calls

**Learning**: Gas optimization is critical for DeFi protocols.

### 8. Wallet Integration Complexity

**Challenge**: StarknetKit documentation was sparse and examples were outdated.

**Impact**: Wallet connection failed with various errors.

**Solution**:
- Studied StarknetKit source code directly
- Implemented exact pattern from official examples
- Created custom hooks for wallet state management
- Added comprehensive error handling

**Learning**: When documentation is lacking, read the source code.

---

## Accomplishments That We're Proud Of

### 1. Complete Production Deployment

**Achievement**: Successfully deployed all 7 smart contracts to Starknet Sepolia testnet with zero mocks or placeholders.

**Significance**:
- Every contract is fully functional with real implementations
- All contract addresses are verified on Starkscan
- Complete integration between all contracts
- Production-ready code quality

**Metrics**:
- 7/7 contracts deployed
- 100% real implementations
- 0 mock functions
- All contracts verified

### 2. Solving the i256 Problem

**Achievement**: Created a robust signed integer implementation in Cairo without native i256 support.

**Significance**:
- Enables precise delta calculations
- Maintains numerical precision
- Works within Cairo's type system
- Reusable pattern for other projects

**Technical Details**:
- u256 for magnitude
- bool for sign
- Helper functions for arithmetic
- Tested extensively

### 3. Multi-Source Oracle System

**Achievement**: Built a production-grade oracle system with Pragma integration and DEX fallbacks.

**Significance**:
- Institutional-grade price feeds
- Manipulation resistance
- High availability
- Confidence scoring

**Features**:
- Pragma Network primary source
- 3 DEX TWAP fallbacks
- Staleness checks
- Deviation limits
- Event logging

### 4. Comprehensive CLI Tool

**Achievement**: Developed a full-featured Rust CLI with 50+ commands covering all protocol operations.

**Significance**:
- Power users can manage protocol from terminal
- Automation and scripting support
- Professional developer experience
- Complete protocol control

**Capabilities**:
- User operations
- Protocol management
- Contract interaction
- Analytics and reporting
- Development tools

### 5. Enterprise-Grade Risk Management

**Achievement**: Implemented autonomous risk scoring with circuit breakers and automated responses.

**Significance**:
- Protects user funds automatically
- No manual intervention needed
- Multi-factor risk assessment
- Graduated response system

**Risk Metrics**:
- Leverage ratio
- Liquidity ratio
- Drawdown tracking
- Correlation analysis
- Volatility monitoring

### 6. Seamless Wallet Integration

**Achievement**: Integrated StarknetKit with support for ArgentX and Braavos wallets.

**Significance**:
- Users can connect with popular wallets
- Smooth user experience
- Proper account abstraction
- Auto-reconnect support

**Features**:
- Multiple wallet support
- Auto-connect on page load
- Address display and copy
- Network detection

### 7. Complete Documentation

**Achievement**: Created comprehensive documentation covering all aspects of the protocol.

**Significance**:
- Developers can understand and contribute
- Users can learn how to use the protocol
- Auditors can review the system
- Future maintainers have context

**Documentation**:
- 737-line README
- CLI documentation
- API reference
- Deployment guides
- Architecture docs

### 8. Zero Downtime Deployment

**Achievement**: Deployed all contracts in correct order handling circular dependencies.

**Significance**:
- Clean deployment process
- No failed transactions
- All contracts integrated
- Documented for repeatability

**Process**:
- 8-step deployment sequence
- Circular dependency resolution
- Contract verification
- Integration testing

### Long-Term Vision (2026+)

**1. Algorithmic Strategy Optimization**
- Machine learning for strategy selection
- Dynamic parameter adjustment
- Market regime detection
- Automated strategy switching
- **Goal**: Maximize risk-adjusted returns

**2. Derivatives Trading**
- Launch perpetual futures on hSTRK
- Options on hSTRK
- Structured products
- Yield tokenization
- **Products**: 5+ derivative instruments

**3. Ecosystem Partnerships**
- Integration with major DEXs
- Partnerships with lending protocols
- Collaboration with other yield protocols
- Strategic alliances
- **Partners**: 10+ protocols

**4. Global Expansion**
- Multi-language support
- Regional compliance
- Local partnerships
- Global marketing
- **Regions**: 5+ major markets


---

<img width="1920" height="1080" alt="13" src="https://github.com/user-attachments/assets/fbeda602-f725-4189-aace-2d5f106ee65a" />

<div align="center">

**Developed by Lich Studio**

</div>
