import { logger } from '../utils/logger.js';
import Decimal from 'decimal.js';

export class RiskManager {
  constructor(config = {}) {
    this.maxDrawdown = new Decimal(config.maxDrawdown || 0.02); // 2% max drawdown
    this.maxExposure = new Decimal(config.maxExposure || 0.05); // 5% max exposure per position
    this.totalExposureLimit = new Decimal(config.totalExposureLimit || 0.2); // 20% max total exposure
    this.minAccountBalance = new Decimal(config.minAccountBalance || 1000); // Minimum account balance
    this.positions = new Map();
  }

  async validateTrade(signal, accountInfo) {
    try {
      logger.info('Validating trade...', { signal });

      const validationResults = {
        passed: true,
        checks: [],
        errors: []
      };

      // Convert account balance to Decimal
      const balance = new Decimal(accountInfo.balance);
      
      // Check minimum account balance
      if (balance.lessThan(this.minAccountBalance)) {
        validationResults.passed = false;
        validationResults.errors.push({
          type: 'INSUFFICIENT_BALANCE',
          message: `Account balance (${balance}) below minimum (${this.minAccountBalance})`
        });
      }

      // Calculate position size
      const positionSize = this.calculatePositionSize(signal, balance);
      validationResults.checks.push({
        type: 'POSITION_SIZE',
        value: positionSize.toString(),
        passed: true
      });

      // Check exposure
      const exposure = positionSize.dividedBy(balance);
      const exposureCheck = exposure.lessThanOrEqualTo(this.maxExposure);
      validationResults.checks.push({
        type: 'EXPOSURE',
        value: exposure.toString(),
        limit: this.maxExposure.toString(),
        passed: exposureCheck
      });

      if (!exposureCheck) {
        validationResults.passed = false;
        validationResults.errors.push({
          type: 'EXPOSURE_EXCEEDED',
          message: `Position exposure (${exposure.times(100)}%) exceeds limit (${this.maxExposure.times(100)}%)`
        });
      }

      // Check total exposure
      const totalExposure = this.calculateTotalExposure(accountInfo);
      const totalExposureCheck = totalExposure.plus(exposure).lessThanOrEqualTo(this.totalExposureLimit);
      validationResults.checks.push({
        type: 'TOTAL_EXPOSURE',
        value: totalExposure.plus(exposure).toString(),
        limit: this.totalExposureLimit.toString(),
        passed: totalExposureCheck
      });

      if (!totalExposureCheck) {
        validationResults.passed = false;
        validationResults.errors.push({
          type: 'TOTAL_EXPOSURE_EXCEEDED',
          message: `Total exposure (${totalExposure.plus(exposure).times(100)}%) exceeds limit (${this.totalExposureLimit.times(100)}%)`
        });
      }

      // Check drawdown
      const drawdown = this.calculateDrawdown(accountInfo);
      const drawdownCheck = drawdown.lessThanOrEqualTo(this.maxDrawdown);
      validationResults.checks.push({
        type: 'DRAWDOWN',
        value: drawdown.toString(),
        limit: this.maxDrawdown.toString(),
        passed: drawdownCheck
      });

      if (!drawdownCheck) {
        validationResults.passed = false;
        validationResults.errors.push({
          type: 'DRAWDOWN_EXCEEDED',
          message: `Current drawdown (${drawdown.times(100)}%) exceeds limit (${this.maxDrawdown.times(100)}%)`
        });
      }

      // Check for duplicate positions
      const hasDuplicate = await this.checkDuplicatePosition(signal, accountInfo);
      validationResults.checks.push({
        type: 'DUPLICATE_CHECK',
        passed: !hasDuplicate
      });

      if (hasDuplicate) {
        validationResults.passed = false;
        validationResults.errors.push({
          type: 'DUPLICATE_POSITION',
          message: `Duplicate position found for ${signal.symbol}`
        });
      }

      // Log validation results
      logger.info('Trade validation completed', validationResults);

      return validationResults;

    } catch (error) {
      logger.error('Trade validation error:', error);
      throw error;
    }
  }

  calculatePositionSize(signal, balance) {
    // Calculate position size based on risk per trade
    const riskPerTrade = balance.times(0.01); // 1% risk per trade
    const stopLoss = new Decimal(signal.sl);
    const entry = new Decimal(signal.price || signal.entry);
    const riskPerUnit = entry.minus(stopLoss).abs();
    
    return riskPerTrade.dividedBy(riskPerUnit);
  }

  calculateTotalExposure(accountInfo) {
    // Sum up all position exposures
    return accountInfo.positions.reduce((total, position) => {
      const positionValue = new Decimal(position.units).abs()
        .times(new Decimal(position.averagePrice));
      return total.plus(positionValue.dividedBy(accountInfo.balance));
    }, new Decimal(0));
  }

  calculateDrawdown(accountInfo) {
    const equity = new Decimal(accountInfo.equity || accountInfo.balance);
    const balance = new Decimal(accountInfo.balance);
    return balance.minus(equity).dividedBy(balance).abs();
  }

  async checkDuplicatePosition(signal, accountInfo) {
    return accountInfo.positions.some(position => 
      position.instrument === signal.symbol
    );
  }

  updatePosition(position) {
    this.positions.set(position.symbol, {
      entryPrice: new Decimal(position.entryPrice),
      size: new Decimal(position.size),
      pnl: new Decimal(position.pnl || 0)
    });
  }

  removePosition(symbol) {
    this.positions.delete(symbol);
  }
}