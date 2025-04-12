import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger.js';

export class TelegramService {
  constructor(token) {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }
    
    this.bot = new TelegramBot(token, { polling: false });
    this.chatIds = new Set();
    this.initialize();
  }

  initialize() {
    // Load saved chat IDs from persistent storage if needed
    logger.info('Initializing Telegram bot');
  }

  async sendSignal(signal) {
    try {
      if (this.chatIds.size === 0) {
        logger.warn('No chat IDs registered to receive signals');
        return;
      }

      const message = this.formatSignalMessage(signal);
      
      const sendPromises = Array.from(this.chatIds).map(chatId =>
        this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }).catch(error => {
          logger.error(`Failed to send message to chat ${chatId}:`, error);
          if (error.response?.statusCode === 403) {
            logger.info(`Removing blocked chat ${chatId}`);
            this.removeChat(chatId);
          }
        })
      );

      await Promise.all(sendPromises);
      logger.info('Signal sent to all chats', { 
        signal,
        recipientCount: this.chatIds.size 
      });

    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  formatSignalMessage(signal) {
    const emoji = this.getSignalEmoji(signal.type);
    const confidenceBar = this.getConfidenceBar(signal.confidence);
    const profitRatio = this.calculateProfitRatio(signal);

    return `
${emoji} <b>Trading Signal: ${signal.symbol}</b>

📊 <b>Signal Details</b>
Type: ${signal.type}
Price: $${signal.price.toFixed(2)}
Strategy: ${signal.strategy}

📈 <b>Targets</b>
Take Profit: $${signal.takeProfit.toFixed(2)}
Stop Loss: $${signal.stopLoss.toFixed(2)}
Risk/Reward: ${profitRatio.toFixed(2)}

🎯 <b>Confidence: ${signal.confidence}%</b>
${confidenceBar}

⚡️ <b>Performance</b>
${this.formatPerformanceMetrics(signal)}

⏰ Generated: ${new Date(signal.timestamp).toLocaleString()}
`;
  }

  getSignalEmoji(type) {
    switch (type.toUpperCase()) {
      case 'BUY': return '🟢';
      case 'SELL': return '🔴';
      case 'CLOSE': return '⚪️';
      default: return '⚠️';
    }
  }

  getConfidenceBar(confidence) {
    const totalBars = 10;
    const filledBars = Math.round((confidence / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
  }

  calculateProfitRatio(signal) {
    const entry = new Decimal(signal.price);
    const tp = new Decimal(signal.takeProfit);
    const sl = new Decimal(signal.stopLoss);
    
    const potentialProfit = tp.minus(entry).abs();
    const potentialLoss = entry.minus(sl).abs();
    
    return potentialLoss.isZero() ? 
      new Decimal(0) : 
      potentialProfit.dividedBy(potentialLoss);
  }

  formatPerformanceMetrics(signal) {
    if (!signal.performance) return 'No performance data available';

    return `Win Rate: ${(signal.performance.winRate * 100).toFixed(1)}%
Sharpe Ratio: ${signal.performance.sharpe.toFixed(2)}
Profit Factor: ${signal.performance.profitFactor.toFixed(2)}`;
  }

  addChat(chatId) {
    if (typeof chatId !== 'string' && typeof chatId !== 'number') {
      throw new Error('Invalid chat ID');
    }
    
    this.chatIds.add(chatId.toString());
    logger.info(`Added chat ID: ${chatId}`);
  }

  removeChat(chatId) {
    const removed = this.chatIds.delete(chatId.toString());
    if (removed) {
      logger.info(`Removed chat ID: ${chatId}`);
    }
    return removed;
  }

  getChatCount() {
    return this.chatIds.size;
  }

  async sendTestMessage(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        '✅ Bot connection test successful',
        { parse_mode: 'HTML' }
      );
      logger.info(`Test message sent to chat ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send test message to chat ${chatId}:`, error);
      return false;
    }
  }
}