# hALGO Protocol Smart Contracts

Enterprise-grade smart contract suite for the Hedged ALGO (hALGO) protocol on Algorand blockchain.

## DEPLOYED CONTRACTS - LIVE ON TESTNET

### Latest Deployment (Complete Protocol)

#### hALGO ASA Token
- **Asset ID**: 746099848
- **Unit Name**: hALGO
- **Asset Name**: Hedged ALGO
- **Decimals**: 6
- **Total Supply**: 1,000,000,000,000,000
- **Metadata Hash**: hALGO_v1.0_testnet
- **Transaction ID**: 3DU64GQ67JEEBAWPMRJAHFAPY6WLT4VFDHLNJXXNA6L2ST5PCOCA
- **Explorer**: https://testnet.algoexplorer.io/asset/746099848

#### Main Protocol Smart Contract
- **App ID**: 746099850
- **Contract Address**: HDI4ZY6VDHV3MFUVP24ASYFBGX753YUM7GO5N6AMVYPOGF6KFBF4RIS46U
- **Transaction ID**: GYW343VC7XSPD6ULZAR6THEQ55LBKLZTFKU7UJDFQNG3X65NUHZQ
- **Confirmed Round**: 55737528
- **Contract Balance**: 5 ALGO (funded for operations)
- **Explorer**: https://testnet.algoexplorer.io/application/746099850

#### Creator Account
- **Address**: 7V67MWCAVH2KKGY3CWVERTGV6DQMP2IMGVL4HTWHIUTRMUJBYYJ6UCW2ZQ
- **Explorer**: https://testnet.algoexplorer.io/address/7V67MWCAVH2KKGY3CWVERTGV6DQMP2IMGVL4HTWHIUTRMUJBYYJ6UCW2ZQ

### Deployment Details
- **Network**: Algorand Testnet
- **Deployment Date**: December 20, 2024
- **Status**: Active and Operational
- **Total Cost**: ~2 ALGO in fees
- **Frontend Integration**: Automatic detection enabled
- **Features**: Mint, Redeem, Emergency Controls, State Management

## 🏗️ Architecture Overview

The hALGO protocol consists of four main smart contracts:

### 1. **HedgedAlgoProtocol.py** - Main Protocol Contract
- **Purpose**: Core protocol logic for minting and redeeming hALGO tokens
- **Features**:
  - Mint hALGO with 1:1 ALGO ratio
  - Minimum deposit validation (10 ALGO)
  - Collateral management (150% ratio)
  - Emergency pause functionality
  - Exit fee handling (0.1%)

### 2. **PriceOracle.py** - Price Feed Contract
- **Purpose**: Multi-source price aggregation with reliability mechanisms
- **Features**:
  - Multiple oracle source support
  - Price deviation validation (5% max)
  - Circuit breaker protection (10% threshold)
  - Staleness detection (1 hour threshold)
  - Outlier detection and filtering

### 3. **RiskManager.py** - Risk Management Contract
- **Purpose**: Risk assessment and liquidation management
- **Features**:
  - Real-time risk score calculation
  - Collateral ratio monitoring
  - Liquidation threshold enforcement (120%)
  - Delta exposure tracking
  - Position health monitoring

### 4. **RebalanceEngine.py** - Auto-Rebalancing Contract
- **Purpose**: Automated hedge management and yield optimization
- **Features**:
  - Delta hedging calculations
  - Auto-rebalancing triggers (5% threshold)
  - Funding rate management
  - Yield distribution
  - Performance optimization

## 🚀 Quick Start

### Prerequisites

```bash
# Install PyTeal
pip install pyteal

# Install Algorand SDK
pip install py-algorand-sdk
```

### 1. Compile Contracts

```bash
# Compile all contracts to TEAL
python scripts/compile_contracts.py
```

This will:
- Compile all PyTeal contracts to TEAL
- Generate bytecode for deployment
- Create compilation manifest
- Generate deployment configuration template

### 2. Configure Deployment

