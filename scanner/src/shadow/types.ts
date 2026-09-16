/**
 * SAHIKARA Phase 4 — Real-Time Shadow / Paper Execution Types
 *
 * Defines contracts for:
 * - 8 Opportunity Lifecycle States
 * - 13 Real-Time Opportunity Classifications
 * - High-Resolution Latency Timestamps (Monotonic + Wall-Clock)
 * - Base OP Stack Gas & L1 Data Fee Accounting
 * - Shadow Paper Portfolio Ledger ($100 Virtual Capital)
 * - Next-Block Market Calibration
 * - Strict Separation: Live Market vs Synthetic Fixtures
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry and virtual paper execution only.
 * Zero private keys, zero wallet signing, zero live trading.
 */

export type OpportunityLifecycleState =
  | 'DETECTED'
  | 'EVALUATED'
  | 'SHADOW_SUBMITTED'
  | 'INCLUDED'
  | 'EXPIRED'
  | 'MISSED'
  | 'REJECTED'
  | 'INVALIDATED';

export type OpportunityClassification =
  | 'NO_OPPORTUNITY'
  | 'SPREAD_TOO_SMALL'
  | 'QUOTE_FAILED'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'GAS_TOO_HIGH'
  | 'SLIPPAGE_TOO_HIGH'
  | 'LATENCY_TOO_HIGH'
  | 'RISK_REJECTED'
  | 'PROFITABLE_SHADOW'
  | 'UNPROFITABLE_SHADOW'
  | 'EXPIRED'
  | 'MISSED'
  | 'INVALIDATED';

/**
 * Phase 4.5 Opportunity Tier Classification
 * TIER 0: No cross-DEX dislocation.
 * TIER 1: Gross positive but fails economic gates.
 * TIER 2: Positive after DEX fees but fails gas/risk/latency.
 * TIER 3: Positive simulated net PnL after all modeled costs (off-chain survival).
 * TIER 4: Positive simulated net PnL AND survives next-block calibration.
 */
export type OpportunityTier =
  | 'TIER_0'
  | 'TIER_1'
  | 'TIER_2'
  | 'TIER_3'
  | 'TIER_4';

export type ProvenanceTag =
  | '[OBSERVED]'
  | '[QUOTED]'
  | '[SIMULATED]'
  | '[ESTIMATED]'
  | '[ASSUMPTION]'
  | '[POLICY]'
  | '[PAPER/SIMULATION]'
  | '[SYNTHETIC TEST FIXTURE]';

export interface LifecycleTimestamps {
  /** Wall-clock millisecond when event was detected */
  tDetectWallMs: number;
  /** Monotonic high-res start time */
  tDetectMonoMs: number;
  /** Wall-clock millisecond when quoting completed */
  tQuoteWallMs?: number;
  /** Wall-clock millisecond when simulation & gate evaluation finished */
  tEvaluateWallMs?: number;
  /** Wall-clock millisecond when shadow trade was committed to paper ledger */
  tShadowSubmitWallMs?: number;
  /** Wall-clock millisecond of hypothetical next-block inclusion */
  tHypotheticalInclusionWallMs?: number;
  /** Wall-clock millisecond when opportunity expired */
  tExpiryWallMs?: number;

  /** Detection latency: time from on-chain event block/receipt to local detection */
  detectionLatencyMs: number;
  /** Simulation latency: time taken to quote, simulate, and gate */
  simulationLatencyMs: number;
  /** Assumed execution latency on Base (e.g., 200ms Flashblocks or 2000ms block) */
  assumedExecutionLatencyMs: number;
  /** Total end-to-end latency from receipt to hypothetical inclusion */
  totalLatencyMs: number;
}

export interface BaseGasBreakdown {
  /** Estimated execution gas units (e.g. 220,000) [ESTIMATED] */
  executionGasUnits: number;
  /** L2 Base Fee in Gwei [OBSERVED/ESTIMATED] */
  l2BaseFeeGwei: number;
  /** Priority Fee / Miner Tip in Gwei [ASSUMPTION] */
  priorityFeeGwei: number;
  /** L2 Execution Cost in USD [ESTIMATED] */
  l2GasCostUsd: number;
  /** Estimated L1 Data Fee / Blob Fee in USD for transaction calldata [ESTIMATED] */
  l1DataFeeUsd: number;
  /** Total Gas Cost in USD (L2 Cost + L1 Data Fee) [ESTIMATED] */
  totalGasCostUsd: number;
  /** Reference ETH price used for conversion [ESTIMATED] */
  ethPriceUsd: number;
}

export interface ShadowOpportunity {
  /** Deterministic Opportunity ID: opp_${routeId}_${blockNumber}_${amountIn}_${timestampMs} */
  opportunityId: string;
  chain: string;
  /** Block number of the triggering event */
  triggerBlockNumber: bigint;
  /** Event type that triggered re-quote (SWAP, SYNC, BLOCK) */
  triggerEventType: string;
  /** Pool address that emitted the triggering event */
  triggerPoolAddress: string;
  /** Canonical route ID */
  routeId: string;
  routeName: string;
  tokenPair: string;
  poolLeg1: string;
  poolLeg2: string;
  dexLeg1: string;
  dexLeg2: string;

  /** Trade size in USD */
  tradeSizeUsd: number;
  /** Initial raw token amount */
  initialAmount: bigint;
  /** Token in symbol and decimals */
  tokenInSymbol: string;
  tokenInDecimals: number;

