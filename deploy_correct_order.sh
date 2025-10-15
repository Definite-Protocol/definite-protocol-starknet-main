#!/bin/bash

# Definite Protocol - Correct Deployment Order
# Handles circular dependency between hSTRK and ProtocolVault

set -e

echo "🚀 Definite Protocol - Starknet Sepolia Deployment (Correct Order)"
echo "===================================================================="
echo ""

# ============================================================================
# CONFIGURATION
# ============================================================================
DEPLOYER_ADDRESS="0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5"
DEPLOYER_PRIVATE_KEY="0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4"

# RPC URL (v0.8)
RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/c74NJJI9JjRLdNwXjvlm9lhVJAbyJYck"

STRK_TOKEN="0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D"
NETWORK="sepolia"
# ============================================================================

# Add starkli to PATH
. /Users/mehmethayirli/.starkli/env

# Contract paths
CONTRACT_DIR="contracts/cairo"
TARGET_DIR="$CONTRACT_DIR/target/dev"

echo "📋 Configuration:"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Network: $NETWORK"
echo "  STRK Token: $STRK_TOKEN"
echo "  starkli version: $(starkli --version)"
echo ""

# Build contracts
echo "📦 Step 1: Building contracts..."
cd $CONTRACT_DIR
scarb build
cd ../..
echo "✅ Contracts built successfully"
echo ""

# Declare function
declare_contract() {
    local contract_name=$1
    local sierra_file="$TARGET_DIR/definite_protocol_${contract_name}.contract_class.json"
    local casm_file="$TARGET_DIR/definite_protocol_${contract_name}.compiled_contract_class.json"
    
    echo "📤 Declaring $contract_name..."
    
    if [ ! -f "$sierra_file" ]; then
        echo "❌ Error: Sierra file not found: $sierra_file"
        return 1
    fi
    
    if [ ! -f "$casm_file" ]; then
        echo "❌ Error: CASM file not found: $casm_file"
        return 1
    fi
    
    # Declare contract
    DECLARE_OUTPUT=$(starkli declare \
        --rpc $RPC_URL \
        --account fetched_account.json \
        --keystore signer.json \
        --keystore-password "" \
        $sierra_file \
        --casm-hash $(starkli class-hash $casm_file) \
        2>&1 || true)
    
    echo "$DECLARE_OUTPUT"
    
    # Extract class hash
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE "0x[0-9a-fA-F]{64}" | head -1)
    
    if [ -z "$CLASS_HASH" ]; then
        echo "❌ Failed to get class hash"
        return 1
    fi
    
    echo "  ✅ Class Hash: $CLASS_HASH"
    echo ""
    
    # Export for later use
    eval "${contract_name}_CLASS_HASH=$CLASS_HASH"
    echo "$CLASS_HASH"
}

# Deploy function
deploy_contract() {
    local contract_name=$1
    local class_hash=$2
    shift 2
    local constructor_args="$@"
    
    echo "🚀 Deploying $contract_name..."
    echo "  Class Hash: $class_hash"
    echo "  Constructor Args: $constructor_args"
    
    DEPLOY_OUTPUT=$(starkli deploy \
        --rpc $RPC_URL \
        --account fetched_account.json \
        --keystore signer.json \
        --keystore-password "" \
        $class_hash \
        $constructor_args \
        2>&1)
    
    echo "$DEPLOY_OUTPUT"
    
    # Extract contract address
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE "0x[0-9a-fA-F]{64}" | tail -1)
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo "❌ Deployment failed"
        return 1
    fi
    
    echo "✅ $contract_name deployed: $CONTRACT_ADDRESS"
    echo ""
    
    # Export for later use
    eval "${contract_name}_ADDRESS=$CONTRACT_ADDRESS"
    echo "$CONTRACT_ADDRESS"
}

echo "🔨 Step 2: Declaring all contracts..."
echo ""

# Declare all contracts first
PRICE_ORACLE_HASH=$(declare_contract "PriceOracle")
HSTRK_TOKEN_HASH=$(declare_contract "hSTRKToken")
PROTOCOL_VAULT_HASH=$(declare_contract "ProtocolVault")
RISK_MANAGER_HASH=$(declare_contract "RiskManager")
PERPETUAL_HEDGE_HASH=$(declare_contract "PerpetualHedge")
OPTIONS_STRATEGY_HASH=$(declare_contract "OptionsStrategy")
REBALANCING_ENGINE_HASH=$(declare_contract "RebalancingEngine")

echo "✅ All contracts declared!"
echo ""

echo "🚀 Step 3: Deploying contracts in correct order..."
echo ""

# 1. Deploy PriceOracle (no dependencies - use zero addresses for pools)
echo "1️⃣  Deploying PriceOracle..."
ZERO_ADDRESS="0x0"
PRICE_ORACLE_ADDR=$(deploy_contract "PriceOracle" "$PRICE_ORACLE_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$ZERO_ADDRESS" \
    "$ZERO_ADDRESS" \
    "$ZERO_ADDRESS" \
    "$ZERO_ADDRESS")

