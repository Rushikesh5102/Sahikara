/**
 * SAHIKARA Phase 2 — Selective Event-Driven Route Dispatcher
 *
 * Inverts the route topology to map individual liquidity pools directly
 * to their dependent cross-DEX arbitrage routes:
 *
 *   Pool State Event (Swap / Sync)
 *               ↓
 *      Inverted Pool Index
 *               ↓
 *     Affected Routes ONLY (e.g. 6 of 26 routes)
 *               ↓
 *   Block-Pinned Quoting & Multicall3
 *               ↓
 *     Atomic Round-Trip Evaluation
 *               ↓
 *    Deterministic Classification
 *               ↓
 *   Candidate Persistence & Latency Tracking
 *
 * Latency optimization:
 * Rather than polling all routes sequentially (~50s), event-driven dispatch
 * re-quotes only affected pools within sub-second detection windows.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry. Zero private keys, zero wallet signing, zero live trading.
 */

import type { IDataSource } from '../data-sources/IDataSource.js';
import type { ObservationStore, CandidateRecord } from '../storage/ObservationStore.js';
import {
  evaluateRoundTrip,
  type RoundTripRouteDef,
  type RoundTripEvaluation,
} from '../economics/roundTripEvaluator.js';
import type { Multicall3Batcher } from '../rpc/Multicall3Batcher.js';
import type {
  PoolStateChangeEvent,
  EventDispatcherResult,
} from './EventTypes.js';

export interface EventRouteDispatcherOptions {
  routes: RoundTripRouteDef[];
  dataSource: IDataSource;
  store: ObservationStore;
  researchSizesUsd?: number[];
  ethPriceUsd?: number;
  minNetProfitUsd?: number;
  riskBufferFraction?: number;
  maxPriceImpactBps?: number;
  multicallBatcher?: Multicall3Batcher;
  onCandidateDetected?: (candidate: CandidateRecord) => void;
}

export class EventRouteDispatcher {
  private readonly routes: RoundTripRouteDef[];
  private readonly dataSource: IDataSource;
  private readonly store: ObservationStore;
  private readonly researchSizesUsd: number[];
  private readonly ethPriceUsd: number;
  private readonly minNetProfitUsd: number;
  private readonly riskBufferFraction: number;
  private readonly maxPriceImpactBps: number;
  private readonly multicallBatcher?: Multicall3Batcher;
  private readonly onCandidateDetected?: (candidate: CandidateRecord) => void;

  // Inverted Pool Index: poolAddress -> affected routes
  private readonly routesByPool = new Map<string, RoundTripRouteDef[]>();

  constructor(options: EventRouteDispatcherOptions) {
    this.routes = options.routes;
    this.dataSource = options.dataSource;
    this.store = options.store;
    this.researchSizesUsd = options.researchSizesUsd ?? [1, 5, 10];
    this.ethPriceUsd = options.ethPriceUsd ?? 2600.0;
    this.minNetProfitUsd = options.minNetProfitUsd ?? 0.05;
    this.riskBufferFraction = options.riskBufferFraction ?? 0.001;
    this.maxPriceImpactBps = options.maxPriceImpactBps ?? 100;
    this.multicallBatcher = options.multicallBatcher;
    this.onCandidateDetected = options.onCandidateDetected;

    this.buildPoolIndex();
  }

  /**
   * Index all routes by both leg1 and leg2 pool addresses.
   */
  private buildPoolIndex(): void {
    for (const route of this.routes) {
      const p1 = route.leg1.pool.poolAddress.toLowerCase();
      const p2 = route.leg2.pool.poolAddress.toLowerCase();

      if (!this.routesByPool.has(p1)) {
        this.routesByPool.set(p1, []);
      }
      this.routesByPool.get(p1)!.push(route);

      if (!this.routesByPool.has(p2)) {
        this.routesByPool.set(p2, []);
      }
      // Only push if not already present (self-loop prevention)
      if (p1 !== p2) {
        this.routesByPool.get(p2)!.push(route);
      }
    }
  }

  /**
   * Get all registered routes affected by a given pool address.
   */
  getAffectedRoutes(poolAddress: string): RoundTripRouteDef[] {
    return this.routesByPool.get(poolAddress.toLowerCase()) ?? [];
  }

  getMulticallBatcher(): Multicall3Batcher | undefined {
    return this.multicallBatcher;
  }

