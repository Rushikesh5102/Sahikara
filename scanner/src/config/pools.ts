/**
 * SAHIKARA Observer — Candidate Pool Registry
 *
 * IMPORTANT:
 *   All pool entries are PROVISIONAL. Pool addresses, fee tiers, and token
 *   pairs below are sourced from on-chain data and documentation as of
 *   Phase 1C initialization. They must be empirically validated before any
 *   further phase relies on them.
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — Verified on-chain or from official documentation
 *   [ASSUMPTION] — Working premise subject to empirical validation
 *   [PROVISIONAL]— To be confirmed/replaced after empirical data collection
 *
 * Do NOT permanently whitelist tokens or pools here.
 * Pool selection remains PROVISIONAL until empirical data supports it.
 *
 * References:
 *   - Base mainnet chain ID: 8453 [FACT]
 *   - Uniswap v3 on Base: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
 *   - Aerodrome: https://aerodrome.finance/liquidity
 */

// ─────────────────────────────────────────────────────────────────────────────
// Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenDefinition {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  /** Truth-tier for address accuracy */
  addressTier: '[FACT]' | '[ASSUMPTION]' | '[PROVISIONAL]';
}

/**
 * Base mainnet token addresses.
 * [FACT] Addresses sourced from:
 *   - USDC (native): https://www.circle.com/en/multi-chain-usdc/base
 *   - WETH: Standard Uniswap v2 WETH9 deployment
 *   - cbBTC: Coinbase wrapped BTC on Base
 *   - USDT: Tether on Base (verify with Tether official)
 */
