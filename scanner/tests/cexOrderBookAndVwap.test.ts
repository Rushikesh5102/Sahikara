import { describe, it, expect } from 'vitest';
import { CexOrderBook } from '../src/cex/CexOrderBook.js';
import { CexVwapCalculator } from '../src/cex/CexVwapCalculator.js';
import { CexOrderBookSnapshot } from '../src/cex/ICexMarketDataSource.js';

describe('CEX Order Book & VWAP Calculator', () => {
  it('correctly sorts bids descending and asks ascending', () => {
    const book = new CexOrderBook('coinbase', 'ETH-USD');
    const snapshot: CexOrderBookSnapshot = {
      venue: 'coinbase',
      symbol: 'ETH-USD',
      bids: [
        { price: 2450.0, size: 2.0 },
        { price: 2455.0, size: 1.5 },
        { price: 2445.0, size: 5.0 },
      ],
      asks: [
        { price: 2465.0, size: 3.0 },
        { price: 2460.0, size: 1.0 },
        { price: 2470.0, size: 10.0 },
      ],
      exchangeTimestamp: 1700000000000,
      localReceiveMonotonic: 12345.67,
      localReceiveWallClock: 1700000000050,
      depthRequested: 20,
    };

    book.updateFromSnapshot(snapshot);

    const bestBid = book.getBestBid();
    const bestAsk = book.getBestAsk();
    expect(bestBid?.price).toBe(2455.0);
    expect(bestAsk?.price).toBe(2460.0);

    const spread = book.getSpread();
    expect(spread?.spreadUsd).toBe(5.0);
    expect(spread?.spreadBps).toBeCloseTo((5.0 / 2457.5) * 10000, 2);
  });

  it('calculates deterministic VWAP across asks when BUYING', () => {
    const book = new CexOrderBook('binance', 'ETHUSDC');
    book.updateFromSnapshot({
      venue: 'binance',
      symbol: 'ETHUSDC',
      bids: [{ price: 2500, size: 10 }],
      asks: [
        { price: 2500, size: 1.0 }, // $2,500 notional
        { price: 2510, size: 2.0 }, // $5,020 notional
        { price: 2520, size: 5.0 }, // $12,600 notional
      ],
      exchangeTimestamp: null,
      localReceiveMonotonic: 100,
      localReceiveWallClock: 100,
      depthRequested: 3,
    });

    // Buy $1,000 (partially fills first level at 2500)
    const buy1k = CexVwapCalculator.calculateVwapForNotional(book, 'BUY', 1000);
    expect(buy1k.status).toBe('FILLED');
    expect(buy1k.averagePrice).toBe(2500);
    expect(buy1k.levelsConsumed).toBe(1);
    expect(buy1k.priceImpactBps).toBe(0);

    // Buy $5,000 (consumes 1.0 ETH at 2500 = $2,500, plus 2500/2510 ETH at 2510)
    const buy5k = CexVwapCalculator.calculateVwapForNotional(book, 'BUY', 5000);
    expect(buy5k.status).toBe('FILLED');
    expect(buy5k.levelsConsumed).toBe(2);
    expect(buy5k.averagePrice).toBeGreaterThan(2500);
    expect(buy5k.averagePrice).toBeLessThan(2510);
    expect(buy5k.priceImpactBps).toBeGreaterThan(0);
  });

  it('calculates deterministic VWAP across bids when SELLING', () => {
    const book = new CexOrderBook('kraken', 'ETHUSDC');
    book.updateFromSnapshot({
      venue: 'kraken',
      symbol: 'ETHUSDC',
      bids: [
        { price: 2500, size: 1.0 }, // $2,500
        { price: 2490, size: 2.0 }, // $4,980
      ],
      asks: [{ price: 2510, size: 5 }],
      exchangeTimestamp: null,
      localReceiveMonotonic: 100,
      localReceiveWallClock: 100,
      depthRequested: 2,
    });

    // Sell $4,000 (consumes 1.0 at 2500 and $1,500 worth at 2490)
    const sell4k = CexVwapCalculator.calculateVwapForNotional(book, 'SELL', 4000);
    expect(sell4k.status).toBe('FILLED');
    expect(sell4k.levelsConsumed).toBe(2);
    expect(sell4k.averagePrice).toBeLessThan(2500);
    expect(sell4k.averagePrice).toBeGreaterThan(2490);
    expect(sell4k.priceImpactBps).toBeGreaterThan(0);
  });

  it('fails with INSUFFICIENT_DEPTH when requested size exceeds book depth', () => {
    const book = new CexOrderBook('binance', 'ETHUSDT');
    book.updateFromSnapshot({
      venue: 'binance',
      symbol: 'ETHUSDT',
      bids: [{ price: 2000, size: 0.1 }], // only $200 of depth
      asks: [{ price: 2001, size: 0.1 }],
      exchangeTimestamp: null,
      localReceiveMonotonic: 100,
      localReceiveWallClock: 100,
      depthRequested: 1,
    });

    const result = CexVwapCalculator.calculateVwapForNotional(book, 'SELL', 5000);
    expect(result.status).toBe('INSUFFICIENT_DEPTH');
    expect(result.filledNotionalUsd).toBeCloseTo(200, 1);
    expect(result.unfilledNotionalUsd).toBeCloseTo(4800, 1);
  });
});
