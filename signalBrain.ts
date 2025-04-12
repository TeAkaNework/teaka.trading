import { Decimal } from 'decimal.js';
import { Signal } from './algorithmService';
import { logger } from '../utils/logger';

interface FilterConfig {
  zScoreThreshold: number;
  volatilityMax: number;
  volumeThreshold: number;
  minConfidence: number;
  correlationThreshold: number;
}

interface StrategyWeight {
  name: string;
  weight: number;
  performance: {
    sharpe: number;
    winRate: number;
    profitFactor: number;
  };
}

export class SignalBrain {
  private filterConfig: FilterConfig;
  private strategyWeights: Map<string, StrategyWeight>;
  private readonly VOLATILITY_WINDOW = 20;
  private readonly CORRELATION_WINDOW = 50;
  private priceHistory: Map<string, number[]>;
  private volatilityHistory: Map<string, number[]>;

  constructor(config: Partial<FilterConfig> = {}) {
    this.filterConfig = {
      zScoreThreshold: 2.0,
      volatilityMax: 0.03,
      volumeThreshold: 1.5,
      minConfidence: 0.7,
      correlationThreshold: 0.7,
      ...config
    };

    this.strategyWeights = new Map();
    this.priceHistory = new Map();
    this.volatilityHistory = new Map();
  }

  public async filterSignal(
    signal: Signal,
    marketData: {
      price: number;
      volume: number;
      volatility?: number;
    }
  ): Promise<{
    isValid: boolean;
    reasons: string[];
    adjustedConfidence?: number;
  }> {
    try {
      const reasons: string[] = [];

      // 1. Update price history
      this.updatePriceHistory(signal.symbol, marketData.price);

      // 2. Calculate volatility if not provided
      const volatility = marketData.volatility || 
        this.calculateVolatility(signal.symbol);

      // 3. Check signal confidence
      if (signal.confidence < this.filterConfig.minConfidence) {
        reasons.push(`Low confidence: ${signal.confidence}`);
      }

      // 4. Check price deviation (z-score)
      const priceZScore = this.calculateZScore(signal.symbol);
      if (Math.abs(priceZScore) > this.filterConfig.zScoreThreshold) {
        reasons.push(`High price deviation: ${priceZScore.toFixed(2)}`);
      }

      // 5. Check volatility
      if (volatility > this.filterConfig.volatilityMax) {
        reasons.push(`High volatility: ${volatility.toFixed(4)}`);
      }

      // 6. Check volume
      const volumeRatio = this.calculateVolumeRatio(marketData.volume);
      if (volumeRatio < this.filterConfig.volumeThreshold) {
        reasons.push(`Low volume: ${volumeRatio.toFixed(2)}x average`);
      }

      // 7. Check correlation with existing positions
      const correlation = await this.calculateCorrelation(signal.symbol);
      if (Math.abs(correlation) > this.filterConfig.correlationThreshold) {
        reasons.push(`High correlation: ${correlation.toFixed(2)}`);
      }

      // 8. Adjust confidence based on filters
      const adjustedConfidence = this.adjustConfidence(
        signal.confidence,
        { priceZScore, volatility, volumeRatio, correlation }
      );

      logger.info('Signal filter results', {
        symbol: signal.symbol,
        isValid: reasons.length === 0,
        reasons,
        adjustedConfidence
      });

      return {
        isValid: reasons.length === 0,
        reasons,
        adjustedConfidence
      };

    } catch (error) {
      logger.error('Error filtering signal:', error);
      throw error;
    }
  }

  public async combineSignals(
    signals: Signal[]
  ): Promise<Signal[]> {
    try {
      const combinedSignals = new Map<string, Signal>();

      for (const signal of signals) {
        const existing = combinedSignals.get(signal.symbol);

        if (!existing) {
          combinedSignals.set(signal.symbol, signal);
          continue;
        }

        // Combine signals based on strategy weights and confidence
        const weight1 = this.getStrategyWeight(existing.strategy);
        const weight2 = this.getStrategyWeight(signal.strategy);

        const totalWeight = weight1 + weight2;
        const combinedConfidence = (
          existing.confidence * weight1 +
          signal.confidence * weight2
        ) / totalWeight;

        // Keep signal with higher weighted confidence
        if (signal.confidence * weight2 > existing.confidence * weight1) {
          combinedSignals.set(signal.symbol, {
            ...signal,
            confidence: combinedConfidence,
            metadata: {
              ...signal.metadata,
              combinedFrom: [existing.strategy, signal.strategy]
            }
          });
        }
      }

      return Array.from(combinedSignals.values());

    } catch (error) {
      logger.error('Error combining signals:', error);
      throw error;
    }
  }

