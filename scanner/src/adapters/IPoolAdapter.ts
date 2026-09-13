/**
 * SAHIKARA Observer — Abstract Pool Adapter Interface
 *
 * All DEX protocol adapters implement this interface.
 * The MarketObserver calls adapters generically — it does not know
 * the specific DEX protocol being queried.
 *
 * REJECTION REASONS:
 *   All rejection reasons are enumerated here for consistency across adapters.
 *   An observation must NEVER be silently discarded — always record the reason.
 */

import type { PoolDefinition } from '../config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Rejection Reason Enum
// ─────────────────────────────────────────────────────────────────────────────

export type RejectionReason =
  | 'INSUFFICIENT_LIQUIDITY'
  | 'SPREAD_TOO_SMALL'
  | 'FEES_EXCEED_SPREAD'
  | 'GAS_EXCEEDS_PROFIT'
  | 'STALE_DATA'
  | 'QUOTE_FAILED'
  | 'RPC_ERROR'
  | 'PRICE_MOVED'
  | 'UNSUPPORTED_POOL'
  | 'INVALID_TOKEN'
  | 'ADAPTER_STUB'
  | 'OTHER';

export type ObservationStatus = 'CANDIDATE' | 'REJECTED' | 'ERROR';

// ─────────────────────────────────────────────────────────────────────────────
// Raw Pool Quote
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The executable quote returned by a pool adapter for a given input amount.
 *
 * IMPORTANT: This is NOT a spot price. It is the exact output amount
 * calculated from the current pool state for the specific input amount.
 * This is the "QUOTED EXECUTABLE DIFFERENCE" tier per the spec.
 */
export interface PoolQuote {
  /** Token input amount (in raw wei / smallest unit) */
  amountIn: bigint;
  /** Token output amount after all pool fees (in raw wei / smallest unit) */
  amountOut: bigint;
  /** Input token symbol */
  tokenInSymbol: string;
  /** Output token symbol */
  tokenOutSymbol: string;
  /** Pool fee in basis points (e.g., 5 = 0.05%) */
  feeBps: number;
  /** Estimated price impact in basis points [ESTIMATE] */
  priceImpactBps: number;
  /** Current sqrt price (for concentrated liquidity pools, in Q64.96 format) */
  sqrtPriceX96?: bigint;
  /** Current active tick (for concentrated liquidity pools) */
  currentTick?: number;
  /** Current liquidity in the active tick range */
  liquidity?: bigint;
  /** Whether this quote crossed tick boundaries (gas spike warning) */
  crossedTick?: boolean;
  /** RPC latency for this quote call in milliseconds */
  quoteLatencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool Observation (full output of an adapter call)
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolObservation {
  pool: PoolDefinition;
  blockNumber: bigint;
  timestamp: number;
  /** Raw JSON of the quote response for audit trail */
  rawQuoteJson: string;
  quote: PoolQuote | null;
  /** Set if the adapter could not produce a quote */
  error: string | null;
  rpcLatencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IPoolAdapter {
  /** Protocol identifier (matches PoolDefinition.protocol) */
  readonly protocol: string;

  /**
   * Returns true if this adapter can handle the given pool definition.
   * Adapters should return false for stub/unsupported pool types.
   */
  supports(pool: PoolDefinition): boolean;

  /**
   * Fetch the current pool state and produce an executable quote
   * for the given input amount.
   *
   * @param pool    Pool definition from the registry
   * @param amountInUsd  Trade size in USD (for reference)
   * @param amountIn  Exact input amount in token's native units (wei/smallest unit)
   * @param blockNumber  Block number to quote against
   *
   * MUST NOT sign transactions.
   * MUST NOT submit transactions.
   * MUST handle errors gracefully and return null quote with error description.
   */
  getQuote(
    pool: PoolDefinition,
    amountInUsd: number,
    amountIn: bigint,
    blockNumber: bigint
  ): Promise<PoolObservation>;
}
