/**
 * SAHIKARA — Phase 4.7 Failure Taxonomy
 *
 * Provides a granular, unambiguous classification for all quote and evaluation failures.
 *
 * CRITICAL INVARIANT:
 * Configuration or infrastructure errors must NEVER be encoded as synthetic
 * economic data (e.g., grossSpreadBps = -10000). They must be routed through
 * this taxonomy and isolated from empirical market statistics.
 */

export type FailureCategory =
  | 'RPC_ERROR'
  | 'TIMEOUT'
  | 'REVERT'
  | 'INVALID_POOL'
  | 'INVALID_TOKEN'
  | 'DECIMAL_ERROR'
  | 'LIQUIDITY_INSUFFICIENT'
  | 'QUOTE_ZERO'
  | 'SLIPPAGE_TOO_HIGH'
  | 'GAS_TOO_HIGH'
  | 'PROFIT_TOO_LOW'
  | 'STALE_QUOTE'
  | 'UNSUPPORTED_ROUTE'
  | 'TOPOLOGY_NO_CYCLE'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN';

export interface FailureRecord {
  category: FailureCategory;
  message: string;
  timestampMs: number;
  routeId?: string;
  poolAddress?: string;
  chain?: string;
  tradeSizeUsd?: number;
  rawDetail?: string;
}

export class FailureTaxonomy {
  /**
   * Classifies an error or failure string into one of the 16 canonical categories.
   */
  public static classify(error: unknown): FailureCategory {
    if (!error) return 'UNKNOWN';

    const msg = (
      typeof error === 'string'
        ? error
        : (error as Error).message || (error as { details?: string }).details || JSON.stringify(error)
    ).toLowerCase();

    // 1. Network / RPC transport errors
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
      return 'TIMEOUT';
    }
    if (
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('connection refused') ||
      msg.includes('econnrefused') ||
      msg.includes('fetch failed') ||
      msg.includes('network error') ||
      msg.includes('rpc')
    ) {
      return 'RPC_ERROR';
    }

    // 2. On-chain execution reverts / contract reverts
    if (msg.includes('execution reverted') || msg.includes('revert') || msg.includes('0x')) {
      if (msg.includes('as') || msg.includes('splash') || msg.includes('liquidity') || msg.includes('np')) {
        return 'LIQUIDITY_INSUFFICIENT';
      }
      return 'REVERT';
    }

    // 3. Liquidity & zero-output errors
    if (
      msg.includes('insufficient liquidity') ||
      msg.includes('no liquidity') ||
      msg.includes('zero liquidity') ||
      msg.includes('insufficient_liquidity')
    ) {
      return 'LIQUIDITY_INSUFFICIENT';
    }
    if (msg.includes('quote zero') || msg.includes('amountout is 0') || msg.includes('zero output')) {
      return 'QUOTE_ZERO';
    }

    // 4. Pool & Token validity
    if (msg.includes('invalid pool') || msg.includes('pool not found') || msg.includes('bytecode missing')) {
      return 'INVALID_POOL';
    }
    if (msg.includes('invalid token') || msg.includes('token mismatch') || msg.includes('unknown token')) {
      return 'INVALID_TOKEN';
    }
    if (msg.includes('decimal') || msg.includes('decimals mismatch')) {
      return 'DECIMAL_ERROR';
    }

    // 5. Economic & Risk Thresholds
    if (msg.includes('slippage') || msg.includes('price impact')) {
      return 'SLIPPAGE_TOO_HIGH';
    }
    if (msg.includes('gas') || msg.includes('gas cost exceeds')) {
      return 'GAS_TOO_HIGH';
    }
    if (msg.includes('profit') || msg.includes('negative profit') || msg.includes('unprofitable')) {
      return 'PROFIT_TOO_LOW';
    }
    if (msg.includes('stale') || msg.includes('max quote age') || msg.includes('quote age')) {
      return 'STALE_QUOTE';
    }

    // 6. Topology & Configuration
    if (msg.includes('topology') || msg.includes('no cycle') || msg.includes('triangle')) {
      return 'TOPOLOGY_NO_CYCLE';
    }
    if (msg.includes('unsupported') || msg.includes('adapter not found')) {
      return 'UNSUPPORTED_ROUTE';
    }
    if (msg.includes('config') || msg.includes('configuration') || msg.includes('missing env')) {
      return 'CONFIGURATION_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Validates that a failure is NOT converted into a synthetic economic measurement.
   */
  public static assertNotEconomicMetric(value: number, fieldName = 'grossSpreadBps'): void {
    if (value <= -5000 || !Number.isFinite(value)) {
      throw new Error(
        `[INVARIANT VIOLATION] Fabricated economic value ${value} detected for ${fieldName}. ` +
        `Failures must be recorded in FailureTaxonomy, never as statistical market spreads.`
      );
    }
  }
}
