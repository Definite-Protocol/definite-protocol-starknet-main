#!/bin/bash

# Definite Protocol - Complete Deployment Script
# Deploy all contracts to Starknet Sepolia with new deployer account

set -e

echo "🚀 Definite Protocol - Complete Deployment"
echo "=========================================="
echo ""

# Configuration
DEPLOYER_ADDRESS="0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5"
DEPLOYER_PRIVATE_KEY="0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4"
RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/tnhhH9UGXWm8Gji-k4G3Yxv6VcQZjwYK"
NETWORK="sepolia"

# Contract paths
CONTRACT_DIR="contracts/cairo"
TARGET_DIR="$CONTRACT_DIR/target/dev"

echo "📋 Configuration:"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Network: $NETWORK"
echo "  RPC: $RPC_URL"
echo ""

# Check if scarb is installed
if ! command -v scarb &> /dev/null; then
    echo "❌ Error: scarb not found. Please install scarb first."
    exit 1
fi

# Check if starkli is installed
if ! command -v starkli &> /dev/null; then
    echo "❌ Error: starkli not found. Please install starkli first."
    exit 1
fi

echo "📦 Step 1: Building contracts..."
cd $CONTRACT_DIR
scarb build
cd ../..
echo "✅ Contracts built successfully"
echo ""

# Create account file for starkli
ACCOUNT_FILE="/tmp/starknet_account.json"
cat > $ACCOUNT_FILE <<EOF
{
  "version": 1,
  "variant": {
    "type": "argent",
    "version": 1,
    "owner": "$DEPLOYER_ADDRESS",
    "guardian": "0x0"
  },
  "deployment": {
    "status": "deployed",
    "class_hash": "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f",
    "address": "$DEPLOYER_ADDRESS"
  }
}
EOF

# Create keystore file
KEYSTORE_FILE="/tmp/starknet_keystore.json"
echo "$DEPLOYER_PRIVATE_KEY" > $KEYSTORE_FILE

echo "🔑 Account configured"
echo ""

# Deploy function
deploy_contract() {
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
    DECLARE_OUTPUT=$(starkli declare \
        --rpc $RPC_URL \
        --account $ACCOUNT_FILE \
        --keystore $KEYSTORE_FILE \
        --keystore-password "" \
        $sierra_file 2>&1 || true)
    
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP 'Class hash declared: \K0x[0-9a-fA-F]+' || echo "$DECLARE_OUTPUT" | grep -oP 'Class hash: \K0x[0-9a-fA-F]+')
    
    if [ -z "$CLASS_HASH" ]; then
        echo "  ⚠️  Declaration might have failed or class already declared"
        echo "  Output: $DECLARE_OUTPUT"
        # Try to extract class hash from error message
        CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]{64}' | head -1)
    fi
    
    echo "  Class Hash: $CLASS_HASH"
    
    # Deploy contract
    echo "  Deploying contract..."
    DEPLOY_OUTPUT=$(starkli deploy \
        --rpc $RPC_URL \
        --account $ACCOUNT_FILE \
        --keystore $KEYSTORE_FILE \
        --keystore-password "" \
        $CLASS_HASH \
        $constructor_args 2>&1)
    
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Contract deployed: \K0x[0-9a-fA-F]+')
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo "❌ Deployment failed"
        echo "$DEPLOY_OUTPUT"
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
deploy_contract "hSTRKToken" "$DEPLOYER_ADDRESS"
HSTRK_TOKEN_ADDRESS=$hSTRKToken_ADDRESS

# 2. Deploy Price Oracle
deploy_contract "PriceOracle" "$DEPLOYER_ADDRESS"
PRICE_ORACLE_ADDRESS=$PriceOracle_ADDRESS

# 3. Deploy Protocol Vault
# Constructor: owner, asset_token (STRK), hstrk_token, oracle
STRK_TOKEN="0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D"
deploy_contract "ProtocolVault" "$DEPLOYER_ADDRESS $STRK_TOKEN $HSTRK_TOKEN_ADDRESS $PRICE_ORACLE_ADDRESS"
PROTOCOL_VAULT_ADDRESS=$ProtocolVault_ADDRESS

