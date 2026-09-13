/**
 * SAHIKARA Observer — Uniswap v3 Pool Adapter
 *
 * STATUS: COMPLETE
 *
 * Quoting method: QuoterV2.quoteExactInputSingle via eth_call (read-only)
 *   - Returns exact executable output amount for a given input
 *   - Accounts for tick state, active liquidity, and fee tier
 *   - Does NOT assume zero slippage
 *   - Each call costs ~1 RPC compute unit (safe for research polling intervals)
 *
 * LIMITATIONS (documented per spec):
 *   1. [ASSUMPTION] QuoterV2 address: 0x3d4e44Eb1374240CE5F1B13678dadB69BA684Bb on Base.
 *      Must be verified against official Uniswap Base deployment docs.
 *   2. [ASSUMPTION] Gas units for Uniswap v3 swap: 150,000 units (includes tick-crossing buffer).
 *      Actual gas varies by number of tick crossings. See LIQUIDITY_RESEARCH.md.
 *   3. QuoterV2 eth_call itself consumes ~80k–150k gas in simulation — this is not
 *      charged to our account but counts toward RPC compute units.
 *   4. The quote may be stale by the time an execution would occur in Phase 5+.
 *      Phase 1C is observation only — staleness is acceptable for research.
 *
 * SECURITY:
 *   - No private key
 *   - No wallet instantiation
 *   - No transaction signing
 *   - Uses viem publicClient.readContract (eth_call only)
 *
 * References:
 *   - QuoterV2 ABI: https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/QuoterV2.sol
 *   - Base Deployments: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
 */

import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';
import { UNISWAP_V3_QUOTER_V2 } from '../config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// QuoterV2 ABI (minimal — only what we need)
// ─────────────────────────────────────────────────────────────────────────────

const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable', // QuoterV2 uses non-view but eth_call is still read-only
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

// Pool ABI for reading slot0 and liquidity
const POOL_ABI = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    name: 'liquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
] as const;

// Fee tier mapping: feeBps -> uint24 fee (as used in Uniswap v3 contracts)
const FEE_BPS_TO_UINT24: Record<number, number> = {
  1: 100,     // 0.01%
  5: 500,     // 0.05%
  30: 3000,   // 0.30%
  100: 10000, // 1.00%
};

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class UniswapV3Adapter implements IPoolAdapter {
  public readonly protocol = 'uniswap-v3';

  constructor(private readonly dataSource: IDataSource) {}

  supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'uniswap-v3' && pool.status === 'active';
  }

  async getQuote(
    pool: PoolDefinition,
    amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    return this.getDirectionalQuote(
      pool,
      pool.token0.address,
      amountInUsd,
      amountIn,
      blockNumber
    );
  }

  async getDirectionalQuote(
    pool: PoolDefinition,
    tokenInAddress: `0x${string}`,
    _amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    const timestamp = Date.now();

    try {
      const isToken0In = tokenInAddress.toLowerCase() === pool.token0.address.toLowerCase();
      const tokenIn = isToken0In ? pool.token0 : pool.token1;
      const tokenOut = isToken0In ? pool.token1 : pool.token0;

      // ── 1. Read pool state (slot0 + liquidity) ──────────────────────────
      const [slot0Result, liquidityResult] = await Promise.all([
        this.dataSource.readContract<readonly [bigint, number, number, number, number, number, boolean]>({
          contractAddress: pool.poolAddress,
          abi: POOL_ABI,
          functionName: 'slot0',
        }),
        this.dataSource.readContract<bigint>({
          contractAddress: pool.poolAddress,
          abi: POOL_ABI,
          functionName: 'liquidity',
        }),
      ]);

      const slot0 = slot0Result.data;
      const sqrtPriceX96 = slot0[0];
      const currentTick = slot0[1];
      const liquidity = liquidityResult.data;

      // Check for zero liquidity
      if (liquidity === 0n || sqrtPriceX96 === 0n) {
        return this._errorObservation(pool, blockNumber, timestamp,
          'Pool has zero liquidity or uninitialized price.', slot0Result.latencyMs);
      }

      // ── 2. Build QuoterV2 call parameters ────────────────────────────────
      const feeUint24 = FEE_BPS_TO_UINT24[pool.feeBps];
      if (feeUint24 === undefined) {
        return this._errorObservation(pool, blockNumber, timestamp,
          `Unknown fee tier: ${pool.feeBps} bps. Not a standard Uniswap v3 fee tier.`,
          slot0Result.latencyMs);
      }

      // ── 3. Call QuoterV2.quoteExactInputSingle ──────────────────────────
      // This uses eth_call — read-only. No transaction is submitted.
      const quoteStart = performance.now();
      const quoteResult = await this.dataSource.readContract<readonly [bigint, bigint, number, bigint]>({
        contractAddress: UNISWAP_V3_QUOTER_V2,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn,
            fee: feeUint24,
            sqrtPriceLimitX96: 0n, // 0 = no price limit
          },
        ],
      });
      const quoteLatencyMs = Math.round(performance.now() - quoteStart);

      const [amountOut, sqrtPriceX96After, initializedTicksCrossed] = quoteResult.data;

      // ── 4. Calculate price impact ─────────────────────────────────────────
      // Price impact = 1 - (sqrtPriceAfter / sqrtPriceBefore)²
      // For small trades on Base, this will be near zero per LIQUIDITY_RESEARCH.md
      const sqrtRatio = Number(sqrtPriceX96After) / Number(sqrtPriceX96);
      const priceImpactFraction = Math.abs(1 - sqrtRatio * sqrtRatio);
      const priceImpactBps = priceImpactFraction * 10000;

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenIn.symbol,
        tokenOutSymbol: tokenOut.symbol,
        feeBps: pool.feeBps,
        priceImpactBps,
        sqrtPriceX96,
        currentTick,
        liquidity,
        crossedTick: initializedTicksCrossed > 0,
        quoteLatencyMs,
      };

      return {
        pool,
        blockNumber,
        timestamp,
        rawQuoteJson: JSON.stringify({
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          tokenIn: tokenIn.symbol,
          tokenOut: tokenOut.symbol,
          sqrtPriceX96After: sqrtPriceX96After.toString(),
          initializedTicksCrossed,
          slot0: {
            sqrtPriceX96: sqrtPriceX96.toString(),
            tick: currentTick,
          },
          liquidity: liquidity.toString(),
        }),
        quote,
        error: null,
        rpcLatencyMs: slot0Result.latencyMs + quoteLatencyMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this._errorObservation(pool, blockNumber, timestamp,
        `QuoterV2 call failed: ${message}`, 0);
    }
  }

  private _errorObservation(
    pool: PoolDefinition,
    blockNumber: bigint,
    timestamp: number,
    error: string,
    rpcLatencyMs: number
  ): PoolObservation {
    return {
      pool,
      blockNumber,
      timestamp,
      rawQuoteJson: JSON.stringify({ error }),
      quote: null,
      error,
      rpcLatencyMs,
    };
  }
}
