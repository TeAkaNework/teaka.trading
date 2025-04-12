/*
  # Create strategy configurations table

  1. New Tables
    - `strategy_configs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `type` (text)
      - `enabled` (boolean)
      - `parameters` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `strategy_configs` table
    - Add policies for users to manage their own strategy configurations
*/

CREATE TABLE IF NOT EXISTS strategy_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  enabled boolean DEFAULT false,
  parameters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE strategy_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own strategy configs"
  ON strategy_configs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create strategy configs"
  ON strategy_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy configs"
  ON strategy_configs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategy configs"
  ON strategy_configs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);