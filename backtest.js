// @ts-check
import { BacktestEngine } from './src/services/backtestEngine.js';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './utils/logger.js';

async function runBacktest() {
  try {
    // Load configuration
    const configFile = await fs.readFile('backtest_config.json', 'utf8');
    const config = JSON.parse(configFile);

    // Load sample data
    const dataFile = await fs.readFile('sample_data.json', 'utf8');
    const { data } = JSON.parse(dataFile);

    logger.info('Starting backtest with config:', config);

    // Initialize backtester
    const backtester = new BacktestEngine(config);
    await backtester.loadData(data);

    // Run backtest
    const results = await backtester.run();

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join('backtest_results', `${config.strategy}_${timestamp}.json`);
    
    await fs.mkdir('backtest_results', { recursive: true });
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

    logger.info('Backtest completed. Results saved to:', resultsPath);
    logger.info('Summary:', {
      trades: results.metrics.totalTrades,
      winRate: `${results.metrics.winRate.toFixed(2)}%`,
      pnl: results.metrics.pnl.toFixed(2),
      sharpe: results.metrics.sharpeRatio.toFixed(2)
    });

  } catch (error) {
    logger.error('Backtest error:', error);
    process.exit(1);
  }
}

runBacktest();