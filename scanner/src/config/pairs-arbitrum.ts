/**
 * SAHIKARA Observer — Arbitrum One (42161) Research Pair Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * RULES:
 *   - No unverified addresses may be enabled for active observation.
 *   - Candidates are RESEARCH ONLY — not live trading selections.
 *   - All pairs use [PROVISIONAL] tokens from pools-arbitrum.ts.
 */

import type { ResearchPair } from './pairs.js';
import { CHAIN_IDS } from './pools.js';
import { ARBITRUM_TOKENS } from './pools-arbitrum.js';

export const ARBITRUM_CHAIN_ID = CHAIN_IDS.ARBITRUM;

export const ARBITRUM_RESEARCH_PAIRS: ResearchPair[] = [
  {
    id: 'arbitrum-weth-usdc',
    chainId: ARBITRUM_CHAIN_ID,
    symbol: 'WETH/USDC',
    baseToken: ARBITRUM_TOKENS['WETH']!,
    quoteToken: ARBITRUM_TOKENS['USDC']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Arbitrum baseline pair. WETH / native USDC.',
    sourceReference: 'ARBITRUM_TOKENS[WETH] + ARBITRUM_TOKENS[USDC] — [PROVISIONAL]',
  },
  {
    id: 'arbitrum-weth-usdce',
    chainId: ARBITRUM_CHAIN_ID,
    symbol: 'WETH/USDC.e',
    baseToken: ARBITRUM_TOKENS['WETH']!,
    quoteToken: ARBITRUM_TOKENS['USDCe']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Arbitrum pair. WETH vs bridged USDC.e (higher-liquidity legacy pools).',
    sourceReference: 'ARBITRUM_TOKENS[USDCe] — [PROVISIONAL]',
  },
  {
    id: 'arbitrum-wbtc-weth',
    chainId: ARBITRUM_CHAIN_ID,
    symbol: 'WBTC/WETH',
    baseToken: ARBITRUM_TOKENS['WBTC']!,
    quoteToken: ARBITRUM_TOKENS['WETH']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Arbitrum BTC cross-pair research candidate.',
    sourceReference: 'ARBITRUM_TOKENS[WBTC] + ARBITRUM_TOKENS[WETH] — [PROVISIONAL]',
  },
  {
    id: 'arbitrum-weth-usdt',
    chainId: ARBITRUM_CHAIN_ID,
    symbol: 'WETH/USDT',
    baseToken: ARBITRUM_TOKENS['WETH']!,
    quoteToken: ARBITRUM_TOKENS['USDT']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Arbitrum WETH/USDT pair.',
    sourceReference: 'ARBITRUM_TOKENS[USDT] — [PROVISIONAL]',
  },
];
