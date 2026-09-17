/**
 * SAHIKARA Phase 4.17 — Production-Grade Local DEX Price Calculation Engine
 *
 * Implements high-throughput, in-memory swap simulation for:
 * 1. Constant-product pools (Aerodrome / Uniswap V2)
 * 2. Concentrated-liquidity pools (Uniswap V3) with full multi-tick traversal
 *
 * INVARIANTS:
 * - Pure CPU in-memory execution: zero network RPC calls.
 * - Integer / BigInt precision arithmetic mirroring EVM smart contract logic.
 * - Exact tick bitmap traversal across positive and negative tick words.
 * - Explicit fail-closed behavior on missing tick data (`STATE_INCOMPLETE`).
 * - Rejection of invalid or corrupted pool states (`STATE_INVALID`).
 */

import { TickMath } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import type { V2PoolState, V3PoolState } from './LocalPoolState.js';

export interface LocalQuoteResult {
  poolAddress: `0x${string}`;
  protocol: 'uniswap-v3' | 'aerodrome-v2';
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  feePaid?: bigint;
  sqrtPriceX96After?: bigint;
  finalTick?: number;
  initializedTicksCrossed?: number;
  calculationDurationMs: number;
  blockNumber: bigint;
  blockHash: string;
  stateFreshness: string;
  isTickCrossing?: boolean;
}

const Q96 = 2n ** 96n;
const MAX_UINT256 = (1n << 256n) - 1n;

export class LocalPriceEngine {
  /**
   * Finds the most significant bit in a positive BigInt.
   */
  public static mostSignificantBit(x: bigint): number {
    if (x <= 0n) throw new Error('MSB of zero or negative integer');
    let r = 0;
    let n = x;
    while (n > 0n) {
      n >>= 1n;
      r++;
    }
    return r - 1;
  }

  /**
   * Finds the least significant bit in a positive BigInt.
   */
  public static leastSignificantBit(x: bigint): number {
    if (x <= 0n) throw new Error('LSB of zero or negative integer');
    let r = 0;
    let n = x;
    while ((n & 1n) === 0n && r < 256) {
      n >>= 1n;
      r++;
    }
    return r;
  }

  /**
   * Searches the next initialized tick within a single 256-bit bitmap word.
   */
  public static nextInitializedTickWithinOneWord(
    tickBitmap: Map<number, bigint>,
    tick: number,
    tickSpacing: number,
    lte: boolean
  ): { next: number; initialized: boolean } {
    let compressed = Math.floor(tick / tickSpacing);

    if (lte) {
      const wordPos = Math.floor(compressed / 256);
      const bitPos = ((compressed % 256) + 256) % 256;
      const word = tickBitmap.get(wordPos) ?? 0n;
      const mask = (1n << BigInt(bitPos + 1)) - 1n;
      const masked = word & mask;
      const initialized = masked !== 0n;
      const next = initialized
        ? (wordPos * 256 + LocalPriceEngine.mostSignificantBit(masked)) * tickSpacing
        : (wordPos * 256) * tickSpacing;
      return { next, initialized };
    } else {
      compressed = compressed + 1;
      const wordPos = Math.floor(compressed / 256);
      const bitPos = ((compressed % 256) + 256) % 256;
      const word = tickBitmap.get(wordPos) ?? 0n;
      const mask = ~((1n << BigInt(bitPos)) - 1n) & MAX_UINT256;
      const masked = word & mask;
      const initialized = masked !== 0n;
      const next = initialized
        ? (wordPos * 256 + LocalPriceEngine.leastSignificantBit(masked)) * tickSpacing
        : (wordPos * 256 + 255) * tickSpacing;
      return { next, initialized };
    }
  }

  /**
   * Searches across consecutive bitmap words to locate the next initialized tick.
   */
  public static findNextInitializedTick(
    state: V3PoolState,
    tick: number,
    zeroForOne: boolean,
    maxWordSteps = 256
  ): { nextTick: number; initialized: boolean } {
    const lte = zeroForOne;
    let currentTick = tick;

    for (let i = 0; i < maxWordSteps; i++) {
      const res = LocalPriceEngine.nextInitializedTickWithinOneWord(
        state.tickBitmap,
        currentTick,
        state.tickSpacing,
        lte
      );
      if (res.initialized) {
        return { nextTick: res.next, initialized: true };
      }
      // Step to next word boundary
      if (lte) {
        currentTick = res.next - state.tickSpacing;
        if (currentTick < TickMath.MIN_TICK) {
          return { nextTick: TickMath.MIN_TICK, initialized: false };
        }
      } else {
        currentTick = res.next;
        if (currentTick > TickMath.MAX_TICK) {
          return { nextTick: TickMath.MAX_TICK, initialized: false };
        }
      }
    }

    return { nextTick: currentTick, initialized: false };
  }

