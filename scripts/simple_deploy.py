#!/usr/bin/env python3
"""Simple deployment script for hSTRK Token and Vault"""

import asyncio
import json
from pathlib import Path
from starknet_py.net.account.account import Account
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.models import StarknetChainId
from starknet_py.net.signer.stark_curve_signer import KeyPair
from starknet_py.hash.selector import get_selector_from_name
from starknet_py.hash.address import compute_address
from starknet_py.hash.class_hash import compute_class_hash

# Config
DEPLOYER_ADDRESS = 0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5
DEPLOYER_PRIVATE_KEY = 0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4
RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/tnhhH9UGXWm8Gji-k4G3Yxv6VcQZjwYK"
STRK_TOKEN = 0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D
UDC_ADDRESS = 0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf

async def main():
    print("🚀 Deploying Definite Protocol Contracts")
    print("=" * 50)
    
    # Initialize
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
    
    # Load contracts
    base_path = Path("contracts/cairo/target/dev")
    
    # 1. Deploy hSTRK Token
    print("📤 Deploying hSTRK Token...")
    with open(base_path / "definite_protocol_hSTRKToken.contract_class.json") as f:
        hstrk_sierra = json.load(f)
    with open(base_path / "definite_protocol_hSTRKToken.compiled_contract_class.json") as f:
        hstrk_casm = json.load(f)
    
    # Declare
    try:
        # Read CASM hash from compiled file
        casm_class_hash = int(hstrk_casm, 16)

        declare_tx = await account.sign_declare_v2(
            compiled_contract=hstrk_sierra,
            compiled_class_hash=casm_class_hash,
            max_fee=int(1e16)
        )
        await account.client.wait_for_tx(declare_tx.transaction_hash)
        hstrk_class_hash = declare_tx.class_hash
        print(f"  Declared: {hex(hstrk_class_hash)}")
    except Exception as e:
        if "already" in str(e).lower():
            print(f"  Already declared")
            # Use a known class hash or calculate from sierra
            from starknet_py.hash.sierra_class_hash import compute_sierra_class_hash
            hstrk_class_hash = compute_sierra_class_hash(hstrk_sierra)
            print(f"  Using class hash: {hex(hstrk_class_hash)}")
        else:
            raise e
    
    # Deploy via UDC
    salt = 0
    unique = 0
    constructor_calldata = [DEPLOYER_ADDRESS]
    
    deploy_call = {
        "contract_address": UDC_ADDRESS,
        "entry_point_selector": get_selector_from_name("deployContract"),
        "calldata": [
            hstrk_class_hash,
            salt,
            unique,
            len(constructor_calldata),
            *constructor_calldata
        ]
    }
    
    deploy_tx = await account.execute(calls=[deploy_call], max_fee=int(1e16))
    await account.client.wait_for_tx(deploy_tx.transaction_hash)
    
    # Calculate address
    hstrk_address = compute_address(
        salt=salt,
        class_hash=hstrk_class_hash,
        constructor_calldata=constructor_calldata,
        deployer_address=0 if unique == 0 else DEPLOYER_ADDRESS
    )
    
    print(f"  ✅ hSTRK Token: {hex(hstrk_address)}")
    print()
    
    # 2. Deploy Price Oracle
    print("📤 Deploying Price Oracle...")
    with open(base_path / "definite_protocol_PriceOracle.contract_class.json") as f:
        oracle_sierra = json.load(f)
    with open(base_path / "definite_protocol_PriceOracle.compiled_contract_class.json") as f:
        oracle_casm = json.load(f)
    
    try:
        casm_class_hash = int(oracle_casm, 16)

        declare_tx = await account.sign_declare_v2(
            compiled_contract=oracle_sierra,
            compiled_class_hash=casm_class_hash,
            max_fee=int(1e16)
        )
        await account.client.wait_for_tx(declare_tx.transaction_hash)
        oracle_class_hash = declare_tx.class_hash
        print(f"  Declared: {hex(oracle_class_hash)}")
    except Exception as e:
        if "already" in str(e).lower():
            print(f"  Already declared")
            from starknet_py.hash.sierra_class_hash import compute_sierra_class_hash
            oracle_class_hash = compute_sierra_class_hash(oracle_sierra)
            print(f"  Using class hash: {hex(oracle_class_hash)}")
        else:
            raise e
    
    constructor_calldata = [DEPLOYER_ADDRESS]
    deploy_call = {
        "contract_address": UDC_ADDRESS,
        "entry_point_selector": get_selector_from_name("deployContract"),
        "calldata": [
            oracle_class_hash,
            salt,
            unique,
            len(constructor_calldata),
            *constructor_calldata
        ]
    }
    
    deploy_tx = await account.execute(calls=[deploy_call], max_fee=int(1e16))
    await account.client.wait_for_tx(deploy_tx.transaction_hash)
    
    oracle_address = compute_address(
        salt=salt,
        class_hash=oracle_class_hash,
        constructor_calldata=constructor_calldata,
        deployer_address=0 if unique == 0 else DEPLOYER_ADDRESS
    )
    
    print(f"  ✅ Price Oracle: {hex(oracle_address)}")
    print()
    
    # 3. Deploy Protocol Vault
    print("📤 Deploying Protocol Vault...")
    with open(base_path / "definite_protocol_ProtocolVault.contract_class.json") as f:
        vault_sierra = json.load(f)
    with open(base_path / "definite_protocol_ProtocolVault.compiled_contract_class.json") as f:
        vault_casm = json.load(f)
    
    try:
        casm_class_hash = int(vault_casm, 16)

        declare_tx = await account.sign_declare_v2(
            compiled_contract=vault_sierra,
            compiled_class_hash=casm_class_hash,
            max_fee=int(1e16)
        )
        await account.client.wait_for_tx(declare_tx.transaction_hash)
        vault_class_hash = declare_tx.class_hash
        print(f"  Declared: {hex(vault_class_hash)}")
    except Exception as e:
        if "already" in str(e).lower():
            print(f"  Already declared")
            from starknet_py.hash.sierra_class_hash import compute_sierra_class_hash
            vault_class_hash = compute_sierra_class_hash(vault_sierra)
            print(f"  Using class hash: {hex(vault_class_hash)}")
        else:
            raise e
    
    constructor_calldata = [DEPLOYER_ADDRESS, STRK_TOKEN, hstrk_address, oracle_address]
    deploy_call = {
        "contract_address": UDC_ADDRESS,
        "entry_point_selector": get_selector_from_name("deployContract"),
        "calldata": [
            vault_class_hash,
            salt,
            unique,
            len(constructor_calldata),
            *constructor_calldata
        ]
    }
    
    deploy_tx = await account.execute(calls=[deploy_call], max_fee=int(1e16))
    await account.client.wait_for_tx(deploy_tx.transaction_hash)
    
    vault_address = compute_address(
        salt=salt,
        class_hash=vault_class_hash,
        constructor_calldata=constructor_calldata,
        deployer_address=0 if unique == 0 else DEPLOYER_ADDRESS
    )
    
    print(f"  ✅ Protocol Vault: {hex(vault_address)}")
    print()
    
    # 4. Configure hSTRK Token
    print("⚙️  Configuring hSTRK Token...")
    config_call = {
        "contract_address": hstrk_address,
        "entry_point_selector": get_selector_from_name("set_protocol_vault"),
        "calldata": [vault_address]
    }
    
    config_tx = await account.execute(calls=[config_call], max_fee=int(1e16))
    await account.client.wait_for_tx(config_tx.transaction_hash)
    print("  ✅ Configured")
    print()
    
    # Save results
    result = {
        "timestamp": int(asyncio.get_event_loop().time()),
        "network": "sepolia",
        "deployer": hex(DEPLOYER_ADDRESS),
        "contracts": {
            "hstrkToken": hex(hstrk_address),
            "priceOracle": hex(oracle_address),
            "protocolVault": hex(vault_address)
        }
    }
    
    with open("deployment-result.json", "w") as f:
        json.dump(result, f, indent=2)
    
    print("🎉 Deployment Complete!")
    print(f"  hSTRK Token:    {hex(hstrk_address)}")
    print(f"  Price Oracle:   {hex(oracle_address)}")
    print(f"  Protocol Vault: {hex(vault_address)}")
    print()
    print("📄 Saved to: deployment-result.json")

if __name__ == "__main__":
    asyncio.run(main())

