import Decimal from 'decimal.js';
import * as tf from '@tensorflow/tfjs';
import { Matrix } from 'ml-matrix';
import { Position } from '../stores/portfolioStore';

interface RiskMetrics {
  var: Decimal;  // Value at Risk
  cvar: Decimal; // Conditional Value at Risk
  sharpeRatio: Decimal;
  maxDrawdown: Decimal;
  beta: Decimal;
  correlations: Record<string, number>;
  kellyFraction: Decimal;
  volatility: Decimal;
  stressTestResults: StressTestResult[];
}

interface StressTestResult {
  scenario: string;
  potentialLoss: Decimal;
  probabilityOfOccurrence: Decimal;
  impactedAssets: string[];
}

interface RiskLimits {
  maxPositionSize: Decimal;
  maxPortfolioExposure: Decimal;
  maxDrawdown: Decimal;
  stopLossThreshold: Decimal;
  volatilityThreshold: Decimal;
}

export class RiskManagementService {
  private positions: Map<string, Position> = new Map();
  private priceHistory: Map<string, Decimal[]> = new Map();
  private volatilityHistory: Map<string, Decimal[]> = new Map();
  private correlationMatrix: Matrix | null = null;
  private riskLimits: RiskLimits;
  private confidenceLevel = 0.95;  // 95% VaR
  private riskFreeRate = new Decimal(0.02);  // 2% annual risk-free rate
  private historicalWindow = 252; // One trading year
  private stressScenarios: Record<string, number> = {
    'Market Crash': -0.20,
    'Currency Crisis': -0.15,
    'Political Event': -0.10,
    'Natural Disaster': -0.12,
    'Tech Bubble': -0.25,
    'Interest Rate Hike': -0.08
  };

  constructor(initialLimits?: Partial<RiskLimits>) {
    this.riskLimits = {
      maxPositionSize: new Decimal(0.2),      // 20% of portfolio
      maxPortfolioExposure: new Decimal(0.8), // 80% of capital
      maxDrawdown: new Decimal(0.15),         // 15% drawdown limit
      stopLossThreshold: new Decimal(0.05),   // 5% stop loss
      volatilityThreshold: new Decimal(0.3),  // 30% annualized volatility
      ...initialLimits
    };
  }

  public async calculateRiskMetrics(): Promise<RiskMetrics> {
    const portfolioValue = this.calculatePortfolioValue();
    const returns = this.calculateHistoricalReturns();
    const volatility = this.calculateVolatility(returns);
    const var_ = this.calculateVaR(returns, portfolioValue);
    const cvar = this.calculateCVaR(returns, portfolioValue);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);
    const maxDrawdown = this.calculateMaxDrawdown();
    const beta = await this.calculatePortfolioBeta();
    const correlations = this.calculateCorrelations();
    const kellyFraction = this.calculateKellyFraction(returns);
    const stressTestResults = this.runStressTests(portfolioValue);

    return {
      var: var_,
      cvar,
      sharpeRatio,
      maxDrawdown,
      beta,
      correlations,
      kellyFraction,
      volatility: new Decimal(volatility),
      stressTestResults
    };
  }

  public validatePosition(symbol: string, size: Decimal, price: Decimal): {
    isValid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const portfolioValue = this.calculatePortfolioValue();
    const positionValue = size.times(price);
    const exposure = positionValue.dividedBy(portfolioValue);

    // Check position size limit
    if (exposure.greaterThan(this.riskLimits.maxPositionSize)) {
      reasons.push('Position size exceeds maximum allowed exposure');
    }

    // Check portfolio exposure
    const totalExposure = this.calculateTotalExposure().plus(exposure);
    if (totalExposure.greaterThan(this.riskLimits.maxPortfolioExposure)) {
      reasons.push('Total portfolio exposure would exceed limit');
    }

    // Check volatility
    const volatility = this.getAssetVolatility(symbol);
    if (volatility.greaterThan(this.riskLimits.volatilityThreshold)) {
      reasons.push('Asset volatility exceeds threshold');
    }

    // Check correlation risk
    const correlationRisk = this.checkCorrelationRisk(symbol);
    if (correlationRisk.isHigh) {
      reasons.push(`High correlation with existing positions: ${correlationRisk.correlatedAssets.join(', ')}`);
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  public monitorPositions(): void {
    for (const [symbol, position] of this.positions.entries()) {
      const currentPrice = position.current_price;
      const entryPrice = position.entry_price;
      const drawdown = currentPrice.minus(entryPrice).dividedBy(entryPrice);

      // Check stop loss
      if (drawdown.lessThan(this.riskLimits.stopLossThreshold.negated())) {
        this.triggerStopLoss(symbol, position);
      }

      // Check drawdown limit
      if (drawdown.lessThan(this.riskLimits.maxDrawdown.negated())) {
        this.triggerDrawdownAlert(symbol, position, drawdown);
      }
    }
  }

  private calculatePortfolioValue(): Decimal {
    return Array.from(this.positions.values()).reduce(
      (total, pos) => total.plus(pos.quantity.times(pos.current_price)),
      new Decimal(0)
    );
  }

  private calculateHistoricalReturns(): number[] {
    const returns: number[] = [];
    const symbols = Array.from(this.positions.keys());
    
    for (let i = 1; i < this.historicalWindow; i++) {
      let dailyReturn = 0;
      for (const symbol of symbols) {
        const history = this.priceHistory.get(symbol);
        if (history && history.length > i) {
          const position = this.positions.get(symbol)!;
          const weight = position.quantity.times(position.current_price)
            .dividedBy(this.calculatePortfolioValue())
            .toNumber();
          
          const dailyAssetReturn = history[i].minus(history[i-1])
            .dividedBy(history[i-1])
            .toNumber();
          
          dailyReturn += weight * dailyAssetReturn;
        }
      }
      returns.push(dailyReturn);
    }
    
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns
      .map(r => Math.pow(r - mean, 2))
      .reduce((a, b) => a + b, 0) / (returns.length - 1);
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private calculateVaR(returns: number[], portfolioValue: Decimal): Decimal {
    const sortedReturns = returns.sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * (1 - this.confidenceLevel));
    const varReturn = sortedReturns[varIndex];
    return portfolioValue.times(new Decimal(varReturn));
  }

  private calculateCVaR(returns: number[], portfolioValue: Decimal): Decimal {
    const sortedReturns = returns.sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * (1 - this.confidenceLevel));
    const tailReturns = sortedReturns.slice(0, varIndex);
    const cvarReturn = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
    return portfolioValue.times(new Decimal(cvarReturn));
  }

  private calculateSharpeRatio(returns: number[], volatility: number): Decimal {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    return new Decimal(meanReturn - this.riskFreeRate.toNumber())
      .dividedBy(new Decimal(volatility));
  }

  private calculateMaxDrawdown(): Decimal {
    let maxDrawdown = new Decimal(0);
    const portfolioValues: Decimal[] = [];
    
    // Calculate historical portfolio values
    for (let i = 0; i < this.historicalWindow; i++) {
      let value = new Decimal(0);
      for (const [symbol, position] of this.positions.entries()) {
        const history = this.priceHistory.get(symbol);
        if (history && history.length > i) {
          value = value.plus(position.quantity.times(history[i]));
        }
      }
      portfolioValues.push(value);
    }
    
    let peak = portfolioValues[0];
    for (const value of portfolioValues) {
      if (value.greaterThan(peak)) {
        peak = value;
      } else {
        const drawdown = peak.minus(value).dividedBy(peak);
        if (drawdown.greaterThan(maxDrawdown)) {
          maxDrawdown = drawdown;
        }
      }
    }
    
    return maxDrawdown;
  }

  private async calculatePortfolioBeta(): Promise<Decimal> {
    // Use S&P 500 as market benchmark
    const marketReturns = await this.fetchMarketReturns();
    const portfolioReturns = this.calculateHistoricalReturns();
    
    const covariance = this.calculateCovariance(portfolioReturns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    
    return new Decimal(covariance).dividedBy(new Decimal(marketVariance));
  }

  private calculateCorrelations(): Record<string, number> {
    const correlations: Record<string, number> = {};
    const symbols = Array.from(this.positions.keys());
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        
        const returns1 = this.calculateAssetReturns(symbol1);
        const returns2 = this.calculateAssetReturns(symbol2);
        
        const correlation = this.calculateCorrelation(returns1, returns2);
        correlations[`${symbol1}_${symbol2}`] = correlation;
      }
    }
    
    return correlations;
  }

  private calculateKellyFraction(returns: number[]): Decimal {
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    
    const winProbability = wins.length / returns.length;
    const avgWin = wins.reduce((a, b) => a + b, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length);
    
    return new Decimal(winProbability)
      .times(new Decimal(avgWin))
      .dividedBy(new Decimal(avgLoss))
      .minus(new Decimal(1).minus(new Decimal(winProbability)));
  }

  private runStressTests(portfolioValue: Decimal): StressTestResult[] {
    return Object.entries(this.stressScenarios).map(([scenario, impact]) => {
      const potentialLoss = portfolioValue.times(new Decimal(impact));
      const impactedAssets = this.identifyImpactedAssets(scenario);
      
      return {
        scenario,
        potentialLoss,
        probabilityOfOccurrence: this.calculateScenarioProbability(scenario),
        impactedAssets
      };
    });
  }

  private calculateTotalExposure(): Decimal {
    return Array.from(this.positions.values()).reduce(
      (total, pos) => total.plus(
        pos.quantity.times(pos.current_price)
      ),
      new Decimal(0)
    ).dividedBy(this.calculatePortfolioValue());
  }

  private getAssetVolatility(symbol: string): Decimal {
    const history = this.volatilityHistory.get(symbol);
    if (!history || history.length === 0) {
      return new Decimal(0);
    }
    return history[history.length - 1];
  }

  private checkCorrelationRisk(symbol: string): {
    isHigh: boolean;
    correlatedAssets: string[];
  } {
    const correlatedAssets: string[] = [];
    const threshold = 0.7; // High correlation threshold
    
    for (const [existingSymbol] of this.positions.entries()) {
      if (existingSymbol !== symbol) {
        const correlation = this.calculatePairwiseCorrelation(symbol, existingSymbol);
        if (Math.abs(correlation) > threshold) {
          correlatedAssets.push(existingSymbol);
        }
      }
    }
    
    return {
      isHigh: correlatedAssets.length > 0,
      correlatedAssets
    };
  }

  private calculatePairwiseCorrelation(symbol1: string, symbol2: string): number {
    const returns1 = this.calculateAssetReturns(symbol1);
    const returns2 = this.calculateAssetReturns(symbol2);
    return this.calculateCorrelation(returns1, returns2);
  }

  private calculateAssetReturns(symbol: string): number[] {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      returns.push(
        history[i].minus(history[i-1])
          .dividedBy(history[i-1])
          .toNumber()
      );
    }
    return returns;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    const covariance = this.calculateCovariance(returns1, returns2);
    const std1 = Math.sqrt(this.calculateVariance(returns1));
    const std2 = Math.sqrt(this.calculateVariance(returns2));
    return covariance / (std1 * std2);
  }

  private calculateCovariance(returns1: number[], returns2: number[]): number {
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
    
    return returns1.reduce((sum, r1, i) => 
      sum + (r1 - mean1) * (returns2[i] - mean2), 0
    ) / (returns1.length - 1);
  }

  private calculateVariance(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    return returns.reduce((sum, r) => 
      sum + Math.pow(r - mean, 2), 0
    ) / (returns.length - 1);
  }

  private async fetchMarketReturns(): Promise<number[]> {
    // In a real implementation, this would fetch S&P 500 data
    // For now, return synthetic data
    return Array(this.historicalWindow).fill(0).map(() => 
      (Math.random() - 0.5) * 0.02
    );
  }

  private identifyImpactedAssets(scenario: string): string[] {
    // Identify assets most likely to be impacted by the scenario
    const impactedAssets: string[] = [];
    const positions = Array.from(this.positions.entries());
    
    switch (scenario) {
      case 'Market Crash':
        // All assets are impacted
        impactedAssets.push(...positions.map(([symbol]) => symbol));
        break;
      case 'Currency Crisis':
        // Forex and international assets
        impactedAssets.push(
          ...positions
            .filter(([symbol]) => symbol.includes('/'))
            .map(([symbol]) => symbol)
        );
        break;
      case 'Tech Bubble':
        // Technology-related assets
        impactedAssets.push(
          ...positions
            .filter(([symbol]) => ['BTC', 'ETH', 'SOL'].includes(symbol))
            .map(([symbol]) => symbol)
        );
        break;
      // Add more scenario-specific logic
    }
    
    return impactedAssets;
  }

  private calculateScenarioProbability(scenario: string): Decimal {
    // Calculate probability based on historical data and current market conditions
    // This is a simplified implementation
    const baseProbabilities: Record<string, number> = {
      'Market Crash': 0.05,
      'Currency Crisis': 0.08,
      'Political Event': 0.12,
      'Natural Disaster': 0.07,
      'Tech Bubble': 0.10,
      'Interest Rate Hike': 0.15
    };
    
    return new Decimal(baseProbabilities[scenario] || 0.05);
  }

  private triggerStopLoss(symbol: string, position: Position): void {
    console.warn(`Stop loss triggered for ${symbol} at ${position.current_price}`);
    // Implement stop loss logic (e.g., emit event, execute sell order)
  }

  private triggerDrawdownAlert(
    symbol: string,
    position: Position,
    drawdown: Decimal
  ): void {
    console.warn(
      `Drawdown alert for ${symbol}: ${drawdown.times(100).toFixed(2)}%`
    );
    // Implement drawdown alert logic
  }

  public updatePosition(symbol: string, position: Position): void {
    this.positions.set(symbol, position);
  }

  public updatePriceHistory(symbol: string, price: Decimal): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    
    if (history.length > this.historicalWindow) {
      history.shift();
    }
    
    // Update volatility history
    if (!this.volatilityHistory.has(symbol)) {
      this.volatilityHistory.set(symbol, []);
    }
    
    const volHistory = this.volatilityHistory.get(symbol)!;
    if (history.length > 1) {
      const returns = this.calculateAssetReturns(symbol);
      const volatility = Math.sqrt(this.calculateVariance(returns) * 252);
      volHistory.push(new Decimal(volatility));
      
      if (volHistory.length > this.historicalWindow) {
        volHistory.shift();
      }
    }
  }

  public setRiskLimits(limits: Partial<RiskLimits>): void {
    this.riskLimits = {
      ...this.riskLimits,
      ...limits
    };
  }
}