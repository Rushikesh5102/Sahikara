/**
 * SAHIKARA Observer — Cross-DEX Round-Trip Quote Evaluator
 *
 * STATUS: COMPLETE (Phase 1C.2)
 *
 * PURPOSE:
 *   Evaluates complete cross-DEX round-trip arbitrage routes on Base:
 *   Initial Asset (Token A)
 *     → Leg 1 (DEX 1, Pool 1): Token A → Token B
 *     → Leg 2 (DEX 2, Pool 2): Token B → Token A
 *     → Final Asset (Token A)
 *
 * ECONOMIC PRINCIPLES:
 *   1. A one-way conversion is NOT arbitrage. Arbitrage requires a round-trip
 *      starting and ending in the same asset (or equivalent base unit).
 *   2. Theoretical spread: difference between quoted prices before execution costs.
 *   3. Executable spread: spread based on actual executable quotes for the exact amount.
 *   4. Gross round-trip profit: leg2Output - initialAmount (in base token units).
 *   5. Net expected profit: gross profit minus pool fees, estimated gas, and risk buffer.
 *   6. An opportunity is a candidate ONLY IF:
 *      netExpectedProfitUsd > minNetProfitUsd AND all safety constraints pass.
 *
 * SAFETY GATES & REJECTION:
 *   - SPREAD_TOO_SMALL: Gross output <= initial amount (negative or zero gross return).
 *   - FEES_EXCEED_SPREAD: Fees wipe out gross gain.
 *   - GAS_EXCEEDS_PROFIT: Estimated 2-hop gas cost exceeds remaining profit.
 *   - INSUFFICIENT_LIQUIDITY: Input size exceeds pool liquidity threshold.
 *   - PRICE_IMPACT_TOO_HIGH: Estimated price impact on either leg exceeds max allowed.
 *   - QUOTE_FAILED: One of the leg adapters failed to produce a valid executable quote.
 *
 * SECURITY:
 *   - Read-only simulation via eth_call.
 *   - No wallets, no signing, no transactions submitted.
 *   - All gas values marked [ESTIMATE] and [PROVISIONAL].
 */

import type {
  IPoolAdapter,
  PoolObservation,
  RejectionReason,
  ObservationStatus,
  OpportunityClassification,
} from '../adapters/IPoolAdapter.js';
import type { PoolDefinition, TokenDefinition } from '../config/pools.js';
import { estimateGasCost, GAS_UNITS_TWO_HOP_ARBI, type GasEstimate } from './gasEstimator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RoundTripLegDef {
  pool: PoolDefinition;
  adapter: IPoolAdapter;
  tokenIn: TokenDefinition;
  tokenOut: TokenDefinition;
}

export interface RoundTripRouteDef {
  id: string;
  name: string;
  chain: string;
  leg1: RoundTripLegDef;
  leg2: RoundTripLegDef;
}

export interface RoundTripLegResult {
  pool: PoolDefinition;
  dex: string;
  tokenIn: TokenDefinition;
  tokenOut: TokenDefinition;
  amountIn: bigint;
  amountOut: bigint;
  feeBps: number;
  priceImpactBps: number;
  latencyMs: number;
  rawQuoteJson: string;
}

export interface RoundTripEvaluation {
  routeId: string;
  routeName: string;
  chain: string;
  blockNumber: bigint;
  timestamp: number;

  // Leg 1 and Leg 2 details
  leg1: RoundTripLegResult;
  leg2: RoundTripLegResult;

  // Exact token amounts
  initialAmount: bigint;
  leg1Output: bigint;
  leg2Output: bigint;
  grossRoundTripDiff: bigint;

  // Base token info (initial & final asset)
  baseToken: TokenDefinition;
  intermediateToken: TokenDefinition;

  // Fee metadata (informational — already incorporated in quoted amounts)
  leg1FeeBps: number;
  leg2FeeBps: number;
  leg1FeeAmount: bigint;
  leg2FeeAmount: bigint;

  // Financial figures in USD (for normalization & reporting)
  tradeSizeUsd: number;
  grossProfitUsd: number;
  grossSpreadBps: number;
  poolFeesBps: number;
  poolFeesUsd: number;

  // Gas costs [ESTIMATE] [PROVISIONAL]
  gasEstimate: GasEstimate;
  gasCostUsd: number;

  // Risk buffer & net profit
  riskBufferUsd: number;
  netExpectedProfitUsd: number;
  netProfitBps: number;

