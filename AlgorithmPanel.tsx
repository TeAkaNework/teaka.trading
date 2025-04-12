import React from 'react';
import { useAlgorithmSignals } from '../hooks/useAlgorithmSignals';
import { Brain, TrendingUp, Activity } from 'lucide-react';

interface Algorithm {
  name: string;
  type: string;
  performance: string;
  status: string;
  risk: string;
  allocation: string;
  icon: JSX.Element;
  description: string;
}

export function AlgorithmPanel() {
  const signals = useAlgorithmSignals();

  const algorithms: Algorithm[] = [
    {
      name: 'Mean Reversion',
      type: 'Statistical',
      performance: '+8.7%',
      status: 'Active',
      risk: 'Medium',
      allocation: '40%',
      icon: <Brain className="w-5 h-5 text-purple-500" />,
      description: 'Identifies and trades price deviations from historical means'
    },
    {
      name: 'Trend Following',
      type: 'Machine Learning',
      performance: '+12.3%',
      status: 'Active',
      risk: 'High',
      allocation: '30%',
      icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
      description: 'Captures momentum using adaptive moving averages'
    },
    {
      name: 'Breakout Detection',
      type: 'AI-Powered',
      performance: '+5.2%',
      status: 'Active',
      risk: 'Low',
      allocation: '30%',
      icon: <Activity className="w-5 h-5 text-green-500" />,
      description: 'Detects and trades significant price movements'
    }
  ];

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Trading Algorithms</h2>
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm">
          <option>Sort by Performance</option>
          <option>Sort by Risk</option>
          <option>Sort by Allocation</option>
        </select>
      </div>

      <div className="space-y-4">
        {algorithms.map((algo, index) => (
          <div key={index} className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {algo.icon}
                <h3 className="font-semibold">{algo.name}</h3>
              </div>
              <span className="text-green-500">{algo.performance}</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">{algo.description}</p>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="text-gray-300">{algo.type}</p>
              </div>
              <div>
                <p className="text-gray-500">Risk Level</p>
                <p className="text-gray-300">{algo.risk}</p>
              </div>
              <div>
                <p className="text-gray-500">Allocation</p>
                <p className="text-gray-300">{algo.allocation}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded-full text-sm">
                {algo.status}
              </span>
              <button className="text-sm text-blue-500 hover:text-blue-400">
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {signals.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Recent Signals</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {signals.map((signal, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-gray-800 p-2 rounded-lg text-sm"
              >
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    signal.type === 'BUY' 
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-red-500/20 text-red-500'
                  }`}>
                    {signal.type}
                  </span>
                  <span>{signal.symbol}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400">{signal.strategy}</span>
                  <span>${signal.price.toFixed(2)}</span>
                  <span className="text-gray-400">{Math.round(signal.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="w-full mt-6 bg-blue-500 hover:bg-blue-600 py-3 rounded-lg font-semibold transition-colors">
        Deploy New Algorithm
      </button>
    </div>
  );
}