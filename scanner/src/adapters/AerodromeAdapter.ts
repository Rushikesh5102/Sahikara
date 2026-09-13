/**
 * SAHIKARA Observer — Aerodrome Finance Pool Adapter
 *
 * IMPLEMENTATION STATUS:
 *   ✅ Volatile pools (x·y=k constant product): COMPLETE
 *   ✅ Stable pools (x³y + y³x = k stableswap invariant): COMPLETE
 *   🔲 Slipstream (concentrated liquidity): STUB — see note below
 *
 * SLIPSTREAM STUB EXPLANATION:
 *   Aerodrome Slipstream pools use Uniswap v3 tick math with a custom
 *   SlipstreamQuoterV2 contract deployed on Base. This requires:
 *   1. Confirmed SlipstreamQuoterV2 contract address on Base mainnet.
 *   2. Verification that the ABI matches Uniswap v3 QuoterV2 interface.
 *   3. Confirmation of tick spacing configuration per pool.
 *   Until these are empirically confirmed, Slipstream is NOT faked.
 *   [DEC-015] Slipstream adapter deferred.
 *
 * VOLATILE POOL QUOTING:
 *   Aerodrome volatile pools use standard constant-product invariant: x·y=k
 *   The pool contract exposes getReserves() returning (reserve0, reserve1, _blockTimestampLast).
 *   Output = reserve1 * amountIn * (1 - fee) / (reserve0 + amountIn * (1 - fee))
 *
 * STABLE POOL QUOTING:
 *   Aerodrome stable pools use the stableswap invariant: x³y + y³x = k
 *   The pool contract exposes getAmountOut(amountIn, tokenIn) which handles this math.
 *   We call it directly rather than reimplementing the invariant off-chain,
 *   to avoid approximation errors in the Newton-Raphson solve.
 *
 * LIMITATIONS:
 *   1. [ASSUMPTION] Aerodrome volatile fee = 0.30% (30 bps). Actual fee may vary per
 *      pool as governance controls Aerodrome fees. Verified via pool.getFee() call.
 *   2. [ASSUMPTION] Pool addresses are PROVISIONAL — must be verified against
 *      Aerodrome Factory.getPool() on Base mainnet.
 *   3. getAmountOut is a view function that includes fee deduction internally.
 *
 * SECURITY:
 *   - No private key
 *   - No wallet instantiation
 *   - No transaction signing
 *   - Read-only contract calls via IDataSource
 */

