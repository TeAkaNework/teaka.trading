import { Matrix } from 'ml-matrix';
import Decimal from 'decimal.js';

interface Asset {
  symbol: string;
  weight: Decimal;
  expectedReturn: Decimal;
  volatility: Decimal;
}

interface OptimizationResult {
  weights: Record<string, Decimal>;
  expectedReturn: Decimal;
  portfolioRisk: Decimal;
  sharpeRatio: Decimal;
}

export class PortfolioOptimizer {
  private riskFreeRate = new Decimal(0.02);  // 2% annual risk-free rate
  private targetReturn: Decimal | null = null;
  private riskTolerance = new Decimal(0.5);  // Risk aversion parameter

  private calculateReturns(prices: Decimal[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(
        prices[i].minus(prices[i - 1])
          .dividedBy(prices[i - 1])
          .toNumber()
      );
    }
    return returns;
  }

  private calculateCovarianceMatrix(returns: number[][]): Matrix {
    const numAssets = returns.length;
    const covariance = new Matrix(numAssets, numAssets);
    
    for (let i = 0; i < numAssets; i++) {
      for (let j = i; j < numAssets; j++) {
        const cov = this.calculateCovariance(returns[i], returns[j]);
        covariance.set(i, j, cov);
        covariance.set(j, i, cov);
      }
    }
    
    return covariance;
  }

  private calculateCovariance(returns1: number[], returns2: number[]): number {
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
    
    const sum = returns1.reduce((acc, r1, i) => {
      return acc + (r1 - mean1) * (returns2[i] - mean2);
    }, 0);
    
    return sum / (returns1.length - 1);
  }

  private calculatePortfolioRisk(
    weights: number[],
    covarianceMatrix: Matrix
  ): number {
    const weightMatrix = Matrix.columnVector(weights);
    const risk = weightMatrix
      .transpose()
      .mmul(covarianceMatrix)
      .mmul(weightMatrix)
      .get(0, 0);
    
    return Math.sqrt(risk);
  }

  private calculatePortfolioReturn(
    weights: number[],
    expectedReturns: number[]
  ): number {
    return weights.reduce(
      (acc, weight, i) => acc + weight * expectedReturns[i],
      0
    );
  }

  public optimize(assets: Asset[]): OptimizationResult {
    const numAssets = assets.length;
    const returns = assets.map(asset => asset.expectedReturn.toNumber());
    const volatilities = assets.map(asset => asset.volatility.toNumber());
    
    // Create correlation matrix
    const correlationMatrix = new Matrix(numAssets, numAssets);
    for (let i = 0; i < numAssets; i++) {
      for (let j = 0; j < numAssets; j++) {
        if (i === j) {
          correlationMatrix.set(i, j, 1);
        } else {
          // Assuming some correlation between assets
          correlationMatrix.set(i, j, 0.5);
        }
      }
    }
    
    // Create covariance matrix
    const covarianceMatrix = new Matrix(numAssets, numAssets);
    for (let i = 0; i < numAssets; i++) {
      for (let j = 0; j < numAssets; j++) {
        covarianceMatrix.set(
          i,
          j,
          correlationMatrix.get(i, j) * volatilities[i] * volatilities[j]
        );
      }
    }
    
    // Initialize weights equally
    let weights = Array(numAssets).fill(1 / numAssets);
    
    // Optimization using gradient descent
    const learningRate = 0.01;
    const iterations = 1000;
    
    for (let iter = 0; iter < iterations; iter++) {
      const portfolioReturn = this.calculatePortfolioReturn(weights, returns);
      const portfolioRisk = this.calculatePortfolioRisk(weights, covarianceMatrix);
      
      // Calculate utility (mean-variance optimization)
      const utility = portfolioReturn - this.riskTolerance.toNumber() * Math.pow(portfolioRisk, 2);
      
      // Calculate gradients
      const gradients = weights.map((weight, i) => {
        const returnGrad = returns[i];
        const riskGrad = 2 * this.riskTolerance.toNumber() * portfolioRisk *
          covarianceMatrix.getRow(i).reduce((acc, cov, j) => acc + cov * weights[j], 0);
        return returnGrad - riskGrad;
      });
      
      // Update weights
      weights = weights.map((weight, i) => {
        const newWeight = weight + learningRate * gradients[i];
        return Math.max(0, Math.min(1, newWeight));  // Ensure weights are between 0 and 1
      });
      
      // Normalize weights to sum to 1
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
    }
    
    // Calculate final portfolio metrics
    const finalReturn = this.calculatePortfolioReturn(weights, returns);
    const finalRisk = this.calculatePortfolioRisk(weights, covarianceMatrix);
    const sharpeRatio = (finalReturn - this.riskFreeRate.toNumber()) / finalRisk;
    
    return {
      weights: Object.fromEntries(
        assets.map((asset, i) => [asset.symbol, new Decimal(weights[i])])
      ),
      expectedReturn: new Decimal(finalReturn),
      portfolioRisk: new Decimal(finalRisk),
      sharpeRatio: new Decimal(sharpeRatio)
    };
  }

  public setTargetReturn(target: Decimal) {
    this.targetReturn = target;
  }

  public setRiskTolerance(tolerance: Decimal) {
    this.riskTolerance = tolerance;
  }
}