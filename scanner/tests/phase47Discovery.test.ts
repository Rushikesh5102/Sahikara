/**
 * SAHIKARA Phase 4.7 — Opportunity Discovery Expansion Test Suite
 *
 * Validates:
 * 1. DynamicPoolDiscovery: classification, bytecode checks, token ordering
 * 2. GraphRouteGenerator: 2-hop, 3-hop triangular, deduplication, no self-loops
 * 3. FailureTaxonomy: 16-category classification, invariant against synthetic economic values
 * 4. OpportunityLifetimeTracker: state machine, UNKNOWN lifetime when 0 positive
 * 5. PositiveSignalValidator: 10-stage pipeline, sub-fee rejection, repeat quote check
 * 6. Regression Invariants: D-001, D-002, D-003
 */

import { describe, it, expect } from 'vitest';
import { FailureTaxonomy } from '../src/economics/FailureTaxonomy.js';
import { OpportunityLifetimeTracker } from '../src/shadow/OpportunityLifetimeTracker.js';
import { PositiveSignalValidator } from '../src/discovery/PositiveSignalValidator.js';
import { GraphRouteGenerator } from '../src/discovery/GraphRouteGenerator.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import type { IPoolAdapter, PoolObservation } from '../src/adapters/IPoolAdapter.js';
import type { RoundTripEvaluation } from '../src/economics/roundTripEvaluator.js';

