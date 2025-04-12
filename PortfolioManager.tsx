import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { Plus, Trash2, Edit2, Save } from 'lucide-react';
import Decimal from 'decimal.js';

export function PortfolioManager() {
  const {
    portfolios,
    isLoading,
    error,
    loadPortfolios,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    addPosition,
    updatePosition,
    deletePosition,
  } = usePortfolioStore();

  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [newPosition, setNewPosition] = useState({
    symbol: '',
    quantity: '',
    entry_price: '',
  });

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    await createPortfolio(newPortfolioName, newPortfolioDescription);
    setNewPortfolioName('');
    setNewPortfolioDescription('');
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio || !newPosition.symbol || !newPosition.quantity || !newPosition.entry_price) return;

    const position = {
      symbol: newPosition.symbol.toUpperCase(),
      quantity: new Decimal(newPosition.quantity),
      entry_price: new Decimal(newPosition.entry_price),
      current_price: new Decimal(newPosition.entry_price), // Initially same as entry price
      pnl: new Decimal(0),
    };

    await addPosition(selectedPortfolio, position);
    setNewPosition({ symbol: '', quantity: '', entry_price: '' });
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Portfolios</h2>
        
        <form onSubmit={handleCreatePortfolio} className="mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Portfolio Name"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newPortfolioDescription}
              onChange={(e) => setNewPortfolioDescription(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Portfolio
            </button>
          </div>
        </form>

        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="border border-gray-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{portfolio.name}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedPortfolio(portfolio.id)}
                    className="text-blue-500 hover:text-blue-400"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deletePortfolio(portfolio.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {portfolio.description && (
                <p className="text-gray-400 mb-4">{portfolio.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-400">Total Value</p>
                  <p className="text-2xl font-bold">
                    ${portfolio.total_value.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-400">Total P&L</p>
                  <p className={`text-2xl font-bold ${
                    portfolio.total_pnl.isPositive() ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ${portfolio.total_pnl.toFixed(2)}
                  </p>
                </div>
              </div>

              {selectedPortfolio === portfolio.id && (
                <form onSubmit={handleAddPosition} className="mb-4">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="Symbol"
                      value={newPosition.symbol}
                      onChange={(e) => setNewPosition({
                        ...newPosition,
                        symbol: e.target.value,
                      })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Quantity"
                      value={newPosition.quantity}
                      onChange={(e) => setNewPosition({
                        ...newPosition,
                        quantity: e.target.value,
                      })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Entry Price"
                      value={newPosition.entry_price}
                      onChange={(e) => setNewPosition({
                        ...newPosition,
                        entry_price: e.target.value,
                      })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add Position
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 text-gray-400">Symbol</th>
                      <th className="pb-2 text-gray-400">Quantity</th>
                      <th className="pb-2 text-gray-400">Entry Price</th>
                      <th className="pb-2 text-gray-400">Current Price</th>
                      <th className="pb-2 text-gray-400">P&L</th>
                      <th className="pb-2 text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((position) => (
                      <tr key={position.id} className="border-t border-gray-800">
                        <td className="py-2">{position.symbol}</td>
                        <td className="py-2">{position.quantity.toString()}</td>
                        <td className="py-2">${position.entry_price.toFixed(2)}</td>
                        <td className="py-2">${position.current_price.toFixed(2)}</td>
                        <td className={`py-2 ${
                          position.pnl.isPositive() ? 'text-green-500' : 'text-red-500'
                        }`}>
                          ${position.pnl.toFixed(2)}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => deletePosition(position.id)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}