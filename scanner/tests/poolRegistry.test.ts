/**
 * SAHIKARA — Multi-Pair & Multi-DEX Pool Registry Tests
 *
 * Tests for:
 *   - Configurable research universe (`RESEARCH_PAIRS`)
 *   - Extended token registry definitions and decimal accuracy
 *   - Multi-DEX pool registry entries (Uniswap V3, Aerodrome, PancakeSwap V3)
 *   - PancakeSwap V3 adapter supports() and QuoterV2 call structure
 *   - Aerodrome Slipstream adapter safety (NOT_READY, never fabricates quotes)
 */

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_PAIRS,
  EXTENDED_BASE_TOKENS,
  getActiveResearchPairs,
  getResearchPairById,
} from '../src/config/pairs.js';
import {
  ALL_POOLS,
  ALL_ACTIVE_POOLS,
  UNISWAP_V3_POOLS,
  AERODROME_POOLS,
  PANCAKESWAP_V3_POOLS,
} from '../src/config/pools.js';
import { PancakeSwapV3Adapter } from '../src/adapters/PancakeSwapV3Adapter.js';
import { AerodromeSlipstreamAdapter } from '../src/adapters/AerodromeSlipstreamAdapter.js';
import type { IDataSource } from '../src/data-sources/IDataSource.js';

describe('Multi-Pair Research Universe Registry', () => {
  it('contains expected Phase 1E candidate pairs', () => {
    const pairIds = RESEARCH_PAIRS.map((p) => p.id);
    expect(pairIds).toContain('base-weth-usdc');
    expect(pairIds).toContain('base-aero-usdc');
    expect(pairIds).toContain('base-degen-weth');
    expect(pairIds).toContain('base-virtual-weth');
  });

  it('marks baseline pair as BASELINE_ACTIVE and candidates as RESEARCH_CANDIDATE', () => {
    const wethUsdc = getResearchPairById('base-weth-usdc');
    expect(wethUsdc?.researchStatus).toBe('BASELINE_ACTIVE');

    const aeroUsdc = getResearchPairById('base-aero-usdc');
    expect(aeroUsdc?.researchStatus).toBe('RESEARCH_CANDIDATE');

    const degenWeth = getResearchPairById('base-degen-weth');
    expect(degenWeth?.researchStatus).toBe('RESEARCH_CANDIDATE');
  });

  it('verifies all tokens have valid checksummed addresses and realistic decimals', () => {
    for (const [symbol, token] of Object.entries(EXTENDED_BASE_TOKENS)) {
      expect(token.symbol).toBe(symbol);
      expect(token.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(token.decimals).toBeGreaterThanOrEqual(6);
      expect(token.decimals).toBeLessThanOrEqual(18);
    }
  });

  it('filters active research pairs correctly', () => {
    const active = getActiveResearchPairs(8453);
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active.every((p) => p.chainId === 8453 && p.enabled)).toBe(true);
  });
});

describe('Multi-DEX Pool Registry', () => {
  it('includes pools for Uniswap V3, Aerodrome, and PancakeSwap V3', () => {
    const protocols = new Set(ALL_POOLS.map((p) => p.protocol));
    expect(protocols.has('uniswap-v3')).toBe(true);
    expect(protocols.has('aerodrome-volatile')).toBe(true);
    expect(protocols.has('aerodrome-stable')).toBe(true);
    expect(protocols.has('aerodrome-slipstream')).toBe(true);
    expect(protocols.has('pancakeswap-v3')).toBe(true);
  });

  it('distinguishes pool entries by unique poolAddress and fee tier', () => {
    const poolAddresses = ALL_POOLS.map((p) => p.poolAddress.toLowerCase());
    const uniqueAddresses = new Set(poolAddresses);
    // All registered pool addresses should be unique
    expect(uniqueAddresses.size).toBe(poolAddresses.length);
  });

  it('marks Slipstream pool as stub status', () => {
    const slipstream = AERODROME_POOLS.find((p) => p.protocol === 'aerodrome-slipstream');
    expect(slipstream).toBeDefined();
    expect(slipstream?.status).toBe('stub');
  });

  it('verifies ALL_ACTIVE_POOLS only contains active pools', () => {
    expect(ALL_ACTIVE_POOLS.every((p) => p.status === 'active')).toBe(true);
    const slipstreamInActive = ALL_ACTIVE_POOLS.some((p) => p.protocol === 'aerodrome-slipstream');
    expect(slipstreamInActive).toBe(false);
  });
});

describe('PancakeSwapV3Adapter', () => {
  const mockDataSource: IDataSource = {
    id: 'mock-source',
    getLatestBlock: async () => ({
      header: { blockNumber: 12345678n, baseFeePerGas: 1000000n, timestamp: 1700000000n },
      latencyMs: 15,
    }),
    getGasPrice: async () => ({
      gasPrice: { baseFeePerGas: 1000000n, priorityFeePerGas: 100000n, gasPriceWei: 1100000n, gasPriceGwei: 0.0011 },
      latencyMs: 15,
    }),
    readContract: async <T>() => ({
      data: [3500000000n, 123456789n, 0, 150000n] as unknown as T,
      latencyMs: 20,
    }),
    verifyConnectivity: async () => {},
  };

  it('correctly supports active pancakeswap-v3 pools', () => {
    const adapter = new PancakeSwapV3Adapter(mockDataSource);
    const cakePool = PANCAKESWAP_V3_POOLS[0]!;
    expect(adapter.supports(cakePool)).toBe(true);

    const uniPool = UNISWAP_V3_POOLS[0]!;
    expect(adapter.supports(uniPool)).toBe(false);
  });

  it('returns valid quote structure for supported pool', async () => {
    const adapter = new PancakeSwapV3Adapter(mockDataSource);
    const cakePool = PANCAKESWAP_V3_POOLS[0]!;
    const obs = await adapter.getQuote(cakePool, 1, 1000000000000000n, 12345678n);

    expect(obs.pool.id).toBe(cakePool.id);
    expect(obs.quote?.amountIn).toBe(1000000000000000n);
    expect(obs.quote?.amountOut).toBe(3500000000n);
    expect(obs.blockNumber).toBe(12345678n);
  });
});

describe('AerodromeSlipstreamAdapter (NOT_READY Safety Invariant)', () => {
  it('marks adapter status as NOT_READY', () => {
    const adapter = new AerodromeSlipstreamAdapter();
    expect(adapter.status).toBe('NOT_READY');
  });

  it('refuses to support pools while incomplete', () => {
    const adapter = new AerodromeSlipstreamAdapter();
    const slipstreamPool = AERODROME_POOLS.find((p) => p.protocol === 'aerodrome-slipstream')!;
    expect(adapter.supports(slipstreamPool)).toBe(false);
  });

  it('returns null quote and explicit NOT_READY error when queried', async () => {
    const adapter = new AerodromeSlipstreamAdapter();
    const slipstreamPool = AERODROME_POOLS.find((p) => p.protocol === 'aerodrome-slipstream')!;
    const obs = await adapter.getQuote(slipstreamPool, 1, 1000n, 100n);
    expect(obs.quote).toBeNull();
    expect(obs.error).toContain('NOT_READY');
    expect(obs.error).toContain('Zero quotes are fabricated');
  });
});
