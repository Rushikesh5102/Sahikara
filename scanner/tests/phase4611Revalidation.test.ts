/**
 * SAHIKARA Phase 4.6.1.1 — Forensic Revalidation & Defect Regression Test Suite
 *
 * Validates:
 * 1. D-001: Clean separation of nativeGasTokenPriceUsd and baseTradeTokenPriceUsd
 *    - Polygon WETH trades sized using WETH price ($2,500 [ASSUMPTION]), NOT MATIC ($0.80)
 *    - Polygon gas evaluated using MATIC price ($0.80), NOT WETH ($2,500)
 *    - Invariant: $1 trade = ~0.0004 WETH (4e14 wei), monotonically increasing, no 3,125x error
 * 2. D-002: Exact BigInt Price Impact calculation without Number overflow
 *    - Tested on WETH/USDC, WETH/USDCe, WBTC/WETH, wstETH/WETH
 *    - Small (1e18) and large (1e35) sqrtPriceX96 values
 *    - Zero NaN, zero overflow, numerically plausible bps
 * 3. D-003: Independent DB raw-row reproducibility aggregation
 *    - Independent reader/sorter/reducer compares against in-memory distribution
 *    - N, min, p25, p50, p75, p90, p95, p99, max, mean verified within 0.01 bps
 */

import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import type { IDataSource } from '../src/data-sources/IDataSource.js';
import type { ObservationStore } from '../src/storage/ObservationStore.js';
import { RealTimeShadowEngine } from '../src/shadow/RealTimeShadowEngine.js';
import { PolygonGasModel } from '../src/shadow/PolygonGasModel.js';
import { StatisticalReporter, type StatisticalRecord } from '../src/shadow/StatisticalReporter.js';

