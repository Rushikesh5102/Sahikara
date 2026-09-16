/**
 * SAHIKARA — Phase 4.7 Dynamic Pool Discovery Script
 *
 * Runs dynamic discovery across Base, Arbitrum, Optimism, and Polygon
 * using DynamicPoolDiscovery to find all active pools across token pairs
 * and fee tiers (100, 500, 3000, 10000).
 */

import { createPublicClient, http } from 'viem';
import { base, arbitrum, optimism, polygon } from 'viem/chains';
import 'dotenv/config';

import { DynamicPoolDiscovery } from '../src/discovery/DynamicPoolDiscovery.js';
import { BASE_TOKENS, UNISWAP_V3_FACTORY as BASE_FACTORY } from '../src/config/pools.js';
import { ARBITRUM_TOKENS, ARBITRUM_UNISWAP_V3_FACTORY } from '../src/config/pools-arbitrum.js';
import { OPTIMISM_TOKENS, OPTIMISM_UNISWAP_V3_FACTORY } from '../src/config/pools-optimism.js';
import { POLYGON_TOKENS, POLYGON_UNISWAP_V3_FACTORY } from '../src/config/pools-polygon.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.7 — Dynamic Pool Discovery Across 4 Chains');
  console.log('═══════════════════════════════════════════════════════════════');

  const baseClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  });

  const arbitrumClient = createPublicClient({
    chain: arbitrum,
    transport: http(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'),
  });

  const optimismClient = createPublicClient({
    chain: optimism,
    transport: http(process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'),
  });

  const polygonClient = createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com'),
  });

  const feeTiers = [100, 500, 3000, 10000]; // 1 bps, 5 bps, 30 bps, 100 bps

  // 1. Arbitrum One Discovery
  console.log('\n[1/4] Discovering Arbitrum One Uniswap V3 Pools...');
  const arbDiscovery = new DynamicPoolDiscovery(arbitrumClient);
  const arbTokens = [
    ARBITRUM_TOKENS['WETH']!,
    ARBITRUM_TOKENS['USDC']!,
    ARBITRUM_TOKENS['USDCe']!,
    ARBITRUM_TOKENS['WBTC']!,
    ARBITRUM_TOKENS['USDT']!,
    ARBITRUM_TOKENS['ARB']!,
  ];
  const arbDiscovered = await arbDiscovery.discoverPools({
    chain: 'arbitrum',
    chainId: 42161,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    factoryAddress: ARBITRUM_UNISWAP_V3_FACTORY,
    tokens: arbTokens,
    feeTiers,
  });
  console.log(`Arbitrum pools found: ${arbDiscovered.length} (${arbDiscovered.filter((p) => p.classification === 'ACTIVE').length} ACTIVE)`);
  for (const p of arbDiscovered.filter((p) => p.classification === 'ACTIVE')) {
    console.log(`  - ${p.id} (${p.poolAddress}) fee: ${p.feeBps}bps, liq: ${p.liquidity}`);
  }

  // 2. Optimism Discovery
  console.log('\n[2/4] Discovering Optimism Uniswap V3 Pools...');
  const optDiscovery = new DynamicPoolDiscovery(optimismClient);
  const optTokens = [
    OPTIMISM_TOKENS['WETH']!,
    OPTIMISM_TOKENS['USDC']!,
    OPTIMISM_TOKENS['USDCe']!,
    OPTIMISM_TOKENS['USDT']!,
    OPTIMISM_TOKENS['OP']!,
  ];
  const optDiscovered = await optDiscovery.discoverPools({
    chain: 'optimism',
    chainId: 10,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    factoryAddress: OPTIMISM_UNISWAP_V3_FACTORY,
    tokens: optTokens,
    feeTiers,
  });
  console.log(`Optimism pools found: ${optDiscovered.length} (${optDiscovered.filter((p) => p.classification === 'ACTIVE').length} ACTIVE)`);
  for (const p of optDiscovered.filter((p) => p.classification === 'ACTIVE')) {
    console.log(`  - ${p.id} (${p.poolAddress}) fee: ${p.feeBps}bps, liq: ${p.liquidity}`);
  }

  // 3. Polygon Discovery
  console.log('\n[3/4] Discovering Polygon Uniswap V3 Pools...');
  const polyDiscovery = new DynamicPoolDiscovery(polygonClient);
  const polyTokens = [
    POLYGON_TOKENS['WMATIC']!,
    POLYGON_TOKENS['WETH']!,
    POLYGON_TOKENS['USDC']!,
    POLYGON_TOKENS['USDCe']!,
    POLYGON_TOKENS['USDT']!,
  ];
  const polyDiscovered = await polyDiscovery.discoverPools({
    chain: 'polygon',
    chainId: 137,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    factoryAddress: POLYGON_UNISWAP_V3_FACTORY,
    tokens: polyTokens,
    feeTiers,
  });
  console.log(`Polygon pools found: ${polyDiscovered.length} (${polyDiscovered.filter((p) => p.classification === 'ACTIVE').length} ACTIVE)`);
  for (const p of polyDiscovered.filter((p) => p.classification === 'ACTIVE')) {
    console.log(`  - ${p.id} (${p.poolAddress}) fee: ${p.feeBps}bps, liq: ${p.liquidity}`);
  }

  // 4. Base Discovery
  console.log('\n[4/4] Discovering Base Uniswap V3 Pools...');
  const baseDiscovery = new DynamicPoolDiscovery(baseClient);
  const baseTokens = [
    BASE_TOKENS['WETH']!,
    BASE_TOKENS['USDC']!,
    BASE_TOKENS['USDbC']!,
    BASE_TOKENS['cbBTC']!,
    BASE_TOKENS['AERO']!,
  ];
  const baseDiscovered = await baseDiscovery.discoverPools({
    chain: 'base',
    chainId: 8453,
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    factoryAddress: BASE_FACTORY,
    tokens: baseTokens,
    feeTiers,
  });
  console.log(`Base pools found: ${baseDiscovered.length} (${baseDiscovered.filter((p) => p.classification === 'ACTIVE').length} ACTIVE)`);
  for (const p of baseDiscovered.filter((p) => p.classification === 'ACTIVE')) {
    console.log(`  - ${p.id} (${p.poolAddress}) fee: ${p.feeBps}bps, liq: ${p.liquidity}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' Dynamic Discovery Complete');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
