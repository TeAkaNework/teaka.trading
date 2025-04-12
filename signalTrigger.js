import { logger } from '../utils/logger.js';
import { OandaExecutor } from './oandaExecutor.js';
import { MT5Executor } from './mt5Executor.js';
import { RiskManager } from './riskManager.js';
import { OrderLogger } from './orderLogger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SignalTrigger {
  constructor() {
    this.oandaExecutor = new OandaExecutor();
    this.mt5Executor = new MT5Executor();
    this.riskManager = new RiskManager();
    this.orderLogger = new OrderLogger();
    this.signalPath = path.join(__dirname, '..', 'signals');
  }

  async initialize() {
    try {
      await fs.mkdir(this.signalPath, { recursive: true });
      logger.info('Signal trigger initialized');
    } catch (error) {
      logger.error('Failed to initialize signal trigger:', error);
      throw error;
    }
  }

  async triggerSignal(signal) {
    const executionId = Date.now().toString();
    
    try {
      logger.info('Processing signal trigger:', { 
        executionId,
        signal 
      });

      // Validate signal format
      if (!this.validateSignal(signal)) {
        throw new Error('Invalid signal format');
      }

      // Determine execution platform
      const platform = this.determineExecutionPlatform(signal.symbol);
      
      // Get account info
      let accountInfo;
      if (platform === 'oanda') {
        accountInfo = await this.oandaExecutor.getAccountSummary();
      } else {
        // Get MT5 account info through Python bridge
        accountInfo = await this.mt5Executor.getAccountInfo();
      }

      // Perform risk checks
      const riskValidation = await this.riskManager.validateTrade(signal, accountInfo);
      
      if (!riskValidation.passed) {
        logger.warn('Risk validation failed:', {
          executionId,
          signal,
          validation: riskValidation
        });
        
        const result = {
          success: false,
          executionId,
          error: {
            type: 'RISK_VALIDATION_FAILED',
            details: riskValidation.errors
          }
        };

        // Log failed order
        await this.orderLogger.logOrder(signal, {
          ...result,
          platform,
          timestamp: new Date().toISOString(),
          riskValidation
        });

        return result;
      }

      // Execute trade
      let result;
      if (platform === 'oanda') {
        result = await this.oandaExecutor.executeSignal({
          symbol: signal.symbol,
          action: signal.action,
          units: signal.units || 100,
          tp: signal.tp,
          sl: signal.sl
        });
      } else if (platform === 'mt5') {
        result = await this.mt5Executor.executeSignal({
          symbol: signal.symbol,
          volume: signal.volume || 0.1,
          action: signal.action,
          tp: signal.tp,
          sl: signal.sl
        });
      } else {
        throw new Error(`Unsupported platform for symbol: ${signal.symbol}`);
      }

      // Add execution metadata
      result.executionId = executionId;
      result.timestamp = new Date().toISOString();
      result.platform = platform;
      result.riskValidation = riskValidation;

      // Log execution result
      if (result.success) {
        logger.info(`${platform.toUpperCase()} trade executed successfully:`, {
          executionId,
          result
        });
        
        // Update risk manager with new position
        if (result.order) {
          this.riskManager.updatePosition({
            symbol: signal.symbol,
            entryPrice: result.order.price,
            size: result.order.units || result.order.volume
          });
        }
      } else {
        logger.error(`${platform.toUpperCase()} trade execution failed:`, {
          executionId,
          result
        });
      }

      // Log order with full execution details
      const orderId = await this.orderLogger.logOrder(signal, result);

      // Add orderId to result
      result.orderId = orderId;

      return result;

    } catch (error) {
      logger.error('Signal trigger error:', {
        executionId,
        signal,
        error: error.message,
        stack: error.stack
      });

      const failedResult = {
        success: false,
        executionId,
        error: {
          message: error.message,
          type: error.name,
          details: error.details || null
        }
      };

      // Log failed order
      await this.orderLogger.logOrder(signal, failedResult);

      throw error;
    }
  }

  determineExecutionPlatform(symbol) {
    // OANDA symbols use underscore (e.g., XAU_USD)
    if (symbol.includes('_')) {
      return 'oanda';
    }
    // MT5 symbols use no separator or dot (e.g., XAUUSD)
    return 'mt5';
  }

  validateSignal(signal) {
    const requiredFields = ['symbol', 'action', 'tp', 'sl'];
    
    for (const field of requiredFields) {
      if (!(field in signal)) {
        logger.error(`Missing required field: ${field}`, {
          field,
          signal
        });
        return false;
      }
    }

    if (!['BUY', 'SELL'].includes(signal.action)) {
      logger.error('Invalid action type', {
        action: signal.action,
        signal
      });
      return false;
    }

    if (typeof signal.tp !== 'number' || typeof signal.sl !== 'number') {
      logger.error('Invalid TP/SL values', {
        tp: signal.tp,
        sl: signal.sl,
        signal
      });
      return false;
    }

    return true;
  }

  async archiveSignal(signal, result) {
    try {
      const archivePath = path.join(this.signalPath, 'archive');
      await fs.mkdir(archivePath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = path.join(
        archivePath,
        `signal_${timestamp}.json`
      );
      
      const archiveData = {
        signal,
        result,
        execution: {
          id: result.executionId,
          timestamp: new Date().toISOString(),
          platform: this.determineExecutionPlatform(signal.symbol)
        },
        validation: result.riskValidation || null
      };

      await fs.writeFile(archiveFile, JSON.stringify(archiveData, null, 2));

      logger.info('Signal archived successfully', {
        executionId: result.executionId,
        file: archiveFile
      });
    } catch (error) {
      logger.error('Failed to archive signal:', {
        executionId: result.executionId,
        error: error.message
      });
    }
  }
}