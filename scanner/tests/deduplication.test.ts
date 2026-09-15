/**
 * SAHIKARA — Granular Observation Identity & Deduplication Invariant Tests
 *
 * Mandated by Phase 1E Specification (Section 10):
 *   1. Same logical observation is deduplicated.
 *   2. Same pair on a different pool is NOT deduplicated.
 *   3. Same pool at a different block is NOT deduplicated.
 *   4. Different route is NOT deduplicated.
 *   5. Different trade size is NOT deduplicated.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ObservationStore } from '../src/storage/ObservationStore.js';
import type { RoundTripEvaluation } from '../src/economics/roundTripEvaluator.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import { unlinkSync, existsSync } from 'node:fs';

const TEST_DB_PATH = 'tests/test_dedup.db';

function makeToken(symbol: string, decimals: number, address: string): TokenDefinition {
  return {
    symbol,
    decimals,
    address: address as `0x${string}`,
    addressTier: '[FACT]',
  };
}

function makePool(id: string, dex: string, poolAddress: string): PoolDefinition {
  const weth = makeToken('WETH', 18, '0x4200000000000000000000000000000000000006');
  const usdc = makeToken('USDC', 6, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  return {
    id,
    chain: 'base',
    dex,
    protocol: 'uniswap-v3',
    poolAddress: poolAddress as `0x${string}`,
    token0: weth,
    token1: usdc,
    feeBps: 5,
    status: 'active',
    note: 'Test pool',
    tier: '[FACT]',
  };
}

function makeRtEval(overrides: Partial<RoundTripEvaluation> = {}): RoundTripEvaluation {
  const pool1 = makePool('pool-1', 'Uniswap v3', '0x1111111111111111111111111111111111111111');
  const pool2 = makePool('pool-2', 'Aerodrome', '0x2222222222222222222222222222222222222222');

  const weth = makeToken('WETH', 18, '0x4200000000000000000000000000000000000006');
  const usdc = makeToken('USDC', 6, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

  return {
    routeId: 'route-1',
    routeName: 'Uni -> Aero (WETH/USDC)',
    chain: 'base',
    blockNumber: 50000000n,
    timestamp: 1700000000000,
    leg1: {
      pool: pool1,
      dex: 'Uniswap v3',
      tokenIn: weth,
      tokenOut: usdc,
      amountIn: 1000000000000000n,
      amountOut: 3000000n,
      feeBps: 5,
      priceImpactBps: 0,
      latencyMs: 10,
      rawQuoteJson: '{}',
    },
    leg2: {
      pool: pool2,
      dex: 'Aerodrome',
      tokenIn: usdc,
      tokenOut: weth,
      amountIn: 3000000n,
      amountOut: 999000000000000n,
      feeBps: 30,
      priceImpactBps: 0,
      latencyMs: 10,
      rawQuoteJson: '{}',
    },
    initialAmount: 1000000000000000n,
    leg1Output: 3000000n,
    leg2Output: 999000000000000n,
    grossRoundTripDiff: -1000000000000n,
    baseToken: weth,
    intermediateToken: usdc,
    leg1FeeBps: 5,
    leg2FeeBps: 30,
    leg1FeeAmount: 50000000000n,
    leg2FeeAmount: 9000n,
    tradeSizeUsd: 1.0,
    grossProfitUsd: -0.003,
    grossSpreadBps: -10.0,
    poolFeesBps: 35,
    poolFeesUsd: 0.0035,
    gasEstimate: {
      gasUnits: 260000,
      gasPriceGwei: 0.001,
      ethPriceUsd: 3000,
      gasCostEth: 0.00026,
      gasCostUsd: 0.78,
      note: 'test',
    },
    gasCostUsd: 0.78,
    riskBufferUsd: 0.001,
    netExpectedProfitUsd: -0.784,
    netProfitBps: -7840,
    maxPriceImpactBps: 0,
    totalLatencyMs: 20,
    status: 'REJECTED',
    rejectionReason: 'SPREAD_TOO_SMALL',
    rejectionDetail: 'Spread too small',
    ...overrides,
  };
}

describe('ObservationStore Granular Deduplication', () => {
  let store: ObservationStore;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    store = new ObservationStore(TEST_DB_PATH);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  });

  it('1. Deduplicates identical logical observations (same pools, size, block)', () => {
    const obs1 = makeRtEval();
    const obs2 = makeRtEval({ timestamp: 1700000005000 }); // slight timestamp jitter

    store.insertRoundTrip(obs1);
    store.insertRoundTrip(obs2);

    const stats = store.getRoundTripStats();
    expect(stats.total).toBe(1);

    const audit = store.checkDuplicateIntegrity();
    expect(audit.roundTripDuplicates).toBe(0);
  });

  it('2. Does NOT deduplicate same token pair on different pool addresses', () => {
    const poolAlt = makePool('pool-alt', 'Uniswap v3', '0x9999999999999999999999999999999999999999');

    const obs1 = makeRtEval();
    const obs2 = makeRtEval({
      leg1: {
        ...obs1.leg1,
        pool: poolAlt,
      },
    });

    store.insertRoundTrip(obs1);
    store.insertRoundTrip(obs2);

    const stats = store.getRoundTripStats();
    expect(stats.total).toBe(2);
  });

  it('3. Does NOT deduplicate same pools at different blocks', () => {
    const obsBlock1 = makeRtEval({ blockNumber: 50000001n });
    const obsBlock2 = makeRtEval({ blockNumber: 50000002n });

    store.insertRoundTrip(obsBlock1);
    store.insertRoundTrip(obsBlock2);

    const stats = store.getRoundTripStats();
    expect(stats.total).toBe(2);
  });

  it('4. Does NOT deduplicate different routes (reverse direction)', () => {
    const pool1 = makePool('pool-1', 'Uniswap v3', '0x1111111111111111111111111111111111111111');
    const pool2 = makePool('pool-2', 'Aerodrome', '0x2222222222222222222222222222222222222222');

    const forward = makeRtEval();
    const reverse = makeRtEval({
      routeId: 'route-reverse',
      leg1: { ...forward.leg1, pool: pool2 },
      leg2: { ...forward.leg2, pool: pool1 },
    });

    store.insertRoundTrip(forward);
    store.insertRoundTrip(reverse);

    const stats = store.getRoundTripStats();
    expect(stats.total).toBe(2);
  });

  it('5. Does NOT deduplicate different trade sizes on the same pool and block', () => {
    const obsSize1 = makeRtEval({ tradeSizeUsd: 1.0, initialAmount: 1000n });
    const obsSize5 = makeRtEval({ tradeSizeUsd: 5.0, initialAmount: 5000n });

    store.insertRoundTrip(obsSize1);
    store.insertRoundTrip(obsSize5);

    const stats = store.getRoundTripStats();
    expect(stats.total).toBe(2);
  });
});
