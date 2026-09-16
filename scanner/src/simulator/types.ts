/**
 * SAHIKARA Phase 3 — High-Fidelity Simulator Types & Data Models
 *
 * MANDATORY DATA CATEGORIZATION:
 * Every data field and model must explicitly identify its operational provenance:
 *   - [OBSERVED]   : Pure on-chain state directly queried from RPC/WebSocket (block number, pool reserves, base fee).
 *   - [QUOTED]     : Direct executable output from on-chain quoter contracts (QuoterV2, MixedQuoterV3).
 *   - [SIMULATED]  : Calculated execution outcome (price impact, slippage, atomic revert status).
 *   - [ESTIMATED]  : Model-estimated values (gas units, token USD rates).
 *   - [ASSUMPTION] : Configured risk thresholds (risk buffer rho_risk, latency delay delta_t, max slippage).
 */

import type { OpportunityClassification } from '../adapters/IPoolAdapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Provenance-Tagged Data Models
// ─────────────────────────────────────────────────────────────────────────────

export interface ObservedOnChainState {
  /** [OBSERVED] Block number at which the state was captured */
  blockNumber: bigint;
  /** [OBSERVED] Block timestamp in milliseconds */
  timestampMs: number;
  /** [OBSERVED] Base fee per gas in wei from block header */
  baseFeePerGasWei: bigint;
  /** [OBSERVED] Verified pool address */
  poolAddress: string;
  /** [OBSERVED] DEX protocol identifier */
  dex: string;
  /** [OBSERVED] Raw pool reserves or active tick (if available) */
  reserveData?: {
    reserve0?: bigint;
    reserve1?: bigint;
    sqrtPriceX96?: bigint;
    tick?: number;
  };
}

export interface QuotedOutput {
  /** [QUOTED] Exact output token amount returned by on-chain quoter */
  amountOut: bigint;
  /** [QUOTED] Raw input token amount evaluated */
  amountIn: bigint;
  /** [QUOTED] Fee tier in basis points already deducted by pool contract */
  feeBps: number;
  /** [QUOTED] Round-trip RPC latency for the quote in milliseconds */
  quoterLatencyMs: number;
  /** [QUOTED] Raw JSON payload returned from adapter/quoter */
  rawQuoteJson?: string;
}

export type AtomicRevertReason =
  | 'NONE'
  | 'SLIPPAGE_EXCEEDED_LEG1'
  | 'SLIPPAGE_EXCEEDED_LEG2'
  | 'NET_LOSS_REVERT'
  | 'INSUFFICIENT_LIQUIDITY_LEG1'
  | 'INSUFFICIENT_LIQUIDITY_LEG2'
  | 'STALE_BLOCK_TIMEOUT'
  | 'GAS_LIMIT_EXCEEDED'
  | 'EXECUTION_PRICE_DRIFT';

export interface SimulatedExecution {
  /** [SIMULATED] Whether the atomic transaction executed successfully or reverted */
  reverted: boolean;
  /** [SIMULATED] Specific revert reason code (NONE if successful) */
  revertReason: AtomicRevertReason;
  /** [SIMULATED] Human-readable forensic explanation */
  revertDetail?: string;
  /** [SIMULATED] Leg 1 simulated output amount */
  leg1SimulatedOutput: bigint;
  /** [SIMULATED] Leg 2 simulated output amount (0n if leg 1 reverted) */
  leg2SimulatedOutput: bigint;
  /** [SIMULATED] Final base token amount received (initialAmount if reverted) */
  finalAmountReceived: bigint;
  /** [SIMULATED] Price impact experienced on Leg 1 in basis points */
  leg1PriceImpactBps: number;
  /** [SIMULATED] Price impact experienced on Leg 2 in basis points */
  leg2PriceImpactBps: number;
  /** [SIMULATED] Total round-trip price impact in basis points */
  totalPriceImpactBps: number;
  /** [SIMULATED] Gross profit/loss in base token wei (leg2Output - initialAmount) */
  grossProfitWei: bigint;
  /** [SIMULATED] Gross spread in basis points */
  grossSpreadBps: number;
  /** [SIMULATED] Net PnL in base token wei: grossProfitWei - gasCostWei - riskBufferWei */
  netPnLWei: bigint;
  /** [SIMULATED] Net PnL converted to USD */
  netPnLUsd: number;
  /** [SIMULATED] Net profit margin in basis points */
  netProfitBps: number;
  /** [SIMULATED] Whether the opportunity meets all profitability and safety gates */
  isProfitableCandidate: boolean;
}

export interface EstimatedValues {
  /** [ESTIMATED] Expected gas units consumed for two-hop atomic contract execution */
  estimatedGasUnits: bigint;
  /** [ESTIMATED] Effective gas price in wei (baseFee + priorityFee) */
  effectiveGasPriceWei: bigint;
  /** [ESTIMATED] Total gas cost in base token wei */
  gasCostWei: bigint;
  /** [ESTIMATED] Total gas cost in USD */
  gasCostUsd: number;
  /** [ESTIMATED] Base token USD market rate used for normalization */
  baseTokenPriceUsd: number;
  /** [ESTIMATED] Native ETH USD market rate used for gas conversion */
  ethPriceUsd: number;
  /** [ESTIMATED] Risk buffer in base token wei */
  riskBufferWei: bigint;
  /** [ESTIMATED] Risk buffer converted to USD */
  riskBufferUsd: number;
}

