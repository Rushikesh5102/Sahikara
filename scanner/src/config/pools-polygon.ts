/**
 * SAHIKARA Observer — Polygon (137) Pool Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — Verified on-chain or from official documentation
 *   [PROVISIONAL]— To be confirmed via eth_getCode before quoting
 *
 * SAFETY DIRECTIVE:
 *   All pools in this file are marked [PROVISIONAL] until the Phase 4.6 campaign
 *   runner confirms bytecode existence via eth_getCode on Polygon Mainnet.
 *   No quote is issued against a pool whose bytecode returns < 4 bytes.
 *
 * References:
 *   - Uniswap v3 Polygon: https://docs.uniswap.org/contracts/v3/reference/deployments/polygon-deployments
 *   - Polygon native USDC (Circle): https://www.circle.com/en/usdc-multichain/polygon
 */

import type { TokenDefinition, PoolDefinition, SupportedChain } from './pools.js';
import { CHAIN_IDS } from './pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Polygon (137) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const POLYGON_TOKENS: Record<string, TokenDefinition> = {
  WMATIC: {
    symbol: 'WMATIC',
    // [FACT] Canonical WMATIC (WPOL) on Polygon — verified on-chain
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    decimals: 18,
    addressTier: '[FACT]',
  },
  WETH: {
    symbol: 'WETH',
    // [FACT] Bridged WETH on Polygon (Polygon PoS bridge) — verified on-chain
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    decimals: 18,
    addressTier: '[FACT]',
  },
  USDC: {
    symbol: 'USDC',
    // [FACT] Native USDC on Polygon (Circle deployment) — verified on-chain
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDCe: {
    symbol: 'USDC.e',
    // [FACT] Bridged USDC.e on Polygon (legacy PoS bridge) — verified on-chain
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDT: {
    symbol: 'USDT',
    // [FACT] Tether USD on Polygon — verified on-chain
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
    addressTier: '[FACT]',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v3 on Polygon (137) — Contract Addresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniswap v3 deployment on Polygon.
 * [FACT] Factory: canonical Uniswap v3 factory — verified on-chain
 * [FACT] QuoterV2: canonical Uniswap v3 QuoterV2 on Polygon — verified on-chain
 * Source: https://docs.uniswap.org/contracts/v3/reference/deployments/polygon-deployments
 */
export const POLYGON_UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as const;
export const POLYGON_UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Polygon Pool Registry
// ─────────────────────────────────────────────────────────────────────────────

const CHAIN: SupportedChain = 'polygon';
const CHAIN_ID = CHAIN_IDS.POLYGON; // 137

export const POLYGON_UNISWAP_V3_POOLS: PoolDefinition[] = [
  // ── Active Canonical Pools (Verified On-Chain [FACT]) ───────────────────────
  {
    id: 'univ3-polygon-weth-usdc-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Canonical native USDC/WETH 500 pool. Verified on-chain (liquidity active, factory match)
    poolAddress: '0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9',
    token0: POLYGON_TOKENS['USDC']!,
    token1: POLYGON_TOKENS['WETH']!,
    feeBps: 5,
    status: 'active',
    note: 'Polygon Uniswap v3 USDC/WETH (native USDC) 0.05% pool. Canonical replacement verified on-chain.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-polygon-weth-usdc-3000',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Canonical native USDC/WETH 3000 pool. Verified on-chain (liquidity active, factory match)
    poolAddress: '0x19C5505638383337D2972Ce68B493aD78E315147',
    token0: POLYGON_TOKENS['USDC']!,
    token1: POLYGON_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    note: 'Polygon Uniswap v3 USDC/WETH (native USDC) 0.30% pool. Canonical replacement verified on-chain.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-polygon-wmatic-usdce-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Polygon (137)
    poolAddress: '0xA374094527e1673A86dE625aa59517c5dE346d32',
    token0: POLYGON_TOKENS['WMATIC']!,
    token1: POLYGON_TOKENS['USDCe']!,
    feeBps: 5,
    status: 'active',
    note: 'Polygon Uniswap v3 WMATIC/USDC.e 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-polygon-wmatic-weth-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Polygon (137)
    poolAddress: '0x86f1d8390222A3691C28938eC7404A1661E618e0',
    token0: POLYGON_TOKENS['WMATIC']!,
    token1: POLYGON_TOKENS['WETH']!,
    feeBps: 5,
    status: 'active',
    note: 'Polygon Uniswap v3 WMATIC/WETH 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-polygon-weth-usdt-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Canonical WETH/USDT 500 pool. Verified on-chain (liquidity active, factory match)
    poolAddress: '0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4',
    token0: POLYGON_TOKENS['WETH']!,
    token1: POLYGON_TOKENS['USDT']!,
    feeBps: 5,
    status: 'active',
    note: 'Polygon Uniswap v3 WETH/USDT 0.05% pool. Canonical replacement verified on-chain.',
    tier: '[FACT]',
  },

  // ── Historical Disabled Pools (Preserved per Section 3 Directives) ──────────
  {
    id: 'univ3-polygon-weth-usdc-500-historical-disabled',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x45dDa9cb7c25131DF268515131f647d726f50608',
    token0: POLYGON_TOKENS['WETH']!,
    token1: POLYGON_TOKENS['USDC']!,
    feeBps: 5,
    status: 'disabled',
    note: 'HISTORICAL DISABLED (2026-09-16): Configured identity WETH/native USDC 500. Observed actual on-chain identity is WETH/USDC.e (bridged 0x2791...) 500. Canonical replacement is 0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9. Sourced from Polygon Mainnet RPC via eth_call.',
    tier: '[PROVISIONAL]',
  },
  {
    id: 'univ3-polygon-weth-usdc-3000-historical-disabled',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x167384319B41F7094e62f7506409Eb38079AbfF8',
    token0: POLYGON_TOKENS['WETH']!,
    token1: POLYGON_TOKENS['USDC']!,
    feeBps: 30,
    status: 'disabled',
    note: 'HISTORICAL DISABLED (2026-09-16): Configured identity WETH/native USDC 3000. Observed actual on-chain identity is WMATIC/WETH 3000. Canonical replacement is 0x19C5505638383337D2972Ce68B493aD78E315147. Sourced from Polygon Mainnet RPC via eth_call.',
    tier: '[PROVISIONAL]',
  },
  {
    id: 'univ3-polygon-weth-usdt-500-historical-disabled',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x4CcD010148379ea531D6C587CfDd60180196F9b1',
    token0: POLYGON_TOKENS['WETH']!,
    token1: POLYGON_TOKENS['USDT']!,
    feeBps: 5,
    status: 'disabled',
    note: 'HISTORICAL DISABLED (2026-09-16): Configured identity WETH/USDT 500 (5 bps). Observed actual on-chain fee is 30 bps (3000). Canonical replacement is 0xBB98B3D2b18aeF63a3178023A920971cf5F29bE4. Sourced from Polygon Mainnet RPC via eth_call.',
    tier: '[PROVISIONAL]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All Polygon Active Pools
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_POLYGON_ACTIVE_POOLS: PoolDefinition[] = [
  ...POLYGON_UNISWAP_V3_POOLS,
].filter((p) => p.status === 'active');

export const ALL_POLYGON_POOLS: PoolDefinition[] = [...POLYGON_UNISWAP_V3_POOLS];