  /**
   * Approximate token USD price for trade size scaling.
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
   * Dispatch an incoming pool state event to all affected routes.
   */
  async dispatchEvent(event: PoolStateChangeEvent): Promise<EventDispatcherResult> {
    const startDispatch = performance.now();
    let targetRoutes: RoundTripRouteDef[];

    if (event.eventType === 'BLOCK') {
      // For block events, evaluate top high-conviction routes (e.g. WETH/USDC)
      targetRoutes = this.routes.slice(0, 4);
    } else {
      targetRoutes = this.getAffectedRoutes(event.poolAddress);
    }

    if (targetRoutes.length === 0) {
      const detectionLatencyMs = Math.round(performance.now() - startDispatch);
      return {
        event,
        affectedRoutesCount: 0,
        evaluations: [],
        detectionLatencyMs,
      };
    }

    // Query gas price once for this event dispatch
    const { gasPrice } = await this.dataSource.getGasPrice();
    const gasPriceWei = gasPrice.gasPriceWei;

    const evaluations: RoundTripEvaluation[] = [];

    // Evaluate each affected route pinned to the event's blockNumber
    for (const route of targetRoutes) {
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

        try {
          const evalResult = await evaluateRoundTrip({
            route,
            tradeSizeUsd,
            initialAmount,
            baseTokenPriceUsd,
            intermediateTokenPriceUsd,
            blockNumber: event.blockNumber,
            gasPriceWei,
            ethPriceUsd: this.ethPriceUsd,
            minNetProfitUsd: this.minNetProfitUsd,
            riskBufferFraction: this.riskBufferFraction,
            maxPriceImpactBps: this.maxPriceImpactBps,
          });

          // Persist round trip observation
          this.store.insertRoundTrip(evalResult);
          evaluations.push(evalResult);

          // If opportunity passes candidate criteria, persist to opportunity_candidates
          if (
            evalResult.status === 'CANDIDATE' ||
            evalResult.classification === 'POTENTIAL_CANDIDATE'
          ) {
            const endToEndLatencyMs = Math.round(Date.now() - event.receiptTimestampMs);
            const candidateRecord: CandidateRecord = {
              candidateId: [
                evalResult.chain,
                evalResult.routeId,
                evalResult.leg1.pool.poolAddress.toLowerCase(),
                evalResult.leg2.pool.poolAddress.toLowerCase(),
                event.blockNumber.toString(),
                tradeSizeUsd.toFixed(2),
                String(Date.now()),
              ].join(':'),
              timestampMs: evalResult.timestamp,
              blockNumber: event.blockNumber.toString(),
              route: evalResult.routeName,
              dexLeg1: evalResult.leg1.dex,
              dexLeg2: evalResult.leg2.dex,
              poolLeg1: evalResult.leg1.pool.poolAddress,
              poolLeg2: evalResult.leg2.pool.poolAddress,
              tokenIn: evalResult.baseToken.symbol,
              intermediateToken: evalResult.intermediateToken.symbol,
              tokenOut: evalResult.baseToken.symbol,
              amountIn: evalResult.initialAmount.toString(),
              leg1AmountOut: evalResult.leg1Output.toString(),
              leg2AmountOut: evalResult.leg2Output.toString(),
              grossProfit: evalResult.grossRoundTripDiff.toString(),
              grossProfitUsd: evalResult.grossProfitUsd,
              grossSpreadBps: evalResult.grossSpreadBps,
              gasEstimate: evalResult.gasEstimate.gasUnits,
              gasCostUsd: evalResult.gasCostUsd,
              netExpectedProfitUsd: evalResult.netExpectedProfitUsd,
              netProfitBps: evalResult.netProfitBps,
              priceImpactBps: evalResult.maxPriceImpactBps,
              detectionLatencyMs: endToEndLatencyMs,
              triggerEventType: event.eventType,
              triggerPoolAddress: event.poolAddress,
              rawDetailsJson: JSON.stringify({
                classification: evalResult.classification,
                poolFeesUsd: evalResult.poolFeesUsd,
                rejectionReason: evalResult.rejectionReason,
              }),
              createdAt: Date.now(),
            };

            this.store.insertCandidate(candidateRecord);
            this.onCandidateDetected?.(candidateRecord);
          }
        } catch {
          // Evaluation errors are captured safely
        }
      }
    }

    const detectionLatencyMs = Math.round(Date.now() - event.receiptTimestampMs);

    return {
      event,
      affectedRoutesCount: targetRoutes.length,
      evaluations,
      detectionLatencyMs,
    };
  }
}
