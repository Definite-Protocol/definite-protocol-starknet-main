/*
  # Create protocol_stats table for protocol analytics

  1. New Tables
    - `protocol_stats`
      - `id` (uuid, primary key) - Unique identifier for each stats record
      - `total_users` (integer) - Total number of users in the protocol
      - `total_value_locked` (numeric) - Total value locked in the protocol
      - `total_yield_distributed` (numeric) - Total yield distributed to users
      - `total_collateral` (numeric) - Total collateral amount
      - `active_strategies` (integer) - Number of active yield strategies
      - `average_apy` (numeric) - Average APY across all strategies
      - `created_at` (timestamptz) - Timestamp when the record was created

  2. Security
    - Enable RLS on `protocol_stats` table
    - Add policy for public read access (anonymous and authenticated users)

  3. Notes
    - This table stores historical protocol statistics for dashboard analytics
    - Data is typically updated by backend services on a regular schedule
    - Public read access allows the dashboard to display protocol metrics
*/

CREATE TABLE IF NOT EXISTS protocol_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_users integer DEFAULT 0,
  total_value_locked numeric DEFAULT 0,
  total_yield_distributed numeric DEFAULT 0,
  total_collateral numeric DEFAULT 0,
  active_strategies integer DEFAULT 0,
  average_apy numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE protocol_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to protocol stats"
  ON protocol_stats
  FOR SELECT
  TO public
  USING (true);

-- Insert sample data for demo purposes
INSERT INTO protocol_stats (
  total_users,
  total_value_locked,
  total_yield_distributed,
  total_collateral,
  active_strategies,
  average_apy
) VALUES 
(1250, 15750000, 2340000, 12800000, 8, 12.5),
(1245, 15680000, 2320000, 12750000, 8, 12.3),
(1240, 15620000, 2300000, 12700000, 7, 12.1),
(1235, 15580000, 2285000, 12650000, 7, 11.9),
(1230, 15520000, 2270000, 12600000, 7, 11.8);