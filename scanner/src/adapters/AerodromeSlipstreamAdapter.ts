/**
 * SAHIKARA Observer — Aerodrome Slipstream Adapter (STUB / NOT_READY)
 *
 * STATUS: NOT_READY
 *
 * Per directives:
 *   - Do NOT fake support for a protocol whose quote mechanism has not been implemented.
 *   - Create a clearly marked adapter interface/stub if architecturally useful.
 *   - Mark it NOT_READY.
 *   - NEVER fabricate quotes.
 *
 * Aerodrome Slipstream is Aerodrome's concentrated liquidity AMM (CL200 / UniV3 fork).
 * Requires SlipstreamQuoterV2 contract integration, fee tier tick spacing mapping,
 * and empirical on-chain verification.
 *
 * Reference: DEC-015 in DECISIONS.md.
 */

import type { IPoolAdapter, PoolObservation } from './IPoolAdapter.js';
import type { PoolDefinition } from '../config/pools.js';

export class AerodromeSlipstreamAdapter implements IPoolAdapter {
  public readonly protocol = 'aerodrome-slipstream';
  public readonly status = 'NOT_READY' as const;

  supports(_pool: PoolDefinition): boolean {
    void _pool;
    // Only supports slipstream pools, but explicitly returns false because the adapter is NOT_READY.
    // This prevents the RouteGenerator or MarketObserver from attempting execution.
    return false;
  }

  async getQuote(
    pool: PoolDefinition,
    _amountInUsd: number,
    _amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    return {
      pool,
      blockNumber,
      timestamp: Date.now(),
      rawQuoteJson: JSON.stringify({ error: 'ADAPTER_NOT_READY' }),
      quote: null,
      error: `[AerodromeSlipstreamAdapter] NOT_READY: Aerodrome Slipstream quote mechanism is not implemented for pool "${pool.id}". Zero quotes are fabricated per SAHIKARA safety directives [DEC-015].`,
      rpcLatencyMs: 0,
    };
  }
}
