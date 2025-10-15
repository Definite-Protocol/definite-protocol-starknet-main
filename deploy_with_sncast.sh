#!/bin/bash

# Definite Protocol - Starknet Sepolia Deployment with sncast
# Deploy all contracts to Starknet Sepolia testnet

set -e

echo "🚀 Definite Protocol - Starknet Sepolia Deployment"
echo "=================================================="
echo ""

# Configuration
DEPLOYER_ADDRESS="0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5"
DEPLOYER_PRIVATE_KEY="0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4"
NETWORK="sepolia"
ACCOUNT_FILE="account.json"
KEYSTORE_FILE="keystore.json"

# Add asdf to PATH
export PATH="$HOME/.asdf/shims:$PATH"

# Contract paths
CONTRACT_DIR="contracts/cairo"
TARGET_DIR="$CONTRACT_DIR/target/dev"

echo "📋 Configuration:"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Network: $NETWORK"
echo ""

# Check if sncast is installed
if ! command -v sncast &> /dev/null; then
    echo "❌ Error: sncast not found. Please install Starknet Foundry first."
    exit 1
fi

echo "✅ sncast version: $(sncast --version)"
echo ""

# Build contracts
echo "📦 Step 1: Building contracts..."
cd $CONTRACT_DIR
scarb build
cd ../..
echo "✅ Contracts built successfully"
echo ""

# Declare and deploy function
declare_and_deploy() {
    local contract_name=$1
    local constructor_args=$2
    local sierra_file="$TARGET_DIR/definite_protocol_${contract_name}.contract_class.json"
    
    echo "📤 Deploying $contract_name..."
    
    if [ ! -f "$sierra_file" ]; then
        echo "❌ Error: Sierra file not found: $sierra_file"
        return 1
    fi
    
    # Declare contract
    echo "  Declaring contract..."
    DECLARE_OUTPUT=$(sncast \
        --profile sepolia \
        declare \
        --contract-name $contract_name \
        2>&1 || true)
    
    echo "$DECLARE_OUTPUT"
    
    # Extract class hash
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | cut -d' ' -f2 || echo "$DECLARE_OUTPUT" | grep -oE "0x[0-9a-fA-F]{64}" | head -1)
    
    if [ -z "$CLASS_HASH" ]; then
        echo "❌ Failed to get class hash"
        return 1
    fi
    
    echo "  ✅ Class Hash: $CLASS_HASH"
    
    # Deploy contract
    echo "  Deploying contract instance..."
    DEPLOY_OUTPUT=$(sncast \
        --profile sepolia \
        deploy \
        --class-hash $CLASS_HASH \
        --constructor-calldata $constructor_args \
        2>&1)
    
    echo "$DEPLOY_OUTPUT"
    
    # Extract contract address
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | cut -d' ' -f2)
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo "❌ Deployment failed"
        return 1
    fi
    
    echo "✅ $contract_name deployed: $CONTRACT_ADDRESS"
    echo ""
    
    # Export for later use
    eval "${contract_name}_ADDRESS=$CONTRACT_ADDRESS"
    eval "${contract_name}_CLASS_HASH=$CLASS_HASH"
}

echo "🚀 Step 2: Deploying contracts..."
echo ""

# 1. Deploy hSTRK Token
echo "1️⃣  Deploying hSTRK Token..."
declare_and_deploy "hSTRKToken" "$DEPLOYER_ADDRESS"
HSTRK_TOKEN_ADDRESS=$hSTRKToken_ADDRESS

# 2. Deploy Price Oracle
echo "2️⃣  Deploying Price Oracle..."
declare_and_deploy "PriceOracle" "$DEPLOYER_ADDRESS"
PRICE_ORACLE_ADDRESS=$PriceOracle_ADDRESS

# 3. Deploy Protocol Vault
echo "3️⃣  Deploying Protocol Vault..."
# Constructor: owner, asset_token (STRK on Sepolia), hstrk_token, oracle
STRK_TOKEN="0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D"
declare_and_deploy "ProtocolVault" "$DEPLOYER_ADDRESS $STRK_TOKEN $HSTRK_TOKEN_ADDRESS $PRICE_ORACLE_ADDRESS"
PROTOCOL_VAULT_ADDRESS=$ProtocolVault_ADDRESS