export const BASE_TOKENS: Record<string, TokenDefinition> = {
  WETH: {
    symbol: 'WETH',
    // [FACT] Canonical WETH9 address on Base
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    addressTier: '[FACT]',
  },
  USDC: {
    symbol: 'USDC',
    // [FACT] Native USDC on Base (Circle bridged)
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDbC: {
    symbol: 'USDbC',
    // [FACT] Bridged USDC on Base (older — many pools still use this)
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    decimals: 6,
    addressTier: '[FACT]',
  },
  DAI: {
    symbol: 'DAI',
    // [FACT] DAI on Base
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    addressTier: '[FACT]',
  },
  cbBTC: {
    symbol: 'cbBTC',
    // [FACT] Coinbase Wrapped BTC on Base
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    addressTier: '[FACT]',
  },
  AERO: {
    symbol: 'AERO',
    // [FACT] Aerodrome governance token on Base
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    decimals: 18,
    addressTier: '[FACT]',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pool Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type DexProtocol = 'uniswap-v3' | 'aerodrome-volatile' | 'aerodrome-stable' | 'aerodrome-slipstream';
export type PoolStatus = 'active' | 'stub' | 'disabled';

export interface PoolDefinition {
  id: string;
  chain: 'base';
  dex: string;
  protocol: DexProtocol;
  poolAddress: `0x${string}`;
  token0: TokenDefinition;
  token1: TokenDefinition;
  /** Fee tier in basis points (e.g., 5 = 0.05%) */
  feeBps: number;
  /** Implementation status for the adapter */
  status: PoolStatus;
  /** Human-readable note about this pool */
  note: string;
  /** Truth tier for this pool's existence and parameters */
  tier: '[FACT]' | '[ASSUMPTION]' | '[PROVISIONAL]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v3 Pool Registry (Base)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniswap v3 deployment on Base.
 * [FACT] Factory: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
 * [FACT] QuoterV2: 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
 * Source: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
 * Verified on-chain: bytecode exists (16548 bytes), factory() returns 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
 */
export const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as const;
export const UNISWAP_V3_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

export const UNISWAP_V3_POOLS: PoolDefinition[] = [
  {
    id: 'univ3-base-weth-usdc-500',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(WETH, USDC, 500)
    poolAddress: '0xd0b53D9277642d899DF5C87A3966A349A798F224',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 5, // 0.05% fee tier
    status: 'active',
    note: 'Highest volume WETH/USDC pool on Base. Primary research target. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-usdc-usdbc-100',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(USDC, USDbC, 100)
    poolAddress: '0x06959273E9A65433De71F5A452D529544E07dDD0',
    token0: BASE_TOKENS['USDC']!,
    token1: BASE_TOKENS['USDbC']!,
    feeBps: 1, // 0.01% fee tier
    status: 'active',
    note: 'Stablecoin pair: native USDC vs bridged USDbC. Low spread expected. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-base-weth-cbbtc-500',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via Factory.getPool(WETH, cbBTC, 500)
    // Note: Previous provisional address 0x3c0ece5... was INVALID. Real address is 0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1.
    poolAddress: '0x7AeA2E8A3843516afa07293a10Ac8E49906dabD1',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['cbBTC']!,
    feeBps: 5,
    status: 'active',
    note: 'WETH/cbBTC: cross-chain BTC exposure pair on Base. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Aerodrome Pool Registry (Base)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aerodrome Finance on Base.
 * [FACT] Factory (volatile + stable): 0x420DD381b31aEf6683db6B902084cB0FFECe40Da
 * [FACT] Router: 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
 * Verified on-chain: Router defaultFactory() returns 0x420DD381b31aEf6683db6B902084cB0FFECe40Da (checksum valid, 7034 bytes bytecode).
 */
export const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43' as const;
export const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' as const;

export const AERODROME_POOLS: PoolDefinition[] = [
  {
    id: 'aero-base-weth-usdc-volatile',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-volatile',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(WETH, USDC, false)
    poolAddress: '0xcDAC0d6c6C59727a65F871236188350531885C43',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 30, // [FACT] Factory.getFee(poolAddress, false) returns 30 (0.30%)
    status: 'active',
    note: 'Primary Aerodrome WETH/USDC volatile (x*y=k) pool. HIGH PRIORITY research target. [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-usdc-usdbc-stable',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-stable',
    // [FACT] Verified on-chain via Aerodrome Factory.getPool(USDC, USDbC, true)
    poolAddress: '0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD',
    token0: BASE_TOKENS['USDC']!,
    token1: BASE_TOKENS['USDbC']!,
    feeBps: 5, // [FACT] Factory.getFee(poolAddress, true) returns 5 (0.05%)
    status: 'active',
    note: 'Aerodrome stablecoin pool: native USDC vs bridged USDbC. Uses stable invariant (x³y+y³x=k). [FACT] on-chain verified.',
    tier: '[FACT]',
  },
  {
    id: 'aero-base-weth-usdc-slipstream',
    chain: 'base',
    dex: 'Aerodrome',
    protocol: 'aerodrome-slipstream',
    // [PROVISIONAL] Slipstream concentrated liquidity pool address
    poolAddress: '0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59',
    token0: BASE_TOKENS['WETH']!,
    token1: BASE_TOKENS['USDC']!,
    feeBps: 5, // [PROVISIONAL] Slipstream tick spacing 100 ≈ 0.05%
    status: 'stub',
    note: '[STUB] Aerodrome Slipstream (concentrated liquidity) requires SlipstreamQuoterV2 contract integration. ' +
          'Equivalent to Uniswap v3 tick math. Deferred — see docs/strategy/QUOTE_ENGINE.md for details. ' +
          '[DEC-015] Aerodrome Slipstream adapter deferred to Phase 1D+.',
    tier: '[PROVISIONAL]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cross-DEX Research Pairs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defined cross-DEX pool pairs for arbitrage opportunity observation.
 * Each pair targets the SAME token pair on TWO different DEXs.
 *
 * [DECISION] DEC-011: Aerodrome ↔ Uniswap as first provisional cross-DEX pair.
 */
export interface CrossDexPair {
  id: string;
  description: string;
  poolA: PoolDefinition;
  poolB: PoolDefinition;
  /** True if both pools are active (not stubs) */
  isObservable: boolean;
}

export const CROSS_DEX_PAIRS: CrossDexPair[] = [
  {
    id: 'weth-usdc-univ3-vs-aero-volatile',
    description: 'WETH/USDC: Uniswap v3 (0.05%) ↔ Aerodrome volatile (0.30%) — Primary research pair [DEC-011]',
    poolA: UNISWAP_V3_POOLS[0]!, // univ3-base-weth-usdc-500
    poolB: AERODROME_POOLS[0]!,  // aero-base-weth-usdc-volatile
    isObservable: true,
  },
  {
    id: 'usdc-usdbc-univ3-vs-aero-stable',
    description: 'USDC/USDbC: Uniswap v3 (0.01%) ↔ Aerodrome stable — Stablecoin peg dislocation research',
    poolA: UNISWAP_V3_POOLS[1]!, // univ3-base-usdc-usdbc-100
    poolB: AERODROME_POOLS[1]!,  // aero-base-usdc-usdbc-stable
    isObservable: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All Active Pools (union of all registries, active status only)
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_ACTIVE_POOLS: PoolDefinition[] = [
  ...UNISWAP_V3_POOLS,
  ...AERODROME_POOLS,
].filter((p) => p.status === 'active');

export const ALL_POOLS: PoolDefinition[] = [
  ...UNISWAP_V3_POOLS,
  ...AERODROME_POOLS,
];
