/*
  # Create positions table

  1. New Tables
    - `positions`
      - `id` (uuid, primary key)
      - `portfolio_id` (uuid, references portfolios)
      - `symbol` (text)
      - `quantity` (decimal)
      - `entry_price` (decimal)
      - `current_price` (decimal)
      - `pnl` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `positions` table
    - Add policy for users to read their own positions
    - Add policy for users to create positions
    - Add policy for users to update their own positions
    - Add policy for users to delete their own positions
*/

CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  quantity decimal NOT NULL,
  entry_price decimal NOT NULL,
  current_price decimal NOT NULL,
  pnl decimal NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own positions"
  ON positions
  FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create positions"
  ON positions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own positions"
  ON positions
  FOR UPDATE
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own positions"
  ON positions
  FOR DELETE
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );