# Teaka Quant Engine

Advanced quantitative trading engine with ML-powered signal generation, backtesting, and portfolio optimization.

## 🚀 Features

- **Strategy Builder**: No-code interface for creating and testing trading strategies
- **ML Signal Engine**: LSTM and ensemble models for market prediction
- **Risk Management**: Adaptive position sizing and portfolio optimization
- **Backtesting**: Multi-asset backtesting with detailed performance metrics
- **Real-time Monitoring**: Live trade tracking and performance analytics

## 🛠️ Tech Stack

- React + TypeScript for frontend
- TradingView charts integration
- Firebase for logging and analytics
- Supabase for data persistence
- ML libraries for quantitative analysis

## 📦 Installation

```bash
git clone https://github.com/TeakaNetwork/quant-engine.git
cd quant-engine
npm install
```

## 🔧 Configuration

1. Set up environment variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

2. Configure trading parameters in `src/config/trading.ts`

## 🚀 Usage

```bash
# Development
npm run dev

# Build
npm run build

# Deploy
npm run deploy
```

## 📊 Strategy Development

1. Use the Strategy Builder to create custom strategies
2. Test with historical data in the Backtest Command Center
3. Monitor performance in real-time
4. Export strategies as JSON for sharing

## 🔒 Security

- All sensitive operations require authentication
- Position sizing and risk limits enforced
- API keys stored securely

## 📈 Performance Metrics

- Sharpe Ratio calculation
- Maximum drawdown tracking
- Win rate analysis
- Risk-adjusted returns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📝 License

MIT License - see LICENSE file

## 🔗 Links

- [Documentation](https://docs.teaka.trading)
- [Trading Platform](https://teaka.trading)
- [Support](mailto:support@teaka.trading)