  /**
   * Fixed-point division with ceiling rounding (FullMath.mulDivRoundingUp).
   */
  public static mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
    const product = a * b;
    let result = product / denominator;
    if (product % denominator !== 0n) {
      result += 1n;
    }
    return result;
  }

  /**
   * Calculates token0 delta between two sqrt prices (SqrtPriceMath.getAmount0Delta).
   */
  public static getAmount0Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    const [sqrtRatioLowerX96, sqrtRatioUpperX96] = sqrtRatioAX96 < sqrtRatioBX96
      ? [sqrtRatioAX96, sqrtRatioBX96]
      : [sqrtRatioBX96, sqrtRatioAX96];

    const numerator1 = liquidity << 96n;
    const numerator2 = sqrtRatioUpperX96 - sqrtRatioLowerX96;

    if (roundUp) {
      return LocalPriceEngine.mulDivRoundingUp(
        LocalPriceEngine.mulDivRoundingUp(numerator1, numerator2, sqrtRatioUpperX96),
        1n,
        sqrtRatioLowerX96
      );
    } else {
      return ((numerator1 * numerator2) / sqrtRatioUpperX96) / sqrtRatioLowerX96;
    }
  }

  /**
   * Calculates token1 delta between two sqrt prices (SqrtPriceMath.getAmount1Delta).
   */
  public static getAmount1Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    const [sqrtRatioLowerX96, sqrtRatioUpperX96] = sqrtRatioAX96 < sqrtRatioBX96
      ? [sqrtRatioAX96, sqrtRatioBX96]
      : [sqrtRatioBX96, sqrtRatioAX96];

    const diff = sqrtRatioUpperX96 - sqrtRatioLowerX96;

    if (roundUp) {
      return LocalPriceEngine.mulDivRoundingUp(liquidity, diff, Q96);
    } else {
      return (liquidity * diff) / Q96;
    }
  }

  /**
   * Computes next sqrt price given input amount (SqrtPriceMath.getNextSqrtPriceFromInput).
   */
  public static getNextSqrtPriceFromInput(
    sqrtPX96: bigint,
    liquidity: bigint,
    amountIn: bigint,
    zeroForOne: boolean
  ): bigint {
    if (zeroForOne) {
      const product = amountIn * sqrtPX96;
      const denominator = (liquidity << 96n) + product;
      return LocalPriceEngine.mulDivRoundingUp(liquidity << 96n, sqrtPX96, denominator);
    } else {
      const quotient = (amountIn << 96n) / liquidity;
      return sqrtPX96 + quotient;
    }
  }

  /**
   * Computes swap step result for a single bounded tick range (SwapMath.computeSwapStep).
   */
  public static computeSwapStep(
    sqrtCurrent: bigint,
    sqrtTarget: bigint,
    liquidity: bigint,
    amountRemaining: bigint,
    feePips: bigint
  ): [bigint, bigint, bigint, bigint] {
    const zeroForOne = sqrtCurrent >= sqrtTarget;
    const amountRemainingLessFee = (amountRemaining * (1000000n - feePips)) / 1000000n;

    const amountIn = zeroForOne
      ? LocalPriceEngine.getAmount0Delta(sqrtTarget, sqrtCurrent, liquidity, true)
      : LocalPriceEngine.getAmount1Delta(sqrtCurrent, sqrtTarget, liquidity, true);

    let sqrtNext: bigint;
    if (amountRemainingLessFee >= amountIn) {
      sqrtNext = sqrtTarget;
    } else {
      sqrtNext = LocalPriceEngine.getNextSqrtPriceFromInput(sqrtCurrent, liquidity, amountRemainingLessFee, zeroForOne);
    }

    const max = sqrtTarget === sqrtNext;
    let stepAmountIn: bigint;
    let stepAmountOut: bigint;

    if (zeroForOne) {
      stepAmountIn = max ? amountIn : LocalPriceEngine.getAmount0Delta(sqrtNext, sqrtCurrent, liquidity, true);
      stepAmountOut = LocalPriceEngine.getAmount1Delta(sqrtNext, sqrtCurrent, liquidity, false);
    } else {
      stepAmountIn = max ? amountIn : LocalPriceEngine.getAmount1Delta(sqrtCurrent, sqrtNext, liquidity, true);
      stepAmountOut = LocalPriceEngine.getAmount0Delta(sqrtCurrent, sqrtNext, liquidity, false);
    }

    let feeAmount: bigint;
    if (!max) {
      feeAmount = amountRemaining - stepAmountIn;
    } else {
      feeAmount = LocalPriceEngine.mulDivRoundingUp(stepAmountIn, feePips, 1000000n - feePips);
    }

    return [sqrtNext, stepAmountIn, stepAmountOut, feeAmount];
  }

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

    if (state.freshness === 'STATE_INVALID' || state.lifecycle === 'INVALID' || state.lifecycle === 'RESYNC_REQUIRED') {
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
   * Evaluates exact multi-tick swap output for Uniswap V3 pool.
   */
  public static quoteV3MultiTick(
    state: V3PoolState,
    tokenInAddress: `0x${string}`,
    amountIn: bigint,
    maxTickCrossings = 100
  ): LocalQuoteResult {
    const t0 = performance.now();

    if (state.freshness === 'STATE_INVALID' || state.lifecycle === 'INVALID' || state.lifecycle === 'RESYNC_REQUIRED') {
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
    const feePips = BigInt(state.feeUint24);

    let currentSqrtP = state.sqrtPriceX96;
    let currentTick = state.tick;
    let currentLiquidity = state.liquidity;
    let amountRemaining = amountIn;
    let totalAmountOut = 0n;
    let totalFee = 0n;
    let ticksCrossed = 0;

    if (currentSqrtP <= 0n) {
      throw new Error(`Invalid sqrtPriceX96 in V3 pool state`);
    }

    while (amountRemaining > 0n) {
      if (currentLiquidity <= 0n) {
        throw new Error(`Zero liquidity encountered during V3 multi-tick traversal`);
      }

      // 1. Find next initialized tick in swap direction
      const { nextTick, initialized } = LocalPriceEngine.findNextInitializedTick(
        state,
        currentTick,
        zeroForOne
      );

      // Determine target sqrtPrice for step
      const targetTick = initialized
        ? nextTick
        : (zeroForOne ? TickMath.MIN_TICK : TickMath.MAX_TICK);

      const sqrtRatioTargetX96 = BigInt(TickMath.getSqrtRatioAtTick(targetTick).toString());

      // 2. Compute swap step
      const [sqrtNext, stepAmountIn, stepAmountOut, feeAmount] = LocalPriceEngine.computeSwapStep(
        currentSqrtP,
        sqrtRatioTargetX96,
        currentLiquidity,
        amountRemaining,
        feePips
      );

      amountRemaining -= (stepAmountIn + feeAmount);
      totalAmountOut += stepAmountOut;
      totalFee += feeAmount;
      currentSqrtP = sqrtNext;

      // 3. Check if we reached the boundary tick
      if (sqrtNext === sqrtRatioTargetX96) {
        if (!initialized) {
          // Reached word boundary without finding initialized tick
          throw new Error(`STATE_INCOMPLETE: Missing initialized tick data beyond tick ${targetTick}`);
        }

        const tickInfo = state.initializedTicks.get(nextTick);
        if (!tickInfo) {
          throw new Error(`STATE_INCOMPLETE: Tick ${nextTick} initialized in bitmap but missing from initializedTicks`);
        }

        // Cross tick: apply liquidityNet
        if (zeroForOne) {
          currentLiquidity -= tickInfo.liquidityNet;
          currentTick = nextTick - 1;
        } else {
          currentLiquidity += tickInfo.liquidityNet;
          currentTick = nextTick;
        }

        ticksCrossed++;
        if (ticksCrossed > maxTickCrossings) {
          throw new Error(`MAX_TICK_CROSSINGS_EXCEEDED: Crossed ${ticksCrossed} ticks`);
        }
      } else {
        // Swap finished inside current tick range
        const jsbiHelper = JSBI as unknown as { BigInt: (v: string) => Parameters<typeof TickMath.getTickAtSqrtRatio>[0] };
        const jsbiSqrt = jsbiHelper.BigInt(currentSqrtP.toString());
        currentTick = TickMath.getTickAtSqrtRatio(jsbiSqrt);
        break;
      }
    }

    const t1 = performance.now();

    return {
      poolAddress: state.metadata.poolAddress,
      protocol: 'uniswap-v3',
      tokenIn: tokenInAddress,
      tokenOut,
      amountIn,
      amountOut: totalAmountOut,
      feePaid: totalFee,
      sqrtPriceX96After: currentSqrtP,
      finalTick: currentTick,
      initializedTicksCrossed: ticksCrossed,
      isTickCrossing: ticksCrossed > 0,
      calculationDurationMs: Number((t1 - t0).toFixed(4)),
      blockNumber: state.blockNumber,
      blockHash: state.blockHash,
      stateFreshness: state.freshness,
    };
  }

  /**
   * General V3 quote entry point. Dispatches to multi-tick traversal if ticks are initialized,
   * or evaluates exact single-step swap if state contains active tick liquidity only.
   */
  public static quoteV3(
    state: V3PoolState,
    tokenInAddress: `0x${string}`,
    amountIn: bigint
  ): LocalQuoteResult {
    if (state.initializedTicks && state.initializedTicks.size > 0 && state.tickBitmap && state.tickBitmap.size > 0) {
      return LocalPriceEngine.quoteV3MultiTick(state, tokenInAddress, amountIn);
    }

    // Fallback: active-tick single-step pricing
    const t0 = performance.now();

    if (state.freshness === 'STATE_INVALID' || state.lifecycle === 'INVALID' || state.lifecycle === 'RESYNC_REQUIRED') {
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

    const feePips = BigInt(state.feeUint24);
    const amountInRemaining = (amountIn * (1000000n - feePips)) / 1000000n;

    let amountOut: bigint;
    let sqrtPriceNext: bigint;

    if (zeroForOne) {
      const denominator = L + (amountInRemaining * sqrtP) / Q96;
      sqrtPriceNext = (L * sqrtP) / denominator;
      amountOut = (L * (sqrtP - sqrtPriceNext)) / Q96;
    } else {
      sqrtPriceNext = sqrtP + (amountInRemaining * Q96) / L;
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

