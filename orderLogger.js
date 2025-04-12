import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OrderLogger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.orderLogFile = path.join(this.logDir, 'trade_log.json');
    this.initialize();
  }

  async initialize() {
    try {
      // Create logs directory if it doesn't exist
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Initialize empty log file if it doesn't exist
      try {
        await fs.access(this.orderLogFile);
      } catch {
        await fs.writeFile(this.orderLogFile, '[]');
      }
      
      logger.info('Order logger initialized');
    } catch (error) {
      logger.error('Failed to initialize order logger:', error);
      throw error;
    }
  }

  async logOrder(order, executionResult) {
    try {
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        order: {
          symbol: order.symbol,
          action: order.action,
          units: order.units,
          volume: order.volume,
          entry: order.price || order.entry,
          tp: order.tp,
          sl: order.sl,
          strategy: order.strategy,
          confidence: order.confidence,
          timeframe: order.timeframe,
          broker: order.broker || 'UNKNOWN'
        },
        execution: {
          success: executionResult.success,
          platform: executionResult.platform,
          orderId: executionResult.order?.id,
          filledPrice: executionResult.order?.price,
          filledUnits: executionResult.order?.units || executionResult.order?.volume,
          error: executionResult.error,
          executionTime: executionResult.timestamp
        },
        risk: {
          riskAmount: order.riskAmount,
          riskPercent: order.riskPercent,
          exposure: order.exposure,
          validation: executionResult.riskValidation
        },
        performance: {
          pnl: null,
          roi: null,
          exitPrice: null,
          exitTime: null,
          holdingPeriod: null,
          status: 'OPEN'
        },
        metadata: {
          signals: order.signals || [],
          indicators: order.indicators || {},
          notes: order.notes,
          tags: order.tags || []
        }
      };

      // Read existing logs
      const logs = JSON.parse(await fs.readFile(this.orderLogFile, 'utf8'));
      
      // Add new log entry at the beginning
      logs.unshift(logEntry);
      
      // Write updated logs
      await fs.writeFile(this.orderLogFile, JSON.stringify(logs, null, 2));
      
      logger.info('Order logged successfully', {
        orderId: logEntry.id,
        symbol: order.symbol,
        action: order.action
      });

      return logEntry.id;

    } catch (error) {
      logger.error('Failed to log order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, updates) {
    try {
      const logs = JSON.parse(await fs.readFile(this.orderLogFile, 'utf8'));
      
      const orderIndex = logs.findIndex(log => log.id === orderId);
      if (orderIndex === -1) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Update order with new data
      logs[orderIndex] = {
        ...logs[orderIndex],
        ...updates,
        performance: {
          ...logs[orderIndex].performance,
          ...updates.performance,
          lastUpdated: new Date().toISOString()
        }
      };

      // Calculate PnL if closing the position
      if (updates.performance?.exitPrice) {
        const order = logs[orderIndex].order;
        const entry = new Decimal(order.entry);
        const exit = new Decimal(updates.performance.exitPrice);
        const units = new Decimal(order.units || order.volume);
        
        const pnl = order.action === 'BUY'
          ? exit.minus(entry).times(units)
          : entry.minus(exit).times(units);
        
        const roi = pnl.dividedBy(entry.times(units)).times(100);
        
        logs[orderIndex].performance.pnl = pnl.toNumber();
        logs[orderIndex].performance.roi = roi.toNumber();
        logs[orderIndex].performance.status = 'CLOSED';
      }

      await fs.writeFile(this.orderLogFile, JSON.stringify(logs, null, 2));
      
      logger.info('Order status updated', {
        orderId,
        updates
      });

    } catch (error) {
      logger.error('Failed to update order status:', error);
      throw error;
    }
  }

  async getOrderHistory(filters = {}) {
    try {
      const logs = JSON.parse(await fs.readFile(this.orderLogFile, 'utf8'));
      
      return logs.filter(log => {
        let match = true;
        
        if (filters.symbol) {
          match = match && log.order.symbol === filters.symbol;
        }
        
        if (filters.strategy) {
          match = match && log.order.strategy === filters.strategy;
        }
        
        if (filters.status) {
          match = match && log.performance.status === filters.status;
        }
        
        if (filters.broker) {
          match = match && log.order.broker === filters.broker;
        }
        
        if (filters.dateFrom) {
          match = match && new Date(log.timestamp) >= new Date(filters.dateFrom);
        }
        
        if (filters.dateTo) {
          match = match && new Date(log.timestamp) <= new Date(filters.dateTo);
        }
        
        return match;
      });

    } catch (error) {
      logger.error('Failed to get order history:', error);
      throw error;
    }
  }

  async getPerformanceStats(timeframe = '1d') {
    try {
      const logs = JSON.parse(await fs.readFile(this.orderLogFile, 'utf8'));
      const closedTrades = logs.filter(log => log.performance.status === 'CLOSED');
      
      const stats = {
        totalTrades: closedTrades.length,
        winningTrades: closedTrades.filter(log => log.performance.pnl > 0).length,
        losingTrades: closedTrades.filter(log => log.performance.pnl < 0).length,
        totalPnL: closedTrades.reduce((sum, log) => sum + (log.performance.pnl || 0), 0),
        averageRoi: closedTrades.reduce((sum, log) => sum + (log.performance.roi || 0), 0) / closedTrades.length,
        byStrategy: {},
        bySymbol: {}
      };

      // Calculate win rate
      stats.winRate = stats.totalTrades > 0
        ? (stats.winningTrades / stats.totalTrades) * 100
        : 0;

      // Group by strategy
      closedTrades.forEach(log => {
        const strategy = log.order.strategy;
        if (!stats.byStrategy[strategy]) {
          stats.byStrategy[strategy] = {
            trades: 0,
            pnl: 0,
            winRate: 0
          };
        }
        
        stats.byStrategy[strategy].trades++;
        stats.byStrategy[strategy].pnl += log.performance.pnl || 0;
      });

      // Group by symbol
      closedTrades.forEach(log => {
        const symbol = log.order.symbol;
        if (!stats.bySymbol[symbol]) {
          stats.bySymbol[symbol] = {
            trades: 0,
            pnl: 0,
            winRate: 0
          };
        }
        
        stats.bySymbol[symbol].trades++;
        stats.bySymbol[symbol].pnl += log.performance.pnl || 0;
      });

      // Calculate win rates for each group
      Object.values(stats.byStrategy).forEach(strategy => {
        strategy.winRate = strategy.trades > 0
          ? (strategy.pnl > 0 ? 1 : 0) * 100
          : 0;
      });

      Object.values(stats.bySymbol).forEach(symbol => {
        symbol.winRate = symbol.trades > 0
          ? (symbol.pnl > 0 ? 1 : 0) * 100
          : 0;
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get performance stats:', error);
      throw error;
    }
  }
}