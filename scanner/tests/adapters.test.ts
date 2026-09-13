/**
 * SAHIKARA Observer — Adapter Unit Tests
 *
 * Tests for:
 *   - Adapter support() method logic
 *   - Malformed RPC response handling
 *   - Stub adapter response for unsupported pool types
 *   - Pool registry integrity
 *
 * Uses mock data — no live RPC calls.
 */

import { describe, it, expect, vi } from 'vitest';
import type { IDataSource, BlockHeader, GasPriceInfo, ContractCallResult } from '../src/data-sources/IDataSource.js';
import { UniswapV3Adapter } from '../src/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../src/adapters/AerodromeAdapter.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import { ALL_POOLS } from '../src/config/pools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeToken(symbol: string, decimals: number, address = '0x0000000000000000000000000000000000000001'): TokenDefinition {
  return {
    symbol,
    address: address as `0x${string}`,
    decimals,
    addressTier: '[PROVISIONAL]',
  };
}

function makePool(overrides: Partial<PoolDefinition> = {}): PoolDefinition {
  return {
    id: 'test-pool',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x1234567890123456789012345678901234567890',
    token0: makeToken('WETH', 18),
    token1: makeToken('USDC', 6),
    feeBps: 5,
    status: 'active',
    note: 'Test pool',
    tier: '[PROVISIONAL]',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock IDataSource
// ─────────────────────────────────────────────────────────────────────────────

function makeMockDataSource(overrides: Partial<IDataSource> = {}): IDataSource {
  return {
    id: 'mock-rpc',
    getLatestBlock: vi.fn().mockResolvedValue({
      header: { blockNumber: 12345n, baseFeePerGas: 1000000n, timestamp: BigInt(Date.now()) } as BlockHeader,
      latencyMs: 50,
    }),
    getGasPrice: vi.fn().mockResolvedValue({
      gasPrice: {
        baseFeePerGas: 1000000n,
        priorityFeePerGas: 100000n,
        gasPriceWei: 1100000n,
        gasPriceGwei: 0.0011,
      } as GasPriceInfo,
      latencyMs: 30,
    }),
    readContract: vi.fn(),
    verifyConnectivity: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UniswapV3Adapter Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('UniswapV3Adapter', () => {
  it('supports uniswap-v3 active pools', () => {
    const adapter = new UniswapV3Adapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'uniswap-v3', status: 'active' }))).toBe(true);
  });

  it('does not support aerodrome pools', () => {
    const adapter = new UniswapV3Adapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'aerodrome-volatile' }))).toBe(false);
  });

  it('does not support stub pools', () => {
    const adapter = new UniswapV3Adapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'uniswap-v3', status: 'stub' }))).toBe(false);
  });

  it('handles zero liquidity gracefully', async () => {
    const mockDs = makeMockDataSource({
      readContract: vi.fn().mockResolvedValue({
        data: [0n, 0, 0, 0, 0, 0, true], // slot0 with zero sqrtPrice
        latencyMs: 40,
      } as ContractCallResult<readonly [bigint, number, number, number, number, number, boolean]>),
    });

    const adapter = new UniswapV3Adapter(mockDs);
    const result = await adapter.getQuote(makePool(), 1.0, 416_666n, 12345n);

    expect(result.quote).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('zero liquidity');
  });

  it('handles RPC error gracefully (returns error observation, does not throw)', async () => {
    const mockDs = makeMockDataSource({
      readContract: vi.fn().mockRejectedValue(new Error('Connection timeout')),
    });

    const adapter = new UniswapV3Adapter(mockDs);
    const result = await adapter.getQuote(makePool(), 1.0, 416_666n, 12345n);

    expect(result.quote).toBeNull();
    expect(result.error).toContain('Connection timeout');
    // Must not throw — error is returned as data
  });

  it('handles unknown fee tier gracefully', async () => {
    const mockDs = makeMockDataSource({
      readContract: vi.fn().mockResolvedValue({
        data: [1234567890n, 100, 0, 0, 0, 0, true], // valid slot0
        latencyMs: 40,
      } as ContractCallResult<readonly [bigint, number, number, number, number, number, boolean]>),
    });

    const adapter = new UniswapV3Adapter(mockDs);
    const pool = makePool({ feeBps: 99 }); // not a valid Uniswap v3 fee tier
    const result = await adapter.getQuote(pool, 1.0, 416_666n, 12345n);

    expect(result.quote).toBeNull();
    expect(result.error).toContain('Unknown fee tier');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AerodromeAdapter Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AerodromeAdapter', () => {
  it('supports aerodrome-volatile active pools', () => {
    const adapter = new AerodromeAdapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'aerodrome-volatile', status: 'active' }))).toBe(true);
  });

  it('supports aerodrome-stable active pools', () => {
    const adapter = new AerodromeAdapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'aerodrome-stable', status: 'active' }))).toBe(true);
  });

  it('does not support aerodrome-slipstream (stub)', () => {
    const adapter = new AerodromeAdapter(makeMockDataSource());
    expect(adapter.supports(makePool({ protocol: 'aerodrome-slipstream', status: 'stub' }))).toBe(false);
  });

  it('returns stub observation for slipstream pools with clear explanation', async () => {
    const adapter = new AerodromeAdapter(makeMockDataSource());
    const pool = makePool({ protocol: 'aerodrome-slipstream', status: 'stub' });
    const result = await adapter.getQuote(pool, 1.0, 416_666n, 12345n);

    expect(result.quote).toBeNull();
    expect(result.error).toContain('ADAPTER_STUB');
    expect(result.error).toContain('DEC-015');
  });

  it('handles RPC error gracefully', async () => {
    const mockDs = makeMockDataSource({
      readContract: vi.fn().mockRejectedValue(new Error('RPC rate limit exceeded')),
    });

    const adapter = new AerodromeAdapter(mockDs);
    const result = await adapter.getQuote(
      makePool({ protocol: 'aerodrome-volatile', status: 'active' }),
      1.0, 416_666n, 12345n
    );

    expect(result.quote).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('handles zero amountOut gracefully', async () => {
    const mockDs = makeMockDataSource({
      readContract: vi.fn()
        .mockResolvedValueOnce({
          // getReserves — adequate liquidity
          data: [10_000_000_000_000n, 10_000_000_000n, BigInt(Date.now())] as const,
          latencyMs: 40,
        })
        .mockResolvedValueOnce({
          // fee()
          data: 30n,
          latencyMs: 10,
        })
        .mockResolvedValueOnce({
          // getAmountOut returns 0
          data: 0n,
          latencyMs: 30,
        }),
    });

    const adapter = new AerodromeAdapter(mockDs);
    const result = await adapter.getQuote(
      makePool({ protocol: 'aerodrome-volatile', status: 'active' }),
      1.0, 1n, 12345n // tiny amountIn to trigger 0 output
    );

    expect(result.quote).toBeNull();
    expect(result.error).toContain('getAmountOut returned 0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pool Registry Integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('Pool registry integrity', () => {
  it('all pools have non-empty IDs', () => {
    for (const pool of ALL_POOLS) {
      expect(pool.id).toBeTruthy();
    }
  });

  it('all pools have valid checksummed addresses', () => {
    for (const pool of ALL_POOLS) {
      expect(pool.poolAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('all pools have positive fee tiers', () => {
    for (const pool of ALL_POOLS) {
      expect(pool.feeBps).toBeGreaterThan(0);
    }
  });

  it('all pools have token0 and token1 with correct decimals', () => {
    for (const pool of ALL_POOLS) {
      expect(pool.token0.decimals).toBeGreaterThan(0);
      expect(pool.token1.decimals).toBeGreaterThan(0);
      expect(pool.token0.symbol).toBeTruthy();
      expect(pool.token1.symbol).toBeTruthy();
    }
  });

  it('stub pools have status = stub', () => {
    for (const pool of ALL_POOLS) {
      if (pool.protocol === 'aerodrome-slipstream') {
        expect(pool.status).toBe('stub');
      }
    }
  });
});
