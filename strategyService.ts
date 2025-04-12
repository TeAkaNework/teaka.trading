import { Decimal } from 'decimal.js';
import * as stats from 'simple-statistics';
import { Signal } from './algorithmService';

interface StrategyConfig {
  name: string;
  parameters: Record<string, any>;
  code: string;
}

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategyResult {
  signals: Signal[];
  metrics: {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export class StrategyService {
  private strategies: Map<string, StrategyConfig> = new Map();

  public async evaluateStrategy(
    strategy: StrategyConfig,
    data: Bar[]
  ): Promise<StrategyResult> {
    try {
      // Create sandbox environment for strategy execution
      const sandbox = {
        data: this.prepareData(data),
        parameters: strategy.parameters,
        calculateSMA: this.calculateSMA,
        calculateEMA: this.calculateEMA,
        calculateRSI: this.calculateRSI,
        calculateBollingerBands: this.calculateBollingerBands,
        calculateATR: this.calculateATR,
        console: { log: console.log }
      };

      // Execute strategy code in sandbox
      const strategyFunction = new Function(
        'sandbox',
        `with (sandbox) { ${strategy.code} }`
      );

      const signals = await strategyFunction(sandbox);

      // Calculate performance metrics
      const metrics = this.calculateMetrics(signals, data);

      return {
        signals,
        metrics
      };

    } catch (error) {
      console.error('Strategy evaluation error:', error);
      throw error;
    }
  }

  private prepareData(bars: Bar[]) {
    return {
      timestamp: bars.map(b => b.timestamp),
      open: bars.map(b => b.open),
      high: bars.map(b => b.high),
      low: bars.map(b => b.low),
      close: bars.map(b => b.close),
      volume: bars.map(b => b.volume)
    };
  }

  private calculateSMA(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(0);
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result[i] = sum / period;
    }
    return result;
  }

  private calculateEMA(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(0);
    const multiplier = 2 / (period + 1);
    
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    }
    return result;
  }

  private calculateRSI(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(0);
    const gains = new Array(data.length).fill(0);
    const losses = new Array(data.length).fill(0);
    
    // Calculate gains and losses
    for (let i = 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      gains[i] = diff > 0 ? diff : 0;
      losses[i] = diff < 0 ? -diff : 0;
    }
    
    // Calculate RSI
    for (let i = period; i < data.length; i++) {
      const avgGain = stats.mean(gains.slice(i - period + 1, i + 1));
      const avgLoss = stats.mean(losses.slice(i - period + 1, i + 1));
      const rs = avgGain / (avgLoss || 1e-10);
      result[i] = 100 - (100 / (1 + rs));
    }
    
    return result;
  }

  private calculateBollingerBands(
    data: number[],
    period: number,
    stdDev: number
  ): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.calculateSMA(data, period);
    const upper = new Array(data.length).fill(0);
    const lower = new Array(data.length).fill(0);
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const std = stats.standardDeviation(slice);
      upper[i] = middle[i] + stdDev * std;
      lower[i] = middle[i] - stdDev * std;
    }
    
    return { upper, middle, lower };
  }

  private calculateATR(
    high: number[],
    low: number[],
    close: number[],
    period: number
  ): number[] {
    const tr = new Array(high.length).fill(0);
    const atr = new Array(high.length).fill(0);
    
    // Calculate True Range
    tr[0] = high[0] - low[0];
    for (let i = 1; i < high.length; i++) {
      tr[i] = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
    }
    
    // Calculate ATR
    atr[period - 1] = stats.mean(tr.slice(0, period));
    for (let i = period; i < high.length; i++) {
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }
    
    return atr;
  }

  private calculateMetrics(signals: Signal[], data: Bar[]): {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  } {
    const trades = this.simulateTrades(signals, data);
    const returns = this.calculateReturns(trades);
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    
    const winRate = winningTrades.length / trades.length;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss === 0 ? 0 : grossProfit / grossLoss;
    
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const maxDrawdown = this.calculateMaxDrawdown(trades);
    
    return {
      winRate,
      profitFactor,
      sharpeRatio,
      maxDrawdown
    };
  }

  private simulateTrades(signals: Signal[], data: Bar[]) {
    const trades = [];
    let position = null;
    
    for (const signal of signals) {
      if (!position && signal.type === 'BUY') {
        position = {
          entry: signal.price,
          timestamp: signal.timestamp,
          type: signal.type
        };
      } else if (position && signal.type === 'SELL') {
        const pnl = position.type === 'BUY'
          ? signal.price.minus(position.entry)
          : position.entry.minus(signal.price);
        
        trades.push({
          entry: position.entry,
          exit: signal.price,
          pnl: pnl.toNumber(),
          entryTime: position.timestamp,
          exitTime: signal.timestamp
        });
        
        position = null;
      }
    }
    
    return trades;
  }

  private calculateReturns(trades: any[]): number[] {
    return trades.map(t => t.pnl);
  }

  private calculateSharpeRatio(returns: number[]): number {
    const mean = stats.mean(returns);
    const stdDev = stats.standardDeviation(returns);
    return stdDev === 0 ? 0 : mean / stdDev * Math.sqrt(252);
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let equity = 0;
    
    for (const trade of trades) {
      equity += trade.pnl;
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
}