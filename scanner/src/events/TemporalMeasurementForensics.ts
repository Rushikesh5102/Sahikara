/**
 * SAHIKARA — Phase 4.13A.1 Temporal Measurement Forensics & Timing Pipeline
 *
 * Implements the rigorous T0–T11 event timeline model:
 *   T0:  Protocol-level block timestamp (PROTOCOL_TIME, uint256 seconds)
 *   T1:  Local HTTP request start (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T2:  Local HTTP response received (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T3:  Local block decoded (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T4:  WebSocket newHeads callback received (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T5:  WebSocket logs callback received (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T6:  Affected event decoded (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T7:  Route evaluation started (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T8:  Quote request started (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T9:  Quote response received (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T10: Economic evaluation completed (LOCAL_MONOTONIC_TIME, nanoseconds)
 *   T11: Independent requote completed where applicable (LOCAL_MONOTONIC_TIME, nanoseconds)
 *
 * NO SYNTHETIC VALUES:
 * Unavailable timestamps MUST be represented as null, never 0 or estimated constants.
 *
 * Capital at risk: ₹0.00 / $0.00 | Execution strictly LOCKED.
 */

import { ClockDomainManager } from './ClockDomainManager.js';
import type { PublicClient } from 'viem';

export interface TimingEventTimeline {
  timelineId: string;
  chainId: number;
  blockNumber: bigint;
  blockHash: string | null;

  // Protocol-level timestamp from block header (seconds)
  t0_protocolTimestamp: bigint | null;

  // Local monotonic timestamps (nanoseconds)
  t1_requestStartNs: bigint | null;
  t2_responseReceivedNs: bigint | null;
  t3_blockDecodedNs: bigint | null;
  t4_wsNewHeadsNs: bigint | null;
  t5_wsLogsNs: bigint | null;
  t6_eventDecodedNs: bigint | null;
  t7_routeEvaluationStartNs: bigint | null;
  t8_quoteStartNs: bigint | null;
  t9_quoteEndNs: bigint | null;
  t10_evaluationEndNs: bigint | null;
  t11_independentRequoteNs: bigint | null;

  // Diagnostic reference delta (NOT network latency)
  localWallTimestampMs: number;
  timestampReferenceDeltaMs: number | null;

  // Derived Monotonic Durations (milliseconds)
  httpRequestDurationMs: number | null;
  blockDecodeDurationMs: number | null;
  eventDecodeDurationMs: number | null;
  routeDispatchDurationMs: number | null;
  quoteDurationMs: number | null;
  evaluationDurationMs: number | null;
  totalLocalEventPipelineMs: number | null;
  wsVsHttpDifferenceMs: number | null;
}

