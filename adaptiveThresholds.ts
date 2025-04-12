import { Decimal } from 'decimal.js';
import * as stats from 'simple-statistics';
import { logger } from '../utils/logger';

interface ThresholdConfig {
  name: string;
  baseValue: number;
  minValue: number;
  maxValue: number;
  adaptiveFactors: {
    volatility?: number;
    performance?: number;
    marketRegime?: number;
  };
}

interface MarketCondition {
  volatility: number;
  trend: number;
  volume: number;
  correlation: number;
}

interface StrategyPerformance {
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  recentPnL: number[];
}

export class AdaptiveThresholds {
  private thresholds: Map<string, ThresholdConfig>;
  private readonly HISTORY_WINDOW = 100;
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private lastUpdate: number = 0;
  private marketHistory: MarketCondition[] = [];
  private performanceHistory: Map<string, StrategyPerformance> = new Map();

  constructor() {
    this.thresholds = new Map();
    this.initializeDefaultThresholds();
  }

  private initializeDefaultThresholds() {
    const defaults: ThresholdConfig[] = [
      {
        name: 'stopLoss',
        baseValue: 0.02,  // 2% base stop loss
        minValue: 0.01,   // 1% minimum
        maxValue: 0.05,   // 5% maximum
        adaptiveFactors: {
          volatility: 1.0,
          performance: 0.5,
          marketRegime: 0.5
        }
      },
      {
        name: 'takeProfit',
        baseValue: 0.03,  // 3% base take profit
        minValue: 0.02,   // 2% minimum
        maxValue: 0.1,    // 10% maximum
        adaptiveFactors: {
          volatility: 1.0,
          performance: 0.7,
          marketRegime: 0.3
        }
      },
      {
        name: 'entryConfidence',
        baseValue: 0.7,   // 70% base confidence threshold
        minValue: 0.5,    // 50% minimum
        maxValue: 0.9,    // 90% maximum
        adaptiveFactors: {
          volatility: 0.5,
          performance: 1.0,
          marketRegime: 0.5
        }
      },
      {
        name: 'positionSize',
        baseValue: 0.1,   // 10% base position size
        minValue: 0.05,   // 5% minimum
        maxValue: 0.2,    // 20% maximum
        adaptiveFactors: {
          volatility: 1.0,
          performance: 0.8,
          marketRegime: 0.7
        }
      }
    ];

    defaults.forEach(config => {
      this.thresholds.set(config.name, config);
    });
  }

  public async updateThresholds(
    marketCondition: MarketCondition,
    performance?: StrategyPerformance
  ): Promise<void> {
    try {
      const now = Date.now();
      if (now - this.lastUpdate < this.UPDATE_INTERVAL) {
        return;
      }

      // Update market history
      this.marketHistory.push(marketCondition);
      if (this.marketHistory.length > this.HISTORY_WINDOW) {
        this.marketHistory.shift();
      }

      // Calculate market regime
      const regime = this.calculateMarketRegime();

      // Update thresholds
      for (const [name, config] of this.thresholds) {
        const newValue = this.calculateAdaptiveThreshold(
          config,
          marketCondition,
          performance,
          regime
        );

        config.baseValue = newValue;

        logger.info(`Threshold updated: ${name}`, {
          oldValue: config.baseValue,
          newValue,
          marketCondition,
          regime
        });
      }

      this.lastUpdate = now;

    } catch (error) {
      logger.error('Error updating thresholds:', error);
      throw error;
    }
  }

  private calculateAdaptiveThreshold(
    config: ThresholdConfig,
    market: MarketCondition,
    performance?: StrategyPerformance,
    regime?: number
  ): number {
    let adjustment = 1.0;

    // Volatility adjustment
    if (config.adaptiveFactors.volatility) {
      const volAdjustment = this.calculateVolatilityAdjustment(market.volatility);
      adjustment *= (1 + config.adaptiveFactors.volatility * (volAdjustment - 1));
    }

    // Performance adjustment
    if (config.adaptiveFactors.performance && performance) {
      const perfAdjustment = this.calculatePerformanceAdjustment(performance);
      adjustment *= (1 + config.adaptiveFactors.performance * (perfAdjustment - 1));
    }

    // Market regime adjustment
    if (config.adaptiveFactors.marketRegime && regime !== undefined) {
      const regimeAdjustment = this.calculateRegimeAdjustment(regime);
      adjustment *= (1 + config.adaptiveFactors.marketRegime * (regimeAdjustment - 1));
    }

    // Apply adjustment within bounds
    const newValue = config.baseValue * adjustment;
    return Math.max(config.minValue, Math.min(config.maxValue, newValue));
  }

