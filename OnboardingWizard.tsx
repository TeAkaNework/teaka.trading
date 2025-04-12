import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, Wallet, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  icon: JSX.Element;
  content: JSX.Element;
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [riskLevel, setRiskLevel] = useState(50);
  const [selectedStrategy, setSelectedStrategy] = useState('mean-reversion');
  const [allocation, setAllocation] = useState(20);

  const steps: Step[] = [
    {
      title: "Choose Your Strategy",
      description: "Select a proven trading strategy that matches your goals",
      icon: <Brain className="w-8 h-8 text-purple-500" />,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedStrategy('mean-reversion')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedStrategy === 'mean-reversion'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <h3 className="text-lg font-semibold mb-2">Mean Reversion</h3>
              <p className="text-gray-400 text-sm">
                Trades price deviations from historical averages. Lower risk, consistent returns.
              </p>
            </button>
            <button
              onClick={() => setSelectedStrategy('trend-following')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedStrategy === 'trend-following'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <h3 className="text-lg font-semibold mb-2">Trend Following</h3>
              <p className="text-gray-400 text-sm">
                Follows established market trends. Higher potential returns with more volatility.
              </p>
            </button>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">Strategy Details</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Automated entry and exit points
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Built-in risk management
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Real-time market analysis
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Set Risk Level",
      description: "Define your risk tolerance and position sizing",
      icon: <Shield className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Risk Level</span>
              <span className={`font-semibold ${
                riskLevel < 33 ? 'text-green-500' :
                riskLevel < 66 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {riskLevel < 33 ? 'Conservative' :
                 riskLevel < 66 ? 'Moderate' : 'Aggressive'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={riskLevel}
              onChange={(e) => setRiskLevel(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm mt-2">
              <span className="text-green-500">Low Risk</span>
              <span className="text-yellow-500">Medium</span>
              <span className="text-red-500">High Risk</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Stop Loss</h4>
              <p className="text-2xl font-bold text-red-500">
                {riskLevel < 33 ? '1.5%' : riskLevel < 66 ? '2.0%' : '2.5%'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Take Profit</h4>
              <p className="text-2xl font-bold text-green-500">
                {riskLevel < 33 ? '3.0%' : riskLevel < 66 ? '4.0%' : '5.0%'}
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Capital Allocation",
      description: "Choose how much capital to allocate to trading",
      icon: <Wallet className="w-8 h-8 text-yellow-500" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Allocation Percentage</span>
              <span className="font-semibold text-blue-500">{allocation}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={allocation}
              onChange={(e) => setAllocation(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">5%</span>
              <span className="text-gray-400">100%</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium mb-4">Allocation Summary</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Trading Capital</span>
                <span className="font-semibold">{allocation}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Reserved Capital</span>
                <span className="font-semibold">{100 - allocation}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${allocation}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Welcome to Teaka AutoTrader</h2>
            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStep
                      ? 'bg-blue-500'
                      : index < currentStep
                      ? 'bg-green-500'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              {steps[currentStep].icon}
              <div>
                <h3 className="text-xl font-semibold">{steps[currentStep].title}</h3>
                <p className="text-gray-400">{steps[currentStep].description}</p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {steps[currentStep].content}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handleBack}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0
                  ? 'opacity-0 cursor-default'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}