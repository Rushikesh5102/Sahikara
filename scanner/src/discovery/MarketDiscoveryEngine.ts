/**
 * SAHIKARA Observer — Deterministic Market Discovery Engine
 *
 * Coordinates multi-pair, multi-DEX market observation and discovery:
 *   Pool Registry
 *        ↓
 *   Eligible Pools
 *        ↓
 *   Token Pair Grouping
 *        ↓
 *   DEX Route Generation
 *        ↓
 *   Executable Quotes
 *        ↓
 *   Round-Trip Evaluation
 *        ↓
 *   Gas Estimation
 *        ↓
 *   Risk Filters
 *        ↓
 *   Opportunity Classification
 *        ↓
 *   Research Candidate
 *
 * STRICT SEPARATION:
 *   Spot-price differences are NOT executable arbitrage profits.
 *   Only quotes evaluated by the economics engine determine candidate status.
 *   Zero live execution, zero wallet connection.
 */

import type { IDataSource } from '../data-sources/IDataSource.js';
import type { IPoolAdapter, OpportunityClassification } from '../adapters/IPoolAdapter.js';
import type { PoolDefinition } from '../config/pools.js';
import type { ResearchPair } from '../config/pairs.js';
import type { RouteGenerator } from './RouteGenerator.js';
import type { ObservationStore } from '../storage/ObservationStore.js';
import {
  evaluateRoundTrip,
  type RoundTripEvaluation,
} from '../economics/roundTripEvaluator.js';

export interface BpsDistribution {
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface PairMatrixRow {
  pair: string;
  dexA: string;
  dexB: string;
  routes: number;
  quotes: number;
  failures: number;
  candidates: number;
}

export interface PairProfitabilityMatrixRow {
  pair: string;
  meanGrossBps: number;
  maxGrossBps: number;
  meanNetBps: number;
  maxNetBps: number;
  candidates: number;
}

export interface DexMatrixRow {
  dexA: string;
  dexB: string;
  routes: number;
  opportunities: number;
  quoteFailures: number;
}

export interface MarketDiscoveryMetrics {
  poolsScanned: number;
  pairsScanned: number;
  dexsScanned: number;
  routesGenerated: number;
  quotesAttempted: number;
  successfulQuotes: number;
  failedQuotes: number;
  roundTripsEvaluated: number;
  positiveGrossRoundTrips: number;
  candidatesDetected: number;
  candidatesRejected: number;
  rejectionBreakdown: Record<string, number>;
  classificationBreakdown: Record<OpportunityClassification, number>;
  grossBpsDistribution?: BpsDistribution;
  netBpsDistribution?: BpsDistribution;
}

export interface MarketDiscoveryOptions {
  pairs: ResearchPair[];
  pools: PoolDefinition[];
  adapters: Map<string, IPoolAdapter>;
  routeGenerator: RouteGenerator;
  dataSource: IDataSource;
  store: ObservationStore;
  researchSizesUsd: number[];
  ethPriceUsd: number;
  minNetProfitUsd: number;
  riskBufferFraction: number;
  maxPriceImpactBps: number;
}

export class MarketDiscoveryEngine {
  private readonly pairs: ResearchPair[];
  private readonly pools: PoolDefinition[];
  private readonly adapters: Map<string, IPoolAdapter>;
  private readonly routeGenerator: RouteGenerator;
  private readonly dataSource: IDataSource;
  private readonly store: ObservationStore;
  private readonly researchSizesUsd: number[];
  private readonly ethPriceUsd: number;
  private readonly minNetProfitUsd: number;
  private readonly riskBufferFraction: number;
  private readonly maxPriceImpactBps: number;

  private allEvaluations: RoundTripEvaluation[] = [];

  private metrics: MarketDiscoveryMetrics = {
    poolsScanned: 0,
    pairsScanned: 0,
    dexsScanned: 0,
    routesGenerated: 0,
    quotesAttempted: 0,
    successfulQuotes: 0,
    failedQuotes: 0,
    roundTripsEvaluated: 0,
    positiveGrossRoundTrips: 0,
    candidatesDetected: 0,
    candidatesRejected: 0,
    rejectionBreakdown: {},
    classificationBreakdown: {
      NO_OPPORTUNITY: 0,
      SPREAD_TOO_SMALL: 0,
      QUOTE_FAILED: 0,
      INSUFFICIENT_LIQUIDITY: 0,
      GAS_TOO_HIGH: 0,
      SLIPPAGE_TOO_HIGH: 0,
      RISK_REJECTED: 0,
      POTENTIAL_CANDIDATE: 0,
    },
  };

  constructor(options: MarketDiscoveryOptions) {
    this.pairs = options.pairs;
    this.pools = options.pools;
    this.adapters = options.adapters;
    this.routeGenerator = options.routeGenerator;
    this.dataSource = options.dataSource;
    this.store = options.store;
    this.researchSizesUsd = options.researchSizesUsd;
    this.ethPriceUsd = options.ethPriceUsd;
    this.minNetProfitUsd = options.minNetProfitUsd;
    this.riskBufferFraction = options.riskBufferFraction;
    this.maxPriceImpactBps = options.maxPriceImpactBps;
  }

