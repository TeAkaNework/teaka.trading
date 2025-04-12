import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface ExchangeConfig {
  enabled: boolean;
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  name: 'kucoin' | 'bitget';
  type: 'spot' | 'futures';
}

interface ExchangeState {
  configs: ExchangeConfig[];
  isLoading: boolean;
  error: string | null;
  addExchange: (config: ExchangeConfig) => Promise<void>;
  updateExchange: (name: string, type: string, updates: Partial<ExchangeConfig>) => Promise<void>;
  removeExchange: (name: string, type: string) => Promise<void>;
  loadConfigs: () => Promise<void>;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  configs: [],
  isLoading: false,
  error: null,

  loadConfigs: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const { data: configs, error } = await supabase
        .from('exchange_configs')
        .select('*');
        
      if (error) throw error;
      
      set({ configs: configs.map(config => ({
        ...config,
        enabled: config.enabled || false
      })) });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  addExchange: async (config: ExchangeConfig) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('exchange_configs')
        .insert({
          name: config.name,
          type: config.type,
          enabled: config.enabled,
          api_key: config.apiKey,
          secret_key: config.secretKey,
          passphrase: config.passphrase
        });
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  updateExchange: async (name: string, type: string, updates: Partial<ExchangeConfig>) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('exchange_configs')
        .update({
          enabled: updates.enabled,
          api_key: updates.apiKey,
          secret_key: updates.secretKey,
          passphrase: updates.passphrase
        })
        .match({ name, type });
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  removeExchange: async (name: string, type: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('exchange_configs')
        .delete()
        .match({ name, type });
        
      if (error) throw error;
      
      await get().loadConfigs();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  }
}));