  /** Quoted leg 1 output amount */
  quotedLeg1Output: bigint;
  /** Quoted leg 2 output amount */
  quotedLeg2Output: bigint;

  /** Gross spread in basis points */
  grossSpreadBps: number;
  /** Gross profit in USD */
  grossProfitUsd: number;

  /** Comprehensive Base OP Stack gas breakdown */
  gasBreakdown: BaseGasBreakdown;

  /** Conservative risk buffer reserve in USD */
  riskBufferUsd: number;
  /** Other estimated execution costs (if any) in USD */
  otherCostsUsd: number;

  /** Strict Net Expected PnL in USD */
  netExpectedPnLUsd: number;
  /** Net Expected PnL in basis points */
  netProfitBps: number;

  /** Estimated price impact across both legs in basis points */
  totalPriceImpactBps: number;

  /** High-resolution monotonic and wall-clock timestamps */
  timestamps: LifecycleTimestamps;

  /** Expected inclusion block number */
  expectedInclusionBlock: bigint;

  /** Current lifecycle state */
  lifecycleState: OpportunityLifecycleState;
  /** Real-time opportunity classification */
  classification: OpportunityClassification;
  /** Phase 4.5 Opportunity Tier (TIER 0 to TIER 4) */
  opportunityTier?: OpportunityTier;

  /** Rejection reason if not submitted */
  rejectionReason?: string;
  rejectionDetail?: string;

  /** True if this record was injected as a synthetic test vector, false for live market */
  isSynthetic: boolean;

  /** Field-level provenance documentation */
  provenance: Record<string, ProvenanceTag>;

  createdAt: number;
}

export interface NextBlockCalibration {
  calibrationId: string;
  opportunityId: string;
  predictedBlockNumber: bigint;
  observedBlockNumber: bigint;

  /** Predicted metrics at decision time */
  predictedSpreadBps: number;
  predictedGrossProfitUsd: number;
  predictedGasCostUsd: number;
  predictedNetPnLUsd: number;

  /** Realized / Observed metrics in the subsequent block */
  observedSpreadBps: number;
  observedGrossProfitUsd: number;
  observedGasCostUsd: number;
  observedNetPnLUsd: number;

  /** Prediction Errors (Observed - Predicted) */
  spreadPredictionErrorBps: number;
  netPnLPredictionErrorUsd: number;
  gasPredictionErrorUsd: number;

  /** Whether the price dislocation persisted into the next block */
  opportunityPersisted: boolean;
  /** Observed decay in spread from block B to B+1 in basis points */
  observedSpreadDecayBps: number;

  isSynthetic: boolean;
  calibrationTimestampMs: number;
  notes?: string;
}

export interface ShadowPortfolioState {
  startingBalanceUsd: number;
  availableBalanceUsd: number;
  committedBalanceUsd: number;
  grossPnLUsd: number;
  l2GasCostUsd: number;
  l1DataFeeUsd: number;
  totalGasSpentUsd: number;
  otherCostUsd: number;
  riskBufferUsd: number;
  netPnLUsd: number;
  currentCashBalanceUsd: number;

  tradesAttempted: number;
  tradesFilled: number;
  tradesReverted: number;
  opportunitiesExpired: number;
  opportunitiesMissed: number;
  opportunitiesRejected: number;

  winCount: number;
  lossCount: number;
  /** Null / 'N/A' when tradesFilled === 0 to avoid false 0% win rate reporting */
  winRatePercent: number | null;
  roiPercent: number;

  maxDrawdownUsd: number;
  peakBalanceUsd: number;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;

  isSyntheticLedger: boolean;
  lastUpdatedMs: number;
}

export interface MissedOpportunityReport {
  totalEventsProcessed: number;
  totalRoutesEvaluated: number;
  candidatesDetected: number;
  rejectedByZeroOrNegativeSpread: number;
  rejectedByEconomicGates: number;
  rejectedByGasCost: number;
  rejectedBySlippage: number;
  rejectedByLatency: number;
  rejectedByRiskBuffer: number;
  rejectedByQuoterFailure: number;
  rejectedByRpcFailure: number;
  rejectedByWebSocketFailure: number;
  expiredBeforeExecution: number;
  missedDueToLatencyWindow: number;
  viableShadowTradesSubmitted: number;

  /** Opportunity Tier Counts */
  tier0Count: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  tier4Count: number;
}

export interface EconomicPolicyConfig {
  minNetProfitUsd: number;
  minNetProfitBps: number;
  maxSlippageBps: number;
  maxGasCostUsd: number;
  maxTradeSizeUsd: number;
  minLiquidityUsd: number;
  maxQuoteAgeMs: number;
  maxViableLatencyMs: number;
  riskBufferBps: number;
  /** Legacy ethPriceUsd field [PRESERVED FOR BACKWARDS COMPATIBILITY] */
  ethPriceUsd: number;
  /** Explicit native gas-token USD price (e.g. POL/MATIC $0.80, ETH $2,500) [D-001 SEPARATION] */
  nativeGasTokenPriceUsd?: number;
  /** Explicit base trade-token USD price (e.g. WETH $2,500 [ASSUMPTION]) [D-001 SEPARATION] */
  baseTradeTokenPriceUsd?: number;
  assumedL1DataFeeUsd: number;
}
