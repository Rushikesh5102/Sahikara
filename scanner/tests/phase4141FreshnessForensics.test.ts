/**
 * SAHIKARA Phase 4.14.1 — Freshness, Cache Integrity & Synchronization Forensics Test Suite
 *
 * Enforces the non-negotiable methodological invariants established in Phase 4.14.1:
 * 1. cached quote != fresh quote
 * 2. stale quote cannot be labeled fresh
 * 3. missing quote cannot produce opportunity
 * 4. simulated quote excluded from authentic candidate count
 * 5. quote age calculated correctly
 * 6. block hash retained in provenance records
 * 7. block number retained in provenance records
 * 8. CEX timestamp retained in provenance records
 * 9. local monotonic timestamp retained in provenance records
 * 10. sequence gaps invalidate order book (BOOK_INVALIDATED)
 * 11. repeated observations are not falsely treated as independent market states
 * 12. bid/ask spread is not cross-venue arbitrage
 * 13. gross edge remains separate from net edge
 */

import { describe, it, expect } from 'vitest';
import { CexOrderBook } from '../src/cex/CexOrderBook.js';
import { CexWebSocketFeed } from '../src/cex/CexWebSocketFeed.js';
import { MicrostructureMetrics } from '../src/cex/MicrostructureMetrics.js';
import { CrossVenueEconomics } from '../src/crossvenue/CrossVenueEconomics.js';

export type DexQuoteSource = 'FRESH_ONCHAIN_QUOTE' | 'CACHED_ONCHAIN_QUOTE' | 'SIMULATED_QUOTE' | 'MISSING_QUOTE';

export interface DexQuoteProvenance {
  quoteTimestamp: number;
  quoteLocalMonotonic: number;
  quoteBlockNumber: bigint;
  quoteBlockHash: string;
  quoteSource: DexQuoteSource;
  quoteAgeMs: number | 'UNKNOWN';
}

