/**
 * SAHIKARA Observer — Aerodrome Slipstream Pool Adapter
 *
 * Quoting method: Aerodrome Slipstream MixedQuoterV3.quoteExactInputSingleV3
 * via eth_call (read-only).
 *
 * Aerodrome Slipstream is Aerodrome's concentrated liquidity AMM deployed on Base.
 * It uses tick spacing to designate fee tiers and pool parameters:
 *   - ts = 1   -> 0.01% fee (stable/pegged pairs)
 *   - ts = 50  -> 0.05% fee (major pairs like WETH/USDC)
 *   - ts = 100 -> 0.30% fee (standard volatile pairs)
 *   - ts = 200 -> 1.00% fee (exotic pairs)
 *
 * SECURITY:
 *   - Strictly read-only eth_call
 *   - Zero private keys, zero wallet interaction
 *   - Never fabricates quotes
 */

import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';
import { AERODROME_SLIPSTREAM_QUOTER } from '../config/pools.js';

const SLIPSTREAM_QUOTER_ABI = [
  {
    name: 'quoteExactInputSingleV3',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'tickSpacing', type: 'int24' },
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

/**
 * Fallback mapping from fee basis points to Aerodrome Slipstream tick spacing.
 */
const FEE_BPS_TO_TICK_SPACING: Record<number, number> = {
  1: 1,     // 0.01% -> tickSpacing 1
  5: 50,    // 0.05% -> tickSpacing 50
  30: 100,  // 0.30% -> tickSpacing 100
  100: 200, // 1.00% -> tickSpacing 200
};

export class AerodromeSlipstreamAdapter implements IPoolAdapter {
  public readonly protocol = 'aerodrome-slipstream';

  constructor(private readonly dataSource: IDataSource) {}

  supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'aerodrome-slipstream' && pool.status === 'active';
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

      const tickSpacing = pool.tickSpacing ?? FEE_BPS_TO_TICK_SPACING[pool.feeBps];
      if (tickSpacing === undefined) {
        return this._errorObservation(
          pool,
          blockNumber,
          timestamp,
          `Unknown tickSpacing or fee tier: ${pool.feeBps} bps for Aerodrome Slipstream pool.`,
          0
        );
      }

      const quoteStart = performance.now();
      const quoteResult = await this.dataSource.readContract<
        readonly [bigint, bigint, number, bigint]
      >({
        contractAddress: AERODROME_SLIPSTREAM_QUOTER,
        abi: SLIPSTREAM_QUOTER_ABI,
        functionName: 'quoteExactInputSingleV3',
        args: [
          {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn,
            tickSpacing,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const quoteLatencyMs = Math.round(performance.now() - quoteStart);
      const [amountOut, sqrtPriceX96After, initializedTicksCrossed] = quoteResult.data;

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenIn.symbol,
        tokenOutSymbol: tokenOut.symbol,
        feeBps: pool.feeBps,
        priceImpactBps: 0,
        sqrtPriceX96: sqrtPriceX96After,
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
          tickSpacing,
        }),
        quote,
        error: null,
        rpcLatencyMs: quoteLatencyMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this._errorObservation(
        pool,
        blockNumber,
        timestamp,
        `Aerodrome Slipstream Quoter call failed: ${message}`,
        0
      );
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
