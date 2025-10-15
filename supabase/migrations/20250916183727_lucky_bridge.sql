/*
  # Create users table for wallet authentication

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `wallet_address` (text, unique, required) - Ethereum wallet address
      - `email` (text, unique) - Generated email for compatibility
      - `full_name` (text) - Display name
      - `avatar_url` (text) - Profile picture URL
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `users` table
    - Add policies for authenticated users to manage their own data
    - Public read access for basic user info

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on created_at for sorting
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all user profiles"
  ON users
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO public
  USING (wallet_address = current_setting('app.current_wallet', true));

CREATE POLICY "Anyone can insert user profiles"
  ON users
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  total_balance numeric DEFAULT 0,
  total_invested numeric DEFAULT 0,
  total_yield numeric DEFAULT 0,
  current_apy numeric DEFAULT 0,
  hedge_ratio numeric DEFAULT 0,
  risk_score integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- Create policies for portfolios
CREATE POLICY "Users can view own portfolio"
  ON portfolios
  FOR SELECT
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('app.current_wallet', true)
  ));

CREATE POLICY "Users can update own portfolio"
  ON portfolios
  FOR UPDATE
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('app.current_wallet', true)
  ));

CREATE POLICY "Users can create portfolio"
  ON portfolios
  FOR INSERT
  TO public
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('app.current_wallet', true)
  ));

-- Create other related tables
CREATE TABLE IF NOT EXISTS yield_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  daily_yield numeric DEFAULT 0,
  cumulative_yield numeric DEFAULT 0,
  apy numeric DEFAULT 0,
  strategy_breakdown jsonb DEFAULT '{"staking": 0, "funding_rates": 0, "arbitrage": 0}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE yield_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own yield data"
  ON yield_data
  FOR SELECT
  TO public
  USING (portfolio_id IN (
    SELECT p.id FROM portfolios p
    JOIN users u ON p.user_id = u.id
    WHERE u.wallet_address = current_setting('app.current_wallet', true)
  ));

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  type text CHECK (type IN ('deposit', 'withdraw', 'yield_payment', 'rebalance')),
  amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  tx_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('app.current_wallet', true)
  ));

-- Create risk_metrics table
CREATE TABLE IF NOT EXISTS risk_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  beta numeric DEFAULT 0,
  sharpe_ratio numeric DEFAULT 0,
  max_drawdown numeric DEFAULT 0,
  volatility numeric DEFAULT 0,
  var_95 numeric DEFAULT 0,
  correlation_btc numeric DEFAULT 0,
  win_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk metrics"
  ON risk_metrics
  FOR SELECT
  TO public
  USING (portfolio_id IN (
    SELECT p.id FROM portfolios p
    JOIN users u ON p.user_id = u.id
    WHERE u.wallet_address = current_setting('app.current_wallet', true)
  ));

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at 
  BEFORE UPDATE ON portfolios 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at 
  BEFORE UPDATE ON transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();