  public updateStrategyPerformance(
    strategy: string,
    metrics: {
      sharpe: number;
      winRate: number;
      profitFactor: number;
    }
  ): void {
    try {
      const existing = this.strategyWeights.get(strategy) || {
        name: strategy,
        weight: 1,
        performance: metrics
      };

      // Update weight based on performance
      const newWeight = this.calculateStrategyWeight(metrics);

      this.strategyWeights.set(strategy, {
        ...existing,
        weight: newWeight,
        performance: metrics
      });

      logger.info('Strategy performance updated', {
        strategy,
        weight: newWeight,
        metrics
      });

    } catch (error) {
      logger.error('Error updating strategy performance:', error);
      throw error;
    }
  }

  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(price);

    if (history.length > this.CORRELATION_WINDOW) {
      history.shift();
    }
  }

  private calculateVolatility(symbol: string): number {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < this.VOLATILITY_WINDOW) {
      return 0;
    }

    const returns = [];
    for (let i = 1; i < history.length; i++) {
      returns.push((history[i] - history[i-1]) / history[i-1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce(
      (sum, ret) => sum + Math.pow(ret - mean, 2),
      0
    ) / returns.length;

    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private calculateZScore(symbol: string): number {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) return 0;

    const current = history[history.length - 1];
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(
      history.reduce((sum, price) => 
        sum + Math.pow(price - mean, 2),
        0
      ) / history.length
    );

    return (current - mean) / (std || 1);
  }

  private calculateVolumeRatio(currentVolume: number): number {
    // Simple implementation - can be enhanced with actual volume history
    return currentVolume > 0 ? 1.5 : 0;
  }

  private async calculateCorrelation(symbol: string): Promise<number> {
    // Simple implementation - can be enhanced with actual correlation calculation
    return 0;
  }

  private adjustConfidence(
    baseConfidence: number,
    factors: {
      priceZScore: number;
      volatility: number;
      volumeRatio: number;
      correlation: number;
    }
  ): number {
    let adjustedConfidence = baseConfidence;

    // Reduce confidence based on high z-score
    const zScorePenalty = Math.max(0, 
      (Math.abs(factors.priceZScore) - this.filterConfig.zScoreThreshold) / 2
    );
    adjustedConfidence *= (1 - zScorePenalty);

    // Reduce confidence based on high volatility
    const volPenalty = Math.max(0,
      (factors.volatility - this.filterConfig.volatilityMax) / 
      this.filterConfig.volatilityMax
    );
    adjustedConfidence *= (1 - volPenalty);

    // Boost confidence based on high volume
    const volumeBoost = Math.min(0.2,
      (factors.volumeRatio - this.filterConfig.volumeThreshold) * 0.1
    );
    adjustedConfidence *= (1 + volumeBoost);

    // Reduce confidence based on high correlation
    const corrPenalty = Math.max(0,
      (Math.abs(factors.correlation) - this.filterConfig.correlationThreshold) / 2
    );
    adjustedConfidence *= (1 - corrPenalty);

    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  private calculateStrategyWeight(metrics: {
    sharpe: number;
    winRate: number;
    profitFactor: number;
  }): number {
    // Combine metrics into a single score
    const sharpeScore = Math.max(0, metrics.sharpe) / 2; // Normalize Sharpe
    const winRateScore = metrics.winRate;
    const pfScore = Math.min(metrics.profitFactor, 3) / 3; // Cap PF at 3

    return (sharpeScore + winRateScore + pfScore) / 3;
  }

  private getStrategyWeight(strategy: string): number {
    return this.strategyWeights.get(strategy)?.weight || 1;
  }

  public getFilterConfig(): FilterConfig {
    return { ...this.filterConfig };
  }

  public updateFilterConfig(updates: Partial<FilterConfig>): void {
    this.filterConfig = {
      ...this.filterConfig,
      ...updates
    };
  }

  public getStrategyWeights(): StrategyWeight[] {
    return Array.from(this.strategyWeights.values());
  }
}