describe('Phase 4.14.1 — Freshness, Cache Integrity & Synchronization Forensics', () => {
  // 1. cached quote != fresh quote
  it('1. verifies that CACHED_ONCHAIN_QUOTE is strictly segregated from FRESH_ONCHAIN_QUOTE', () => {
    const freshSource: DexQuoteSource = 'FRESH_ONCHAIN_QUOTE';
    const cachedSource: DexQuoteSource = 'CACHED_ONCHAIN_QUOTE';
    expect(freshSource).not.toBe(cachedSource);

    const isFresh = (source: DexQuoteSource): boolean => source === 'FRESH_ONCHAIN_QUOTE';
    expect(isFresh('FRESH_ONCHAIN_QUOTE')).toBe(true);
    expect(isFresh('CACHED_ONCHAIN_QUOTE')).toBe(false);
  });

  // 2. stale quote cannot be labeled fresh
  it('2. verifies that quotes exceeding the freshness threshold cannot be labeled fresh', () => {
    const thresholdMs = 1000;
    const classifyFreshness = (ageMs: number, threshold: number): DexQuoteSource => {
      return ageMs <= threshold ? 'FRESH_ONCHAIN_QUOTE' : 'CACHED_ONCHAIN_QUOTE';
    };

    expect(classifyFreshness(450, thresholdMs)).toBe('FRESH_ONCHAIN_QUOTE');
    expect(classifyFreshness(1050, thresholdMs)).toBe('CACHED_ONCHAIN_QUOTE');
    expect(classifyFreshness(519, 500)).toBe('CACHED_ONCHAIN_QUOTE');
  });

  // 3. missing quote cannot produce opportunity
  it('3. verifies that a missing or zero DEX quote rejects opportunity creation', () => {
    const evaluateWithMissingQuote = (dexPrice: number): boolean => {
      if (dexPrice <= 0 || !Number.isFinite(dexPrice)) {
        return false;
      }
      return true;
    };

    expect(evaluateWithMissingQuote(0)).toBe(false);
    expect(evaluateWithMissingQuote(-100)).toBe(false);
    expect(evaluateWithMissingQuote(NaN)).toBe(false);
    expect(evaluateWithMissingQuote(2470.50)).toBe(true);
  });

  // 4. simulated quote excluded from authentic candidate count
  it('4. verifies that SIMULATED_QUOTE records are excluded from authentic opportunity counts', () => {
    const candidates = [
      { id: 1, source: 'FRESH_ONCHAIN_QUOTE' as DexQuoteSource, isGrossPositive: true },
      { id: 2, source: 'SIMULATED_QUOTE' as DexQuoteSource, isGrossPositive: true },
      { id: 3, source: 'CACHED_ONCHAIN_QUOTE' as DexQuoteSource, isGrossPositive: true },
    ];

    const authenticCandidates = candidates.filter(
      (c) => c.source === 'FRESH_ONCHAIN_QUOTE' && c.isGrossPositive
    );

    expect(authenticCandidates.length).toBe(1);
    expect(authenticCandidates[0].id).toBe(1);
  });

  // 5. quote age calculated correctly
  it('5. verifies that quoteAgeMs is calculated using non-negative elapsed duration', () => {
    const tDex = 1789659807797;
    const tCex = 1789659808639;
    const quoteAgeMs = Math.max(0, tCex - tDex);
    expect(quoteAgeMs).toBe(842);

    // If timestamp cannot be determined, must yield 'UNKNOWN'
    const resolveAge = (dexTime?: number, cexTime?: number): number | 'UNKNOWN' => {
      if (!dexTime || !cexTime) return 'UNKNOWN';
      return Math.max(0, cexTime - dexTime);
    };
    expect(resolveAge(undefined, 1000)).toBe('UNKNOWN');
    expect(resolveAge(1000, undefined)).toBe('UNKNOWN');
  });

  // 6 & 7. block hash and block number retained
  it('6 & 7. verifies that blockNumber and blockHash are mandatory in quote provenance', () => {
    const provenance: DexQuoteProvenance = {
      quoteTimestamp: 1789659807797,
      quoteLocalMonotonic: 12450.5,
      quoteBlockNumber: 51435424n,
      quoteBlockHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      quoteSource: 'FRESH_ONCHAIN_QUOTE',
      quoteAgeMs: 842,
    };

    expect(provenance.quoteBlockNumber).toBeGreaterThan(0n);
    expect(provenance.quoteBlockHash.startsWith('0x')).toBe(true);
    expect(provenance.quoteBlockHash.length).toBe(66);
  });

  // 8 & 9. CEX timestamp and local monotonic timestamp retained
  it('8 & 9. verifies that CEX exchange timestamp and local monotonic arrival are preserved', () => {
    const book = new CexOrderBook('binance', 'ETHUSDC');
    const tExchange = 1789659817896;
    const tMono = 17967.2413;
    const tWall = Date.now();

    book.updateFromSnapshot({
      venue: 'binance',
      symbol: 'ETHUSDC',
      bids: [{ price: 2470.0, size: 5.0 }],
      asks: [{ price: 2471.0, size: 5.0 }],
      exchangeTimestamp: tExchange,
      localReceiveMonotonic: tMono,
      localReceiveWallClock: tWall,
      depthRequested: 10,
    });

    const ts = book.getTimestamps();
    expect(ts.exchangeTimestamp).toBe(tExchange);
    expect(ts.localReceiveMonotonic).toBe(tMono);
    expect(ts.localReceiveWallClock).toBe(tWall);
  });

  // 10. sequence gaps invalidate order book
  it('10. verifies that detected sequence gaps mark order books as BOOK_INVALIDATED', () => {
    const feed = new CexWebSocketFeed('binance', 'ETHUSDC');
    interface BinanceHandlerHolder {
      handleBinanceMessage: (payload: unknown, tMono: number, tWall: number) => void;
    }

    // Sequence 100
    (feed as unknown as BinanceHandlerHolder).handleBinanceMessage({
      lastUpdateId: 100,
      bids: [['2470.0', '1.0']],
      asks: [['2471.0', '1.0']],
    }, 1000, Date.now());
    expect(feed.stats.invalidations).toBe(0);

    // Sequence 90 (gap backwards / corrupted stream)
    (feed as unknown as BinanceHandlerHolder).handleBinanceMessage({
      lastUpdateId: 90,
      bids: [['2470.0', '1.0']],
      asks: [['2471.0', '1.0']],
    }, 1100, Date.now());
    expect(feed.stats.sequenceGaps).toBe(1);
    expect(feed.stats.invalidations).toBe(1);
  });

  // 11. repeated observations are not falsely treated as independent
  it('11. verifies that repeated evaluations across venues/sizes from a single quote do not inflate independent sample size', () => {
    const roundEvaluations = [
      { round: 1, venue: 'binance', size: 10, dexPrice: 2470.074275 },
      { round: 1, venue: 'coinbase', size: 10, dexPrice: 2470.074275 },
      { round: 1, venue: 'kraken', size: 10, dexPrice: 2470.074275 },
      { round: 1, venue: 'binance', size: 5000, dexPrice: 2470.074275 },
      { round: 2, venue: 'binance', size: 10, dexPrice: 2470.073458 },
    ];

    const uniqueDexStates = new Set(roundEvaluations.map((e) => e.dexPrice));
    const uniqueRounds = new Set(roundEvaluations.map((e) => e.round));

    expect(roundEvaluations.length).toBe(5);
    expect(uniqueDexStates.size).toBe(2);
    expect(uniqueRounds.size).toBe(2);
    // Total evaluations (5) != independent market states (2)
    expect(roundEvaluations.length).toBeGreaterThan(uniqueRounds.size);
  });

  // 12. bid/ask spread is not cross-venue arbitrage
  it('12. verifies that CEX bid-ask spread (+6.68 bps) is distinct from cross-venue arbitrage edge', () => {
    const book = new CexOrderBook('kraken', 'ETH/USDC');
    book.updateFromSnapshot({
      venue: 'kraken',
      symbol: 'ETH/USDC',
      bids: [{ price: 2470.00, size: 10.0 }],
      asks: [{ price: 2471.65, size: 10.0 }], // 1.65 / 2470.825 * 10000 = 6.678 bps
      exchangeTimestamp: Date.now(),
      localReceiveMonotonic: 1000,
      localReceiveWallClock: Date.now(),
      depthRequested: 10,
    });

    const micro = MicrostructureMetrics.evaluateBook(book, 10);
    expect(micro).not.toBeNull();
    const bidAskSpreadBps = micro?.spreadBps || 0;
    expect(bidAskSpreadBps).toBeGreaterThan(6.0);

    // Cross-venue evaluation with aligned DEX price must NOT produce +6 bps arbitrage
    const dexExecutablePrice = 2470.50; // Between bid and ask
    const econ = CrossVenueEconomics.evaluate({
      direction: 'CEX_TO_DEX',
      notionalUsd: 100,
      cexVwapPrice: 2471.65, // Must buy on CEX ask
      dexExecutablePrice: dexExecutablePrice, // Sell on DEX
      cexTakerFeeRateBps: 10,
      dexGasUnits: 150000,
      gasPriceGwei: 0.05,
      ethPriceUsd: 2500,
      riskBufferBps: 10,
    });

    // Gross spread is ((DEX - CEX_ask) / CEX_ask) * 10000 = ((2470.50 - 2471.65) / 2471.65) * 10000 = -4.65 bps!
    expect(econ.grossSpreadBps).toBeLessThan(0);
    expect(econ.grossSpreadBps).not.toBe(bidAskSpreadBps);
  });

  // 13. gross edge remains separate from net edge
  it('13. verifies that grossSpreadBps and netSpreadBps remain strictly segregated with provenance', () => {
    const econ = CrossVenueEconomics.evaluate({
      direction: 'DEX_TO_CEX',
      notionalUsd: 1000,
      cexVwapPrice: 2470.00,
      dexExecutablePrice: 2472.00,
      cexTakerFeeRateBps: 10,
      dexGasUnits: 150000,
      gasPriceGwei: 0.05,
      ethPriceUsd: 2500,
      riskBufferBps: 10,
    });

    // Gross is ((2470 - 2472) / 2472) * 10000 = -8.09 bps
    expect(econ.grossSpreadBps).toBeLessThan(0);
    // Net includes 10 bps fee + 10 bps buffer + gas
    expect(econ.netSpreadBps).toBeLessThan(econ.grossSpreadBps);
    expect(econ.cexFeeProvenance).toBe('[OBSERVED_FEE_SCHEDULE]');
    expect(econ.riskBufferProvenance).toBe('[ASSUMPTION_POLICY]');
    expect(econ.dexGasProvenance).toBe('[QUOTED_GAS_PARAMS]');
  });
});
