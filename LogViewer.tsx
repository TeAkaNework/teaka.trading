import React, { useState, useEffect } from 'react';
import { FirebaseLogger } from '../services/firebaseLogger';
import { LineChart, BarChart2, TrendingUp, Calendar } from 'lucide-react';

const firebaseLogger = new FirebaseLogger();

export function LogViewer() {
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  const [performance, setPerformance] = useState<any>(null);
  const [topStrategies, setTopStrategies] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedStrategy, dateRange]);

  const loadData = async () => {
    try {
      const trades = await firebaseLogger.getRecentTrades(100, selectedStrategy);
      setRecentTrades(trades);

      if (selectedStrategy) {
        const perf = await firebaseLogger.getStrategyPerformance(
          selectedStrategy,
          dateRange.start,
          dateRange.end
        );
        setPerformance(perf);
      }

      const top = await firebaseLogger.getTopStrategies('sharpeRatio', 5);
      setTopStrategies(top);
    } catch (error) {
      console.error('Error loading log data:', error);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <LineChart className="w-6 h-6 text-blue-500 mr-2" />
          Trading Logs
        </h2>
        <div className="flex items-center space-x-4">
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1"
          >
            <option value="">All Strategies</option>
            {topStrategies.map((s, i) => (
              <option key={i} value={s.strategy}>{s.strategy}</option>
            ))}
          </select>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({
                ...dateRange,
                start: new Date(e.target.value)
              })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({
                ...dateRange,
                end: new Date(e.target.value)
              })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart2 className="w-5 h-5 text-blue-500 mr-2" />
            Recent Trades
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade, index) => (
                  <tr key={index} className="border-t border-gray-700">
                    <td className="py-2">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2">{trade.symbol}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trade.type === 'BUY'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2">${Number(trade.price).toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trade.execution.status === 'FILLED'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {trade.execution.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
              Top Performing Strategies
            </h3>
            <div className="space-y-4">
              {topStrategies.map((strategy, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-t border-gray-700 pt-2"
                >
                  <span className="text-gray-300">{strategy.strategy}</span>
                  <span className="text-green-500">
                    {strategy.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {performance && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Strategy Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400">Total Trades</p>
                  <p className="text-2xl font-bold">{performance.trades}</p>
                </div>
                <div>
                  <p className="text-gray-400">Win Rate</p>
                  <p className="text-2xl font-bold text-green-500">
                    {(performance.winRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Total PnL</p>
                  <p className={`text-2xl font-bold ${
                    performance.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ${performance.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Sharpe Ratio</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {performance.sharpeRatio.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}