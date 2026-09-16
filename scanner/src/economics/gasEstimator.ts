/**
 * SAHIKARA Observer — Dynamic Gas Cost Estimator
 *
 * IMPORTANT: All outputs are marked [ESTIMATE].
 * Actual gas will differ based on execution path, tick crossings, and network state.
 *
 * GAS UNIT ASSUMPTIONS (PROVISIONAL — from ARCHITECTURE.md and LIQUIDITY_RESEARCH.md):
 *   - Uniswap v3 single-hop swap:        ~150,000 units [ASSUMPTION]
 *     (includes 30k buffer for potential tick crossing per LIQUIDITY_RESEARCH.md §4)
 *   - Aerodrome volatile single-hop swap: ~120,000 units [ASSUMPTION]
 *   - Aerodrome stable single-hop swap:   ~130,000 units [ASSUMPTION]
 *     (stableswap invariant iterative solve = higher gas)
 *   - Aerodrome slipstream (CL) swap:     ~140,000 units [ASSUMPTION]
 *   - 2-hop arbitrage transaction:        ~250,000 units [ASSUMPTION] (both sides)
 *
 * ETH PRICE ASSUMPTION:
 *   The ETH/USD price for converting gas cost from ETH to USD is fetched from
 *   the observation data itself (not hardcoded) when available.
 *   If unavailable, a configurable fallback is used.
 *
 * References:
 *   - ARBITRAGE_ECONOMICS.md: "Never hard-code gas costs (e.g., do not assume fixed $0.003)"
 *   - RISK_POLICY.md: Maximum gas cost <= 20% of expected gross profit
 */

import type { DexProtocol } from '../config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Gas Unit Estimates by Protocol
// ─────────────────────────────────────────────────────────────────────────────

/** [ASSUMPTION] Gas units per single-hop swap by protocol. PROVISIONAL. */
export const GAS_UNITS_PER_PROTOCOL: Record<DexProtocol, number> = {
  'uniswap-v3': 150_000,
  'aerodrome-volatile': 120_000,
  'aerodrome-stable': 130_000,
  'aerodrome-slipstream': 140_000,
  'pancakeswap-v3': 150_000,
  'curve-stableswap': 160_000,
  'balancer-v2': 140_000,
  'camelot-v2': 120_000,
  'velodrome-v2-volatile': 120_000,
  'velodrome-v2-stable': 130_000,
  'quickswap-v2': 110_000,
  'quickswap-v3': 150_000,
  'sushiswap-v2': 110_000,
};

/** [ASSUMPTION] Estimated gas units for a complete 2-hop arbitrage cycle. PROVISIONAL. */
export const GAS_UNITS_TWO_HOP_ARBI = 260_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GasEstimate {
  /** Estimated gas units consumed [ESTIMATE — PROVISIONAL] */
  gasUnits: number;
  /** Gas price in gwei at time of estimation */
  gasPriceGwei: number;
  /** Estimated gas cost in ETH */
  gasCostEth: number;
  /** Estimated gas cost in USD [ESTIMATE — requires ETH/USD price] */
  gasCostUsd: number;
  /** ETH/USD price used for conversion */
  ethPriceUsd: number;
  /** Note flagging this as an estimate */
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gas Estimator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate estimated gas cost for a given protocol and current gas price.
 *
 * @param protocol     DEX protocol type (determines gas unit estimate)
 * @param gasPriceWei  Current gas price in wei (from getGasPrice())
 * @param ethPriceUsd  Current ETH price in USD (from a price feed or observation)
 * @param isTwoHop     If true, uses 2-hop arbitrage gas estimate
 *
 * [ASSUMPTION] ETH price is NOT fetched from an oracle in Phase 1C.
 * A configurable fallback value is used. This is adequate for research
 * observation purposes but must be replaced with real-time price feed
 * in Phase 3+.
 */
export function estimateGasCost(
  protocol: DexProtocol,
  gasPriceWei: bigint,
  ethPriceUsd: number,
  isTwoHop = false
): GasEstimate {
  const gasUnits = isTwoHop
    ? GAS_UNITS_TWO_HOP_ARBI
    : GAS_UNITS_PER_PROTOCOL[protocol];

  // Gas cost in wei = gasUnits * gasPriceWei
  const gasCostWei = BigInt(gasUnits) * gasPriceWei;

  // Convert to ETH (18 decimals)
  const gasCostEth = Number(gasCostWei) / 1e18;

  // Convert to USD
  const gasCostUsd = gasCostEth * ethPriceUsd;

  // Gas price in gwei for display
  const gasPriceGwei = Number(gasPriceWei) / 1e9;

  return {
    gasUnits,
    gasPriceGwei,
    gasCostEth,
    gasCostUsd,
    ethPriceUsd,
    note:
      `[ESTIMATE] Gas units: ${gasUnits} (provisional per protocol ${protocol}). ` +
      `Gas price: ${gasPriceGwei.toFixed(4)} gwei. ` +
      `ETH price: $${ethPriceUsd} (configurable fallback — not live oracle). ` +
      `All values PROVISIONAL per RISK_POLICY.md.`,
  };
}

/**
 * Fallback ETH/USD price used when no live price feed is available.
 * [ASSUMPTION] This must be kept up to date by the operator.
 * It is used ONLY for research cost estimation in Phase 1C.
 * Do NOT use this value for any production decision.
 */
export const FALLBACK_ETH_PRICE_USD = 2400; // [ASSUMPTION] Update regularly
