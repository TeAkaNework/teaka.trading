import React, { useState } from 'react';
import { TradingViewWidget } from './TradingViewWidget';
import { TrendSpiderWidget } from './TrendSpiderWidget';
import { TradeIdeasWidget } from './TradeIdeasWidget';
import { usePriceUpdates } from '../hooks/usePriceUpdates';
import { LineChart, TrendingUp, Activity, Settings, ChevronDown } from 'lucide-react';

interface TradingChartProps {
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
}

export function TradingChart({ selectedAsset, onAssetChange }: TradingChartProps) {
  const [activeChart, setActiveChart] = useState<'tradingview' | 'trendspider' | 'tradeideas'>('tradingview');
  const [showTimeframes, setShowTimeframes] = useState(false);
  const [selectedType, setSelectedType] = useState<'crypto' | 'forex' | 'commodity'>('crypto');
  const prices = usePriceUpdates();
  
  const getSymbolPrice = (pair: string) => {
    const symbol = pair.replace('/', '').toUpperCase();
    return prices[symbol];
  };

  const currentPrice = getSymbolPrice(selectedAsset);

  const chartProviders = [
    { id: 'tradingview', name: 'TradingView', icon: <LineChart className="w-4 h-4" /> },
    { id: 'trendspider', name: 'TrendSpider', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'tradeideas', name: 'Trade Ideas', icon: <Activity className="w-4 h-4" /> }
  ];

  const assetTypes = [
    { id: 'crypto', name: 'Crypto' },
    { id: 'forex', name: 'Forex' },
    { id: 'commodity', name: 'Commodities' }
  ];

  const getAssetOptions = () => {
    switch (selectedType) {
      case 'crypto':
        return [
          'BTC/USDT',
          'ETH/USDT',
          'SOL/USDT',
          'BNB/USDT',
          'ADA/USDT'
        ];
      case 'forex':
        return [
          'EUR/USD',
          'GBP/USD',
          'USD/JPY',
          'USD/CHF',
          'AUD/USD',
          'USD/CAD',
          'NZD/USD',
          'EUR/GBP'
        ];
      case 'commodity':
        return [
          'XAU/USD', // Gold
          'XAG/USD', // Silver
          'WTI/USD', // WTI Crude Oil
          'BCO/USD', // Brent Crude Oil
          'NATGAS',  // Natural Gas
          'COPPER',
          'PLATINUM',
          'PALLADIUM'
        ];
      default:
        return [];
    }
  };

  const renderChart = () => {
    const props = {
      symbol: selectedAsset.replace('/', ''),
      theme: 'dark' as const
    };

    switch (activeChart) {
      case 'trendspider':
        return <TrendSpiderWidget {...props} />;
      case 'tradeideas':
        return <TradeIdeasWidget {...props} />;
      default:
        return <TradingViewWidget {...props} />;
    }
  };

  return (
    <div className="lg:col-span-2 bg-gray-900 rounded-lg p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            {assetTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          
          <select 
            value={selectedAsset}
            onChange={(e) => onAssetChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            {getAssetOptions().map(asset => (
              <option key={asset} value={asset}>{asset}</option>
            ))}
          </select>
          
          <span className="text-2xl font-bold">
            ${currentPrice?.price.toFixed(2) || '-.--'}
          </span>
          <span className={`${
            currentPrice?.change24h.isPositive() ? 'text-green-500' : 'text-red-500'
          }`}>
            {currentPrice?.change24h.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="flex items-center space-x-2 flex-grow md:flex-grow-0">
            {chartProviders.map(provider => (
              <button
                key={provider.id}
                onClick={() => setActiveChart(provider.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeChart === provider.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {provider.icon}
                <span className="hidden md:inline">{provider.name}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowTimeframes(!showTimeframes)}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              <ChevronDown className="w-4 h-4" />
            </button>
            {showTimeframes && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg py-2 z-10">
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">1 Minute</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">5 Minutes</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">15 Minutes</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">1 Hour</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">4 Hours</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-700">1 Day</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-[600px] rounded-lg overflow-hidden border border-gray-800">
        {renderChart()}
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        {['Volume', 'RSI', 'MACD', 'Bollinger'].map((indicator) => (
          <div key={indicator} className="bg-gray-800 p-3 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-1">{indicator}</h4>
            <div className="h-[60px] border-b border-gray-700"></div>
          </div>
        ))}
      </div>
    </div>
  );
}