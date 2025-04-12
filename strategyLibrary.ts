import { Decimal } from 'decimal.js';
import * as stats from 'simple-statistics';

export interface StrategyTemplate {
  name: string;
  description: string;
  defaultParameters: Record<string, any>;
  code: string;
}

export class StrategyLibrary {
  private templates: Map<string, StrategyTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    this.addTemplate({
      name: 'Mean Reversion',
      description: 'Trades price deviations from historical averages',
      defaultParameters: {
        lookbackPeriod: 20,
        deviationThreshold: 2,
        rsiPeriod: 14,
        rsiThreshold: 30
      },
      code: `function analyze(data) {
  const { close } = data;
  const signals = [];
  
  // Calculate SMA and standard deviation
  const sma = calculateSMA(close, parameters.lookbackPeriod);
  const stdDev = calculateStdDev(close, parameters.lookbackPeriod);
  const rsi = calculateRSI(close, parameters.rsiPeriod);
  
  for (let i = parameters.lookbackPeriod; i < close.length; i++) {
    const zScore = (close[i] - sma[i]) / stdDev[i];
    
    if (zScore < -parameters.deviationThreshold && rsi[i] < parameters.rsiThreshold) {
      signals.push({
        type: 'BUY',
        price: close[i],
        confidence: Math.min(Math.abs(zScore) / 3, 1),
        metadata: { zScore, rsi: rsi[i] }
      });
    } else if (zScore > parameters.deviationThreshold && rsi[i] > (100 - parameters.rsiThreshold)) {
      signals.push({
        type: 'SELL',
        price: close[i],
        confidence: Math.min(Math.abs(zScore) / 3, 1),
        metadata: { zScore, rsi: rsi[i] }
      });
    }
  }
  
  return signals;
}`
    });

    this.addTemplate({
      name: 'Trend Following',
      description: 'Follows established market trends using moving averages',
      defaultParameters: {
        fastPeriod: 10,
        slowPeriod: 30,
        atrPeriod: 14,
        atrMultiplier: 2
      },
      code: `function analyze(data) {
  const { close, high, low } = data;
  const signals = [];
  
  const fastMA = calculateEMA(close, parameters.fastPeriod);
  const slowMA = calculateEMA(close, parameters.slowPeriod);
  const atr = calculateATR(high, low, close, parameters.atrPeriod);
  
  for (let i = parameters.slowPeriod; i < close.length; i++) {
    const crossover = fastMA[i] > slowMA[i] && fastMA[i-1] <= slowMA[i-1];
    const crossunder = fastMA[i] < slowMA[i] && fastMA[i-1] >= slowMA[i-1];
    
    if (crossover) {
      signals.push({
        type: 'BUY',
        price: close[i],
        confidence: 0.8,
        metadata: {
          stopLoss: close[i] - atr[i] * parameters.atrMultiplier,
          takeProfit: close[i] + atr[i] * parameters.atrMultiplier * 2
        }
      });
    } else if (crossunder) {
      signals.push({
        type: 'SELL',
        price: close[i],
        confidence: 0.8,
        metadata: {
          stopLoss: close[i] + atr[i] * parameters.atrMultiplier,
          takeProfit: close[i] - atr[i] * parameters.atrMultiplier * 2
        }
      });
    }
  }
  
  return signals;
}`
    });

    this.addTemplate({
      name: 'Breakout',
      description: 'Detects and trades significant price movements',
      defaultParameters: {
        lookbackPeriod: 20,
        volatilityPeriod: 14,
        breakoutThreshold: 2,
        volumeThreshold: 1.5
      },
      code: `function analyze(data) {
  const { close, volume, high, low } = data;
  const signals = [];
  
  const volatility = calculateATR(high, low, close, parameters.volatilityPeriod);
  const volumeSMA = calculateSMA(volume, parameters.lookbackPeriod);
  
  for (let i = parameters.lookbackPeriod; i < close.length; i++) {
    const highestHigh = Math.max(...high.slice(i - parameters.lookbackPeriod, i));
    const lowestLow = Math.min(...low.slice(i - parameters.lookbackPeriod, i));
    const volumeRatio = volume[i] / volumeSMA[i];
    
    if (close[i] > highestHigh && volumeRatio > parameters.volumeThreshold) {
      signals.push({
        type: 'BUY',
        price: close[i],
        confidence: Math.min(volumeRatio / parameters.volumeThreshold, 1),
        metadata: {
          breakoutSize: (close[i] - highestHigh) / volatility[i],
          volumeRatio
        }
      });
    } else if (close[i] < lowestLow && volumeRatio > parameters.volumeThreshold) {
      signals.push({
        type: 'SELL',
        price: close[i],
        confidence: Math.min(volumeRatio / parameters.volumeThreshold, 1),
        metadata: {
          breakoutSize: (lowestLow - close[i]) / volatility[i],
          volumeRatio
        }
      });
    }
  }
  
  return signals;
}`
    });
  }

  public addTemplate(template: StrategyTemplate): void {
    this.templates.set(template.name, template);
  }

  public getTemplate(name: string): StrategyTemplate | undefined {
    return this.templates.get(name);
  }

  public getAllTemplates(): StrategyTemplate[] {
    return Array.from(this.templates.values());
  }

  public removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }

  public updateTemplate(name: string, updates: Partial<StrategyTemplate>): void {
    const template = this.templates.get(name);
    if (template) {
      this.templates.set(name, { ...template, ...updates });
    }
  }

  // Helper functions that can be used in strategy code
  public static calculateSMA(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(0);
    for (let i = period - 1; i < data.length; i++) {
      result[i] = stats.mean(data.slice(i - period + 1, i + 1));
    }
    return result;
  }

  public static calculateEMA(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(0);
    const multiplier = 2 / (period + 1);
    
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    }
    return result;
  }

  public static calculateRSI(data: number[], period: number): number[] {
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

  public static calculateATR(
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

  public static calculateBollingerBands(
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
}