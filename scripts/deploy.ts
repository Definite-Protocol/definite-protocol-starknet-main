import { Account, RpcProvider, Contract, json, CallData, hash } from 'starknet';
import fs from 'fs';
import path from 'path';

// Configuration
const DEPLOYER_ADDRESS = '0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5';
const DEPLOYER_PRIVATE_KEY = '0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4';
const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/tnhhH9UGXWm8Gji-k4G3Yxv6VcQZjwYK';
const STRK_TOKEN_ADDRESS = '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D';

const CONTRACT_DIR = 'contracts/cairo/target/dev';

async function main() {
  console.log('🚀 Definite Protocol Deployment');
  console.log('='.repeat(60));
  console.log();

  // Initialize provider and account
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  console.log(`Deployer: ${DEPLOYER_ADDRESS}`);
  console.log();

  const deployed: Record<string, { address: string; classHash: string }> = {};

  // Helper function to deploy a contract
  async function deployContract(
    name: string,
    constructorCalldata: any[]
  ): Promise<string> {
    console.log(`📤 Deploying ${name}...`);

    // Load contract files
    const sierraPath = path.join(CONTRACT_DIR, `definite_protocol_${name}.contract_class.json`);
    const casmPath = path.join(CONTRACT_DIR, `definite_protocol_${name}.compiled_contract_class.json`);

    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

    try {
      // Declare contract
      console.log('  Declaring...');
      let classHash: string;

      try {
        const declareResponse = await account.declare({
          contract: sierra,
          casm
        });
        classHash = declareResponse.class_hash;
        console.log(`  ✅ Declared: ${classHash}`);

        // Wait for declare transaction
        await provider.waitForTransaction(declareResponse.transaction_hash);
        console.log(`  ✅ Declare confirmed`);
      } catch (declareError: any) {
        if (declareError.message.includes('already declared')) {
          // Extract class hash from sierra
          const { hash } = await provider.getClassHashAt(sierra);
          classHash = hash;
          console.log(`  ⚠️  Already declared: ${classHash}`);
        } else {
          throw declareError;
        }
      }

      // Deploy contract using UDC
      console.log('  Deploying...');
      const UDC_ADDRESS = '0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf';

      const deployCall = {
        contractAddress: UDC_ADDRESS,
        entrypoint: 'deployContract',
        calldata: CallData.compile({
          classHash,
          salt: '0x0',
          unique: false,
          calldata: constructorCalldata
        })
      };

      const { transaction_hash } = await account.execute(deployCall);
      await provider.waitForTransaction(transaction_hash);

      // Calculate contract address
      const { calculateContractAddressFromHash } = await import('starknet');
      const contractAddress = calculateContractAddressFromHash(
        '0x0', // salt
        classHash,
        constructorCalldata,
        0 // deployer (UDC)
      );

      console.log(`  ✅ Deployed: ${contractAddress}`);
      console.log();

      deployed[name] = {
        address: contractAddress,
        classHash
      };

      return contractAddress;
    } catch (error: any) {
      console.error(`  ❌ Deployment failed: ${error.message}`);
      throw error;
    }
  }

  try {
    // 1. Deploy hSTRK Token
    const hstrkAddress = await deployContract('hSTRKToken', [DEPLOYER_ADDRESS]);

    // 2. Deploy Price Oracle
    const oracleAddress = await deployContract('PriceOracle', [DEPLOYER_ADDRESS]);

    // 3. Deploy Protocol Vault
    const vaultAddress = await deployContract('ProtocolVault', [
      DEPLOYER_ADDRESS,
      STRK_TOKEN_ADDRESS,
      hstrkAddress,
      oracleAddress
    ]);

    // 4. Configure hSTRK Token
    console.log('⚙️  Configuring hSTRK Token...');
    console.log('  Setting protocol vault...');

    const sierraPath = path.join(CONTRACT_DIR, 'definite_protocol_hSTRKToken.contract_class.json');
    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));

    const hstrkContract = new Contract(sierra.abi, hstrkAddress, provider);
    hstrkContract.connect(account);

    const configTx = await hstrkContract.set_protocol_vault(vaultAddress);
    await provider.waitForTransaction(configTx.transaction_hash);

    console.log(`  ✅ Configured (tx: ${configTx.transaction_hash})`);
    console.log();

    // Print summary
    console.log('🎉 Deployment Complete!');
    console.log('='.repeat(60));
    console.log();
    console.log('📋 Deployed Contracts:');
    console.log(`  hSTRK Token:    ${deployed.hSTRKToken.address}`);
    console.log(`  Price Oracle:   ${deployed.PriceOracle.address}`);
    console.log(`  Protocol Vault: ${deployed.ProtocolVault.address}`);
    console.log();

    // Save deployment info
    const deploymentData = {
      timestamp: Math.floor(Date.now() / 1000),
      network: 'sepolia',
      chainId: 'SN_SEPOLIA',
      rpcUrl: RPC_URL,
      deployer: DEPLOYER_ADDRESS,
      contracts: {
        hstrkToken: {
          address: deployed.hSTRKToken.address,
          classHash: deployed.hSTRKToken.classHash,
          name: 'hSTRK Token'
        },
        priceOracle: {
          address: deployed.PriceOracle.address,
          classHash: deployed.PriceOracle.classHash,
          name: 'Price Oracle'
        },
        protocolVault: {
          address: deployed.ProtocolVault.address,
          classHash: deployed.ProtocolVault.classHash,
          name: 'Protocol Vault'
        }
      }
    };

    fs.writeFileSync('deployment-result.json', JSON.stringify(deploymentData, null, 2));

    console.log('📄 Saved to: deployment-result.json');
    console.log();
    console.log('🔗 Explorer:');
    console.log(`  https://sepolia.starkscan.co/contract/${deployed.ProtocolVault.address}`);
    console.log();
  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();

