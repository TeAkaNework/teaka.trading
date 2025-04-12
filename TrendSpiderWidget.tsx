import React from 'react';

interface TrendSpiderWidgetProps {
  symbol: string;
  theme?: 'light' | 'dark';
}

export function TrendSpiderWidget({ symbol, theme = 'dark' }: TrendSpiderWidgetProps) {
  return (
    <iframe
      src={`https://charts.trendspider.com/embed/${symbol}?theme=${theme}`}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="TrendSpider Chart"
    />
  );
}