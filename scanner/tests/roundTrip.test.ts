/**
 * SAHIKARA Observer — Cross-DEX Round-Trip Unit Tests
 *
 * Requirements per Phase 1C.2:
 *   - one-way quote ≠ arbitrage profit
 *   - two-leg round-trip calculation
 *   - fee calculation
 *   - gas deduction
 *   - net profit calculation
 *   - net profit BPS
 *   - negative-profit rejection
 *   - threshold rejection
 *   - route reversal
 *   - zero/invalid amounts
 *   - insufficient liquidity
 *   - price-impact rejection
 *
 * NO live RPC calls. NO wallets. NO real money. Deterministic unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRoundTrip,
  type RoundTripRouteDef,
} from '../src/economics/roundTripEvaluator.js';
import type { IPoolAdapter, PoolObservation } from '../src/adapters/IPoolAdapter.js';
import type { PoolDefinition, TokenDefinition, DexProtocol } from '../src/config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers & Mock Adapters
// ─────────────────────────────────────────────────────────────────────────────

function makeToken(symbol: string, decimals: number): TokenDefinition {
  return {
    symbol,
    address: `0x${symbol.toLowerCase().padStart(40, '0')}` as `0x${string}`,
    decimals,
    addressTier: '[FACT]',
  };
}

const WETH = makeToken('WETH', 18);
const USDC = makeToken('USDC', 6);

function makePool(dex: string, protocol: DexProtocol, feeBps: number): PoolDefinition {
  return {
    id: `${dex.toLowerCase()}-weth-usdc`,
    chain: 'base',
    dex,
    protocol,
    poolAddress: '0x1111111111111111111111111111111111111111',
    token0: WETH,
    token1: USDC,
    feeBps,
    status: 'active',
    note: 'Test pool',
    tier: '[FACT]',
  };
}

class MockAdapter implements IPoolAdapter {
  constructor(
    public readonly protocol: string,
    private readonly quoteFn: (
      pool: PoolDefinition,
      tokenInAddress: `0x${string}`,
      amountIn: bigint
    ) => { amountOut: bigint; feeBps: number; priceImpactBps: number; error?: string }
  ) {}

  supports(): boolean {
    return true;
  }

  async getQuote(
    pool: PoolDefinition,
    amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    return this.getDirectionalQuote(pool, pool.token0.address, amountInUsd, amountIn, blockNumber);
  }

  async getDirectionalQuote(
    pool: PoolDefinition,
    tokenInAddress: `0x${string}`,
    _amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    const res = this.quoteFn(pool, tokenInAddress, amountIn);
    if (res.error) {
      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: JSON.stringify({ error: res.error }),
        quote: null,
        error: res.error,
        rpcLatencyMs: 25,
      };
    }
    return {
      pool,
      blockNumber,
      timestamp: Date.now(),
      rawQuoteJson: JSON.stringify({
        amountOut: res.amountOut.toString(),
        feeBps: res.feeBps,
        priceImpactBps: res.priceImpactBps,
      }),
      quote: {
        amountIn,
        amountOut: res.amountOut,
        tokenInSymbol: tokenInAddress === WETH.address ? 'WETH' : 'USDC',
        tokenOutSymbol: tokenInAddress === WETH.address ? 'USDC' : 'WETH',
        feeBps: res.feeBps,
        priceImpactBps: res.priceImpactBps,
        quoteLatencyMs: 25,
      },
      error: null,
      rpcLatencyMs: 25,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-DEX Round-Trip Evaluation', () => {
  const uniPool = makePool('Uniswap v3', 'uniswap-v3', 5);
  const aeroPool = makePool('Aerodrome', 'aerodrome-volatile', 30);

  // 1 ETH = $2500, so $1 is 0.0004 ETH = 400,000,000,000,000 wei
  const initialAmount = 400_000_000_000_000n; // $1.00 of WETH
  const tradeSizeUsd = 1.0;
  const blockNumber = 100000n;
  const gasPriceWei = 10_000_000n; // 0.01 gwei
  const ethPriceUsd = 2500;
  const baseTokenPriceUsd = 2500;
  const intermediateTokenPriceUsd = 1.0;

  it('proves that a one-way quote ≠ arbitrage profit', () => {
    // If we only convert WETH -> USDC, we have 1.005 USDC.
    // That is NOT arbitrage profit because we hold a different asset and have not closed the loop!
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_005_000n, // $1.005 USDC
      feeBps: 5,
      priceImpactBps: 1,
    }));
    // On the return leg, exchange rate or fees make us end with LESS WETH
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 395_000_000_000_000n, // 0.000395 WETH (loss!)
      feeBps: 30,
      priceImpactBps: 2,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-route',
      name: 'Test Uni -> Aero',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    return evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
    }).then((result) => {
      // Despite leg 1 output being $1.005, round-trip gross output is negative!
      expect(result.grossRoundTripDiff).toBeLessThan(0n);
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('SPREAD_TOO_SMALL');
    });
  });

  it('calculates two-leg round trip and fees correctly', async () => {
    // Leg 1: 400k wei WETH -> 1.00 USDC (fee 5 bps)
    // Leg 2: 1.00 USDC -> 402k wei WETH (fee 30 bps)
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_000_000n,
      feeBps: 5,
      priceImpactBps: 0.5,
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 402_000_000_000_000n, // +2000 wei gross profit
      feeBps: 30,
      priceImpactBps: 1.0,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-route-2',
      name: 'Test Round Trip',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      minNetProfitUsd: 0.001, // very low threshold for testing
    });

    expect(result.leg1Output).toBe(1_000_000n);
    expect(result.leg2Output).toBe(402_000_000_000_000n);
    expect(result.grossRoundTripDiff).toBe(2_000_000_000_000n);
    expect(result.poolFeesBps).toBe(35); // 5 + 30
    expect(result.grossSpreadBps).toBeCloseTo(50, 1); // 2000/400000 = 0.5% = 50 bps
  });

  it('deducts 2-hop gas cost and rejects if gas exceeds profit', async () => {
    // Gross gain is $0.002, but 2-hop gas is ~260,000 units * 1 gwei * $2500 = $0.00065
    // Set gasPriceWei high so gas exceeds gross gain
    const highGasPriceWei = 10_000_000_000n; // 10 gwei -> gas cost $0.065
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_000_000n,
      feeBps: 5,
      priceImpactBps: 0.1,
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 402_000_000_000_000n, // gross gain $0.005
      feeBps: 30,
      priceImpactBps: 0.1,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-gas',
      name: 'Gas deduction test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei: highGasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      minNetProfitUsd: 0.0001,
    });

    expect(result.gasCostUsd).toBeGreaterThan(result.grossProfitUsd);
    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('GAS_EXCEEDS_PROFIT');
  });

  it('rejects if net profit is below configured threshold', async () => {
    // Gross gain is positive ($0.01), gas is low ($0.00065), but min threshold is $0.05
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_010_000n,
      feeBps: 5,
      priceImpactBps: 0.1,
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 404_000_000_000_000n, // $0.01 gain
      feeBps: 30,
      priceImpactBps: 0.1,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-threshold',
      name: 'Threshold test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      minNetProfitUsd: 0.05, // $0.05 threshold
    });

    expect(result.netExpectedProfitUsd).toBeLessThan(0.05);
    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('SPREAD_TOO_SMALL');
  });

  it('supports route reversal (Route B: Aero -> UniV3)', async () => {
    // Route B: WETH -> Aero -> USDC -> UniV3 -> WETH
    const aeroAdapter = new MockAdapter('aerodrome-volatile', (_pool, tokenIn) => {
      expect(tokenIn).toBe(WETH.address);
      return { amountOut: 1_000_000n, feeBps: 30, priceImpactBps: 0.2 };
    });
    const uniAdapter = new MockAdapter('uniswap-v3', (_pool, tokenIn) => {
      expect(tokenIn).toBe(USDC.address);
      return { amountOut: 399_000_000_000_000n, feeBps: 5, priceImpactBps: 0.1 };
    });

    const routeB: RoundTripRouteDef = {
      id: 'route-b',
      name: 'Route B Reversal',
      chain: 'base',
      leg1: { pool: aeroPool, adapter: aeroAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: uniPool, adapter: uniAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route: routeB,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
    });

    expect(result.leg1.dex).toBe('Aerodrome');
    expect(result.leg2.dex).toBe('Uniswap v3');
    expect(result.grossRoundTripDiff).toBe(-1_000_000_000_000n);
    expect(result.status).toBe('REJECTED');
  });

  it('rejects on zero or negative initial amount', async () => {
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({ amountOut: 0n, feeBps: 5, priceImpactBps: 0 }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({ amountOut: 0n, feeBps: 30, priceImpactBps: 0 }));

    const route: RoundTripRouteDef = {
      id: 'test-zero',
      name: 'Zero amount test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    await expect(
      evaluateRoundTrip({
        route,
        initialAmount: 0n,
        tradeSizeUsd,
        blockNumber,
        gasPriceWei,
        ethPriceUsd,
        baseTokenPriceUsd,
        intermediateTokenPriceUsd,
      })
    ).rejects.toThrow();
  });

  it('rejects when price impact exceeds safety threshold', async () => {
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_050_000n,
      feeBps: 5,
      priceImpactBps: 150, // 1.5% price impact (> 1.0% limit)
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 420_000_000_000_000n,
      feeBps: 30,
      priceImpactBps: 10,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-impact',
      name: 'Price impact test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      maxPriceImpactBps: 100, // 1.0% limit
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('SPREAD_TOO_SMALL');
    expect(result.rejectionDetail).toContain('Price impact');
  });

  it('identifies genuine candidate when all constraints pass', async () => {
    // Large spread: 400k wei WETH -> 1.10 USDC -> 440k wei WETH (+10% spread)
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_100_000n,
      feeBps: 5,
      priceImpactBps: 2,
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 440_000_000_000_000n, // +$0.10 gross
      feeBps: 30,
      priceImpactBps: 2,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-candidate',
      name: 'Candidate test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      minNetProfitUsd: 0.05,
    });

    expect(result.status).toBe('CANDIDATE');
    expect(result.rejectionReason).toBeNull();
    expect(result.netExpectedProfitUsd).toBeGreaterThan(0.05);
  });

  it('proves fee costs are NOT double-counted: net profit equals gross profit minus gas minus risk buffer', async () => {
    // Leg 1: 400k wei WETH -> 1.05 USDC (feeBps: 5)
    // Leg 2: 1.05 USDC -> 420k wei WETH (feeBps: 30)
    // Both quote outputs ALREADY incorporate pool fees.
    const uniAdapter = new MockAdapter('uniswap-v3', () => ({
      amountOut: 1_050_000n,
      feeBps: 5,
      priceImpactBps: 1,
    }));
    const aeroAdapter = new MockAdapter('aerodrome-volatile', () => ({
      amountOut: 420_000_000_000_000n, // gross diff = +20k wei WETH = +$0.05
      feeBps: 30,
      priceImpactBps: 1,
    }));

    const route: RoundTripRouteDef = {
      id: 'test-no-double-count',
      name: 'No Double Count Test',
      chain: 'base',
      leg1: { pool: uniPool, adapter: uniAdapter, tokenIn: WETH, tokenOut: USDC },
      leg2: { pool: aeroPool, adapter: aeroAdapter, tokenIn: USDC, tokenOut: WETH },
    };

    const result = await evaluateRoundTrip({
      route,
      initialAmount,
      tradeSizeUsd,
      blockNumber,
      gasPriceWei,
      ethPriceUsd,
      baseTokenPriceUsd,
      intermediateTokenPriceUsd,
      riskBufferFraction: 0.001, // 0.1% buffer = $0.001
    });

    // 1. Fee metadata is tracked separately for observability:
    expect(result.leg1FeeBps).toBe(5);
    expect(result.leg2FeeBps).toBe(30);
    expect(result.leg1FeeAmount).toBe((initialAmount * 5n) / 10000n);
    expect(result.leg2FeeAmount).toBe((1_050_000n * 30n) / 10000n);

    // 2. Gross PnL is computed directly from executable quote outputs:
    // finalAmount (420k wei) - initialAmount (400k wei) = 20k wei WETH
    const expectedGrossDiff = 420_000_000_000_000n - initialAmount;
    expect(result.grossRoundTripDiff).toBe(expectedGrossDiff);

    // 3. Mathematical proof that pool fees are NOT subtracted again:
    // netExpectedProfit = grossProfitUsd - gasCostUsd - riskBufferUsd
    const expectedNetProfit = result.grossProfitUsd - result.gasCostUsd - (tradeSizeUsd * 0.001);
    expect(result.netExpectedProfitUsd).toBeCloseTo(expectedNetProfit, 8);

    // 4. Ensure poolFeesUsd was NOT deducted from netExpectedProfitUsd:
    expect(result.netExpectedProfitUsd).not.toBeCloseTo(expectedNetProfit - result.poolFeesUsd, 4);
  });
});