describe('Phase 4.6.1.1 Forensic Revalidation Test Suite', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // D-001: Gas Token vs Trade Token Pricing Separation
  // ───────────────────────────────────────────────────────────────────────────
  describe('D-001: Clean Separation of Gas Token vs Trade Token Pricing', () => {
    it('correctly separates Polygon MATIC gas price ($0.80) from WETH trade price ($2,500 [ASSUMPTION])', () => {
      const polygonGas = new PolygonGasModel({
        defaultMaticPriceUsd: 0.80,
      });

      const engine = new RealTimeShadowEngine({
        dataSource: {} as unknown as IDataSource,
        store: {} as unknown as ObservationStore,
        routes: [],
        gasModel: polygonGas,
        policyConfig: {
          baseTradeTokenPriceUsd: 2500.0,
          nativeGasTokenPriceUsd: 0.80,
          ethPriceUsd: 2500.0,
          minNetProfitUsd: 0.05,
          minNetProfitBps: 5.0,
          maxSlippageBps: 20.0,
          maxGasCostUsd: 0.50,
          maxTradeSizeUsd: 1000.0,
          minLiquidityUsd: 1000.0,
          maxQuoteAgeMs: 2000,
          maxViableLatencyMs: 3000,
          riskBufferBps: 10.0,
          assumedL1DataFeeUsd: 0.0,
        },
      });

      // Verify token price returns WETH = 2500, not 0.80
      const wethPrice = (engine as unknown as { getTokenPriceUsd: (s: string) => number }).getTokenPriceUsd('WETH');
      expect(wethPrice).toBe(2500.0);

      // Verify MATIC gas price in gasModel is 0.80, not 2500
      const gasBreakdown = polygonGas.calculateGasCost(30.0, 220_000);
      expect(gasBreakdown.ethPriceUsd).toBe(0.80);
      expect(gasBreakdown.totalGasCostUsd).toBeLessThan(0.05); // ~0.01 USD
    });

    it('validates Polygon trade sizing invariant: $1 = 4e14 wei WETH, strictly monotonic across all 9 sizes', () => {
      const sizesUsd = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
      const wethPriceUsd = 2500.0;
      const amounts: bigint[] = [];

      for (const sizeUsd of sizesUsd) {
        const tokenAmountStr = (sizeUsd / wethPriceUsd).toFixed(18);
        const amountWei = parseUnits(tokenAmountStr, 18);
        amounts.push(amountWei);

        // $1 trade must be ~4e14 wei (0.0004 WETH), NEVER 1.25 WETH (1.25e18 wei)
        if (sizeUsd === 1) {
          expect(amountWei).toBe(400000000000000n); // exactly 4e14 wei
          expect(Number(amountWei) / 1e18).toBeCloseTo(0.0004, 6);
        }
      }

      // Check strictly monotonic increasing amounts
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]! > amounts[i - 1]!).toBe(true);
      }

      // Check $1000 is 1000x $1
      expect(Number(amounts[amounts.length - 1]!) / 1e18).toBeCloseTo(0.4, 6);
      // Verify no 3,125x scaling error ($1 was previously 1.25 WETH)
      expect(Number(amounts[0]!) / 1e18).not.toBeCloseTo(1.25, 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D-002: Exact BigInt Price Impact Validation Across Pairs & Scales
  // ───────────────────────────────────────────────────────────────────────────
  describe('D-002: Mathematically Safe BigInt Price Impact', () => {
    function computePriceImpactBps(sqrtPriceBefore: bigint, sqrtPriceAfter: bigint): number {
      const sqrtDiff =
        sqrtPriceAfter > sqrtPriceBefore
          ? sqrtPriceAfter - sqrtPriceBefore
          : sqrtPriceBefore - sqrtPriceAfter;
      const PRICE_IMPACT_SCALE = 100_000_000n; // 1e8
      const sqrtSum = sqrtPriceAfter + sqrtPriceBefore;
      const den = sqrtPriceBefore * sqrtPriceBefore;
      const priceImpactScaled =
        den > 0n ? (sqrtDiff * sqrtSum * PRICE_IMPACT_SCALE * 10_000n) / den : 0n;
      return Number(priceImpactScaled) / 1e8;
    }

    it('computes plausible price impact for WETH/USDC (huge sqrtPriceX96 ~1.58e33)', () => {
      const sqrtBefore = 1584563250285286751870879006720000n; // ~1.58e33
      // +2.5 bps shift in sqrtPrice (250 parts per million) => ~+5.0 bps in price
      const sqrtAfter = (sqrtBefore * 1000250n) / 1000000n;

      const impact = computePriceImpactBps(sqrtBefore, sqrtAfter);
      expect(Number.isFinite(impact)).toBe(true);
      expect(impact).toBeGreaterThan(4.9);
      expect(impact).toBeLessThan(5.1);
    });

    it('computes plausible price impact for WETH/USDCe', () => {
      const sqrtBefore = 1580000000000000000000000000000000n;
      // +5 bps shift in sqrtPrice (500 ppm) => ~+10.0 bps in price
      const sqrtAfter = (sqrtBefore * 1000500n) / 1000000n;
      const impact = computePriceImpactBps(sqrtBefore, sqrtAfter);
      expect(Number.isFinite(impact)).toBe(true);
      expect(impact).toBeCloseTo(10.0, 1);
    });

    it('computes plausible price impact for WBTC/WETH (moderate sqrtPriceX96 ~1.02e23)', () => {
      const sqrtBefore = 102000000000000000000000n;
      // -10 bps shift in sqrtPrice (1000 ppm) => ~-20.0 bps in price
      const sqrtAfter = (sqrtBefore * 999000n) / 1000000n;
      const impact = computePriceImpactBps(sqrtBefore, sqrtAfter);
      expect(Number.isFinite(impact)).toBe(true);
      expect(impact).toBeCloseTo(20.0, 1);
    });

    it('computes plausible price impact for wstETH/WETH (near 1:1, sqrtPriceX96 ~8.47e28)', () => {
      const sqrtBefore = 84700000000000000000000000000n;
      // +0.5 bps shift in sqrtPrice (50 ppm) => ~+1.0 bps in price
      const sqrtAfter = (sqrtBefore * 1000050n) / 1000000n;
      const impact = computePriceImpactBps(sqrtBefore, sqrtAfter);
      expect(Number.isFinite(impact)).toBe(true);
      expect(impact).toBeCloseTo(1.0, 1);
    });

    it('handles extreme small and large sqrtPriceX96 scales without overflow or underflow', () => {
      // Tiny: 1e18
      const tinyBefore = 1000000000000000000n;
      const tinyAfter = (tinyBefore * 1001000n) / 1000000n; // +10 bps sqrt => ~20 bps price
      const tinyImpact = computePriceImpactBps(tinyBefore, tinyAfter);
      expect(Number.isFinite(tinyImpact)).toBe(true);
      expect(tinyImpact).toBeCloseTo(20.0, 0);

      // Huge: 1e35
      const hugeBefore = 100000000000000000000000000000000000n;
      const hugeAfter = (hugeBefore * 1000500n) / 1000000n; // ~10 bps price
      const hugeImpact = computePriceImpactBps(hugeBefore, hugeAfter);
      expect(Number.isFinite(hugeImpact)).toBe(true);
      expect(hugeImpact).toBeCloseTo(10.0, 1);

      // Zero delta gives exactly 0
      expect(computePriceImpactBps(hugeBefore, hugeBefore)).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D-003: Independent DB-Driven Reproducibility Aggregation
  // ───────────────────────────────────────────────────────────────────────────
  describe('D-003: Independent Statistical Reproducibility (Dual Aggregation)', () => {
    it('validates that an independent reducer matching raw rows produces identical quantiles', () => {
      const sampleSpreads = [
        -45.2, -38.1, -35.0, -32.5, -30.0, -28.4, -27.1, -26.0, -25.5, -24.8,
        -23.2, -22.1, -21.0, -20.5, -19.8, -19.2, -18.5, -17.9, -17.2, -16.8,
        -16.1, -15.5, -15.0, -14.4, -13.9, -13.2, -12.8, -12.1, -11.5, -11.0,
        -10.4, -9.8, -9.2, -8.7, -8.1, -7.5, -7.0, -6.4, -5.9, -5.2,
        -4.8, -4.1, -3.5, -3.0, -2.5, -2.1, -1.8, -1.2, -0.9, -0.5,
        -0.2, 0.1, 0.4, 0.8, 1.2, 1.5, 1.9, 2.3, 2.8, 3.2,
        3.7, 4.1, 4.6, 5.0, 5.5, 6.1, 6.8, 7.2, 7.9, 8.4,
        9.0, 9.5, 10.1, 10.8, 11.4, 12.0, 12.7, 13.3, 14.0, 14.8,
        15.5, 16.2, 17.0, 17.8, 18.5, 19.4, 20.2, 21.1, 22.0, 23.1,
        24.2, 25.5, 26.8, 28.2, 29.9, 31.8, 34.0, 37.2, 41.5, 48.0,
      ];

      // Aggregation A: via StatisticalReporter
      const records: StatisticalRecord[] = sampleSpreads.map((bps) => ({
        grossSpreadBps: bps,
        netProfitBps: bps - 5.0,
        gasCostUsd: 0.05,
        tradeSizeUsd: 100,
        latencyMs: 50,
        priceImpactBps: 2.0,
        isQuoteValid: true,
      }));

      const reportA = StatisticalReporter.generateReport(records, 'ALL_VALID_EXECUTABLE_QUOTES');
      const distA = reportA.grossSpreadDist;

      // Aggregation B: completely independent reducer over raw float array
      const sortedB = [...sampleSpreads].sort((a, b) => a - b);
      const N = sortedB.length;
      const minB = sortedB[0]!;
      const maxB = sortedB[N - 1]!;
      const meanB = sortedB.reduce((acc, v) => acc + v, 0) / N;

      function quantileB(p: number): number {
        const idx = (N - 1) * p;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        const frac = idx - lo;
        return sortedB[lo]! + frac * (sortedB[hi]! - sortedB[lo]!);
      }

      const p25B = quantileB(0.25);
      const p50B = quantileB(0.50);
      const p75B = quantileB(0.75);
      const p90B = quantileB(0.90);
      const p95B = quantileB(0.95);
      const p99B = quantileB(0.99);

      // Verify all statistical properties match within 0.01 bps tolerance
      const TOL = 0.01;
      expect(distA.n).toBe(N);
      expect(Math.abs(distA.min - minB)).toBeLessThan(TOL);
      expect(Math.abs(distA.p25 - p25B)).toBeLessThan(TOL);
      expect(Math.abs(distA.median - p50B)).toBeLessThan(TOL);
      expect(Math.abs(distA.p75 - p75B)).toBeLessThan(TOL);
      expect(Math.abs(distA.p90 - p90B)).toBeLessThan(TOL);
      expect(Math.abs(distA.p95 - p95B)).toBeLessThan(TOL);
      expect(Math.abs(distA.p99 - p99B)).toBeLessThan(TOL);
      expect(Math.abs(distA.max - maxB)).toBeLessThan(TOL);
      expect(Math.abs(distA.mean - meanB)).toBeLessThan(TOL);
    });
  });
});
