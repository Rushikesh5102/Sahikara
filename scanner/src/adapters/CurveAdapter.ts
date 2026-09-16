/**
 * SAHIKARA Observer — Curve Finance Stableswap Pool Adapter
 * Phase 4.10: DEX Ecosystem Expansion
 *
 * PROTOCOL OVERVIEW:
 *   Curve Stableswap implements the bonding curve invariant:
 *     A * n^n * sum(x_i) + D = A * D * n^n + D^(n+1) / (n^n * prod(x_i))
 *   It is optimized for low slippage between tightly pegged assets (USDC/USDT, etc.).
 *
 * QUOTING METHOD:
 *   Curve pool contracts expose the view function:
 *     function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)
 *   or:
 *     function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256)
 *   which returns exact output amount after protocol swap fees.
 *   [FACT] Output already accounts for swap fees — do NOT double-count.
 *
 * SECURITY:
 *   - No private keys, signers, or wallet credentials.
 *   - Strictly read-only calls via IDataSource.
 */

import { parseAbi, isAddressEqual } from 'viem';
import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

const CURVE_POOL_ABI = parseAbi([
  'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
  'function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256)',
  'function coins(uint256 i) external view returns (address)',
  'function fee() external view returns (uint256)',
]);

export class CurveAdapter implements IPoolAdapter {
  public readonly protocol = 'curve-stableswap';
  private readonly dataSource: IDataSource;

  constructor(dataSource: IDataSource) {
    this.dataSource = dataSource;
  }

  public supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'curve-stableswap' && pool.status === 'active';
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
        error: `CurveAdapter does not support protocol: ${pool.protocol}`,
        rpcLatencyMs: 0,
      };
    }

    try {
      // Determine index i (tokenIn) and index j (tokenOut)
      const isToken0In = isAddressEqual(tokenInAddress, pool.token0.address);
      const tokenInDef = isToken0In ? pool.token0 : pool.token1;
      const tokenOutDef = isToken0In ? pool.token1 : pool.token0;

      const i = isToken0In ? 0 : 1;
      const j = isToken0In ? 1 : 0;

      // Try get_dy with int128, fallback to uint256
      let amountOut: bigint;
      try {
        amountOut = (await this._read<bigint>({
          address: pool.poolAddress,
          abi: CURVE_POOL_ABI,
          functionName: 'get_dy',
          args: [BigInt(i), BigInt(j), amountIn],
          blockNumber,
        }));
      } catch {
        // Fallback for pools with int128 signature
        amountOut = (await this._read<bigint>({
          address: pool.poolAddress,
          abi: [
            {
              name: 'get_dy',
              type: 'function',
              stateMutability: 'view',
              inputs: [
                { name: 'i', type: 'int128' },
                { name: 'j', type: 'int128' },
                { name: 'dx', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'get_dy',
          args: [i, j, amountIn],
          blockNumber,
        }));
      }

      const quoteLatencyMs = Date.now() - startTime;

      if (!amountOut || amountOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: JSON.stringify({ amountIn: amountIn.toString(), amountOut: '0' }),
          quote: null,
          error: 'Curve get_dy returned zero output (insufficient liquidity)',
          rpcLatencyMs: quoteLatencyMs,
        };
      }

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenInDef.symbol,
        tokenOutSymbol: tokenOutDef.symbol,
        feeBps: pool.feeBps > 0 ? pool.feeBps : 4, // Curve standard fee is 4 bps (0.04%)
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
          i,
          j,
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
        error: `Curve get_dy failed: ${msg.slice(0, 120)}`,
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
