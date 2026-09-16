/**
 * SAHIKARA — Phase 4.10 Graph-Based Route Discovery Engine
 *
 * Constructs a directed multigraph from verified on-chain pools across DEX protocols
 * (Uniswap v3, Aerodrome, Curve, Balancer v2, Camelot, Velodrome, QuickSwap, SushiSwap)
 * and extracts:
 * 1. Two-leg cross-pool / cross-venue cycles (A -> B -> A)
 * 2. Three-leg triangular cycles (A -> B -> C -> A)
 * 3. Stablecoin basis cross-DEX cycles
 *
 * CANONICAL DEDUPLICATION & SAFETY DIRECTIVES:
 * - Chain Isolation: Every leg of a route MUST have matching numeric chainId.
 * - Rotational Invariance: Normalizes 2-hop cycles to start at min(tokenA, tokenB)
 *   while preserving pool traversal direction (P1->P2 vs P2->P1).
 * - Pool Uniqueness: No route may traverse the same pool address twice.
 * - Token Uniqueness: Intermediary tokens in 3-hop routes must be distinct.
 * - Quality Tier Awareness: Excludes REJECTED pools and filters by minQualityTier.
 */

import type { PoolDefinition, TokenDefinition, PoolQualityTier } from '../config/pools.js';
import type { IPoolAdapter } from '../adapters/IPoolAdapter.js';
import type { RoundTripRouteDef, RoundTripLegDef } from '../economics/roundTripEvaluator.js';

export interface GraphEdge {
  pool: PoolDefinition;
  adapter: IPoolAdapter;
  tokenIn: TokenDefinition;
  tokenOut: TokenDefinition;
}

export interface GraphRouteGeneratorOptions {
  max2HopRoutes?: number;
  maxTriangularRoutes?: number;
  max4HopRoutes?: number;
  filterZeroLiquidity?: boolean;
  minQualityTier?: PoolQualityTier;
}

export class GraphRouteGenerator {
  private readonly max2Hop: number;
  private readonly maxTri: number;
  public readonly _max4Hop: number;
  public readonly _filterZeroLiquidity: boolean;
  private readonly minQualityTier: PoolQualityTier;

  constructor(options: GraphRouteGeneratorOptions = {}) {
    this.max2Hop = options.max2HopRoutes ?? 250;
    this.maxTri = options.maxTriangularRoutes ?? 250;
    this._max4Hop = options.max4HopRoutes ?? 50;
    this._filterZeroLiquidity = options.filterZeroLiquidity ?? true;
    this.minQualityTier = options.minQualityTier ?? 'TIER_1';
  }

  /**
   * Checks whether a pool satisfies the minimum quality tier requirement.
   */
  private satisfiesQualityTier(pool: PoolDefinition): boolean {
    if (pool.qualityTier === 'REJECTED') return false;
    if (this.minQualityTier === 'TIER_0') {
      return pool.qualityTier === 'TIER_0' || pool.tier === '[FACT]';
    }
    if (this.minQualityTier === 'TIER_1') {
      return (
        pool.qualityTier === 'TIER_0' ||
        pool.qualityTier === 'TIER_1' ||
        pool.tier === '[FACT]' ||
        pool.qualityTier === undefined
      );
    }
    return true;
  }

  /**
   * Builds an adjacency list representation of the pool graph.
   * Maps token address (lowercase) -> outgoing edges.
   */
  public buildAdjacencyList(
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>
  ): Map<string, GraphEdge[]> {
    const adj = new Map<string, GraphEdge[]>();

    for (const pool of pools) {
      if (pool.status !== 'active') continue;
      if (!this.satisfiesQualityTier(pool)) continue;
      if (!pool.token0?.address || !pool.token1?.address) continue;

      const adapter = adapters.get(pool.protocol);
      if (!adapter || !adapter.supports(pool)) continue;

      const t0Addr = pool.token0.address.toLowerCase();
      const t1Addr = pool.token1.address.toLowerCase();

      // Forward edge: token0 -> token1
      const edge01: GraphEdge = {
        pool,
        adapter,
        tokenIn: pool.token0,
        tokenOut: pool.token1,
      };

      // Reverse edge: token1 -> token0
      const edge10: GraphEdge = {
        pool,
        adapter,
        tokenIn: pool.token1,
        tokenOut: pool.token0,
      };

      if (!adj.has(t0Addr)) adj.set(t0Addr, []);
      if (!adj.has(t1Addr)) adj.set(t1Addr, []);

      adj.get(t0Addr)!.push(edge01);
      adj.get(t1Addr)!.push(edge10);
    }

    return adj;
  }

