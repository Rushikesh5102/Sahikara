/**
 * SAHIKARA — Phase 4.8 Opportunity Event Timeline
 *
 * Models the complete lifecycle of a market-state-changing event from on-chain block creation
 * through local observation, detection, quoting, and economic evaluation.
 *
 * CRITICAL INVARIANT:
 * These latency metrics are observation, detection, quoting, and evaluation latencies.
 * Under NO circumstances may these be labeled "execution latency".
 * SAHIKARA has NO execution engine active, NO transaction dispatcher, and ₹0.00 capital at risk.
 */

export interface EventTimelineRawData {
  eventBlock: bigint;
  txHash: `0x${string}` | string;
  logIndex: number;
  poolAddress: `0x${string}` | string;
  tokenPair: string; // e.g. "WETH/USDC"
  eventType: 'Swap' | 'Sync' | 'Mint' | 'Burn';
  blockTimestampMs: number;
  localObservationTimestampMs: number;
  detectionTimestampMs: number;
  quoteStartTimestampMs: number;
  quoteCompletionTimestampMs: number;
  evaluationCompletionTimestampMs: number;
}

export interface CalculatedEventLatencies {
  blockToObservationMs: number;
  observationToDetectionMs: number;
  detectionToQuoteMs: number;
  quoteDurationMs: number;
  quoteToEvaluationMs: number;
  totalDetectionToEvaluationMs: number;
}

export interface OpportunityEventTimelineRecord extends EventTimelineRawData {
  timelineId: string;
  latencies: CalculatedEventLatencies;
  provenance: {
    recordedAtMs: number;
    clockSource: 'performance.now' | 'Date.now';
    disclaimer: 'MEASUREMENT_ONLY_NO_EXECUTION';
  };
}

export class OpportunityEventTimeline {
  /**
   * Computes granular non-execution latencies for an event lifecycle.
   */
  public static calculateLatencies(raw: EventTimelineRawData): CalculatedEventLatencies {
    // Invariants: monotonically forward-progressing timestamps where valid
    const blockToObservationMs = Math.max(0, raw.localObservationTimestampMs - raw.blockTimestampMs);
    const observationToDetectionMs = Math.max(0, raw.detectionTimestampMs - raw.localObservationTimestampMs);
    const detectionToQuoteMs = Math.max(0, raw.quoteStartTimestampMs - raw.detectionTimestampMs);
    const quoteDurationMs = Math.max(0, raw.quoteCompletionTimestampMs - raw.quoteStartTimestampMs);
    const quoteToEvaluationMs = Math.max(0, raw.evaluationCompletionTimestampMs - raw.quoteCompletionTimestampMs);
    const totalDetectionToEvaluationMs = Math.max(0, raw.evaluationCompletionTimestampMs - raw.detectionTimestampMs);

    return {
      blockToObservationMs,
      observationToDetectionMs,
      detectionToQuoteMs,
      quoteDurationMs,
      quoteToEvaluationMs,
      totalDetectionToEvaluationMs,
    };
  }

  /**
   * Creates a complete timeline record with validated latencies and provenance.
   */
  public static createRecord(raw: EventTimelineRawData): OpportunityEventTimelineRecord {
    const latencies = this.calculateLatencies(raw);
    const timelineId = `timeline:${raw.eventBlock}:${raw.txHash}:${raw.logIndex}`;

    return {
      ...raw,
      timelineId,
      latencies,
      provenance: {
        recordedAtMs: Date.now(),
        clockSource: 'Date.now',
        disclaimer: 'MEASUREMENT_ONLY_NO_EXECUTION',
      },
    };
  }

  /**
   * Aggregates latency statistics across multiple timeline records.
   */
  public static summarize(records: OpportunityEventTimelineRecord[]): {
    count: number;
    avgBlockToObservationMs: number;
    avgObservationToDetectionMs: number;
    avgDetectionToQuoteMs: number;
    avgQuoteDurationMs: number;
    avgQuoteToEvaluationMs: number;
    avgTotalDetectionToEvaluationMs: number;
    minTotalMs: number;
    maxTotalMs: number;
  } {
    if (records.length === 0) {
      return {
        count: 0,
        avgBlockToObservationMs: 0,
        avgObservationToDetectionMs: 0,
        avgDetectionToQuoteMs: 0,
        avgQuoteDurationMs: 0,
        avgQuoteToEvaluationMs: 0,
        avgTotalDetectionToEvaluationMs: 0,
        minTotalMs: 0,
        maxTotalMs: 0,
      };
    }

    let sumB2O = 0;
    let sumO2D = 0;
    let sumD2Q = 0;
    let sumQD = 0;
    let sumQ2E = 0;
    let sumTot = 0;
    let minTot = Infinity;
    let maxTot = -Infinity;

    for (const r of records) {
      const l = r.latencies;
      sumB2O += l.blockToObservationMs;
      sumO2D += l.observationToDetectionMs;
      sumD2Q += l.detectionToQuoteMs;
      sumQD += l.quoteDurationMs;
      sumQ2E += l.quoteToEvaluationMs;
      sumTot += l.totalDetectionToEvaluationMs;
      if (l.totalDetectionToEvaluationMs < minTot) minTot = l.totalDetectionToEvaluationMs;
      if (l.totalDetectionToEvaluationMs > maxTot) maxTot = l.totalDetectionToEvaluationMs;
    }

    const n = records.length;
    return {
      count: n,
      avgBlockToObservationMs: Number((sumB2O / n).toFixed(2)),
      avgObservationToDetectionMs: Number((sumO2D / n).toFixed(2)),
      avgDetectionToQuoteMs: Number((sumD2Q / n).toFixed(2)),
      avgQuoteDurationMs: Number((sumQD / n).toFixed(2)),
      avgQuoteToEvaluationMs: Number((sumQ2E / n).toFixed(2)),
      avgTotalDetectionToEvaluationMs: Number((sumTot / n).toFixed(2)),
      minTotalMs: minTot === Infinity ? 0 : minTot,
      maxTotalMs: maxTot === -Infinity ? 0 : maxTot,
    };
  }
}
