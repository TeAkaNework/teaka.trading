import { Decimal } from 'decimal.js';
import * as stats from 'simple-statistics';
import { Signal } from './algorithmService';
import { WebhookLogger } from './webhookLogger';
import { FirebaseLogger } from './firebaseLogger';

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry: Decimal;
  exit: Decimal;
  volume: Decimal;
  entryTime: string;
  exitTime: string;
  pnl: Decimal;
  commission: Decimal;
  slippage: Decimal;
  holdingPeriod: number;
  strategy: string;
  signals: Signal[];
  metadata: Record<string, any>;
}

interface BacktestConfig {
  initialBalance: number;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  strategy: string;
  riskPerTrade: number;
  maxDrawdown: number;
  maxExposure: number;
  commission: number;
  slippage: number;
  parameters: Record<string, any>;
}

interface BacktestResult {
  trades: Trade[];
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    pnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    averageHoldingPeriod: number;
    exposure: number;
    commissions: number;
    slippage: number;
    equity: number[];
    drawdown: number[];
    monthlyReturns: Record<string, number>;
  };
  positions: Position[];
  equity: EquityPoint[];
}

interface Position {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: Decimal;
  entry: Decimal;
  current: Decimal;
  unrealizedPnl: Decimal;
  openTime: string;
}

interface EquityPoint {
  timestamp: string;
  equity: Decimal;
  drawdown: Decimal;
  highWaterMark: Decimal;
}

