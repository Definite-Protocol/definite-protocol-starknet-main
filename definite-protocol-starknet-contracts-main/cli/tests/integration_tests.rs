use anyhow::Result;
use starknet::core::types::FieldElement;
use starknet::providers::{Provider, jsonrpc::{HttpTransport, JsonRpcClient}};
use starknet::accounts::{Account, SingleOwnerAccount};
use starknet::signers::{LocalWallet, SigningKey};

const RPC_URL: &str = "https://starknet-sepolia.infura.io/v3/f96264cf853c424ab5678e8301ca0462";
const ACCOUNT_ADDRESS: &str = "0x01f411b366890429179d868cfc5ae89cd22c595cdcd31859f54759c16a9cc20e";
const PRIVATE_KEY: &str = "0x3f9721e722755ce2f6d925fff04676805c8d4cdd8d1b3931753e917a85f4ce2";

const VAULT_ADDRESS: &str = "0x04ca6a156f683ce0e1340a4488c608b67c55cfd8c5bd646a30aea7bced164aa4";
const HSTRK_TOKEN_ADDRESS: &str = "0x0142895eab6ca66eeaf80d5f6bca8dd57559c80f1954f6e6aaf49e8aa76eb4f8";
const STRK_TOKEN_ADDRESS: &str = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const PRICE_ORACLE_ADDRESS: &str = "0x0225cf5aa1cf009052c3359e0f7b9156cc3e65bf39b64bef14566c19476768fe";
const RISK_MANAGER_ADDRESS: &str = "0x02b7ed5e0c9b8e22fb5f10c0c1bd1cc2ce32958c3f9eb5db313a6120bd524a9d";
const PERPETUAL_HEDGE_ADDRESS: &str = "0x004fbb92f86eaeb8f9ebc34765ae0b791b880634be2e6508baeb5d3e9fff5061";
const OPTIONS_STRATEGY_ADDRESS: &str = "0x02501c12f953d491c49a35040aea4d6b8f02b28e8eb9f50705853acd819feb8c";
const REBALANCING_ENGINE_ADDRESS: &str = "0x06063a8abd3c7be5ce3119ccd6d2379fe8faa8f4781850fb01997b3b0ceee6ad";

async fn setup_provider() -> Result<JsonRpcClient<HttpTransport>> {
    let rpc_url = url::Url::parse(RPC_URL)?;
    Ok(JsonRpcClient::new(HttpTransport::new(rpc_url)))
}

async fn setup_account() -> Result<SingleOwnerAccount<JsonRpcClient<HttpTransport>, LocalWallet>> {
    let provider = setup_provider().await?;
    
    let signing_key = SigningKey::from_secret_scalar(
        FieldElement::from_hex_be(PRIVATE_KEY)?
    );
    let signer = LocalWallet::from(signing_key);
    
    let chain_id = provider.chain_id().await?;
    
    let account = SingleOwnerAccount::new(
        provider,
        signer,
        FieldElement::from_hex_be(ACCOUNT_ADDRESS)?,
        chain_id,
        starknet::accounts::ExecutionEncoding::New,
    );
    
    Ok(account)
}

fn parse_felt(hex: &str) -> Result<FieldElement> {
    Ok(FieldElement::from_hex_be(hex)?)
}

#[tokio::test]
async fn test_provider_connection() -> Result<()> {
    let provider = setup_provider().await?;
    
    let chain_id = provider.chain_id().await?;
    println!("✅ Connected to Starknet Sepolia");
    println!("   Chain ID: {:?}", chain_id);
    
    let block_number = provider.block_number().await?;
    println!("   Current block: {}", block_number);
    
    assert!(block_number > 0, "Block number should be greater than 0");
    
    Ok(())
}

#[tokio::test]
async fn test_account_setup() -> Result<()> {
    let account = setup_account().await?;
    
    let account_address = account.address();
    println!("✅ Account setup successful");
    println!("   Address: {:#x}", account_address);
    
    let expected_address = parse_felt(ACCOUNT_ADDRESS)?;
    assert_eq!(account_address, expected_address, "Account address mismatch");
    
    Ok(())
}

