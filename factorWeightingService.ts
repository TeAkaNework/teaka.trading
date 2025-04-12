import { Decimal } from 'decimal.js';
import { Matrix } from 'ml-matrix';
import * as stats from 'simple-statistics';
import { logger } from '../utils/logger';

interface Factor {
  name: string;
  value: number;
  weight: number;
  performance: {
    predictivePower: number;
    stability: number;
    turnover: number;
  };
}

interface FactorUpdate {
  name: string;
  value: number;
  timestamp: number;
  predictedReturn: number;
  actualReturn: number;
}

export class FactorWeightingService {
  private factors: Map<string, Factor>;
  private readonly HISTORY_WINDOW = 100;
  private factorHistory: Map<string, FactorUpdate[]>;
  private correlationMatrix: Matrix | null = null;
  private readonly MIN_WEIGHT = 0.05;
  private readonly MAX_WEIGHT = 0.4;
  private readonly LEARNING_RATE = 0.01;

  constructor() {
    this.factors = new Map();
    this.factorHistory = new Map();
    this.initializeDefaultFactors();
  }

  private initializeDefaultFactors() {
    const defaultFactors = [
      {
        name: 'momentum',
        weight: 0.2,
        performance: {
          predictivePower: 0.5,
          stability: 0.7,
          turnover: 0.3
        }
      },
      {
        name: 'value',
        weight: 0.2,
        performance: {
          predictivePower: 0.6,
          stability: 0.8,
          turnover: 0.2
        }
      },
      {
        name: 'volatility',
        weight: 0.15,
        performance: {
          predictivePower: 0.4,
          stability: 0.6,
          turnover: 0.4
        }
      },
      {
        name: 'quality',
        weight: 0.15,
        performance: {
          predictivePower: 0.5,
          stability: 0.7,
          turnover: 0.3
        }
      },
      {
        name: 'sentiment',
        weight: 0.15,
        performance: {
          predictivePower: 0.4,
          stability: 0.5,
          turnover: 0.5
        }
      },
      {
        name: 'liquidity',
        weight: 0.15,
        performance: {
          predictivePower: 0.3,
          stability: 0.6,
          turnover: 0.4
        }
      }
    ];

    defaultFactors.forEach(factor => {
      this.factors.set(factor.name, {
        ...factor,
        value: 0
      });
      this.factorHistory.set(factor.name, []);
    });
  }

  public async updateFactors(updates: FactorUpdate[]): Promise<void> {
    try {
      // Update factor values and history
      for (const update of updates) {
        const factor = this.factors.get(update.name);
        if (!factor) continue;

        // Update factor value
        factor.value = update.value;

        // Update history
        const history = this.factorHistory.get(update.name) || [];
        history.push(update);
        if (history.length > this.HISTORY_WINDOW) {
          history.shift();
        }
        this.factorHistory.set(update.name, history);

        // Update performance metrics
        this.updateFactorPerformance(update.name);
      }

      // Recalculate correlation matrix
      await this.updateCorrelationMatrix();

      // Adjust weights based on new data
      this.adjustWeights();

      logger.info('Factors updated', {
        factorCount: updates.length,
        weights: Object.fromEntries(
          Array.from(this.factors.entries()).map(([name, factor]) => [
            name,
            factor.weight
          ])
        )
      });

    } catch (error) {
      logger.error('Error updating factors:', error);
      throw error;
    }
  }

  private updateFactorPerformance(factorName: string): void {
    const history = this.factorHistory.get(factorName);
    if (!history || history.length < 2) return;

    const factor = this.factors.get(factorName)!;

    // Calculate predictive power (correlation between predicted and actual returns)
    const predictions = history.map(h => h.predictedReturn);
    const actuals = history.map(h => h.actualReturn);
    const predictivePower = Math.abs(stats.sampleCorrelation(predictions, actuals));

    // Calculate stability (autocorrelation of factor values)
    const values = history.map(h => h.value);
    const stability = Math.abs(stats.sampleCorrelation(
      values.slice(0, -1),
      values.slice(1)
    ));

    // Calculate turnover (average absolute change in factor values)
    const changes = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const turnover = stats.mean(changes);

    factor.performance = {
      predictivePower,
      stability,
      turnover: Math.min(turnover, 1)
    };
  }

