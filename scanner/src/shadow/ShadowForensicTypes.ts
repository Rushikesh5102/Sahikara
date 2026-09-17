/**
 * SAHIKARA Phase 4.18 — Continuous Shadow Detection Forensic Types & Taxonomy
 *
 * Establishes immutable provenance, lifecycle, state health, failure categories,
 * and forensic record schemas for continuous read-only shadow arbitrage detection.
 *
 * STRICT INVARIANTS:
 * - Read-only telemetry and virtual execution only.
 * - Zero wallets, zero signers, zero trading credentials, zero capital deployed.
 * - Phase 5 remains STRICTLY BLOCKED.
 */

import type { Address, Hex } from 'viem';
import type { ProvenanceTag } from './types.js';

export type { ProvenanceTag };

/**
 * Local Pool State Health Classification
 */
export type StateHealthStatus =
  | 'HEALTHY'          // State is complete, validated, fresh, and fully synchronized
  | 'DEGRADED'         // Slight latency or missing non-critical metrics; still strictly operable
  | 'STALE'            // Age exceeds maximum staleness window; quote generation suspended
  | 'INCOMPLETE'       // Missing required initialized ticks or bitmap words; quote generation blocked
  | 'RESYNC_REQUIRED'  // Desynchronization detected; full RPC resync initiated
  | 'INVALID'          // Reorg, block gap, or corrupted invariant detected; state disqualified
  | 'UNKNOWN';         // Uninitialized or indeterminate state

/**
 * Candidate Opportunity Lifecycle States
 */
export type CandidateLifecycleState =
  | 'DETECTED_LOCAL'            // Initial candidate identified by in-memory engine
  | 'ECONOMICALLY_FILTERED'     // Passed local gross spread, gas, and risk hurdles
  | 'RPC_VERIFICATION_PENDING'  // Queued for authoritative on-chain RPC call
  | 'RPC_VERIFIED'              // Authoritative on-chain quote retrieved and verified
  | 'REVALIDATED'               // Post-verification economic recalculation passed
  | 'SHADOW_EXECUTABLE'         // Would have passed the configured read-only execution model
  | 'SHADOW_EXPIRED'            // Opportunity lifetime expired or superseded by new state
  | 'REJECTED_ECONOMICS'        // Gross spread insufficient to cover fees/gas/risk
  | 'REJECTED_STALE'            // Candidate or quote age exceeded freshness policy
  | 'REJECTED_STATE'            // Local pool state unhealthy (INCOMPLETE/INVALID/STALE)
  | 'REJECTED_RPC'              // Authoritative RPC call failed, timed out, or rate-limited
  | 'REJECTED_DRIFT'            // Local-to-RPC output difference exceeded tolerance
  | 'REJECTED_LIQUIDITY'        // Available pool or order-book depth insufficient
  | 'REJECTED_RISK'             // Breached risk buffer or conservative safety bounds
  | 'REJECTED_GAS'              // Gas cost exceeded maximum allowable threshold
  | 'INVALIDATED';              // Invalidated by subsequent block reorg or stream gap

/**
 * Authoritative On-Chain Verification Outcomes
 */
export type VerificationOutcome =
  | 'VERIFIED'
  | 'VERIFIED_WITH_DRIFT'
  | 'REJECTED_LOCAL_RPC_MISMATCH'
  | 'REJECTED_STALE'
  | 'REJECTED_STATE_INVALID'
  | 'REJECTED_ECONOMICS'
  | 'REJECTED_LIQUIDITY'
  | 'REJECTED_GAS'
  | 'REJECTED_RISK'
  | 'RPC_ERROR'
  | 'UNKNOWN';

/**
 * Local vs Authoritative RPC Discrepancy Classification
 */
export type DiscrepancyClassification =
  | 'EXACT'            // 0 wei delta (0.000000 bps)
  | 'SUB_BPS_DRIFT'    // > 0 and <= 1.0 bps delta
  | 'LOW_DRIFT'        // > 1.0 and <= 5.0 bps delta
  | 'MATERIAL_DRIFT'   // > 5.0 bps delta
  | 'INVALID_STATE';   // Structural state or block mismatch

