/**
 * SAHIKARA — Phase 4.7 Dynamic Pool Discovery Engine
 *
 * Dynamically queries supported DEX factories across fee tiers and token pairs,
 * verifies on-chain bytecode, inspects state (slot0, liquidity), and classifies
 * pools before admission to the routing graph.
 *
 * STRICT PROVENANCE:
 * Every discovered pool records discovery source, factory, block number,
 * bytecode verification status, and timestamp.
 */

import { type PublicClient, parseAbi, isAddressEqual, getAddress } from 'viem';
import type { TokenDefinition, PoolDefinition, SupportedChain, DexProtocol, PoolStatus } from '../config/pools.js';

export type DiscoveredPoolClassification =
  | 'ACTIVE'
  | 'LOW_LIQUIDITY'
  | 'EXHAUSTED'
  | 'INVALID'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface DiscoveredPoolMetadata {
  id: string;
  chain: SupportedChain;
  chainId: number;
  dex: string;
  protocol: DexProtocol;
  factoryAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  token0: TokenDefinition;
  token1: TokenDefinition;
  feeBps: number;
  tickSpacing?: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  bytecodeLength: number;
  bytecodeVerified: boolean;
  classification: DiscoveredPoolClassification;
  discoveryBlock: bigint;
  discoveryTimestampMs: number;
  discoverySource: string;
}

const UNISWAP_V3_FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
]);

const UNISWAP_V3_POOL_STATE_ABI = parseAbi([
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function liquidity() external view returns (uint128)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function tickSpacing() external view returns (int24)',
]);

export interface PoolDiscoveryParams {
  chain: SupportedChain;
  chainId: number;
  dex: string;
  protocol: DexProtocol;
  factoryAddress: `0x${string}`;
  tokens: TokenDefinition[];
  feeTiers: number[]; // e.g. [100, 500, 3000, 10000] (in hundredths of a pip, or bps * 100)
  minLiquidityWei?: bigint;
}

