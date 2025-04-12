import { Matrix } from 'ml-matrix';
import { PCA } from 'ml-pca';
import { SimpleLinearRegression } from 'ml-regression';
import Decimal from 'decimal.js';
import * as stats from 'simple-statistics';
import { Signal } from './algorithmService';

interface FactorData {
  symbol: string;
  factors: Record<string, number>;
  returns: number[];
}

interface PairStrategy {
  symbol1: string;
  symbol2: string;
  beta: number;
  correlation: number;
  spreadZScore: number;
}

export class QuantEngine {
  private factorData: Map<string, FactorData> = new Map();
  private correlationMatrix: Matrix | null = null;
  private pca: PCA | null = null;
  private lookbackPeriod = 252; // 1 year of daily data
  private zScoreThreshold = 2;
  private minCorrelation = 0.7;

  // Factor-based strategy
  public async calculateFactorScores(data: FactorData[]): Promise<Record<string, number>> {
    const factorMatrix = new Matrix(
      data.map(d => Object.values(d.factors))
    );
    
    // Standardize factors
    const standardized = this.standardizeMatrix(factorMatrix);
    
    // Calculate factor exposures using PCA
    this.pca = new PCA(standardized);
    const explained = this.pca.getExplainedVariance();
    const components = this.pca.getEigenvectors();
    
    // Calculate factor scores
    const scores: Record<string, number> = {};
    data.forEach((d, i) => {
      const row = standardized.getRow(i);
      const score = components.mmul(Matrix.columnVector(row)).get(0, 0);
      scores[d.symbol] = score;
    });
    
    return scores;
  }