export class BacktestEngine {
  private config: BacktestConfig;
  private data: Bar[] = [];
  private trades: Trade[] = [];
  private positions: Position[] = [];
  private equity: EquityPoint[] = [];
  private balance: Decimal;
  private highWaterMark: Decimal;
  private webhookLogger: WebhookLogger;
  private firebaseLogger: FirebaseLogger;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.balance = new Decimal(config.initialBalance);
    this.highWaterMark = this.balance;
    this.webhookLogger = new WebhookLogger();
    this.firebaseLogger = new FirebaseLogger();
  }

  public async loadData(data: Bar[]): Promise<void> {
    this.data = data.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    console.log(`Loaded ${this.data.length} bars for ${this.config.symbol}`);
  }

  public async run(): Promise<BacktestResult> {
    try {
      console.log('Starting backtest...', {
        symbol: this.config.symbol,
        strategy: this.config.strategy,
        period: `${this.config.startDate} to ${this.config.endDate}`
      });

      for (let i = 1; i < this.data.length; i++) {
        const bar = this.data[i];
        const prevBar = this.data[i - 1];
        
        // Update positions with current prices
        this.updatePositions(bar);
        
        // Generate signals
        const signal = this.evaluateBar(bar, prevBar);
        if (signal) {
          await this.executeTrade(signal, bar);
        }

        // Update equity curve
        this.updateEquity(bar);
      }

      // Close any remaining positions
      const lastBar = this.data[this.data.length - 1];
      await this.closeAllPositions(lastBar);

      // Calculate final metrics
      const metrics = this.calculateMetrics();

      // Log results
      await this.logResults({
        trades: this.trades,
        metrics,
        positions: this.positions,
        equity: this.equity
      });

      return {
        trades: this.trades,
        metrics,
        positions: this.positions,
        equity: this.equity
      };

    } catch (error) {
      console.error('Backtest error:', error);
      throw error;
    }
  }

  private evaluateBar(bar: Bar, prevBar: Bar): Signal | null {
    // Implement strategy logic based on config.strategy
    // This is a simple example - replace with your strategy logic
    const close = new Decimal(bar.close);
    const prevClose = new Decimal(prevBar.close);
    
    if (close.greaterThan(prevClose.times(1.02))) {
      return {
        type: 'BUY',
        price: close,
        timestamp: new Date(bar.timestamp).getTime(),
        confidence: 0.8,
        strategy: this.config.strategy,
        metadata: {
          bar,
          prevBar
        }
      };
    }
    
    return null;
  }

  private async executeTrade(signal: Signal, bar: Bar): Promise<void> {
    const volume = this.calculatePositionSize(signal);
    const slippage = this.calculateSlippage(signal.type, bar);
    const commission = this.calculateCommission(volume, bar.close);

    const trade: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: this.config.symbol,
      type: signal.type,
      entry: signal.price.plus(slippage),
      exit: new Decimal(0),
      volume,
      entryTime: bar.timestamp,
      exitTime: '',
      pnl: new Decimal(0),
      commission,
      slippage: new Decimal(slippage),
      holdingPeriod: 0,
      strategy: signal.strategy,
      signals: [signal],
      metadata: signal.metadata
    };

    // Add position
    this.positions.push({
      symbol: trade.symbol,
      type: trade.type,
      volume: trade.volume,
      entry: trade.entry,
      current: trade.entry,
      unrealizedPnl: new Decimal(0),
      openTime: trade.entryTime
    });

    // Update balance
    this.balance = this.balance
      .minus(commission)
      .minus(slippage);

    this.trades.push(trade);
  }

  private calculatePositionSize(signal: Signal): Decimal {
    const riskAmount = this.balance.times(this.config.riskPerTrade);
    const price = signal.price;
    const atr = this.calculateATR(20); // Use ATR for position sizing
    
    return riskAmount.dividedBy(atr.times(2)); // Risk 2 ATR per trade
  }

  private calculateATR(period: number): Decimal {
    const ranges: Decimal[] = [];
    for (let i = 1; i < period; i++) {
      const bar = this.data[this.data.length - i];
      const prevBar = this.data[this.data.length - i - 1];
      
      const tr = Decimal.max(
        new Decimal(bar.high).minus(bar.low),
        new Decimal(bar.high).minus(prevBar.close).abs(),
        new Decimal(bar.low).minus(prevBar.close).abs()
      );
      
      ranges.push(tr);
    }
    
    return ranges.reduce((sum, range) => sum.plus(range), new Decimal(0))
      .dividedBy(period);
  }

  private calculateSlippage(type: 'BUY' | 'SELL', bar: Bar): number {
    const price = new Decimal(bar.close);
    return price.times(this.config.slippage).toNumber();
  }

  private calculateCommission(volume: Decimal, price: number): Decimal {
    return volume.times(price).times(this.config.commission);
  }

  private updatePositions(bar: Bar): void {
    this.positions.forEach(position => {
      position.current = new Decimal(bar.close);
      position.unrealizedPnl = this.calculatePnL(position);
    });
  }

  private calculatePnL(position: Position): Decimal {
    const diff = position.current.minus(position.entry);
    return position.type === 'BUY' 
      ? diff.times(position.volume)
      : diff.negated().times(position.volume);
  }

  private updateEquity(bar: Bar): void {
    const equity = this.getEquity();
    
    if (equity.greaterThan(this.highWaterMark)) {
      this.highWaterMark = equity;
    }

    const drawdown = this.highWaterMark.minus(equity)
      .dividedBy(this.highWaterMark);

    this.equity.push({
      timestamp: bar.timestamp,
      equity,
      drawdown,
      highWaterMark: this.highWaterMark
    });
  }

  private getEquity(): Decimal {
    const unrealizedPnl = this.positions.reduce(
      (sum, pos) => sum.plus(pos.unrealizedPnl),
      new Decimal(0)
    );
    return this.balance.plus(unrealizedPnl);
  }

  private async closeAllPositions(bar: Bar): Promise<void> {
    for (const position of this.positions) {
      const trade = this.trades.find(t => 
        t.symbol === position.symbol && !t.exitTime
      );

      if (trade) {
        const slippage = this.calculateSlippage(
          position.type === 'BUY' ? 'SELL' : 'BUY',
          bar
        );
        const commission = this.calculateCommission(
          position.volume,
          bar.close
        );

        trade.exit = new Decimal(bar.close).minus(slippage);
        trade.exitTime = bar.timestamp;
        trade.pnl = position.unrealizedPnl
          .minus(commission)
          .minus(slippage);
        trade.commission = trade.commission.plus(commission);
        trade.slippage = trade.slippage.plus(slippage);
        trade.holdingPeriod = Math.floor(
          (new Date(trade.exitTime).getTime() - 
           new Date(trade.entryTime).getTime()) / 
          (1000 * 60 * 60 * 24)
        );

        this.balance = this.balance
          .plus(trade.pnl)
          .minus(commission)
          .minus(slippage);
      }
    }

    this.positions = [];
  }

  private calculateMetrics(): BacktestResult['metrics'] {
    const closedTrades = this.trades.filter(t => t.exitTime);
    const winningTrades = closedTrades.filter(t => t.pnl.greaterThan(0));
    const losingTrades = closedTrades.filter(t => t.pnl.lessThanOrEqualTo(0));

    const totalPnL = closedTrades.reduce(
      (sum, trade) => sum.plus(trade.pnl),
      new Decimal(0)
    );

    const maxDrawdown = this.equity.reduce(
      (max, point) => Decimal.max(max, point.drawdown),
      new Decimal(0)
    );

    const returns = this.calculateReturns();
    const monthlyReturns = this.calculateMonthlyReturns();

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winningTrades.length / closedTrades.length * 100,
      pnl: totalPnL.toNumber(),
      maxDrawdown: maxDrawdown.toNumber(),
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
      averageWin: this.calculateAverageReturn(winningTrades),
      averageLoss: this.calculateAverageReturn(losingTrades),
      largestWin: this.calculateLargestReturn(winningTrades),
      largestLoss: this.calculateLargestReturn(losingTrades),
      averageHoldingPeriod: this.calculateAverageHoldingPeriod(closedTrades),
      exposure: this.calculateAverageExposure(),
      commissions: closedTrades.reduce(
        (sum, trade) => sum + trade.commission.toNumber(),
        0
      ),
      slippage: closedTrades.reduce(
        (sum, trade) => sum + trade.slippage.toNumber(),
        0
      ),
      equity: this.equity.map(e => e.equity.toNumber()),
      drawdown: this.equity.map(e => e.drawdown.toNumber()),
      monthlyReturns
    };
  }

  private calculateReturns(): number[] {
    return this.equity.slice(1).map((point, i) => 
      point.equity
        .minus(this.equity[i].equity)
        .dividedBy(this.equity[i].equity)
        .toNumber()
    );
  }

  private calculateSharpeRatio(returns: number[]): number {
    const mean = stats.mean(returns);
    const stdDev = stats.standardDeviation(returns);
    return mean / stdDev * Math.sqrt(252);
  }

  private calculateSortinoRatio(returns: number[]): number {
    const mean = stats.mean(returns);
    const negativeReturns = returns.filter(r => r < 0);
    const downside = Math.sqrt(
      stats.mean(negativeReturns.map(r => Math.pow(r - mean, 2)))
    );
    return mean / downside * Math.sqrt(252);
  }

  private calculateProfitFactor(
    winningTrades: Trade[],
    losingTrades: Trade[]
  ): number {
    const grossProfit = winningTrades.reduce(
      (sum, trade) => sum.plus(trade.pnl),
      new Decimal(0)
    );
    const grossLoss = losingTrades.reduce(
      (sum, trade) => sum.plus(trade.pnl.abs()),
      new Decimal(0)
    );
    return grossLoss.isZero()
      ? 0
      : grossProfit.dividedBy(grossLoss).toNumber();
  }

  private calculateAverageReturn(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce(
      (sum, trade) => sum.plus(trade.pnl),
      new Decimal(0)
    ).dividedBy(trades.length).toNumber();
  }

  private calculateLargestReturn(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce(
      (max, trade) => Decimal.max(max, trade.pnl.abs()),
      new Decimal(0)
    ).toNumber();
  }

  private calculateAverageHoldingPeriod(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce(
      (sum, trade) => sum + trade.holdingPeriod,
      0
    ) / trades.length;
  }

  private calculateAverageExposure(): number {
    const totalDays = this.equity.length;
    const daysWithPositions = this.equity.filter(
      point => point.equity.greaterThan(this.config.initialBalance)
    ).length;
    return daysWithPositions / totalDays * 100;
  }

  private calculateMonthlyReturns(): Record<string, number> {
    const monthlyReturns: Record<string, number> = {};
    
    this.equity.forEach((point, i) => {
      if (i === 0) return;
      
      const month = point.timestamp.substring(0, 7); // YYYY-MM
      const prevEquity = this.equity[i - 1].equity;
      const return_ = point.equity
        .minus(prevEquity)
        .dividedBy(prevEquity)
        .toNumber();
      
      if (monthlyReturns[month]) {
        monthlyReturns[month] += return_;
      } else {
        monthlyReturns[month] = return_;
      }
    });
    
    return monthlyReturns;
  }

  private async logResults(results: BacktestResult): Promise<void> {
    // Log to Discord webhook
    await this.webhookLogger.logBacktestResult({
      strategy: this.config.strategy,
      pnl: results.metrics.pnl,
      trades: this.trades.length,
      metrics: results.metrics,
      timestamp: new Date().toISOString()
    });

    // Log to Firebase
    await this.firebaseLogger.logBacktest({
      strategy: this.config.strategy,
      parameters: this.config.parameters,
      results: {
        pnl: results.metrics.pnl,
        winRate: results.metrics.winRate,
        sharpeRatio: results.metrics.sharpeRatio,
        maxDrawdown: results.metrics.maxDrawdown,
        trades: results.metrics.totalTrades,
        startTime: new Date(this.config.startDate),
        endTime: new Date(this.config.endDate)
      },
      signals: this.trades.map(t => t.signals).flat(),
      timestamp: new Date()
    });
  }
}