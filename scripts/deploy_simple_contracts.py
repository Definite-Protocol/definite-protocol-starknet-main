#!/usr/bin/env python3
"""
Simple Contract Deployment Script for hALGO Protocol
Deploy working contracts to Algorand testnet

Usage:
    python scripts/deploy_simple_contracts.py
"""

import os
import sys
import json
import time
from pathlib import Path
from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import simple contract
from contracts.protocol.SimpleHALGO import approval_program, clear_state_program
from pyteal import compileTeal, Mode

class SimpleContractDeployer:
    def __init__(self, algod_client, creator_private_key):
        self.algod_client = algod_client
        self.creator_private_key = creator_private_key
        self.creator_address = account.address_from_private_key(creator_private_key)
        self.deployed_contracts = {}
        
    def compile_contract(self):
        """Compile the simple hALGO contract"""
        try:
            print("📝 Compiling Simple hALGO Contract...")

            # Compile to TEAL
            approval_teal = compileTeal(approval_program(), Mode.Application, version=6)
            clear_teal = compileTeal(clear_state_program(), Mode.Application, version=6)

            # Compile TEAL to bytecode
            approval_result = self.algod_client.compile(approval_teal)
            clear_result = self.algod_client.compile(clear_teal)

            # Convert base64 to bytes
            import base64
            approval_bytecode = base64.b64decode(approval_result['result'])
            clear_bytecode = base64.b64decode(clear_result['result'])

            return {
                'approval_program': approval_bytecode,
                'clear_program': clear_bytecode,
                'approval_teal': approval_teal,
                'clear_teal': clear_teal
            }

        except Exception as e:
            print(f"❌ Error compiling contract: {e}")
            raise
    
    def create_halgo_asset(self):
        """Create hALGO ASA token"""
        try:
            print("🪙 Creating hALGO ASA token...")
            
            # Get suggested parameters
            params = self.algod_client.suggested_params()
            
            # Create ASA transaction
            txn = transaction.AssetConfigTxn(
                sender=self.creator_address,
                sp=params,
                total=1000000000000000,  # 1 billion tokens with 6 decimals
                default_frozen=False,
                unit_name="hALGO",
                asset_name="Hedged ALGO",
                manager=self.creator_address,
                reserve=self.creator_address,
                freeze=self.creator_address,
                clawback=self.creator_address,
                url="https://definite-protocol.com/halgo",
                decimals=6
            )
            
            # Sign and send transaction
            signed_txn = txn.sign(self.creator_private_key)
            tx_id = self.algod_client.send_transaction(signed_txn)
            
            # Wait for confirmation
            confirmed_txn = self.wait_for_confirmation(tx_id)
            asset_id = confirmed_txn['asset-index']
            
            print(f"✅ hALGO ASA created successfully!")
            print(f"   Asset ID: {asset_id}")
            print(f"   Transaction ID: {tx_id}")
            
            return asset_id
            
        except Exception as e:
            print(f"❌ Error creating hALGO ASA: {e}")
            raise
    
    def deploy_contract(self, compiled_contract):
        """Deploy the smart contract"""
        try:
            print("🚀 Deploying Simple hALGO Contract...")
            
            # Get suggested parameters
            params = self.algod_client.suggested_params()
            
            # Create application transaction
            txn = transaction.ApplicationCreateTxn(
                sender=self.creator_address,
                sp=params,
                on_complete=transaction.OnComplete.NoOpOC,
                approval_program=compiled_contract['approval_program'],
                clear_program=compiled_contract['clear_program'],
                global_schema=transaction.StateSchema(num_uints=10, num_byte_slices=10),
                local_schema=transaction.StateSchema(num_uints=5, num_byte_slices=5)
            )
            
            # Sign and send transaction
            signed_txn = txn.sign(self.creator_private_key)
            tx_id = self.algod_client.send_transaction(signed_txn)
            
            # Wait for confirmation
            confirmed_txn = self.wait_for_confirmation(tx_id)
            app_id = confirmed_txn['application-index']
            app_address = algosdk.logic.get_application_address(app_id)
            
            print(f"✅ Simple hALGO Contract deployed successfully!")
            print(f"   App ID: {app_id}")
            print(f"   App Address: {app_address}")
            print(f"   Transaction ID: {tx_id}")
            
            return {
                'app_id': app_id,
                'app_address': app_address,
                'tx_id': tx_id,
                'confirmed_round': confirmed_txn['confirmed-round']
            }
            
        except Exception as e:
            print(f"❌ Error deploying contract: {e}")
            raise
    
    def wait_for_confirmation(self, tx_id, timeout=10):
        """Wait for transaction confirmation"""
        start_round = self.algod_client.status()['last-round'] + 1
        current_round = start_round
        
        while current_round < start_round + timeout:
            try:
                pending_txn = self.algod_client.pending_transaction_info(tx_id)
                if pending_txn.get('confirmed-round', 0) > 0:
                    return pending_txn
                elif pending_txn['pool-error']:
                    raise Exception(f'Pool error: {pending_txn["pool-error"]}')
            except Exception:
                pass
            
            self.algod_client.status_after_block(current_round)
            current_round += 1
        
        raise Exception(f'Transaction {tx_id} not confirmed after {timeout} rounds')
    
    def deploy_all(self):
        """Deploy all components"""
        try:
            print("🚀 Starting Simple hALGO Protocol Deployment")
            print("=" * 60)
            
            # 1. Create hALGO ASA
            halgo_asset_id = self.create_halgo_asset()
            self.deployed_contracts['halgo_asset_id'] = halgo_asset_id
            
            # 2. Compile contract
            compiled_contract = self.compile_contract()
            
            # 3. Deploy contract
            contract_deployment = self.deploy_contract(compiled_contract)
            self.deployed_contracts['main_contract'] = contract_deployment
            
            print("\n🎉 Deployment completed successfully!")
            print("\n📋 Deployment Summary:")
            print(f"   hALGO Asset ID: {halgo_asset_id}")
            print(f"   Contract App ID: {contract_deployment['app_id']}")
            print(f"   Contract Address: {contract_deployment['app_address']}")
            
            return self.deployed_contracts
            
        except Exception as e:
            print(f"❌ Deployment failed: {e}")
            raise

