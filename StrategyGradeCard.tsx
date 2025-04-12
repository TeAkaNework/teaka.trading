import React from 'react';
import { Award, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { GradeResult } from '../services/strategyGrader';

interface StrategyGradeCardProps {
  grade: GradeResult;
}

export function StrategyGradeCard({ grade }: StrategyGradeCardProps) {
  const getGradeColor = () => {
    switch (grade.grade) {
      case 'A': return 'text-green-500';
      case 'B': return 'text-blue-500';
      case 'C': return 'text-yellow-500';
      case 'D': return 'text-orange-500';
      case 'F': return 'text-red-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <Award className="w-5 h-5 text-blue-500 mr-2" />
          Strategy Grade
        </h3>
        <div className={`text-4xl font-bold ${getGradeColor()}`}>
          {grade.grade}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm">Profit Score</p>
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
            <span className="font-semibold">{grade.metrics.profitScore.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Risk Score</p>
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
            <span className="font-semibold">{grade.metrics.riskScore.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Consistency</p>
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />
            <span className="font-semibold">{grade.metrics.consistencyScore.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Robustness</p>
          <div className="flex items-center">
            <Award className="w-4 h-4 text-purple-500 mr-2" />
            <span className="font-semibold">{grade.metrics.robustnessScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Analysis Notes</h4>
        {grade.notes.map((note, index) => (
          <div key={index} className="flex items-start space-x-2 text-sm">
            <span className="text-gray-500">•</span>
            <span className="text-gray-300">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}