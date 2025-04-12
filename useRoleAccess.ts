import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export type UserRole = 'viewer' | 'pro' | 'admin';

interface UseRoleAccessProps {
  requiredRole: UserRole;
}

export function useRoleAccess({ requiredRole }: UseRoleAccessProps) {
  const { user } = useAuthStore();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('has_role', { required_role: requiredRole });

        if (error) throw error;
        setHasAccess(data);
      } catch (error) {
        console.error('Error checking role access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user, requiredRole]);

  return { hasAccess, isLoading };
}