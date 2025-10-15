/**
 * Contract Types
 * TypeScript interfaces for deployment configuration and contract addresses
 */

export interface ContractInfo {
  address: string;
  classHash: string;
  name: string;
  abi: string;
  deploymentTx?: string;
  declarationTx?: string;
  updateTx?: string;
  explorer?: string;
}

export interface DeploymentConfig {
  timestamp: number;
  network: string;
  chainId: string;
  rpcUrl: string;
  deployer_address: string;
  contracts: {
    priceOracle: ContractInfo;
    hstrkToken: ContractInfo;
    protocolVault: ContractInfo;
    riskManager: ContractInfo;
    perpetualHedge: ContractInfo;
    optionsStrategy: ContractInfo;
    rebalancingEngine: ContractInfo;
  };
  externalContracts?: {
    strkToken: string;
  };
  status: string;
  deploymentDate?: string;
  note: string;
}

export interface ContractAddresses {
  hstrkToken: string;
  protocolVault: string;
  priceOracle: string;
  riskManager: string;
  perpetualHedge: string;
  optionsStrategy: string;
  rebalancingEngine: string;
}

