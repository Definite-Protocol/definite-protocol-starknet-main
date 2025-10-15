export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  total_balance: number;
  total_invested: number;
  total_yield: number;
  current_apy: number;
  hedge_ratio: number;
  risk_score: number;
  created_at: string;
  updated_at: string;
}

export interface YieldData {
  id: string;
  portfolio_id: string;
  date: string;
  daily_yield: number;
  cumulative_yield: number;
  apy: number;
  strategy_breakdown: {
    staking: number;
    funding_rates: number;
    arbitrage: number;
  };
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  portfolio_id: string;
  type: 'deposit' | 'withdraw' | 'yield_payment' | 'rebalance';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskMetrics {
  id: string;
  portfolio_id: string;
  beta: number;
  sharpe_ratio: number;
  max_drawdown: number;
  volatility: number;
  var_95: number;
  correlation_btc: number;
  win_rate: number;
  created_at: string;
}

export interface ProtocolStats {
  id: string;
  total_users: number;
  total_value_locked: number;
  total_yield_distributed: number;
  total_collateral: number;
  active_strategies: number;
  average_apy: number;
  created_at: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  apy?: number;
  volume?: number;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}