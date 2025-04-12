import React from 'react';
import { Signal } from '../services/algorithmService';
import { formatDistance } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart2
} from 'lucide-react';

interface JournalEntry {
  signal: Signal;
  execution: {
    executed: boolean;
    reason?: string;
    size?: Decimal;
  };
  timestamp: number;
}

interface StrategyJournalProps {
  entries: JournalEntry[];
}

export function StrategyJournal({ entries }: StrategyJournalProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center">
          <BarChart2 className="w-5 h-5 mr-2 text-blue-500" />
          Strategy Journal
        </h2>
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm">
          <option>All Strategies</option>
          <option>Mean Reversion</option>
          <option>Trend Following</option>
          <option>Breakout Detection</option>
        </select>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {entries.map((entry, index) => (
          <div 
            key={index}
            className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {entry.signal.type === 'BUY' ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
                <span className="font-semibold">{entry.signal.symbol}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  entry.signal.type === 'BUY' 
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {entry.signal.type}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>
                  {formatDistance(entry.timestamp, new Date(), { addSuffix: true })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-3 text-sm">
              <div>
                <p className="text-gray-500">Strategy</p>
                <p className="text-gray-300">{entry.signal.strategy}</p>
              </div>
              <div>
                <p className="text-gray-500">Confidence</p>
                <p className="text-gray-300">{(entry.signal.confidence * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-500">Entry Price</p>
                <p className="text-gray-300">${entry.signal.price.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Position Size</p>
                <p className="text-gray-300">
                  {entry.execution.size 
                    ? `$${entry.execution.size.toFixed(2)}`
                    : 'N/A'
                  }
                </p>
              </div>
            </div>

            {entry.signal.targets && (
              <div className="grid grid-cols-3 gap-4 my-3 text-sm">
                <div>
                  <p className="text-gray-500">Take Profit</p>
                  <p className="text-green-500">
                    ${entry.signal.targets.takeProfit.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Stop Loss</p>
                  <p className="text-red-500">
                    ${entry.signal.targets.stopLoss.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Risk/Reward</p>
                  <p className="text-blue-500">
                    {entry.signal.targets.riskRewardRatio.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {entry.execution.executed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : entry.execution.reason ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
                <span className={`text-sm ${
                  entry.execution.executed 
                    ? 'text-green-500'
                    : entry.execution.reason
                    ? 'text-red-500'
                    : 'text-yellow-500'
                }`}>
                  {entry.execution.executed 
                    ? 'Executed'
                    : entry.execution.reason || 'Pending'
                  }
                </span>
              </div>

              {entry.signal.performance && (
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-400">
                    Sharpe: {entry.signal.performance.sharpe.toFixed(2)}
                  </span>
                  <span className="text-gray-400">
                    Win Rate: {(entry.signal.performance.winRate.toNumber() * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}