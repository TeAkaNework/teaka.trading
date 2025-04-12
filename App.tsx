import React, { useState } from 'react';
import { 
  Brain,
  Cpu,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Navigation } from './components/Navigation';
import { StatCard } from './components/StatCard';
import { TradingChart } from './components/TradingChart';
import { AlgorithmPanel } from './components/AlgorithmPanel';
import { PortfolioManager } from './components/PortfolioManager';
import { RiskManagementPanel } from './components/RiskManagementPanel';
import { AutoTraderDashboard } from './components/AutoTraderDashboard';
import { BacktestCommandCenter } from './components/BacktestCommandCenter';
import { StrategyBuilder } from './components/StrategyBuilder';
import { LogViewer } from './components/LogViewer';
import { AuthForm } from './components/AuthForm';
import { useAuthStore } from './stores/authStore';
import { usePriceUpdates } from './hooks/usePriceUpdates';

function App() {
  const { user, isLoading } = useAuthStore();
  const [selectedAsset, setSelectedAsset] = useState('BTC/USDT');
  const [showAuthForm, setShowAuthForm] = useState(false);
  const prices = usePriceUpdates();
  
  const getPortfolioValue = () => {
    const btcValue = Number(prices['BTCUSDT']?.price || 0) * 0.5;
    const ethValue = Number(prices['ETHUSDT']?.price || 0) * 2;
    const solValue = Number(prices['SOLUSDT']?.price || 0) * 10;
    
    const portfolio = btcValue + ethValue + solValue;
    return portfolio.toFixed(2);
  };

  const stats = [
    {
      title: 'AI Models',
      value: '12',
      icon: <Brain className="w-6 h-6 text-purple-500" />,
      change: '+2.4%',
      positive: true
    },
    {
      title: 'Active Algorithms',
      value: '8',
      icon: <Cpu className="w-6 h-6 text-blue-500" />,
      change: '+1.2%',
      positive: true
    },
    {
      title: 'Risk Score',
      value: 'Low',
      icon: <ShieldCheck className="w-6 h-6 text-green-500" />,
      change: '-0.5%',
      positive: true
    },
    {
      title: 'Portfolio Value',
      value: `$${getPortfolioValue()}`,
      icon: <Wallet className="w-6 h-6 text-yellow-500" />,
      change: '+5.3%',
      positive: true
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-white">
        <Navigation />
        <main className="p-6">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4">
              Advanced Digital Asset Trading
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Leverage cutting-edge AI and machine learning algorithms to maximize your trading potential
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          <div className="mb-12">
            <BacktestCommandCenter />
          </div>

          <div className="mb-12">
            <StrategyBuilder />
          </div>

          <div className="mb-12">
            <LogViewer />
          </div>

          <div className="mb-12">
            <AutoTraderDashboard />
          </div>

          <div className="mb-12">
            <PortfolioManager />
          </div>

          <div className="mb-12">
            <RiskManagementPanel />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TradingChart 
              selectedAsset={selectedAsset}
              onAssetChange={setSelectedAsset}
            />
            <AlgorithmPanel />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {showAuthForm ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md">
            <AuthForm />
            <button 
              onClick={() => setShowAuthForm(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : null}

      <Navigation />
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6">
            Teaka Trade — Automated Intelligence for Everyone
          </h1>
          <p className="text-xl text-gray-400 mb-12">
            Turn signals into smart execution with zero code
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-blue-500 mb-4">
                <Brain className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Select a Strategy</h3>
              <p className="text-gray-400">Choose from proven algorithms or create your own</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-green-500 mb-4">
                <ShieldCheck className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Set Your Risk Level</h3>
              <p className="text-gray-400">Customize position sizing and risk parameters</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-purple-500 mb-4">
                <Cpu className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Auto-Trade in Real-Time</h3>
              <p className="text-gray-400">Let AI handle execution while you monitor</p>
            </div>
          </div>

          <div className="flex justify-center space-x-6">
            <button 
              onClick={() => setShowAuthForm(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              Get Started
            </button>
            <button className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">How Teaka Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Brain className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AI-Powered Signal Generation</h3>
                  <p className="text-gray-400">Combines ML models with quantitative logic</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-green-500/20 p-2 rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Smart Position Sizing</h3>
                  <p className="text-gray-400">Adaptive risk models protect your capital</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-purple-500/20 p-2 rounded-lg">
                  <Cpu className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Multi-Exchange Execution</h3>
                  <p className="text-gray-400">Trade via KuCoin, OANDA, or MT5</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <Wallet className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Strategy Builder & Grader</h3>
                  <p className="text-gray-400">Create and validate your trading ideas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-6 mt-12">
            <button 
              onClick={() => setShowAuthForm(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              Try Teaka Lite
            </button>
            <button className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">
              See Pro Features 🔐
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for Beginners, Powered for Pros</h2>
            <p className="text-gray-400">Advanced features wrapped in a simple interface</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">User-First Interface</h3>
              <p className="text-gray-400">Simple sliders, toggles, and intuitive charts</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Grade-A Intelligence</h3>
              <p className="text-gray-400">VaR control and smart risk management</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">DeFi Ready</h3>
              <p className="text-gray-400">Smart contract integration capabilities</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Flexible Deployment</h3>
              <p className="text-gray-400">Run on cloud, server, or local machine</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-8">Ready to Start Trading?</h2>
          <div className="flex justify-center space-x-6">
            <button 
              onClick={() => setShowAuthForm(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              Join Alpha Waitlist
            </button>
            <button className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold">
              Get a Demo
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 mb-4 md:mb-0">
              © Teaka Network | Founder: Gee Martini
            </div>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-gray-400 hover:text-white">
                Telegram: @teaka_trader_bot
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                Terms
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;