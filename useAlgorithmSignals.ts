import { useState, useEffect } from 'react';
import { 
  MeanReversionStrategy, 
  TrendFollowingStrategy, 
  BreakoutStrategy,
  Signal 
} from '../services/algorithmService';
import { PriceService } from '../services/priceService';

const priceService = new PriceService();
const meanReversion = new MeanReversionStrategy();
const trendFollowing = new TrendFollowingStrategy();
const breakout = new BreakoutStrategy();

export function useAlgorithmSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    const unsubscribe = priceService.onPriceUpdate((update) => {
      const newSignals: Signal[] = [];

      const meanReversionSignal = meanReversion.analyze(update);
      const trendFollowingSignal = trendFollowing.analyze(update);
      const breakoutSignal = breakout.analyze(update);

      if (meanReversionSignal) newSignals.push(meanReversionSignal);
      if (trendFollowingSignal) newSignals.push(trendFollowingSignal);
      if (breakoutSignal) newSignals.push(breakoutSignal);

      if (newSignals.length > 0) {
        setSignals(prev => [...newSignals, ...prev].slice(0, 50));
      }
    });

    return () => unsubscribe();
  }, []);

  return signals;
}