import React, { useState, useEffect } from 'react';
import { TradingViewWidget } from './TradingViewWidget';
import { StrategyService } from '../services/strategyService';
import { QuantEngine } from '../services/quantEngine';
import { WebhookLogger } from '../services/webhookLogger';
import { LineChart, Play, Save, RefreshCw, Settings, ChevronRight } from 'lucide-react';

const strategyService = new StrategyService();
const quantEngine = new QuantEngine();
const webhookLogger = new WebhookLogger([
  {
    url: import.meta.env.VITE_DISCORD_WEBHOOK_URL || '',
    type: 'discord',
    enabled: true
  }
]);

interface BacktestResults {
  pnl: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  trades: any[];
  equity: number[];
}

export function BacktestCommandCenter() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [parameters, setParameters] = useState({
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplier: 2
  });
  const [code, setCode] = useState(`// Strategy Template
function analyze(data) {
  const { close, high, low } = data;
  const signals = [];
  
  // Calculate indicators
  const rsi = calculateRSI(close, parameters.rsiPeriod);
  const macd = calculateMACD(close, parameters.macdFast, parameters.macdSlow, parameters.macdSignal);
  const atr = calculateATR(high, low, close, parameters.atrPeriod);
  
  // Generate signals
  for (let i = parameters.macdSlow; i < close.length; i++) {
    if (rsi[i] < 30 && macd.histogram[i] > 0) {
      signals.push({
        type: 'BUY',
        price: close[i],
        timestamp: data.timestamp[i],
        confidence: 0.8,
        metadata: {
          rsi: rsi[i],
          macd: macd.histogram[i],
          atr: atr[i]
        }
      });
    } else if (rsi[i] > 70 && macd.histogram[i] < 0) {
      signals.push({
        type: 'SELL',
        price: close[i],
        timestamp: data.timestamp[i],
        confidence: 0.8,
        metadata: {
          rsi: rsi[i],
          macd: macd.histogram[i],
          atr: atr[i]
        }
      });
    }
  }
  
  return signals;
}`);

  const runBacktest = async () => {
    setIsRunning(true);
    try {
      // Simulate data fetch
      const data = await fetchHistoricalData(selectedSymbol, selectedTimeframe);
      
      // Evaluate strategy
      const result = await strategyService.evaluateStrategy({
        name: 'Custom Strategy',
        parameters,
        code
      }, data);

      // Calculate additional metrics using quant engine
      const returns = result.signals.map(s => s.price.toNumber());
      const optimizedWeights = quantEngine.optimizePortfolio([returns]);

      const backtestResult = {
        pnl: result.metrics.profitFactor * 10000,
        winRate: result.metrics.winRate * 100,
        sharpeRatio: result.metrics.sharpeRatio,
        maxDrawdown: result.metrics.maxDrawdown * 100,
        trades: result.signals,
        equity: generateEquityCurve(result.signals)
      };

      setResults(backtestResult);

      // Log results to webhooks
      await webhookLogger.logBacktestResult({
        strategy: 'Custom Strategy',
        pnl: backtestResult.pnl,
        trades: result.signals,
        metrics: result.metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Backtest error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const generateEquityCurve = (trades: any[]): number[] => {
    const equity = [10000]; // Starting balance
    let balance = 10000;
    
    trades.forEach(trade => {
      balance += trade.pnl;
      equity.push(balance);
    });
    
    return equity;
  };

  const fetchHistoricalData = async (symbol: string, timeframe: string) => {
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          // Sample OHLCV data
        ]);
      }, 1000);
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <LineChart className="w-6 h-6 text-blue-500 mr-2" />
          Backtest Command Center
        </h2>
        <div className="flex items-center space-x-4">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1"
          >
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
          </select>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1"
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="1D">1 Day</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="h-[400px] bg-gray-800 rounded-lg overflow-hidden">
            <TradingViewWidget
              symbol={selectedSymbol}
              theme="dark"
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Strategy Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(parameters).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm text-gray-400 mb-1">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setParameters({
                      ...parameters,
                      [key]: parseFloat(e.target.value)
                    })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {results && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Backtest Results</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400">Total PnL</p>
                  <p className={`text-2xl font-bold ${
                    results.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ${results.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-green-500">
                    {results.winRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Sharpe Ratio</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {results.sharpeRatio.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-500">
                    {results.maxDrawdown.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={runBacktest}
              disabled={isRunning}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                isRunning
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRunning ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span>{isRunning ? 'Running...' : 'Run Backtest'}</span>
            </button>
            <button
              onClick={() => {
                // Save strategy logic
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>Save Strategy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}