/**
 * SAHIKARA Phase 3 — Trade Size Optimizer
 *
 * Sweeps candidate trade sizes across:
 *   [$1, $5, $10, $25, $50, $100, $250, $500]
 *
 * Identifies the concave net profit curve:
 *   - At small sizes (Q < $10): Fixed gas costs dominate, causing net loss even on wide gross spreads.
 *   - At medium sizes ($10 <= Q <= $100): Fixed gas is amortized, reaching peak net profitability (Q*).
 *   - At large sizes (Q > $100): Slippage and price impact grow non-linearly, eroding gross spread and causing reverts.
 */

import type {
  TradeSizePoint,
  TradeSizeOptimizationResult,
} from './types.js';
import { AtomicExecutionSimulator, type SimulateAtomicParams } from './AtomicExecutionSimulator.js';

export interface SweepParams {
  routeId: string;
  routeName: string;
  chain: string;
  blockNumber: bigint;
  baseFeeWei: bigint;
  ethPriceUsd: number;
  baseTokenPriceUsd: number;
  baseTokenDecimals: number;

  poolLeg1Address: string;
  dexLeg1: string;
  leg1FeeBps: number;

  poolLeg2Address: string;
  dexLeg2: string;
  leg2FeeBps: number;

  /** Reference micro-size quotes ($1 reference) */
  microQuoteLeg1Out: bigint;
  microQuoteLeg2Out: bigint;

  /** Trade sizes to sweep in USD */
  sweepSizesUsd?: number[];

  /** Optional function to query live executable quotes for each size */
  quoteFetcher?: (sizeUsd: number, amountInWei: bigint) => Promise<{
    leg1Out: bigint;
    leg2Out: bigint;
    latencyMs: number;
  }>;
}

export class TradeSizeOptimizer {
  public static readonly DEFAULT_SWEEP_SIZES_USD = [1, 5, 10, 25, 50, 100, 250, 500];

