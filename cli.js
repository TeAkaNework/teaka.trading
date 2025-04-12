import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { SignalEngine } from './src/services/algorithmService.ts';
import { TelegramService } from './services/telegramBot.js';
import { StripeAuth } from './services/stripeAuth.js';
import { WebhookHandler } from './services/webhookHandler.js';
import { PriceService } from './src/services/priceService.ts';
import { SignalTrigger } from './services/signalTrigger.js';
import { BacktestEngine } from './src/services/backtestEngine.ts';
import { logger } from './utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('live', {
    alias: 'l',
    type: 'boolean',
    description: 'Run in live mode'
  })
  .option('backtest', {
    alias: 'b',
    type: 'boolean',
    description: 'Run in backtest mode'
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to backtest config file'
  })
  .option('data', {
    alias: 'd',
    type: 'string',
    description: 'Path to historical data file'
  })
  .help()
  .argv;

async function runBacktest(configPath, dataPath) {
  try {
    // Load backtest config
    const configFile = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configFile);

    // Load historical data
    const dataFile = await fs.readFile(dataPath, 'utf8');
    const historicalData = JSON.parse(dataFile);

    logger.info('Starting backtest with config:', config);

    // Initialize backtester
    const backtester = new BacktestEngine(config);
    await backtester.loadData(historicalData);

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

async function main() {
  try {
    if (argv.backtest) {
      if (!argv.config || !argv.data) {
        logger.error('Backtest requires --config and --data parameters');
        process.exit(1);
      }
      await runBacktest(argv.config, argv.data);
      return;
    }

    logger.info('Starting Teaka CLI...');
    
    // Initialize services
    const priceService = new PriceService();
    const signalEngine = new SignalEngine();
    const telegramBot = new TelegramService(process.env.TELEGRAM_BOT_TOKEN);
    const stripeAuth = new StripeAuth(process.env.STRIPE_SECRET_KEY);
    const webhookHandler = new WebhookHandler();
    const signalTrigger = new SignalTrigger();

    await signalTrigger.initialize();

    // Set up signal processing pipeline
    priceService.onPriceUpdate(async (tick) => {
      try {
        // Evaluate signal
        const signal = await signalEngine.evaluateSignal(tick);
        if (!signal) return;

        // Check user subscription
        const userId = signal.userId;
        const isSubscribed = await stripeAuth.checkSubscription(userId);
        if (!isSubscribed) {
          logger.warn(`User ${userId} not subscribed, skipping signal`);
          return;
        }

        // Execute trades in live mode
        if (argv.live) {
          const result = await signalTrigger.triggerSignal(signal);
          if (result.success) {
            logger.info('Trade executed successfully', { result });
          } else {
            logger.error('Trade execution failed', { result });
          }
        }

        // Send alert
        await telegramBot.sendSignal(signal);
        logger.info('Signal processed and sent', { signal });

      } catch (error) {
        logger.error('Error processing signal:', error);
      }
    });

    // Start webhook server for external platforms
    webhookHandler.start();

    logger.info('Teaka CLI initialized successfully');
    logger.info(`Running in ${argv.live ? 'live' : 'test'} mode`);

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();