export interface MetricDistribution {
  sampleSize: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export class TemporalMeasurementForensics {
  /**
   * Calculates percentile distribution from a list of numbers.
   */
  public static calculateDistribution(values: number[]): MetricDistribution {
    if (values.length === 0) {
      return {
        sampleSize: 0,
        min: 0,
        p25: 0,
        median: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        max: 0,
        mean: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const getP = (p: number): number => {
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
      return Number(sorted[idx].toFixed(3));
    };

    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = Number((sum / sorted.length).toFixed(3));

    return {
      sampleSize: sorted.length,
      min: Number(sorted[0].toFixed(3)),
      p25: getP(25),
      median: getP(50),
      p75: getP(75),
      p90: getP(90),
      p95: getP(95),
      p99: getP(99),
      max: Number(sorted[sorted.length - 1].toFixed(3)),
      mean,
    };
  }

  /**
   * Measures monotonic HTTP request duration for an arbitrary RPC call.
   */
  public static async measureRpcCall<T>(
    callFn: () => Promise<T>
  ): Promise<{ result: T; durationMs: number; startNs: bigint; endNs: bigint }> {
    const startNs = ClockDomainManager.nowMonotonicNs();
    const result = await callFn();
    const endNs = ClockDomainManager.nowMonotonicNs();
    const durationMs = ClockDomainManager.elapsedMonotonicMs(startNs, endNs);
    return { result, durationMs, startNs, endNs };
  }

  /**
   * Creates a strictly structured TimingEventTimeline record.
   */
  public static createTimelineRecord(params: {
    timelineId: string;
    chainId: number;
    blockNumber: bigint;
    blockHash: string | null;
    t0_protocolTimestamp: bigint | null;
    t1_requestStartNs?: bigint | null;
    t2_responseReceivedNs?: bigint | null;
    t3_blockDecodedNs?: bigint | null;
    t4_wsNewHeadsNs?: bigint | null;
    t5_wsLogsNs?: bigint | null;
    t6_eventDecodedNs?: bigint | null;
    t7_routeEvaluationStartNs?: bigint | null;
    t8_quoteStartNs?: bigint | null;
    t9_quoteEndNs?: bigint | null;
    t10_evaluationEndNs?: bigint | null;
    t11_independentRequoteNs?: bigint | null;
    localWallTimestampMs?: number;
  }): TimingEventTimeline {
    const wallMs = params.localWallTimestampMs ?? ClockDomainManager.nowWallClockMs();
    let timestampReferenceDeltaMs: number | null = null;
    if (params.t0_protocolTimestamp !== null) {
      const delta = ClockDomainManager.calculateReferenceDelta(wallMs, params.t0_protocolTimestamp);
      timestampReferenceDeltaMs = delta.deltaMs;
    }

    const t1 = params.t1_requestStartNs ?? null;
    const t2 = params.t2_responseReceivedNs ?? null;
    const t3 = params.t3_blockDecodedNs ?? null;
    const t4 = params.t4_wsNewHeadsNs ?? null;
    const t5 = params.t5_wsLogsNs ?? null;
    const t6 = params.t6_eventDecodedNs ?? null;
    const t7 = params.t7_routeEvaluationStartNs ?? null;
    const t8 = params.t8_quoteStartNs ?? null;
    const t9 = params.t9_quoteEndNs ?? null;
    const t10 = params.t10_evaluationEndNs ?? null;
    const t11 = params.t11_independentRequoteNs ?? null;

    const httpRequestDurationMs =
      t1 !== null && t2 !== null ? ClockDomainManager.elapsedMonotonicMs(t1, t2) : null;
    const blockDecodeDurationMs =
      t2 !== null && t3 !== null ? ClockDomainManager.elapsedMonotonicMs(t2, t3) : null;
    const eventDecodeDurationMs =
      t5 !== null && t6 !== null ? ClockDomainManager.elapsedMonotonicMs(t5, t6) : null;
    const routeDispatchDurationMs =
      t6 !== null && t7 !== null ? ClockDomainManager.elapsedMonotonicMs(t6, t7) : null;
    const quoteDurationMs =
      t8 !== null && t9 !== null ? ClockDomainManager.elapsedMonotonicMs(t8, t9) : null;
    const evaluationDurationMs =
      t9 !== null && t10 !== null ? ClockDomainManager.elapsedMonotonicMs(t9, t10) : null;
    const totalLocalEventPipelineMs =
      t5 !== null && t10 !== null ? ClockDomainManager.elapsedMonotonicMs(t5, t10) : null;
    const wsVsHttpDifferenceMs =
      t4 !== null && t2 !== null ? ClockDomainManager.elapsedMonotonicMs(t4, t2) : null;

    return {
      timelineId: params.timelineId,
      chainId: params.chainId,
      blockNumber: params.blockNumber,
      blockHash: params.blockHash,
      t0_protocolTimestamp: params.t0_protocolTimestamp,
      t1_requestStartNs: t1,
      t2_responseReceivedNs: t2,
      t3_blockDecodedNs: t3,
      t4_wsNewHeadsNs: t4,
      t5_wsLogsNs: t5,
      t6_eventDecodedNs: t6,
      t7_routeEvaluationStartNs: t7,
      t8_quoteStartNs: t8,
      t9_quoteEndNs: t9,
      t10_evaluationEndNs: t10,
      t11_independentRequoteNs: t11,
      localWallTimestampMs: wallMs,
      timestampReferenceDeltaMs,
      httpRequestDurationMs,
      blockDecodeDurationMs,
      eventDecodeDurationMs,
      routeDispatchDurationMs,
      quoteDurationMs,
      evaluationDurationMs,
      totalLocalEventPipelineMs,
      wsVsHttpDifferenceMs,
    };
  }

  /**
   * Samples true HTTP latency across multiple standard EVM RPC methods.
   */
  public static async benchmarkHttpMethods(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: PublicClient<any, any>,
    iterations: number = 20
  ): Promise<{
    blockNumberLatencies: number[];
    getBlockLatencies: number[];
  }> {
    const blockNumberLatencies: number[] = [];
    const getBlockLatencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const bRes = await this.measureRpcCall(() => client.getBlockNumber());
      blockNumberLatencies.push(bRes.durationMs);

      const blockRes = await this.measureRpcCall(() => client.getBlock({ blockNumber: bRes.result }));
      getBlockLatencies.push(blockRes.durationMs);

      if (i < iterations - 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    return {
      blockNumberLatencies,
      getBlockLatencies,
    };
  }
}
