/**
 * SAHIKARA — Canonical Token Identity & Classification Registry
 * Phase 4.10: DEX Ecosystem & Market-Universe Expansion
 *
 * CRITICAL TOKEN IDENTITY DIRECTIVES:
 * 1. NEVER identify a token by symbol alone.
 * 2. Canonical Identity: chainId + tokenAddress.toLowerCase().
 * 3. Strict differentiation:
 *    - NATIVE_CANONICAL: Native L1/L2 gas wrapper or official native deployment.
 *    - BRIDGED: Bridged variants minted by bridge escrow contracts.
 *    - LEGACY: Deprecated or legacy bridged tokens.
 *    - UNKNOWN: Unverified or unclassified token contracts.
 * 4. Valuation field separation:
 *    - nativeGasTokenPriceUsd (Gas cost valuation only)
 *    - baseTradeTokenPriceUsd (Input trade valuation only)
 *    - tokenPriceUsd (Asset valuation only)
 */

import { isAddressEqual } from 'viem';
import { CHAIN_IDS } from './pools.js';

export type TokenClassification = 'NATIVE_CANONICAL' | 'BRIDGED' | 'LEGACY' | 'UNKNOWN';
export type IdentityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CanonicalToken {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  classification: TokenClassification;
  confidence: IdentityConfidence;
  isStablecoin: boolean;
  provenance: string;
}

/**
 * Token valuation structure maintaining strict separation between
 * native gas asset prices, trade base asset prices, and asset prices.
 * [DEC-036] Zero cross-contamination between gas token and trade token pricing.
 */
