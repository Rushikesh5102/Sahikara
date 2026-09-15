/**
 * SAHIKARA Observer — Research Pair Universe Registry
 *
 * Configurable multi-pair research universe.
 * Strictly separates research candidate tracking from trade execution.
 *
 * TRUTH-TIER LABELS:
 *   [FACT]       — On-chain verified token address / decimals
 *   [PROVISIONAL]— Candidate under research observation
 *
 * RULES:
 *   - No unverified addresses may be enabled for active observation.
 *   - Economics engine must never hardcode pair assumptions.
 *   - Candidates are RESEARCH ONLY — not live trading selections.
 */

import { BASE_TOKENS, type TokenDefinition } from './pools.js';

export type PairResearchStatus = 'BASELINE_ACTIVE' | 'RESEARCH_CANDIDATE' | 'UNVERIFIED';

export interface ResearchPair {
  id: string;
  chainId: number;
  symbol: string;
  baseToken: TokenDefinition;
  quoteToken: TokenDefinition;
  enabled: boolean;
  researchStatus: PairResearchStatus;
  notes: string;
  sourceReference: string;
}

export const BASE_CHAIN_ID = 8453;

/**
 * Extended token registry for Phase 1E candidates.
 * Sourced from official project contracts verified on BaseScan.
 */
export const EXTENDED_BASE_TOKENS: Record<string, TokenDefinition> = {
  ...BASE_TOKENS,
  DEGEN: {
    symbol: 'DEGEN',
    // [FACT] Verified on BaseScan: https://basescan.org/token/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    decimals: 18,
    addressTier: '[FACT]',
  },
  VIRTUAL: {
    symbol: 'VIRTUAL',
    // [FACT] Verified on BaseScan: https://basescan.org/token/0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b
    address: '0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b',
    decimals: 18,
    addressTier: '[FACT]',
  },
};

/**
 * Multi-pair candidate universe on Base.
 */
export const RESEARCH_PAIRS: ResearchPair[] = [
  {
    id: 'base-weth-usdc',
    chainId: BASE_CHAIN_ID,
    symbol: 'WETH/USDC',
    baseToken: EXTENDED_BASE_TOKENS['WETH']!,
    quoteToken: EXTENDED_BASE_TOKENS['USDC']!,
    enabled: true,
    researchStatus: 'BASELINE_ACTIVE',
    notes: 'Phase 1D baseline pair. High liquidity benchmark.',
    sourceReference: 'Canonical Base bridge & Uniswap/Aerodrome deployments',
  },
  {
    id: 'base-aero-usdc',
    chainId: BASE_CHAIN_ID,
    symbol: 'AERO/USDC',
    baseToken: EXTENDED_BASE_TOKENS['AERO']!,
    quoteToken: EXTENDED_BASE_TOKENS['USDC']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Aerodrome protocol governance token paired against native USDC.',
    sourceReference: 'Aerodrome official documentation',
  },
  {
    id: 'base-degen-weth',
    chainId: BASE_CHAIN_ID,
    symbol: 'DEGEN/WETH',
    baseToken: EXTENDED_BASE_TOKENS['DEGEN']!,
    quoteToken: EXTENDED_BASE_TOKENS['WETH']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'High-volatility Base ecosystem social token.',
    sourceReference: 'BaseScan 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  },
  {
    id: 'base-virtual-weth',
    chainId: BASE_CHAIN_ID,
    symbol: 'VIRTUAL/WETH',
    baseToken: EXTENDED_BASE_TOKENS['VIRTUAL']!,
    quoteToken: EXTENDED_BASE_TOKENS['WETH']!,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'Virtuals Protocol AI agent token paired with WETH.',
    sourceReference: 'BaseScan 0x0b3e328455c4059EEb9e3f84b5543F74e24e7e1b',
  },
];

/**
 * Filter helpers for research execution
 */
export function getActiveResearchPairs(chainId: number = BASE_CHAIN_ID): ResearchPair[] {
  return RESEARCH_PAIRS.filter((p) => p.chainId === chainId && p.enabled);
}

export function getResearchPairById(id: string): ResearchPair | undefined {
  return RESEARCH_PAIRS.find((p) => p.id === id);
}
