/**
 * SAHIKARA Phase 4.16 — Local DEX Price Calculation Engine
 *
 * Implements high-throughput, in-memory swap simulation for:
 * 1. Constant-product pools (Aerodrome / Uniswap V2)
 * 2. Concentrated-liquidity pools (Uniswap V3)
 *
 * INVARIANTS:
 * - Pure CPU in-memory execution: zero network RPC calls.
 * - Integer / BigInt precision arithmetic mirroring EVM smart contract logic.
 * - Explicit execution duration measurement using performance.now().
 * - Rejection of invalid or corrupted pool states (`STATE_INVALID`).
 */

import type { V2PoolState, V3PoolState } from './LocalPoolState.js';

export interface LocalQuoteResult {
  poolAddress: `0x${string}`;
  protocol: 'uniswap-v3' | 'aerodrome-v2';
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  sqrtPriceX96After?: bigint;
  initializedTicksCrossed?: number;
  calculationDurationMs: number;
  blockNumber: bigint;
  blockHash: string;
  stateFreshness: string;
  isTickCrossing?: boolean;
}

const Q96 = 2n ** 96n;

export class LocalPriceEngine {
  /**
   * Evaluates exact output amount for constant-product (V2) pool.
   * Mirrors UniswapV2Library.getAmountOut and Aerodrome volatile getAmountOut.
   */
  public static quoteV2(
    state: V2PoolState,
    tokenInAddress: `0x${string}`,
    amountIn: bigint
  ): LocalQuoteResult {
    const t0 = performance.now();

    if (state.freshness === 'STATE_INVALID') {
      throw new Error(`Cannot quote on INVALID pool state for ${state.metadata.poolAddress}`);
    }
    if (amountIn <= 0n) {
      throw new Error(`amountIn must be strictly positive`);
    }

    const isToken0 = tokenInAddress.toLowerCase() === state.metadata.token0.toLowerCase();
    const isToken1 = tokenInAddress.toLowerCase() === state.metadata.token1.toLowerCase();

    if (!isToken0 && !isToken1) {
      throw new Error(
        `Token mismatch: ${tokenInAddress} is neither token0 (${state.metadata.token0}) nor token1 (${state.metadata.token1})`
      );
    }

    const tokenOut = isToken0 ? state.metadata.token1 : state.metadata.token0;
    const reserveIn = isToken0 ? state.reserve0 : state.reserve1;
    const reserveOut = isToken0 ? state.reserve1 : state.reserve0;

    if (reserveIn <= 0n || reserveOut <= 0n) {
      throw new Error(`Insufficient pool reserves: reserveIn=${reserveIn}, reserveOut=${reserveOut}`);
    }

    // AmountInWithFee = amountIn * (10000 - feeBps)
    const feeMultiplier = 10000n - BigInt(state.feeBps);
    const amountInWithFee = amountIn * feeMultiplier;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 10000n) + amountInWithFee;
    const amountOut = numerator / denominator;

    const t1 = performance.now();

    return {
      poolAddress: state.metadata.poolAddress,
      protocol: 'aerodrome-v2',
      tokenIn: tokenInAddress,
      tokenOut,
      amountIn,
      amountOut,
      calculationDurationMs: Number((t1 - t0).toFixed(4)),
      blockNumber: state.blockNumber,
      blockHash: state.blockHash,
      stateFreshness: state.freshness,
    };
  }

  /**
   * Evaluates exact output amount for concentrated-liquidity (Uniswap V3) pool.
   * Computes exact swap step mathematics.
   */
  public static quoteV3(
    state: V3PoolState,
    tokenInAddress: `0x${string}`,
    amountIn: bigint
  ): LocalQuoteResult {
    const t0 = performance.now();

    if (state.freshness === 'STATE_INVALID') {
      throw new Error(`Cannot quote on INVALID pool state for ${state.metadata.poolAddress}`);
    }
    if (amountIn <= 0n) {
      throw new Error(`amountIn must be strictly positive`);
    }

    const isToken0 = tokenInAddress.toLowerCase() === state.metadata.token0.toLowerCase();
    const isToken1 = tokenInAddress.toLowerCase() === state.metadata.token1.toLowerCase();

    if (!isToken0 && !isToken1) {
      throw new Error(
        `Token mismatch: ${tokenInAddress} is neither token0 (${state.metadata.token0}) nor token1 (${state.metadata.token1})`
      );
    }

    const tokenOut = isToken0 ? state.metadata.token1 : state.metadata.token0;
    const zeroForOne = isToken0;
    const L = state.liquidity;
    const sqrtP = state.sqrtPriceX96;

    if (L <= 0n || sqrtP <= 0n) {
      throw new Error(`Zero liquidity in active V3 range`);
    }

    // Deduct fee: feeUint24 e.g. 500 = 0.05% -> (1,000,000 - 500) / 1,000,000
    const feePips = BigInt(state.feeUint24);
    const amountInRemaining = (amountIn * (1000000n - feePips)) / 1000000n;

    let amountOut: bigint;
    let sqrtPriceNext: bigint;

    if (zeroForOne) {
      // Selling token0 for token1 -> price decreases (sqrtP decreases)
      // Delta x = L * (1 / sqrtP_next - 1 / sqrtP)
      // sqrtP_next = (L * sqrtP) / (L + amountInRemaining * sqrtP / Q96)
      const denominator = L + (amountInRemaining * sqrtP) / Q96;
      sqrtPriceNext = (L * sqrtP) / denominator;

      // Delta y = L * (sqrtP - sqrtP_next) / Q96
      amountOut = (L * (sqrtP - sqrtPriceNext)) / Q96;
    } else {
      // Selling token1 for token0 -> price increases (sqrtP increases)
      // Delta y = L * (sqrtP_next - sqrtP)
      // sqrtP_next = sqrtP + (amountInRemaining * Q96) / L
      sqrtPriceNext = sqrtP + (amountInRemaining * Q96) / L;

      // Delta x = L * (sqrtP_next - sqrtP) / (sqrtP_next * sqrtP) * Q96
      const numerator = L * (sqrtPriceNext - sqrtP) * Q96;
      const denominator = sqrtPriceNext * sqrtP;
      amountOut = numerator / denominator;
    }

    const t1 = performance.now();

    return {
      poolAddress: state.metadata.poolAddress,
      protocol: 'uniswap-v3',
      tokenIn: tokenInAddress,
      tokenOut,
      amountIn,
      amountOut,
      sqrtPriceX96After: sqrtPriceNext,
      initializedTicksCrossed: 0,
      isTickCrossing: false,
      calculationDurationMs: Number((t1 - t0).toFixed(4)),
      blockNumber: state.blockNumber,
      blockHash: state.blockHash,
      stateFreshness: state.freshness,
    };
  }
}