def main():
    """Main deployment function"""
    print("🚀 Simple hALGO Protocol Deployer")
    print("=" * 50)
    
    # Configuration
    algod_endpoint = "https://testnet-api.algonode.cloud"
    algod_token = ""
    # Use generated deployment account
    creator_mnemonic = "under rule apple injury urban bread obey mango inmate diagram width basic citizen able success gadget matter flag wage anchor glide girl faint able loan"

    # Validate mnemonic
    mnemonic_words = creator_mnemonic.split()
    print(f"📝 Mnemonic validation: {len(mnemonic_words)} words")

    # Handle 24-word mnemonic (add checksum word)
    if len(mnemonic_words) == 24:
        print("⚠️  24-word mnemonic detected. This might be a Bitcoin/Ethereum mnemonic.")
        print("   Algorand requires 25-word mnemonics.")
        print("   Please provide your complete 25-word Algorand mnemonic.")
        return False
    elif len(mnemonic_words) != 25:
        print(f"❌ Invalid mnemonic: Expected 25 words, got {len(mnemonic_words)}")
        return False
    
    try:
        # Initialize Algod client
        algod_client = algod.AlgodClient(algod_token, algod_endpoint)
        
        # Test connection
        status = algod_client.status()
        print(f"✅ Connected to Algorand testnet")
        print(f"   Last round: {status['last-round']}")
        
        # Initialize deployer
        creator_private_key = mnemonic.to_private_key(creator_mnemonic)
        deployer = SimpleContractDeployer(algod_client, creator_private_key)
        
        print(f"   Creator address: {deployer.creator_address}")
        
        # Check creator balance
        account_info = algod_client.account_info(deployer.creator_address)
        balance = account_info['amount'] / 1_000_000
        print(f"   Creator balance: {balance:.6f} ALGO")
        
        if balance < 2:
            print("❌ Error: Insufficient balance. Need at least 2 ALGO for deployment.")
            print("   Please fund the account and try again.")
            return False
        elif balance < 5:
            print("⚠️  Warning: Low balance. Deployment may fail if balance is insufficient.")
            print("   Continuing with deployment...")
        
        # Deploy contracts
        deployed_contracts = deployer.deploy_all()
        
        # Save deployment info for frontend integration
        frontend_deployment = {
            'timestamp': int(time.time()),
            'network': 'testnet',
            'creator_address': deployer.creator_address,
            'contracts': deployed_contracts,
            'status': 'deployed'
        }
        
        # Save to frontend config
        frontend_file = project_root / "src" / "config" / "deployment.json"
        frontend_file.parent.mkdir(exist_ok=True)
        with open(frontend_file, 'w') as f:
            json.dump(frontend_deployment, f, indent=2)
        
        print(f"\n💾 Frontend deployment config saved: {frontend_file}")
        print("\n📋 Next Steps:")
        print("1. Frontend will automatically detect deployed contracts")
        print("2. Test minting on the UI")
        print("3. Monitor contract performance")
        
        return True
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        return False

if __name__ == "__main__":
    import algosdk
    success = main()
    sys.exit(0 if success else 1)
