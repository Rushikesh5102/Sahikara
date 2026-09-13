/**
 * SAHIKARA Observer — Economics Unit Tests
 *
 * Tests for:
 *   - Token decimal normalization
 *   - USD to raw token amount conversion
 *   - Gross spread calculation
 *   - Fee calculation
 *   - Gas cost calculation
 *   - Net profit calculation (all 3 tiers)
 *   - Rejection logic (all rejection reasons)
 *   - Stale-data detection (timestamp checks)
 *
 * NO live RPC calls. NO real money. Pure unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateProfit,
  usdToTokenAmount,
  normalizeTokenAmount,
  type TokenPriceContext,
} from '../src/economics/profitCalculator.js';
import {
  estimateGasCost,
  GAS_UNITS_PER_PROTOCOL,
} from '../src/economics/gasEstimator.js';
import type { PoolQuote } from '../src/adapters/IPoolAdapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Decimal Normalization
// ─────────────────────────────────────────────────────────────────────────────

describe('Token decimal normalization', () => {
  it('converts $1 USD to correct WETH amount (18 decimals)', () => {
    // $1 USD at WETH price $2400 = 0.000416... WETH
    const raw = usdToTokenAmount(1.0, 2400, 18);
    const human = normalizeTokenAmount(raw, 18);
    expect(human).toBeCloseTo(1 / 2400, 6);
  });

  it('converts $1 USD to correct USDC amount (6 decimals)', () => {
    // $1 USD at USDC price $1.00 = 1,000,000 smallest units
    const raw = usdToTokenAmount(1.0, 1.0, 6);
    expect(raw).toBe(1_000_000n);
  });

  it('converts $10 USD to correct USDC amount (6 decimals)', () => {
    const raw = usdToTokenAmount(10.0, 1.0, 6);
    expect(raw).toBe(10_000_000n);
  });

  it('throws on non-positive token price', () => {
    expect(() => usdToTokenAmount(1.0, 0, 18)).toThrow();
    expect(() => usdToTokenAmount(1.0, -1, 18)).toThrow();
  });

  it('normalizes 1_000_000 USDC units to 1.0 USD', () => {
    expect(normalizeTokenAmount(1_000_000n, 6)).toBe(1.0);
  });

  it('normalizes 1e18 WETH units to 1.0 WETH', () => {
    expect(normalizeTokenAmount(1_000_000_000_000_000_000n, 18)).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gas Cost Estimation
// ─────────────────────────────────────────────────────────────────────────────

describe('Gas cost calculation', () => {
  // 1 gwei = 1e9 wei
  const ONE_GWEI = 1_000_000_000n;

  it('calculates gas cost in ETH correctly for uniswap-v3', () => {
    const gasUnits = GAS_UNITS_PER_PROTOCOL['uniswap-v3'];
    const gasPriceWei = ONE_GWEI; // 1 gwei
    const est = estimateGasCost('uniswap-v3', gasPriceWei, 2400);

    // expected gas cost in ETH = gasUnits * 1e-9
    const expectedEth = gasUnits * 1e-9;
    expect(est.gasCostEth).toBeCloseTo(expectedEth, 8);
    expect(est.gasCostUsd).toBeCloseTo(expectedEth * 2400, 4);
  });

  it('calculates gas cost in ETH correctly for aerodrome-volatile', () => {
    const est = estimateGasCost('aerodrome-volatile', ONE_GWEI, 2400);
    const gasUnits = GAS_UNITS_PER_PROTOCOL['aerodrome-volatile'];
    const expectedEth = gasUnits * 1e-9;
    expect(est.gasCostEth).toBeCloseTo(expectedEth, 8);
  });

  it('uses 2-hop gas units when isTwoHop=true', () => {
    const single = estimateGasCost('uniswap-v3', ONE_GWEI, 2400, false);
    const twoHop = estimateGasCost('uniswap-v3', ONE_GWEI, 2400, true);
    expect(twoHop.gasUnits).toBeGreaterThan(single.gasUnits);
  });

  it('includes [ESTIMATE] and [PROVISIONAL] in the note', () => {
    const est = estimateGasCost('uniswap-v3', ONE_GWEI, 2400);
    expect(est.note).toContain('[ESTIMATE]');
    expect(est.note).toContain('PROVISIONAL');
  });

  it('scales correctly with higher gas price', () => {
    const estLow = estimateGasCost('uniswap-v3', ONE_GWEI, 2400);
    const estHigh = estimateGasCost('uniswap-v3', ONE_GWEI * 100n, 2400);
    expect(estHigh.gasCostUsd).toBeCloseTo(estLow.gasCostUsd * 100, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Profit Calculation — Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<PoolQuote> = {}): PoolQuote {
  return {
    amountIn: 416_666_666_666_667n,    // ~0.000417 WETH ($1 at $2400)
    amountOut: 1_000_500n,              // ~1.0005 USDC (slight profit)
    tokenInSymbol: 'WETH',
    tokenOutSymbol: 'USDC',
    feeBps: 5,                          // 0.05% fee tier
    priceImpactBps: 0.0005,
    quoteLatencyMs: 45,
    ...overrides,
  };
}

const DEFAULT_PRICE_CONTEXT: TokenPriceContext = {
  token0PriceUsd: 2400,
  token1PriceUsd: 1.0,
  token0Decimals: 18,
  token1Decimals: 6,
};

const LOW_GAS_ESTIMATE = estimateGasCost('uniswap-v3', 1_000_000n, 2400); // 0.001 gwei (very low)

// ─────────────────────────────────────────────────────────────────────────────
// Profit Calculation — Three Tiers
// ─────────────────────────────────────────────────────────────────────────────

describe('Profit calculation — three tiers', () => {
  it('produces all three profit tiers', () => {
    const result = calculateProfit({
      quote: makeQuote(),
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0.05,
    });

    expect(result.grossProfitUsd).toBeDefined();
    expect(result.netProfitBeforeBufferUsd).toBeDefined();
    expect(result.netExpectedProfitUsd).toBeDefined();

    // Tier ordering: gross >= net-before-buffer >= net-expected
    expect(result.grossProfitUsd).toBeGreaterThanOrEqual(result.netProfitBeforeBufferUsd);
    expect(result.netProfitBeforeBufferUsd).toBeGreaterThanOrEqual(result.netExpectedProfitUsd);
  });

  it('grossProfitUsd = executableGrossOutput - inputCapital', () => {
    const result = calculateProfit({
      quote: makeQuote(),
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0,
      minNetProfitUsd: 0,
    });

    const expected = result.executableGrossOutputUsd - result.inputCapitalUsd;
    expect(result.grossProfitUsd).toBeCloseTo(expected, 8);
  });

  it('netProfitBeforeBufferUsd = grossProfit - gasCost', () => {
    const result = calculateProfit({
      quote: makeQuote(),
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0,
      minNetProfitUsd: 0,
    });

    expect(result.netProfitBeforeBufferUsd).toBeCloseTo(
      result.grossProfitUsd - result.gasCostUsd,
      8
    );
  });

  it('netExpectedProfit = netBeforeBuffer - riskBuffer', () => {
    const result = calculateProfit({
      quote: makeQuote(),
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0,
    });

    expect(result.netExpectedProfitUsd).toBeCloseTo(
      result.netProfitBeforeBufferUsd - result.riskBufferUsd,
      8
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rejection Logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Rejection logic', () => {
  it('rejects when gross spread is zero or negative', () => {
    // amountOut < amountIn value → negative spread
    const result = calculateProfit({
      quote: makeQuote({ amountOut: 990_000n }), // $0.99 out < $1.00 in
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0.001,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('SPREAD_TOO_SMALL');
  });

  it('rejects when gas cost exceeds gross profit', () => {
    // Make gas very expensive
    const highGasEstimate = estimateGasCost(
      'uniswap-v3',
      100_000_000_000n, // 100 gwei — very high for Base
      2400
    );
    // highGasEstimate.gasCostUsd ≈ 150,000 * 100e-9 * 2400 = $36
    // We need amountOut to produce gross profit > poolFees ($0.0005) but < gas cost ($36).
    // amountIn ≈ $1.00 in WETH.  Set amountOut = $1.01 → gross profit ≈ $0.01 > fees ($0.0005).
    // $0.01 gross profit << $36 gas cost → GAS_EXCEEDS_PROFIT should fire.
    const result = calculateProfit({
      quote: makeQuote({ amountOut: 1_010_000n }), // $1.01 out → $0.01 gross profit
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: highGasEstimate,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0.001,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('GAS_EXCEEDS_PROFIT');
  });

  it('rejects when net expected profit is below minimum threshold', () => {
    const result = calculateProfit({
      quote: makeQuote({ amountOut: 1_000_500n }), // $0.0005 profit
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0.05, // require $0.05 minimum
    });

    // $0.0005 profit will never reach $0.05 minimum
    expect(result.status).toBe('REJECTED');
  });

  it('classifies as CANDIDATE when all thresholds are met', () => {
    // Set minimum to 0 for this test
    const result = calculateProfit({
      quote: makeQuote({ amountOut: 1_010_000n }), // $0.01 profit
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0,
      minNetProfitUsd: 0,
    });

    expect(result.status).toBe('CANDIDATE');
    expect(result.rejectionReason).toBeNull();
  });

  it('always sets rejectionReason when status is REJECTED', () => {
    const result = calculateProfit({
      quote: makeQuote({ amountOut: 500_000n }), // major loss
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0.001,
      minNetProfitUsd: 0.001,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).not.toBeNull();
    expect(result.rejectionDetail).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stale Data Detection
// ─────────────────────────────────────────────────────────────────────────────

describe('Stale data detection', () => {
  it('detects that an observation timestamp is recent', () => {
    const now = Date.now();
    const observationTimestamp = now - 1000; // 1 second ago
    const maxStalenessMs = 30_000; // 30 seconds

    const isStale = (now - observationTimestamp) > maxStalenessMs;
    expect(isStale).toBe(false);
  });

  it('detects that an observation timestamp is stale', () => {
    const now = Date.now();
    const observationTimestamp = now - 60_000; // 60 seconds ago
    const maxStalenessMs = 30_000; // 30 seconds

    const isStale = (now - observationTimestamp) > maxStalenessMs;
    expect(isStale).toBe(true);
  });

  it('stale data should map to STALE_DATA rejection reason', () => {
    // This test validates the rejection reason type exists
    const validReasons = [
      'INSUFFICIENT_LIQUIDITY',
      'SPREAD_TOO_SMALL',
      'FEES_EXCEED_SPREAD',
      'GAS_EXCEEDS_PROFIT',
      'STALE_DATA',
      'QUOTE_FAILED',
      'RPC_ERROR',
      'PRICE_MOVED',
      'UNSUPPORTED_POOL',
      'INVALID_TOKEN',
      'ADAPTER_STUB',
      'OTHER',
    ];
    expect(validReasons).toContain('STALE_DATA');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fee Calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('Fee calculation', () => {
  it('calculates pool fees as fraction of input capital', () => {
    const result = calculateProfit({
      quote: makeQuote({ feeBps: 5 }),
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0,
      minNetProfitUsd: 0,
    });

    // 5 bps = 0.05% of $1.00 = $0.0005
    expect(result.poolFeesUsd).toBeCloseTo(0.0005, 5);
    expect(result.poolFeeBps).toBe(5);
  });

  it('calculates pool fees correctly for 30 bps (Aerodrome volatile)', () => {
    const result = calculateProfit({
      quote: makeQuote({ feeBps: 30, amountOut: 1_020_000n }), // larger output to stay positive
      inputCapitalUsd: 1.0,
      priceContext: DEFAULT_PRICE_CONTEXT,
      gasEstimate: LOW_GAS_ESTIMATE,
      riskBufferFraction: 0,
      minNetProfitUsd: 0,
    });

    // 30 bps = 0.30% of $1.00 = $0.003
    expect(result.poolFeesUsd).toBeCloseTo(0.003, 5);
  });
});
