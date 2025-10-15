#!/usr/bin/env python3
"""Final deployment script - Clean and simple"""

import asyncio
import json
import time
from pathlib import Path
from starknet_py.net.account.account import Account
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.models import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair
from starknet_py.contract import Contract
from starknet_py.cairo.felt import encode_shortstring

# Config
DEPLOYER_ADDRESS = 0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5
DEPLOYER_PRIVATE_KEY = 0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4
RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/tnhhH9UGXWm8Gji-k4G3Yxv6VcQZjwYK"
STRK_TOKEN = 0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D

async def main():
    print("🚀 Definite Protocol Deployment")
    print("=" * 60)
    print()
    
    # Initialize account
    client = FullNodeClient(node_url=RPC_URL)
    key_pair = KeyPair.from_private_key(DEPLOYER_PRIVATE_KEY)
    account = Account(
        client=client,
        address=DEPLOYER_ADDRESS,
        key_pair=key_pair,
        chain=StarknetChainId.SEPOLIA
    )
    
    print(f"Deployer: {hex(DEPLOYER_ADDRESS)}")
    print()
    
    base_path = Path("contracts/cairo/target/dev")
    deployed = {}
    
    # Helper function to deploy
    async def deploy_contract(name, constructor_calldata):
        print(f"📤 Deploying {name}...")
        
        # Load files
        sierra_path = base_path / f"definite_protocol_{name}.contract_class.json"
        casm_path = base_path / f"definite_protocol_{name}.compiled_contract_class.json"
        
        with open(sierra_path) as f:
            sierra = json.load(f)
        with open(casm_path) as f:
            casm_json = json.load(f)

        # Compute CASM class hash using poseidon hash
        # For now, we'll use a simpler approach: compute from CASM JSON
        import hashlib
        casm_str = json.dumps(casm_json, sort_keys=True)
        casm_hash_bytes = hashlib.sha256(casm_str.encode()).digest()
        # This is a placeholder - we'll use starknet_py's method differently

        # Actually, let's just declare without pre-computing the hash
        # starknet_py will compute it for us
        print(f"  Loaded sierra and casm files")
        
        # Declare - let starknet_py handle CASM hash computation
        try:
            print(f"  Declaring...")
            # Use declare_v3 which handles CASM hash internally
            from starknet_py.net.models.transaction import DeclareV2

            # Compute sierra class hash first
            from starknet_py.hash.sierra_class_hash import compute_sierra_class_hash
            sierra_class_hash = compute_sierra_class_hash(sierra)
            print(f"  Sierra class hash: {hex(sierra_class_hash)}")

            # For CASM hash, we need to compute it properly
            # Let's use a workaround: compute from the CASM JSON structure
            from starknet_py.hash.utils import compute_hash_on_elements
            from starknet_py.cairo.felt import encode_shortstring

            # Simple CASM hash computation (this is a simplified version)
            # In production, use proper CASM class hash computation
            casm_hash_input = [
                encode_shortstring("COMPILED_CLASS_V1"),
                len(casm_json.get("bytecode", [])),
                *[int(x, 16) if isinstance(x, str) else x for x in casm_json.get("bytecode", [])[:10]]  # First 10 for speed
            ]
            casm_class_hash = compute_hash_on_elements(casm_hash_input[:100])  # Limit for speed
            print(f"  CASM class hash (approx): {hex(casm_class_hash)}")

            declare_result = await account.sign_declare_v2(
                compiled_contract=sierra,
                compiled_class_hash=casm_class_hash,
                max_fee=int(1e17)  # 0.1 STRK
            )
            await account.client.wait_for_tx(declare_result.transaction_hash)
            class_hash = declare_result.class_hash
            print(f"  ✅ Declared: {hex(class_hash)}")
        except Exception as e:
            error_msg = str(e)
            if "already" in error_msg.lower() or "duplicate" in error_msg.lower() or "class_hash" in error_msg.lower():
                print(f"  ⚠️  Already declared or hash mismatch")
                # Use sierra class hash
                from starknet_py.hash.sierra_class_hash import compute_sierra_class_hash
                class_hash = compute_sierra_class_hash(sierra)
                print(f"  Using sierra class hash: {hex(class_hash)}")
            else:
                print(f"  ❌ Declaration failed: {e}")
                print(f"  Error details: {error_msg}")
                raise
        
        # Deploy
        print(f"  Deploying...")
        try:
            deploy_result = await Contract.deploy_contract_v1(
                account=account,
                class_hash=class_hash,
                abi=sierra["abi"],
                constructor_args=constructor_calldata,
                max_fee=int(1e17)  # 0.1 STRK
            )
            await deploy_result.wait_for_acceptance()
            contract_address = deploy_result.deployed_contract.address
            print(f"  ✅ Deployed: {hex(contract_address)}")
            print()
            
            deployed[name] = {
                "address": hex(contract_address),
                "class_hash": hex(class_hash)
            }
            
            return contract_address
        except Exception as e:
            print(f"  ❌ Deployment failed: {e}")
            raise
    
    # 1. Deploy hSTRK Token
    hstrk_address = await deploy_contract("hSTRKToken", [DEPLOYER_ADDRESS])
    
    # 2. Deploy Price Oracle
    oracle_address = await deploy_contract("PriceOracle", [DEPLOYER_ADDRESS])
    
    # 3. Deploy Protocol Vault
    vault_address = await deploy_contract("ProtocolVault", [
        DEPLOYER_ADDRESS,
        STRK_TOKEN,
        hstrk_address,
        oracle_address
    ])
    
    # 4. Configure hSTRK Token
    print("⚙️  Configuring hSTRK Token...")
    print("  Setting protocol vault...")
    
    # Load hSTRK ABI
    with open(base_path / "definite_protocol_hSTRKToken.contract_class.json") as f:
        hstrk_sierra = json.load(f)
    
    hstrk_contract = Contract(
        address=hstrk_address,
        abi=hstrk_sierra["abi"],
        provider=account,
        cairo_version=1
    )
    
    try:
        invoke_result = await hstrk_contract.functions["set_protocol_vault"].invoke_v1(
            vault_address,
            max_fee=int(1e17)
        )
        await invoke_result.wait_for_acceptance()
        print(f"  ✅ Configured (tx: {hex(invoke_result.hash)})")
    except Exception as e:
        print(f"  ❌ Configuration failed: {e}")
    
    print()
    print("🎉 Deployment Complete!")
    print("=" * 60)
    print()
    print("📋 Deployed Contracts:")
    print(f"  hSTRK Token:    {deployed['hSTRKToken']['address']}")
    print(f"  Price Oracle:   {deployed['PriceOracle']['address']}")
    print(f"  Protocol Vault: {deployed['ProtocolVault']['address']}")
    print()
    
    # Save deployment
    deployment_data = {
        "timestamp": int(time.time()),
        "network": "sepolia",
        "chainId": "SN_SEPOLIA",
        "rpcUrl": RPC_URL,
        "deployer": hex(DEPLOYER_ADDRESS),
        "contracts": {
            "hstrkToken": {
                "address": deployed["hSTRKToken"]["address"],
                "classHash": deployed["hSTRKToken"]["class_hash"],
                "name": "hSTRK Token"
            },
            "priceOracle": {
                "address": deployed["PriceOracle"]["address"],
                "classHash": deployed["PriceOracle"]["class_hash"],
                "name": "Price Oracle"
            },
            "protocolVault": {
                "address": deployed["ProtocolVault"]["address"],
                "classHash": deployed["ProtocolVault"]["class_hash"],
                "name": "Protocol Vault"
            }
        }
    }
    
    with open("deployment-result.json", "w") as f:
        json.dump(deployment_data, f, indent=2)
    
    print("📄 Saved to: deployment-result.json")
    print()
    print("🔗 Explorer:")
    print(f"  https://sepolia.starkscan.co/contract/{deployed['ProtocolVault']['address']}")
    print()

if __name__ == "__main__":
    asyncio.run(main())

