import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarketRegimeProps {
  volatility: number;
  trend: number;
  correlation: number;
  regime: 'trending' | 'mean_reverting' | 'neutral';
}

export function MarketRegimeIndicator({
  volatility,
  trend,
  correlation,
  regime
}: MarketRegimeProps) {
  const getRegimeColor = () => {
    switch (regime) {
      case 'trending': return 'text-green-500';
      case 'mean_reverting': return 'text-blue-500';
      case 'neutral': return 'text-yellow-500';
    }
  };

  const getRegimeIcon = () => {
    switch (regime) {
      case 'trending': return <TrendingUp className="w-5 h-5" />;
      case 'mean_reverting': return <TrendingDown className="w-5 h-5" />;
      case 'neutral': return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Market Regime</h3>
        <div className={`flex items-center space-x-2 ${getRegimeColor()}`}>
          {getRegimeIcon()}
          <span className="capitalize">{regime.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Volatility</span>
            <span className={volatility > 0.5 ? 'text-red-500' : 'text-green-500'}>
              {(volatility * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                volatility > 0.5 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${volatility * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Trend Strength</span>
            <span className="text-blue-500">{(Math.abs(trend) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.abs(trend) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Correlation</span>
            <span className={Math.abs(correlation) > 0.7 ? 'text-yellow-500' : 'text-green-500'}>
              {(correlation * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                Math.abs(correlation) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.abs(correlation) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}