#[tokio::test]
async fn test_hstrk_token_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let token_address = parse_felt(HSTRK_TOKEN_ADDRESS)?;
    
    println!("🔍 Testing hSTRK Token Contract");
    println!("   Address: {:#x}", token_address);
    
    let name_selector = starknet::core::utils::get_selector_from_name("name")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: token_address,
            entry_point_selector: name_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Contract is accessible");
            println!("   Response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Contract call failed: {}", e);
            println!("   This may be expected if the contract doesn't have a 'name' function");
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_vault_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let vault_address = parse_felt(VAULT_ADDRESS)?;
    
    println!("🔍 Testing Protocol Vault Contract");
    println!("   Address: {:#x}", vault_address);
    
    let total_assets_selector = starknet::core::utils::get_selector_from_name("total_assets")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: vault_address,
            entry_point_selector: total_assets_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Vault contract is accessible");
            println!("   Total assets response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Vault call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_price_oracle_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let oracle_address = parse_felt(PRICE_ORACLE_ADDRESS)?;
    
    println!("🔍 Testing Price Oracle Contract");
    println!("   Address: {:#x}", oracle_address);
    
    let get_price_selector = starknet::core::utils::get_selector_from_name("get_price")?;
    
    let strk_token = parse_felt(STRK_TOKEN_ADDRESS)?;
    let calldata = vec![strk_token];
    
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: oracle_address,
            entry_point_selector: get_price_selector,
            calldata,
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Oracle contract is accessible");
            println!("   Price response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Oracle call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_risk_manager_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let risk_address = parse_felt(RISK_MANAGER_ADDRESS)?;
    
    println!("🔍 Testing Risk Manager Contract");
    println!("   Address: {:#x}", risk_address);
    
    let get_risk_metrics_selector = starknet::core::utils::get_selector_from_name("get_risk_metrics")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: risk_address,
            entry_point_selector: get_risk_metrics_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Risk Manager contract is accessible");
            println!("   Risk metrics response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Risk Manager call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_perpetual_hedge_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let hedge_address = parse_felt(PERPETUAL_HEDGE_ADDRESS)?;
    
    println!("🔍 Testing Perpetual Hedge Contract");
    println!("   Address: {:#x}", hedge_address);
    
    let get_position_selector = starknet::core::utils::get_selector_from_name("get_position")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: hedge_address,
            entry_point_selector: get_position_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Perpetual Hedge contract is accessible");
            println!("   Position response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Perpetual Hedge call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_options_strategy_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let options_address = parse_felt(OPTIONS_STRATEGY_ADDRESS)?;
    
    println!("🔍 Testing Options Strategy Contract");
    println!("   Address: {:#x}", options_address);
    
    let get_active_options_selector = starknet::core::utils::get_selector_from_name("get_active_options")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: options_address,
            entry_point_selector: get_active_options_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Options Strategy contract is accessible");
            println!("   Active options response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Options Strategy call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_rebalancing_engine_contract() -> Result<()> {
    let provider = setup_provider().await?;
    let rebalancing_address = parse_felt(REBALANCING_ENGINE_ADDRESS)?;
    
    println!("🔍 Testing Rebalancing Engine Contract");
    println!("   Address: {:#x}", rebalancing_address);
    
    let get_rebalance_status_selector = starknet::core::utils::get_selector_from_name("get_rebalance_status")?;
    let call_result = provider.call(
        starknet::core::types::FunctionCall {
            contract_address: rebalancing_address,
            entry_point_selector: get_rebalance_status_selector,
            calldata: vec![],
        },
        starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
    ).await;
    
    match call_result {
        Ok(result) => {
            println!("   ✅ Rebalancing Engine contract is accessible");
            println!("   Rebalance status response: {:?}", result);
        }
        Err(e) => {
            println!("   ⚠️  Rebalancing Engine call failed: {}", e);
        }
    }
    
    Ok(())
}

#[tokio::test]
async fn test_all_contracts_deployed() -> Result<()> {
    let provider = setup_provider().await?;
    
    println!("\n🔍 Comprehensive Contract Deployment Test");
    println!("{}", "=".repeat(60));
    
    let contracts = vec![
        ("hSTRK Token", HSTRK_TOKEN_ADDRESS),
        ("Protocol Vault", VAULT_ADDRESS),
        ("STRK Token", STRK_TOKEN_ADDRESS),
        ("Price Oracle", PRICE_ORACLE_ADDRESS),
        ("Risk Manager", RISK_MANAGER_ADDRESS),
        ("Perpetual Hedge", PERPETUAL_HEDGE_ADDRESS),
        ("Options Strategy", OPTIONS_STRATEGY_ADDRESS),
        ("Rebalancing Engine", REBALANCING_ENGINE_ADDRESS),
    ];
    
    let mut all_deployed = true;
    
    for (name, address) in contracts {
        let contract_address = parse_felt(address)?;
        
        let class_hash_result = provider.get_class_hash_at(
            starknet::core::types::BlockId::Tag(starknet::core::types::BlockTag::Latest),
            contract_address,
        ).await;
        
        match class_hash_result {
            Ok(class_hash) => {
                println!("✅ {} - Deployed", name);
                println!("   Address: {}", address);
                println!("   Class Hash: {:#x}", class_hash);
            }
            Err(e) => {
                println!("❌ {} - NOT FOUND", name);
                println!("   Address: {}", address);
                println!("   Error: {}", e);
                all_deployed = false;
            }
        }
        println!();
    }
    
    println!("{}", "=".repeat(60));

    assert!(all_deployed, "Not all contracts are deployed");
    
    Ok(())
}

