import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { RiskManagementService } from '../services/riskManagementService';
import { AlertTriangle, TrendingDown, Activity, Shield } from 'lucide-react';
import Decimal from 'decimal.js';

const riskManager = new RiskManagementService();

export function RiskManagementPanel() {
  const { portfolios } = usePortfolioStore();
  const [riskMetrics, setRiskMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    updateRiskMetrics();
  }, [portfolios]);

  const updateRiskMetrics = async () => {
    setLoading(true);
    try {
      // Update risk manager with current positions
      portfolios.forEach(portfolio => {
        portfolio.positions.forEach(position => {
          riskManager.updatePosition(position.symbol, position);
          riskManager.updatePriceHistory(
            position.symbol,
            position.current_price
          );
        });
      });

      const metrics = await riskManager.calculateRiskMetrics();
      setRiskMetrics(metrics);
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!riskMetrics) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg">
        <p className="text-gray-400">No risk metrics available</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Shield className="w-6 h-6 mr-2 text-blue-500" />
        Risk Management
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400">Value at Risk (95%)</h3>
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">
            ${Math.abs(riskMetrics.var.toNumber()).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500">Daily VaR</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400">Portfolio Beta</h3>
            <TrendingDown className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">
            {riskMetrics.beta.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500">Market Sensitivity</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400">Sharpe Ratio</h3>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">
            {riskMetrics.sharpeRatio.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500">Risk-Adjusted Returns</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400">Max Drawdown</h3>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold">
            {(riskMetrics.maxDrawdown.times(100)).toFixed(2)}%
          </p>
          <p className="text-sm text-gray-500">Historical Maximum Loss</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Stress Test Scenarios</h3>
          <div className="space-y-4">
            {riskMetrics.stressTestResults.map((result: any, index: number) => (
              <div key={index} className="border-b border-gray-700 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">{result.scenario}</span>
                  <span className="text-red-500">
                    -${Math.abs(result.potentialLoss.toNumber()).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Probability: {(result.probabilityOfOccurrence.times(100)).toFixed(1)}%
                  </span>
                  <span className="text-gray-500">
                    {result.impactedAssets.length} assets affected
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Asset Correlations</h3>
          <div className="space-y-4">
            {Object.entries(riskMetrics.correlations).map(([pair, correlation]: [string, number], index: number) => {
              const [asset1, asset2] = pair.split('_');
              const correlationValue = correlation.toFixed(2);
              const isHighCorrelation = Math.abs(correlation) > 0.7;

              return (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-300">
                    {asset1} → {asset2}
                  </span>
                  <span className={`${
                    isHighCorrelation
                      ? correlation > 0 
                        ? 'text-red-500'
                        : 'text-yellow-500'
                      : 'text-green-500'
                  }`}>
                    {correlationValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}