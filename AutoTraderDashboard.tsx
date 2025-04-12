import React, { useState, useEffect } from 'react';
import { Brain, Cpu, Activity, AlertTriangle, Zap, History, Info, Bell } from 'lucide-react';
import Decimal from 'decimal.js';
import { usePortfolioStore } from '../stores/portfolioStore';
import { ThresholdMonitor } from './ThresholdMonitor';
import { MarketRegimeIndicator } from './MarketRegimeIndicator';
import { PerformanceMetrics } from './PerformanceMetrics';

interface Strategy {
  name: string;
  description: string;
  icon: JSX.Element;
  defaultRisk: number;
}

const strategies: Strategy[] = [
  {
    name: 'Mean Reversion',
    description: 'Trades price deviations from historical averages',
    icon: <Brain className="w-5 h-5" />,
    defaultRisk: 0.5
  },
  {
    name: 'Trend Following',
    description: 'Follows established market trends',
    icon: <Cpu className="w-5 h-5" />,
    defaultRisk: 1.0
  },
  {
    name: 'Breakout',
    description: 'Captures significant price movements',
    icon: <Activity className="w-5 h-5" />,
    defaultRisk: 1.5
  }
];

export function AutoTraderDashboard() {
  const [selectedStrategy, setSelectedStrategy] = useState(strategies[0].name);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const { portfolios } = usePortfolioStore();

  // Threshold states
  const [stopLoss, setStopLoss] = useState(0.02);
  const [takeProfit, setTakeProfit] = useState(0.03);
  const [entryConfidence, setEntryConfidence] = useState(0.7);
  const [positionSize, setPositionSize] = useState(0.1);

  // Market regime state
  const [marketRegime, setMarketRegime] = useState({
    volatility: 0.15,
    trend: 0.65,
    correlation: 0.45,
    regime: 'trending' as const
  });

  // Performance metrics state
  const [performance, setPerformance] = useState({
    winRate: 0.65,
    sharpeRatio: 1.8,
    profitFactor: 1.5,
    recentPnL: [100, 150, -50, 200, 180]
  });

  // Calculate available balance
  const totalBalance = portfolios.reduce(
    (sum, p) => sum.plus(p.total_value),
    new Decimal(0)
  );

  const handleSaveConfig = () => {
    const config = {
      strategy: selectedStrategy,
      stopLoss,
      takeProfit,
      entryConfidence,
      positionSize,
      telegramAlerts
    };
    localStorage.setItem('autoTraderConfig', JSON.stringify(config));
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Zap className="w-6 h-6 text-blue-500 mr-2" />
          AutoTrader Dashboard
        </h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center"
          >
            Save Config
          </button>
          <div className="flex items-center space-x-2">
            <Bell className={`w-5 h-5 ${telegramAlerts ? 'text-blue-500' : 'text-gray-500'}`} />
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={telegramAlerts}
                onChange={(e) => setTelegramAlerts(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Strategy Type
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                {strategies.map((strategy) => (
                  <option key={strategy.name} value={strategy.name}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Available Balance
              </label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
                ${totalBalance.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ThresholdMonitor
              name="Stop Loss"
              value={stopLoss}
              baseValue={0.02}
              minValue={0.01}
              maxValue={0.05}
              adaptiveFactors={{
                volatility: 0.8,
                performance: 0.5,
                marketRegime: 0.3
              }}
              onChange={setStopLoss}
            />
            <ThresholdMonitor
              name="Take Profit"
              value={takeProfit}
              baseValue={0.03}
              minValue={0.02}
              maxValue={0.1}
              adaptiveFactors={{
                volatility: 0.7,
                performance: 0.6,
                marketRegime: 0.4
              }}
              onChange={setTakeProfit}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ThresholdMonitor
              name="Entry Confidence"
              value={entryConfidence}
              baseValue={0.7}
              minValue={0.5}
              maxValue={0.9}
              adaptiveFactors={{
                volatility: 0.5,
                performance: 0.8,
                marketRegime: 0.4
              }}
              onChange={setEntryConfidence}
            />
            <ThresholdMonitor
              name="Position Size"
              value={positionSize}
              baseValue={0.1}
              minValue={0.05}
              maxValue={0.2}
              adaptiveFactors={{
                volatility: 0.9,
                performance: 0.6,
                marketRegime: 0.3
              }}
              onChange={setPositionSize}
            />
          </div>
        </div>

        <div className="space-y-6">
          <MarketRegimeIndicator {...marketRegime} />
          <PerformanceMetrics {...performance} />
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg mb-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className={`w-5 h-5 ${isAutoTrading ? 'text-green-500' : 'text-red-500'}`} />
          <span className="font-medium">
            {isAutoTrading ? 'Trading Enabled' : 'Trading Disabled'}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isAutoTrading}
            onChange={(e) => setIsAutoTrading(e.target.checked)}
          />
          <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Activity className="w-5 h-5 text-blue-500 mr-2" />
          Live Strategy Feed
        </h3>
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 text-gray-400 hover:text-white">
            <History className="w-4 h-4" />
            <span>Trade History</span>
          </button>
          <button className="flex items-center space-x-2 text-gray-400 hover:text-white">
            <Info className="w-4 h-4" />
            <span>Strategy Info</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm">
              <th className="p-4">Time</th>
              <th className="p-4">Symbol</th>
              <th className="p-4">Signal</th>
              <th className="p-4">Price</th>
              <th className="p-4">Confidence</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-700">
              <td className="p-4">10:30:15</td>
              <td className="p-4">BTC/USDT</td>
              <td className="p-4">
                <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded-full text-xs">
                  BUY
                </span>
              </td>
              <td className="p-4">$42,150.00</td>
              <td className="p-4">85%</td>
              <td className="p-4">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-500 rounded-full text-xs">
                  PENDING
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}