export interface TokenValuationContext {
  chainId: number;
  /** Price of chain native gas token (e.g. ETH on Base/Arb/OP, POL on Polygon) */
  nativeGasTokenPriceUsd: number;
  /** Price of base trade denomination token (typically USDC $1.00) */
  baseTradeTokenPriceUsd: number;
  /** Price of individual target token being traded */
  tokenPriceUsd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base (8453) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_CANONICAL_TOKENS: CanonicalToken[] = [
  {
    chainId: CHAIN_IDS.BASE,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Base canonical WETH9 contract (OP Stack system address)',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin (Native)',
    decimals: 6,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Circle native USDC deployment on Base',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    symbol: 'USDbC',
    name: 'USD Base Coin (Bridged USDC)',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Base official bridge escrow token (legacy bridged USDC)',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'MakerDAO canonical bridged DAI on Base',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Coinbase cbBTC native contract on Base',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    symbol: 'wstETH',
    name: 'Wrapped Liquid Staked Ether',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Lido canonical wstETH bridge to Base',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    symbol: 'AERO',
    name: 'Aerodrome',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Aerodrome protocol native governance token on Base',
  },
  {
    chainId: CHAIN_IDS.BASE,
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    symbol: 'DEGEN',
    name: 'Degen Token',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Degen L3 native ecosystem token on Base',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Arbitrum One (42161) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ARBITRUM_CANONICAL_TOKENS: CanonicalToken[] = [
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Arbitrum canonical WETH contract',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    name: 'USD Coin (Native)',
    decimals: 6,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Circle native USDC deployment on Arbitrum One',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    symbol: 'USDC.e',
    name: 'Bridged USDC (Arbitrum)',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Arbitrum Nitro official bridge escrow token (legacy bridged USDC)',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Tether bridged deployment on Arbitrum One',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'MakerDAO canonical bridged DAI on Arbitrum',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'BitGo bridged WBTC on Arbitrum',
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    symbol: 'ARB',
    name: 'Arbitrum Token',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Arbitrum DAO governance token',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Optimism (10) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const OPTIMISM_CANONICAL_TOKENS: CanonicalToken[] = [
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Optimism OP Stack canonical WETH9 address',
  },
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    name: 'USD Coin (Native)',
    decimals: 6,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Circle native USDC deployment on Optimism',
  },
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    symbol: 'USDC.e',
    name: 'Bridged USDC (Optimism)',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Optimism Standard Bridge token (legacy bridged USDC)',
  },
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Optimism canonical bridged USDT',
  },
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'MakerDAO canonical bridged DAI on Optimism',
  },
  {
    chainId: CHAIN_IDS.OPTIMISM,
    address: '0x4200000000000000000000000000000000000042',
    symbol: 'OP',
    name: 'Optimism',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Optimism Collective governance token',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Polygon PoS (137) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const POLYGON_CANONICAL_TOKENS: CanonicalToken[] = [
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    symbol: 'WMATIC',
    name: 'Wrapped MATIC / POL',
    decimals: 18,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Polygon PoS canonical wrapped native gas token (WMATIC/WPOL)',
  },
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    symbol: 'USDC',
    name: 'USD Coin (Native)',
    decimals: 6,
    classification: 'NATIVE_CANONICAL',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Circle native USDC deployment on Polygon PoS',
  },
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    symbol: 'USDC.e',
    name: 'Bridged USDC (Polygon)',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Polygon PoS PoS Bridge token (legacy bridged USDC)',
  },
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'Polygon PoS PoS Bridge USDT',
  },
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: true,
    provenance: 'MakerDAO canonical bridged DAI on Polygon PoS',
  },
  {
    chainId: CHAIN_IDS.POLYGON,
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    symbol: 'WETH',
    name: 'Wrapped Ether (Polygon)',
    decimals: 18,
    classification: 'BRIDGED',
    confidence: 'HIGH',
    isStablecoin: false,
    provenance: 'Polygon PoS Bridge WETH from Ethereum L1',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Master Canonical Token Index
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_CANONICAL_TOKENS: CanonicalToken[] = [
  ...BASE_CANONICAL_TOKENS,
  ...ARBITRUM_CANONICAL_TOKENS,
  ...OPTIMISM_CANONICAL_TOKENS,
  ...POLYGON_CANONICAL_TOKENS,
];

/**
 * Maps "chainId:lowercaseAddress" -> CanonicalToken
 */
const CANONICAL_TOKEN_MAP = new Map<string, CanonicalToken>();

for (const t of ALL_CANONICAL_TOKENS) {
  const key = `${t.chainId}:${t.address.toLowerCase()}`;
  CANONICAL_TOKEN_MAP.set(key, t);
}

/**
 * Resolves a token canonically by chainId and address.
 * Never resolves by symbol.
 */
export function getCanonicalToken(chainId: number, address: `0x${string}`): CanonicalToken | null {
  const key = `${chainId}:${address.toLowerCase()}`;
  return CANONICAL_TOKEN_MAP.get(key) ?? null;
}

/**
 * Returns true if two tokens have identical canonical identities (same chainId and address).
 */
export function areTokensIdentical(
  t1: { chainId?: number; address: `0x${string}` },
  t2: { chainId?: number; address: `0x${string}` }
): boolean {
  if (t1.chainId !== undefined && t2.chainId !== undefined && t1.chainId !== t2.chainId) {
    return false;
  }
  return isAddressEqual(t1.address, t2.address);
}

/**
 * Validates whether a token pair represents identical economic assets or distinct assets.
 * E.g., native USDC vs bridged USDC.e share symbol 'USDC' but are DIFFERENT assets.
 */
export function classifyTokenRelationship(
  tokenA: CanonicalToken,
  tokenB: CanonicalToken
): 'IDENTICAL' | 'NATIVE_VS_BRIDGED' | 'DIFFERENT_ASSET' {
  if (tokenA.chainId === tokenB.chainId && isAddressEqual(tokenA.address, tokenB.address)) {
    return 'IDENTICAL';
  }
  if (
    tokenA.chainId === tokenB.chainId &&
    ((tokenA.classification === 'NATIVE_CANONICAL' && tokenB.classification === 'BRIDGED') ||
      (tokenA.classification === 'BRIDGED' && tokenB.classification === 'NATIVE_CANONICAL')) &&
    (tokenA.symbol.startsWith('USDC') && tokenB.symbol.startsWith('USDC'))
  ) {
    return 'NATIVE_VS_BRIDGED';
  }
  return 'DIFFERENT_ASSET';
}
