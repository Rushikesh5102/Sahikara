/**
 * SAHIKARA Observer — SushiSwap V2 Pool Adapter
 * Phase 4.10: DEX Ecosystem Expansion
 *
 * PROTOCOL OVERVIEW:
 *   SushiSwap V2 uses the classic Uniswap V2 constant-product invariant: x·y=k
 *   with a fixed 30 basis points (0.30%) swap fee.
 *   Deployed across Base, Arbitrum One, Optimism, and Polygon PoS.
 *
 * QUOTING METHOD:
 *   Directly reads getReserves() on the pair contract and calculates exact output:
 *     amountInWithFee = amountIn * 997
 *     amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee)
 *
 * SECURITY:
 *   - Strictly read-only calls via IDataSource.
 *   - Zero private keys, zero signing, zero wallet credentials.
 */

import { parseAbi, isAddressEqual } from 'viem';
import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

const SUSHISWAP_PAIR_ABI = parseAbi([
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
]);

export class SushiSwapAdapter implements IPoolAdapter {
  public readonly protocol = 'sushiswap-v2';
  private readonly dataSource: IDataSource;

  constructor(dataSource: IDataSource) {
    this.dataSource = dataSource;
  }

  public supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'sushiswap-v2' && pool.status === 'active';
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
        error: `SushiSwapAdapter does not support protocol: ${pool.protocol}`,
        rpcLatencyMs: 0,
      };
    }

    try {
      const [reserve0, reserve1] = await this._read<[bigint, bigint, number]>({
        address: pool.poolAddress,
        abi: SUSHISWAP_PAIR_ABI,
        functionName: 'getReserves',
        blockNumber,
      });

      const isToken0In = isAddressEqual(tokenInAddress, pool.token0.address);
      const tokenInDef = isToken0In ? pool.token0 : pool.token1;
      const tokenOutDef = isToken0In ? pool.token1 : pool.token0;

      const reserveIn = isToken0In ? reserve0 : reserve1;
      const reserveOut = isToken0In ? reserve1 : reserve0;

      if (reserveIn === 0n || reserveOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: 'SushiSwap pool has zero reserves',
          rpcLatencyMs: Date.now() - startTime,
        };
      }

      // SushiSwap v2 standard: 30 bps fee (997/1000)
      const feeBps = pool.feeBps > 0 ? BigInt(pool.feeBps) : 30n;
      const feeMultiplier = 10000n - feeBps;

      const amountInWithFee = amountIn * feeMultiplier;
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * 10000n + amountInWithFee;
      const amountOut = numerator / denominator;

      const quoteLatencyMs = Date.now() - startTime;

      if (amountOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: 'SushiSwap quote returned zero output (amountIn too small)',
          rpcLatencyMs: quoteLatencyMs,
        };
      }

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenInDef.symbol,
        tokenOutSymbol: tokenOutDef.symbol,
        feeBps: Number(feeBps),
        priceImpactBps: Number((amountIn * 10000n) / reserveIn),
        quoteLatencyMs,
      };

      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: JSON.stringify({
          reserveIn: reserveIn.toString(),
          reserveOut: reserveOut.toString(),
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
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
        error: `SushiSwap quote failed: ${msg.slice(0, 120)}`,
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
