import { Account, RpcProvider, Contract, CallData, hash } from 'starknet';
import fs from 'fs';
import path from 'path';

// Configuration
const DEPLOYER_ADDRESS = '0x04f68Bf46Ba913a90A65C47baDb81C4060234f13b91Ccf6238e5C2460F404aA5';
const DEPLOYER_PRIVATE_KEY = '0x01f817bf2804620cbe9cad2dff1d1a427148431e3eafad6d3c71aedc10ba4ce4';
const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/tnhhH9UGXWm8Gji-k4G3Yxv6VcQZjwYK';
const STRK_TOKEN_ADDRESS = '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D';
const UDC_ADDRESS = '0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf';

// Already declared class hashes
const HSTRK_CLASS_HASH = '0x019ef3a0c38abad5d55fad620cfab3d6fc9a752e0790722b19e6dc3560ec2507';

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

  const deployed: Record<string, string> = {};

  // 1. Deploy hSTRK Token (with temporary vault address = deployer)
  console.log('📤 Deploying hSTRK Token...');
  console.log(`  Class Hash: ${HSTRK_CLASS_HASH}`);

  // Constructor: owner, protocol_vault (we'll update vault later)
  const hstrkCalldata = CallData.compile([DEPLOYER_ADDRESS, DEPLOYER_ADDRESS]);

  const hstrkDeployCall = {
    contractAddress: UDC_ADDRESS,
    entrypoint: 'deployContract',
    calldata: CallData.compile({
      classHash: HSTRK_CLASS_HASH,
      salt: '0x0',
      unique: false,
      calldata: hstrkCalldata
    })
  };

  const hstrkTx = await account.execute(hstrkDeployCall);
  console.log(`  TX: ${hstrkTx.transaction_hash}`);
  await provider.waitForTransaction(hstrkTx.transaction_hash);

  // Calculate address
  const hstrkAddress = hash.calculateContractAddressFromHash(
    '0x0',
    HSTRK_CLASS_HASH,
    hstrkCalldata,
    0
  );

  console.log(`  ✅ hSTRK Token: ${hstrkAddress}`);
  console.log();
  deployed['hstrkToken'] = hstrkAddress;

  // 2. Declare and Deploy Price Oracle
  console.log('📤 Declaring Price Oracle...');
  const oracleSierra = JSON.parse(
    fs.readFileSync(path.join(CONTRACT_DIR, 'definite_protocol_PriceOracle.contract_class.json'), 'utf8')
  );
  const oracleCasm = JSON.parse(
    fs.readFileSync(path.join(CONTRACT_DIR, 'definite_protocol_PriceOracle.compiled_contract_class.json'), 'utf8')
  );

  let oracleClassHash: string;
  try {
    const declareTx = await account.declare({
      contract: oracleSierra,
      casm: oracleCasm
    });
    oracleClassHash = declareTx.class_hash;
    console.log(`  Declared: ${oracleClassHash}`);
    await provider.waitForTransaction(declareTx.transaction_hash);
  } catch (e: any) {
    console.log(`  Already declared, computing class hash...`);
    oracleClassHash = hash.computeSierraClassHash(oracleSierra);
    console.log(`  Class Hash: ${oracleClassHash}`);
  }

  console.log('  Deploying...');
  const oracleCalldata = CallData.compile([DEPLOYER_ADDRESS]);
  const oracleDeployCall = {
    contractAddress: UDC_ADDRESS,
    entrypoint: 'deployContract',
    calldata: CallData.compile({
      classHash: oracleClassHash,
      salt: '0x0',
      unique: false,
      calldata: oracleCalldata
    })
  };

  const oracleTx = await account.execute(oracleDeployCall);
  console.log(`  TX: ${oracleTx.transaction_hash}`);
  await provider.waitForTransaction(oracleTx.transaction_hash);

  const oracleAddress = hash.calculateContractAddressFromHash(
    '0x0',
    oracleClassHash,
    oracleCalldata,
    0
  );

  console.log(`  ✅ Price Oracle: ${oracleAddress}`);
  console.log();
  deployed['priceOracle'] = oracleAddress;

  // 3. Declare and Deploy Protocol Vault
  console.log('📤 Declaring Protocol Vault...');
  const vaultSierra = JSON.parse(
    fs.readFileSync(path.join(CONTRACT_DIR, 'definite_protocol_ProtocolVault.contract_class.json'), 'utf8')
  );
  const vaultCasm = JSON.parse(
    fs.readFileSync(path.join(CONTRACT_DIR, 'definite_protocol_ProtocolVault.compiled_contract_class.json'), 'utf8')
  );

  let vaultClassHash: string;
  try {
    const declareTx = await account.declare({
      contract: vaultSierra,
      casm: vaultCasm
    });
    vaultClassHash = declareTx.class_hash;
    console.log(`  Declared: ${vaultClassHash}`);
    await provider.waitForTransaction(declareTx.transaction_hash);
  } catch (e: any) {
    console.log(`  Already declared, computing class hash...`);
    vaultClassHash = hash.computeSierraClassHash(vaultSierra);
    console.log(`  Class Hash: ${vaultClassHash}`);
  }

  console.log('  Deploying...');
  const vaultCalldata = CallData.compile([
    DEPLOYER_ADDRESS,
    STRK_TOKEN_ADDRESS,
    hstrkAddress,
    oracleAddress
  ]);

  const vaultDeployCall = {
    contractAddress: UDC_ADDRESS,
    entrypoint: 'deployContract',
    calldata: CallData.compile({
      classHash: vaultClassHash,
      salt: '0x0',
      unique: false,
      calldata: vaultCalldata
    })
  };

  const vaultTx = await account.execute(vaultDeployCall);
  console.log(`  TX: ${vaultTx.transaction_hash}`);
  await provider.waitForTransaction(vaultTx.transaction_hash);

  const vaultAddress = hash.calculateContractAddressFromHash(
    '0x0',
    vaultClassHash,
    vaultCalldata,
    0
  );

  console.log(`  ✅ Protocol Vault: ${vaultAddress}`);
  console.log();
  deployed['protocolVault'] = vaultAddress;

  // 4. Configure hSTRK Token
  console.log('⚙️  Configuring hSTRK Token...');
  const hstrkContract = new Contract(oracleSierra.abi, hstrkAddress, provider);
  hstrkContract.connect(account);

  const configTx = await hstrkContract.set_protocol_vault(vaultAddress);
  console.log(`  TX: ${configTx.transaction_hash}`);
  await provider.waitForTransaction(configTx.transaction_hash);
  console.log(`  ✅ Configured`);
  console.log();

  // Print summary
  console.log('🎉 Deployment Complete!');
  console.log('='.repeat(60));
  console.log();
  console.log('📋 Deployed Contracts:');
  console.log(`  hSTRK Token:    ${deployed.hstrkToken}`);
  console.log(`  Price Oracle:   ${deployed.priceOracle}`);
  console.log(`  Protocol Vault: ${deployed.protocolVault}`);
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
        address: deployed.hstrkToken,
        classHash: HSTRK_CLASS_HASH,
        name: 'hSTRK Token'
      },
      priceOracle: {
        address: deployed.priceOracle,
        classHash: oracleClassHash,
        name: 'Price Oracle'
      },
      protocolVault: {
        address: deployed.protocolVault,
        classHash: vaultClassHash,
        name: 'Protocol Vault'
      }
    }
  };

  fs.writeFileSync('deployment-result.json', JSON.stringify(deploymentData, null, 2));

  console.log('📄 Saved to: deployment-result.json');
  console.log();
  console.log('🔗 Explorer:');
  console.log(`  https://sepolia.starkscan.co/contract/${deployed.protocolVault}`);
  console.log();
}

main().catch(console.error);

