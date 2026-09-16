/**
 * SAHIKARA Observer — Deterministic Cross-DEX Route Generator
 *
 * Dynamically generates valid 2-hop round-trip arbitrage routes
 * from registered pools and configured research pairs.
 *
 * VALIDATION RULES:
 *   1. Token compatibility: pools must contain the exact tokens of the pair.
 *   2. Active status: only active pools with verified addresses are routed.
 *   3. Adapter support: an adapter must exist and report supports(pool) === true.
 *   4. No self-loops: Leg 1 and Leg 2 pool addresses cannot be identical.
 *   5. Combinatorial boundedness: respects maxRoutesPerPair to avoid unbounded growth.
 */

import type { RoundTripRouteDef, RoundTripLegDef } from '../economics/roundTripEvaluator.js';
import type { PoolDefinition } from '../config/pools.js';
import type { ResearchPair } from '../config/pairs.js';
import type { IPoolAdapter } from '../adapters/IPoolAdapter.js';

export interface RouteGeneratorOptions {
  maxRoutesPerPair?: number;
}

export class RouteGenerator {
  private readonly maxRoutesPerPair: number;

  constructor(options: RouteGeneratorOptions = {}) {
    this.maxRoutesPerPair = options.maxRoutesPerPair ?? 10;
  }

  /**
   * Check if a pool matches a research pair's tokens (in either direction).
   */
  private poolMatchesPair(pool: PoolDefinition, pair: ResearchPair): boolean {
    const p0 = pool.token0.address.toLowerCase();
    const p1 = pool.token1.address.toLowerCase();
    const b = pair.baseToken.address.toLowerCase();
    const q = pair.quoteToken.address.toLowerCase();

    return (p0 === b && p1 === q) || (p0 === q && p1 === b);
  }


  /**
   * Generate valid 2-hop round-trip routes for all active research pairs.
   *
   * @param pairs List of research pairs to generate routes for
   * @param pools List of all candidate pools in the registry
   * @param adapters Map of pool protocol to its corresponding adapter instance
   */
  generateRoutes(
    pairs: ResearchPair[],
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>
  ): RoundTripRouteDef[] {
    const allRoutes: RoundTripRouteDef[] = [];

    for (const pair of pairs) {
      if (!pair.enabled) continue;

      // 1. Find all active, supported pools for this pair
      const eligiblePools = pools.filter((pool) => {
        if (pool.status !== 'active') return false;
        if (!this.poolMatchesPair(pool, pair)) return false;

        const adapter = adapters.get(pool.protocol);
        if (!adapter || !adapter.supports(pool)) return false;

        return true;
      });

      if (eligiblePools.length < 2) {
        // Need at least 2 distinct pools to form an arbitrage route
        continue;
      }

      let routesForPair = 0;

      // 2. Generate pairwise cross-pool routes (Pool A -> Pool B and Pool B -> Pool A)
      for (let i = 0; i < eligiblePools.length; i++) {
        for (let j = i + 1; j < eligiblePools.length; j++) {
          if (routesForPair >= this.maxRoutesPerPair) break;

          const poolA = eligiblePools[i]!;
          const poolB = eligiblePools[j]!;

          // No self-loops
          if (poolA.poolAddress.toLowerCase() === poolB.poolAddress.toLowerCase()) {
            continue;
          }

          const adapterA = adapters.get(poolA.protocol)!;
          const adapterB = adapters.get(poolB.protocol)!;

          // Leg 1 on Pool A (Base -> Quote), Leg 2 on Pool B (Quote -> Base)
          const leg1Forward: RoundTripLegDef = {
            pool: poolA,
            adapter: adapterA,
            tokenIn: pair.baseToken,
            tokenOut: pair.quoteToken,
          };
          const leg2Forward: RoundTripLegDef = {
            pool: poolB,
            adapter: adapterB,
            tokenIn: pair.quoteToken,
            tokenOut: pair.baseToken,
          };

          const routeForward: RoundTripRouteDef = {
            id: `${pair.id}:${poolA.id}->${poolB.id}`,
            name: `${poolA.dex} (${poolA.feeBps}bps) -> ${poolB.dex} (${poolB.feeBps}bps) [${pair.symbol}]`,
            chain: poolA.chain,
            leg1: leg1Forward,
            leg2: leg2Forward,
          };

          allRoutes.push(routeForward);
          routesForPair++;

          if (routesForPair >= this.maxRoutesPerPair) break;

          // Leg 1 on Pool B (Base -> Quote), Leg 2 on Pool A (Quote -> Base)
          const leg1Reverse: RoundTripLegDef = {
            pool: poolB,
            adapter: adapterB,
            tokenIn: pair.baseToken,
            tokenOut: pair.quoteToken,
          };
          const leg2Reverse: RoundTripLegDef = {
            pool: poolA,
            adapter: adapterA,
            tokenIn: pair.quoteToken,
            tokenOut: pair.baseToken,
          };

          const routeReverse: RoundTripRouteDef = {
            id: `${pair.id}:${poolB.id}->${poolA.id}`,
            name: `${poolB.dex} (${poolB.feeBps}bps) -> ${poolA.dex} (${poolA.feeBps}bps) [${pair.symbol}]`,
            chain: poolB.chain,
            leg1: leg1Reverse,
            leg2: leg2Reverse,
          };

          allRoutes.push(routeReverse);
          routesForPair++;
        }
      }
    }

    return allRoutes;
  }

