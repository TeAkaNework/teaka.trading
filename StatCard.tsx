import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  change: string;
  positive: boolean;
}

export function StatCard({ title, value, icon, change, positive }: StatCardProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {icon}
          <h3 className="text-gray-400">{title}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">{value}</span>
        <div className={`flex items-center ${positive ? 'text-green-500' : 'text-red-500'}`}>
          {positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{change}</span>
        </div>
      </div>
    </div>
  );
}