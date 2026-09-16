/**
 * SAHIKARA Observer — Optimism (10) Pool Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — Verified on-chain or from official documentation
 *   [PROVISIONAL]— To be confirmed via eth_getCode before quoting
 *
 * SAFETY DIRECTIVE:
 *   All pools in this file are marked [PROVISIONAL] until the Phase 4.6 campaign
 *   runner confirms bytecode existence via eth_getCode on Optimism Mainnet.
 *   No quote is issued against a pool whose bytecode returns < 4 bytes.
 *
 * GAS MODEL NOTE:
 *   Optimism uses the OP Stack (same architecture as Base). The existing
 *   BaseGasModel is reused for Optimism (L2 execution + L1 data fee calldata model).
 *
 * References:
 *   - Uniswap v3 Optimism: https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments
 *   - Optimism USDC (native): https://www.circle.com/en/usdc-multichain/optimism
 *   - OP token: https://optimistic.etherscan.io/token/0x4200000000000000000000000000000000000042
 */

import type { TokenDefinition, PoolDefinition, SupportedChain } from './pools.js';
import { CHAIN_IDS } from './pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Optimism (10) Token Registry
// ─────────────────────────────────────────────────────────────────────────────

export const OPTIMISM_TOKENS: Record<string, TokenDefinition> = {
  WETH: {
    symbol: 'WETH',
    // [FACT] Canonical WETH on Optimism (predeploy) — verified on-chain
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    addressTier: '[FACT]',
  },
  USDC: {
    symbol: 'USDC',
    // [FACT] Native USDC on Optimism (Circle deployment) — verified on-chain
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDCe: {
    symbol: 'USDC.e',
    // [FACT] Bridged USDC.e on Optimism (legacy OP bridge) — verified on-chain
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    decimals: 6,
    addressTier: '[FACT]',
  },
  USDT: {
    symbol: 'USDT',
    // [FACT] Tether USD on Optimism — verified on-chain
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimals: 6,
    addressTier: '[FACT]',
  },
  OP: {
    symbol: 'OP',
    // [FACT] Optimism governance token (predeploy) — verified on-chain
    address: '0x4200000000000000000000000000000000000042',
    decimals: 18,
    addressTier: '[FACT]',
  },
  wstETH: {
    symbol: 'wstETH',
    // [FACT] Lido Wrapped Staked ETH on Optimism — verified on-chain
    address: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb',
    decimals: 18,
    addressTier: '[FACT]',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v3 on Optimism (10) — Contract Addresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uniswap v3 deployment on Optimism.
 * [FACT] Factory: canonical Uniswap v3 factory — verified on-chain
 * [FACT] QuoterV2: canonical Uniswap v3 QuoterV2 on Optimism — verified on-chain
 * Source: https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments
 */
export const OPTIMISM_UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as const;
export const OPTIMISM_UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Optimism Pool Registry
// ─────────────────────────────────────────────────────────────────────────────

const CHAIN: SupportedChain = 'optimism';
const CHAIN_ID = CHAIN_IDS.OPTIMISM; // 10

export const OPTIMISM_UNISWAP_V3_POOLS: PoolDefinition[] = [
  // ── Active Canonical Pools (Verified On-Chain [FACT]) ───────────────────────
  {
    id: 'univ3-optimism-weth-usdc-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Optimism (10). token0 is USDC (0x0b2C... < 0x4200...)
    poolAddress: '0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b',
    token0: OPTIMISM_TOKENS['USDC']!,
    token1: OPTIMISM_TOKENS['WETH']!,
    feeBps: 5,
    status: 'active',
    note: 'Optimism Uniswap v3 USDC/WETH (native) 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-optimism-weth-usdce-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Optimism (10)
    poolAddress: '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9',
    token0: OPTIMISM_TOKENS['WETH']!,
    token1: OPTIMISM_TOKENS['USDCe']!,
    feeBps: 5,
    status: 'active',
    note: 'Optimism Uniswap v3 WETH/USDC.e (bridged) 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-optimism-weth-usdc-3000',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Canonical WETH/USDC.e 3000 pool. Verified on-chain (liquidity active, factory match)
    poolAddress: '0xB589969D38CE76D3d7AA319De7133bC9755fD840',
    token0: OPTIMISM_TOKENS['WETH']!,
    token1: OPTIMISM_TOKENS['USDCe']!,
    feeBps: 30,
    status: 'active',
    note: 'Optimism Uniswap v3 WETH/USDC.e (bridged) 0.30% pool. Canonical replacement verified on-chain.',
    tier: '[FACT]',
  },
  {
    id: 'univ3-optimism-weth-usdt-500',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Optimism (10)
    poolAddress: '0xc858A329Bf053BE78D6239C4A4343B8FbD21472b',
    token0: OPTIMISM_TOKENS['WETH']!,
    token1: OPTIMISM_TOKENS['USDT']!,
    feeBps: 5,
    status: 'active',
    note: 'Optimism Uniswap v3 WETH/USDT 0.05% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },
  {
    id: 'univ3-optimism-wsteth-weth-100',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    // [FACT] Verified on-chain via eth_call on Optimism (10)
    poolAddress: '0x04F6C85A1B00F6D9B75f91FD23835974Cc07E65c',
    token0: OPTIMISM_TOKENS['wstETH']!,
    token1: OPTIMISM_TOKENS['WETH']!,
    feeBps: 1,
    status: 'active',
    note: 'Optimism Uniswap v3 wstETH/WETH 0.01% pool. Verified on-chain (liquidity active, factory match).',
    tier: '[FACT]',
  },

  // ── Historical Disabled Pools (Preserved per Section 3 Directives) ──────────
  {
    id: 'univ3-optimism-weth-usdc-3000-historical-disabled',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x1C3140aB59d6cAf9fa7459C6f83D4B52ba881d36',
    token0: OPTIMISM_TOKENS['WETH']!,
    token1: OPTIMISM_TOKENS['USDCe']!,
    feeBps: 30,
    status: 'disabled',
    note: 'HISTORICAL DISABLED (2026-09-16): Configured identity WETH/USDC.e 3000. Observed actual on-chain identity is OP/USDC.e 3000. Canonical replacement is 0xB589969D38CE76D3d7AA319De7133bC9755fD840. Sourced from Optimism Mainnet RPC via eth_call.',
    tier: '[PROVISIONAL]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4.10 — Expanded DEX Pool Registry (Optimism)
// ─────────────────────────────────────────────────────────────────────────────

export const OPTIMISM_EXPANDED_POOLS: PoolDefinition[] = [
  {
    id: 'velo-v2-optimism-weth-usdc-volatile',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Velodrome v2',
    protocol: 'velodrome-v2-volatile',
    poolAddress: '0xF4F2657AE744354bAcA871E56775e5083F7276Ab',
    token0: OPTIMISM_TOKENS['USDC']!,
    token1: OPTIMISM_TOKENS['WETH']!,
    feeBps: 30,
    status: 'active',
    qualityTier: 'TIER_0',
    note: 'Velodrome v2 WETH/USDC volatile pool on Optimism. [FACT] On-chain verified via Factory.getPool.',
    tier: '[FACT]',
  },
  {
    id: 'velo-v2-optimism-usdc-usdce-stable',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Velodrome v2',
    protocol: 'velodrome-v2-stable',
    poolAddress: '0x36E3c209B373b861c185ecdBb8b2EbDD98587BDb',
    token0: OPTIMISM_TOKENS['USDC']!,
    token1: OPTIMISM_TOKENS['USDCe']!,
    feeBps: 5,
    status: 'active',
    qualityTier: 'TIER_0',
    note: 'Velodrome v2 USDC/USDC.e stable pool on Optimism. [FACT] On-chain verified via Factory.getPool.',
    tier: '[FACT]',
  },
  {
    id: 'velo-v2-optimism-weth-op-volatile',
    chain: CHAIN,
    chainId: CHAIN_ID,
    dex: 'Velodrome v2',
    protocol: 'velodrome-v2-volatile',
    poolAddress: '0xd25711EdfBf747efCE181442Cc1D8F5F8fc8a0D3',
    token0: OPTIMISM_TOKENS['WETH']!,
    token1: OPTIMISM_TOKENS['OP']!,
    feeBps: 30,
    status: 'active',
    qualityTier: 'TIER_0',
    note: 'Velodrome v2 WETH/OP volatile pool on Optimism. [FACT] On-chain verified via Factory.getPool.',
    tier: '[FACT]',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All Optimism Active Pools
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_OPTIMISM_ACTIVE_POOLS: PoolDefinition[] = [
  ...OPTIMISM_UNISWAP_V3_POOLS,
  ...OPTIMISM_EXPANDED_POOLS,
].filter((p) => p.status === 'active');

export const ALL_OPTIMISM_POOLS: PoolDefinition[] = [
  ...OPTIMISM_UNISWAP_V3_POOLS,
  ...OPTIMISM_EXPANDED_POOLS,
];

