import { describe, it, expect } from 'vitest';
import { CrossVenueClockModel } from '../src/timing/CrossVenueClockModel.js';
import { createCexBookEvent, createDexSwapEvent } from '../src/cex/CexMarketEvent.js';

describe('Cross-Venue Timing & Clock Domains', () => {
  it('throws runtime error on cross-domain subtraction attempt', () => {
    expect(() => {
      CrossVenueClockModel.assertSameDomain('EXCHANGE_TIME', 'LOCAL_WALL_TIME');
    }).toThrow(/Invalid cross-domain subtraction/);

    expect(() => {
      CrossVenueClockModel.assertSameDomain('PROTOCOL_TIME', 'LOCAL_MONOTONIC_TIME');
    }).toThrow(/Invalid cross-domain subtraction/);
  });

  it('measures local monotonic durations without domain conflation', () => {
    const t0 = 1000.5;
    const t1 = 1250.8;
    const duration = CrossVenueClockModel.measureMonotonicDurationMs(t0, t1);
    expect(duration).toBeCloseTo(250.3, 1);

    expect(() => {
      CrossVenueClockModel.measureMonotonicDurationMs(t1, t0); // Non-monotonic
    }).toThrow(/Non-monotonic time detected/);
  });

  it('correctly labels exchange to local offset as EXCHANGE_TO_LOCAL_CLOCK_DELTA', () => {
    const exchangeMs = 1700000000000;
    const localWallMs = 1700000000150;
    const result = CrossVenueClockModel.calculateExchangeToLocalOffset(exchangeMs, localWallMs);
    expect(result.label).toBe('EXCHANGE_TO_LOCAL_CLOCK_DELTA');
    expect(result.offsetMs).toBe(150);
  });

  it('instantiates normalized MarketEvents with proper provenance and clock domains', () => {
    const cexEvent = createCexBookEvent({
      venue: 'binance',
      symbol: 'ETHUSDC',
      assetId: 'WETH-USDC-BASE',
      bid: 2500,
      ask: 2500.1,
      bidSize: 10,
      askSize: 12,
      exchangeTimestamp: 1700000000000,
      localReceiveMonotonic: 500.2,
      localReceiveWallClock: 1700000000025,
      sequence: 123456,
    });

    expect(cexEvent.source).toBe('cex');
    expect(cexEvent.eventType).toBe('CEX_BOOK_UPDATE');
    expect(cexEvent.eventTimestamp).toBe(1700000000000);
    expect(cexEvent.localReceiveMonotonic).toBe(500.2);

    const dexEvent = createDexSwapEvent({
      venue: 'uniswap_v3',
      chainId: 8453,
      symbol: 'WETH/USDC',
      assetId: 'WETH-USDC-BASE',
      blockNumber: 15000000,
      blockHash: '0xabc123',
      protocolTimestamp: 1700000000,
      localReceiveMonotonic: 515.4,
      localReceiveWallClock: 1700000000040,
    });

    expect(dexEvent.source).toBe('dex');
    expect(dexEvent.eventType).toBe('DEX_SWAP');
    expect(dexEvent.chainId).toBe(8453);
    expect(dexEvent.blockNumber).toBe(15000000);
  });
});
