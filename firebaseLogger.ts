import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Signal } from './algorithmService';
import { logger } from '../utils/logger';

interface TradeLog {
  symbol: string;
  type: 'BUY' | 'SELL';
  price: string;
  quantity: string;
  timestamp: Date;
  strategy: string;
  execution: {
    platform: string;
    orderId: string;
    status: string;
    filledPrice?: string;
    filledQuantity?: string;
    error?: string;
  };
  metadata: Record<string, any>;
}

interface BacktestLog {
  strategy: string;
  parameters: Record<string, any>;
  results: {
    pnl: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    trades: number;
    startTime: Date;
    endTime: Date;
  };
  signals: Signal[];
  timestamp: Date;
}

export class FirebaseLogger {
  private db;
  private readonly TRADE_COLLECTION = 'trade_logs';
  private readonly BACKTEST_COLLECTION = 'backtest_logs';

  constructor() {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  public async logTrade(trade: TradeLog): Promise<void> {
    try {
      const docRef = await addDoc(collection(this.db, this.TRADE_COLLECTION), {
        ...trade,
        timestamp: Timestamp.fromDate(trade.timestamp)
      });

      logger.info('Trade logged to Firebase', {
        tradeId: docRef.id,
        symbol: trade.symbol,
        type: trade.type
      });
    } catch (error) {
      logger.error('Failed to log trade to Firebase:', error);
      throw error;
    }
  }

  public async logBacktest(backtest: BacktestLog): Promise<void> {
    try {
      const docRef = await addDoc(collection(this.db, this.BACKTEST_COLLECTION), {
        ...backtest,
        timestamp: Timestamp.fromDate(backtest.timestamp),
        results: {
          ...backtest.results,
          startTime: Timestamp.fromDate(backtest.results.startTime),
          endTime: Timestamp.fromDate(backtest.results.endTime)
        }
      });

      logger.info('Backtest logged to Firebase', {
        backtestId: docRef.id,
        strategy: backtest.strategy,
        pnl: backtest.results.pnl
      });
    } catch (error) {
      logger.error('Failed to log backtest to Firebase:', error);
      throw error;
    }
  }

  public async getRecentTrades(
    limit: number = 100,
    strategy?: string
  ): Promise<TradeLog[]> {
    try {
      let q = query(
        collection(this.db, this.TRADE_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limit)
      );

      if (strategy) {
        q = query(q, where('strategy', '==', strategy));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as TradeLog[];
    } catch (error) {
      logger.error('Failed to fetch recent trades:', error);
      throw error;
    }
  }

  public async getStrategyPerformance(
    strategy: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    trades: number;
    winRate: number;
    pnl: number;
    sharpeRatio: number;
  }> {
    try {
      const q = query(
        collection(this.db, this.BACKTEST_COLLECTION),
        where('strategy', '==', strategy),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const snapshot = await getDocs(q);
      const backtests = snapshot.docs.map(doc => doc.data());

      if (backtests.length === 0) {
        return {
          trades: 0,
          winRate: 0,
          pnl: 0,
          sharpeRatio: 0
        };
      }

      // Calculate average metrics
      const metrics = backtests.reduce(
        (acc, backtest) => ({
          trades: acc.trades + backtest.results.trades,
          winRate: acc.winRate + backtest.results.winRate,
          pnl: acc.pnl + backtest.results.pnl,
          sharpeRatio: acc.sharpeRatio + backtest.results.sharpeRatio
        }),
        { trades: 0, winRate: 0, pnl: 0, sharpeRatio: 0 }
      );

      return {
        trades: metrics.trades,
        winRate: metrics.winRate / backtests.length,
        pnl: metrics.pnl,
        sharpeRatio: metrics.sharpeRatio / backtests.length
      };
    } catch (error) {
      logger.error('Failed to fetch strategy performance:', error);
      throw error;
    }
  }

  public async getTopStrategies(
    metric: 'pnl' | 'winRate' | 'sharpeRatio' = 'sharpeRatio',
    limit: number = 5
  ): Promise<Array<{ strategy: string; value: number }>> {
    try {
      const q = query(
        collection(this.db, this.BACKTEST_COLLECTION),
        orderBy(`results.${metric}`, 'desc'),
        limit(limit)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        strategy: doc.data().strategy,
        value: doc.data().results[metric]
      }));
    } catch (error) {
      logger.error('Failed to fetch top strategies:', error);
      throw error;
    }
  }
}