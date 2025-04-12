import Decimal from 'decimal.js';
import * as KucoinAPI from 'kucoin-node-sdk';
import KucoinFutures from 'kucoin-futures-node-api';
import { useExchangeStore } from '../stores/exchangeStore';

export interface PriceUpdate {
  symbol: string;
  price: Decimal;
  change24h: Decimal;
  volume: Decimal;
  high24h: Decimal;
  low24h: Decimal;
  timestamp: number;
  assetType: 'spot' | 'futures' | 'forex' | 'commodity';
  exchange: 'kucoin' | 'bitget';
  error?: string;
}

interface WebSocketMessage {
  type: string;
  topic: string;
  subject: string;
  data: {
    symbol: string;
    price: string;
    size: string;
    bestBid: string;
    bestBidSize: string;
    bestAsk: string;
    bestAskSize: string;
    timestamp: number;
    openPrice24h: string;
  };
}

export class PriceService {
  private kucoinSpotWs: WebSocket | null = null;
  private kucoinFuturesWs: WebSocket | null = null;
  private bitgetSpotWs: WebSocket | null = null;
  private bitgetFuturesWs: WebSocket | null = null;
  private subscribers: ((update: PriceUpdate) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectDelay = 2000;
  private heartbeatInterval: number | null = null;
  private lastMessageTime = 0;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly CONNECTION_TIMEOUT = 60000;
  private isConnecting = false;

  private readonly SPOT_PAIRS = [
    'BTC-USDT',
    'ETH-USDT',
    'SOL-USDT',
    'BNB-USDT',
    'ADA-USDT'
  ];

  private readonly FUTURES_PAIRS = [
    'XBTUSDTM',  // Bitcoin Perpetual
    'ETHUSDTM',  // Ethereum Perpetual
    'SOLUSDTM',  // Solana Perpetual
    'BNBUSDTM',  // BNB Perpetual
    'ADAUSDTM'   // Cardano Perpetual
  ];

  constructor() {
    this.initializeExchanges();
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - this.lastMessageTime > this.CONNECTION_TIMEOUT) {
        console.warn('⚠️ WebSocket timeout, reconnecting...');
        this.disconnect();
        this.initializeExchanges();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private async initializeExchanges() {
    const { configs } = useExchangeStore.getState();
    
    // Initialize enabled exchanges
    for (const config of configs) {
      if (!config.enabled) continue;

      if (config.name === 'kucoin') {
        if (config.type === 'spot') {
          KucoinAPI.init({
            apiKey: config.apiKey,
            secretKey: config.secretKey,
            passphrase: config.passphrase,
            environment: 'live'
          });
          await this.connectKucoinSpot();
        } else if (config.type === 'futures') {
          KucoinFutures.init({
            apiKey: config.apiKey,
            secretKey: config.secretKey,
            passphrase: config.passphrase,
            environment: 'live'
          });
          await this.connectKucoinFutures();
        }
      } else if (config.name === 'bitget') {
        if (config.type === 'spot') {
          await this.connectBitgetSpot();
        } else if (config.type === 'futures') {
          await this.connectBitgetFutures();
        }
      }
    }
  }

  private async connectKucoinSpot() {
    try {
      const response = await KucoinAPI.getPublicWsToken();
      const { token, instanceServers } = response.data;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&acceptUserMessage=true`;

      this.kucoinSpotWs = new WebSocket(wsUrl);
      
      this.kucoinSpotWs.onopen = () => {
        console.log('Kucoin Spot WebSocket connected');
        this.subscribeKucoinSpot();
      };

      this.kucoinSpotWs.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        const message = JSON.parse(event.data);
        if (message.type === 'message') {
          this.processKucoinSpotUpdate(message);
        }
      };

      this.kucoinSpotWs.onerror = (error) => {
        console.error('Kucoin Spot WebSocket error:', error);
        this.handleReconnect('kucoin-spot');
      };

      this.kucoinSpotWs.onclose = () => {
        console.log('Kucoin Spot WebSocket closed');
        this.handleReconnect('kucoin-spot');
      };
    } catch (error) {
      console.error('Failed to connect to Kucoin Spot:', error);
      this.notifySubscribersOfState('error', 'kucoin-spot', error.message);
    }
  }

  private async connectKucoinFutures() {
    try {
      const response = await KucoinFutures.getPublicWsToken();
      const { token, instanceServers } = response.data;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&acceptUserMessage=true`;

      this.kucoinFuturesWs = new WebSocket(wsUrl);
      
      this.kucoinFuturesWs.onopen = () => {
        console.log('Kucoin Futures WebSocket connected');
        this.subscribeKucoinFutures();
      };

      this.kucoinFuturesWs.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        const message = JSON.parse(event.data);
        if (message.type === 'message') {
          this.processKucoinFuturesUpdate(message);
        }
      };

      this.kucoinFuturesWs.onerror = (error) => {
        console.error('Kucoin Futures WebSocket error:', error);
        this.handleReconnect('kucoin-futures');
      };

      this.kucoinFuturesWs.onclose = () => {
        console.log('Kucoin Futures WebSocket closed');
        this.handleReconnect('kucoin-futures');
      };
    } catch (error) {
      console.error('Failed to connect to Kucoin Futures:', error);
      this.notifySubscribersOfState('error', 'kucoin-futures', error.message);
    }
  }

  private async connectBitgetSpot() {
    // Implement Bitget Spot connection
    // Similar to Kucoin implementation but with Bitget-specific endpoints and message formats
  }

  private async connectBitgetFutures() {
    // Implement Bitget Futures connection
    // Similar to Kucoin implementation but with Bitget-specific endpoints and message formats
  }

  private subscribeKucoinSpot() {
    if (this.kucoinSpotWs?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        topic: `/market/ticker:${this.SPOT_PAIRS.join(',')}`,
        privateChannel: false,
        response: true
      };

      this.kucoinSpotWs.send(JSON.stringify(message));
    }
  }

