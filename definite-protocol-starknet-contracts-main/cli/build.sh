#!/bin/bash

# Definite Protocol CLI Build Script
# Builds the CLI with optimizations and creates distribution packages

set -e

echo "🔨 Building Definite Protocol CLI..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust/Cargo not found. Please install Rust first.${NC}"
    echo "Visit: https://rustup.rs/"
    exit 1
fi

# Check Rust version
RUST_VERSION=$(rustc --version | cut -d' ' -f2)
echo -e "${BLUE}Using Rust version: ${RUST_VERSION}${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
cargo clean

# Build in release mode
echo -e "${PINK}Building CLI in release mode...${NC}"
cargo build --release

# Check if build was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    
    # Display binary info
    BINARY_PATH="target/release/definite"
    BINARY_SIZE=$(du -h "$BINARY_PATH" | cut -f1)
    echo -e "${BLUE}Binary location: ${BINARY_PATH}${NC}"
    echo -e "${BLUE}Binary size: ${BINARY_SIZE}${NC}"
    
    # Test the binary
    echo -e "${YELLOW}Testing binary...${NC}"
    if ./"$BINARY_PATH" --version &> /dev/null; then
        echo -e "${GREEN}✅ Binary test passed${NC}"
    else
        echo -e "${RED}❌ Binary test failed${NC}"
        exit 1
    fi
    
    # Create installation script
    echo -e "${PINK}Creating installation script...${NC}"
    cat > install.sh << 'EOF'
#!/bin/bash

# Definite Protocol CLI Installation Script

set -e

INSTALL_DIR="$HOME/.local/bin"
BINARY_NAME="definite"
BINARY_PATH="target/release/definite"

echo "Installing Definite Protocol CLI..."

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Copy binary
cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "✅ Installation completed!"
echo "Binary installed to: $INSTALL_DIR/$BINARY_NAME"
echo ""
echo "Add $INSTALL_DIR to your PATH if not already added:"
echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Initialize configuration:"
echo "definite config init"
EOF
    
    chmod +x install.sh
    echo -e "${GREEN}✅ Installation script created: install.sh${NC}"
    
    # Create example configuration
    echo -e "${PINK}Creating example configuration...${NC}"
    mkdir -p examples
    cat > examples/config.example.toml << 'EOF'
# Definite Protocol CLI Configuration Example
# Copy this file to ~/.definite/config.toml and customize

rpc_url = "https://starknet-mainnet.public.blastapi.io"
account_address = "0x..."  # Your Starknet account address
private_key = "0x..."     # Your private key (keep secure!)
chain_id = "SN_MAIN"
network = "mainnet"

[contracts]
vault = "0x..."                    # Protocol Vault contract
hstrk_token = "0x..."             # hSTRK token contract
strk_token = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"  # STRK token
price_oracle = "0x..."           # Price Oracle contract
risk_manager = "0x..."           # Risk Manager contract
perpetual_hedge = "0x..."        # Perpetual Hedge contract
options_strategy = "0x..."       # Options Strategy contract
rebalancing_engine = "0x..."     # Rebalancing Engine contract

[transaction]
gas_limit = 1000000
max_fee_per_gas = "1000000000"   # 1 gwei
timeout = 300                    # 5 minutes
confirmations = 1

[display]
decimal_places = 6
use_colors = true
verbose = false
date_format = "%Y-%m-%d %H:%M:%S UTC"
EOF
    
    echo -e "${GREEN}✅ Example configuration created: examples/config.example.toml${NC}"
    
    # Display usage instructions
    echo ""
    echo -e "${PINK}🎉 Build completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Install the CLI: ./install.sh"
    echo "2. Initialize config: definite config init"
    echo "3. Check status: definite protocol status"
    echo "4. View help: definite --help"
    echo ""
    echo -e "${BLUE}For more information, see README.md${NC}"
    
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
