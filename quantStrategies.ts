import { Matrix } from 'ml-matrix';
import { Decimal } from 'decimal.js';
import * as stats from 'simple-statistics';
import { Signal } from './algorithmService';

interface StrategyParams {
  lookbackPeriod?: number;
  deviationThreshold?: number;
  topN?: number;
  riskAversion?: number;
  minCorrelation?: number;
}

export class QuantStrategies {
  // Mean-Variance Optimization Strategy
  public meanVarianceOptimizer(
    returns: number[][],
    params: StrategyParams = {}
  ): {
    weights: number[];
    expectedReturn: number;
    volatility: number;
  } {
    const { riskAversion = 2 } = params;
    
    // Calculate expected returns and covariance matrix
    const meanReturns = returns.map(asset => 
      stats.mean(asset)
    );
    
    const covMatrix = this.calculateCovarianceMatrix(returns);
    
    // Optimize portfolio weights
    const weights = this.findOptimalWeights(
      meanReturns,
      covMatrix,
      riskAversion
    );
    
    // Calculate portfolio metrics
    const expectedReturn = weights.reduce(
      (sum, w, i) => sum + w * meanReturns[i],
      0
    );
    
    const volatility = Math.sqrt(
      weights.reduce((sum, w, i) => 
        sum + weights.reduce((s, w2, j) => 
          s + w * w2 * covMatrix.get(i, j),
          0
        ),
        0
      )
    );
    
    return {
      weights,
      expectedReturn,
      volatility
    };
  }

  // Factor Sorting Strategy
  public factorSort(
    factors: {
      symbol: string;
      value: number;
      momentum: number;
      volatility: number;
    }[],
    params: StrategyParams = {}
  ): Signal[] {
    const { topN = 5 } = params;
    
    // Calculate composite score
    const scores = factors.map(factor => ({
      symbol: factor.symbol,
      score: this.zScore(factor.value) + 
             this.zScore(factor.momentum) - 
             this.zScore(factor.volatility)
    }));
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Generate signals for top N assets
    return scores.slice(0, topN).map(asset => ({
      symbol: asset.symbol,
      type: 'BUY',
      price: new Decimal(0), // Price to be filled by execution system
      confidence: Math.min(Math.abs(asset.score) / 3, 1),
      timestamp: Date.now(),
      strategy: 'Factor Sort',
      metadata: {
        score: asset.score,
        rank: scores.findIndex(s => s.symbol === asset.symbol) + 1
      }
    }));
  }