# 2. Deploy hSTRKToken with TEMPORARY protocol_vault (use deployer address)
echo "2️⃣  Deploying hSTRKToken (with temporary vault address)..."
HSTRK_TOKEN_ADDR=$(deploy_contract "hSTRKToken" "$HSTRK_TOKEN_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$DEPLOYER_ADDRESS")

# 3. Deploy ProtocolVault with REAL hSTRKToken address
echo "3️⃣  Deploying ProtocolVault..."
PROTOCOL_VAULT_ADDR=$(deploy_contract "ProtocolVault" "$PROTOCOL_VAULT_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$HSTRK_TOKEN_ADDR" \
    "$STRK_TOKEN" \
    "$PRICE_ORACLE_ADDR" \
    "$DEPLOYER_ADDRESS")

# 4. Update hSTRKToken with REAL ProtocolVault address
echo "4️⃣  Updating hSTRKToken with real ProtocolVault address..."
UPDATE_OUTPUT=$(starkli invoke \
    --rpc $RPC_URL \
    --account fetched_account.json \
    --keystore signer.json \
    --keystore-password "" \
    $HSTRK_TOKEN_ADDR \
    set_protocol_vault \
    $PROTOCOL_VAULT_ADDR \
    2>&1)

echo "$UPDATE_OUTPUT"
echo "✅ hSTRKToken updated with ProtocolVault address"
echo ""

# 5. Deploy RiskManager
echo "5️⃣  Deploying RiskManager..."
RISK_MANAGER_ADDR=$(deploy_contract "RiskManager" "$RISK_MANAGER_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$PROTOCOL_VAULT_ADDR" \
    "$PRICE_ORACLE_ADDR")

# 6. Deploy PerpetualHedge
echo "6️⃣  Deploying PerpetualHedge..."
PERPETUAL_HEDGE_ADDR=$(deploy_contract "PerpetualHedge" "$PERPETUAL_HEDGE_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$PROTOCOL_VAULT_ADDR" \
    "$PRICE_ORACLE_ADDR")

# 7. Deploy OptionsStrategy
echo "7️⃣  Deploying OptionsStrategy..."
OPTIONS_STRATEGY_ADDR=$(deploy_contract "OptionsStrategy" "$OPTIONS_STRATEGY_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$PROTOCOL_VAULT_ADDR" \
    "$PRICE_ORACLE_ADDR")

# 8. Deploy RebalancingEngine (depends on all above)
echo "8️⃣  Deploying RebalancingEngine..."
REBALANCING_ENGINE_ADDR=$(deploy_contract "RebalancingEngine" "$REBALANCING_ENGINE_HASH" \
    "$DEPLOYER_ADDRESS" \
    "$PROTOCOL_VAULT_ADDR" \
    "$PRICE_ORACLE_ADDR" \
    "$PERPETUAL_HEDGE_ADDR" \
    "$OPTIONS_STRATEGY_ADDR")

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
    "priceOracle": {
      "address": "$PRICE_ORACLE_ADDR",
      "classHash": "$PRICE_ORACLE_HASH",
      "name": "Price Oracle"
    },
    "hstrkToken": {
      "address": "$HSTRK_TOKEN_ADDR",
      "classHash": "$HSTRK_TOKEN_HASH",
      "name": "hSTRK Token"
    },
    "protocolVault": {
      "address": "$PROTOCOL_VAULT_ADDR",
      "classHash": "$PROTOCOL_VAULT_HASH",
      "name": "Protocol Vault"
    },
    "riskManager": {
      "address": "$RISK_MANAGER_ADDR",
      "classHash": "$RISK_MANAGER_HASH",
      "name": "Risk Manager"
    },
    "perpetualHedge": {
      "address": "$PERPETUAL_HEDGE_ADDR",
      "classHash": "$PERPETUAL_HEDGE_HASH",
      "name": "Perpetual Hedge"
    },
    "optionsStrategy": {
      "address": "$OPTIONS_STRATEGY_ADDR",
      "classHash": "$OPTIONS_STRATEGY_HASH",
      "name": "Options Strategy"
    },
    "rebalancingEngine": {
      "address": "$REBALANCING_ENGINE_ADDR",
      "classHash": "$REBALANCING_ENGINE_HASH",
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
echo "  1. Price Oracle:       $PRICE_ORACLE_ADDR"
echo "  2. hSTRK Token:        $HSTRK_TOKEN_ADDR"
echo "  3. Protocol Vault:     $PROTOCOL_VAULT_ADDR"
echo "  4. Risk Manager:       $RISK_MANAGER_ADDR"
echo "  5. Perpetual Hedge:    $PERPETUAL_HEDGE_ADDR"
echo "  6. Options Strategy:   $OPTIONS_STRATEGY_ADDR"
echo "  7. Rebalancing Engine: $REBALANCING_ENGINE_ADDR"
echo ""
echo "🔗 Explorer:"
echo "  https://sepolia.starkscan.co/contract/$PROTOCOL_VAULT_ADDR"
echo ""

