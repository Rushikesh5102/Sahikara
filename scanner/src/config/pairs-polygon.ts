/**
 * SAHIKARA Observer — Polygon (137) Research Pair Registry
 *
 * Phase 4.6: Multi-Chain Discovery & Empirical Validation
 *
 * RULES:
 *   - No unverified addresses may be enabled for active observation.
 *   - Candidates are RESEARCH ONLY — not live trading selections.
 *   - All pairs use [PROVISIONAL] tokens from pools-polygon.ts.
 */

import type { ResearchPair } from './pairs.js';
import { CHAIN_IDS } from './pools.js';
import { POLYGON_TOKENS } from './pools-polygon.js';

export const POLYGON_CHAIN_ID = CHAIN_IDS.POLYGON;

export const POLYGON_RESEARCH_PAIRS: ResearchPair[] = [
  {
    id: 'polygon-weth-usdc',
    chainId: POLYGON_CHAIN_ID,
    symbol: 'WETH/USDC',
    baseToken: POLYGON_TOKENS['WETH']!,
    quoteToken: POLYGON_TOKENS['USDC']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Polygon cross-DEX baseline pair. WETH (bridged) / native USDC.',
    sourceReference: 'POLYGON_TOKENS[WETH] + POLYGON_TOKENS[USDC] — [PROVISIONAL]',
  },
  {
    id: 'polygon-weth-usdce',
    chainId: POLYGON_CHAIN_ID,
    symbol: 'WETH/USDC.e',
    baseToken: POLYGON_TOKENS['WETH']!,
    quoteToken: POLYGON_TOKENS['USDCe']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Polygon pair. WETH vs bridged USDC.e for pool discovery.',
    sourceReference: 'POLYGON_TOKENS[USDCe] — [PROVISIONAL]',
  },
  {
    id: 'polygon-wmatic-usdce',
    chainId: POLYGON_CHAIN_ID,
    symbol: 'WMATIC/USDC.e',
    baseToken: POLYGON_TOKENS['WMATIC']!,
    quoteToken: POLYGON_TOKENS['USDCe']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Polygon native asset pair. WMATIC vs bridged USDC.e.',
    sourceReference: 'POLYGON_TOKENS[WMATIC] + POLYGON_TOKENS[USDCe] — [PROVISIONAL]',
  },
  {
    id: 'polygon-wmatic-weth',
    chainId: POLYGON_CHAIN_ID,
    symbol: 'WMATIC/WETH',
    baseToken: POLYGON_TOKENS['WMATIC']!,
    quoteToken: POLYGON_TOKENS['WETH']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Phase 4.6 Polygon native gas token vs WETH.',
    sourceReference: 'POLYGON_TOKENS[WMATIC] + POLYGON_TOKENS[WETH] — [PROVISIONAL]',
  },
];
