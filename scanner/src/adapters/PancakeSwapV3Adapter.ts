/**
 * SAHIKARA Observer — PancakeSwap v3 Pool Adapter
 *
 * Quoting method: PancakeSwap V3 QuoterV2.quoteExactInputSingle via eth_call (read-only)
 *
 * PancakeSwap v3 concentrated liquidity pools follow the Uniswap v3 AMM model
 * and quoter interface on Base.
 *
 * SECURITY:
 *   - Strictly read-only eth_call
 *   - Zero private keys, zero wallet interaction
 *   - Never fabricates quotes
 */

import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';
import { PANCAKESWAP_V3_QUOTER_V2 } from '../config/pools.js';

const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
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

const FEE_BPS_TO_UINT24: Record<number, number> = {
  1: 100, // 0.01%
  5: 500, // 0.05%
  25: 2500, // 0.25%
  30: 3000, // 0.30%
  100: 10000, // 1.00%
};

export class PancakeSwapV3Adapter implements IPoolAdapter {
  public readonly protocol = 'pancakeswap-v3';

  constructor(private readonly dataSource: IDataSource) {}

  supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'pancakeswap-v3' && pool.status === 'active';
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

      const feeUint24 = FEE_BPS_TO_UINT24[pool.feeBps];
      if (feeUint24 === undefined) {
        return this._errorObservation(
          pool,
          blockNumber,
          timestamp,
          `Unknown fee tier: ${pool.feeBps} bps for PancakeSwap v3 pool.`,
          0
        );
      }

      const quoteStart = performance.now();
      const quoteResult = await this.dataSource.readContract<
        readonly [bigint, bigint, number, bigint]
      >({
        contractAddress: PANCAKESWAP_V3_QUOTER_V2,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn,
            fee: feeUint24,
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
        `PancakeSwap QuoterV2 call failed: ${message}`,
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
