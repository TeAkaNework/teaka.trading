import axios from 'axios';
import { logger } from '../utils/logger.js';

export class OandaExecutor {
  constructor() {
    this.apiKey = process.env.OANDA_KEY;
    this.accountId = process.env.OANDA_ACCOUNT;
    this.baseUrl = 'https://api-fxpractice.oanda.com/v3';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async checkConnection() {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}`);
      logger.info('OANDA connection successful', {
        account: response.data.account.id,
        currency: response.data.account.currency
      });
      return true;
    } catch (error) {
      logger.error('OANDA connection failed:', error.response?.data || error.message);
      return false;
    }
  }

  async executeSignal(signal) {
    try {
      logger.info('Executing OANDA signal', { signal });

      // Convert signal format
      const order = {
        order: {
          instrument: signal.symbol.replace('/', '_'),
          units: signal.action === 'BUY' ? signal.units : `-${signal.units}`,
          type: 'MARKET',
          positionFill: 'DEFAULT',
          takeProfitOnFill: { price: signal.tp.toString() },
          stopLossOnFill: { price: signal.sl.toString() }
        }
      };

      // Send order
      const response = await this.client.post(
        `/accounts/${this.accountId}/orders`,
        order
      );

      const result = {
        success: true,
        order: {
          id: response.data.orderCreateTransaction.id,
          instrument: response.data.orderCreateTransaction.instrument,
          units: response.data.orderCreateTransaction.units,
          price: response.data.orderCreateTransaction.price,
          type: response.data.orderCreateTransaction.type
        }
      };

      logger.info('OANDA order executed successfully', result);
      return result;

    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.response?.data?.errorMessage || error.message,
          code: error.response?.data?.errorCode || 'UNKNOWN'
        }
      };

      logger.error('OANDA order execution failed:', errorResponse);
      return errorResponse;
    }
  }

  async getAccountSummary() {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}/summary`);
      return {
        balance: response.data.account.balance,
        currency: response.data.account.currency,
        openTradeCount: response.data.account.openTradeCount,
        openPositions: response.data.account.positions.length,
        pl: response.data.account.pl,
        unrealizedPL: response.data.account.unrealizedPL
      };
    } catch (error) {
      logger.error('Failed to get OANDA account summary:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOpenPositions() {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}/openPositions`);
      return response.data.positions.map(position => ({
        instrument: position.instrument,
        units: position.long.units || position.short.units,
        averagePrice: position.long.averagePrice || position.short.averagePrice,
        pl: position.pl,
        unrealizedPL: position.unrealizedPL
      }));
    } catch (error) {
      logger.error('Failed to get OANDA open positions:', error.response?.data || error.message);
      throw error;
    }
  }

  async closePosition(instrument) {
    try {
      const response = await this.client.put(
        `/accounts/${this.accountId}/positions/${instrument}/close`,
        { longUnits: 'ALL', shortUnits: 'ALL' }
      );
      
      return {
        success: true,
        transaction: response.data.longOrderCreateTransaction || response.data.shortOrderCreateTransaction
      };
    } catch (error) {
      logger.error('Failed to close OANDA position:', error.response?.data || error.message);
      throw error;
    }
  }

  async modifyPosition(instrument, stopLoss, takeProfit) {
    try {
      const response = await this.client.put(
        `/accounts/${this.accountId}/positions/${instrument}/orders`,
        {
          stopLoss: { price: stopLoss.toString() },
          takeProfit: { price: takeProfit.toString() }
        }
      );
      
      return {
        success: true,
        transaction: response.data.transaction
      };
    } catch (error) {
      logger.error('Failed to modify OANDA position:', error.response?.data || error.message);
      throw error;
    }
  }
}