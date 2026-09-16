/**
 * SAHIKARA Observer — Optimism (10) Research Pair Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * RULES:
 *   - No unverified addresses may be enabled for active observation.
 *   - Candidates are RESEARCH ONLY — not live trading selections.
 *   - All pairs use [PROVISIONAL] tokens from pools-optimism.ts.
 */

import type { ResearchPair } from './pairs.js';
import { CHAIN_IDS } from './pools.js';
import { OPTIMISM_TOKENS } from './pools-optimism.js';

export const OPTIMISM_CHAIN_ID = CHAIN_IDS.OPTIMISM;

export const OPTIMISM_RESEARCH_PAIRS: ResearchPair[] = [
  {
    id: 'optimism-weth-usdc',
    chainId: OPTIMISM_CHAIN_ID,
    symbol: 'WETH/USDC',
    baseToken: OPTIMISM_TOKENS['WETH']!,
    quoteToken: OPTIMISM_TOKENS['USDC']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Optimism baseline pair. WETH / native USDC.',
    sourceReference: 'OPTIMISM_TOKENS[WETH] + OPTIMISM_TOKENS[USDC] — [PROVISIONAL]',
  },
  {
    id: 'optimism-weth-usdce',
    chainId: OPTIMISM_CHAIN_ID,
    symbol: 'WETH/USDC.e',
    baseToken: OPTIMISM_TOKENS['WETH']!,
    quoteToken: OPTIMISM_TOKENS['USDCe']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Optimism pair. WETH vs bridged USDC.e (legacy OP bridge pools).',
    sourceReference: 'OPTIMISM_TOKENS[USDCe] — [PROVISIONAL]',
  },
  {
    id: 'optimism-weth-usdt',
    chainId: OPTIMISM_CHAIN_ID,
    symbol: 'WETH/USDT',
    baseToken: OPTIMISM_TOKENS['WETH']!,
    quoteToken: OPTIMISM_TOKENS['USDT']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Optimism WETH/USDT pair.',
    sourceReference: 'OPTIMISM_TOKENS[USDT] — [PROVISIONAL]',
  },
  {
    id: 'optimism-wsteth-weth',
    chainId: OPTIMISM_CHAIN_ID,
    symbol: 'wstETH/WETH',
    baseToken: OPTIMISM_TOKENS['wstETH']!,
    quoteToken: OPTIMISM_TOKENS['WETH']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Optimism staked ETH pair (analogous to Base wstETH/WETH baseline).',
    sourceReference: 'OPTIMISM_TOKENS[wstETH] + OPTIMISM_TOKENS[WETH] — [PROVISIONAL]',
  },
];