  private subscribeKucoinFutures() {
    if (this.kucoinFuturesWs?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        topic: `/contractMarket/ticker:${this.FUTURES_PAIRS.join(',')}`,
        privateChannel: false,
        response: true
      };

      this.kucoinFuturesWs.send(JSON.stringify(message));
    }
  }

  private processKucoinSpotUpdate(message: WebSocketMessage) {
    const currentPrice = new Decimal(message.data.price);
    const openPrice = new Decimal(message.data.openPrice24h);
    const change24h = currentPrice.minus(openPrice).dividedBy(openPrice);

    const update: PriceUpdate = {
      symbol: message.data.symbol,
      price: currentPrice,
      change24h,
      volume: new Decimal(message.data.size),
      high24h: new Decimal(message.data.bestAsk),
      low24h: new Decimal(message.data.bestBid),
      timestamp: message.data.timestamp,
      assetType: 'spot',
      exchange: 'kucoin'
    };

    this.notifySubscribers(update);
  }

  private processKucoinFuturesUpdate(message: WebSocketMessage) {
    const currentPrice = new Decimal(message.data.price);
    const openPrice = new Decimal(message.data.openPrice24h);
    const change24h = currentPrice.minus(openPrice).dividedBy(openPrice);

    const update: PriceUpdate = {
      symbol: message.data.symbol,
      price: currentPrice,
      change24h,
      volume: new Decimal(message.data.size),
      high24h: new Decimal(message.data.bestAsk),
      low24h: new Decimal(message.data.bestBid),
      timestamp: message.data.timestamp,
      assetType: 'futures',
      exchange: 'kucoin'
    };

    this.notifySubscribers(update);
  }

  private handleReconnect(type: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.calculateBackoff(this.reconnectAttempts);
      console.log(`Attempting ${type} reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        switch (type) {
          case 'kucoin-spot':
            this.connectKucoinSpot();
            break;
          case 'kucoin-futures':
            this.connectKucoinFutures();
            break;
          case 'bitget-spot':
            this.connectBitgetSpot();
            break;
          case 'bitget-futures':
            this.connectBitgetFutures();
            break;
        }
      }, delay);
    } else {
      console.error(`Max ${type} reconnection attempts reached`);
      this.notifySubscribersOfState('failed', type);
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.handleReconnect(type);
      }, 60000);
    }
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = this.reconnectDelay;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attempt),
      maxDelay
    );
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(exponentialDelay + jitter);
  }

  private notifySubscribersOfState(
    state: string,
    type: string,
    message?: string
  ) {
    const errorUpdate: PriceUpdate = {
      symbol: `SYSTEM_${type.toUpperCase()}`,
      price: new Decimal(0),
      change24h: new Decimal(0),
      volume: new Decimal(0),
      high24h: new Decimal(0),
      low24h: new Decimal(0),
      timestamp: Date.now(),
      assetType: 'spot',
      exchange: 'kucoin',
      error: `${state}${message ? ': ' + message : ''}`
    };
    this.notifySubscribers(errorUpdate);
  }

  private notifySubscribers(update: PriceUpdate) {
    this.subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in price update subscriber:', error);
      }
    });
  }

  public onPriceUpdate(callback: (update: PriceUpdate) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  public disconnect() {
    if (this.kucoinSpotWs) {
      this.kucoinSpotWs.close();
      this.kucoinSpotWs = null;
    }
    
    if (this.kucoinFuturesWs) {
      this.kucoinFuturesWs.close();
      this.kucoinFuturesWs = null;
    }
    
    if (this.bitgetSpotWs) {
      this.bitgetSpotWs.close();
      this.bitgetSpotWs = null;
    }
    
    if (this.bitgetFuturesWs) {
      this.bitgetFuturesWs.close();
      this.bitgetFuturesWs = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.subscribers = [];
  }

  public getAvailableSymbols() {
    return {
      spot: this.SPOT_PAIRS,
      futures: this.FUTURES_PAIRS
    };
  }
}