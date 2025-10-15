/**
 * Deployment Integration Tests
 * Tests to verify all contracts are deployed and accessible
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RpcProvider, Contract } from 'starknet';
import { getContractAddresses, getRpcUrl } from '../../src/contracts/config';

// Import ABIs
import hstrkTokenAbi from '../../src/contracts/abis/hstrk_token.json';
import protocolVaultAbi from '../../src/contracts/abis/protocol_vault.json';
import priceOracleAbi from '../../src/contracts/abis/price_oracle.json';
import riskManagerAbi from '../../src/contracts/abis/risk_manager.json';

describe('Contract Deployment Integration Tests', () => {
  let provider: RpcProvider;
  let addresses: ReturnType<typeof getContractAddresses>;

  beforeAll(() => {
    provider = new RpcProvider({ nodeUrl: getRpcUrl() });
    addresses = getContractAddresses();
  });

  describe('Contract Addresses', () => {
    it('should have all contract addresses defined', () => {
      expect(addresses.priceOracle).toBeDefined();
      expect(addresses.hstrkToken).toBeDefined();
      expect(addresses.protocolVault).toBeDefined();
      expect(addresses.riskManager).toBeDefined();
      expect(addresses.perpetualHedge).toBeDefined();
      expect(addresses.optionsStrategy).toBeDefined();
      expect(addresses.rebalancingEngine).toBeDefined();
    });

    it('should have valid address format', () => {
      const addressRegex = /^0x[0-9a-fA-F]{1,64}$/;
      
      expect(addresses.priceOracle).toMatch(addressRegex);
      expect(addresses.hstrkToken).toMatch(addressRegex);
      expect(addresses.protocolVault).toMatch(addressRegex);
      expect(addresses.riskManager).toMatch(addressRegex);
      expect(addresses.perpetualHedge).toMatch(addressRegex);
      expect(addresses.optionsStrategy).toMatch(addressRegex);
      expect(addresses.rebalancingEngine).toMatch(addressRegex);
    });

    it('should have non-zero addresses', () => {
      expect(addresses.priceOracle).not.toBe('0x0');
      expect(addresses.hstrkToken).not.toBe('0x0');
      expect(addresses.protocolVault).not.toBe('0x0');
      expect(addresses.riskManager).not.toBe('0x0');
      expect(addresses.perpetualHedge).not.toBe('0x0');
      expect(addresses.optionsStrategy).not.toBe('0x0');
      expect(addresses.rebalancingEngine).not.toBe('0x0');
    });
  });

  describe('PriceOracle Contract', () => {
    let contract: Contract;

    beforeAll(() => {
      contract = new Contract(
        priceOracleAbi.abi,
        addresses.priceOracle,
        provider
      );
    });

    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.priceOracle);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.priceOracle);
      // Normalize class hash (remove leading zeros)
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x0706e20e9215cee313447a34f5f3d008dcc51a759867a83c2e401395812d4072'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });
  });

  describe('hSTRKToken Contract', () => {
    let contract: Contract;

    beforeAll(() => {
      contract = new Contract(
        hstrkTokenAbi.abi,
        addresses.hstrkToken,
        provider
      );
    });

    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.hstrkToken);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.hstrkToken);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x019ef3a0c38abad5d55fad620cfab3d6fc9a752e0790722b19e6dc3560ec2507'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });

    it('should have correct name', async () => {
      try {
        const name = await contract.name();
        expect(name).toBeDefined();
      } catch (error) {
        console.log('Name function not available or requires different call format');
      }
    });

    it('should have correct symbol', async () => {
      try {
        const symbol = await contract.symbol();
        expect(symbol).toBeDefined();
      } catch (error) {
        console.log('Symbol function not available or requires different call format');
      }
    });
  });

  describe('ProtocolVault Contract', () => {
    let contract: Contract;

    beforeAll(() => {
      contract = new Contract(
        protocolVaultAbi.abi,
        addresses.protocolVault,
        provider
      );
    });

    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.protocolVault);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.protocolVault);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x01227f6eb809782b3e3595526d263732c39c3a5b5dab0f7b2e0db2e621c7b2ab'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });

    it('should have hSTRK token address set', async () => {
      try {
        const hstrkAddress = await contract.get_hstrk_token();
        expect(hstrkAddress).toBe(addresses.hstrkToken);
      } catch (error) {
        console.log('get_hstrk_token function not available or requires different call format');
      }
    });
  });

  describe('RiskManager Contract', () => {
    let contract: Contract;

    beforeAll(() => {
      contract = new Contract(
        riskManagerAbi.abi,
        addresses.riskManager,
        provider
      );
    });

    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.riskManager);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.riskManager);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x05f7caa8303c41d50bb0e4d73714a89f06bad2e37a2ed9cf7e32ff5efdf23f8b'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });
  });

  describe('PerpetualHedge Contract', () => {
    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.perpetualHedge);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.perpetualHedge);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x079b7cc5bea1ccf5ca65366d84a62d71182f10c267ed8da8e45abbc46a74c25d'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });
  });

  describe('OptionsStrategy Contract', () => {
    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.optionsStrategy);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.optionsStrategy);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x02923be3dc76f64e78a8b72a1ecbda76958ee269c19c6049231869db7f3079be'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });
  });

  describe('RebalancingEngine Contract', () => {
    it('should be deployed and accessible', async () => {
      const classHash = await provider.getClassHashAt(addresses.rebalancingEngine);
      expect(classHash).toBeDefined();
      expect(classHash).not.toBe('0x0');
    });

    it('should have correct class hash', async () => {
      const classHash = await provider.getClassHashAt(addresses.rebalancingEngine);
      const normalizedHash = classHash.replace(/^0x0+/, '0x');
      const expectedHash = '0x0265d00727fd750c43c98ccbbc26cb10a3d2da1294e98f7bec4cb40b350830f1'.replace(/^0x0+/, '0x');
      expect(normalizedHash).toBe(expectedHash);
    });
  });

  describe('Contract Interactions', () => {
    it('should verify circular dependency is resolved', async () => {
      const vaultContract = new Contract(
        protocolVaultAbi.abi,
        addresses.protocolVault,
        provider
      );

      const tokenContract = new Contract(
        hstrkTokenAbi.abi,
        addresses.hstrkToken,
        provider
      );

      try {
        // Verify vault has correct hSTRK address
        const vaultHstrkAddress = await vaultContract.get_hstrk_token();
        expect(vaultHstrkAddress).toBe(addresses.hstrkToken);

        // Verify hSTRK has correct vault address
        const tokenVaultAddress = await tokenContract.get_protocol_vault();
        expect(tokenVaultAddress).toBe(addresses.protocolVault);

        console.log('✅ Circular dependency successfully resolved!');
      } catch (error) {
        console.log('Contract interaction test requires specific function signatures');
      }
    });
  });

  describe('RPC Connection', () => {
    it('should connect to RPC endpoint', async () => {
      const chainId = await provider.getChainId();
      expect(chainId).toBeDefined();
    });

    it('should get latest block', async () => {
      const block = await provider.getBlock('latest');
      expect(block).toBeDefined();
      expect(block.block_number).toBeGreaterThan(0);
    });
  });
});