Edit `compiled_contracts/deployment_config.json`:

```json
{
  "creator_mnemonic": "your testnet account mnemonic here",
  "network": "testnet",
  "algod_endpoint": "https://testnet-api.algonode.cloud"
}
```

### 3. Deploy to Testnet

```bash
# Deploy all contracts to Algorand testnet
python scripts/deploy_contracts.py
```

This will:
- Deploy hALGO ASA token
- Deploy all smart contracts
- Configure contract interactions
- Generate frontend integration config

## 📋 Contract Specifications

### Global State Schema

| Contract | Int Keys | Byte Keys | Purpose |
|----------|----------|-----------|---------|
| Main Protocol | 20 | 10 | Supply, collateral, oracle data |
| Price Oracle | 10 | 10 | Price data, oracle sources |
| Risk Manager | 10 | 5 | Risk metrics, system health |
| Rebalance Engine | 15 | 5 | Delta data, funding rates |

### Local State Schema

| Contract | Int Keys | Byte Keys | Purpose |
|----------|----------|-----------|---------|
| Main Protocol | 15 | 10 | User balances, positions |
| Price Oracle | 5 | 5 | Oracle permissions |
| Risk Manager | 10 | 5 | User risk scores |
| Rebalance Engine | 5 | 5 | User delta exposure |

## 🔧 Configuration Parameters

### Protocol Parameters
- **Minimum Deposit**: 10 ALGO
- **Collateral Ratio**: 150%
- **Liquidation Threshold**: 120%
- **Exit Fee**: 0.1% (10 basis points)

### Oracle Parameters
- **Max Price Deviation**: 5%
- **Staleness Threshold**: 1 hour
- **Circuit Breaker**: 10%
- **Minimum Sources**: 3

### Risk Management
- **Risk Score Threshold**: 80%
- **Liquidation Penalty**: 5%
- **Max Position Size**: 1M ALGO

### Rebalancing
- **Delta Threshold**: 5%
- **Min Rebalance Interval**: 1 hour
- **Max Slippage**: 3%

## 🧪 Testing

### Unit Tests
```bash
# Run contract unit tests
python -m pytest tests/contracts/
```

### Integration Tests
```bash
# Test contract interactions
python tests/integration/test_protocol_flow.py
```

### Testnet Testing
```bash
# Test on live testnet
python tests/testnet/test_deployment.py
```

## 🔐 Security Features

### Access Control
- **Creator-only functions**: Emergency pause, oracle management
- **Multi-signature support**: For critical operations
- **Time-locked operations**: For parameter changes

### Validation
- **Input validation**: All user inputs validated
- **State consistency**: Atomic operations ensure consistency
- **Overflow protection**: SafeMath equivalent operations

### Circuit Breakers
- **Emergency pause**: Halt all operations if needed
- **Oracle circuit breaker**: Stop on price anomalies
- **Liquidation protection**: Prevent cascade liquidations

## 📊 Monitoring & Analytics

### Key Metrics
- Total Value Locked (TVL)
- Collateral ratio distribution
- Oracle price accuracy
- Liquidation events
- Rebalancing frequency

### Alerts
- Low collateral ratios
- Oracle failures
- High volatility periods
- System health degradation

## 🔄 Upgrade Path

### Contract Upgrades
- **Immutable core logic**: Critical functions cannot be changed
- **Upgradeable parameters**: Configuration can be updated
- **Migration support**: For major version upgrades

### Governance
- **Parameter voting**: Community governance for changes
- **Emergency actions**: Multi-sig for critical decisions
- **Transparency**: All changes logged on-chain

## 📚 Additional Resources

- [Algorand Smart Contract Documentation](https://developer.algorand.org/docs/get-details/dapps/smart-contracts/)
- [PyTeal Documentation](https://pyteal.readthedocs.io/)
- [hALGO Protocol Whitepaper](./docs/whitepaper.md)
- [Security Audit Report](./docs/security-audit.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