  private calculateVolatilityAdjustment(currentVol: number): number {
    const historicalVol = this.marketHistory.map(m => m.volatility);
    const meanVol = stats.mean(historicalVol);
    const stdVol = stats.standardDeviation(historicalVol);

    const zScore = (currentVol - meanVol) / (stdVol || 1);
    
    // Exponential scaling
    return Math.exp(zScore * 0.2); // 20% adjustment per standard deviation
  }

  private calculatePerformanceAdjustment(performance: StrategyPerformance): number {
    // Combine multiple performance metrics
    const winRateScore = performance.winRate;
    const sharpeScore = Math.max(0, performance.sharpeRatio) / 3; // Normalize Sharpe
    const pfScore = Math.min(performance.profitFactor, 3) / 3;    // Cap PF at 3

    // Recent performance trend
    const recentPnL = performance.recentPnL;
    const pnlTrend = recentPnL.length > 1
      ? stats.linearRegression(
          recentPnL.map((_, i) => i),
          recentPnL
        ).m
      : 0;

    // Combine scores with trend influence
    return (
      winRateScore * 0.3 +
      sharpeScore * 0.3 +
      pfScore * 0.2 +
      Math.max(0, Math.min(pnlTrend, 1)) * 0.2
    );
  }

  private calculateMarketRegime(): number {
    if (this.marketHistory.length < 2) return 0.5;

    // Calculate trend strength
    const trends = this.marketHistory.map(m => m.trend);
    const trendStrength = Math.abs(stats.mean(trends));

    // Calculate volatility regime
    const volRegime = this.calculateVolatilityRegime();

    // Calculate correlation regime
    const corrRegime = this.calculateCorrelationRegime();

    // Combine regimes (0 = mean reversion, 1 = trending)
    return (
      trendStrength * 0.4 +
      volRegime * 0.3 +
      corrRegime * 0.3
    );
  }

  private calculateVolatilityRegime(): number {
    const vols = this.marketHistory.map(m => m.volatility);
    const recentVol = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const longVol = vols.reduce((a, b) => a + b, 0) / vols.length;

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, recentVol / longVol));
  }

  private calculateCorrelationRegime(): number {
    const corrs = this.marketHistory.map(m => m.correlation);
    const meanCorr = stats.mean(corrs);
    
    // Transform to 0-1 range where 1 = high correlation
    return (meanCorr + 1) / 2;
  }

  public getThreshold(name: string): number {
    const config = this.thresholds.get(name);
    if (!config) {
      throw new Error(`Threshold ${name} not found`);
    }
    return config.baseValue;
  }

  public getAllThresholds(): Record<string, number> {
    return Object.fromEntries(
      Array.from(this.thresholds.entries()).map(([name, config]) => [
        name,
        config.baseValue
      ])
    );
  }

  public addCustomThreshold(config: ThresholdConfig): void {
    if (this.thresholds.has(config.name)) {
      throw new Error(`Threshold ${config.name} already exists`);
    }
    this.thresholds.set(config.name, config);
  }

  public removeThreshold(name: string): void {
    if (!this.thresholds.has(name)) {
      throw new Error(`Threshold ${name} not found`);
    }
    this.thresholds.delete(name);
  }

  public updateThresholdConfig(
    name: string,
    updates: Partial<ThresholdConfig>
  ): void {
    const config = this.thresholds.get(name);
    if (!config) {
      throw new Error(`Threshold ${name} not found`);
    }
    this.thresholds.set(name, { ...config, ...updates });
  }
}