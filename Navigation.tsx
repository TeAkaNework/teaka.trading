import React from 'react';
import { LineChart, Menu } from 'lucide-react';

export function Navigation() {
  return (
    <nav className="border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LineChart className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold">Teaka Trade</span>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <a href="#" className="hover:text-blue-500">Dashboard</a>
          <a href="#" className="hover:text-blue-500">Algorithms</a>
          <a href="#" className="hover:text-blue-500">Portfolio</a>
          <a href="#" className="hover:text-blue-500">Analytics</a>
        </div>
        <button className="md:hidden">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
}