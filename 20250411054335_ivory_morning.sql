/*
  # Add strategy permissions

  1. New Tables
    - `strategy_permissions`
      - `id` (uuid, primary key)
      - `strategy_id` (uuid, references strategy_configs)
      - `role` (text) - minimum role required
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `strategy_permissions` table
    - Add policies for permission management
*/

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