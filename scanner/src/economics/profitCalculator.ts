/**
 * SAHIKARA Observer — Net Expected Profit Calculator
 *
 * Implements the canonical economic formula from ARBITRAGE_ECONOMICS.md:
 *
 *   NetExpectedProfit = ExecutableGrossOutput
 *                     - InputCapital
 *                     - PoolFees
 *                     - GasCost
 *                     - OtherExecutionCosts
 *                     - RiskBuffer
 *
 * THREE PROFIT TIERS (per spec requirement):
 *   1. GrossProfit            = ExecutableOutput - InputCapital (before all fees)
 *   2. NetProfitBeforeBuffer  = GrossProfit - PoolFees - GasCost
 *   3. NetExpectedProfit      = NetProfitBeforeBuffer - RiskBuffer
 *
 * IMPORTANT DISTINCTION (per spec):
 *   THEORETICAL PRICE DIFFERENCE  → spot price ratio (not calculated here)
 *   QUOTED EXECUTABLE DIFFERENCE  → actual amountOut from QuoterV2 (PoolQuote)
 *   ESTIMATED NET PROFIT           → NetExpectedProfit below (the only candidate tier)
 *
 * Only NetExpectedProfit > minNetProfitUsd should be classified as CANDIDATE.
 * All others must be REJECTED with an explicit reason.
 *
 * ASSUMPTIONS (all PROVISIONAL per RISK_POLICY.md):
 *   - Pool fees are already deducted in amountOut (QuoterV2 returns net-of-fee output).
 *   - Gas cost is an estimate ([ESTIMATE] flag always propagated).
 *   - Risk buffer is configurable (default 0.1% of input capital).
 *   - Token prices (for USD conversion) use configurable rates, not live oracles.
 */

import type { PoolQuote, RejectionReason, ObservationStatus } from '../adapters/IPoolAdapter.js';
import type { GasEstimate } from './gasEstimator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenPriceContext {
  /** USD value of 1 unit of token0 (in token's native units, not wei) */
  token0PriceUsd: number;
  /** USD value of 1 unit of token1 (in token's native units, not wei) */
  token1PriceUsd: number;
  /** Decimals for token0 */
  token0Decimals: number;
  /** Decimals for token1 */
  token1Decimals: number;
}

export interface ProfitCalculation {
  /** Input capital in USD */
  inputCapitalUsd: number;

  // ── Tier 1: Gross ────────────────────────────────────────────────────────
  /** Raw output value in USD (amountOut converted to USD) */
  executableGrossOutputUsd: number;
  /** Gross profit in USD: executableGrossOutput - inputCapital */
  grossProfitUsd: number;
  /** Gross spread in basis points */
  grossSpreadBps: number;

  // ── Tier 2: After fees and gas ────────────────────────────────────────────
  /** Pool fees in USD (deducted via amountOut, but reported separately) */
  poolFeesUsd: number;
  /** Pool fee in basis points */
  poolFeeBps: number;
  /** Gas cost estimate in USD [ESTIMATE] */
  gasCostUsd: number;
  /** Net profit before risk buffer */
  netProfitBeforeBufferUsd: number;

  // ── Tier 3: Net expected profit ───────────────────────────────────────────
  /** Risk buffer in USD */
  riskBufferUsd: number;
  /** NET EXPECTED PROFIT: The definitive profitability metric */
  netExpectedProfitUsd: number;

  // ── Classification ────────────────────────────────────────────────────────
  status: ObservationStatus;
  rejectionReason: RejectionReason | null;
  rejectionDetail: string;

