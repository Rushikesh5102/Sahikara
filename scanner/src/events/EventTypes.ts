/**
 * SAHIKARA Phase 2 — Event Types & Telemetry Models
 *
 * Defines contracts for real-time WebSocket/block log streaming,
 * pool state changes, event detection metrics, and deterministic replay.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry. Zero private keys, zero wallet signing, zero live trading.
 */

import type { RoundTripEvaluation } from '../economics/roundTripEvaluator.js';

export type PoolEventType = 'SWAP' | 'SYNC' | 'BLOCK';

export interface PoolStateChangeEvent {
  /** Type of event received */
  eventType: PoolEventType;
  /** Address of the pool that emitted the event (lowercase 0x...) */
  poolAddress: string;
  /** Block number at which the event occurred */
  blockNumber: bigint;
  /** Block hash if available */
  blockHash?: string;
  /** Transaction hash if available */
  transactionHash?: string;
  /** Log index within the transaction / block */
  logIndex?: number;
  /** Exact millisecond timestamp when event was received by the node/watcher */
  receiptTimestampMs: number;
  /** Raw decoded event data (e.g., amount0, amount1, sqrtPriceX96, tick, reserves) */
  data?: unknown;
}

export interface LatencyPercentiles {
  min: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
}

export interface EventDetectionMetrics {
  eventsReceived: number;
  eventsProcessed: number;
  duplicateEvents: number;
  staleEvents: number;
  outOfOrderEvents: number;
  reconnects: number;
  quotesTriggered: number;
  successfulQuotes: number;
  failedQuotes: number;
  roundTripsEvaluated: number;
  grossPositiveRoundTrips: number;
  candidatesDetected: number;
  detectionLatency: LatencyPercentiles;
}

export interface EventDispatcherResult {
  event: PoolStateChangeEvent;
  affectedRoutesCount: number;
  evaluations: RoundTripEvaluation[];
  detectionLatencyMs: number;
}

export interface ReplayMetrics {
  totalEvents: number;
  replayedEvents: number;
  matchingClassifications: number;
  divergentClassifications: number;
  elapsedMs: number;
  evaluationsCount: number;
}

export interface BenchmarkMetrics {
  pollingDurationMs: number;
  pollingQuotesAttempted: number;
  pollingRoutesEvaluated: number;
  eventDurationMs: number;
  eventQuotesAttempted: number;
  eventRoutesEvaluated: number;
  rpcCallReductionPercent: number;
  latencyReductionPercent: number;
}
