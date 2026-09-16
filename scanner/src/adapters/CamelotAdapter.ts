/**
 * SAHIKARA Observer — Camelot DEX Pool Adapter
 * Phase 4.10: DEX Ecosystem Expansion
 *
 * PROTOCOL OVERVIEW:
 *   Camelot is the native AMM on Arbitrum One.
 *   Camelot v2 pairs support custom dynamic directional fees and referrer discounts.
 *
 * QUOTING METHOD:
 *   The pair contract exposes:
 *     function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)
 *   We query getAmountOut directly, which evaluates the exact directional fee and constant-product invariant.
 *
 * SECURITY:
 *   - Strictly read-only calls via IDataSource.
 *   - Zero private keys, zero wallet credentials.
 */

import { parseAbi, isAddressEqual } from 'viem';
import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

const CAMELOT_PAIR_ABI = parseAbi([
  'function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint16 token0FeePercent, uint16 token1FeePercent)',
]);

export class CamelotAdapter implements IPoolAdapter {
  public readonly protocol = 'camelot-v2';
  private readonly dataSource: IDataSource;

  constructor(dataSource: IDataSource) {
    this.dataSource = dataSource;
  }

  public supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'camelot-v2' && pool.status === 'active';
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
        error: `CamelotAdapter does not support protocol: ${pool.protocol}`,
        rpcLatencyMs: 0,
      };
    }

    try {
      const isToken0In = isAddressEqual(tokenInAddress, pool.token0.address);
      const tokenInDef = isToken0In ? pool.token0 : pool.token1;
      const tokenOutDef = isToken0In ? pool.token1 : pool.token0;

      const amountOut = await this._read<bigint>({
        address: pool.poolAddress,
        abi: CAMELOT_PAIR_ABI,
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
          error: 'Camelot getAmountOut returned zero output',
          rpcLatencyMs: quoteLatencyMs,
        };
      }

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenInDef.symbol,
        tokenOutSymbol: tokenOutDef.symbol,
        feeBps: pool.feeBps > 0 ? pool.feeBps : 30, // Camelot base fee is typically 30 bps
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
        error: `Camelot quote failed: ${msg.slice(0, 120)}`,
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
