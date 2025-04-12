import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import Decimal from 'decimal.js';

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  positions: Position[];
  total_value: Decimal;
  total_pnl: Decimal;
}

interface Position {
  id: string;
  symbol: string;
  quantity: Decimal;
  entry_price: Decimal;
  current_price: Decimal;
  pnl: Decimal;
}

interface PortfolioState {
  portfolios: Portfolio[];
  isLoading: boolean;
  error: string | null;
  loadPortfolios: () => Promise<void>;
  createPortfolio: (name: string, description?: string) => Promise<void>;
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  addPosition: (portfolioId: string, position: Omit<Position, 'id'>) => Promise<void>;
  updatePosition: (id: string, updates: Partial<Position>) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  isLoading: false,
  error: null,
  
  loadPortfolios: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const { data: portfolios, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (portfolioError) throw portfolioError;
      
      const portfoliosWithPositions = await Promise.all(
        portfolios.map(async (portfolio) => {
          const { data: positions, error: positionError } = await supabase
            .from('positions')
            .select('*')
            .eq('portfolio_id', portfolio.id);
            
          if (positionError) throw positionError;
          
          const formattedPositions = positions.map(pos => ({
            ...pos,
            quantity: new Decimal(pos.quantity),
            entry_price: new Decimal(pos.entry_price),
            current_price: new Decimal(pos.current_price),
            pnl: new Decimal(pos.pnl),
          }));
          
          const totalValue = formattedPositions.reduce(
            (sum, pos) => sum.plus(pos.quantity.times(pos.current_price)),
            new Decimal(0)
          );
          
          const totalPnl = formattedPositions.reduce(
            (sum, pos) => sum.plus(pos.pnl),
            new Decimal(0)
          );
          
          return {
            ...portfolio,
            positions: formattedPositions,
            total_value: totalValue,
            total_pnl: totalPnl,
          };
        })
      );
      
      set({ portfolios: portfoliosWithPositions });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  createPortfolio: async (name: string, description?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('portfolios')
        .insert({ name, description });
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  updatePortfolio: async (id: string, updates: Partial<Portfolio>) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('portfolios')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  deletePortfolio: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  addPosition: async (portfolioId: string, position: Omit<Position, 'id'>) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('positions')
        .insert({
          portfolio_id: portfolioId,
          ...position,
          quantity: position.quantity.toString(),
          entry_price: position.entry_price.toString(),
          current_price: position.current_price.toString(),
          pnl: position.pnl.toString(),
        });
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  updatePosition: async (id: string, updates: Partial<Position>) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('positions')
        .update({
          ...updates,
          quantity: updates.quantity?.toString(),
          entry_price: updates.entry_price?.toString(),
          current_price: updates.current_price?.toString(),
          pnl: updates.pnl?.toString(),
        })
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  deletePosition: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await get().loadPortfolios();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
}));