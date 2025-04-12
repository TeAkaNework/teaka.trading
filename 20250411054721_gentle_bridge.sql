/*
  # Add strategy permission policies

  1. Security
    - Add policies for managing strategy permissions
    - Only admins can manage permissions
*/

-- Add policies for strategy permissions
CREATE POLICY "Admins can manage strategy permissions"
  ON strategy_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view strategy permissions"
  ON strategy_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategy_configs
      WHERE id = strategy_id
      AND user_id = auth.uid()
    )
  );