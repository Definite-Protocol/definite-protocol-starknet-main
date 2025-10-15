#!/bin/bash

# Definite Protocol Deployment Script for Starknet Sepolia Testnet
# This script deploys the hSTRK token contract to Starknet Sepolia

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NETWORK="sepolia"
RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_7"
ACCOUNT_FILE="$HOME/.starkli/account/deployer.json"
KEYSTORE_FILE="$HOME/.starkli/keystore/deployer.json"

# Contract addresses (will be updated after deployment)
OWNER_ADDRESS=""
PROTOCOL_VAULT_ADDRESS=""

echo -e "${PURPLE}🚀 Definite Protocol Deployment Script${NC}"
echo -e "${CYAN}Network: $NETWORK${NC}"
echo -e "${CYAN}RPC URL: $RPC_URL${NC}"
echo ""

# Check if starkli is installed
if ! command -v starkli &> /dev/null; then
    echo -e "${RED}❌ starkli is not installed. Please install it first:${NC}"
    echo "curl https://get.starkli.sh | sh"
    echo "starkliup"
    exit 1
fi

# Check if scarb is installed
if ! command -v scarb &> /dev/null; then
    echo -e "${RED}❌ scarb is not installed. Please install it first.${NC}"
    exit 1
fi

# Build contracts
echo -e "${YELLOW}📦 Building contracts...${NC}"
scarb build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Check if account file exists
if [ ! -f "$ACCOUNT_FILE" ]; then
    echo -e "${RED}❌ Account file not found: $ACCOUNT_FILE${NC}"
    echo -e "${YELLOW}Please create an account first:${NC}"
    echo "starkli account oz init --keystore $KEYSTORE_FILE $ACCOUNT_FILE"
    exit 1
fi

# Check if keystore file exists
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo -e "${RED}❌ Keystore file not found: $KEYSTORE_FILE${NC}"
    echo -e "${YELLOW}Please create a keystore first:${NC}"
    echo "starkli signer keystore new $KEYSTORE_FILE"
    exit 1
fi

# Get account address
ACCOUNT_ADDRESS="0x01f411b366890429179d868cfc5ae89cd22c595cdcd31859f54759c16a9cc20e"
echo -e "${BLUE}📍 Deployer account: $ACCOUNT_ADDRESS${NC}"

# Set default values if not provided
if [ -z "$OWNER_ADDRESS" ]; then
    OWNER_ADDRESS=$ACCOUNT_ADDRESS
    echo -e "${YELLOW}⚠️  Using deployer address as owner: $OWNER_ADDRESS${NC}"
fi

if [ -z "$PROTOCOL_VAULT_ADDRESS" ]; then
    # For now, use a placeholder address - this will be updated when vault is deployed
    PROTOCOL_VAULT_ADDRESS="0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
    echo -e "${YELLOW}⚠️  Using placeholder vault address: $PROTOCOL_VAULT_ADDRESS${NC}"
fi

# Deploy hSTRK Token
echo -e "${YELLOW}🪙 Deploying hSTRK Token...${NC}"

HSTRK_CLASS_HASH=$(starkli class-hash target/dev/definite_protocol_hSTRKToken.contract_class.json)
echo -e "${BLUE}Class hash: $HSTRK_CLASS_HASH${NC}"

# Declare the contract
echo -e "${YELLOW}📝 Declaring hSTRK Token contract...${NC}"
DECLARE_RESULT=$(starkli declare target/dev/definite_protocol_hSTRKToken.contract_class.json \
    --rpc $RPC_URL \
    --account $ACCOUNT_FILE \
    --keystore $KEYSTORE_FILE \
    --fee-token strk \
    --watch 2>&1)

if echo "$DECLARE_RESULT" | grep -q "error"; then
    if echo "$DECLARE_RESULT" | grep -q "already declared"; then
        echo -e "${GREEN}✅ Contract already declared${NC}"
        CLASS_HASH=$(echo "$DECLARE_RESULT" | grep -o "0x[0-9a-fA-F]*" | head -1)
    else
        echo -e "${RED}❌ Declaration failed:${NC}"
        echo "$DECLARE_RESULT"
        exit 1
    fi
else
    CLASS_HASH=$(echo "$DECLARE_RESULT" | grep "Class hash declared:" | awk '{print $4}')
    echo -e "${GREEN}✅ Contract declared with class hash: $CLASS_HASH${NC}"
fi

# Deploy the contract
echo -e "${YELLOW}🚀 Deploying hSTRK Token contract...${NC}"
DEPLOY_RESULT=$(starkli deploy $CLASS_HASH \
    $OWNER_ADDRESS \
    $PROTOCOL_VAULT_ADDRESS \
    --rpc $RPC_URL \
    --account $ACCOUNT_FILE \
    --keystore $KEYSTORE_FILE \
    --fee-token strk \
    --watch)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

HSTRK_ADDRESS=$(echo "$DEPLOY_RESULT" | grep "Contract deployed:" | awk '{print $3}')
echo -e "${GREEN}✅ hSTRK Token deployed at: $HSTRK_ADDRESS${NC}"

# Save deployment info
DEPLOYMENT_FILE="deployments/sepolia.json"
mkdir -p deployments

cat > $DEPLOYMENT_FILE << EOF
{
  "network": "$NETWORK",
  "rpc_url": "$RPC_URL",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$ACCOUNT_ADDRESS",
  "contracts": {
    "hstrk_token": {
      "address": "$HSTRK_ADDRESS",
      "class_hash": "$CLASS_HASH",
      "constructor_args": {
        "owner": "$OWNER_ADDRESS",
        "protocol_vault": "$PROTOCOL_VAULT_ADDRESS"
      }
    }
  }
}
EOF

echo -e "${GREEN}✅ Deployment info saved to: $DEPLOYMENT_FILE${NC}"

# Update CLI config
CLI_CONFIG_FILE="$HOME/.definite/config.toml"
if [ -f "$CLI_CONFIG_FILE" ]; then
    echo -e "${YELLOW}🔧 Updating CLI configuration...${NC}"
    
    # Update the config file with deployed addresses
    sed -i.bak "s/hstrk_token = \".*\"/hstrk_token = \"$HSTRK_ADDRESS\"/" "$CLI_CONFIG_FILE"
    
    echo -e "${GREEN}✅ CLI configuration updated${NC}"
else
    echo -e "${YELLOW}⚠️  CLI config file not found. Run 'definite config init' first.${NC}"
fi

echo ""
echo -e "${PURPLE}🎉 Deployment Summary${NC}"
echo -e "${CYAN}===================${NC}"
echo -e "${GREEN}✅ hSTRK Token: $HSTRK_ADDRESS${NC}"
echo -e "${BLUE}📋 Class Hash: $CLASS_HASH${NC}"
echo -e "${BLUE}👤 Owner: $OWNER_ADDRESS${NC}"
echo -e "${BLUE}🏦 Vault: $PROTOCOL_VAULT_ADDRESS${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update CLI config: definite config init"
echo "2. Test token: definite user balance"
echo "3. Deploy remaining contracts when ready"
echo ""
echo -e "${GREEN}🚀 Deployment completed successfully!${NC}"