  // ── Metadata ─────────────────────────────────────────────────────────────
  gasEstimate: GasEstimate;
  allAssumptions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitCalculatorParams {
  /** The executable quote from the pool adapter */
  quote: PoolQuote;
  /** Input capital in USD */
  inputCapitalUsd: number;
  /** Token price context for USD conversion */
  priceContext: TokenPriceContext;
  /** Gas cost estimate from gasEstimator */
  gasEstimate: GasEstimate;
  /** Risk buffer fraction (e.g., 0.001 = 0.1%) */
  riskBufferFraction: number;
  /** Minimum net profit threshold in USD */
  minNetProfitUsd: number;
}

export function calculateProfit(params: ProfitCalculatorParams): ProfitCalculation {
  const {
    quote,
    inputCapitalUsd,
    priceContext,
    gasEstimate,
    riskBufferFraction,
    minNetProfitUsd,
  } = params;

  const assumptions: string[] = [];

  // ── Convert raw token amounts to USD ──────────────────────────────────────

  // amountIn in token0 native units → USD
  const token0UnitMultiplier = Math.pow(10, priceContext.token0Decimals);
  const amountInFloat = Number(quote.amountIn) / token0UnitMultiplier;
  const inputCapitalActualUsd = amountInFloat * priceContext.token0PriceUsd;

  // amountOut in token1 native units → USD
  const token1UnitMultiplier = Math.pow(10, priceContext.token1Decimals);
  const amountOutFloat = Number(quote.amountOut) / token1UnitMultiplier;
  const executableGrossOutputUsd = amountOutFloat * priceContext.token1PriceUsd;

  assumptions.push(
    `[ASSUMPTION] token0 price: $${priceContext.token0PriceUsd} — not from live oracle, configurable.`,
    `[ASSUMPTION] token1 price: $${priceContext.token1PriceUsd} — not from live oracle, configurable.`
  );

  // ── Tier 1: Gross profit ──────────────────────────────────────────────────

  const grossProfitUsd = executableGrossOutputUsd - inputCapitalActualUsd;

  // Gross spread in bps relative to input
  const grossSpreadBps =
    inputCapitalActualUsd > 0
      ? (grossProfitUsd / inputCapitalActualUsd) * 10000
      : 0;

  // ── Pool fees (informational — already deducted in amountOut) ────────────
  // The amountOut from QuoterV2 / getAmountOut already has pool fees deducted.
  // We report the fee separately for transparency.
  const feeDecimal = quote.feeBps / 10000;
  const poolFeesUsd = inputCapitalActualUsd * feeDecimal;

  assumptions.push(
    `[ASSUMPTION] Pool fees reported as ${quote.feeBps} bps of input capital. ` +
    `Already deducted in amountOut — reported here for transparency only.`
  );

  // ── Tier 2: Net before buffer ─────────────────────────────────────────────

  const netProfitBeforeBufferUsd = grossProfitUsd - gasEstimate.gasCostUsd;

  assumptions.push(
    `[ESTIMATE] Gas cost: $${gasEstimate.gasCostUsd.toFixed(6)} — ` + gasEstimate.note
  );

  // ── Tier 3: Risk buffer and net expected profit ───────────────────────────

  const riskBufferUsd = inputCapitalActualUsd * riskBufferFraction;
  const netExpectedProfitUsd = netProfitBeforeBufferUsd - riskBufferUsd;

  assumptions.push(
    `[ASSUMPTION] Risk buffer: ${(riskBufferFraction * 100).toFixed(2)}% of input = $${riskBufferUsd.toFixed(6)}. PROVISIONAL per RISK_POLICY.md.`
  );

  // ── Classification ────────────────────────────────────────────────────────

  let status: ObservationStatus = 'CANDIDATE';
  let rejectionReason: RejectionReason | null = null;
  let rejectionDetail = '';

  if (grossSpreadBps <= 0) {
    status = 'REJECTED';
    rejectionReason = 'SPREAD_TOO_SMALL';
    rejectionDetail = `Gross spread is zero or negative (${grossSpreadBps.toFixed(2)} bps). No price discrepancy.`;
  } else if (grossProfitUsd <= poolFeesUsd) {
    status = 'REJECTED';
    rejectionReason = 'FEES_EXCEED_SPREAD';
    rejectionDetail =
      `Gross profit ($${grossProfitUsd.toFixed(6)}) does not exceed pool fees ($${poolFeesUsd.toFixed(6)}). ` +
      `Gross spread ${grossSpreadBps.toFixed(2)} bps < fee ${quote.feeBps} bps.`;
  } else if (gasEstimate.gasCostUsd >= grossProfitUsd) {
    status = 'REJECTED';
    rejectionReason = 'GAS_EXCEEDS_PROFIT';
    rejectionDetail =
      `Gas cost ($${gasEstimate.gasCostUsd.toFixed(6)} [ESTIMATE]) >= gross profit ($${grossProfitUsd.toFixed(6)}). ` +
      `Opportunity not viable at this trade size / gas price.`;
  } else if (netExpectedProfitUsd < minNetProfitUsd) {
    status = 'REJECTED';
    rejectionReason = 'SPREAD_TOO_SMALL';
    rejectionDetail =
      `Net expected profit ($${netExpectedProfitUsd.toFixed(6)}) < minimum threshold ($${minNetProfitUsd}). ` +
      `Gross spread ${grossSpreadBps.toFixed(2)} bps insufficient after all frictions.`;
  }

  return {
    inputCapitalUsd,
    executableGrossOutputUsd,
    grossProfitUsd,
    grossSpreadBps,
    poolFeesUsd,
    poolFeeBps: quote.feeBps,
    gasCostUsd: gasEstimate.gasCostUsd,
    netProfitBeforeBufferUsd,
    riskBufferUsd,
    netExpectedProfitUsd,
    status,
    rejectionReason,
    rejectionDetail,
    gasEstimate,
    allAssumptions: assumptions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Decimal Normalization Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a USD amount to token's smallest unit (wei equivalent).
 * Used to set amountIn for quote calls.
 *
 * @param usd         USD amount (e.g., 1.00)
 * @param tokenPriceUsd  Price of 1 token unit in USD
 * @param decimals    Token decimals (e.g., 18 for WETH, 6 for USDC)
 */
export function usdToTokenAmount(
  usd: number,
  tokenPriceUsd: number,
  decimals: number
): bigint {
  if (tokenPriceUsd <= 0) {
    throw new Error(
      `[profitCalculator] tokenPriceUsd must be > 0. Got: ${tokenPriceUsd}`
    );
  }
  // token amount = usd / tokenPriceUsd
  const tokenAmount = usd / tokenPriceUsd;
  // Convert to smallest unit
  const rawAmount = tokenAmount * Math.pow(10, decimals);
  // Round to nearest integer
  return BigInt(Math.round(rawAmount));
}

/**
 * Normalize a raw token amount (bigint) to a human-readable decimal.
 *
 * @param rawAmount  Raw amount in token's smallest unit
 * @param decimals   Token decimals
 */
export function normalizeTokenAmount(rawAmount: bigint, decimals: number): number {
  return Number(rawAmount) / Math.pow(10, decimals);
}
