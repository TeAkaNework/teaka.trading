import React from 'react';

interface TradeIdeasWidgetProps {
  symbol: string;
  theme?: 'light' | 'dark';
}

export function TradeIdeasWidget({ symbol, theme = 'dark' }: TradeIdeasWidgetProps) {
  return (
    <iframe
      src={`https://trade-ideas.com/chart/${symbol}?theme=${theme}`}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="Trade Ideas Chart"
    />
  );
}