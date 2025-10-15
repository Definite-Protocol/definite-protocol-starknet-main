#!/usr/bin/env python3
"""
Complete Protocol Deployment Script
Deploy hALGO protocol with oracle integration

Usage:
    python scripts/deploy_complete_protocol.py
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

# Import contracts
from contracts.protocol.SimpleHALGO import approval_program as halgo_approval, clear_state_program as halgo_clear
from contracts.oracles.SimplePriceOracle import approval_program as oracle_approval, clear_state_program as oracle_clear
from pyteal import compileTeal, Mode

class CompleteProtocolDeployer:
    def __init__(self, algod_client, creator_private_key):
        self.algod_client = algod_client
        self.creator_private_key = creator_private_key
        self.creator_address = account.address_from_private_key(creator_private_key)
        self.deployed_contracts = {}
        
    def compile_contract(self, name, approval_func, clear_func):
        """Compile a contract"""
        try:
            print(f"📝 Compiling {name}...")
            
            # Compile to TEAL
            approval_teal = compileTeal(approval_func(), Mode.Application, version=6)
            clear_teal = compileTeal(clear_func(), Mode.Application, version=6)
            
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
            print(f"❌ Error compiling {name}: {e}")
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
                decimals=6,
                metadata_hash=b"hALGO_v2.0_complete"[:32].ljust(32, b'\x00')
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
            
            return {
                'asset_id': asset_id,
                'tx_id': tx_id,
                'confirmed_round': confirmed_txn['confirmed-round']
            }
            
        except Exception as e:
            print(f"❌ Error creating hALGO ASA: {e}")
            raise
    
    def deploy_contract(self, name, compiled_contract, global_schema, local_schema):
        """Deploy a smart contract"""
        try:
            print(f"🚀 Deploying {name}...")
            
            # Get suggested parameters
            params = self.algod_client.suggested_params()
            
            # Create application transaction
            txn = transaction.ApplicationCreateTxn(
                sender=self.creator_address,
                sp=params,
                on_complete=transaction.OnComplete.NoOpOC,
                approval_program=compiled_contract['approval_program'],
                clear_program=compiled_contract['clear_program'],
                global_schema=global_schema,
                local_schema=local_schema
            )
            
            # Sign and send transaction
            signed_txn = txn.sign(self.creator_private_key)
            tx_id = self.algod_client.send_transaction(signed_txn)
            
            # Wait for confirmation
            confirmed_txn = self.wait_for_confirmation(tx_id)
            app_id = confirmed_txn['application-index']
            
            # Calculate app address
            import algosdk
            app_address = algosdk.logic.get_application_address(app_id)
            
            print(f"✅ {name} deployed successfully!")
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
            print(f"❌ Error deploying {name}: {e}")
            raise
    
    def fund_contract(self, app_address, amount_algo=3):
        """Fund contract with ALGO"""
        try:
            print(f"💰 Funding contract with {amount_algo} ALGO...")
            
            # Get suggested parameters
            params = self.algod_client.suggested_params()
            
            # Create payment transaction
            txn = transaction.PaymentTxn(
                sender=self.creator_address,
                sp=params,
                receiver=app_address,
                amt=amount_algo * 1000000  # Convert to microALGOs
            )
            
            # Sign and send transaction
            signed_txn = txn.sign(self.creator_private_key)
            tx_id = self.algod_client.send_transaction(signed_txn)
            
            # Wait for confirmation
            confirmed_txn = self.wait_for_confirmation(tx_id)
            
            print(f"✅ Contract funded successfully!")
            print(f"   Transaction ID: {tx_id}")
            
            return tx_id
            
        except Exception as e:
            print(f"❌ Error funding contract: {e}")
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
    
    def deploy_complete_protocol(self):
        """Deploy complete protocol with oracle"""
        try:
            print("🚀 Starting Complete hALGO Protocol Deployment")
            print("=" * 80)
            
            # 1. Create hALGO ASA
            halgo_asset = self.create_halgo_asset()
            self.deployed_contracts['halgo_asset'] = halgo_asset
            
            # 2. Compile and deploy Price Oracle
            oracle_compiled = self.compile_contract("Price Oracle", oracle_approval, oracle_clear)
            oracle_contract = self.deploy_contract(
                "Price Oracle",
                oracle_compiled,
                transaction.StateSchema(num_uints=10, num_byte_slices=10),
                transaction.StateSchema(num_uints=5, num_byte_slices=5)
            )
            self.deployed_contracts['price_oracle'] = oracle_contract
            
            # 3. Compile and deploy Main Protocol
            halgo_compiled = self.compile_contract("Main Protocol", halgo_approval, halgo_clear)
            main_contract = self.deploy_contract(
                "Main Protocol",
                halgo_compiled,
                transaction.StateSchema(num_uints=15, num_byte_slices=10),
                transaction.StateSchema(num_uints=10, num_byte_slices=5)
            )
            self.deployed_contracts['main_protocol'] = main_contract
            
            # 4. Fund both contracts
            oracle_funding = self.fund_contract(oracle_contract['app_address'], 2)
            main_funding = self.fund_contract(main_contract['app_address'], 3)
            
            self.deployed_contracts['funding'] = {
                'oracle_funding_tx': oracle_funding,
                'main_funding_tx': main_funding
            }
            
            print("\n🎉 Complete Protocol Deployment Successful!")
            print("\n📋 Deployment Summary:")
            print(f"   hALGO Asset ID: {halgo_asset['asset_id']}")
            print(f"   Price Oracle App ID: {oracle_contract['app_id']}")
            print(f"   Main Protocol App ID: {main_contract['app_id']}")
            print(f"   Total Deployment Cost: ~3 ALGO")
            
            return self.deployed_contracts
            
        except Exception as e:
            print(f"❌ Complete protocol deployment failed: {e}")
            raise

def main():
    """Main deployment function"""
    print("🚀 Complete hALGO Protocol Deployer")
    print("=" * 50)
    
    # Configuration
    algod_endpoint = "https://testnet-api.algonode.cloud"
    algod_token = ""
    creator_mnemonic = "under rule apple injury urban bread obey mango inmate diagram width basic citizen able success gadget matter flag wage anchor glide girl faint able loan"
    
    try:
        # Initialize Algod client
        algod_client = algod.AlgodClient(algod_token, algod_endpoint)
        
        # Test connection
        status = algod_client.status()
        print(f"✅ Connected to Algorand testnet")
        print(f"   Last round: {status['last-round']}")
        
        # Initialize deployer
        creator_private_key = mnemonic.to_private_key(creator_mnemonic)
        deployer = CompleteProtocolDeployer(algod_client, creator_private_key)
        
        print(f"   Creator address: {deployer.creator_address}")
        
        # Check creator balance
        account_info = algod_client.account_info(deployer.creator_address)
        balance = account_info['amount'] / 1_000_000
        print(f"   Creator balance: {balance:.6f} ALGO")
        
        if balance < 5:
            print("⚠️  Warning: Low balance. Need at least 5 ALGO for complete deployment.")
            return False
        
        # Deploy complete protocol
        deployed_contracts = deployer.deploy_complete_protocol()
        
        # Save comprehensive deployment info
        frontend_deployment = {
            'timestamp': int(time.time()),
            'network': 'testnet',
            'creator_address': deployer.creator_address,
            'contracts': {
                'halgo_asset_id': deployed_contracts['halgo_asset']['asset_id'],
                'price_oracle': deployed_contracts['price_oracle'],
                'main_protocol': deployed_contracts['main_protocol'],
                'halgo_asset': deployed_contracts['halgo_asset'],
                'funding': deployed_contracts['funding']
            },
            'status': 'deployed',
            'version': 'v2.0_complete',
            'features': [
                'mint_halgo',
                'redeem_algo',
                'price_oracle',
                'emergency_controls',
                'state_management'
            ]
        }
        
        # Save to frontend config
        frontend_file = project_root / "src" / "config" / "deployment.json"
        frontend_file.parent.mkdir(exist_ok=True)
        with open(frontend_file, 'w') as f:
            json.dump(frontend_deployment, f, indent=2)
        
        print(f"\n💾 Complete deployment config saved: {frontend_file}")
        print("\n📋 Next Steps:")
        print("1. Frontend automatically detects all deployed contracts")
        print("2. Test complete protocol with oracle integration")
        print("3. Monitor contract performance and oracle feeds")
        print("4. Verify all transactions on Algorand testnet explorer")
        
        return True
        
    except Exception as e:
        print(f"❌ Complete deployment failed: {e}")
        return False

if __name__ == "__main__":
    import algosdk
    success = main()
    sys.exit(0 if success else 1)