export interface SimulationAssumptions {
  /** [ASSUMPTION] Maximum acceptable slippage tolerance in basis points (default 20 bps = 0.20%) */
  maxSlippageToleranceBps: number;
  /** [ASSUMPTION] Minimum expected net profit in USD to pass candidate gate (default $0.05) */
  minNetProfitUsd: number;
  /** [ASSUMPTION] Risk buffer fraction applied to input capital (default 0.001 = 10 bps) */
  riskBufferFraction: number;
  /** [ASSUMPTION] Simulated execution delay between detection and block inclusion in ms (e.g. 150ms) */
  simulatedLatencyDelayMs: number;
  /** [ASSUMPTION] Miner priority fee in wei (default 0.05 Gwei on Base) */
  priorityFeeWei: bigint;
  /** [ASSUMPTION] Maximum base fee cap in wei before dropping trade */
  maxBaseFeeWei: bigint;
  /** [ASSUMPTION] Volatility drift multiplier per 1000ms latency */
  driftMultiplierPerSec: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Level Simulation Results
// ─────────────────────────────────────────────────────────────────────────────

export interface CompleteSimulationResult {
  simulationId: string;
  routeId: string;
  routeName: string;
  chain: string;
  timestampMs: number;
  tradeSizeUsd: number;
  initialAmount: bigint;

  observed: ObservedOnChainState;
  leg1Quote: QuotedOutput;
  leg2Quote: QuotedOutput;
  simulated: SimulatedExecution;
  estimates: EstimatedValues;
  assumptions: SimulationAssumptions;

  /** Standard 8-way classification */
  classification: OpportunityClassification;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Size Optimization Models
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeSizePoint {
  tradeSizeUsd: number;
  initialAmount: bigint;
  grossSpreadBps: number;
  totalPriceImpactBps: number;
  gasCostUsd: number;
  netPnLUsd: number;
  netProfitBps: number;
  isProfitable: boolean;
  reverted: boolean;
  revertReason: AtomicRevertReason;
}

export interface TradeSizeOptimizationResult {
  routeId: string;
  routeName: string;
  blockNumber: bigint;
  testedSizes: TradeSizePoint[];
  optimalSizeUsd: number | null;
  maxNetPnLUsd: number;
  breakEvenSizeUsd: number | null;
  dominantConstraint: 'FIXED_GAS_OVERHEAD' | 'SLIPPAGE_CONVEXITY' | 'NEGATIVE_GROSS_SPREAD' | 'LIQUIDITY_EXHAUSTION';
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gas Sensitivity Models
// ─────────────────────────────────────────────────────────────────────────────

export interface GasSensitivityPoint {
  baseFeeGwei: number;
  gasUnits: bigint;
  gasCostUsd: number;
  netPnLUsd: number;
  netProfitBps: number;
  isProfitable: boolean;
}

export interface GasSensitivityMatrix {
  routeId: string;
  tradeSizeUsd: number;
  grossProfitUsd: number;
  points: GasSensitivityPoint[];
  breakEvenBaseFeeGwei: number | null;
  maxTolerableGasUnits: bigint | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Latency & Drift Simulation Models
// ─────────────────────────────────────────────────────────────────────────────

export interface LatencyDriftPoint {
  latencyMs: number;
  adverseDriftBps: number;
  residualGrossSpreadBps: number;
  residualNetPnLUsd: number;
  survived: boolean;
  dropReason?: string;
}

export interface LatencySimulationResult {
  routeId: string;
  initialGrossSpreadBps: number;
  initialNetPnLUsd: number;
  points: LatencyDriftPoint[];
  halfLifeMs: number | null;
  maxViableLatencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shadow / Paper Execution Models
// ─────────────────────────────────────────────────────────────────────────────

export interface ShadowAccountState {
  initialCapitalUsd: number;
  currentCashBalanceUsd: number;
  realizedPnLUsd: number;
  totalGasSpentUsd: number;
  tradesAttempted: number;
  tradesFilled: number;
  tradesReverted: number;
  winRate: number;
}

export interface ShadowTradeRecord {
  tradeId: string;
  timestampMs: number;
  blockNumber: bigint;
  routeId: string;
  tradeSizeUsd: number;
  grossProfitUsd: number;
  gasCostUsd: number;
  netPnLUsd: number;
  reverted: boolean;
  revertReason: AtomicRevertReason;
  resultingBalanceUsd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical Replay Models
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplayComparisonReport {
  totalReplayed: number;
  pollingEraObservations: number;
  eventDrivenEraObservations: number;
  pollingEraCandidates: number;
  eventDrivenEraCandidates: number;
  meanPollingGrossBps: number;
  meanEventGrossBps: number;
  failureDistribution: Record<string, number>;
  reconstructedCandidates: CompleteSimulationResult[];
  observationsByEra: {
    pollingEra: { count: number; avgLatencyMs: number; positiveGrossCount: number };
    eventDrivenEra: { count: number; avgLatencyMs: number; positiveGrossCount: number };
  };
}