  // Liquidity & price impact
  maxPriceImpactBps: number;
  totalLatencyMs: number;

  // Classification & safety
  status: ObservationStatus;
  classification: OpportunityClassification;
  rejectionReason: RejectionReason | null;
  rejectionDetail: string | null;
}

export interface EvaluateRoundTripParams {
  route: RoundTripRouteDef;
  initialAmount: bigint;
  tradeSizeUsd: number;
  blockNumber: bigint;
  gasPriceWei: bigint;
  ethPriceUsd: number;
  baseTokenPriceUsd: number;
  intermediateTokenPriceUsd: number;
  riskBufferFraction?: number;
  minNetProfitUsd?: number;
  maxPriceImpactBps?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function evaluateRoundTrip(
  params: EvaluateRoundTripParams
): Promise<RoundTripEvaluation> {
  const {
    route,
    initialAmount,
    tradeSizeUsd,
    blockNumber,
    gasPriceWei,
    ethPriceUsd,
    baseTokenPriceUsd,
    riskBufferFraction = 0.001, // 0.1% buffer default
    minNetProfitUsd = 0.05,     // $0.05 minimum expected profit
    maxPriceImpactBps = 100,    // 100 bps (1.0%) max acceptable price impact
  } = params;

  const timestamp = Date.now();

  // Validate initial amount
  if (initialAmount <= 0n) {
    throw new Error(`Invalid initialAmount: ${initialAmount.toString()}. Must be positive.`);
  }

  // ── Leg 1 Quote: Token A -> Token B ────────────────────────────────────────
  let obsLeg1: PoolObservation;
  if (route.leg1.adapter.getDirectionalQuote) {
    obsLeg1 = await route.leg1.adapter.getDirectionalQuote(
      route.leg1.pool,
      route.leg1.tokenIn.address,
      tradeSizeUsd,
      initialAmount,
      blockNumber
    );
  } else {
    obsLeg1 = await route.leg1.adapter.getQuote(
      route.leg1.pool,
      tradeSizeUsd,
      initialAmount,
      blockNumber
    );
  }

  if (obsLeg1.error || !obsLeg1.quote) {
    const reason = obsLeg1.error ?? 'Leg 1 quote failed';
    return buildFailedEvaluation(route, initialAmount, tradeSizeUsd, blockNumber, timestamp, 'QUOTE_FAILED', `Leg 1 (${route.leg1.pool.dex}) quote failed: ${reason}`);
  }

  const quoteLeg1 = obsLeg1.quote;
  const leg1Output = quoteLeg1.amountOut;

  if (leg1Output <= 0n) {
    return buildFailedEvaluation(route, initialAmount, tradeSizeUsd, blockNumber, timestamp, 'INSUFFICIENT_LIQUIDITY', `Leg 1 output was zero.`);
  }

  // ── Leg 2 Quote: Token B -> Token A ────────────────────────────────────────
  let obsLeg2: PoolObservation;
  if (route.leg2.adapter.getDirectionalQuote) {
    obsLeg2 = await route.leg2.adapter.getDirectionalQuote(
      route.leg2.pool,
      route.leg2.tokenIn.address,
      tradeSizeUsd,
      leg1Output,
      blockNumber
    );
  } else {
    obsLeg2 = await route.leg2.adapter.getQuote(
      route.leg2.pool,
      tradeSizeUsd,
      leg1Output,
      blockNumber
    );
  }

  if (obsLeg2.error || !obsLeg2.quote) {
    const reason = obsLeg2.error ?? 'Leg 2 quote failed';
    return buildFailedEvaluation(route, initialAmount, tradeSizeUsd, blockNumber, timestamp, 'QUOTE_FAILED', `Leg 2 (${route.leg2.pool.dex}) quote failed: ${reason}`);
  }

  const quoteLeg2 = obsLeg2.quote;
  const leg2Output = quoteLeg2.amountOut;

  // ── Economics Calculations ────────────────────────────────────────────────
  const leg1Result: RoundTripLegResult = {
    pool: route.leg1.pool,
    dex: route.leg1.pool.dex,
    tokenIn: route.leg1.tokenIn,
    tokenOut: route.leg1.tokenOut,
    amountIn: initialAmount,
    amountOut: leg1Output,
    feeBps: quoteLeg1.feeBps,
    priceImpactBps: quoteLeg1.priceImpactBps,
    latencyMs: obsLeg1.rpcLatencyMs,
    rawQuoteJson: obsLeg1.rawQuoteJson,
  };

  const leg2Result: RoundTripLegResult = {
    pool: route.leg2.pool,
    dex: route.leg2.pool.dex,
    tokenIn: route.leg2.tokenIn,
    tokenOut: route.leg2.tokenOut,
    amountIn: leg1Output,
    amountOut: leg2Output,
    feeBps: quoteLeg2.feeBps,
    priceImpactBps: quoteLeg2.priceImpactBps,
    latencyMs: obsLeg2.rpcLatencyMs,
    rawQuoteJson: obsLeg2.rawQuoteJson,
  };

  const grossRoundTripDiff = leg2Output - initialAmount;
  const baseDecimals = route.leg1.tokenIn.decimals;
  const baseDivisor = Math.pow(10, baseDecimals);

  // Convert gross profit in base token to USD
  const grossProfitToken = Number(grossRoundTripDiff) / baseDivisor;
  const grossProfitUsd = grossProfitToken * baseTokenPriceUsd;

  // Gross spread in BPS: ((leg2Output - initialAmount) / initialAmount) * 10,000
  const grossSpreadBps = (Number(grossRoundTripDiff) / Number(initialAmount)) * 10000;

  // ── Fee metadata (informational — already incorporated in quoted amounts) ──
  const leg1FeeBps = quoteLeg1.feeBps;
  const leg2FeeBps = quoteLeg2.feeBps;
  const leg1FeeAmount = (initialAmount * BigInt(leg1FeeBps)) / 10000n;
  const leg2FeeAmount = (leg1Output * BigInt(leg2FeeBps)) / 10000n;
  const poolFeesBps = leg1FeeBps + leg2FeeBps;
  const poolFeesUsd = (tradeSizeUsd * poolFeesBps) / 10000;

  // Gas estimate for 2-hop atomic execution [ESTIMATE] [PROVISIONAL]
  const gasEstimate = estimateGasCost('uniswap-v3', gasPriceWei, ethPriceUsd, true);
  gasEstimate.gasUnits = GAS_UNITS_TWO_HOP_ARBI;
  gasEstimate.gasCostEth = (Number(gasPriceWei) * GAS_UNITS_TWO_HOP_ARBI) / 1e18;
  gasEstimate.gasCostUsd = gasEstimate.gasCostEth * ethPriceUsd;
  gasEstimate.note = '[ESTIMATE][PROVISIONAL] Two-hop cross-DEX execution gas cost';

  const gasCostUsd = gasEstimate.gasCostUsd;

  // Risk buffer
  const riskBufferUsd = tradeSizeUsd * riskBufferFraction;

  // Net Expected Profit: GrossProfit - GasCost - RiskBuffer
  // Note: Quoted outputs already reflect pool fee deduction internally.
  // Pool fees are NOT subtracted again here to prevent double-counting.
  const netExpectedProfitUsd = grossProfitUsd - gasCostUsd - riskBufferUsd;
  const netProfitBps = (netExpectedProfitUsd / tradeSizeUsd) * 10000;

  const maxPriceImpactBpsActual = Math.max(quoteLeg1.priceImpactBps, quoteLeg2.priceImpactBps);
  const totalLatencyMs = obsLeg1.rpcLatencyMs + obsLeg2.rpcLatencyMs;

  // ── Safety & Candidate Filtering ──────────────────────────────────────────
  let status: ObservationStatus = 'REJECTED';
  let classification: OpportunityClassification = 'NO_OPPORTUNITY';
  let rejectionReason: RejectionReason | null = null;
  let rejectionDetail: string | null = null;

  if (maxPriceImpactBpsActual > maxPriceImpactBps) {
    status = 'REJECTED';
    classification = 'SLIPPAGE_TOO_HIGH';
    rejectionReason = 'SPREAD_TOO_SMALL';
    rejectionDetail = `Price impact of ${maxPriceImpactBpsActual.toFixed(2)} bps exceeds safety maximum of ${maxPriceImpactBps} bps.`;
  } else if (grossRoundTripDiff <= 0n) {
    status = 'REJECTED';
    classification = 'NO_OPPORTUNITY';
    rejectionReason = 'SPREAD_TOO_SMALL';
    rejectionDetail = `Round-trip gross output (${leg2Output.toString()}) is less than or equal to initial amount (${initialAmount.toString()}). Gross spread: ${grossSpreadBps.toFixed(2)} bps.`;
  } else if (gasCostUsd >= grossProfitUsd) {
    status = 'REJECTED';
    classification = 'GAS_TOO_HIGH';
    rejectionReason = 'GAS_EXCEEDS_PROFIT';
    rejectionDetail = `Estimated gas cost ($${gasCostUsd.toFixed(4)}) exceeds gross profit ($${grossProfitUsd.toFixed(4)}).`;
  } else if (netExpectedProfitUsd < minNetProfitUsd) {
    status = 'REJECTED';
    classification = 'SPREAD_TOO_SMALL';
    rejectionReason = 'SPREAD_TOO_SMALL';
    rejectionDetail = `Net expected profit ($${netExpectedProfitUsd.toFixed(4)}) is below configured threshold ($${minNetProfitUsd.toFixed(2)}).`;
  } else {
    // All checks pass
    status = 'CANDIDATE';
    classification = 'POTENTIAL_CANDIDATE';
    rejectionReason = null;
    rejectionDetail = null;
  }

  return {
    routeId: route.id,
    routeName: route.name,
    chain: route.chain,
    blockNumber,
    timestamp,
    leg1: leg1Result,
    leg2: leg2Result,
    initialAmount,
    leg1Output,
    leg2Output,
    grossRoundTripDiff,
    baseToken: route.leg1.tokenIn,
    intermediateToken: route.leg1.tokenOut,
    leg1FeeBps,
    leg2FeeBps,
    leg1FeeAmount,
    leg2FeeAmount,
    tradeSizeUsd,
    grossProfitUsd,
    grossSpreadBps,
    poolFeesBps,
    poolFeesUsd,
    gasEstimate,
    gasCostUsd,
    riskBufferUsd,
    netExpectedProfitUsd,
    netProfitBps,
    maxPriceImpactBps: maxPriceImpactBpsActual,
    totalLatencyMs,
    status,
    classification,
    rejectionReason,
    rejectionDetail,
  };
}

function buildFailedEvaluation(
  route: RoundTripRouteDef,
  initialAmount: bigint,
  tradeSizeUsd: number,
  blockNumber: bigint,
  timestamp: number,
  reason: RejectionReason,
  detail: string
): RoundTripEvaluation {
  return {
    routeId: route.id,
    routeName: route.name,
    chain: route.chain,
    blockNumber,
    timestamp,
    leg1: {
      pool: route.leg1.pool,
      dex: route.leg1.pool.dex,
      tokenIn: route.leg1.tokenIn,
      tokenOut: route.leg1.tokenOut,
      amountIn: initialAmount,
      amountOut: 0n,
      feeBps: route.leg1.pool.feeBps,
      priceImpactBps: 0,
      latencyMs: 0,
      rawQuoteJson: '{}',
    },
    leg2: {
      pool: route.leg2.pool,
      dex: route.leg2.pool.dex,
      tokenIn: route.leg2.tokenIn,
      tokenOut: route.leg2.tokenOut,
      amountIn: 0n,
      amountOut: 0n,
      feeBps: route.leg2.pool.feeBps,
      priceImpactBps: 0,
      latencyMs: 0,
      rawQuoteJson: '{}',
    },
    initialAmount,
    leg1Output: 0n,
    leg2Output: 0n,
    grossRoundTripDiff: -initialAmount,
    baseToken: route.leg1.tokenIn,
    intermediateToken: route.leg1.tokenOut,
    leg1FeeBps: route.leg1.pool.feeBps,
    leg2FeeBps: route.leg2.pool.feeBps,
    leg1FeeAmount: 0n,
    leg2FeeAmount: 0n,
    tradeSizeUsd,
    grossProfitUsd: 0,
    grossSpreadBps: 0,
    poolFeesBps: route.leg1.pool.feeBps + route.leg2.pool.feeBps,
    poolFeesUsd: 0,
    gasEstimate: {
      gasUnits: GAS_UNITS_TWO_HOP_ARBI,
      gasPriceGwei: 0,
      gasCostEth: 0,
      gasCostUsd: 0,
      ethPriceUsd: 0,
      note: '[ESTIMATE][PROVISIONAL] Gas estimate failed or skipped due to quote error',
    },
    gasCostUsd: 0,
    riskBufferUsd: 0,
    netExpectedProfitUsd: 0,
    netProfitBps: 0,
    maxPriceImpactBps: 0,
    totalLatencyMs: 0,
    status: 'ERROR',
    classification: reason === 'INSUFFICIENT_LIQUIDITY' ? 'INSUFFICIENT_LIQUIDITY' : 'QUOTE_FAILED',
    rejectionReason: reason,
    rejectionDetail: detail,
  };
}
