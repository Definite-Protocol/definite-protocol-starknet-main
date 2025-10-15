# Definite Protocol - Starknet Contracts

A delta-neutral yield protocol on Starknet that provides hedged exposure to STRK tokens through automated hedging strategies.

## Overview

Definite Protocol allows users to deposit STRK tokens and receive hSTRK (hedged STRK) tokens in return. The protocol maintains delta-neutral exposure through automated perpetual futures and options strategies, providing yield while protecting against STRK price volatility.

## Architecture

The protocol consists of 7 core smart contracts deployed on Starknet Sepolia testnet:

### Core Contracts

1. **hSTRK Token Contract**
   - Address: `0x0142895eab6ca66eeaf80d5f6bca8dd57559c80f1954f6e6aaf49e8aa76eb4f8`
   - ERC20 token representing hedged STRK positions
   - Minted when users deposit STRK, burned when users withdraw

2. **Protocol Vault Contract**
   - Address: `0x04ca6a156f683ce0e1340a4488c608b67c55cfd8c5bd646a30aea7bced164aa4`
   - Main entry point for user deposits and withdrawals
   - Manages STRK/hSTRK exchange rates and fee collection
   - Implements real ERC20 transfers for all token operations

3. **Price Oracle Contract**
   - Address: `0x0225cf5aa1cf009052c3359e0f7b9156cc3e65bf39b64bef14566c19476768fe`
   - Provides real-time STRK price feeds
   - Implements price validation and deviation checks
   - Supports multiple price sources with aggregation

4. **Risk Manager Contract**
   - Address: `0x02b7ed5e0c9b8e22fb5f10c0c1bd1cc2ce32958c3f9eb5db313a6120bd524a9d`
   - Monitors protocol risk metrics and exposure limits
   - Implements circuit breakers for emergency situations
   - Tracks portfolio delta and risk thresholds

### Hedging Contracts

5. **Perpetual Hedge Contract**
   - Address: `0x004fbb92f86eaeb8f9ebc34765ae0b791b880634be2e6508baeb5d3e9fff5061`
   - Manages perpetual futures positions for delta hedging
   - Executes automated hedging strategies based on exposure
   - Tracks position sizes and funding payments

6. **Options Strategy Contract**
   - Address: `0x02501c12f953d491c49a35040aea4d6b8f02b28e8eb9f50705853acd819feb8c`
   - Implements options-based hedging strategies
   - Manages portfolio Greeks (delta, gamma, vega, theta)
   - Executes protective put and covered call strategies

### Automation Contract

7. **Rebalancing Engine Contract**
   - Address: `0x06063a8abd3c7be5ce3119ccd6d2379fe8faa8f4781850fb01997b3b0ceee6ad`
   - Automates portfolio rebalancing based on delta thresholds
   - Coordinates between hedging contracts and vault
   - Implements keeper-based execution model

## Network Information

- **Network**: Starknet Sepolia Testnet
- **RPC Endpoint**: `https://starknet-sepolia.infura.io/v3/
- **Chain ID**: `SN_SEPOLIA`
- **Cairo Version**: 2.12.2
- **Scarb Version**: 2.12.2

## Features

### For Users
- **Delta-Neutral Exposure**: Deposit STRK and receive yield without price risk
- **Automated Hedging**: Protocol automatically manages hedging positions
- **Real-Time Pricing**: Accurate price feeds from multiple oracle sources
- **Flexible Withdrawals**: Withdraw hSTRK tokens anytime for underlying STRK

### For Developers
- **Production-Ready**: All contracts use real implementations without mocks
- **Comprehensive CLI**: Full-featured command-line interface for interaction
- **Risk Management**: Built-in risk controls and emergency mechanisms
- **Modular Design**: Separate contracts for different protocol functions

## CLI Usage

The protocol includes a comprehensive CLI tool for interacting with all contracts:

```bash
# Build the CLI
cd cli && cargo build --release

# Check user balance
./target/release/definite user balance

# Deposit STRK tokens
./target/release/definite user deposit --amount 100

# Withdraw hSTRK tokens
./target/release/definite user withdraw --amount 50

# View protocol status
./target/release/definite protocol status

# Check risk metrics
./target/release/definite protocol risk

# Execute rebalancing
./target/release/definite protocol rebalance execute
```

## Technical Implementation

### Cairo 2.12.2 Compatibility
- Manual owner management pattern (replacing OpenZeppelin components)
- Updated storage API using `Map` instead of `LegacyMap`
- Proper storage trait imports for read/write operations
- Real ERC20 implementations with actual token transfers

### Signed Integer Handling
- Custom implementation using u256 + boolean sign pattern
- Replaces i256 type not available in Cairo
- Maintains precision for delta calculations and position tracking

### Security Features
- Input validation on all user-facing functions
- Reentrancy protection on critical operations
- Emergency pause mechanisms for all contracts
- Comprehensive error handling with descriptive messages

## Development

### Prerequisites
- Cairo 2.12.2
- Scarb 2.12.2
- Starkli 0.8.1
- Rust (for CLI)

### Building
```bash
# Build Cairo contracts
scarb build

# Build CLI
cd cli && cargo build --release
```

### Testing
```bash
# Run Cairo tests
scarb test

# Run CLI tests
cd cli && cargo test
```

### Deployment
All contracts are already deployed on Starknet Sepolia testnet. For redeployment:

```bash
# Declare contracts
starkli declare target/dev/definite_protocol_<ContractName>.contract_class.json

# Deploy with constructor parameters
starkli deploy <class_hash> <constructor_args>
```

## License

MIT License

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## Support

For questions and support, please open an issue on the GitHub repository.
