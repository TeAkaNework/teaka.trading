import { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import { PriceService, PriceUpdate } from '../services/priceService';

const priceService = new PriceService();

interface PriceData {
  [symbol: string]: {
    price: Decimal;
    change24h: Decimal;
  };
}

export function usePriceUpdates() {
  const [prices, setPrices] = useState<PriceData>({});

  useEffect(() => {
    const unsubscribe = priceService.onPriceUpdate((update: PriceUpdate) => {
      setPrices(prev => ({
        ...prev,
        [update.symbol]: {
          price: update.price,
          change24h: update.change24h
        }
      }));
    });

    return () => unsubscribe();
  }, []);

  return prices;
}