  // Pairs trading strategy
  public findPairs(prices: Map<string, number[]>): PairStrategy[] {
    const symbols = Array.from(prices.keys());
    const pairs: PairStrategy[] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbol1 = symbols[i];
        const symbol2 = symbols[j];
        
        const returns1 = this.calculateReturns(prices.get(symbol1)!);
        const returns2 = this.calculateReturns(prices.get(symbol2)!);
        
        const correlation = stats.sampleCorrelation(returns1, returns2);
        
        if (Math.abs(correlation) > this.minCorrelation) {
          // Calculate hedge ratio using linear regression
          const regression = new SimpleLinearRegression(returns1, returns2);
          const beta = regression.slope;
          
          // Calculate spread
          const spread = this.calculateSpread(
            prices.get(symbol1)!,
            prices.get(symbol2)!,
            beta
          );
          
          const spreadZScore = this.calculateZScore(spread);
          
          pairs.push({
            symbol1,
            symbol2,
            beta,
            correlation,
            spreadZScore
          });
        }
      }
    }
    
    return pairs;
  }

  // Statistical arbitrage signals
  public generateStatArbSignals(pairs: PairStrategy[]): Signal[] {
    const signals: Signal[] = [];
    
    for (const pair of pairs) {
      if (Math.abs(pair.spreadZScore) > this.zScoreThreshold) {
        const isLong = pair.spreadZScore < -this.zScoreThreshold;
        
        signals.push({
          symbol: pair.symbol1,
          type: isLong ? 'BUY' : 'SELL',
          confidence: Math.min(Math.abs(pair.spreadZScore) / 4, 1),
          price: new Decimal(0), // Price to be filled by execution system
          timestamp: Date.now(),
          strategy: 'Statistical Arbitrage',
          metadata: {
            pair: pair.symbol2,
            correlation: pair.correlation,
            beta: pair.beta,
            spreadZScore: pair.spreadZScore
          }
        });
        
        signals.push({
          symbol: pair.symbol2,
          type: isLong ? 'SELL' : 'BUY',
          confidence: Math.min(Math.abs(pair.spreadZScore) / 4, 1),
          price: new Decimal(0), // Price to be filled by execution system
          timestamp: Date.now(),
          strategy: 'Statistical Arbitrage',
          metadata: {
            pair: pair.symbol1,
            correlation: pair.correlation,
            beta: pair.beta,
            spreadZScore: pair.spreadZScore
          }
        });
      }
    }
    
    return signals;
  }

  // Correlation-based cluster rotation
  public async findClusters(returns: Matrix): Promise<number[]> {
    // Calculate correlation matrix
    this.correlationMatrix = this.calculateCorrelationMatrix(returns);
    
    // Use PCA for dimensionality reduction
    this.pca = new PCA(returns);
    const components = this.pca.getEigenvectors();
    const scores = returns.mmul(components);
    
    // Simple clustering based on first two principal components
    const clusters = this.kMeansClustering(scores.subMatrix(0, scores.rows - 1, 0, 1), 3);
    
    return clusters;
  }

  // Mean-variance optimization
  public optimizePortfolio(
    returns: number[][],
    riskFreeRate: number = 0.02
  ): {
    weights: number[];
    expectedReturn: number;
    volatility: number;
    sharpeRatio: number;
  } {
    const meanReturns = returns.map(r => 
      stats.mean(r)
    );
    
    const covMatrix = this.calculateCovarianceMatrix(returns);
    
    // Optimize using mean-variance optimization
    const weights = this.findOptimalWeights(meanReturns, covMatrix);
    
    const portfolioReturn = weights.reduce(
      (sum, w, i) => sum + w * meanReturns[i],
      0
    );
    
    const portfolioVolatility = Math.sqrt(
      weights.reduce((sum, w, i) => 
        sum + weights.reduce((s, w2, j) => 
          s + w * w2 * covMatrix.get(i, j),
          0
        ),
        0
      )
    );
    
    const sharpeRatio = (portfolioReturn - riskFreeRate) / portfolioVolatility;
    
    return {
      weights,
      expectedReturn: portfolioReturn,
      volatility: portfolioVolatility,
      sharpeRatio
    };
  }

  // Helper methods
  private standardizeMatrix(matrix: Matrix): Matrix {
    const means = [];
    const stds = [];
    
    for (let j = 0; j < matrix.columns; j++) {
      const column = matrix.getColumn(j);
      means.push(stats.mean(column));
      stds.push(stats.standardDeviation(column));
    }
    
    return new Matrix(
      matrix.to2DArray().map(row =>
        row.map((val, j) => (val - means[j]) / stds[j])
      )
    );
  }

  private calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateSpread(
    prices1: number[],
    prices2: number[],
    beta: number
  ): number[] {
    return prices1.map((p1, i) => 
      Math.log(p1) - beta * Math.log(prices2[i])
    );
  }

  private calculateZScore(data: number[]): number {
    const mean = stats.mean(data);
    const std = stats.standardDeviation(data);
    return (data[data.length - 1] - mean) / std;
  }

  private calculateCorrelationMatrix(returns: Matrix): Matrix {
    const correlation = new Matrix(returns.columns, returns.columns);
    
    for (let i = 0; i < returns.columns; i++) {
      for (let j = i; j < returns.columns; j++) {
        const corr = stats.sampleCorrelation(
          returns.getColumn(i),
          returns.getColumn(j)
        );
        correlation.set(i, j, corr);
        correlation.set(j, i, corr);
      }
    }
    
    return correlation;
  }

  private calculateCovarianceMatrix(returns: number[][]): Matrix {
    const n = returns.length;
    const covariance = new Matrix(n, n);
    
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const cov = stats.sampleCovariance(returns[i], returns[j]);
        covariance.set(i, j, cov);
        covariance.set(j, i, cov);
      }
    }
    
    return covariance;
  }

  private kMeansClustering(data: Matrix, k: number): number[] {
    // Simple k-means implementation
    const points = data.to2DArray();
    const n = points.length;
    let centroids = points.slice(0, k);
    let clusters = new Array(n).fill(0);
    let changed = true;
    
    while (changed) {
      changed = false;
      
      // Assign points to nearest centroid
      for (let i = 0; i < n; i++) {
        const point = points[i];
        let minDist = Infinity;
        let cluster = 0;
        
        for (let j = 0; j < k; j++) {
          const dist = this.euclideanDistance(point, centroids[j]);
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
      const newCentroids = new Array(k).fill(0).map(() => [0, 0]);
      const counts = new Array(k).fill(0);
      
      for (let i = 0; i < n; i++) {
        const cluster = clusters[i];
        const point = points[i];
        newCentroids[cluster][0] += point[0];
        newCentroids[cluster][1] += point[1];
        counts[cluster]++;
      }
      
      centroids = newCentroids.map((centroid, i) => [
        centroid[0] / counts[i],
        centroid[1] / counts[i]
      ]);
    }
    
    return clusters;
  }

  private euclideanDistance(p1: number[], p2: number[]): number {
    return Math.sqrt(
      p1.reduce((sum, val, i) => 
        sum + Math.pow(val - p2[i], 2),
        0
      )
    );
  }

  private findOptimalWeights(returns: number[], covariance: Matrix): number[] {
    // Simple implementation using equal risk contribution
    const n = returns.length;
    const weights = new Array(n).fill(1 / n);
    
    // Refine weights using risk parity
    for (let iter = 0; iter < 100; iter++) {
      const marginalRisk = weights.map((w, i) =>
        weights.reduce((sum, w2, j) =>
          sum + w2 * covariance.get(i, j),
          0
        )
      );
      
      const totalRisk = Math.sqrt(
        weights.reduce((sum, w, i) =>
          sum + w * marginalRisk[i],
          0
        )
      );
      
      const targetRisk = totalRisk / n;
      
      // Update weights
      weights.forEach((w, i) => {
        weights[i] = w * (targetRisk / marginalRisk[i]);
      });
      
      // Normalize weights
      const sum = weights.reduce((a, b) => a + b, 0);
      weights.forEach((w, i) => {
        weights[i] = w / sum;
      });
    }
    
    return weights;
  }
}