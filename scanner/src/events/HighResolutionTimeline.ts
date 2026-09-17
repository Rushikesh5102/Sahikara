/**
 * SAHIKARA — Phase 4.13A High Resolution Monotonic Timeline
 *
 * Implements high-resolution nanosecond/microsecond precision timing
 * using process.hrtime.bigint() and performance.now().
 *
 * CRITICAL INVARIANT:
 * Strictly distinguishes:
 *   1. Network RPC Latency: Time for HTTP/WS round-trip.
 *   2. Observation / Detection Latency: Time from block header creation / event emission to arrival in engine.
 *   3. Economic Evaluation Latency: Time from local event receipt to completed quote and profit calculation.
 *
 * Capital at risk: ₹0.00 / $0.00 | Execution strictly LOCKED.
 */

export interface HighResolutionEventRecord {
  timelineId: string;
  chainId: number;
  blockNumber: bigint;
  blockHash?: string;
  txHash?: string;
  transactionIndex?: number;
  logIndex?: number;
  eventType: 'Swap' | 'Sync' | 'Mint' | 'Burn' | 'BLOCK';
  poolAddress: string;
  routeIds: string[];
  blockTimestampMs: number;
  
  // High-resolution monotonic nanosecond timestamps (relative to process start)
  eventReceiveNs: bigint;
  decodeNs: bigint;
  routeLookupNs: bigint;
  quoteStartNs: bigint;
  quoteEndNs: bigint;
  evaluationEndNs: bigint;
  requoteNs?: bigint;

  // Calculated latencies in milliseconds (floating-point precision)
  networkRpcLatencyMs: number;
  observationLatencyMs: number;
  eventToDetectionLatencyMs: number;
  detectionToQuoteLatencyMs: number;
  quoteDurationMs: number;
  evaluationLatencyMs: number;
  totalEventToResultLatencyMs: number;

  // Economic results if triggered
  grossSpreadBps?: number;
  netExpectedProfitUsd?: number;
  candidateStatus?: 'NOMINAL' | 'ANOMALY_QUARANTINED' | 'REJECTED' | 'REVALIDATED';
}

export class HighResolutionTimeline {
  /**
   * Captures the current monotonic timestamp in nanoseconds.
   */
  public static nowNs(): bigint {
    return process.hrtime.bigint();
  }

  /**
   * Converts nanosecond delta to milliseconds (float).
   */
  public static deltaMs(startNs: bigint, endNs: bigint): number {
    const diffNs = endNs - startNs;
    return Number(diffNs) / 1_000_000;
  }

  /**
   * Builds a structured HighResolutionEventRecord calculating all distinct latency components.
   */
  public static buildRecord(params: {
    chainId: number;
    blockNumber: bigint;
    blockHash?: string;
    txHash?: string;
    transactionIndex?: number;
    logIndex?: number;
    eventType: 'Swap' | 'Sync' | 'Mint' | 'Burn' | 'BLOCK';
    poolAddress: string;
    routeIds: string[];
    blockTimestampMs: number;
    localReceiveTimestampMs: number;
    networkRpcLatencyMs: number;
    eventReceiveNs: bigint;
    decodeNs: bigint;
    routeLookupNs: bigint;
    quoteStartNs: bigint;
    quoteEndNs: bigint;
    evaluationEndNs: bigint;
    requoteNs?: bigint;
    grossSpreadBps?: number;
    netExpectedProfitUsd?: number;
    candidateStatus?: 'NOMINAL' | 'ANOMALY_QUARANTINED' | 'REJECTED' | 'REVALIDATED';
  }): HighResolutionEventRecord {
    const observationLatencyMs = Math.max(0, params.localReceiveTimestampMs - params.blockTimestampMs);
    const eventToDetectionLatencyMs = HighResolutionTimeline.deltaMs(params.eventReceiveNs, params.decodeNs);
    const detectionToQuoteLatencyMs = HighResolutionTimeline.deltaMs(params.decodeNs, params.quoteStartNs);
    const quoteDurationMs = HighResolutionTimeline.deltaMs(params.quoteStartNs, params.quoteEndNs);
    const evaluationLatencyMs = HighResolutionTimeline.deltaMs(params.quoteEndNs, params.evaluationEndNs);
    const totalEventToResultLatencyMs = HighResolutionTimeline.deltaMs(params.eventReceiveNs, params.evaluationEndNs);

    const timelineId = `time:${params.chainId}:${params.blockNumber}:${params.txHash ?? 'none'}:${params.logIndex ?? 0}`;

    return {
      timelineId,
      chainId: params.chainId,
      blockNumber: params.blockNumber,
      blockHash: params.blockHash,
      txHash: params.txHash,
      transactionIndex: params.transactionIndex,
      logIndex: params.logIndex,
      eventType: params.eventType,
      poolAddress: params.poolAddress,
      routeIds: params.routeIds,
      blockTimestampMs: params.blockTimestampMs,
      eventReceiveNs: params.eventReceiveNs,
      decodeNs: params.decodeNs,
      routeLookupNs: params.routeLookupNs,
      quoteStartNs: params.quoteStartNs,
      quoteEndNs: params.quoteEndNs,
      evaluationEndNs: params.evaluationEndNs,
      requoteNs: params.requoteNs,
      networkRpcLatencyMs: params.networkRpcLatencyMs,
      observationLatencyMs,
      eventToDetectionLatencyMs,
      detectionToQuoteLatencyMs,
      quoteDurationMs,
      evaluationLatencyMs,
      totalEventToResultLatencyMs,
      grossSpreadBps: params.grossSpreadBps,
      netExpectedProfitUsd: params.netExpectedProfitUsd,
      candidateStatus: params.candidateStatus ?? 'NOMINAL',
    };
  }
}