import type { IPoolAdapter, PoolObservation, PoolQuote } from './IPoolAdapter.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { PoolDefinition } from '../config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Aerodrome Volatile/Stable Pool ABI (minimal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aerodrome volatile and stable pool ABI — shared interface.
 * Both pool types expose getReserves(), getAmountOut(), and decimals().
 * Source: https://github.com/aerodrome-finance/contracts
 */
const AERODROME_POOL_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint256' },
      { name: 'reserve1', type: 'uint256' },
      { name: 'blockTimestampLast', type: 'uint256' },
    ],
  },
  {
    name: 'getAmountOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'tokenIn', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'stable',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'fee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Minimum liquidity threshold
// [ASSUMPTION] Minimum $5,000 reserve equivalent per RISK_POLICY.md
// ─────────────────────────────────────────────────────────────────────────────
const MIN_RESERVE_USDC = 5000n * 1_000_000n; // $5,000 in USDC (6 decimals)

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class AerodromeAdapter implements IPoolAdapter {
  public readonly protocol = 'aerodrome-volatile';

  constructor(private readonly dataSource: IDataSource) {}

  supports(pool: PoolDefinition): boolean {
    return (
      (pool.protocol === 'aerodrome-volatile' || pool.protocol === 'aerodrome-stable') &&
      pool.status === 'active'
    );
  }

  async getQuote(
    pool: PoolDefinition,
    _amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation> {
    const timestamp = Date.now();

    // Route to correct implementation based on pool protocol type
    if (pool.protocol === 'aerodrome-slipstream') {
      return this._stubObservation(pool, blockNumber, timestamp);
    }

    try {
      // ── 1. Fetch reserves and pool metadata ─────────────────────────────
      const [reserveResult, feeResult] = await Promise.all([
        this.dataSource.readContract<readonly [bigint, bigint, bigint]>({
          contractAddress: pool.poolAddress,
          abi: AERODROME_POOL_ABI,
          functionName: 'getReserves',
        }),
        this.dataSource.readContract<bigint>({
          contractAddress: pool.poolAddress,
          abi: AERODROME_POOL_ABI,
          functionName: 'fee',
        }),
      ]);

      const [reserve0, reserve1] = reserveResult.data;
      // [FACT] Aerodrome fee is returned as a uint256 in basis points (e.g., 30 = 0.30%)
      const actualFeeBps = Number(feeResult.data);

      // ── 2. Check liquidity ───────────────────────────────────────────────
      // Compare reserve of the stablecoin (token1 for WETH/USDC pools) against minimum
      const relevantReserve = pool.token1.decimals === 6 ? reserve1 : reserve0;
      if (relevantReserve < MIN_RESERVE_USDC) {
        return this._errorObservation(pool, blockNumber, timestamp,
          `Insufficient liquidity. Reserve: ${relevantReserve.toString()}, minimum: ${MIN_RESERVE_USDC.toString()}`,
          reserveResult.latencyMs);
      }

      // ── 3. Call getAmountOut (includes fee deduction internally) ─────────
      // getAmountOut is a view function — read-only, no signing required.
      // It handles the invariant calculation internally (x·y=k for volatile,
      // stableswap invariant for stable pools).
      const quoteStart = performance.now();
      const quoteResult = await this.dataSource.readContract<bigint>({
        contractAddress: pool.poolAddress,
        abi: AERODROME_POOL_ABI,
        functionName: 'getAmountOut',
        args: [amountIn, pool.token0.address],
      });
      const quoteLatencyMs = Math.round(performance.now() - quoteStart);

      const amountOut = quoteResult.data;

      if (amountOut === 0n) {
        return this._errorObservation(pool, blockNumber, timestamp,
          'getAmountOut returned 0 — trade size too small or pool at price boundary.',
          reserveResult.latencyMs + quoteLatencyMs);
      }

      // ── 4. Calculate price impact (constant product approximation) ───────
      // For volatile pools: impact ≈ amountIn / (reserve0 + amountIn)
      // For stable pools: approximation may be inaccurate — mark as ESTIMATE
      let priceImpactBps: number;
      if (pool.protocol === 'aerodrome-volatile') {
        priceImpactBps = Number((amountIn * 10000n) / (reserve0 + amountIn));
      } else {
        // [ASSUMPTION] Stableswap invariant has lower price impact than constant product
        // Using half the constant-product approximation as a conservative estimate
        priceImpactBps = Number((amountIn * 5000n) / (reserve0 + amountIn));
      }

      const quote: PoolQuote = {
        amountIn,
        amountOut,
        tokenInSymbol: pool.token0.symbol,
        tokenOutSymbol: pool.token1.symbol,
        feeBps: actualFeeBps, // Use on-chain fee, not configured fee
        priceImpactBps,
        liquidity: reserve0 + reserve1, // Total reserve as liquidity proxy
        quoteLatencyMs,
      };

      return {
        pool: { ...pool, feeBps: actualFeeBps }, // Update with actual on-chain fee
        blockNumber,
        timestamp,
        rawQuoteJson: JSON.stringify({
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
          feeBps: actualFeeBps,
          poolProtocol: pool.protocol,
        }),
        quote,
        error: null,
        rpcLatencyMs: reserveResult.latencyMs + quoteLatencyMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this._errorObservation(pool, blockNumber, timestamp,
        `Aerodrome getAmountOut failed: ${message}`, 0);
    }
  }

  private _stubObservation(
    pool: PoolDefinition,
    blockNumber: bigint,
    timestamp: number
  ): PoolObservation {
    return {
      pool,
      blockNumber,
      timestamp,
      rawQuoteJson: JSON.stringify({
        status: 'STUB',
        reason: 'Aerodrome Slipstream adapter not yet implemented. See DEC-015 and docs/strategy/QUOTE_ENGINE.md.',
      }),
      quote: null,
      error: 'ADAPTER_STUB: Aerodrome Slipstream (concentrated liquidity) requires SlipstreamQuoterV2 integration. Deferred per DEC-015.',
      rpcLatencyMs: 0,
    };
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
