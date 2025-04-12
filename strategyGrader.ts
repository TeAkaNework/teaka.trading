import { BacktestResult } from './backtestEngine';
import { logger } from '../utils/logger';

export interface GradeResult {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  metrics: {
    profitScore: number;
    riskScore: number;
    consistencyScore: number;
    robustnessScore: number;
  };
  notes: string[];
}

export class StrategyGrader {
  private readonly GRADE_THRESHOLDS = {
    A: 85,
    B: 70,
    C: 55,
    D: 40
  };

  public gradeStrategy(result: BacktestResult): GradeResult {
    try {
      // Calculate individual metric scores
      const profitScore = this.calculateProfitScore(result);
      const riskScore = this.calculateRiskScore(result);
      const consistencyScore = this.calculateConsistencyScore(result);
      const robustnessScore = this.calculateRobustnessScore(result);

      // Calculate total score (weighted average)
      const totalScore = (
        profitScore * 0.3 +     // 30% weight on profit metrics
        riskScore * 0.3 +       // 30% weight on risk metrics
        consistencyScore * 0.2 + // 20% weight on consistency
        robustnessScore * 0.2    // 20% weight on robustness
      );

      // Determine grade
      const grade = this.determineGrade(totalScore);

      // Generate notes
      const notes = this.generateNotes({
        profitScore,
        riskScore,
        consistencyScore,
        robustnessScore,
        result
      });

      return {
        grade,
        score: totalScore,
        metrics: {
          profitScore,
          riskScore,
          consistencyScore,
          robustnessScore
        },
        notes
      };
    } catch (error) {
      logger.error('Error grading strategy:', error);
      throw error;
    }
  }

  private calculateProfitScore(result: BacktestResult): number {
    const { metrics } = result;
    
    // Score components
    const pnlScore = Math.min(metrics.pnl / 1000, 100); // Scale PnL to 0-100
    const sharpeScore = Math.min(metrics.sharpeRatio * 25, 100); // Scale Sharpe to 0-100
    const profitFactorScore = Math.min(metrics.profitFactor * 20, 100); // Scale profit factor to 0-100
    
    // Weighted average
    return (pnlScore * 0.4 + sharpeScore * 0.3 + profitFactorScore * 0.3);
  }

  private calculateRiskScore(result: BacktestResult): number {
    const { metrics } = result;
    
    // Score components
    const drawdownScore = 100 - Math.min(metrics.maxDrawdown * 200, 100); // Penalize large drawdowns
    const exposureScore = 100 - Math.min(metrics.exposure, 100); // Penalize high exposure
    const winRateScore = Math.min(metrics.winRate, 100);
    
    // Weighted average
    return (drawdownScore * 0.4 + exposureScore * 0.3 + winRateScore * 0.3);
  }

  private calculateConsistencyScore(result: BacktestResult): number {
    const { metrics } = result;
    
    // Calculate monthly return consistency
    const monthlyReturns = Object.values(metrics.monthlyReturns);
    const avgReturn = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
    const returnVolatility = Math.sqrt(
      monthlyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / monthlyReturns.length
    );
    
    const consistencyScore = 100 - Math.min(returnVolatility * 100, 100);
    const tradingFrequencyScore = Math.min(metrics.totalTrades / 100, 1) * 100;
    
    return (consistencyScore * 0.7 + tradingFrequencyScore * 0.3);
  }

  private calculateRobustnessScore(result: BacktestResult): number {
    const { metrics } = result;
    
    // Score components
    const avgWinLossRatio = metrics.averageWin / Math.abs(metrics.averageLoss);
    const ratioScore = Math.min(avgWinLossRatio * 25, 100);
    
    const holdingPeriodScore = Math.min(metrics.averageHoldingPeriod / 5, 1) * 100;
    
    return (ratioScore * 0.7 + holdingPeriodScore * 0.3);
  }

  private determineGrade(score: number): GradeResult['grade'] {
    if (score >= this.GRADE_THRESHOLDS.A) return 'A';
    if (score >= this.GRADE_THRESHOLDS.B) return 'B';
    if (score >= this.GRADE_THRESHOLDS.C) return 'C';
    if (score >= this.GRADE_THRESHOLDS.D) return 'D';
    return 'F';
  }

  private generateNotes(data: {
    profitScore: number;
    riskScore: number;
    consistencyScore: number;
    robustnessScore: number;
    result: BacktestResult;
  }): string[] {
    const notes: string[] = [];

    // Profit analysis
    if (data.profitScore >= 80) {
      notes.push('Excellent profit generation with strong risk-adjusted returns');
    } else if (data.profitScore < 50) {
      notes.push('Strategy profitability needs improvement');
    }

    // Risk analysis
    if (data.riskScore >= 80) {
      notes.push('Well-controlled risk metrics with good capital preservation');
    } else if (data.result.metrics.maxDrawdown > 0.2) {
      notes.push('High drawdown risk - consider adjusting position sizing');
    }

    // Consistency analysis
    if (data.consistencyScore >= 80) {
      notes.push('Consistent performance across different market conditions');
    } else if (data.consistencyScore < 50) {
      notes.push('Performance consistency could be improved');
    }

    // Robustness analysis
    if (data.robustnessScore >= 80) {
      notes.push('Strategy shows strong robustness indicators');
    } else if (data.robustnessScore < 50) {
      notes.push('Consider improving strategy robustness');
    }

    return notes;
  }
}