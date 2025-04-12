import axios from 'axios';
import { Signal } from './algorithmService';
import { logger } from '../utils/logger';

interface WebhookConfig {
  url: string;
  type: 'discord' | 'notion' | 'custom';
  headers?: Record<string, string>;
  enabled: boolean;
}

interface BacktestResult {
  strategy: string;
  pnl: number;
  trades: Signal[];
  metrics: {
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    profitFactor: number;
  };
  timestamp: string;
}

export class WebhookLogger {
  private configs: WebhookConfig[] = [];
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(configs?: WebhookConfig[]) {
    if (configs) {
      this.configs = configs;
    }
  }

  public async logBacktestResult(result: BacktestResult): Promise<void> {
    const promises = this.configs
      .filter(config => config.enabled)
      .map(config => this.sendWebhook(config, result));

    try {
      await Promise.all(promises);
      logger.info('✅ Webhook logs sent successfully');
    } catch (error) {
      logger.error('❌ Error sending webhook logs:', error);
      throw error;
    }
  }

  private async sendWebhook(
    config: WebhookConfig,
    result: BacktestResult
  ): Promise<void> {
    const payload = this.formatPayload(config.type, result);
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await axios.post(config.url, payload, { headers });
        return;
      } catch (error) {
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  private formatPayload(
    type: WebhookConfig['type'],
    result: BacktestResult
  ): unknown {
    switch (type) {
      case 'discord':
        return this.formatDiscordPayload(result);
      case 'notion':
        return this.formatNotionPayload(result);
      default:
        return this.formatCustomPayload(result);
    }
  }

  private formatDiscordPayload(result: BacktestResult) {
    const color = result.pnl >= 0 ? 0x00ff00 : 0xff0000;
    
    return {
      embeds: [{
        title: `📊 Backtest Results: ${result.strategy}`,
        color,
        fields: [
          {
            name: 'PnL',
            value: `$${result.pnl.toFixed(2)}`,
            inline: true
          },
          {
            name: 'Win Rate',
            value: `${(result.metrics.winRate * 100).toFixed(1)}%`,
            inline: true
          },
          {
            name: 'Sharpe Ratio',
            value: result.metrics.sharpeRatio.toFixed(2),
            inline: true
          },
          {
            name: 'Max Drawdown',
            value: `${(result.metrics.maxDrawdown * 100).toFixed(1)}%`,
            inline: true
          },
          {
            name: 'Profit Factor',
            value: result.metrics.profitFactor.toFixed(2),
            inline: true
          },
          {
            name: 'Total Trades',
            value: result.trades.length.toString(),
            inline: true
          }
        ],
        timestamp: result.timestamp
      }]
    };
  }

  private formatNotionPayload(result: BacktestResult) {
    return {
      parent: {
        database_id: process.env.NOTION_DATABASE_ID
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `Backtest: ${result.strategy}`
              }
            }
          ]
        },
        PnL: {
          number: result.pnl
        },
        'Win Rate': {
          number: result.metrics.winRate * 100
        },
        'Sharpe Ratio': {
          number: result.metrics.sharpeRatio
        },
        'Max Drawdown': {
          number: result.metrics.maxDrawdown * 100
        },
        'Profit Factor': {
          number: result.metrics.profitFactor
        },
        'Total Trades': {
          number: result.trades.length
        },
        Date: {
          date: {
            start: result.timestamp
          }
        }
      }
    };
  }

  private formatCustomPayload(result: BacktestResult) {
    return {
      strategy: result.strategy,
      pnl: result.pnl,
      metrics: result.metrics,
      trades: result.trades.map(trade => ({
        timestamp: trade.timestamp,
        type: trade.type,
        price: trade.price.toString(),
        confidence: trade.confidence
      })),
      timestamp: result.timestamp
    };
  }

  public addWebhook(config: WebhookConfig): void {
    this.configs.push(config);
  }

  public removeWebhook(url: string): void {
    this.configs = this.configs.filter(config => config.url !== url);
  }

  public updateWebhook(url: string, updates: Partial<WebhookConfig>): void {
    const index = this.configs.findIndex(config => config.url === url);
    if (index !== -1) {
      this.configs[index] = { ...this.configs[index], ...updates };
    }
  }

  public getWebhooks(): WebhookConfig[] {
    return this.configs;
  }
}