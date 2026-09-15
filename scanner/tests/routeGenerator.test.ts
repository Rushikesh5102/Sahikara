/**
 * SAHIKARA — Route Generator Tests
 *
 * Tests for:
 *   - Route generation from multi-pair universe and multi-DEX registry
 *   - Bidirectional route generation (Forward: Pool A -> Pool B; Reverse: Pool B -> Pool A)
 *   - Skipping disabled research pairs
 *   - Skipping unsupported/stub pools (e.g., Aerodrome Slipstream)
 *   - No self-loops (cannot route leg1 and leg2 through the same pool)
 *   - Boundedness: respects maxRoutesPerPair configuration
 */

import { describe, it, expect } from 'vitest';
import { RouteGenerator } from '../src/discovery/RouteGenerator.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import type { ResearchPair } from '../src/config/pairs.js';
import type { IPoolAdapter } from '../src/adapters/IPoolAdapter.js';

function makeToken(symbol: string, decimals: number, address: string): TokenDefinition {
  return {
    symbol,
    decimals,
    address: address as `0x${string}`,
    addressTier: '[FACT]',
  };
}

function makePool(
  id: string,
  dex: string,
  protocol: PoolDefinition['protocol'],
  poolAddress: string,
  token0: TokenDefinition,
  token1: TokenDefinition,
  feeBps: number,
  status: 'active' | 'stub' = 'active'
): PoolDefinition {
  return {
    id,
    chain: 'base',
    dex,
    protocol,
    poolAddress: poolAddress as `0x${string}`,
    token0,
    token1,
    feeBps,
    status,
    note: 'Test pool',
    tier: '[FACT]',
  };
}