  private async updateCorrelationMatrix(): Promise<void> {
    const factorNames = Array.from(this.factors.keys());
    const n = factorNames.length;
    this.correlationMatrix = new Matrix(n, n);

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const factor1 = this.factorHistory.get(factorNames[i]) || [];
        const factor2 = this.factorHistory.get(factorNames[j]) || [];

        const values1 = factor1.map(f => f.value);
        const values2 = factor2.map(f => f.value);

        const correlation = i === j ? 1 : stats.sampleCorrelation(values1, values2);

        this.correlationMatrix.set(i, j, correlation);
        this.correlationMatrix.set(j, i, correlation);
      }
    }
  }

  private adjustWeights(): void {
    const factorArray = Array.from(this.factors.values());
    const n = factorArray.length;

    // Calculate raw scores based on performance metrics
    const scores = factorArray.map(factor => {
      const { predictivePower, stability, turnover } = factor.performance;
      return (
        predictivePower * 0.4 +  // 40% weight on predictive power
        stability * 0.4 +        // 40% weight on stability
        (1 - turnover) * 0.2     // 20% weight on low turnover
      );
    });

    // Adjust for correlations
    if (this.correlationMatrix) {
      for (let i = 0; i < n; i++) {
        let correlationPenalty = 0;
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            correlationPenalty += Math.abs(this.correlationMatrix.get(i, j));
          }
        }
        scores[i] *= (1 - correlationPenalty / (2 * n));
      }
    }

    // Convert scores to weights using softmax
    const expScores = scores.map(s => Math.exp(s));
    const sumExpScores = expScores.reduce((a, b) => a + b, 0);
    const rawWeights = expScores.map(s => s / sumExpScores);

    // Apply weight constraints and normalize
    let weights = this.applyWeightConstraints(rawWeights);

    // Update factor weights
    factorArray.forEach((factor, i) => {
      factor.weight = weights[i];
    });
  }

  private applyWeightConstraints(weights: number[]): number[] {
    let adjustedWeights = weights.map(w => 
      Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, w))
    );

    // Normalize to sum to 1
    const sum = adjustedWeights.reduce((a, b) => a + b, 0);
    return adjustedWeights.map(w => w / sum);
  }

  public calculateCompositeScore(factorValues: Record<string, number>): number {
    let score = 0;
    let totalWeight = 0;

    for (const [name, value] of Object.entries(factorValues)) {
      const factor = this.factors.get(name);
      if (factor) {
        score += value * factor.weight;
        totalWeight += factor.weight;
      }
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  public getFactorWeights(): Record<string, number> {
    return Object.fromEntries(
      Array.from(this.factors.entries()).map(([name, factor]) => [
        name,
        factor.weight
      ])
    );
  }

  public getFactorPerformance(): Record<string, Factor['performance']> {
    return Object.fromEntries(
      Array.from(this.factors.entries()).map(([name, factor]) => [
        name,
        factor.performance
      ])
    );
  }

  public addCustomFactor(
    name: string,
    initialWeight: number,
    performance: Factor['performance']
  ): void {
    if (this.factors.has(name)) {
      throw new Error(`Factor ${name} already exists`);
    }

    this.factors.set(name, {
      name,
      value: 0,
      weight: Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, initialWeight)),
      performance
    });

    this.factorHistory.set(name, []);
  }

  public removeCustomFactor(name: string): void {
    if (!this.factors.has(name)) {
      throw new Error(`Factor ${name} not found`);
    }

    this.factors.delete(name);
    this.factorHistory.delete(name);
  }
}