  // Statistical Arbitrage (Pairs Trading)
  public pairsTrading(
    prices: { [symbol: string]: number[] },
    params: StrategyParams = {}
  ): Signal[] {
    const { 
      lookbackPeriod = 20,
      deviationThreshold = 2,
      minCorrelation = 0.7
    } = params;

    const signals: Signal[] = [];
    const symbols = Object.keys(prices);

    // Find correlated pairs
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        
        const returns1 = this.calculateReturns(prices[symbol1]);
        const returns2 = this.calculateReturns(prices[symbol2]);
        
        const correlation = stats.sampleCorrelation(returns1, returns2);
        
        if (Math.abs(correlation) > minCorrelation) {
          // Calculate hedge ratio using linear regression
          const regression = this.linearRegression(
            returns1,
            returns2
          );
          
          // Calculate spread
          const spread = prices[symbol1].map((p1, idx) => 
            p1 - regression.slope * prices[symbol2][idx] - regression.intercept
          );
          
          // Calculate z-score of spread
          const zScore = this.zScore(spread[spread.length - 1]);
          
          if (Math.abs(zScore) > deviationThreshold) {
            const isLong = zScore < -deviationThreshold;
            
            // Generate signals for both legs
            signals.push(
              {
                symbol: symbol1,
                type: isLong ? 'BUY' : 'SELL',
                price: new Decimal(prices[symbol1][prices[symbol1].length - 1]),
                confidence: Math.min(Math.abs(zScore) / 4, 1),
                timestamp: Date.now(),
                strategy: 'Pairs Trading',
                metadata: {
                  pair: symbol2,
                  correlation,
                  hedgeRatio: regression.slope,
                  zScore
                }
              },
              {
                symbol: symbol2,
                type: isLong ? 'SELL' : 'BUY',
                price: new Decimal(prices[symbol2][prices[symbol2].length - 1]),
                confidence: Math.min(Math.abs(zScore) / 4, 1),
                timestamp: Date.now(),
                strategy: 'Pairs Trading',
                metadata: {
                  pair: symbol1,
                  correlation,
                  hedgeRatio: regression.slope,
                  zScore
                }
              }
            );
          }
        }
      }
    }

    return signals;
  }

  // Risk Cluster Rotation
  public riskClusterRotation(
    returns: number[][],
    params: StrategyParams = {}
  ): {
    clusters: number[];
    weights: number[];
  } {
    // Calculate correlation matrix
    const corrMatrix = this.calculateCorrelationMatrix(returns);
    
    // Perform PCA
    const { eigenVectors, eigenValues } = this.principalComponentAnalysis(corrMatrix);
    
    // Use top 3 principal components for clustering
    const components = eigenVectors.subMatrix(0, eigenVectors.rows - 1, 0, 2);
    
    // Cluster assets
    const clusters = this.kMeansClustering(components, 3);
    
    // Calculate inverse risk concentration weights
    const riskContribution = components.sum('row').map(Math.abs);
    const weights = riskContribution.map(risk => 1 / (risk + 1e-6));
    
    // Normalize weights
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    return {
      clusters,
      weights: normalizedWeights
    };
  }

  // Helper Methods
  private calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateCovarianceMatrix(returns: number[][]): Matrix {
    const n = returns.length;
    const matrix = new Matrix(n, n);
    
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const cov = stats.sampleCovariance(returns[i], returns[j]);
        matrix.set(i, j, cov);
        matrix.set(j, i, cov);
      }
    }
    
    return matrix;
  }

  private calculateCorrelationMatrix(returns: number[][]): Matrix {
    const n = returns.length;
    const matrix = new Matrix(n, n);
    
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const corr = stats.sampleCorrelation(returns[i], returns[j]);
        matrix.set(i, j, corr);
        matrix.set(j, i, corr);
      }
    }
    
    return matrix;
  }

  private findOptimalWeights(
    returns: number[],
    covariance: Matrix,
    riskAversion: number
  ): number[] {
    const n = returns.length;
    const weights = new Array(n).fill(1 / n);
    
    // Simple implementation using gradient descent
    for (let iter = 0; iter < 100; iter++) {
      const gradient = returns.map((r, i) => {
        const riskTerm = covariance.getRow(i).reduce(
          (sum, cov, j) => sum + cov * weights[j] * riskAversion,
          0
        );
        return r - riskTerm;
      });
      
      // Update weights
      weights.forEach((w, i) => {
        weights[i] = Math.max(0, w + 0.01 * gradient[i]);
      });
      
      // Normalize weights
      const sum = weights.reduce((a, b) => a + b, 0);
      weights.forEach((w, i) => {
        weights[i] = w / sum;
      });
    }
    
    return weights;
  }

  private linearRegression(x: number[], y: number[]): {
    slope: number;
    intercept: number;
  } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  private principalComponentAnalysis(matrix: Matrix): {
    eigenVectors: Matrix;
    eigenValues: number[];
  } {
    const n = matrix.rows;
    const eigenValues: number[] = [];
    const eigenVectors = new Matrix(n, n);
    
    // Power iteration method for first few components
    for (let i = 0; i < 3; i++) {
      let vector = Matrix.random(n, 1);
      let prevEigenValue = 0;
      
      for (let iter = 0; iter < 100; iter++) {
        vector = matrix.mmul(vector);
        const norm = Math.sqrt(vector.sum(v => v * v));
        vector = vector.div(norm);
        
        const eigenValue = vector.transpose().mmul(matrix).mmul(vector).get(0, 0);
        if (Math.abs(eigenValue - prevEigenValue) < 1e-6) break;
        prevEigenValue = eigenValue;
      }
      
      eigenValues.push(prevEigenValue);
      eigenVectors.setColumn(i, vector.getColumn(0));
      
      // Deflate matrix
      const outer = vector.mmul(vector.transpose());
      matrix = matrix.sub(outer.mul(prevEigenValue));
    }
    
    return { eigenVectors, eigenValues };
  }

  private kMeansClustering(data: Matrix, k: number): number[] {
    const n = data.rows;
    const clusters = new Array(n).fill(0);
    
    // Initialize centroids
    let centroids = Matrix.random(k, data.columns);
    let changed = true;
    
    while (changed) {
      changed = false;
      
      // Assign points to nearest centroid
      for (let i = 0; i < n; i++) {
        const point = data.getRow(i);
        let minDist = Infinity;
        let cluster = 0;
        
        for (let j = 0; j < k; j++) {
          const dist = this.euclideanDistance(point, centroids.getRow(j));
          if (dist < minDist) {
            minDist = dist;
            cluster = j;
          }
        }
        
        if (clusters[i] !== cluster) {
          clusters[i] = cluster;
          changed = true;
        }
      }
      
      // Update centroids
      for (let j = 0; j < k; j++) {
        const points = data.selection(
          clusters.map((c, idx) => c === j ? idx : -1).filter(idx => idx !== -1)
        );
        if (points.rows > 0) {
          centroids.setRow(j, points.mean('column'));
        }
      }
    }
    
    return clusters;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
  }

  private zScore(value: number, values?: number[]): number {
    if (values) {
      const mean = stats.mean(values);
      const std = stats.standardDeviation(values);
      return (value - mean) / (std || 1);
    }
    return value;
  }
}