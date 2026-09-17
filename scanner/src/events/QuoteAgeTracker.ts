/**
 * SAHIKARA — Phase 4.13A Quote Age & Cross-Block Drift Trackers
 *
 * Implements:
 *   1. QuoteAgeTracker: measures freshness of individual leg quotes at decision time.
 *   2. CrossBlockDriftDetector: identifies when multi-leg quotes span different block heights.
 *
 * SAFETY:
 * Strictly read-only research modeling. Capital at risk: ₹0.00 / $0.00.
 */

export interface LegBlockState {
  legIndex: number;
  poolId: string;
  blockNumber: bigint;
  requestTimestampMs: number;
  responseTimestampMs: number;
}

export interface QuoteAgeEvaluation {
  maxAgeMs: number;
  minAgeMs: number;
  avgAgeMs: number;
  isStale: boolean;
  staleThresholdMs: number;
}

export interface CrossBlockDriftResult {
  hasDrift: boolean;
  minBlock: bigint;
  maxBlock: bigint;
  blockSpan: number;
  status: 'STABLE_SAME_BLOCK' | 'CROSS_BLOCK_DRIFT';
  reason?: string;
}

export class QuoteAgeTracker {
  private readonly staleThresholdMs: number;

  constructor(staleThresholdMs: number = 3000) {
    this.staleThresholdMs = staleThresholdMs;
  }

  /**
   * Computes age metrics for a set of leg responses at decision time.
   */
  public evaluateQuoteAge(legStates: LegBlockState[], decisionTimestampMs: number): QuoteAgeEvaluation {
    if (legStates.length === 0) {
      return { maxAgeMs: 0, minAgeMs: 0, avgAgeMs: 0, isStale: false, staleThresholdMs: this.staleThresholdMs };
    }

    const ages = legStates.map((s) => Math.max(0, decisionTimestampMs - s.responseTimestampMs));
    const maxAgeMs = Math.max(...ages);
    const minAgeMs = Math.min(...ages);
    const avgAgeMs = ages.reduce((a, b) => a + b, 0) / ages.length;
    const isStale = maxAgeMs > this.staleThresholdMs;

    return {
      maxAgeMs,
      minAgeMs,
      avgAgeMs,
      isStale,
      staleThresholdMs: this.staleThresholdMs,
    };
  }
}

export class CrossBlockDriftDetector {
  /**
   * Evaluates whether a multi-hop quote was composed from conflicting block heights.
   */
  public static detectDrift(legStates: LegBlockState[]): CrossBlockDriftResult {
    if (legStates.length <= 1) {
      const block = legStates[0]?.blockNumber ?? 0n;
      return {
        hasDrift: false,
        minBlock: block,
        maxBlock: block,
        blockSpan: 0,
        status: 'STABLE_SAME_BLOCK',
      };
    }

    let minBlock = legStates[0]!.blockNumber;
    let maxBlock = legStates[0]!.blockNumber;

    for (const leg of legStates) {
      if (leg.blockNumber < minBlock) minBlock = leg.blockNumber;
      if (leg.blockNumber > maxBlock) maxBlock = leg.blockNumber;
    }

    const hasDrift = minBlock !== maxBlock;
    const blockSpan = Number(maxBlock - minBlock);

    return {
      hasDrift,
      minBlock,
      maxBlock,
      blockSpan,
      status: hasDrift ? 'CROSS_BLOCK_DRIFT' : 'STABLE_SAME_BLOCK',
      reason: hasDrift
        ? `Leg quotes span ${blockSpan} block(s): min=${minBlock}, max=${maxBlock}`
        : undefined,
    };
  }
}
