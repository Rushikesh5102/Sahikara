import { describe, it, expect } from 'vitest';
import { CexOrderBook } from '../src/cex/CexOrderBook.js';
import { MicrostructureMetrics } from '../src/cex/MicrostructureMetrics.js';
import { VolatilityRegimeClassifier } from '../src/crossvenue/VolatilityRegimeClassifier.js';
import { HighResolutionPersistence } from '../src/crossvenue/HighResolutionPersistence.js';
import { CexWebSocketFeed } from '../src/cex/CexWebSocketFeed.js';

describe('Phase 4.14 — Microstructure, Volatility & Persistence Test Suite', () => {
  it('correctly calculates order-book depth imbalance, spread, and slope', () => {
    const book = new CexOrderBook('coinbase', 'ETH-USD');
    book.updateFromSnapshot({
      venue: 'coinbase',
      symbol: 'ETH-USD',
      bids: [
        { price: 2470.0, size: 10.0 }, // $24,700
        { price: 2469.0, size: 20.0 }, // $49,380
      ],
      asks: [
        { price: 2471.0, size: 5.0 },  // $12,355
        { price: 2472.0, size: 10.0 }, // $24,720
      ],
      exchangeTimestamp: 1700000000000,
      localReceiveMonotonic: 1000,
      localReceiveWallClock: 1700000000050,
      depthRequested: 2,
    });

    const metrics = MicrostructureMetrics.evaluateBook(book, 2);
    expect(metrics).not.toBeNull();
    expect(metrics?.midPrice).toBe(2470.5);
    expect(metrics?.spreadUsd).toBe(1.0);
    expect(metrics?.spreadBps).toBeCloseTo((1.0 / 2470.5) * 10000, 2);

    // Bid depth = 24700 + 49380 = $74,080
    // Ask depth = 12355 + 24720 = $37,075
    // Total depth = $111,155
    // Imbalance = (74080 - 37075) / 111155 = +0.3329 (Bid-heavy buying pressure)
    expect(metrics?.bidDepthUsd).toBe(74080);
    expect(metrics?.askDepthUsd).toBe(37075);
    expect(metrics?.depthImbalance).toBeGreaterThan(0);
    expect(metrics?.depthImbalance).toBeLessThanOrEqual(1.0);
    expect(metrics?.depthImbalance).toBeCloseTo((74080 - 37075) / (74080 + 37075), 4);
  });

  it('correctly classifies volatility regimes based on price change rate and realized volatility', () => {
    const classifier = new VolatilityRegimeClassifier(10000);

    // Flat price sequence -> LOW volatility
    classifier.recordPrice(2500.0, 1000);
    classifier.recordPrice(2500.1, 2000);
    classifier.recordPrice(2500.05, 3000);
    classifier.recordPrice(2500.15, 4000);

    const lowMetrics = classifier.classifyCurrentRegime();
    expect(lowMetrics.regime).toBe('LOW');
    expect(lowMetrics.priceChangeRateBpsPerSec).toBeLessThanOrEqual(1.0);

    // High velocity swings -> HIGH volatility (> 7.0 bps/sec)
    const volatileClassifier = new VolatilityRegimeClassifier(5000);
    volatileClassifier.recordPrice(2500.0, 1000);
    volatileClassifier.recordPrice(2510.0, 2000); // +40 bps in 1 sec
    volatileClassifier.recordPrice(2495.0, 3000); // -60 bps in 1 sec
    volatileClassifier.recordPrice(2515.0, 4000); // +80 bps in 1 sec

    const highMetrics = volatileClassifier.classifyCurrentRegime();
    expect(highMetrics.regime).toBe('HIGH');
    expect(highMetrics.priceChangeRateBpsPerSec).toBeGreaterThan(7.0);
  });

  it('tracks sub-second opportunity emergence, persistence, and dissipation', () => {
    const tracker = new HighResolutionPersistence();

    // 1. Opportunity appears at T = 1000ms (+5.0 bps)
    tracker.recordObservation({
      pairId: 'WETH-USDC-BASE',
      direction: 'CEX_TO_DEX',
      grossEdgeBps: 5.0,
      monotonicMs: 1000,
    });

    let records = tracker.getAllRecords();
    expect(records.length).toBe(1);
    expect(records[0]!.isActive).toBe(true);
    expect(records[0]!.durationMs).toBe(0);
    expect(records[0]!.maxGrossEdgeBps).toBe(5.0);

    // 2. Persists at T = 1350ms (+7.5 bps)
    tracker.recordObservation({
      pairId: 'WETH-USDC-BASE',
      direction: 'CEX_TO_DEX',
      grossEdgeBps: 7.5,
      monotonicMs: 1350,
    });

    records = tracker.getAllRecords();
    expect(records[0]!.isActive).toBe(true);
    expect(records[0]!.durationMs).toBe(350);
    expect(records[0]!.maxGrossEdgeBps).toBe(7.5);
    expect(records[0]!.consecutivePositiveCount).toBe(2);

    // 3. Dissipates at T = 1800ms (-1.0 bps)
    tracker.recordObservation({
      pairId: 'WETH-USDC-BASE',
      direction: 'CEX_TO_DEX',
      grossEdgeBps: -1.0,
      monotonicMs: 1800,
    });

    records = tracker.getAllRecords();
    expect(records[0]!.isActive).toBe(false);
    expect(records[0]!.durationMs).toBe(800);
    expect(records[0]!.dissipationReason).toBe('SPREAD_COMPRESSION');

    const stats = tracker.getStats();
    expect(stats.completedCount).toBe(1);
    expect(stats.activeCount).toBe(0);
    expect(stats.maxDurationMs).toBe(800);
  });

  it('detects sequence gaps and handles invalidation on CEX WebSocket feeds', () => {
    const feed = new CexWebSocketFeed('binance', 'ETHUSDC');
    expect(feed.stats.connected).toBe(false);
    expect(feed.stats.invalidations).toBe(0);

    // Simulate sequence 100
    interface BinanceHandlerHolder {
      handleBinanceMessage: (payload: unknown, tMono: number, tWall: number) => void;
    }
    (feed as unknown as BinanceHandlerHolder).handleBinanceMessage({
      lastUpdateId: 100,
      bids: [['2470.0', '1.0']],
      asks: [['2471.0', '1.0']],
    }, 1000, Date.now());

    expect(feed.stats.orderBookUpdates).toBe(1);
    expect(feed.stats.lastSequenceNumber).toBe(100);

    // Simulate out-of-order sequence 95 -> sequence gap & invalidation
    (feed as unknown as BinanceHandlerHolder).handleBinanceMessage({
      lastUpdateId: 95,
      bids: [['2470.0', '1.0']],
      asks: [['2471.0', '1.0']],
    }, 1100, Date.now());

    expect(feed.stats.sequenceGaps).toBe(1);
    expect(feed.stats.invalidations).toBe(1);
  });
});
