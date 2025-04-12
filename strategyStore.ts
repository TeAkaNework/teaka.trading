import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

interface StrategyState {
  configs: StrategyConfig[];
  isLoading: boolean;
  error: string | null;
  loadConfigs: () => Promise<void>;
  addStrategy: (config: Omit<StrategyConfig, 'id'>) => Promise<void>;
  updateStrategy: (id: string, updates: Partial<StrategyConfig>) => Promise<void>;
  removeStrategy: (id: string) => Promise<void>;
}

export const useStrategyStore = create<StrategyState>((set, get) => ({
  configs: [],
  isLoading: false,
  error: null,

  loadConfigs: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const { data: configs, error } = await supabase
        .from('strategy_configs')
        .select('*');
        
      if (error) throw error;
      
      set({ configs });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  addStrategy: async (config) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('strategy_configs')
        .insert(config);
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateStrategy: async (id, updates) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('strategy_configs')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  removeStrategy: async (id) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('strategy_configs')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  }
}));