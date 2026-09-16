/**
 * SAHIKARA — Phase 4.8 Multi-Size Persistence & Depth Profiler
 *
 * Evaluates opportunity scalability across the 9 canonical research size tiers:
 *   [$1, $5, $10, $25, $50, $100, $250, $500, $1,000]
 *
 * Invariants:
 * - Zero interpolation between discrete trade sizes without empirical quote evidence.
 * - Minimum profitable size is the lowest evaluated size where net USD profit > 0.
 * - Maximum profitable size is the highest evaluated size where net USD profit > 0.
 * - Optimal observed size is the size producing the highest net USD profit.
 */

export const CANONICAL_RESEARCH_SIZES_USD = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;
export type ResearchSizeUsd = (typeof CANONICAL_RESEARCH_SIZES_USD)[number];

export interface SizeQuoteEvaluation {
  sizeUsd: number;
  grossSpreadBps: number;
  netProfitBps: number;
  netProfitUsd: number;
  priceImpactBps: number;
  gasCostUsd: number;
  isProfitable: boolean;
  status: 'SUCCESS' | 'PRICE_IMPACT_EXCEEDED' | 'LIQUIDITY_EXHAUSTED' | 'QUOTE_FAILED';
}

export interface MultiSizeProfile {
  routeId: string;
  chain: string;
  blockNumber: bigint;
  evaluations: SizeQuoteEvaluation[];
  minProfitableSizeUsd: number | null;
  maxProfitableSizeUsd: number | null;
  optimalObservedSizeUsd: number | null;
  maxObservedNetProfitUsd: number;
  liquidityCeilingUsd: number | null;
  priceImpactCurve: Array<{ sizeUsd: number; priceImpactBps: number }>;
  scalabilityVerdict: 'SCALABLE' | 'SUB_GAS_MICRO_SPREAD' | 'LIQUIDITY_CONSTRAINED' | 'UNPROFITABLE';
}

export class MultiSizePersistence {
  /**
   * Constructs a multi-size scalability profile from empirical size evaluations.
   */
  public static profileSizes(params: {
    routeId: string;
    chain: string;
    blockNumber: bigint;
    evaluations: SizeQuoteEvaluation[];
    maxAcceptablePriceImpactBps?: number;
  }): MultiSizeProfile {
    const { routeId, chain, blockNumber, evaluations, maxAcceptablePriceImpactBps = 50.0 } = params;

    const priceImpactCurve: Array<{ sizeUsd: number; priceImpactBps: number }> = [];
    let minProfitableSizeUsd: number | null = null;
    let maxProfitableSizeUsd: number | null = null;
    let optimalObservedSizeUsd: number | null = null;
    let maxObservedNetProfitUsd = -Infinity;
    let liquidityCeilingUsd: number | null = null;

    // Sort by trade size ascending
    const sorted = [...evaluations].sort((a, b) => a.sizeUsd - b.sizeUsd);

    for (const ev of sorted) {
      priceImpactCurve.push({ sizeUsd: ev.sizeUsd, priceImpactBps: ev.priceImpactBps });

      if (ev.status === 'LIQUIDITY_EXHAUSTED' || ev.priceImpactBps > maxAcceptablePriceImpactBps) {
        if (liquidityCeilingUsd === null) {
          liquidityCeilingUsd = ev.sizeUsd;
        }
      }

      if (ev.isProfitable && ev.netProfitUsd > 0) {
        if (minProfitableSizeUsd === null) {
          minProfitableSizeUsd = ev.sizeUsd;
        }
        maxProfitableSizeUsd = ev.sizeUsd;

        if (ev.netProfitUsd > maxObservedNetProfitUsd) {
          maxObservedNetProfitUsd = ev.netProfitUsd;
          optimalObservedSizeUsd = ev.sizeUsd;
        }
      }
    }

    if (maxObservedNetProfitUsd === -Infinity) {
      maxObservedNetProfitUsd = 0;
    }

    // Determine scalability verdict
    let scalabilityVerdict: MultiSizeProfile['scalabilityVerdict'] = 'UNPROFITABLE';
    if (minProfitableSizeUsd !== null) {
      if (maxProfitableSizeUsd !== null && maxProfitableSizeUsd >= 100) {
        scalabilityVerdict = 'SCALABLE';
      } else if (maxProfitableSizeUsd !== null && maxProfitableSizeUsd <= 5) {
        scalabilityVerdict = 'SUB_GAS_MICRO_SPREAD';
      } else {
        scalabilityVerdict = 'LIQUIDITY_CONSTRAINED';
      }
    }

    return {
      routeId,
      chain,
      blockNumber,
      evaluations: sorted,
      minProfitableSizeUsd,
      maxProfitableSizeUsd,
      optimalObservedSizeUsd,
      maxObservedNetProfitUsd,
      liquidityCeilingUsd,
      priceImpactCurve,
      scalabilityVerdict,
    };
  }
}
