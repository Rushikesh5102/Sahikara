/**
 * SAHIKARA — Phase 4.8 Opportunity Quality Metrics
 *
 * Exposes pure, unweighted, independent measurable dimensions of an observed route.
 *
 * CRITICAL DIRECTIVE:
 * DO NOT create a composite "profitability score", weighted index, or political ranking.
 * Arbitrage execution viability is a high-dimensional physical reality:
 * an opportunity with high gross spread but high gas or high price impact cannot be
 * flattened into a scalar score without obscuring failure modes.
 * Expose strictly independent measurements.
 */

export interface OpportunityQualityDimensions {
  routeId: string;
  chain: string;
  // 12 Independent Measurable Fields
  grossBps: number;
  netBps: number;
  liquidity: bigint | string;
  priceImpactBps: number;
  gasUsd: number;
  quoteAgeMs: number;
  observedDurationMs: number;
  requoteCount: number;
  routeLegs: number;
  feeBps: number;
  failureRate: number; // Ratio of failed quotes to total attempts on this route
  stateConfidence: 'CONFIRMED_ON_CHAIN' | 'PROVISIONAL_SIMULATION' | 'STALE_STATE';
}

export class OpportunityQualityMetrics {
  /**
   * Constructs an unweighted measurement tuple without computing any composite score.
   */
  public static measure(params: OpportunityQualityDimensions): OpportunityQualityDimensions {
    // Invariant: Verify that all numerical measurements are well-formed (non-NaN, finite)
    if (!Number.isFinite(params.grossBps)) throw new Error('grossBps must be finite');
    if (!Number.isFinite(params.netBps)) throw new Error('netBps must be finite');
    if (!Number.isFinite(params.priceImpactBps)) throw new Error('priceImpactBps must be finite');
    if (!Number.isFinite(params.gasUsd)) throw new Error('gasUsd must be finite');
    if (!Number.isFinite(params.quoteAgeMs)) throw new Error('quoteAgeMs must be finite');
    if (!Number.isFinite(params.observedDurationMs)) throw new Error('observedDurationMs must be finite');
    if (!Number.isFinite(params.requoteCount)) throw new Error('requoteCount must be finite');
    if (!Number.isFinite(params.routeLegs)) throw new Error('routeLegs must be finite');
    if (!Number.isFinite(params.feeBps)) throw new Error('feeBps must be finite');
    if (!Number.isFinite(params.failureRate)) throw new Error('failureRate must be finite');

    return {
      routeId: params.routeId,
      chain: params.chain,
      grossBps: Number(params.grossBps.toFixed(4)),
      netBps: Number(params.netBps.toFixed(4)),
      liquidity: typeof params.liquidity === 'bigint' ? params.liquidity.toString() : params.liquidity,
      priceImpactBps: Number(params.priceImpactBps.toFixed(4)),
      gasUsd: Number(params.gasUsd.toFixed(6)),
      quoteAgeMs: Math.max(0, params.quoteAgeMs),
      observedDurationMs: Math.max(0, params.observedDurationMs),
      requoteCount: Math.max(0, params.requoteCount),
      routeLegs: Math.max(2, params.routeLegs),
      feeBps: Math.max(0, params.feeBps),
      failureRate: Math.min(1.0, Math.max(0.0, Number(params.failureRate.toFixed(4)))),
      stateConfidence: params.stateConfidence,
    };
  }
}
