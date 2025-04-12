/*
  # Create exchange_configs table

  1. New Tables
    - `exchange_configs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text) - exchange name (kucoin, bitget)
      - `type` (text) - exchange type (spot, futures)
      - `enabled` (boolean)
      - `api_key` (text)
      - `secret_key` (text)
      - `passphrase` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `exchange_configs` table
    - Add policies for users to manage their own exchange configurations
*/

CREATE TABLE IF NOT EXISTS exchange_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  enabled boolean DEFAULT false,
  api_key text NOT NULL,
  secret_key text NOT NULL,
  passphrase text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name, type)
);

ALTER TABLE exchange_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exchange configs"
  ON exchange_configs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create exchange configs"
  ON exchange_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exchange configs"
  ON exchange_configs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exchange configs"
  ON exchange_configs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);