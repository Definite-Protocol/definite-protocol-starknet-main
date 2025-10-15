#!/bin/bash

# Definite Protocol CLI Demo Script
# Shows the CLI capabilities with simulated interactions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PINK}🎭 Definite Protocol CLI Demo${NC}"
echo -e "${BLUE}This demo shows the CLI capabilities (simulated)${NC}"
echo ""

# Check if binary exists
BINARY="target/release/definite"
if [ ! -f "$BINARY" ]; then
    echo -e "${YELLOW}Building CLI first...${NC}"
    cargo build --release
fi

echo -e "${GREEN}✅ CLI binary ready${NC}"
echo ""

# Demo commands
echo -e "${PINK}📋 Available Commands:${NC}"
echo ""

echo -e "${YELLOW}1. User Operations:${NC}"
echo "   definite user deposit 100.0"
echo "   definite user withdraw 50.0"
echo "   definite user balance --detailed"
echo "   definite user simulate 1000.0 --days 30"
echo ""

echo -e "${YELLOW}2. Protocol Management:${NC}"
echo "   definite protocol status --detailed"
echo "   definite protocol risk --history"
echo "   definite protocol rebalance check"
echo "   definite protocol fees --breakdown"
echo ""

echo -e "${YELLOW}3. Analytics:${NC}"
echo "   definite analytics performance --period 30"
echo "   definite analytics portfolio --risk"
echo "   definite analytics yield --benchmark"
echo "   definite analytics metrics --live"
echo ""

echo -e "${YELLOW}4. Development:${NC}"
echo "   definite dev test --coverage"
echo "   definite dev build --mode release"
echo "   definite dev docs --format html"
echo "   definite dev lint --fix"
echo ""

echo -e "${YELLOW}5. Configuration:${NC}"
echo "   definite config init --template mainnet"
echo "   definite config show"
echo "   definite config validate"
echo ""

# Show help
echo -e "${PINK}📖 Getting Help:${NC}"
echo "   definite --help"
echo "   definite user --help"
echo "   definite protocol status --help"
echo ""

# Show version
echo -e "${PINK}🔍 Version Information:${NC}"
if [ -f "$BINARY" ]; then
    ./"$BINARY" --version 2>/dev/null || echo "   definite 1.0.0"
else
    echo "   definite 1.0.0"
fi
echo ""

echo -e "${GREEN}🚀 To get started:${NC}"
echo "1. Build: cargo build --release"
echo "2. Install: ./install.sh"
echo "3. Configure: definite config init"
echo "4. Use: definite protocol status"
echo ""

echo -e "${BLUE}📚 For full documentation, see README.md${NC}"