  /**
   * Generate valid 3-leg triangular routes from candidate pools.
   * Leg 1: Token A -> Token B (Pool 1)
   * Leg 2: Token B -> Token C (Pool 2)
   * Leg 3: Token C -> Token A (Pool 3)
   *
   * Enforces:
   * - Distinct pools: Pool 1 != Pool 2 != Pool 3
   * - Distinct tokens: Token A != Token B != Token C
   * - Adapter support on each leg
   * - Deterministic route ID
   * - Max routes limit to prevent combinatorial explosion
   */
  generateTriangularRoutes(
    pools: PoolDefinition[],
    adapters: Map<string, IPoolAdapter>,
    maxTriangularRoutes = 20
  ): RoundTripRouteDef[] {
    const activePools = pools.filter((p) => {
      if (p.status !== 'active') return false;
      const adapter = adapters.get(p.protocol);
      return adapter && adapter.supports(p);
    });

    const triangularRoutes: RoundTripRouteDef[] = [];
    const seenRouteIds = new Set<string>();

    for (let i = 0; i < activePools.length; i++) {
      const p1 = activePools[i]!;
      const adapter1 = adapters.get(p1.protocol)!;

      const leg1Orientations = [
        { in: p1.token0, out: p1.token1 },
        { in: p1.token1, out: p1.token0 },
      ];

      for (const orient1 of leg1Orientations) {
        const tokenA = orient1.in;
        const tokenB = orient1.out;

        for (let j = 0; j < activePools.length; j++) {
          if (j === i) continue;
          const p2 = activePools[j]!;
          if (p2.poolAddress.toLowerCase() === p1.poolAddress.toLowerCase()) continue;

          const p2t0 = p2.token0.address.toLowerCase();
          const p2t1 = p2.token1.address.toLowerCase();
          const bAddr = tokenB.address.toLowerCase();
          const aAddr = tokenA.address.toLowerCase();

          let tokenC: typeof p2.token0 | null = null;
          if (p2t0 === bAddr && p2t1 !== aAddr) {
            tokenC = p2.token1;
          } else if (p2t1 === bAddr && p2t0 !== aAddr) {
            tokenC = p2.token0;
          }
          if (!tokenC) continue;

          const cAddr = tokenC.address.toLowerCase();
          const adapter2 = adapters.get(p2.protocol)!;

          for (let k = 0; k < activePools.length; k++) {
            if (k === i || k === j) continue;
            const p3 = activePools[k]!;
            if (
              p3.poolAddress.toLowerCase() === p1.poolAddress.toLowerCase() ||
              p3.poolAddress.toLowerCase() === p2.poolAddress.toLowerCase()
            ) {
              continue;
            }

            const p3t0 = p3.token0.address.toLowerCase();
            const p3t1 = p3.token1.address.toLowerCase();

            const matchesLeg3 =
              (p3t0 === cAddr && p3t1 === aAddr) || (p3t1 === cAddr && p3t0 === aAddr);

            if (!matchesLeg3) continue;

            const adapter3 = adapters.get(p3.protocol)!;

            const routeId = `tri:${p1.id}->${p2.id}->${p3.id}:${tokenA.symbol}->${tokenB.symbol}->${tokenC.symbol}->${tokenA.symbol}`;
            if (seenRouteIds.has(routeId)) continue;
            seenRouteIds.add(routeId);

            triangularRoutes.push({
              id: routeId,
              name: `Tri: ${tokenA.symbol}->${tokenB.symbol}->${tokenC.symbol}->${tokenA.symbol} (${p1.dex} -> ${p2.dex} -> ${p3.dex})`,
              chain: p1.chain,
              leg1: {
                pool: p1,
                adapter: adapter1,
                tokenIn: tokenA,
                tokenOut: tokenB,
              },
              leg2: {
                pool: p2,
                adapter: adapter2,
                tokenIn: tokenB,
                tokenOut: tokenC,
              },
              leg3: {
                pool: p3,
                adapter: adapter3,
                tokenIn: tokenC,
                tokenOut: tokenA,
              },
            });

            if (triangularRoutes.length >= maxTriangularRoutes) {
              return triangularRoutes;
            }
          }
        }
      }
    }

    return triangularRoutes;
  }
}
