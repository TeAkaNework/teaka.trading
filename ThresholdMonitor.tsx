import React from 'react';
import { Settings, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

interface ThresholdProps {
  name: string;
  value: number;
  baseValue: number;
  minValue: number;
  maxValue: number;
  adaptiveFactors: {
    volatility?: number;
    performance?: number;
    marketRegime?: number;
  };
  onChange: (value: number) => void;
}

export function ThresholdMonitor({ 
  name,
  value,
  baseValue,
  minValue,
  maxValue,
  adaptiveFactors,
  onChange
}: ThresholdProps) {
  const getThresholdColor = () => {
    const deviation = Math.abs(value - baseValue) / baseValue;
    if (deviation > 0.5) return 'text-red-500';
    if (deviation > 0.2) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getAdaptiveIcon = () => {
    if (adaptiveFactors.volatility && adaptiveFactors.volatility > 0.5) {
      return <Activity className="w-4 h-4 text-blue-500" />;
    }
    if (adaptiveFactors.performance && adaptiveFactors.performance > 0.5) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
    return <Settings className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getAdaptiveIcon()}
          <span className="font-medium">{name}</span>
        </div>
        <span className={`font-bold ${getThresholdColor()}`}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={minValue * 100}
          max={maxValue * 100}
          step={0.1}
          value={value * 100}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{(minValue * 100).toFixed(1)}%</span>
          <span>Base: {(baseValue * 100).toFixed(1)}%</span>
          <span>{(maxValue * 100).toFixed(1)}%</span>
        </div>

        {Object.entries(adaptiveFactors).map(([factor, weight]) => (
          <div key={factor} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{factor}</span>
            <div className="flex items-center space-x-1">
              <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${weight * 100}%` }}
                />
              </div>
              <span className="text-gray-400">{(weight * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}