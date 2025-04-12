import React from 'react';
import { Lock } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
  requiredRole?: string;
}

export function AccessDenied({ 
  message = "You don't have access to this feature",
  requiredRole
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg">
      <Lock className="w-16 h-16 text-gray-600 mb-4" />
      <h3 className="text-xl font-semibold text-gray-300 mb-2">{message}</h3>
      {requiredRole && (
        <p className="text-gray-500">
          Required role: <span className="text-blue-500">{requiredRole}</span>
        </p>
      )}
      <button 
        onClick={() => window.location.href = '/pricing'}
        className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
      >
        Upgrade Account
      </button>
    </div>
  );
}