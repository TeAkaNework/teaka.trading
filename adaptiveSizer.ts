import { Decimal } from 'decimal.js';
import { RiskManager } from './riskManager';
import { logger } from '../utils/logger';

interface SizingConfig {
  maxPositionSize: Decimal;
  maxPortfolioExposure: Decimal;
  volatilityScaling: boolean;
  correlationAdjustment: boolean;
  confidenceScaling: boolean;
  baseSize: Decimal;
}

export class AdaptiveSizer {
  private riskManager: RiskManager;
  private config: SizingConfig;

  constructor(riskManager: RiskManager, config: Partial<SizingConfig> = {}) {
    this.riskManager = riskManager;
    this.config = {
      maxPositionSize: new Decimal(0.1),      // 10% max position size
      maxPortfolioExposure: new Decimal(0.5), // 50% max portfolio exposure
      volatilityScaling: true,
      correlationAdjustment: true,
      confidenceScaling: true,
      baseSize: new Decimal(0.01),            // 1% base position size
      ...config
    };
  }

  public async calculatePositionSize(
    signal: {
      symbol: string;
      confidence: number;
      volatility?: number;
    },
    accountInfo: {
      balance: Decimal;
      exposure: Decimal;
    }
  ): Promise<{
    size: Decimal;
    adjustments: Record<string, number>;
  }> {
    try {
      // Start with base size
      let size = this.config.baseSize.times(accountInfo.balance);
      const adjustments: Record<string, number> = {};

      // 1. Volatility Adjustment
      if (this.config.volatilityScaling && signal.volatility) {
        const volAdjustment = this.calculateVolatilityAdjustment(signal.volatility);
        size = size.times(volAdjustment);
        adjustments.volatility = volAdjustment;
      }

      // 2. Correlation Adjustment
      if (this.config.correlationAdjustment) {
        const corrAdjustment = await this.calculateCorrelationAdjustment(signal.symbol);
        size = size.times(corrAdjustment);
        adjustments.correlation = corrAdjustment;
      }

      // 3. Confidence Scaling
      if (this.config.confidenceScaling) {
        const confAdjustment = this.calculateConfidenceAdjustment(signal.confidence);
        size = size.times(confAdjustment);
        adjustments.confidence = confAdjustment;
      }

      // 4. Risk Limits
      size = this.applyRiskLimits(size, accountInfo);
      
      logger.info('Position size calculated', {
        symbol: signal.symbol,
        size: size.toString(),
        adjustments
      });

      return { size, adjustments };

    } catch (error) {
      logger.error('Error calculating position size:', error);
      throw error;
    }
  }

  private calculateVolatilityAdjustment(volatility: number): number {
    // Inverse relationship with volatility
    // Higher volatility = smaller position size
    const baseVol = 0.02; // 2% baseline volatility
    return Math.min(baseVol / volatility, 2);
  }

  private async calculateCorrelationAdjustment(symbol: string): Promise<number> {
    try {
      const correlation = await this.riskManager.getPortfolioCorrelation(symbol);
      
      // Reduce size for highly correlated assets
      if (correlation > 0.7) {
        return 0.5; // 50% size reduction
      } else if (correlation > 0.5) {
        return 0.75; // 25% size reduction
      } else if (correlation < -0.5) {
        return 1.25; // 25% size increase (diversification bonus)
      }
      
      return 1;
    } catch (error) {
      logger.warn('Error calculating correlation adjustment:', error);
      return 1; // Default to no adjustment on error
    }
  }

  private calculateConfidenceAdjustment(confidence: number): number {
    // Linear scaling with confidence
    // 0.5 confidence = 50% size reduction
    // 1.0 confidence = no adjustment
    // 1.5 confidence = 50% size increase (capped)
    return Math.min(confidence, 1.5);
  }

  private applyRiskLimits(
    size: Decimal,
    accountInfo: { balance: Decimal; exposure: Decimal }
  ): Decimal {
    // 1. Check max position size
    const maxSize = accountInfo.balance.times(this.config.maxPositionSize);
    size = Decimal.min(size, maxSize);

    // 2. Check portfolio exposure
    const availableExposure = this.config.maxPortfolioExposure
      .minus(accountInfo.exposure)
      .times(accountInfo.balance);
    
    size = Decimal.min(size, availableExposure);

    return size;
  }

  public updateConfig(updates: Partial<SizingConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }

  public getConfig(): SizingConfig {
    return { ...this.config };
  }
}