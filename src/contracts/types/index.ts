/**
 * Contract Types and Interfaces
 * Type definitions for Definite Protocol contracts
 */

export interface ContractAddresses {
  hstrkToken: string;
  protocolVault: string;
  priceOracle: string;
  riskManager: string;
  perpetualHedge: string;
  optionsStrategy: string;
  rebalancingEngine: string;
}

export interface DeploymentConfig {
  timestamp: number;
  network: string;
  chainId: string;
  rpcUrl: string;
  deployer_address: string;
  contracts: {
    [key: string]: {
      address: string;
      name: string;
      abi: string;
    };
  };
  status: string;
  note: string;
}

// Vault Types
export interface VaultConfig {
  performance_fee_bps: number;
  management_fee_bps: number;
  exit_fee_bps: number;
  min_deposit: bigint;
  max_tvl: bigint;
}

export interface YieldReport {
  strategy: string;
  gross_yield: bigint;
  net_yield: bigint;
  timestamp: number;
}

// Oracle Types
export interface PriceData {
  price: bigint;
  timestamp: number;
  sources_count: number;
  confidence: number;
}

// Risk Types
export interface RiskMetrics {
  total_exposure: bigint;
  delta: bigint;
  var_99: bigint;
  liquidity_score: number;
  volatility: number;
}

export interface RiskLevel {
  Low: boolean;
  Medium: boolean;
  High: boolean;
  Critical: boolean;
}

// Position Types
export interface HedgePosition {
  size: bigint;
  entry_price: bigint;
  current_price: bigint;
  unrealized_pnl: bigint;
  funding_paid: bigint;
  liquidation_price: bigint;
}

// Transaction Types
export interface TransactionResult {
  transaction_hash: string;
  status?: string;
}

// ERC20 Types
export interface ERC20Balance {
  balance: bigint;
  decimals: number;
  symbol: string;
}

