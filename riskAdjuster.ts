import { Decimal } from 'decimal.js';
import { logger } from '../utils/logger';

interface RiskAdjustment {
  stopLoss: Decimal;
  takeProfit: Decimal;
  adjustedSize: Decimal;
  riskRatio: Decimal;
}

export class RiskAdjuster {
  private readonly maxRiskPerTrade: Decimal;
  private readonly minRiskRatio: Decimal;
  private readonly maxRiskRatio: Decimal;
  private readonly atrMultiplier: Decimal;

  constructor(config: {
    maxRiskPerTrade?: number;
    minRiskRatio?: number;
    maxRiskRatio?: number;
    atrMultiplier?: number;
  } = {}) {
    this.maxRiskPerTrade = new Decimal(config.maxRiskPerTrade || 0.02); // 2% max risk per trade
    this.minRiskRatio = new Decimal(config.minRiskRatio || 1.5);        // Minimum 1.5:1 reward:risk
    this.maxRiskRatio = new Decimal(config.maxRiskRatio || 5);          // Maximum 5:1 reward:risk
    this.atrMultiplier = new Decimal(config.atrMultiplier || 2);        // 2x ATR for stop loss
  }

  public calculateAdjustments(params: {
    price: Decimal;
    size: Decimal;
    atr: Decimal;
    type: 'BUY' | 'SELL';
    balance: Decimal;
  }): RiskAdjustment {
    try {
      const { price, size, atr, type, balance } = params;

      // 1. Calculate initial stop loss based on ATR
      const rawStopDistance = atr.times(this.atrMultiplier);
      const stopLoss = type === 'BUY'
        ? price.minus(rawStopDistance)
        : price.plus(rawStopDistance);

      // 2. Calculate risk amount
      const riskPerUnit = price.minus(stopLoss).abs();
      const totalRisk = riskPerUnit.times(size);
      const riskPercent = totalRisk.dividedBy(balance);

      // 3. Adjust position size if risk is too high
      let adjustedSize = size;
      if (riskPercent.greaterThan(this.maxRiskPerTrade)) {
        adjustedSize = this.maxRiskPerTrade
          .times(balance)
          .dividedBy(riskPerUnit);
      }

      // 4. Calculate take profit based on risk ratio
      const targetRatio = Decimal.min(
        Decimal.max(
          this.minRiskRatio,
          adjustedSize.dividedBy(size).times(2) // Scale ratio with size adjustment
        ),
        this.maxRiskRatio
      );

      const profitDistance = riskPerUnit.times(targetRatio);
      const takeProfit = type === 'BUY'
        ? price.plus(profitDistance)
        : price.minus(profitDistance);

      const riskRatio = profitDistance.dividedBy(riskPerUnit);

      logger.info('Risk adjustments calculated', {
        originalSize: size.toString(),
        adjustedSize: adjustedSize.toString(),
        stopLoss: stopLoss.toString(),
        takeProfit: takeProfit.toString(),
        riskRatio: riskRatio.toString()
      });

      return {
        stopLoss,
        takeProfit,
        adjustedSize,
        riskRatio
      };

    } catch (error) {
      logger.error('Error calculating risk adjustments:', error);
      throw error;
    }
  }

  public validateRiskParameters(params: {
    price: Decimal;
    stopLoss: Decimal;
    takeProfit: Decimal;
    size: Decimal;
    balance: Decimal;
  }): {
    isValid: boolean;
    reasons: string[];
  } {
    const { price, stopLoss, takeProfit, size, balance } = params;
    const reasons: string[] = [];

    // 1. Check stop loss distance
    const stopDistance = price.minus(stopLoss).abs();
    if (stopDistance.isZero() || stopDistance.isNegative()) {
      reasons.push('Invalid stop loss distance');
    }

    // 2. Check take profit distance
    const profitDistance = price.minus(takeProfit).abs();
    if (profitDistance.isZero() || profitDistance.isNegative()) {
      reasons.push('Invalid take profit distance');
    }

    // 3. Check risk ratio
    const riskRatio = profitDistance.dividedBy(stopDistance);
    if (riskRatio.lessThan(this.minRiskRatio)) {
      reasons.push(`Risk ratio below minimum (${this.minRiskRatio})`);
    }
    if (riskRatio.greaterThan(this.maxRiskRatio)) {
      reasons.push(`Risk ratio above maximum (${this.maxRiskRatio})`);
    }

    // 4. Check risk per trade
    const riskAmount = stopDistance.times(size);
    const riskPercent = riskAmount.dividedBy(balance);
    if (riskPercent.greaterThan(this.maxRiskPerTrade)) {
      reasons.push(`Risk per trade exceeds maximum (${this.maxRiskPerTrade.times(100)}%)`);
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }
}