# 4. Deploy Risk Manager
echo "4️⃣  Deploying Risk Manager..."
declare_and_deploy "RiskManager" "$DEPLOYER_ADDRESS"
RISK_MANAGER_ADDRESS=$RiskManager_ADDRESS

# 5. Deploy Perpetual Hedge
echo "5️⃣  Deploying Perpetual Hedge..."
declare_and_deploy "PerpetualHedge" "$DEPLOYER_ADDRESS"
PERPETUAL_HEDGE_ADDRESS=$PerpetualHedge_ADDRESS

# 6. Deploy Options Strategy
echo "6️⃣  Deploying Options Strategy..."
declare_and_deploy "OptionsStrategy" "$DEPLOYER_ADDRESS"
OPTIONS_STRATEGY_ADDRESS=$OptionsStrategy_ADDRESS

# 7. Deploy Rebalancing Engine
echo "7️⃣  Deploying Rebalancing Engine..."
declare_and_deploy "RebalancingEngine" "$DEPLOYER_ADDRESS"
REBALANCING_ENGINE_ADDRESS=$RebalancingEngine_ADDRESS

echo "✅ All contracts deployed successfully!"
echo ""

# Generate deployment report
DEPLOYMENT_FILE="deployment-$(date +%Y%m%d-%H%M%S).json"

cat > $DEPLOYMENT_FILE <<EOF
{
  "timestamp": $(date +%s),
  "network": "$NETWORK",
  "chainId": "SN_SEPOLIA",
  "deployer_address": "$DEPLOYER_ADDRESS",
  "contracts": {
    "hstrkToken": {
      "address": "$HSTRK_TOKEN_ADDRESS",
      "classHash": "$hSTRKToken_CLASS_HASH",
      "name": "hSTRK Token"
    },
    "protocolVault": {
      "address": "$PROTOCOL_VAULT_ADDRESS",
      "classHash": "$ProtocolVault_CLASS_HASH",
      "name": "Protocol Vault"
    },
    "priceOracle": {
      "address": "$PRICE_ORACLE_ADDRESS",
      "classHash": "$PriceOracle_CLASS_HASH",
      "name": "Price Oracle"
    },
    "riskManager": {
      "address": "$RISK_MANAGER_ADDRESS",
      "classHash": "$RiskManager_CLASS_HASH",
      "name": "Risk Manager"
    },
    "perpetualHedge": {
      "address": "$PERPETUAL_HEDGE_ADDRESS",
      "classHash": "$PerpetualHedge_CLASS_HASH",
      "name": "Perpetual Hedge"
    },
    "optionsStrategy": {
      "address": "$OPTIONS_STRATEGY_ADDRESS",
      "classHash": "$OptionsStrategy_CLASS_HASH",
      "name": "Options Strategy"
    },
    "rebalancingEngine": {
      "address": "$REBALANCING_ENGINE_ADDRESS",
      "classHash": "$RebalancingEngine_CLASS_HASH",
      "name": "Rebalancing Engine"
    }
  },
  "status": "deployed"
}
EOF

echo "📄 Deployment report saved: $DEPLOYMENT_FILE"
echo ""

echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "📋 Deployed Contracts:"
echo "  1. hSTRK Token:        $HSTRK_TOKEN_ADDRESS"
echo "  2. Protocol Vault:     $PROTOCOL_VAULT_ADDRESS"
echo "  3. Price Oracle:       $PRICE_ORACLE_ADDRESS"
echo "  4. Risk Manager:       $RISK_MANAGER_ADDRESS"
echo "  5. Perpetual Hedge:    $PERPETUAL_HEDGE_ADDRESS"
echo "  6. Options Strategy:   $OPTIONS_STRATEGY_ADDRESS"
echo "  7. Rebalancing Engine: $REBALANCING_ENGINE_ADDRESS"
echo ""
echo "🔗 Explorer:"
echo "  https://sepolia.starkscan.co/contract/$PROTOCOL_VAULT_ADDRESS"
echo ""