export class DynamicPoolDiscovery {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: PublicClient<any, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: PublicClient<any, any>) {
    this.client = client;
  }

  /**
   * Discovers candidate pools by querying the factory for all token pair and fee tier combinations.
   */
  public async discoverPools(params: PoolDiscoveryParams): Promise<DiscoveredPoolMetadata[]> {
    const { chain, chainId, dex, protocol, factoryAddress, tokens, feeTiers, minLiquidityWei = 1000n } = params;
    const discovered: DiscoveredPoolMetadata[] = [];
    const currentBlock = await this.client.getBlockNumber();
    const timestampMs = Date.now();

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const tokenA = tokens[i]!;
        const tokenB = tokens[j]!;

        for (const fee of feeTiers) {
          try {
            // 1. Query Factory for pool address
            const poolAddress = (await this.client.readContract({
              address: factoryAddress,
              abi: UNISWAP_V3_FACTORY_ABI,
              functionName: 'getPool',
              args: [tokenA.address, tokenB.address, fee],
            })) as `0x${string}`;

            // Check if pool exists (non-zero address)
            if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
              continue;
            }

            const cleanPoolAddress = getAddress(poolAddress);

            // 2. Verify bytecode via eth_getCode
            const bytecode = await this.client.getBytecode({ address: cleanPoolAddress });
            const bytecodeLength = bytecode ? (bytecode.length - 2) / 2 : 0;
            const bytecodeVerified = bytecodeLength >= 4;

            if (!bytecodeVerified) {
              discovered.push({
                id: `${dex.toLowerCase()}-${chain}-${tokenA.symbol.toLowerCase()}-${tokenB.symbol.toLowerCase()}-${Math.round(fee / 100)}`,
                chain,
                chainId,
                dex,
                protocol,
                factoryAddress,
                poolAddress: cleanPoolAddress,
                token0: tokenA,
                token1: tokenB,
                feeBps: Math.round(fee / 100),
                liquidity: 0n,
                sqrtPriceX96: 0n,
                tick: 0,
                bytecodeLength,
                bytecodeVerified: false,
                classification: 'INVALID',
                discoveryBlock: currentBlock,
                discoveryTimestampMs: timestampMs,
                discoverySource: `factory:${factoryAddress}`,
              });
              continue;
            }

            // 3. Inspect Pool State
            const [t0Address, , poolFee, poolLiquidity, slot0Data] = await Promise.all([
              this.client.readContract({
                address: cleanPoolAddress,
                abi: UNISWAP_V3_POOL_STATE_ABI,
                functionName: 'token0',
              }),
              this.client.readContract({
                address: cleanPoolAddress,
                abi: UNISWAP_V3_POOL_STATE_ABI,
                functionName: 'token1',
              }),
              this.client.readContract({
                address: cleanPoolAddress,
                abi: UNISWAP_V3_POOL_STATE_ABI,
                functionName: 'fee',
              }),
              this.client.readContract({
                address: cleanPoolAddress,
                abi: UNISWAP_V3_POOL_STATE_ABI,
                functionName: 'liquidity',
              }),
              this.client.readContract({
                address: cleanPoolAddress,
                abi: UNISWAP_V3_POOL_STATE_ABI,
                functionName: 'slot0',
              }),
            ]);

            const slot0Tuple = slot0Data as unknown as [bigint, number, ...unknown[]];

            // Determine canonical token0 and token1 matching discovered pool ordering
            let token0Def: TokenDefinition;
            let token1Def: TokenDefinition;

            if (isAddressEqual(t0Address as `0x${string}`, tokenA.address)) {
              token0Def = tokenA;
              token1Def = tokenB;
            } else if (isAddressEqual(t0Address as `0x${string}`, tokenB.address)) {
              token0Def = tokenB;
              token1Def = tokenA;
            } else {
              // Token mismatch error!
              discovered.push({
                id: `${dex.toLowerCase()}-${chain}-mismatch-${cleanPoolAddress.slice(0, 8)}`,
                chain,
                chainId,
                dex,
                protocol,
                factoryAddress,
                poolAddress: cleanPoolAddress,
                token0: tokenA,
                token1: tokenB,
                feeBps: Math.round(fee / 100),
                liquidity: poolLiquidity as bigint,
                sqrtPriceX96: slot0Tuple[0],
                tick: slot0Tuple[1],
                bytecodeLength,
                bytecodeVerified: true,
                classification: 'INVALID',
                discoveryBlock: currentBlock,
                discoveryTimestampMs: timestampMs,
                discoverySource: `factory:${factoryAddress}`,
              });
              continue;
            }

            const feeBps = Math.round(Number(poolFee) / 100);
            const liquidity = poolLiquidity as bigint;
            const [sqrtPriceX96, tick] = slot0Tuple;

            let classification: DiscoveredPoolClassification = 'ACTIVE';
            if (liquidity === 0n) {
              classification = 'EXHAUSTED';
            } else if (liquidity < minLiquidityWei) {
              classification = 'LOW_LIQUIDITY';
            }

            const poolId = `${dex.toLowerCase()}-${chain}-${token0Def.symbol.toLowerCase()}-${token1Def.symbol.toLowerCase()}-${feeBps}`;

            discovered.push({
              id: poolId,
              chain,
              chainId,
              dex,
              protocol,
              factoryAddress,
              poolAddress: cleanPoolAddress,
              token0: token0Def,
              token1: token1Def,
              feeBps,
              liquidity,
              sqrtPriceX96,
              tick,
              bytecodeLength,
              bytecodeVerified: true,
              classification,
              discoveryBlock: currentBlock,
              discoveryTimestampMs: timestampMs,
              discoverySource: `factory:${factoryAddress}`,
            });
          } catch (err) {
            // Failed to query or inspect this combination, continue
            console.error(`[Discovery Error ${chain} ${tokenA.symbol}-${tokenB.symbol} ${fee}]:`, (err as Error).message);
            continue;
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Converts verified discovered pools into canonical PoolDefinition objects.
   */
  public static toPoolDefinitions(discovered: DiscoveredPoolMetadata[]): PoolDefinition[] {
    return discovered
      .filter((p) => p.classification === 'ACTIVE' && p.bytecodeVerified)
      .map((p) => ({
        id: p.id,
        chain: p.chain,
        chainId: p.chainId,
        dex: p.dex,
        protocol: p.protocol,
        poolAddress: p.poolAddress,
        token0: p.token0,
        token1: p.token1,
        feeBps: p.feeBps,
        status: 'active' as PoolStatus,
        note: `Discovered via ${p.discoverySource} at block ${p.discoveryBlock}. Liquidity: ${p.liquidity.toString()}`,
        tier: '[FACT]' as const,
      }));
  }
}