# 4. Deploy Risk Manager
deploy_contract "RiskManager" "$DEPLOYER_ADDRESS"
RISK_MANAGER_ADDRESS=$RiskManager_ADDRESS

# 5. Deploy Perpetual Hedge
deploy_contract "PerpetualHedge" "$DEPLOYER_ADDRESS"
PERPETUAL_HEDGE_ADDRESS=$PerpetualHedge_ADDRESS

# 6. Deploy Options Strategy
deploy_contract "OptionsStrategy" "$DEPLOYER_ADDRESS"
OPTIONS_STRATEGY_ADDRESS=$OptionsStrategy_ADDRESS

# 7. Deploy Rebalancing Engine
deploy_contract "RebalancingEngine" "$DEPLOYER_ADDRESS"
REBALANCING_ENGINE_ADDRESS=$RebalancingEngine_ADDRESS

echo "✅ All contracts deployed successfully!"
echo ""

# Step 3: Configure hSTRK Token
echo "⚙️  Step 3: Configuring hSTRK Token..."
echo "  Setting protocol vault..."

starkli invoke \
    --rpc $RPC_URL \
    --account $ACCOUNT_FILE \
    --keystore $KEYSTORE_FILE \
    --keystore-password "" \
    $HSTRK_TOKEN_ADDRESS \
    set_protocol_vault \
    $PROTOCOL_VAULT_ADDRESS

echo "✅ hSTRK Token configured"
echo ""

# Generate deployment report
DEPLOYMENT_FILE="deployment-$(date +%Y%m%d-%H%M%S).json"

cat > $DEPLOYMENT_FILE <<EOF
{
  "timestamp": $(date +%s),
  "network": "$NETWORK",
  "chainId": "SN_SEPOLIA",
  "rpcUrl": "$RPC_URL",
  "deployer_address": "$DEPLOYER_ADDRESS",
  "contracts": {
    "hstrkToken": {
      "address": "$HSTRK_TOKEN_ADDRESS",
      "classHash": "$hSTRKToken_CLASS_HASH",
      "name": "hSTRK Token",
      "abi": "hstrk_token.json"
    },
    "protocolVault": {
      "address": "$PROTOCOL_VAULT_ADDRESS",
      "classHash": "$ProtocolVault_CLASS_HASH",
      "name": "Protocol Vault",
      "abi": "protocol_vault.json"
    },
    "priceOracle": {
      "address": "$PRICE_ORACLE_ADDRESS",
      "classHash": "$PriceOracle_CLASS_HASH",
      "name": "Price Oracle",
      "abi": "price_oracle.json"
    },
    "riskManager": {
      "address": "$RISK_MANAGER_ADDRESS",
      "classHash": "$RiskManager_CLASS_HASH",
      "name": "Risk Manager",
      "abi": "risk_manager.json"
    },
    "perpetualHedge": {
      "address": "$PERPETUAL_HEDGE_ADDRESS",
      "classHash": "$PerpetualHedge_CLASS_HASH",
      "name": "Perpetual Hedge",
      "abi": "perpetual_hedge.json"
    },
    "optionsStrategy": {
      "address": "$OPTIONS_STRATEGY_ADDRESS",
      "classHash": "$OptionsStrategy_CLASS_HASH",
      "name": "Options Strategy",
      "abi": "options_strategy.json"
    },
    "rebalancingEngine": {
      "address": "$REBALANCING_ENGINE_ADDRESS",
      "classHash": "$RebalancingEngine_CLASS_HASH",
      "name": "Rebalancing Engine",
      "abi": "rebalancing_engine.json"
    }
  },
  "status": "deployed",
  "note": "Deployed with new deployer account"
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
echo "⚠️  Next Steps:"
echo "  1. Update src/config/deployment.json with new addresses"
echo "  2. Update src/config/environment.ts with new addresses"
echo "  3. Test mint functionality"
echo ""