  /**
   * Generates 2-hop cross-venue / cross-fee-tier cycles (A -> B -> A).
   * Supports both directional orientations (P1->P2 and P2->P1).
   */
  public generate2HopRoutes(
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>
  ): RoundTripRouteDef[] {
    const adj = this.buildAdjacencyList(pools, adapters);
    const routes: RoundTripRouteDef[] = [];
    const seenCycles = new Set<string>();

    for (const [tokenAAddr, outEdgesA] of adj.entries()) {
      for (const edge1 of outEdgesA) {
        const tokenBAddr = edge1.tokenOut.address.toLowerCase();
        if (tokenBAddr === tokenAAddr) continue; // no self-loops

        const outEdgesB = adj.get(tokenBAddr) || [];
        for (const edge2 of outEdgesB) {
          const returnTokenAddr = edge2.tokenOut.address.toLowerCase();
          if (returnTokenAddr !== tokenAAddr) continue; // must return to Token A

          // Must use distinct pools
          if (edge1.pool.poolAddress.toLowerCase() === edge2.pool.poolAddress.toLowerCase()) {
            continue;
          }

          // Chain isolation: Must be on exact same chain
          if (edge1.pool.chain !== edge2.pool.chain) {
            continue;
          }

          // Canonical directional key: normalizes starting token to min(tokenA, tokenB)
          // to eliminate rotational duplicates while retaining distinct traversal directions.
          const isMinStart = tokenAAddr < tokenBAddr;
          if (!isMinStart) {
            // Evaluated when tokenB is the outer loop
            continue;
          }

          const p1Addr = edge1.pool.poolAddress.toLowerCase();
          const p2Addr = edge2.pool.poolAddress.toLowerCase();
          const routeKey = `2hop:${edge1.pool.chain}:${p1Addr}->${p2Addr}:${tokenAAddr}->${tokenBAddr}`;

          if (seenCycles.has(routeKey)) continue;
          seenCycles.add(routeKey);

          const leg1: RoundTripLegDef = {
            pool: edge1.pool,
            adapter: edge1.adapter,
            tokenIn: edge1.tokenIn,
            tokenOut: edge1.tokenOut,
          };
          const leg2: RoundTripLegDef = {
            pool: edge2.pool,
            adapter: edge2.adapter,
            tokenIn: edge2.tokenIn,
            tokenOut: edge2.tokenOut,
          };

          routes.push({
            id: `2hop:${edge1.pool.chain}:${edge1.pool.id}->${edge2.pool.id}:${edge1.tokenIn.symbol}->${edge1.tokenOut.symbol}->${edge2.tokenOut.symbol}`,
            name: `2-Hop: ${edge1.tokenIn.symbol} -> ${edge1.tokenOut.symbol} (${edge1.pool.dex} ${edge1.pool.feeBps}bps -> ${edge2.pool.dex} ${edge2.pool.feeBps}bps)`,
            chain: edge1.pool.chain,
            leg1,
            leg2,
          });

          if (routes.length >= this.max2Hop) return routes;
        }
      }
    }

    return routes;
  }

