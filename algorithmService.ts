import Decimal from 'decimal.js';
import { PriceUpdate } from './priceService';

export interface Signal {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: Decimal;
  timestamp: number;
  strategy: string;
  metadata: Record<string, any>;
  targets?: {
    entry: Decimal;
    takeProfit: Decimal;
    stopLoss: Decimal;
    riskRewardRatio: Decimal;
  };
  performance?: {
    sharpe: Decimal;
    winRate: Decimal;
    profitFactor: Decimal;
  };
}

interface StrategyState {
  enabled: boolean;
  volatilityScore: number;
  performanceScore: number;
  returns: Decimal[];
}

export class TradingStrategy {
  protected windowSize: number;
  protected state: StrategyState;
  protected priceHistory: Decimal[];
  protected volatilityThreshold: number;
  protected atrPeriod: number;
  protected atrMultiplierTP: number;
  protected atrMultiplierSL: number;

  constructor() {
    this.windowSize = 20;
    this.atrPeriod = 14;
    this.atrMultiplierTP = 1.5;
    this.atrMultiplierSL = 1.0;
    this.volatilityThreshold = 0.02;
    this.priceHistory = [];
    this.state = {
      enabled: true,
      volatilityScore: 0,
      performanceScore: 0,
      returns: []
    };
  }

  protected calculateATR(prices: Decimal[]): Decimal {
    if (prices.length < 2) return new Decimal(0);

    const ranges: Decimal[] = [];
    for (let i = 1; i < prices.length; i++) {
      const range = prices[i].minus(prices[i - 1]).abs();
      ranges.push(range);
    }

    return ranges.reduce((sum, range) => sum.plus(range), new Decimal(0))
      .dividedBy(ranges.length);
  }

  protected calculateVolatility(prices: Decimal[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(
        prices[i].minus(prices[i - 1])
          .dividedBy(prices[i - 1])
          .toNumber()
      );
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns
      .map(r => Math.pow(r - mean, 2))
      .reduce((a, b) => a + b, 0) / returns.length;

    return Math.sqrt(variance);
  }

  protected calculateSharpe(returns: Decimal[]): Decimal {
    if (returns.length < 2) return new Decimal(0);

    const meanReturn = returns.reduce((a, b) => a.plus(b), new Decimal(0))
      .dividedBy(returns.length);
    const riskFreeRate = new Decimal(0.02).dividedBy(252); // Daily risk-free rate
    
    const variance = returns
      .map(r => r.minus(meanReturn).pow(2))
      .reduce((a, b) => a.plus(b), new Decimal(0))
      .dividedBy(returns.length);
    
    const stdDev = variance.sqrt();
    
    return stdDev.isZero()
      ? new Decimal(0)
      : meanReturn.minus(riskFreeRate).dividedBy(stdDev).times(Math.sqrt(252));
  }

  protected calculatePerformanceMetrics(): {
    sharpe: Decimal;
    winRate: Decimal;
    profitFactor: Decimal;
  } {
    const returns = this.state.returns;
    const wins = returns.filter(r => r.greaterThan(0));
    const losses = returns.filter(r => r.lessThanOrEqualTo(0));

    const winRate = new Decimal(wins.length).dividedBy(returns.length);
    const totalWins = wins.reduce((a, b) => a.plus(b), new Decimal(0));
    const totalLosses = losses.reduce((a, b) => a.plus(b.abs()), new Decimal(0));
    
    const profitFactor = totalLosses.isZero()
      ? new Decimal(0)
      : totalWins.dividedBy(totalLosses);

    return {
      sharpe: this.calculateSharpe(returns),
      winRate,
      profitFactor
    };
  }

  protected calculateTargetLevels(
    price: Decimal,
    atr: Decimal,
    type: 'BUY' | 'SELL'
  ) {
    const entry = price;
    const atrAmount = atr.times(this.atrMultiplierTP);
    
    const takeProfit = type === 'BUY'
      ? entry.plus(atrAmount)
      : entry.minus(atrAmount);
    
    const stopLoss = type === 'BUY'
      ? entry.minus(atr.times(this.atrMultiplierSL))
      : entry.plus(atr.times(this.atrMultiplierSL));
    
    const riskRewardRatio = type === 'BUY'
      ? takeProfit.minus(entry).dividedBy(entry.minus(stopLoss))
      : entry.minus(takeProfit).dividedBy(stopLoss.minus(entry));

    return {
      entry,
      takeProfit,
      stopLoss,
      riskRewardRatio
    };
  }

  protected updateState(price: Decimal) {
    this.priceHistory.push(price);
    if (this.priceHistory.length > this.windowSize) {
      this.priceHistory.shift();
    }

    // Update volatility score
    const volatility = this.calculateVolatility(this.priceHistory);
    this.state.volatilityScore = volatility;
    this.state.enabled = volatility <= this.volatilityThreshold;

    // Update performance metrics if we have returns
    if (this.state.returns.length > 0) {
      const { sharpe } = this.calculatePerformanceMetrics();
      this.state.performanceScore = sharpe.toNumber();
    }
  }
}

export class MeanReversionStrategy extends TradingStrategy {
  private deviationThreshold: number;

