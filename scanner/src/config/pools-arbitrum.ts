/**
 * SAHIKARA Observer — Arbitrum One (42161) Pool Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — Verified on-chain or from official documentation
 *   [PROVISIONAL]— To be confirmed via eth_getCode before quoting
 *
 * SAFETY DIRECTIVE:
 *   All pools in this file are marked [PROVISIONAL] until the Phase 4.6 campaign
 *   runner confirms bytecode existence via eth_getCode on Arbitrum One.
 *   No quote is issued against a pool whose bytecode returns < 4 bytes.
 *
 * References:
 *   - Uniswap v3 Arbitrum: https://docs.uniswap.org/contracts/v3/reference/deployments/arbitrum-deployments
 *   - Arbitrum USDC (native): https://www.circle.com/en/usdc-multichain/arbitrum
 *   - ARB token: https://arbiscan.io/token/0x912CE59144191C1204E64559FE8253a0e49E6548
 */

import type { TokenDefinition, PoolDefinition, SupportedChain } from './pools.js';
import { CHAIN_IDS } from './pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitrum One (42161) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ARBITRUM_TOKENS: Record<string, TokenDefinition> = {
  WETH: {
    symbol: 'WETH',
    // [FACT] Canonical WETH on Arbitrum One — verified on-chain
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    addressTier: '[FACT]',
  },
  USDC: {
    symbol: 'USDC',
    // [FACT] Native USDC on Arbitrum One (Circle deployment) — verified on-chain
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDCe: {
    symbol: 'USDC.e',
    // [FACT] Bridged USDC.e on Arbitrum One (legacy bridge) — verified on-chain
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    decimals: 6,
    addressTier: '[FACT]',
  },
  WBTC: {
    symbol: 'WBTC',
    // [FACT] Wrapped Bitcoin on Arbitrum One — verified on-chain
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    addressTier: '[FACT]',
  },
  USDT: {
    symbol: 'USDT',
    // [FACT] Tether USD on Arbitrum One — verified on-chain
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    addressTier: '[FACT]',
  },
  ARB: {
    symbol: 'ARB',
    // [FACT] Arbitrum governance token — verified on-chain
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    addressTier: '[FACT]',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v3 on Arbitrum One (42161) — Contract Addresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniswap v3 deployment on Arbitrum One.
 * [FACT] Factory: canonical Uniswap v3 factory — verified on-chain
 * [FACT] QuoterV2: canonical Uniswap v3 QuoterV2 on Arbitrum — verified on-chain
 * Source: https://docs.uniswap.org/contracts/v3/reference/deployments/arbitrum-deployments
 */
export const ARBITRUM_UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as const;
export const ARBITRUM_UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Arbitrum One Pool Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbitrum One (42161) research pool universe for Phase 4.6.
 *
 * ALL pools are [PROVISIONAL] until verified by the campaign runner's
 * on-chain bytecode check (eth_getCode).
 *
 * Pool addresses sourced from:
 *   - Uniswap v3 Arbitrum analytics: https://info.uniswap.org/#/arbitrum
 *   - Arbiscan explorer pool verification
 */
const CHAIN: SupportedChain = 'arbitrum';
const CHAIN_ID = CHAIN_IDS.ARBITRUM; // 42161

export const ARBITRUM_UNISWAP_V3_POOLS: PoolDefinition[] = [
  {
    id: 'univ3-arbitrum-weth-usdc-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Arbitrum One (42161)
    poolAddress: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
    token0: ARBITRUM_TOKENS['WETH']!,
    token1: ARBITRUM_TOKENS['USDC']!,
    feeBps: 5,
    status: 'active',
    note: 'Arbitrum Uniswap v3 WETH/USDC (native) 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-arbitrum-weth-usdce-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Arbitrum One (42161)
    poolAddress: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
    token0: ARBITRUM_TOKENS['WETH']!,
    token1: ARBITRUM_TOKENS['USDCe']!,
    feeBps: 5,
    status: 'active',
    note: 'Arbitrum Uniswap v3 WETH/USDC.e (bridged) 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-arbitrum-weth-usdc-3000',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Arbitrum One (42161)
    poolAddress: '0x17c14D2c404D167802b16C450d3c99F88F2c4F4d',
    token0: ARBITRUM_TOKENS['WETH']!,
    token1: ARBITRUM_TOKENS['USDCe']!,
    feeBps: 30,
    status: 'active',
    note: 'Arbitrum Uniswap v3 WETH/USDC.e 0.30% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-arbitrum-wbtc-weth-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Arbitrum One (42161)
    poolAddress: '0x2f5e87C9312fa29aed5c179E456625D79015299c',
    token0: ARBITRUM_TOKENS['WBTC']!,
    token1: ARBITRUM_TOKENS['WETH']!,
    feeBps: 5,
    status: 'active',
    note: 'Arbitrum Uniswap v3 WBTC/WETH 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-arbitrum-weth-usdt-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Arbitrum One (42161)
    poolAddress: '0x641C00A822e8b671738d32a431a4Fb6074E5c79d',
    token0: ARBITRUM_TOKENS['WETH']!,
    token1: ARBITRUM_TOKENS['USDT']!,
    feeBps: 5,
    status: 'active',
    note: 'Arbitrum Uniswap v3 WETH/USDT 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All Arbitrum Active Pools
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_ARBITRUM_ACTIVE_POOLS: PoolDefinition[] = [
  ...ARBITRUM_UNISWAP_V3_POOLS,
].filter((p) => p.status === 'active');

export const ALL_ARBITRUM_POOLS: PoolDefinition[] = [...ARBITRUM_UNISWAP_V3_POOLS];
