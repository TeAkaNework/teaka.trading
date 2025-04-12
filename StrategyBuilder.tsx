import React, { useState } from 'react';
import { TradingViewWidget } from './TradingViewWidget';
import Editor from '@monaco-editor/react';
import { Play, Save, RefreshCw, Settings, ChevronRight, AlertTriangle } from 'lucide-react';

const DEFAULT_STRATEGY = `// Strategy Template
function analyze(data) {
  const { close, high, low } = data;
  
  // Calculate SMA
  const period = 20;
  const sma = calculateSMA(close, period);
  
  // Calculate Bollinger Bands
  const stdDev = calculateStdDev(close, period);
  const upperBand = sma + stdDev * 2;
  const lowerBand = sma - stdDev * 2;
  
  // Generate signals
  const signals = [];
  for (let i = period; i < close.length; i++) {
    if (close[i] < lowerBand[i]) {
      signals.push({
        type: 'BUY',
        price: close[i],
        confidence: 0.8,
        metadata: {
          indicator: 'BB_LOWER',
          deviation: (lowerBand[i] - close[i]) / stdDev[i]
        }
      });
    } else if (close[i] > upperBand[i]) {
      signals.push({
        type: 'SELL',
        price: close[i],
        confidence: 0.8,
        metadata: {
          indicator: 'BB_UPPER',
          deviation: (close[i] - upperBand[i]) / stdDev[i]
        }
      });
    }
  }
  
  return signals;
}

// Helper Functions
function calculateSMA(data, period) {
  const result = new Array(data.length).fill(0);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result[i] = sum / period;
  }
  return result;
}

function calculateStdDev(data, period) {
  const sma = calculateSMA(data, period);
  const result = new Array(data.length).fill(0);
  
  for (let i = period - 1; i < data.length; i++) {
    let sumSquares = 0;
    for (let j = 0; j < period; j++) {
      sumSquares += Math.pow(data[i - j] - sma[i], 2);
    }
    result[i] = Math.sqrt(sumSquares / period);
  }
  return result;
}`;

interface Parameter {
  name: string;
  type: 'number' | 'boolean' | 'string';
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
}

export function StrategyBuilder() {
  const [code, setCode] = useState(DEFAULT_STRATEGY);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [parameters, setParameters] = useState<Parameter[]>([
    { name: 'SMA Period', type: 'number', value: 20, min: 5, max: 200, step: 1 },
    { name: 'BB Multiplier', type: 'number', value: 2, min: 0.5, max: 4, step: 0.1 },
    { name: 'Use RSI Filter', type: 'boolean', value: true },
    { name: 'RSI Period', type: 'number', value: 14, min: 2, max: 50, step: 1 },
    { name: 'RSI Threshold', type: 'number', value: 30, min: 0, max: 100, step: 1 }
  ]);

  const handleParameterChange = (index: number, value: number | boolean | string) => {
    const newParameters = [...parameters];
    newParameters[index].value = value;
    setParameters(newParameters);
  };

  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    try {
      // Simulate backtest delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      // TODO: Implement actual backtest logic
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleSaveStrategy = () => {
    const strategy = {
      code,
      parameters: parameters.reduce((acc, param) => ({
        ...acc,
        [param.name]: param.value
      }), {})
    };
    localStorage.setItem('savedStrategy', JSON.stringify(strategy));
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Strategy Builder</h2>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1"
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="1D">1 Day</option>
          </select>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="h-[400px] bg-gray-800 rounded-lg overflow-hidden">
            <TradingViewWidget
              symbol="BTCUSDT"
              theme="dark"
            />
          </div>

          {showSettings && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Strategy Parameters</h3>
              <div className="space-y-4">
                {parameters.map((param, index) => (
                  <div key={param.name} className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">{param.name}</label>
                    {param.type === 'number' ? (
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          value={param.value as number}
                          onChange={(e) => handleParameterChange(index, parseFloat(e.target.value))}
                          className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="w-12 text-right">{param.value}</span>
                      </div>
                    ) : param.type === 'boolean' ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={param.value as boolean}
                          onChange={(e) => handleParameterChange(index, e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={param.value as string}
                        onChange={(e) => handleParameterChange(index, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="h-[400px] bg-gray-800 rounded-lg overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRunBacktest}
                disabled={isBacktesting}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                  isBacktesting
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isBacktesting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>{isBacktesting ? 'Running...' : 'Run Backtest'}</span>
              </button>
              <button
                onClick={handleSaveStrategy}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center space-x-2"
              >
                <Save className="w-5 h-5" />
                <span>Save Strategy</span>
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-yellow-500 mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Strategy Analysis</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-green-500">65.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Profit Factor</span>
                <span className="text-green-500">1.85</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Max Drawdown</span>
                <span className="text-red-500">-12.3%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sharpe Ratio</span>
                <span className="text-green-500">1.92</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}