  /**
   * Generates 3-hop triangular cycles (A -> B -> C -> A).
   */
  public generateTriangularRoutes(
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>
  ): RoundTripRouteDef[] {
    const adj = this.buildAdjacencyList(pools, adapters);
    const routes: RoundTripRouteDef[] = [];
    const seenCycles = new Set<string>();

    for (const [tokenAAddr, outEdgesA] of adj.entries()) {
      for (const edge1 of outEdgesA) {
        const tokenBAddr = edge1.tokenOut.address.toLowerCase();
        if (tokenBAddr === tokenAAddr) continue;

        const outEdgesB = adj.get(tokenBAddr) || [];
        for (const edge2 of outEdgesB) {
          const tokenCAddr = edge2.tokenOut.address.toLowerCase();
          if (tokenCAddr === tokenAAddr || tokenCAddr === tokenBAddr) continue; // distinct tokens

          if (edge2.pool.poolAddress.toLowerCase() === edge1.pool.poolAddress.toLowerCase()) {
            continue; // distinct pools
          }

          if (edge2.pool.chain !== edge1.pool.chain) {
            continue; // chain isolation
          }

          const outEdgesC = adj.get(tokenCAddr) || [];
          for (const edge3 of outEdgesC) {
            const returnTokenAddr = edge3.tokenOut.address.toLowerCase();
            if (returnTokenAddr !== tokenAAddr) continue; // must return to Token A

            if (
              edge3.pool.poolAddress.toLowerCase() === edge1.pool.poolAddress.toLowerCase() ||
              edge3.pool.poolAddress.toLowerCase() === edge2.pool.poolAddress.toLowerCase()
            ) {
              continue; // distinct pools
            }

            if (edge3.pool.chain !== edge1.pool.chain) {
              continue; // chain isolation
            }

            // Normalizes cycle starting token to lexicographically smallest to avoid cyclic duplicates
            const tokens = [tokenAAddr, tokenBAddr, tokenCAddr];
            const minToken = [...tokens].sort()[0];
            if (tokenAAddr !== minToken) {
              continue; // Skip cyclic rotation
            }

            const pools = [
              edge1.pool.poolAddress.toLowerCase(),
              edge2.pool.poolAddress.toLowerCase(),
              edge3.pool.poolAddress.toLowerCase(),
            ];
            const cycleKey = `tri:${edge1.pool.chain}:${pools.join('->')}:${tokens.join('->')}`;
            if (seenCycles.has(cycleKey)) continue;
            seenCycles.add(cycleKey);

            routes.push({
              id: `tri:${edge1.pool.chain}:${edge1.pool.id}->${edge2.pool.id}->${edge3.pool.id}:${edge1.tokenIn.symbol}->${edge2.tokenIn.symbol}->${edge3.tokenIn.symbol}->${edge3.tokenOut.symbol}`,
              name: `Triangular: ${edge1.tokenIn.symbol} -> ${edge2.tokenIn.symbol} -> ${edge3.tokenIn.symbol} -> ${edge3.tokenOut.symbol} (${edge1.pool.dex} -> ${edge2.pool.dex} -> ${edge3.pool.dex})`,
              chain: edge1.pool.chain,
              leg1: {
                pool: edge1.pool,
                adapter: edge1.adapter,
                tokenIn: edge1.tokenIn,
                tokenOut: edge1.tokenOut,
              },
              leg2: {
                pool: edge2.pool,
                adapter: edge2.adapter,
                tokenIn: edge2.tokenIn,
                tokenOut: edge2.tokenOut,
              },
              leg3: {
                pool: edge3.pool,
                adapter: edge3.adapter,
                tokenIn: edge3.tokenIn,
                tokenOut: edge3.tokenOut,
              },
            });

            if (routes.length >= this.maxTri) return routes;
          }
        }
      }
    }

    return routes;
  }

  /**
   * Generates all supported routes (2-hop and 3-hop) from pool graph.
   */
  public generateAllRoutes(
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>
  ): RoundTripRouteDef[] {
    const routes2Hop = this.generate2HopRoutes(pools, adapters);
    const routesTri = this.generateTriangularRoutes(pools, adapters);
    return [...routes2Hop, ...routesTri];
  }
}
