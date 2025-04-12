import http from 'http';
import { logger } from '../utils/logger.js';

export class WebhookHandler {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
  }

  start() {
    this.server = http.createServer(this.handleRequest.bind(this));
    
    this.server.listen(this.port, () => {
      logger.info(`Webhook server listening on port ${this.port}`);
    });

    this.server.on('error', (error) => {
      logger.error('Webhook server error:', error);
    });
  }

  async handleRequest(req, res) {
    try {
      if (req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          const signal = JSON.parse(body);
          logger.info('Received webhook signal', { signal });
          
          // Process the signal based on source
          switch(req.headers['x-source']) {
            case 'tradingview':
              this.handleTradingViewSignal(signal);
              break;
            case 'tradeideas':
              this.handleTradeIdeasSignal(signal);
              break;
            case 'trendspider':
              this.handleTrendSpiderSignal(signal);
              break;
            default:
              logger.warn('Unknown webhook source');
          }

          res.writeHead(200);
          res.end('OK');
        });
      } else {
        res.writeHead(405);
        res.end('Method Not Allowed');
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  handleTradingViewSignal(signal) {
    // Process TradingView signals
  }

  handleTradeIdeasSignal(signal) {
    // Process Trade Ideas signals
  }

  handleTrendSpiderSignal(signal) {
    // Process TrendSpider signals
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}