  constructor(windowSize = 20, deviationThreshold = 2) {
    super();
    this.windowSize = windowSize;
    this.deviationThreshold = deviationThreshold;
  }

  private calculateSMA(prices: Decimal[]): Decimal {
    return prices.reduce((acc, price) => acc.plus(price), new Decimal(0))
      .dividedBy(prices.length);
  }

  private calculateStandardDeviation(prices: Decimal[], sma: Decimal): Decimal {
    const squaredDiffs = prices.map(price => 
      price.minus(sma).pow(2)
    );
    const variance = this.calculateSMA(squaredDiffs);
    return variance.sqrt();
  }

  analyze(update: PriceUpdate): Signal | null {
    this.updateState(update.price);

    // Skip if volatility is too high
    if (!this.state.enabled) return null;

    if (this.priceHistory.length < this.windowSize) {
      return null;
    }

    const sma = this.calculateSMA(this.priceHistory);
    const stdDev = this.calculateStandardDeviation(this.priceHistory, sma);
    const zScore = update.price.minus(sma).dividedBy(stdDev);
    const atr = this.calculateATR(this.priceHistory);

    let signal: Signal | null = null;

    if (zScore.abs().greaterThan(this.deviationThreshold)) {
      const type = zScore.isNegative() ? 'BUY' : 'SELL';
      const targets = this.calculateTargetLevels(update.price, atr, type);
      const performance = this.calculatePerformanceMetrics();

      signal = {
        symbol: update.symbol,
        type,
        confidence: Math.min(Math.abs(zScore.toNumber()) / 3, 1),
        price: update.price,
        timestamp: Date.now(),
        strategy: 'Mean Reversion',
        metadata: {
          sma: sma.toNumber(),
          stdDev: stdDev.toNumber(),
          zScore: zScore.toNumber(),
          volatilityScore: this.state.volatilityScore,
          performanceScore: this.state.performanceScore
        },
        targets,
        performance
      };
    }

    return signal;
  }
}

export class TrendFollowingStrategy extends TradingStrategy {
  private shortPeriod: number;
  private longPeriod: number;

  constructor(shortPeriod = 10, longPeriod = 30) {
    super();
    this.shortPeriod = shortPeriod;
    this.longPeriod = longPeriod;
    this.volatilityThreshold = 0.015; // Lower threshold for trend following
  }

  private calculateEMA(prices: Decimal[], period: number): Decimal {
    const alpha = new Decimal(2).dividedBy(period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i].times(alpha).plus(ema.times(new Decimal(1).minus(alpha)));
    }

    return ema;
  }

  analyze(update: PriceUpdate): Signal | null {
    this.updateState(update.price);

    // Only enable during high volatility periods
    if (this.state.volatilityScore < this.volatilityThreshold) return null;

    if (this.priceHistory.length < this.longPeriod) {
      return null;
    }

    const shortEMA = this.calculateEMA(this.priceHistory.slice(-this.shortPeriod), this.shortPeriod);
    const longEMA = this.calculateEMA(this.priceHistory, this.longPeriod);
    const difference = shortEMA.minus(longEMA);
    const atr = this.calculateATR(this.priceHistory);

    let signal: Signal | null = null;

    if (!difference.isZero()) {
      const type = difference.isPositive() ? 'BUY' : 'SELL';
      const strength = difference.abs().dividedBy(longEMA);
      const targets = this.calculateTargetLevels(update.price, atr, type);
      const performance = this.calculatePerformanceMetrics();

      signal = {
        symbol: update.symbol,
        type,
        confidence: Math.min(strength.toNumber() * 10, 1),
        price: update.price,
        timestamp: Date.now(),
        strategy: 'Trend Following',
        metadata: {
          shortEMA: shortEMA.toNumber(),
          longEMA: longEMA.toNumber(),
          difference: difference.toNumber(),
          volatilityScore: this.state.volatilityScore,
          performanceScore: this.state.performanceScore
        },
        targets,
        performance
      };
    }

    return signal;
  }
}

