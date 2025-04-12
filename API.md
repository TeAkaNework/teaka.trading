# Teaka Quant Engine API Reference

## Strategy Development

### `StrategyService`

```typescript
interface StrategyConfig {
  name: string;
  parameters: Record<string, any>;
  code: string;
}

class StrategyService {
  evaluateStrategy(config: StrategyConfig, data: Bar[]): Promise<StrategyResult>
}
```

### `QuantEngine`

```typescript
interface FactorData {
  symbol: string;
  factors: Record<string, number>;
  returns: number[];
}

class QuantEngine {
  calculateFactorScores(data: FactorData[]): Promise<Record<string, number>>
  findPairs(prices: Map<string, number[]>): PairStrategy[]
  optimizePortfolio(returns: number[][]): PortfolioWeights
}
```

## Risk Management

### `RiskManager`

```typescript
interface RiskConfig {
  maxDrawdown: number;
  maxExposure: number;
  stopLoss: number;
}

class RiskManager {
  validateTrade(signal: Signal, account: AccountInfo): ValidationResult
  calculatePositionSize(signal: Signal, balance: number): number
}
```

## Logging

### `WebhookLogger`

```typescript
interface WebhookConfig {
  url: string;
  type: 'discord' | 'notion';
  enabled: boolean;
}

class WebhookLogger {
  logBacktestResult(result: BacktestResult): Promise<void>
  logTrade(trade: TradeLog): Promise<void>
}
```

## Event System

### Signal Events

- `onSignalGenerated`
- `onSignalValidated`
- `onSignalExecuted`
- `onSignalError`

### Portfolio Events

- `onPositionOpened`
- `onPositionClosed`
- `onPortfolioUpdate`