  getMetrics(): MarketDiscoveryMetrics {
    const grossBpsList = this.allEvaluations
      .filter((e) => e.status !== 'ERROR')
      .map((e) => e.grossSpreadBps);
    const netBpsList = this.allEvaluations
      .filter((e) => e.status !== 'ERROR')
      .map((e) => e.netProfitBps);

    return {
      ...this.metrics,
      grossBpsDistribution: grossBpsList.length > 0 ? this.calculatePercentiles(grossBpsList) : undefined,
      netBpsDistribution: netBpsList.length > 0 ? this.calculatePercentiles(netBpsList) : undefined,
    };
  }

  getAllEvaluations(): RoundTripEvaluation[] {
    return [...this.allEvaluations];
  }

  /**
   * Deterministic percentile calculation: min, p25, median, p75, p90, p95, p99, max
   */
  private calculatePercentiles(values: number[]): BpsDistribution {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) {
      return { min: 0, p25: 0, median: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0 };
    }

    const getP = (p: number): number => {
      const idx = Math.floor(p * (n - 1));
      return sorted[idx]!;
    };

    return {
      min: sorted[0]!,
      p25: getP(0.25),
      median: getP(0.50),
      p75: getP(0.75),
      p90: getP(0.90),
      p95: getP(0.95),
      p99: getP(0.99),
      max: sorted[n - 1]!,
    };
  }

