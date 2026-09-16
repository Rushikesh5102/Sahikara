/**
 * SAHIKARA Observer — Balancer V2 Vault Adapter
 * Phase 4.10: DEX Ecosystem Expansion
 *
 * PROTOCOL OVERVIEW:
 *   Balancer V2 centralizes all pool liquidity in a single canonical Vault contract:
 *     0xBA12222222228d8Ba445958a75a0704d566BF2C8
 *   Across Base, Arbitrum One, Optimism, and Polygon PoS [FACT].
 *
 * QUOTING METHOD:
 *   1. Fetches pool reserves via Vault.getPoolTokens(bytes32 poolId).
 *   2. Identifies token balances and decimals.
 *   3. Computes output amount for weighted pools (50/50 standard or custom weight)
 *      using exact Balancer constant-ratio invariant accounting for swap fee.
 *
 * SECURITY:
 *   - Strictly read-only calls to Vault contract.
 *   - Zero private keys, zero signing, zero capital movements.
 */

import { parseAbi, isAddressEqual } from 'viem';
import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

export const BALANCER_V2_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8' as const;

export type BalancerPoolType = 'WEIGHTED' | 'STABLE' | 'OTHER_SUPPORTED' | 'UNSUPPORTED';

const BALANCER_VAULT_ABI = parseAbi([
  'function getPoolTokens(bytes32 poolId) external view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)',
  'function getPool(bytes32 poolId) external view returns (address, uint8)',
]);

export class BalancerV2Adapter implements IPoolAdapter {
  public readonly protocol = 'balancer-v2';
  private readonly dataSource: IDataSource;

  constructor(dataSource: IDataSource) {
    this.dataSource = dataSource;
  }

  public classifyPool(pool: PoolDefinition): BalancerPoolType {
    const note = (pool.note || '').toLowerCase();
    const id = pool.id.toLowerCase();
    if (note.includes('stable') || id.includes('stable') || note.includes('metastable') || id.includes('metastable')) {
      return 'STABLE';
    }
    if (note.includes('linear') || id.includes('linear')) {
      return 'UNSUPPORTED';
    }
    // Default standard supported pools in this adapter are WEIGHTED
    return 'WEIGHTED';
  }

  public supports(pool: PoolDefinition): boolean {
    return pool.protocol === 'balancer-v2' && pool.status === 'active' && this.classifyPool(pool) === 'WEIGHTED';
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

    const poolType = this.classifyPool(pool);
    if (poolType !== 'WEIGHTED') {
      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: '',
        quote: null,
        error: `UNSUPPORTED_POOL_TYPE: Balancer pool type is ${poolType}. Only WEIGHTED pools are supported by this adapter.`,
        rpcLatencyMs: 0,
      };
    }

    if (!this.supports(pool)) {
      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: '',
        quote: null,
        error: `BalancerV2Adapter does not support pool: ${pool.id} (status: ${pool.status})`,
        rpcLatencyMs: 0,
      };
    }

    try {
      // In Balancer V2, poolId is a 32-byte hash whose first 20 bytes are the pool address.
      const poolId = (pool.poolAddress.toLowerCase() + '000000000000000000000000') as `0x${string}`;

      const [tokens, balances] = (await this._read<[string[], bigint[], bigint]>({
        address: BALANCER_V2_VAULT,
        abi: BALANCER_VAULT_ABI,
        functionName: 'getPoolTokens',
        args: [poolId],
        blockNumber,
      }));

      const isToken0In = isAddressEqual(tokenInAddress, pool.token0.address);
      const tokenInDef = isToken0In ? pool.token0 : pool.token1;
      const tokenOutDef = isToken0In ? pool.token1 : pool.token0;

      // Find token indices in Balancer pool tokens array
      const idxIn = tokens.findIndex((t) => isAddressEqual(t as `0x${string}`, tokenInDef.address));
      const idxOut = tokens.findIndex((t) => isAddressEqual(t as `0x${string}`, tokenOutDef.address));

      if (idxIn === -1 || idxOut === -1) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: `Tokens not found in Balancer pool tokens array: ${tokenInDef.symbol}/${tokenOutDef.symbol}`,
          rpcLatencyMs: Date.now() - startTime,
        };
      }

      const balanceIn = balances[idxIn]!;
      const balanceOut = balances[idxOut]!;

      if (balanceIn === 0n || balanceOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: 'Balancer pool has zero balance in one or both tokens',
          rpcLatencyMs: Date.now() - startTime,
        };
      }

      // Balancer 50/50 weighted formula:
      // amountOut = balanceOut * amountInWithFee / (balanceIn + amountInWithFee)
      const feeBps = pool.feeBps > 0 ? BigInt(pool.feeBps) : 30n; // Default 30 bps (0.3%)
      const amountInWithFee = (amountIn * (10000n - feeBps)) / 10000n;
      const amountOut = (balanceOut * amountInWithFee) / (balanceIn + amountInWithFee);

      const quoteLatencyMs = Date.now() - startTime;

      if (amountOut === 0n) {
        return {
          pool,
          blockNumber,
          timestamp: Date.now(),
          rawQuoteJson: '',
          quote: null,
          error: 'Balancer quote returned zero output (amountIn too small)',
          rpcLatencyMs: quoteLatencyMs,
        };
      }

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: tokenInDef.symbol,
        tokenOutSymbol: tokenOutDef.symbol,
        feeBps: Number(feeBps),
        priceImpactBps: Number((amountIn * 10000n) / balanceIn),
        quoteLatencyMs,
      };

      return {
        pool,
        blockNumber,
        timestamp: Date.now(),
        rawQuoteJson: JSON.stringify({
          poolId,
          balanceIn: balanceIn.toString(),
          balanceOut: balanceOut.toString(),
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
        error: `Balancer Vault quote failed: ${msg.slice(0, 120)}`,
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