describe('RouteGenerator', () => {
  const weth = makeToken('WETH', 18, '0x4200000000000000000000000000000000000006');
  const usdc = makeToken('USDC', 6, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  const degen = makeToken('DEGEN', 18, '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed');

  const pairWethUsdc: ResearchPair = {
    id: 'base-weth-usdc',
    chainId: 8453,
    symbol: 'WETH/USDC',
    baseToken: weth,
    quoteToken: usdc,
    enabled: true,
    researchStatus: 'BASELINE_ACTIVE',
    notes: 'WETH/USDC baseline',
    sourceReference: 'docs',
  };

  const pairDegenWeth: ResearchPair = {
    id: 'base-degen-weth',
    chainId: 8453,
    symbol: 'DEGEN/WETH',
    baseToken: degen,
    quoteToken: weth,
    enabled: true,
    researchStatus: 'RESEARCH_CANDIDATE',
    notes: 'DEGEN/WETH candidate',
    sourceReference: 'docs',
  };

  const poolUniWethUsdc500 = makePool(
    'uni-weth-usdc-500',
    'Uniswap v3',
    'uniswap-v3',
    '0xd0b53D9277642d899DF5C87A3966A349A798F224',
    weth,
    usdc,
    5
  );

  const poolAeroWethUsdcVolatile = makePool(
    'aero-weth-usdc-volatile',
    'Aerodrome',
    'aerodrome-volatile',
    '0xcDAC0d6c6C59727a65F871236188350531885C43',
    weth,
    usdc,
    30
  );

  const poolCakeWethUsdc500 = makePool(
    'cake-weth-usdc-500',
    'PancakeSwap v3',
    'pancakeswap-v3',
    '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18',
    weth,
    usdc,
    5
  );

  const poolAeroSlipstreamStub = makePool(
    'aero-weth-usdc-slipstream',
    'Aerodrome',
    'aerodrome-slipstream',
    '0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59',
    weth,
    usdc,
    5,
    'stub'
  );

  const mockActiveAdapter: IPoolAdapter = {
    protocol: 'mock',
    supports: (pool) => pool.status === 'active',
    getQuote: async (pool, _usd, _amt, blockNumber) => ({
      pool,
      blockNumber,
      timestamp: 0,
      rawQuoteJson: '',
      quote: null,
      error: null,
      rpcLatencyMs: 0,
    }),
  };

  const mockStubAdapter: IPoolAdapter = {
    protocol: 'aerodrome-slipstream',
    supports: () => false, // Refuses stub pool
    getQuote: async (pool, _usd, _amt, blockNumber) => ({
      pool,
      blockNumber,
      timestamp: 0,
      rawQuoteJson: '',
      quote: null,
      error: 'STUB',
      rpcLatencyMs: 0,
    }),
  };

  const adapters = new Map<string, IPoolAdapter>([
    ['uniswap-v3', mockActiveAdapter],
    ['aerodrome-volatile', mockActiveAdapter],
    ['pancakeswap-v3', mockActiveAdapter],
    ['aerodrome-slipstream', mockStubAdapter],
  ]);

  it('generates forward and reverse routes across distinct DEX pools for a pair', () => {
    const generator = new RouteGenerator({ maxRoutesPerPair: 10 });
    const routes = generator.generateRoutes(
      [pairWethUsdc],
      [poolUniWethUsdc500, poolAeroWethUsdcVolatile],
      adapters
    );

    // Should produce exactly 2 routes (Uni -> Aero, Aero -> Uni)
    expect(routes.length).toBe(2);

    const forward = routes.find((r) => r.leg1.pool.id === 'uni-weth-usdc-500');
    expect(forward).toBeDefined();
    expect(forward?.leg2.pool.id).toBe('aero-weth-usdc-volatile');
    expect(forward?.leg1.tokenIn.symbol).toBe('WETH');
    expect(forward?.leg1.tokenOut.symbol).toBe('USDC');
    expect(forward?.leg2.tokenIn.symbol).toBe('USDC');
    expect(forward?.leg2.tokenOut.symbol).toBe('WETH');

    const reverse = routes.find((r) => r.leg1.pool.id === 'aero-weth-usdc-volatile');
    expect(reverse).toBeDefined();
    expect(reverse?.leg2.pool.id).toBe('uni-weth-usdc-500');
  });

  it('generates routes across 3 pools without duplicating or self-looping', () => {
    const generator = new RouteGenerator({ maxRoutesPerPair: 10 });
    const routes = generator.generateRoutes(
      [pairWethUsdc],
      [poolUniWethUsdc500, poolAeroWethUsdcVolatile, poolCakeWethUsdc500],
      adapters
    );

    // 3 pools -> 3 pairs * 2 directions = 6 routes
    expect(routes.length).toBe(6);

    // Ensure no route has same pool for leg1 and leg2
    for (const r of routes) {
      expect(r.leg1.pool.poolAddress.toLowerCase()).not.toBe(
        r.leg2.pool.poolAddress.toLowerCase()
      );
    }
  });

  it('ignores pools marked stub or unsupported by adapter', () => {
    const generator = new RouteGenerator({ maxRoutesPerPair: 10 });
    const routes = generator.generateRoutes(
      [pairWethUsdc],
      [poolUniWethUsdc500, poolAeroSlipstreamStub],
      adapters
    );

    // Only 1 eligible pool -> cannot form a route
    expect(routes.length).toBe(0);
  });

  it('skips disabled pairs', () => {
    const disabledPair: ResearchPair = { ...pairWethUsdc, enabled: false };
    const generator = new RouteGenerator({ maxRoutesPerPair: 10 });
    const routes = generator.generateRoutes(
      [disabledPair],
      [poolUniWethUsdc500, poolAeroWethUsdcVolatile],
      adapters
    );

    expect(routes.length).toBe(0);
  });

  it('enforces maxRoutesPerPair limit strictly', () => {
    const generator = new RouteGenerator({ maxRoutesPerPair: 2 });
    const routes = generator.generateRoutes(
      [pairWethUsdc],
      [poolUniWethUsdc500, poolAeroWethUsdcVolatile, poolCakeWethUsdc500],
      adapters
    );

    expect(routes.length).toBe(2);
  });

  it('handles multiple active pairs independently without cross-pair token contamination', () => {
    const poolUniDegenWeth = makePool(
      'uni-degen-weth-3000',
      'Uniswap v3',
      'uniswap-v3',
      '0x3333333333333333333333333333333333333333',
      degen,
      weth,
      30
    );
    const poolAeroDegenWeth = makePool(
      'aero-degen-weth-volatile',
      'Aerodrome',
      'aerodrome-volatile',
      '0x4444444444444444444444444444444444444444',
      degen,
      weth,
      30
    );

    const generator = new RouteGenerator({ maxRoutesPerPair: 10 });
    const routes = generator.generateRoutes(
      [pairWethUsdc, pairDegenWeth],
      [poolUniWethUsdc500, poolAeroWethUsdcVolatile, poolUniDegenWeth, poolAeroDegenWeth],
      adapters
    );

    // 2 routes for WETH/USDC + 2 routes for DEGEN/WETH = 4 routes
    expect(routes.length).toBe(4);
    const wethUsdcRoutes = routes.filter((r) => r.id.startsWith('base-weth-usdc'));
    const degenWethRoutes = routes.filter((r) => r.id.startsWith('base-degen-weth'));
    expect(wethUsdcRoutes.length).toBe(2);
    expect(degenWethRoutes.length).toBe(2);
  });
});
