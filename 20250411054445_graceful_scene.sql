/*
  # Create strategy tables and permissions

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

    - `strategy_permissions`
      - `id` (uuid, primary key)
      - `strategy_id` (uuid, references strategy_configs)
      - `role` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for role-based access
    - Add helper functions for permission checks
*/

-- Create strategy_configs table
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

-- Create strategy_permissions table
CREATE TABLE IF NOT EXISTS strategy_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid REFERENCES strategy_configs(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'pro', 'admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(strategy_id)
);

ALTER TABLE strategy_permissions ENABLE ROW LEVEL SECURITY;

-- Update strategy_configs policies to check permissions
CREATE POLICY "Users can access strategies based on role"
  ON strategy_configs
  FOR ALL
  TO authenticated
  USING (
    has_role(
      (SELECT role FROM strategy_permissions WHERE strategy_id = id)
    )
  );

-- Function to check strategy access
CREATE OR REPLACE FUNCTION can_access_strategy(strategy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN has_role(
    (SELECT role FROM strategy_permissions WHERE strategy_id = $1)
  );
END;
$$;