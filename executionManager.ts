import Decimal from 'decimal.js';
import { Signal } from './algorithmService';
import { RiskManagementService } from './riskManagementService';

interface ExecutionState {
  lastTradeTime: Map<string, number>;
  openPositions: Map<string, {
    size: Decimal;
    entryPrice: Decimal;
    timestamp: number;
  }>;
  correlationMatrix: Map<string, Map<string, number>>;
}

export class ExecutionManager {
  private state: ExecutionState;
  private cooldownPeriod: number; // milliseconds
  private correlationThreshold: number;
  private riskManager: RiskManagementService;
  private baseCapital: Decimal;
  private maxPositions: number;

  constructor(
    riskManager: RiskManagementService,
    baseCapital: Decimal,
    cooldownMinutes = 15,
    correlationThreshold = 0.7,
    maxPositions = 5
  ) {
    this.state = {
      lastTradeTime: new Map(),
      openPositions: new Map(),
      correlationMatrix: new Map()
    };
    this.cooldownPeriod = cooldownMinutes * 60 * 1000;
    this.correlationThreshold = correlationThreshold;
    this.riskManager = riskManager;
    this.baseCapital = baseCapital;
    this.maxPositions = maxPositions;
  }

  private isInCooldown(symbol: string): boolean {
    const lastTrade = this.state.lastTradeTime.get(symbol);
    if (!lastTrade) return false;
    
    const timeSinceLastTrade = Date.now() - lastTrade;
    return timeSinceLastTrade < this.cooldownPeriod;
  }

  private updateLastTradeTime(symbol: string): void {
    this.state.lastTradeTime.set(symbol, Date.now());
  }

  private hasHighCorrelation(symbol: string): boolean {
    const correlations = this.state.correlationMatrix.get(symbol);
    if (!correlations) return false;

    for (const [existingSymbol, correlation] of correlations.entries()) {
      if (this.state.openPositions.has(existingSymbol) && 
          Math.abs(correlation) > this.correlationThreshold) {
        return true;
      }
    }
    return false;
  }

  private calculatePositionSize(signal: Signal): Decimal {
    const metrics = this.riskManager.calculateRiskMetrics();
    const symbolRisk = this.riskManager.getPositionRisk(signal.symbol);
    
    // Base position size using Kelly Criterion
    let size = this.baseCapital.times(metrics.kellyFraction);
    
    // Adjust for confidence
    size = size.times(new Decimal(signal.confidence));
    
    // Adjust for strategy performance
    if (signal.performance) {
      size = size.times(signal.performance.sharpe.plus(1));
    }
    
    // Adjust for portfolio risk
    const portfolioRiskFactor = new Decimal(1).minus(
      metrics.var.abs().dividedBy(this.baseCapital)
    );
    size = size.times(portfolioRiskFactor);
    
    // Adjust for correlation
    const correlationPenalty = this.hasHighCorrelation(signal.symbol) ? 0.5 : 1;
    size = size.times(new Decimal(correlationPenalty));
    
    return size;
  }

  private isAnomalous(signal: Signal): boolean {
    // Check for price spikes
    if (signal.metadata.zScore && Math.abs(signal.metadata.zScore) > 4) {
      return true;
    }
    
    // Check for abnormal volume or volatility
    if (signal.metadata.volatilityScore > 3) {
      return true;
    }
    
    // Check for extreme moves
    if (signal.metadata.priceChange && 
        Math.abs(signal.metadata.priceChange) > 0.1) { // 10% move
      return true;
    }
    
    return false;
  }

  public async executeSignal(signal: Signal): Promise<{
    executed: boolean;
    reason?: string;
    size?: Decimal;
  }> {
    // Check cooldown
    if (this.isInCooldown(signal.symbol)) {
      return {
        executed: false,
        reason: 'In cooldown period'
      };
    }

    // Check position limits
    if (this.state.openPositions.size >= this.maxPositions) {
      return {
        executed: false,
        reason: 'Maximum positions reached'
      };
    }

    // Check for anomalies
    if (this.isAnomalous(signal)) {
      return {
        executed: false,
        reason: 'Anomalous market conditions detected'
      };
    }

    // Calculate position size
    const size = this.calculatePositionSize(signal);
    
    // Execute trade
    try {
      // Here you would integrate with your exchange API
      // For now, we'll just simulate the execution
      
      this.updateLastTradeTime(signal.symbol);
      this.state.openPositions.set(signal.symbol, {
        size,
        entryPrice: signal.price,
        timestamp: Date.now()
      });

      return {
        executed: true,
        size
      };
    } catch (error) {
      return {
        executed: false,
        reason: 'Execution error: ' + (error as Error).message
      };
    }
  }

  public updateCorrelationMatrix(correlations: Map<string, Map<string, number>>): void {
    this.state.correlationMatrix = correlations;
  }
}