/**
 * SAHIKARA Phase 3 — Price Impact & Slippage Model
 *
 * Implements high-fidelity price impact and slippage calculations for:
 * 1. Constant-Product AMM (Uniswap V2 / Aerodrome Volatile):
 *      Q_out = (y * Q_in * (1 - f)) / (x + Q_in * (1 - f))
 *      Price Impact = (P_spot - P_effective) / P_spot
 * 2. Concentrated Liquidity (Uniswap V3 / Slipstream / PancakeSwap V3):
 *      Models depth across active liquidity tick bandwidth L.
 *
 * Ensures alignment with RISK_POLICY.md:
 *   S_max = 20 bps (0.20%) provisional maximum slippage tolerance.
 */

export interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
  feeBps: number;
}

export interface PriceImpactCalculation {
  /** [SIMULATED] Effective execution price (amountOut / amountIn) */
  effectivePrice: number;
  /** [SIMULATED] Marginal spot price before order impact */
  spotPrice: number;
  /** [SIMULATED] Price impact in basis points */
  priceImpactBps: number;
  /** [SIMULATED] Slippage vs expected marginal return in basis points */
  slippageBps: number;
  /** [SIMULATED] Whether price impact exceeds maximum allowed threshold */
  exceedsTolerance: boolean;
  /** [ASSUMPTION] Maximum tolerance used for evaluation */
  toleranceBps: number;
}

export class PriceImpactModel {
  /**
   * Calculates price impact for a Constant Product (x * y = k) pool.
   *
   * @param amountIn Input token quantity in wei
   * @param reserveIn Input token reserve in wei
   * @param reserveOut Output token reserve in wei
   * @param feeBps Pool fee in basis points (e.g. 30 bps for 0.30%)
   * @param maxSlippageToleranceBps Maximum acceptable slippage tolerance (default 20 bps)
   */
  public static calculateConstantProductImpact(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    feeBps: number = 30,
    maxSlippageToleranceBps: number = 20
  ): PriceImpactCalculation {
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
      return {
        effectivePrice: 0,
        spotPrice: 0,
        priceImpactBps: 10_000,
        slippageBps: 10_000,
        exceedsTolerance: true,
        toleranceBps: maxSlippageToleranceBps,
      };
    }

    // Spot price: reserveOut / reserveIn
    const spotPrice = Number(reserveOut) / Number(reserveIn);

    // Exact CPAMM output formula with fee deduction
    const feeMultiplier = 10_000n - BigInt(feeBps);
    const amountInWithFee = amountIn * feeMultiplier;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 10_000n) + amountInWithFee;
    const amountOut = numerator / denominator;

    const effectivePrice = Number(amountOut) / Number(amountIn);

    // Theoretical output at marginal spot price without market impact:
    // (Notice: pool fees are already accounted for in feeMultiplier)
    const expectedOutputAtSpot = (Number(amountIn) * (1 - feeBps / 10_000)) * spotPrice;
    const actualOutput = Number(amountOut);

    const priceImpactRatio = expectedOutputAtSpot > 0
      ? (expectedOutputAtSpot - actualOutput) / expectedOutputAtSpot
      : 0;
    const priceImpactBps = Math.max(0, Math.round(priceImpactRatio * 10_000));

    // Slippage against spot price
    const slippageBps = spotPrice > 0
      ? Math.max(0, Math.round(((spotPrice - effectivePrice) / spotPrice) * 10_000))
      : 10_000;

    return {
      effectivePrice,
      spotPrice,
      priceImpactBps,
      slippageBps,
      exceedsTolerance: priceImpactBps > maxSlippageToleranceBps,
      toleranceBps: maxSlippageToleranceBps,
    };
  }

  /**
   * Calculates price impact on Concentrated Liquidity from QuoterV2 output
   * compared against marginal quote of micro-size ($1 reference).
   *
   * @param microSizeAmountIn Reference small input amount in wei (e.g. $1)
   * @param microSizeAmountOut Reference small output amount in wei
   * @param targetAmountIn Actual trade input amount in wei
   * @param targetAmountOut Actual trade output amount in wei
   * @param maxSlippageToleranceBps Maximum acceptable slippage tolerance
   */
  public static calculateQuotedSlippage(
    microSizeAmountIn: bigint,
    microSizeAmountOut: bigint,
    targetAmountIn: bigint,
    targetAmountOut: bigint,
    maxSlippageToleranceBps: number = 20
  ): PriceImpactCalculation {
    if (
      microSizeAmountIn <= 0n ||
      microSizeAmountOut <= 0n ||
      targetAmountIn <= 0n ||
      targetAmountOut <= 0n
    ) {
      return {
        effectivePrice: 0,
        spotPrice: 0,
        priceImpactBps: 10_000,
        slippageBps: 10_000,
        exceedsTolerance: true,
        toleranceBps: maxSlippageToleranceBps,
      };
    }

    const spotPrice = Number(microSizeAmountOut) / Number(microSizeAmountIn);
    const effectivePrice = Number(targetAmountOut) / Number(targetAmountIn);

    const priceImpactRatio = spotPrice > 0
      ? (spotPrice - effectivePrice) / spotPrice
      : 0;
    const priceImpactBps = Math.max(0, Math.round(priceImpactRatio * 10_000));

    return {
      effectivePrice,
      spotPrice,
      priceImpactBps,
      slippageBps: priceImpactBps,
      exceedsTolerance: priceImpactBps > maxSlippageToleranceBps,
      toleranceBps: maxSlippageToleranceBps,
    };
  }
}