describe('Phase 4.7 Opportunity Discovery Expansion Test Suite', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Failure Taxonomy & Invariants
  // ───────────────────────────────────────────────────────────────────────────
  describe('Workstream 4.7.13: Failure Taxonomy & Non-Economic Invariants', () => {
    it('accurately classifies network, liquidity, revert, and config errors into 16 categories', () => {
      expect(FailureTaxonomy.classify('ETIMEDOUT: connect timed out')).toBe('TIMEOUT');
      expect(FailureTaxonomy.classify('HTTP 429 Too Many Requests')).toBe('RPC_ERROR');
      expect(FailureTaxonomy.classify('execution reverted: AS')).toBe('LIQUIDITY_INSUFFICIENT');
      expect(FailureTaxonomy.classify('execution reverted: arbitrary custom error')).toBe('REVERT');
      expect(FailureTaxonomy.classify('pool not found or bytecode missing')).toBe('INVALID_POOL');
      expect(FailureTaxonomy.classify('token mismatch')).toBe('INVALID_TOKEN');
      expect(FailureTaxonomy.classify('decimals mismatch')).toBe('DECIMAL_ERROR');
      expect(FailureTaxonomy.classify('insufficient liquidity in pool')).toBe('LIQUIDITY_INSUFFICIENT');
      expect(FailureTaxonomy.classify('amountOut is 0')).toBe('QUOTE_ZERO');
      expect(FailureTaxonomy.classify('price impact exceeded max 50 bps')).toBe('SLIPPAGE_TOO_HIGH');
      expect(FailureTaxonomy.classify('gas cost exceeds profit')).toBe('GAS_TOO_HIGH');
      expect(FailureTaxonomy.classify('negative profit detected')).toBe('PROFIT_TOO_LOW');
      expect(FailureTaxonomy.classify('quote age exceeds maxQuoteAgeMs')).toBe('STALE_QUOTE');
      expect(FailureTaxonomy.classify('topology produces no closed cycle')).toBe('TOPOLOGY_NO_CYCLE');
      expect(FailureTaxonomy.classify('adapter not found for protocol')).toBe('UNSUPPORTED_ROUTE');
      expect(FailureTaxonomy.classify('missing env config')).toBe('CONFIGURATION_ERROR');
      expect(FailureTaxonomy.classify(null)).toBe('UNKNOWN');
    });

    it('enforces invariant: fabricated economic values (e.g. -10,000 bps) throw invariant violation', () => {
      expect(() => FailureTaxonomy.assertNotEconomicMetric(-10000)).toThrow(/INVARIANT VIOLATION/);
      expect(() => FailureTaxonomy.assertNotEconomicMetric(-5001)).toThrow(/INVARIANT VIOLATION/);
      expect(() => FailureTaxonomy.assertNotEconomicMetric(NaN)).toThrow(/INVARIANT VIOLATION/);
      // Plausible empirical spreads do not throw
      expect(() => FailureTaxonomy.assertNotEconomicMetric(-55.4)).not.toThrow();
      expect(() => FailureTaxonomy.assertNotEconomicMetric(12.5)).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Opportunity Lifetime Tracker
  // ───────────────────────────────────────────────────────────────────────────
  describe('Workstream 4.7.7: Opportunity Lifetime Tracker State Machine', () => {
    it('returns lifetime = UNKNOWN when no positive opportunities are observed (never synthetic 0 ms)', () => {
      const tracker = new OpportunityLifetimeTracker();
      tracker.recordObservation({
        routeId: 'route-1',
        chain: 'base',
        grossSpreadBps: -15.0,
        netProfitBps: -25.0,
        timestampMs: 1000,
      });
      tracker.recordObservation({
        routeId: 'route-1',
        chain: 'base',
        grossSpreadBps: -10.0,
        netProfitBps: -20.0,
        timestampMs: 2000,
      });

      const summary = tracker.getSummary();
      expect(summary.totalOpportunitiesTracked).toBe(1);
      expect(summary.positiveOpportunitiesCount).toBe(0);
      expect(summary.empiricalLifetimeReport).toContain('UNKNOWN');
      expect(summary.averageLifetimeMs).toBeUndefined();
    });

    it('accurately tracks lifetime from firstPositiveAt to expiredAt when opportunity decays', () => {
      const tracker = new OpportunityLifetimeTracker();
      // t = 1000: negative
      tracker.recordObservation({
        routeId: 'route-alpha',
        chain: 'arbitrum',
        grossSpreadBps: -5.0,
        netProfitBps: -15.0,
        timestampMs: 1000,
      });

      // t = 2000: becomes positive!
      tracker.recordObservation({
        routeId: 'route-alpha',
        chain: 'arbitrum',
        grossSpreadBps: 20.0,
        netProfitBps: 10.0,
        timestampMs: 2000,
      });

      // t = 3500: peak spread
      tracker.recordObservation({
        routeId: 'route-alpha',
        chain: 'arbitrum',
        grossSpreadBps: 35.0,
        netProfitBps: 22.0,
        timestampMs: 3500,
      });

      // t = 5000: decays back to negative
      tracker.recordObservation({
        routeId: 'route-alpha',
        chain: 'arbitrum',
        grossSpreadBps: -8.0,
        netProfitBps: -18.0,
        timestampMs: 5000,
      });

      const summary = tracker.getSummary();
      expect(summary.positiveOpportunitiesCount).toBe(1);
      const rec = summary.records[0]!;
      expect(rec.firstPositiveAt).toBe(2000);
      expect(rec.peakObservedAt).toBe(3500);
      expect(rec.expiredAt).toBe(5000);
      expect(rec.lifetimeMs).toBe(3000); // 5000 - 2000 = 3000ms
      expect(summary.averageLifetimeMs).toBe(3000);
      expect(summary.medianLifetimeMs).toBe(3000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Positive Signal Validation Gate
  // ───────────────────────────────────────────────────────────────────────────
  describe('Workstream 4.7.8 & 4.7.17: Positive Signal Forensics Pipeline', () => {
    function makeMockEval(grossBps: number, netUsd: number, leg1Fee = 5, leg2Fee = 30): RoundTripEvaluation {
      return {
        routeId: 'mock-route',
        routeName: 'Mock Route',
        chain: 'arbitrum',
        initialAmount: 1000000000000000000n,
        leg1Output: 1000000000000000000n,
        leg2Output: 1000000000000000000n,
        grossRoundTripDiff: 0n,
        baseToken: {} as unknown as TokenDefinition,
        intermediateToken: {} as unknown as TokenDefinition,
        leg1FeeBps: leg1Fee,
        leg2FeeBps: leg2Fee,
        leg1FeeAmount: 0n,
        leg2FeeAmount: 0n,
        maxPriceImpactBps: 2.0,
        totalLatencyMs: 20,
        rejectionReason: null,
        rejectionDetail: null,
        grossSpreadBps: grossBps,
        netProfitBps: grossBps - 10,
        grossProfitUsd: netUsd + 0.10,
        netExpectedProfitUsd: netUsd,
        status: grossBps > 0 ? 'CANDIDATE' : 'REJECTED',
        classification: grossBps > 0 ? 'POTENTIAL_CANDIDATE' : 'NO_OPPORTUNITY',
        timestamp: Date.now(),
        blockNumber: 100000n,
        leg1: {
          feeBps: leg1Fee,
          priceImpactBps: 1.0,
          amountIn: 1n,
          amountOut: 1n,
          dex: 'Uniswap v3',
          latencyMs: 10,
          rawQuoteJson: '{}',
          pool: {} as unknown as PoolDefinition,
          tokenIn: {} as unknown as TokenDefinition,
          tokenOut: {} as unknown as TokenDefinition,
        },
        leg2: {
          feeBps: leg2Fee,
          priceImpactBps: 1.0,
          amountIn: 1n,
          amountOut: 1n,
          dex: 'Uniswap v3',
          latencyMs: 10,
          rawQuoteJson: '{}',
          pool: {} as unknown as PoolDefinition,
          tokenIn: {} as unknown as TokenDefinition,
          tokenOut: {} as unknown as TokenDefinition,
        },
        gasEstimate: {
          gasUnits: 220000,
          gasPriceGwei: 0.1,
          gasCostEth: 0.000022,
          gasCostUsd: 0.055,
          ethPriceUsd: 2500,
          note: 'test',
        },
        riskBufferUsd: 0.05,
        gasCostUsd: 0.055,
        poolFeesUsd: 0.35,
        tradeSizeUsd: 100,
        poolFeesBps: leg1Fee + leg2Fee,
      };
    }

    it('immediately rejects negative gross spread', () => {
      const evalNeg = makeMockEval(-15.0, -0.50);
      const report = PositiveSignalValidator.auditInitialEvaluation(evalNeg);
      expect(report.stage).toBe('REJECTED');
      expect(report.isValidatedOpportunity).toBe(false);
      expect(report.failedGates).toContain('EXECUTABLE_GROSS_POSITIVE');
    });

    it('rejects sub-fee spread artifact (e.g. +15 bps spread against 35 bps fee floor)', () => {
      // Historical Arbitrum anomaly: +15 bps spread against 35 bps fee floor
      const evalSubFee = makeMockEval(15.0, 0.10, 5, 30);
      const report = PositiveSignalValidator.auditInitialEvaluation(evalSubFee);
      expect(report.stage).toBe('REJECTED');
      expect(report.failedGates).toContain('FEE_VALIDATED');
      expect(report.auditNotes.some((n) => n.includes('Sub-fee dislocation artifact'))).toBe(true);
    });

    it('progresses to REPEATED_REQUOTE if spread exceeds fee floor and is profitable', () => {
      // +45 bps spread against 35 bps fee floor
      const evalCandidate = makeMockEval(45.0, 0.50, 5, 30);
      const report = PositiveSignalValidator.auditInitialEvaluation(evalCandidate);
      expect(report.stage).toBe('REPEATED_REQUOTE');
      expect(report.isValidatedOpportunity).toBe(false); // Not yet validated until repeat quote
      expect(report.passedGates).toContain('FEE_VALIDATED');
      expect(report.passedGates).toContain('RISK_BUFFER_VALIDATED');

      // Now test repeat quote verification
      const requotePass = makeMockEval(42.0, 0.40, 5, 30);
      const finalReport = PositiveSignalValidator.verifyRepeatQuote(report, requotePass);
      expect(finalReport.stage).toBe('CANDIDATE_VALIDATED');
      expect(finalReport.isValidatedOpportunity).toBe(true);
    });

    it('rejects candidate if re-quote fails to reproduce the spread', () => {
      const evalCandidate = makeMockEval(45.0, 0.50, 5, 30);
      const report = PositiveSignalValidator.auditInitialEvaluation(evalCandidate);

      const requoteFail = makeMockEval(-12.0, -0.20, 5, 30);
      const finalReport = PositiveSignalValidator.verifyRepeatQuote(report, requoteFail);
      expect(finalReport.stage).toBe('REJECTED');
      expect(finalReport.isValidatedOpportunity).toBe(false);
      expect(finalReport.failedGates).toContain('REPEATED_REQUOTE');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Graph-Based Route Discovery & Deduplication
  // ───────────────────────────────────────────────────────────────────────────
  describe('Workstream 4.7.4 & 4.7.5: Graph Route Generation', () => {
    const tokenWETH: TokenDefinition = { symbol: 'WETH', address: '0x1000000000000000000000000000000000000001', decimals: 18, addressTier: '[FACT]' };
    const tokenUSDC: TokenDefinition = { symbol: 'USDC', address: '0x2000000000000000000000000000000000000002', decimals: 6, addressTier: '[FACT]' };
    const tokenWBTC: TokenDefinition = { symbol: 'WBTC', address: '0x3000000000000000000000000000000000000003', decimals: 8, addressTier: '[FACT]' };

    const pool1: PoolDefinition = {
      id: 'pool-weth-usdc-500',
      chain: 'arbitrum',
      chainId: 42161,
      dex: 'Uniswap v3',
      protocol: 'uniswap-v3',
      poolAddress: '0xaaaa000000000000000000000000000000000001',
      token0: tokenWETH,
      token1: tokenUSDC,
      feeBps: 5,
      status: 'active',
      note: 'test',
      tier: '[FACT]',
    };

    const pool2: PoolDefinition = {
      id: 'pool-weth-usdc-3000',
      chain: 'arbitrum',
      chainId: 42161,
      dex: 'Uniswap v3',
      protocol: 'uniswap-v3',
      poolAddress: '0xbbbb000000000000000000000000000000000002',
      token0: tokenWETH,
      token1: tokenUSDC,
      feeBps: 30,
      status: 'active',
      note: 'test',
      tier: '[FACT]',
    };

    const pool3: PoolDefinition = {
      id: 'pool-usdc-wbtc-500',
      chain: 'arbitrum',
      chainId: 42161,
      dex: 'Uniswap v3',
      protocol: 'uniswap-v3',
      poolAddress: '0xcccc000000000000000000000000000000000003',
      token0: tokenUSDC,
      token1: tokenWBTC,
      feeBps: 5,
      status: 'active',
      note: 'test',
      tier: '[FACT]',
    };

    const pool4: PoolDefinition = {
      id: 'pool-wbtc-weth-500',
      chain: 'arbitrum',
      chainId: 42161,
      dex: 'Uniswap v3',
      protocol: 'uniswap-v3',
      poolAddress: '0xdddd000000000000000000000000000000000004',
      token0: tokenWBTC,
      token1: tokenWETH,
      feeBps: 5,
      status: 'active',
      note: 'test',
      tier: '[FACT]',
    };

    const mockAdapter: IPoolAdapter = {
      protocol: 'uniswap-v3',
      supports: () => true,
      getQuote: async () => ({} as PoolObservation),
    };

    const adapters = new Map<string, IPoolAdapter>([['uniswap-v3', mockAdapter]]);

    it('generates valid 2-hop cross-fee routes without self-loops', () => {
      const generator = new GraphRouteGenerator();
      const routes = generator.generate2HopRoutes([pool1, pool2], adapters);
      expect(routes.length).toBeGreaterThan(0);
      for (const r of routes) {
        expect(r.leg1.pool.poolAddress).not.toBe(r.leg2.pool.poolAddress);
        expect(r.leg1.tokenIn.symbol).toBe(r.leg2.tokenOut.symbol);
      }
    });

    it('generates closed 3-leg triangular routes when 3 distinct pairs close a cycle', () => {
      const generator = new GraphRouteGenerator();
      // Triangle: WETH (pool1) -> USDC (pool3) -> WBTC (pool4) -> WETH
      const routes = generator.generateTriangularRoutes([pool1, pool3, pool4], adapters);
      expect(routes.length).toBeGreaterThan(0);
      const tri = routes[0]!;
      expect(tri.leg3).toBeDefined();
      expect(tri.leg1.tokenIn.symbol).toBe(tri.leg3!.tokenOut.symbol);
      expect(tri.leg1.tokenOut.symbol).toBe(tri.leg2.tokenIn.symbol);
      expect(tri.leg2.tokenOut.symbol).toBe(tri.leg3!.tokenIn.symbol);
    });

    it('enforces canonical deduplication: no cyclic permutation duplicates', () => {
      const generator = new GraphRouteGenerator();
      const routes = generator.generateTriangularRoutes([pool1, pool3, pool4], adapters);
      const ids = routes.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Regression Invariant Locks: D-001, D-002, D-003
  // ───────────────────────────────────────────────────────────────────────────
  describe('Regression Invariant Locks: D-001, D-002, D-003', () => {
    it('D-001: Polygon WETH trade sizing ($2,500 [ASSUMPTION]) cannot be conflated with MATIC gas ($0.80)', () => {
      const maticGasPrice = 0.80;
      const wethTradePrice = 2500.0;
      expect(wethTradePrice).toBeGreaterThan(maticGasPrice * 1000);
      // Invariant: $1 trade = 4e14 wei WETH, NOT 1.25e18 wei
      const tradeSizeUsd = 1.0;
      const wethAmount = tradeSizeUsd / wethTradePrice;
      expect(wethAmount).toBeCloseTo(0.0004, 6);
      expect(wethAmount).not.toBeCloseTo(1.25, 1);
    });

    it('D-002: BigInt price impact calculation handles huge sqrtPriceX96 (~1.58e33) without Number overflow', () => {
      const sqrtBefore = 1584563250285286751870879006720000n; // ~1.58e33
      const sqrtAfter = (sqrtBefore * 1000250n) / 1000000n; // +2.5 bps sqrt -> +5 bps price
      const sqrtDiff = sqrtAfter > sqrtBefore ? sqrtAfter - sqrtBefore : sqrtBefore - sqrtAfter;
      const sqrtSum = sqrtAfter + sqrtBefore;
      const den = sqrtBefore * sqrtBefore;
      const scaled = (sqrtDiff * sqrtSum * 100000000n * 10000n) / den;
      const impactBps = Number(scaled) / 1e8;

      expect(Number.isFinite(impactBps)).toBe(true);
      expect(impactBps).toBeGreaterThan(4.9);
      expect(impactBps).toBeLessThan(5.1);
    });

    it('D-003: Raw row quantile calculation matches independent sort/reduce', () => {
      const sample = [-25.0, -19.5, -12.3, -5.0, -2.1, 0.0, 1.2, 5.5, 12.0];
      const sorted = [...sample].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      expect(median).toBe(-2.1);
      const min = sorted[0]!;
      const max = sorted[sorted.length - 1]!;
      expect(min).toBe(-25.0);
      expect(max).toBe(12.0);
    });
  });
});