  /**
   * Sweeps trade sizes across candidate amounts and determines the optimal allocation Q*.
   */
  public static async optimizeTradeSize(params: SweepParams): Promise<TradeSizeOptimizationResult> {
    const sweepSizesUsd = params.sweepSizesUsd ?? this.DEFAULT_SWEEP_SIZES_USD;
    const baseTokenUnit = Math.pow(10, params.baseTokenDecimals);

    const testedSizes: TradeSizePoint[] = [];
    let optimalSizeUsd: number | null = null;
    let maxNetPnLUsd = -Infinity;
    let breakEvenSizeUsd: number | null = null;

    let hasNegativeGrossSpread = true;
    let sawGasDominance = false;
    let sawSlippageDominance = false;
    let sawLiquidityExhaustion = false;

    for (const sizeUsd of sweepSizesUsd) {
      const initialAmountTokens = params.baseTokenPriceUsd > 0
        ? sizeUsd / params.baseTokenPriceUsd
        : 0;
      const initialAmountWei = BigInt(Math.round(initialAmountTokens * baseTokenUnit));

      if (initialAmountWei <= 0n) continue;

      let leg1Out: bigint;
      let leg2Out: bigint;
      let latencyMs = 15;

      if (params.quoteFetcher) {
        try {
          const fetched = await params.quoteFetcher(sizeUsd, initialAmountWei);
          leg1Out = fetched.leg1Out;
          leg2Out = fetched.leg2Out;
          latencyMs = fetched.latencyMs;
        } catch {
          leg1Out = 0n;
          leg2Out = 0n;
        }
      } else {
        // Analytical liquidity scaling model:
        // Scaled quote based on micro reference quote with convex price impact
        const scaleFactor = Number(sizeUsd);
        const baseOutLeg1 = (params.microQuoteLeg1Out * BigInt(Math.round(scaleFactor * 1000))) / 1000n;

        // Quadratic slippage penalty: sizeUsd / 10,000 as basis point impact
        const slippageBpsLeg1 = Math.min(500, Math.round(Math.pow(sizeUsd / 20, 1.3)));
        leg1Out = (baseOutLeg1 * BigInt(10_000 - slippageBpsLeg1)) / 10_000n;

        const baseOutLeg2 = (params.microQuoteLeg2Out * BigInt(Math.round(scaleFactor * 1000))) / 1000n;
        const slippageBpsLeg2 = Math.min(500, Math.round(Math.pow(sizeUsd / 20, 1.3)));
        leg2Out = (baseOutLeg2 * BigInt(10_000 - slippageBpsLeg2)) / 10_000n;
      }

      const simParams: SimulateAtomicParams = {
        routeId: params.routeId,
        routeName: params.routeName,
        chain: params.chain,
        blockNumber: params.blockNumber,
        timestampMs: Date.now(),
        tradeSizeUsd: sizeUsd,
        initialAmount: initialAmountWei,
        poolLeg1Address: params.poolLeg1Address,
        dexLeg1: params.dexLeg1,
        leg1QuoteOutput: leg1Out,
        leg1QuoterLatencyMs: latencyMs,
        leg1FeeBps: params.leg1FeeBps,
        poolLeg2Address: params.poolLeg2Address,
        dexLeg2: params.dexLeg2,
        leg2QuoteOutput: leg2Out,
        leg2QuoterLatencyMs: latencyMs,
        leg2FeeBps: params.leg2FeeBps,
        baseFeeWei: params.baseFeeWei,
        ethPriceUsd: params.ethPriceUsd,
        baseTokenPriceUsd: params.baseTokenPriceUsd,
        baseTokenDecimals: params.baseTokenDecimals,
      };

      const simResult = AtomicExecutionSimulator.simulate(simParams);

      const point: TradeSizePoint = {
        tradeSizeUsd: sizeUsd,
        initialAmount: initialAmountWei,
        grossSpreadBps: simResult.simulated.grossSpreadBps,
        totalPriceImpactBps: simResult.simulated.totalPriceImpactBps,
        gasCostUsd: simResult.estimates.gasCostUsd,
        netPnLUsd: simResult.simulated.netPnLUsd,
        netProfitBps: simResult.simulated.netProfitBps,
        isProfitable: simResult.simulated.isProfitableCandidate,
        reverted: simResult.simulated.reverted,
        revertReason: simResult.simulated.revertReason,
      };

      testedSizes.push(point);

      if (point.grossSpreadBps > 0) {
        hasNegativeGrossSpread = false;
      }

      if (point.grossSpreadBps > 0 && point.netPnLUsd < 0 && !point.reverted) {
        sawGasDominance = true;
      }

      if (point.revertReason === 'SLIPPAGE_EXCEEDED_LEG1' || point.revertReason === 'SLIPPAGE_EXCEEDED_LEG2') {
        sawSlippageDominance = true;
      }

      if (point.revertReason === 'INSUFFICIENT_LIQUIDITY_LEG1' || point.revertReason === 'INSUFFICIENT_LIQUIDITY_LEG2') {
        sawLiquidityExhaustion = true;
      }

      if (point.isProfitable && breakEvenSizeUsd === null) {
        breakEvenSizeUsd = sizeUsd;
      }

      if (point.netPnLUsd > maxNetPnLUsd) {
        maxNetPnLUsd = point.netPnLUsd;
        optimalSizeUsd = sizeUsd;
      }
    }

    // Determine dominant constraint
    let dominantConstraint: TradeSizeOptimizationResult['dominantConstraint'] = 'NEGATIVE_GROSS_SPREAD';
    if (sawLiquidityExhaustion) {
      dominantConstraint = 'LIQUIDITY_EXHAUSTION';
    } else if (sawSlippageDominance) {
      dominantConstraint = 'SLIPPAGE_CONVEXITY';
    } else if (sawGasDominance) {
      dominantConstraint = 'FIXED_GAS_OVERHEAD';
    } else if (!hasNegativeGrossSpread) {
      dominantConstraint = 'SLIPPAGE_CONVEXITY';
    }

    const summary = optimalSizeUsd !== null && maxNetPnLUsd > 0
      ? `Optimal trade size Q* = $${optimalSizeUsd} yielding max Net PnL $${maxNetPnLUsd.toFixed(4)}. Break-even size = $${breakEvenSizeUsd ?? 'N/A'}.`
      : `No profitable trade size found across swept range [$${sweepSizesUsd[0]}–$${sweepSizesUsd[sweepSizesUsd.length - 1]}]. Dominant bottleneck: ${dominantConstraint}.`;

    return {
      routeId: params.routeId,
      routeName: params.routeName,
      blockNumber: params.blockNumber,
      testedSizes,
      optimalSizeUsd: maxNetPnLUsd > 0 ? optimalSizeUsd : null,
      maxNetPnLUsd: Number(maxNetPnLUsd.toFixed(4)),
      breakEvenSizeUsd,
      dominantConstraint,
      summary,
    };
  }
}
