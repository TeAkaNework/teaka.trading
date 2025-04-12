import React from 'react';
import { TrendingUp, Activity, DollarSign, BarChart2 } from 'lucide-react';

interface PerformanceProps {
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  recentPnL: number[];
}

export function PerformanceMetrics({
  winRate,
  sharpeRatio,
  profitFactor,
  recentPnL
}: PerformanceProps) {
  const pnlTrend = recentPnL.length > 1
    ? recentPnL[recentPnL.length - 1] > recentPnL[recentPnL.length - 2]
    : true;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <BarChart2 className="w-5 h-5 text-blue-500 mr-2" />
        Performance Metrics
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Win Rate</span>
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          <span className="text-2xl font-bold text-green-500">
            {(winRate * 100).toFixed(1)}%
          </span>
        </div>

        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Sharpe Ratio</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-blue-500">
            {sharpeRatio.toFixed(2)}
          </span>
        </div>

        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Profit Factor</span>
            <DollarSign className="w-4 h-4 text-yellow-500" />
          </div>
          <span className="text-2xl font-bold text-yellow-500">
            {profitFactor.toFixed(2)}
          </span>
        </div>

        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">PnL Trend</span>
            <TrendingUp className={`w-4 h-4 ${pnlTrend ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <span className={`text-2xl font-bold ${pnlTrend ? 'text-green-500' : 'text-red-500'}`}>
            {pnlTrend ? 'Positive' : 'Negative'}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Recent PnL</span>
          <span className={pnlTrend ? 'text-green-500' : 'text-red-500'}>
            ${recentPnL[recentPnL.length - 1].toFixed(2)}
          </span>
        </div>
        <div className="h-16 flex items-end space-x-1">
          {recentPnL.map((pnl, i) => (
            <div
              key={i}
              className={`w-full ${pnl >= 0 ? 'bg-green-500' : 'bg-red-500'} rounded-sm`}
              style={{
                height: `${Math.min(Math.abs(pnl) / Math.max(...recentPnL.map(Math.abs)) * 100, 100)}%`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}