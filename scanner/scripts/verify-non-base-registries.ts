/**
 * SAHIKARA — Phase 4.6.0 Pre-Campaign On-Chain Registry Verification
 *
 * Verifies every configured non-Base token, pool, factory, and quoter on:
 *   - Polygon (137)
 *   - Arbitrum One (42161)
 *   - Optimism (10)
 *
 * READ-ONLY INTERACTION ONLY:
 *   - eth_getCode
 *   - eth_call (ERC20 symbol/decimals, Uniswap v3 token0/token1/fee/factory/liquidity/slot0)
 *   - QuoterV2 quoteExactInputSingle
 *   - Zero private keys, zero signing, zero broadcasting
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { createPublicClient, http, parseAbi, formatUnits, parseUnits } from 'viem';
import { polygon, arbitrum, optimism } from 'viem/chains';

import { POLYGON_TOKENS, ALL_POLYGON_POOLS, POLYGON_UNISWAP_V3_FACTORY, POLYGON_UNISWAP_V3_QUOTER_V2 } from '../src/config/pools-polygon.js';
import { ARBITRUM_TOKENS, ALL_ARBITRUM_POOLS, ARBITRUM_UNISWAP_V3_FACTORY, ARBITRUM_UNISWAP_V3_QUOTER_V2 } from '../src/config/pools-arbitrum.js';
import { OPTIMISM_TOKENS, ALL_OPTIMISM_POOLS, OPTIMISM_UNISWAP_V3_FACTORY, OPTIMISM_UNISWAP_V3_QUOTER_V2 } from '../src/config/pools-optimism.js';
import type { TokenDefinition, PoolDefinition } from '../src/config/pools.js';

// ERC20 ABI for symbol and decimals
const ERC20_ABI = parseAbi([
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
]);

// Uniswap v3 Pool ABI
const UNIV3_POOL_ABI = parseAbi([
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function factory() external view returns (address)',
  'function liquidity() external view returns (uint128)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

// Uniswap v3 Factory ABI
const UNIV3_FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
]);

// Uniswap v3 QuoterV2 ABI
const UNIV3_QUOTER_V2_ABI = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

interface VerificationResult {
  tokens: Array<{
    chain: string;
    symbol: string;
    address: string;
    expectedDecimals: number;
    observedSymbol: string;
    observedDecimals: number | null;
    bytecodeBytes: number;
    status: 'PASS' | 'FAIL';
    error?: string;
  }>;
  factories: Array<{
    chain: string;
    name: string;
    address: string;
    bytecodeBytes: number;
    status: 'PASS' | 'FAIL';
  }>;
  quoters: Array<{
    chain: string;
    name: string;
    address: string;
    bytecodeBytes: number;
    status: 'PASS' | 'FAIL';
  }>;
  pools: Array<{
    chain: string;
    poolId: string;
    poolAddress: string;
    venue: string;
    expectedToken0: string;
    expectedToken1: string;
    expectedFeeBps: number;
    observedToken0: string;
    observedToken1: string;
    observedFeeBps: number;
    observedTickSpacing: number;
    observedFactory: string;
    factoryMatches: boolean;
    currentLiquidity: string;
    sqrtPriceX96: string;
    currentTick: number;
    bytecodeBytes: number;
    status: 'PASS' | 'FAIL' | 'INSUFFICIENT_LIQUIDITY';
    error?: string;
  }>;
  smokeQuotes: Array<{
    chain: string;
    poolId: string;
    direction: string;
    tokenInSymbol: string;
    tokenOutSymbol: string;
    amountIn: string;
    amountOut: string;
    blockNumber: string;
    latencyMs: number;
    status: 'SUCCESS' | 'QUOTE_FAILED';
    error?: string;
  }>;
}

const RPC_ENDPOINTS = {
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
};

async function verifyTokens(
  chainName: string,
  client: any,
  tokens: Record<string, TokenDefinition>
) {
  const results = [];
  for (const [, token] of Object.entries(tokens)) {
    try {
      const code = await client.getBytecode({ address: token.address });
      const bytecodeBytes = code ? (code.length - 2) / 2 : 0;
      if (bytecodeBytes < 4) {
        results.push({
          chain: chainName,
          symbol: token.symbol,
          address: token.address,
          expectedDecimals: token.decimals,
          observedSymbol: 'NONE',
          observedDecimals: null,
          bytecodeBytes,
          status: 'FAIL' as const,
          error: 'No contract bytecode found',
        });
        continue;
      }

      const symbol = await client.readContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => token.symbol); // Some old tokens or proxies return bytes32 or throw

      const decimals = await client.readContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

      const pass = decimals === token.decimals && bytecodeBytes >= 4;
      results.push({
        chain: chainName,
        symbol: token.symbol,
        address: token.address,
        expectedDecimals: token.decimals,
        observedSymbol: symbol,
        observedDecimals: Number(decimals),
        bytecodeBytes,
        status: pass ? ('PASS' as const) : ('FAIL' as const),
      });
    } catch (err: any) {
      results.push({
        chain: chainName,
        symbol: token.symbol,
        address: token.address,
        expectedDecimals: token.decimals,
        observedSymbol: 'ERROR',
        observedDecimals: null,
        bytecodeBytes: 0,
        status: 'FAIL' as const,
        error: err.message,
      });
    }
  }
  return results;
}

async function verifyPools(
  chainName: string,
  client: any,
  pools: PoolDefinition[],
  factoryAddress: `0x${string}`
) {
  const results = [];
  for (const pool of pools) {
    try {
      const code = await client.getBytecode({ address: pool.poolAddress });
      const bytecodeBytes = code ? (code.length - 2) / 2 : 0;
      if (bytecodeBytes < 4) {
        results.push({
          chain: chainName,
          poolId: pool.id,
          poolAddress: pool.poolAddress,
          venue: pool.dex,
          expectedToken0: pool.token0.address,
          expectedToken1: pool.token1.address,
          expectedFeeBps: pool.feeBps,
          observedToken0: 'NONE',
          observedToken1: 'NONE',
          observedFeeBps: 0,
          observedTickSpacing: 0,
          observedFactory: 'NONE',
          factoryMatches: false,
          currentLiquidity: '0',
          sqrtPriceX96: '0',
          currentTick: 0,
          bytecodeBytes,
          status: 'FAIL' as const,
          error: 'No contract bytecode at pool address',
        });
        continue;
      }

      const [token0, token1, fee, tickSpacing, factory, liquidity, slot0] = await Promise.all([
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'token0' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'token1' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'fee' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'tickSpacing' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'factory' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'liquidity' }),
        client.readContract({ address: pool.poolAddress, abi: UNIV3_POOL_ABI, functionName: 'slot0' }),
      ]);

      const feeBps = Number(fee) / 100; // e.g. 500 fee = 5 bps
      const factoryMatches = factory.toLowerCase() === factoryAddress.toLowerCase();
      const token0Matches = token0.toLowerCase() === pool.token0.address.toLowerCase();
      const token1Matches = token1.toLowerCase() === pool.token1.address.toLowerCase();
      const feeMatches = feeBps === pool.feeBps;

      // Verify factory reverse lookup
      const factoryPool = await client.readContract({
        address: factoryAddress,
        abi: UNIV3_FACTORY_ABI,
        functionName: 'getPool',
        args: [token0, token1, fee],
      });
      const factoryPoolMatches = factoryPool.toLowerCase() === pool.poolAddress.toLowerCase();

      let status: 'PASS' | 'FAIL' | 'INSUFFICIENT_LIQUIDITY' = 'PASS';
      let errorDesc: string | undefined;

      if (!token0Matches || !token1Matches || !feeMatches || !factoryMatches || !factoryPoolMatches) {
        status = 'FAIL';
        errorDesc = `Mismatch: token0=${token0Matches}, token1=${token1Matches}, fee=${feeMatches}, factory=${factoryMatches}, factoryPoolMatch=${factoryPoolMatches}`;
      } else if (BigInt(liquidity) === 0n) {
        status = 'INSUFFICIENT_LIQUIDITY';
        errorDesc = 'Current in-range liquidity is 0';
      }

      results.push({
        chain: chainName,
        poolId: pool.id,
        poolAddress: pool.poolAddress,
        venue: pool.dex,
        expectedToken0: pool.token0.address,
        expectedToken1: pool.token1.address,
        expectedFeeBps: pool.feeBps,
        observedToken0: token0,
        observedToken1: token1,
        observedFeeBps: feeBps,
        observedTickSpacing: Number(tickSpacing),
        observedFactory: factory,
        factoryMatches,
        currentLiquidity: liquidity.toString(),
        sqrtPriceX96: slot0[0].toString(),
        currentTick: slot0[1],
        bytecodeBytes,
        status,
        error: errorDesc,
      });
    } catch (err: any) {
      results.push({
        chain: chainName,
        poolId: pool.id,
        poolAddress: pool.poolAddress,
        venue: pool.dex,
        expectedToken0: pool.token0.address,
        expectedToken1: pool.token1.address,
        expectedFeeBps: pool.feeBps,
        observedToken0: 'ERROR',
        observedToken1: 'ERROR',
        observedFeeBps: 0,
        observedTickSpacing: 0,
        observedFactory: 'ERROR',
        factoryMatches: false,
        currentLiquidity: '0',
        sqrtPriceX96: '0',
        currentTick: 0,
        bytecodeBytes: 0,
        status: 'FAIL' as const,
        error: err.message,
      });
    }
  }
  return results;
}

async function performSmokeQuotes(
  chainName: string,
  client: any,
  pools: PoolDefinition[],
  quoterAddress: `0x${string}`
) {
  const results = [];
  const blockNumber = await client.getBlockNumber();

  for (const pool of pools.filter((p) => p.status === 'active')) {
    const feeUnits = pool.feeBps * 100; // e.g. 5 bps -> 500

    // Determine small test amount for token0 and token1
    // e.g. If decimals = 18, use 0.001 (~$2.50 for ETH or ~$0.0008 for MATIC)
    // If decimals = 6, use 1.0 ($1.00 for USDC/USDT)
    // If decimals = 8, use 0.0001 (~$6.00 for WBTC)
    const getSmallAmount = (decimals: number) => {
      if (decimals === 18) return parseUnits('0.001', 18);
      if (decimals === 6) return parseUnits('1', 6);
      if (decimals === 8) return parseUnits('0.0001', 8);
      return parseUnits('1', decimals);
    };

    const directions = [
      {
        name: 'token0 -> token1',
        tokenIn: pool.token0,
        tokenOut: pool.token1,
        amountIn: getSmallAmount(pool.token0.decimals),
      },
      {
        name: 'token1 -> token0',
        tokenIn: pool.token1,
        tokenOut: pool.token0,
        amountIn: getSmallAmount(pool.token1.decimals),
      },
    ];

    for (const dir of directions) {
      const t0 = performance.now();
      try {
        const { result } = await client.simulateContract({
          address: quoterAddress,
          abi: UNIV3_QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: dir.tokenIn.address,
              tokenOut: dir.tokenOut.address,
              amountIn: dir.amountIn,
              fee: feeUnits,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
        const latencyMs = performance.now() - t0;
        const amountOut = result[0];

        results.push({
          chain: chainName,
          poolId: pool.id,
          direction: dir.name,
          tokenInSymbol: dir.tokenIn.symbol,
          tokenOutSymbol: dir.tokenOut.symbol,
          amountIn: formatUnits(dir.amountIn, dir.tokenIn.decimals),
          amountOut: formatUnits(amountOut, dir.tokenOut.decimals),
          blockNumber: blockNumber.toString(),
          latencyMs: Math.round(latencyMs),
          status: 'SUCCESS' as const,
        });
      } catch (err: any) {
        const latencyMs = performance.now() - t0;
        results.push({
          chain: chainName,
          poolId: pool.id,
          direction: dir.name,
          tokenInSymbol: dir.tokenIn.symbol,
          tokenOutSymbol: dir.tokenOut.symbol,
          amountIn: formatUnits(dir.amountIn, dir.tokenIn.decimals),
          amountOut: '0',
          blockNumber: blockNumber.toString(),
          latencyMs: Math.round(latencyMs),
          status: 'QUOTE_FAILED' as const,
          error: err.shortMessage || err.message,
        });
      }
    }
  }
  return results;
}

async function verifyInfra(chainName: string, client: any, factory: `0x${string}`, quoter: `0x${string}`) {
  const factoryCode = await client.getBytecode({ address: factory });
  const quoterCode = await client.getBytecode({ address: quoter });

  const factoryBytes = factoryCode ? (factoryCode.length - 2) / 2 : 0;
  const quoterBytes = quoterCode ? (quoterCode.length - 2) / 2 : 0;

  return {
    factory: {
      chain: chainName,
      name: 'Uniswap v3 Factory',
      address: factory,
      bytecodeBytes: factoryBytes,
      status: factoryBytes >= 4 ? ('PASS' as const) : ('FAIL' as const),
    },
    quoter: {
      chain: chainName,
      name: 'Uniswap v3 QuoterV2',
      address: quoter,
      bytecodeBytes: quoterBytes,
      status: quoterBytes >= 4 ? ('PASS' as const) : ('FAIL' as const),
    },
  };
}

async function main() {
  console.log('═'.repeat(78));
  console.log(' SAHIKARA PHASE 4.6.0: ON-CHAIN REGISTRY VERIFICATION');
  console.log('═'.repeat(78));

  const chains = [
    {
      name: 'Polygon',
      chainId: 137,
      client: createPublicClient({ chain: polygon, transport: http(RPC_ENDPOINTS.polygon, { timeout: 10000 }) }),
      tokens: POLYGON_TOKENS,
      pools: ALL_POLYGON_POOLS,
      factory: POLYGON_UNISWAP_V3_FACTORY,
      quoter: POLYGON_UNISWAP_V3_QUOTER_V2,
    },
    {
      name: 'Arbitrum',
      chainId: 42161,
      client: createPublicClient({ chain: arbitrum, transport: http(RPC_ENDPOINTS.arbitrum, { timeout: 10000 }) }),
      tokens: ARBITRUM_TOKENS,
      pools: ALL_ARBITRUM_POOLS,
      factory: ARBITRUM_UNISWAP_V3_FACTORY,
      quoter: ARBITRUM_UNISWAP_V3_QUOTER_V2,
    },
    {
      name: 'Optimism',
      chainId: 10,
      client: createPublicClient({ chain: optimism, transport: http(RPC_ENDPOINTS.optimism, { timeout: 10000 }) }),
      tokens: OPTIMISM_TOKENS,
      pools: ALL_OPTIMISM_POOLS,
      factory: OPTIMISM_UNISWAP_V3_FACTORY,
      quoter: OPTIMISM_UNISWAP_V3_QUOTER_V2,
    },
  ];

  const fullReport: VerificationResult = {
    tokens: [],
    factories: [],
    quoters: [],
    pools: [],
    smokeQuotes: [],
  };

  for (const c of chains) {
    console.log(`\n[${c.name.toUpperCase()}] Verifying on chain ID ${c.chainId}...`);

    // 1. Verify infrastructure
    const infra = await verifyInfra(c.name, c.client, c.factory, c.quoter);
    fullReport.factories.push(infra.factory);
    fullReport.quoters.push(infra.quoter);
    console.log(`  Factory: ${infra.factory.status} (${infra.factory.bytecodeBytes} bytes)`);
    console.log(`  Quoter:  ${infra.quoter.status} (${infra.quoter.bytecodeBytes} bytes)`);

    // 2. Verify tokens
    const tokenResults = await verifyTokens(c.name, c.client, c.tokens);
    fullReport.tokens.push(...tokenResults);
    const passedTokens = tokenResults.filter(t => t.status === 'PASS').length;
    console.log(`  Tokens:  ${passedTokens}/${tokenResults.length} passed`);

    // 3. Verify pools
    const poolResults = await verifyPools(c.name, c.client, c.pools, c.factory);
    fullReport.pools.push(...poolResults);
    const passedPools = poolResults.filter(p => p.status === 'PASS').length;
    console.log(`  Pools:   ${passedPools}/${poolResults.length} passed`);

    // 4. Smoke quotes
    console.log(`  Executing Smoke Quotes...`);
    const quoteResults = await performSmokeQuotes(c.name, c.client, c.pools, c.quoter);
    fullReport.smokeQuotes.push(...quoteResults);
    const successQuotes = quoteResults.filter(q => q.status === 'SUCCESS').length;
    console.log(`  Quotes:  ${successQuotes}/${quoteResults.length} succeeded`);
  }

  console.log('\n' + '═'.repeat(78));
  console.log(' VERIFICATION RUN COMPLETE');
  console.log('═'.repeat(78));

  const jsonStr = JSON.stringify(fullReport, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
  writeFileSync(resolve('data/verification_report.json'), jsonStr, 'utf8');
  console.log('Saved report to data/verification_report.json');

  // Print full JSON output to stdout for programmatic parsing and report generation
  console.log('\n<<<VERIFICATION_JSON_START>>>');
  console.log(jsonStr);
  console.log('<<<VERIFICATION_JSON_END>>>');
}

main().catch(err => {
  console.error('Fatal error during on-chain verification:', err);
  process.exit(1);
});