export class BreakoutStrategy extends TradingStrategy {
  private volatilityMultiplier: number;

  constructor(period = 20, volatilityMultiplier = 2.5) {
    super();
    this.windowSize = period;
    this.volatilityMultiplier = volatilityMultiplier;
  }

  analyze(update: PriceUpdate): Signal | null {
    this.updateState(update.price);

    if (this.priceHistory.length < this.windowSize) {
      return null;
    }

    const atr = this.calculateATR(this.priceHistory);
    const prevPrice = this.priceHistory[this.priceHistory.length - 2];
    const priceChange = update.price.minus(prevPrice).abs();
    
    let signal: Signal | null = null;

    if (priceChange.greaterThan(atr.times(this.volatilityMultiplier))) {
      const type = update.price.greaterThan(prevPrice) ? 'BUY' : 'SELL';
      const targets = this.calculateTargetLevels(update.price, atr, type);
      const performance = this.calculatePerformanceMetrics();

      signal = {
        symbol: update.symbol,
        type,
        confidence: Math.min(priceChange.dividedBy(atr).toNumber() / 5, 1),
        price: update.price,
        timestamp: Date.now(),
        strategy: 'Breakout Detection',
        metadata: {
          atr: atr.toNumber(),
          priceChange: priceChange.toNumber(),
          threshold: atr.times(this.volatilityMultiplier).toNumber(),
          volatilityScore: this.state.volatilityScore,
          performanceScore: this.state.performanceScore
        },
        targets,
        performance
      };
    }

    return signal;
  }
}

export class SignalAggregator {
  private strategies: Map<string, TradingStrategy>;
  private votingWindow: Signal[][] = [];
  private maxVotingWindow = 5;
  private confidenceThreshold = 0.7;

  constructor() {
    this.strategies = new Map([
      ['meanReversion', new MeanReversionStrategy()],
      ['trendFollowing', new TrendFollowingStrategy()],
      ['breakout', new BreakoutStrategy()]
    ]);
  }

  private calculateConsensus(signals: Signal[]): Signal | null {
    if (signals.length === 0) return null;

    // Count votes weighted by confidence and performance
    const votes = {
      BUY: 0,
      SELL: 0,
      HOLD: 0
    };

    let totalWeight = 0;
    let consensusPrice = new Decimal(0);
    let consensusConfidence = 0;
    let bestPerformingStrategy: Signal | null = null;

    for (const signal of signals) {
      const weight = signal.confidence * 
        (1 + (signal.performance?.sharpe.toNumber() || 0)) *
        (1 + (signal.performance?.winRate.toNumber() || 0));
      
      votes[signal.type] += weight;
      totalWeight += weight;
      consensusPrice = consensusPrice.plus(signal.price.times(weight));

      if (!bestPerformingStrategy || 
          (signal.performance?.sharpe.greaterThan(bestPerformingStrategy.performance?.sharpe || new Decimal(0)))) {
        bestPerformingStrategy = signal;
      }
    }

    if (totalWeight === 0) return null;

    consensusPrice = consensusPrice.dividedBy(totalWeight);
    const dominantType = Object.entries(votes)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0] as 'BUY' | 'SELL' | 'HOLD';
    
    consensusConfidence = votes[dominantType] / totalWeight;

    if (consensusConfidence < this.confidenceThreshold) return null;

    return {
      ...bestPerformingStrategy!,
      type: dominantType,
      confidence: consensusConfidence,
      price: consensusPrice,
      strategy: 'Consensus',
      metadata: {
        votes,
        contributingStrategies: signals.map(s => s.strategy),
        averageVolatility: signals.reduce((sum, s) => sum + (s.metadata.volatilityScore || 0), 0) / signals.length,
        averagePerformance: signals.reduce((sum, s) => sum + (s.metadata.performanceScore || 0), 0) / signals.length
      }
    };
  }

  analyze(update: PriceUpdate): Signal | null {
    const currentSignals = Array.from(this.strategies.values())
      .map(strategy => strategy.analyze(update))
      .filter((signal): signal is Signal => signal !== null);

    this.votingWindow.push(currentSignals);
    if (this.votingWindow.length > this.maxVotingWindow) {
      this.votingWindow.shift();
    }

    // Flatten all signals in the voting window
    const allSignals = this.votingWindow.flat();
    return this.calculateConsensus(allSignals);
  }
}