  /**
   * Helper to approximate token price in USD for trade size scaling.
   */
  private getTokenPriceUsd(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s === 'WETH') return this.ethPriceUsd;
    if (s === 'WSTETH') return this.ethPriceUsd * 1.15;
    if (s === 'USDC' || s === 'USDBC' || s === 'DAI' || s === 'USDT') return 1.0;
    if (s === 'CBBTC') return 60_000.0;
    if (s === 'AERO') return 0.70;
    if (s === 'DEGEN') return 0.005;
    if (s === 'VIRTUAL') return 1.20;
    return 1.0;
  }

  /**
   * Run a single discovery and observation cycle across all pairs and routes.
   */
  async runCycle(): Promise<{
    blockNumber: bigint;
    routesEvaluated: number;
    evaluations: RoundTripEvaluation[];
  }> {
    // 1. Query network state (block and gas)
    const { header } = await this.dataSource.getLatestBlock();
    const blockNumber = header.blockNumber;

    const { gasPrice } = await this.dataSource.getGasPrice();
    const gasPriceWei = gasPrice.gasPriceWei;

    // 2. Discover routes from registered pools
    const activePairs = this.pairs.filter((p) => p.enabled);
    const routes = this.routeGenerator.generateRoutes(
      activePairs,
      this.pools,
      this.adapters
    );

    const distinctDexs = new Set(this.pools.map((p) => p.dex));

    this.metrics.poolsScanned = this.pools.length;
    this.metrics.pairsScanned = activePairs.length;
    this.metrics.dexsScanned = distinctDexs.size;
    this.metrics.routesGenerated = routes.length;

    const evaluations: RoundTripEvaluation[] = [];

    // 3. Evaluate each route across configured research sizes
    for (const route of routes) {
      for (const tradeSizeUsd of this.researchSizesUsd) {
        const baseToken = route.leg1.tokenIn;
        const intermediateToken = route.leg1.tokenOut;
        const baseTokenPriceUsd = this.getTokenPriceUsd(baseToken.symbol);
        const intermediateTokenPriceUsd = this.getTokenPriceUsd(intermediateToken.symbol);

        const decimals = baseToken.decimals;
        const initialAmount = BigInt(
          Math.floor((tradeSizeUsd / baseTokenPriceUsd) * Math.pow(10, decimals))
        );

        if (initialAmount <= 0n) continue;

        this.metrics.quotesAttempted += 2; // 2 legs per round trip

        try {
          const evalResult = await evaluateRoundTrip({
            route,
            tradeSizeUsd,
            initialAmount,
            baseTokenPriceUsd,
            intermediateTokenPriceUsd,
            blockNumber,
            gasPriceWei,
            ethPriceUsd: this.ethPriceUsd,
            minNetProfitUsd: this.minNetProfitUsd,
            riskBufferFraction: this.riskBufferFraction,
            maxPriceImpactBps: this.maxPriceImpactBps,
          });

          this.metrics.roundTripsEvaluated++;

          if (evalResult.status === 'ERROR') {
            this.metrics.failedQuotes++;
          } else {
            this.metrics.successfulQuotes += 2;
            if (evalResult.grossRoundTripDiff > 0n) {
              this.metrics.positiveGrossRoundTrips++;
            }
          }

          if (evalResult.status === 'CANDIDATE') {
            this.metrics.candidatesDetected++;
          } else {
            this.metrics.candidatesRejected++;
            const reason = evalResult.rejectionReason ?? 'OTHER';
            this.metrics.rejectionBreakdown[reason] =
              (this.metrics.rejectionBreakdown[reason] ?? 0) + 1;
          }

          // Track classification
          const c = evalResult.classification;
          this.metrics.classificationBreakdown[c] =
            (this.metrics.classificationBreakdown[c] ?? 0) + 1;

          // Persist observation idempotently
          this.store.insertRoundTrip(evalResult);
          evaluations.push(evalResult);
          this.allEvaluations.push(evalResult);
        } catch (err: unknown) {
          void err;
          this.metrics.failedQuotes += 2;
          this.metrics.candidatesRejected++;
          const reason = 'QUOTE_FAILED';
          this.metrics.rejectionBreakdown[reason] =
            (this.metrics.rejectionBreakdown[reason] ?? 0) + 1;
          this.metrics.classificationBreakdown['QUOTE_FAILED'] =
            (this.metrics.classificationBreakdown['QUOTE_FAILED'] ?? 0) + 1;
        }
      }
    }

    return {
      blockNumber,
      routesEvaluated: routes.length,
      evaluations,
    };
  }

  /**
   * STEP 13 — PAIR MATRIX
   * Pair | DEX A | DEX B | Routes | Quotes | Failures | Candidates
   */
  generatePairMatrix(): PairMatrixRow[] {
    const map = new Map<string, PairMatrixRow>();

    for (const e of this.allEvaluations) {
      const pair = `${e.baseToken.symbol}/${e.intermediateToken.symbol}`;
      const dexA = e.leg1.dex;
      const dexB = e.leg2.dex;
      const key = `${pair}|${dexA}|${dexB}`;

      let row = map.get(key);
      if (!row) {
        row = {
          pair,
          dexA,
          dexB,
          routes: 0,
          quotes: 0,
          failures: 0,
          candidates: 0,
        };
        map.set(key, row);
      }

      row.routes++;
      row.quotes += 2;
      if (e.status === 'ERROR') {
        row.failures += 2;
      }
      if (e.status === 'CANDIDATE') {
        row.candidates++;
      }
    }

    return Array.from(map.values());
  }

  /**
   * STEP 13 — PAIR PROFITABILITY MATRIX
   * Pair | Mean Gross BPS | Max Gross BPS | Mean Net BPS | Max Net BPS | Candidates
   */
  generatePairProfitabilityMatrix(): PairProfitabilityMatrixRow[] {
    const map = new Map<string, { grossBps: number[]; netBps: number[]; candidates: number }>();

    for (const e of this.allEvaluations) {
      if (e.status === 'ERROR') continue;
      const pair = `${e.baseToken.symbol}/${e.intermediateToken.symbol}`;
      let data = map.get(pair);
      if (!data) {
        data = { grossBps: [], netBps: [], candidates: 0 };
        map.set(pair, data);
      }
      data.grossBps.push(e.grossSpreadBps);
      data.netBps.push(e.netProfitBps);
      if (e.status === 'CANDIDATE') {
        data.candidates++;
      }
    }

    const results: PairProfitabilityMatrixRow[] = [];
    for (const [pair, data] of map.entries()) {
      const meanGross = data.grossBps.reduce((a, b) => a + b, 0) / (data.grossBps.length || 1);
      const maxGross = data.grossBps.length ? Math.max(...data.grossBps) : 0;
      const meanNet = data.netBps.reduce((a, b) => a + b, 0) / (data.netBps.length || 1);
      const maxNet = data.netBps.length ? Math.max(...data.netBps) : 0;

      results.push({
        pair,
        meanGrossBps: Math.round(meanGross * 100) / 100,
        maxGrossBps: Math.round(maxGross * 100) / 100,
        meanNetBps: Math.round(meanNet * 100) / 100,
        maxNetBps: Math.round(maxNet * 100) / 100,
        candidates: data.candidates,
      });
    }

    return results;
  }

  /**
   * STEP 13 — DEX MATRIX
   * DEX A | DEX B | Routes | Opportunities | Quote failures
   */
  generateDexMatrix(): DexMatrixRow[] {
    const map = new Map<string, DexMatrixRow>();

    for (const e of this.allEvaluations) {
      const dexA = e.leg1.dex;
      const dexB = e.leg2.dex;
      const key = `${dexA}|${dexB}`;

      let row = map.get(key);
      if (!row) {
        row = {
          dexA,
          dexB,
          routes: 0,
          opportunities: 0,
          quoteFailures: 0,
        };
        map.set(key, row);
      }

      row.routes++;
      if (e.status === 'CANDIDATE') {
        row.opportunities++;
      }
      if (e.status === 'ERROR') {
        row.quoteFailures++;
      }
    }

    return Array.from(map.values());
  }
}
