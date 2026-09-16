/**
 * SAHIKARA Observer — Velodrome V2 Pool Adapter
 * Phase 4.10: DEX Ecosystem Expansion
 *
 * PROTOCOL OVERVIEW:
 *   Velodrome is the primary native AMM on Optimism.
 *   Velodrome v2 supports two pool types:
 *     1. Volatile pools (x·y=k constant product invariant)
 *     2. Stable pools (x³y + y³x = k stableswap invariant)
 *
 * QUOTING METHOD:
 *   Both pool types implement:
 *     function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)
 *   We query getAmountOut directly, which calculates the exact output including pool fees.
 *
 * SECURITY:
 *   - Strictly read-only calls via IDataSource.
 *   - Zero private keys, zero signing, zero wallet credentials.
 */

import { parseAbi, isAddressEqual } from 'viem';
import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

const VELODROME_POOL_ABI = parseAbi([
  'function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)',
  'function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)',
  'function stable() external view returns (bool)',
  'function fee() external view returns (uint256)',
]);

export class VelodromeAdapter implements IPoolAdapter {
  public readonly protocol = 'velodrome-v2';
  private readonly dataSource: IDataSource;

  constructor(dataSource: IDataSource) {
    this.dataSource = dataSource;
  }

  public supports(pool: PoolDefinition): boolean {
    return (
      (pool.protocol === 'velodrome-v2-volatile' || pool.protocol === 'velodrome-v2-stable') &&
      pool.status === 'active'
    );
  }

  public async getQuote(
    pool: PoolDefinition,
    amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    return this.getDirectionalQuote(pool, pool.token0.address, amountInUsd, amountIn, blockNumber);
  }

  public async getDirectionalQuote(
    pool: PoolDefinition,
    tokenInAddress: `0x${string}`,
    _amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    const startTime = Date.now();

    if (!this.supports(pool)) {
      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: '',
        quote: null,
        error: `VelodromeAdapter does not support protocol: ${pool.protocol}`,
        rpcLatencyMs: 0,
      };
    }

    try {
      const isToken0In = isAddressEqual(tokenInAddress, pool.token0.address);
      const tokenInDef = isToken0In ? pool.token0 : pool.token1;
      const tokenOutDef = isToken0In ? pool.token1 : pool.token0;

      const amountOut = await this._read<bigint>({
        address: pool.poolAddress,
        abi: VELODROME_POOL_ABI,
        functionName: 'getAmountOut',
        args: [amountIn, tokenInDef.address],
        blockNumber,
      });

      const quoteLatencyMs = Date.now() - startTime;

      if (!amountOut || amountOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: 'Velodrome getAmountOut returned zero output',
          rpcLatencyMs: quoteLatencyMs,
        };
      }

      const isStable = pool.protocol === 'velodrome-v2-stable';
      const feeBps = pool.feeBps > 0 ? pool.feeBps : (isStable ? 5 : 30); // 5 bps stable, 30 bps volatile

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenInDef.symbol,
        tokenOutSymbol: tokenOutDef.symbol,
        feeBps,
        priceImpactBps: 0,
        quoteLatencyMs,
      };

      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: JSON.stringify({
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          tokenIn: tokenInDef.address,
          isStable,
        }),
        quote,
        error: null,
        rpcLatencyMs: quoteLatencyMs,
      };
    } catch (err: unknown) {
      const quoteLatencyMs = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: '',
        quote: null,
        error: `Velodrome quote failed: ${msg.slice(0, 120)}`,
        rpcLatencyMs: quoteLatencyMs,
      };
    }
  }

  private async _read<T>(params: {
    address: `0x${string}`;
    abi: readonly object[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<T> {
    const res = await this.dataSource.readContract({
      contractAddress: params.address,
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      blockNumber: params.blockNumber && params.blockNumber > 0n ? params.blockNumber : undefined,
    });
    if (res !== null && typeof res === 'object' && 'data' in res) {
      return res.data as T;
    }
    return res as T;
  }
}
