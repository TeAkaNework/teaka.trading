import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    TradingView?: {
      widget: any;
    };
  }
}

export function TradingViewWidget({ symbol, theme = 'dark' }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!container.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView && container.current) {
        new window.TradingView.widget({
          container_id: container.current.id,
          symbol: `BINANCE:${symbol}`,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: false,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies'
          ],
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
          hide_side_toolbar: false,
          withdateranges: true,
          hide_volume: false,
          width: '100%',
          height: '100%'
        });
      }
    };
    scriptRef.current = script;
    document.head.appendChild(script);

    return () => {
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
      }
    };
  }, [symbol, theme]);

  return <div id="tradingview_widget" ref={container} className="h-full w-full" />;
}