#!/usr/bin/env python3
"""
Contract Compilation Script for hALGO Protocol
Compiles PyTeal contracts to TEAL and prepares for deployment

Usage:
    python scripts/compile_contracts.py
"""

import os
import sys
import json
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from pyteal import compileTeal, Mode
    print("✅ PyTeal imported successfully")
except ImportError:
    print("❌ PyTeal not found. Install with: pip install pyteal")
    sys.exit(1)

# Import contract modules
try:
    from contracts.protocol.HedgedAlgoProtocol import approval_program as protocol_approval, clear_state_program as protocol_clear
    from contracts.oracles.PriceOracle import approval_program as oracle_approval, clear_state_program as oracle_clear
    from contracts.protocol.RiskManager import approval_program as risk_approval, clear_state_program as risk_clear
    from contracts.protocol.RebalanceEngine import approval_program as rebalance_approval, clear_state_program as rebalance_clear
    print("✅ All contract modules imported successfully")
except ImportError as e:
    print(f"❌ Error importing contract modules: {e}")
    sys.exit(1)

class ContractCompiler:
    def __init__(self):
        self.output_dir = project_root / "compiled_contracts"
        self.output_dir.mkdir(exist_ok=True)
        self.contracts = {}
        
    def compile_contract(self, name, approval_program, clear_program):
        """Compile a single contract to TEAL"""
        try:
            print(f"📝 Compiling {name}...")
            
            # Compile to TEAL
            approval_teal = compileTeal(approval_program(), Mode.Application, version=8)
            clear_teal = compileTeal(clear_program(), Mode.Application, version=8)
            
            # Save TEAL files
            approval_file = self.output_dir / f"{name.lower().replace(' ', '_')}_approval.teal"
            clear_file = self.output_dir / f"{name.lower().replace(' ', '_')}_clear.teal"
            
            with open(approval_file, 'w') as f:
                f.write(approval_teal)
            
            with open(clear_file, 'w') as f:
                f.write(clear_teal)
            
            # Store contract info
            self.contracts[name] = {
                'approval_file': str(approval_file),
                'clear_file': str(clear_file),
                'approval_teal': approval_teal,
                'clear_teal': clear_teal
            }
            
            print(f"✅ {name} compiled successfully")
            print(f"   Approval: {approval_file}")
            print(f"   Clear: {clear_file}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error compiling {name}: {e}")
            return False
    
    def compile_all_contracts(self):
        """Compile all protocol contracts"""
        print("🏗️  Starting contract compilation...")
        
        contracts_to_compile = [
            ("Hedged ALGO Protocol", protocol_approval, protocol_clear),
            ("Price Oracle", oracle_approval, oracle_clear),
            ("Risk Manager", risk_approval, risk_clear),
            ("Rebalance Engine", rebalance_approval, rebalance_clear)
        ]
        
        success_count = 0
        for name, approval, clear in contracts_to_compile:
            if self.compile_contract(name, approval, clear):
                success_count += 1
        
        print(f"\n📊 Compilation Summary:")
        print(f"   ✅ Successful: {success_count}/{len(contracts_to_compile)}")
        print(f"   📁 Output directory: {self.output_dir}")
        
        # Save compilation manifest
        manifest = {
            'timestamp': int(__import__('time').time()),
            'contracts': self.contracts,
            'pyteal_version': '0.24.1',  # Update as needed
            'algorand_version': 8
        }
        
        manifest_file = self.output_dir / "compilation_manifest.json"
        with open(manifest_file, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"   📋 Manifest saved: {manifest_file}")
        
        return success_count == len(contracts_to_compile)
    
    def generate_deployment_config(self):
        """Generate deployment configuration template"""
        config = {
            "network": "testnet",
            "algod_endpoint": "https://testnet-api.algonode.cloud",
            "algod_token": "",
            "creator_mnemonic": "your testnet account mnemonic here",
            "contracts": {
                "main_protocol": {
                    "name": "Hedged ALGO Protocol",
                    "global_schema": {"ints": 20, "bytes": 10},
                    "local_schema": {"ints": 15, "bytes": 10}
                },
                "price_oracle": {
                    "name": "Price Oracle",
                    "global_schema": {"ints": 10, "bytes": 10},
                    "local_schema": {"ints": 5, "bytes": 5}
                },
                "risk_manager": {
                    "name": "Risk Manager",
                    "global_schema": {"ints": 10, "bytes": 5},
                    "local_schema": {"ints": 10, "bytes": 5}
                },
                "rebalance_engine": {
                    "name": "Rebalance Engine",
                    "global_schema": {"ints": 15, "bytes": 5},
                    "local_schema": {"ints": 5, "bytes": 5}
                }
            },
            "halgo_asset": {
                "total": 1000000000000000,
                "decimals": 6,
                "unit_name": "hALGO",
                "asset_name": "Hedged ALGO",
                "url": "https://definite-protocol.com/halgo"
            }
        }
        
        config_file = self.output_dir / "deployment_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"📋 Deployment config template saved: {config_file}")
        print("⚠️  Remember to update the creator_mnemonic in the config file!")
        
        return config_file

def main():
    """Main compilation function"""
    print("🚀 hALGO Protocol Contract Compiler")
    print("=" * 50)
    
    compiler = ContractCompiler()
    
    # Compile all contracts
    if compiler.compile_all_contracts():
        print("\n🎉 All contracts compiled successfully!")
        
        # Generate deployment config
        config_file = compiler.generate_deployment_config()
        
        print("\n📋 Next Steps:")
        print("1. Update creator_mnemonic in deployment_config.json")
        print("2. Run: python scripts/deploy_contracts.py")
        print("3. Test contracts on Algorand testnet")
        
        return True
    else:
        print("\n❌ Some contracts failed to compile!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
