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
 *   Research Candidate
 *
 * STRICT SEPARATION:
 *   Spot-price differences are NOT executable arbitrage profits.
 *   Only quotes evaluated by the economics engine determine candidate status.
 *   Zero live execution, zero wallet connection.
 */

import type { IDataSource } from '../data-sources/IDataSource.js';
import type { IPoolAdapter } from '../adapters/IPoolAdapter.js';
import type { PoolDefinition } from '../config/pools.js';
import type { ResearchPair } from '../config/pairs.js';
import type { RouteGenerator } from './RouteGenerator.js';
import type { ObservationStore } from '../storage/ObservationStore.js';
import {
  evaluateRoundTrip,
  type RoundTripEvaluation,
} from '../economics/roundTripEvaluator.js';

export interface MarketDiscoveryMetrics {
  poolsScanned: number;
  pairsScanned: number;
  routesGenerated: number;
  quotesAttempted: number;
  successfulQuotes: number;
  failedQuotes: number;
  roundTripsEvaluated: number;
  candidatesDetected: number;
  candidatesRejected: number;
  rejectionBreakdown: Record<string, number>;
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

  private metrics: MarketDiscoveryMetrics = {
    poolsScanned: 0,
    pairsScanned: 0,
    routesGenerated: 0,
    quotesAttempted: 0,
    successfulQuotes: 0,
    failedQuotes: 0,
    roundTripsEvaluated: 0,
    candidatesDetected: 0,
    candidatesRejected: 0,
    rejectionBreakdown: {},
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
    return { ...this.metrics };
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

    this.metrics.poolsScanned = this.pools.length;
    this.metrics.pairsScanned = activePairs.length;
    this.metrics.routesGenerated = routes.length;

    const evaluations: RoundTripEvaluation[] = [];

    // 3. Evaluate each route across configured research sizes
    for (const route of routes) {
      for (const tradeSizeUsd of this.researchSizesUsd) {
        // Calculate initial token amount
        // Base token price approximation:
        // If base token is WETH, use ethPriceUsd; if USDC, $1.00; otherwise estimate or $1.00
        const baseSymbol = route.leg1.tokenIn.symbol.toUpperCase();
        let baseTokenPriceUsd = 1.0;
        if (baseSymbol === 'WETH') {
          baseTokenPriceUsd = this.ethPriceUsd;
        } else if (baseSymbol === 'USDC' || baseSymbol === 'USDBC') {
          baseTokenPriceUsd = 1.0;
        } else if (baseSymbol === 'CBBTC') {
          baseTokenPriceUsd = 60_000.0; // Rough BTC reference for trade size scaling
        } else if (baseSymbol === 'AERO') {
          baseTokenPriceUsd = 1.0; // Rough reference
        }

        const intermediateSymbol = route.leg1.tokenOut.symbol.toUpperCase();
        let intermediateTokenPriceUsd = 1.0;
        if (intermediateSymbol === 'WETH') {
          intermediateTokenPriceUsd = this.ethPriceUsd;
        } else if (intermediateSymbol === 'USDC' || intermediateSymbol === 'USDBC') {
          intermediateTokenPriceUsd = 1.0;
        } else if (intermediateSymbol === 'CBBTC') {
          intermediateTokenPriceUsd = 60_000.0;
        }

        const decimals = route.leg1.tokenIn.decimals;
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
          }

          if (evalResult.status === 'CANDIDATE') {
            this.metrics.candidatesDetected++;
          } else {
            this.metrics.candidatesRejected++;
            const reason = evalResult.rejectionReason ?? 'OTHER';
            this.metrics.rejectionBreakdown[reason] =
              (this.metrics.rejectionBreakdown[reason] ?? 0) + 1;
          }

          // Persist observation idempotently
          this.store.insertRoundTrip(evalResult);
          evaluations.push(evalResult);
        } catch (err: unknown) {
          void err;
          this.metrics.failedQuotes += 2;
          this.metrics.candidatesRejected++;
          const reason = 'QUOTE_FAILED';
          this.metrics.rejectionBreakdown[reason] =
            (this.metrics.rejectionBreakdown[reason] ?? 0) + 1;
        }
      }
    }

    return {
      blockNumber,
      routesEvaluated: routes.length,
      evaluations,
    };
  }
}