/**
 * Quote Freshness Classifications (Phase 4.14.1 Standard)
 */
export type QuoteFreshnessClass =
  | 'FRESH_ONCHAIN_QUOTE'   // Fresh on-chain call executed at the aligned canonical block
  | 'CACHED_ONCHAIN_QUOTE'  // Reused recent on-chain quote (must NOT be treated as real-time candidate)
  | 'SIMULATED_QUOTE'       // Pure in-memory local state simulation
  | 'MISSING_QUOTE';        // Failed to obtain quote

/**
 * Structured Failure Taxonomy
 */
export type FailureCategory =
  | 'RPC_RATE_LIMIT'
  | 'RPC_TIMEOUT'
  | 'RPC_ERROR'
  | 'WS_DISCONNECT'
  | 'WS_SEQUENCE_GAP'
  | 'STATE_GAP'
  | 'REORG'
  | 'STALE_STATE'
  | 'MISSING_TICK'
  | 'INVALID_TOKEN_ORDER'
  | 'DECIMAL_MISMATCH'
  | 'QUOTE_MISMATCH'
  | 'QUOTE_STALE'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'ECONOMICS_REJECT'
  | 'GAS_REJECT'
  | 'RISK_REJECT'
  | 'SLIPPAGE_REJECT'
  | 'UNKNOWN';

/**
 * Supported Route Arbitrage Classes
 */
export type RouteArbitrageClass =
  | 'DEX_TO_DEX'   // e.g. Base Uniswap V3 <-> Aerodrome V2
  | 'CEX_TO_DEX'   // e.g. Buy on Coinbase/Binance, Sell on Base DEX
  | 'DEX_TO_CEX';  // e.g. Buy on Base DEX, Sell on Coinbase/Binance

/**
 * Distinct Monotonic & Wall Clock Timestamps
 */
export interface PipelineTimingContext {
  protocolTimeMs: number;          // On-chain block timestamp or exchange match timestamp
  localWallTimeMs: number;          // System wall-clock time (Date.now())
  localMonotonicMs: number;         // High-resolution monotonic timer (performance.now())
  timeProvenance: ProvenanceTag;
}

/**
 * Structured Failure Log Record
 */
export interface PipelineFailureRecord {
  failureId: string;
  category: FailureCategory;
  timestampWallMs: number;
  timestampMonotonicMs: number;
  details: string;
  poolAddress?: Address;
  blockNumber?: bigint;
  routeId?: string;
  resolved: boolean;
}

/**
 * Comprehensive Forensic Candidate Record
 * Answers all 12 mandatory forensic reproducibility questions.
 */
export interface ForensicCandidateRecord {
  // Identification & Lineage
  runId: string;
  candidateId: string;
  routeId: string;
  routeClass: RouteArbitrageClass;
  chain: string;
  chainId: number;

  // 1. What market state triggered detection?
  triggerEvent: {
    source: 'CEX_UPDATE' | 'DEX_EVENT' | 'POLL_TICK';
    identifier: string;
    receivedMonotonicMs: number;
  };

  // 2. What local state produced the candidate?
  localDEXState: {
    poolAddress: Address;
    protocol: 'uniswap-v3' | 'aerodrome-v2';
    stateBlockNumber: bigint;
    stateBlockHash: Hex;
    stateHealth: StateHealthStatus;
    stateAgeMs: number;
    sqrtPriceX96?: bigint;
    activeTick?: number;
    reserve0?: bigint;
    reserve1?: bigint;
  };

  // 3. What CEX state was used?
  cexState?: {
    venue: string;
    symbol: string;
    bid: number;
    ask: number;
    bidDepthUsd: number;
    askDepthUsd: number;
    updateAgeMs: number;
    exchangeTimestampMs: number | null;
  };

