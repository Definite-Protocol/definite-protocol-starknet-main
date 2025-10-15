/**
 * Contract Configuration
 * Loads deployment configuration and provides contract addresses
 */

import deploymentConfig from '../config/deployment.json';
import { ContractAddresses, DeploymentConfig } from './types';

// Type assertion for deployment config
const config = deploymentConfig as DeploymentConfig;

/**
 * Get contract addresses from deployment config
 */
export function getContractAddresses(): ContractAddresses {
  return {
    hstrkToken: config.contracts.hstrkToken.address,
    protocolVault: config.contracts.protocolVault.address,
    priceOracle: config.contracts.priceOracle.address,
    riskManager: config.contracts.riskManager.address,
    perpetualHedge: config.contracts.perpetualHedge.address,
    optionsStrategy: config.contracts.optionsStrategy.address,
    rebalancingEngine: config.contracts.rebalancingEngine.address,
  };
}

/**
 * Get RPC URL from deployment config
 */
export function getRpcUrl(): string {
  return config.rpcUrl;
}

/**
 * Get chain ID from deployment config
 */
export function getChainId(): string {
  return config.chainId;
}

/**
 * Get network name from deployment config
 */
export function getNetwork(): string {
  return config.network;
}

/**
 * Get full deployment config
 */
export function getDeploymentConfig(): DeploymentConfig {
  return config;
}

/**
 * Get ABI path for a contract
 */
export function getAbiPath(contractName: keyof ContractAddresses): string {
  const contractKey = contractName as string;
  return `/src/contracts/abis/${config.contracts[contractKey].abi}`;
}

// Export config for direct access
export { config };