  // 4. What assumptions were applied?
  assumptions: {
    riskBufferBps: number;
    estimatedGasUnits: number;
    gasPriceGwei: number;
    ethPriceUsd: number;
    cexFeeRateBps: number;
    maxSlippageBps: number;
  };

  // 5. Input & Local Predicted Output
  inputAmount: bigint;
  inputToken: Address;
  outputToken: Address;
  notionalUsd: number;
  localPredictedOutput: bigint;
  localPredictionProvenance: ProvenanceTag;

  // 6. What RPC quote was obtained & at what block?
  authoritativeQuote?: {
    outputAmount: bigint;
    blockNumber: bigint;
    blockHash: Hex;
    latencyMs: number;
    provider: string;
    quoteAgeMs: number;
    freshnessClass: QuoteFreshnessClass;
    provenance: ProvenanceTag;
  };

  // 7. Did local and RPC output agree?
  discrepancy?: {
    absoluteDeltaWei: bigint;
    deltaBps: number;
    classification: DiscrepancyClassification;
  };

  // 8. Economics & Shadow PnL
  economics: {
    grossRoundTripPnLUsd: number;
    estimatedGasCostUsd: number;
    riskBufferCostUsd: number;
    otherFeesUsd: number;
    netExpectedPnLUsd: number;       // Marked strictly as expected / hypothetical
    isEconomicallyViable: boolean;
  };

  // 9. Candidate Lifecycle & Verification Status
  lifecycle: CandidateLifecycleState;
  verificationOutcome: VerificationOutcome;
  rejectionReason?: string;
  failureCategory?: FailureCategory;

  // 10. Sample Independence & Uniqueness Tracking
  sampleIndependence: {
    marketStateHash: string;         // Hash of CEX mid + DEX sqrtPrice + block
    isUniqueMarketState: boolean;
    isUniqueBlockState: boolean;
    observationIndexInBlock: number;
  };

  // 11. Lifetime Tracking
  lifetime: {
    firstDetectedMonotonicMs: number;
    lastObservedMonotonicMs: number;
    durationMs: number;
    lifetimeStatus: 'MEASURED' | 'UNKNOWN';
  };

  // 12. What would the shadow outcome have been?
  shadowOutcome: {
    executionClassification: 'SHADOW_ONLY';
    hypotheticalOutput: bigint;
    hypotheticalNetProfitUsd: number;
    wouldHaveExecuted: boolean;
    simulatedAtMonotonicMs: number;
  };
}

/**
 * Real-Time Pipeline Telemetry Metrics
 */
export interface PipelineTelemetryMetrics {
  startTimeWallMs: number;
  elapsedMs: number;
  isRunning: boolean;
  shutdownRequested: boolean;

  // Event Counters
  cexMessagesReceived: number;
  dexEventsProcessed: number;
  localEvaluationsPerformed: number;
  candidatesDetectedLocal: number;
  candidatesEconomicallyPassed: number;
  rpcVerificationRequestsSent: number;
  rpcVerificationsSucceeded: number;
  candidatesShadowExecutable: number;

  // RPC Efficiency Metrics
  rpcCallsAvoided: number;
  rpcReductionRatio: number; // e.g. 0.998 = 99.8% reduction
  rpcCallsPerCandidate: number;

  // Sample Independence Metrics
  rawObservations: number;
  uniqueMarketStates: number;
  uniqueBlockStates: number;
  uniqueCandidates: number;
  effectiveSampleSize: number;

  // Latency Metrics (Monotonic Microseconds & Milliseconds)
  localDetectionLatencyUs: { min: number; median: number; p95: number; max: number };
  rpcVerificationLatencyMs: { min: number; median: number; p95: number; max: number };
  totalLifecycleLatencyMs: { min: number; median: number; p95: number; max: number };

  // Health and Failure Counts
  stateHealthByPool: Record<string, StateHealthStatus>;
  failureCountsByCategory: Record<FailureCategory, number>;
}
