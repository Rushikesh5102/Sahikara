/**
 * SAHIKARA Phase 1E — Short Controlled Live Read-Only Validation Runner
 *
 * Runs 3 observation cycles against live Base mainnet.
 * Validates:
 *   - Live Base block reading & latency measurement via RpcManager
 *   - Multi-DEX adapters: UniswapV3, Aerodrome, PancakeSwapV3, AerodromeSlipstream (stub)
 *   - Dynamic route generation across configured research pairs
 *   - Executable quotes (UniswapV3 QuoterV2, Aerodrome Router, PancakeSwapV3 QuoterV2)
 *   - Round-trip economics calculation
 *   - Database insertion with pool-level uniqueness deduplication
 *   - RPC metrics reporting
 *   - Strictly read-only execution (ZERO transactions, ZERO signing, ZERO private keys)
 *
 * Usage:
 *   node scripts/run-short-validation.mjs
 */

import { loadConfig } from '../dist/config/config.js';
import { RpcProvider } from '../dist/rpc/RpcProvider.js';
import { RpcManager } from '../dist/rpc/RpcManager.js';
import { UniswapV3Adapter } from '../dist/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../dist/adapters/AerodromeAdapter.js';
import { PancakeSwapV3Adapter } from '../dist/adapters/PancakeSwapV3Adapter.js';
import { AerodromeSlipstreamAdapter } from '../dist/adapters/AerodromeSlipstreamAdapter.js';
import { MarketObserver } from '../dist/observer/MarketObserver.js';
import { ALL_ACTIVE_POOLS } from '../dist/config/pools.js';
import { RESEARCH_PAIRS } from '../dist/config/pairs.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 1E — Multi-Pair / Multi-DEX Validation');
  console.log(' READ-ONLY | No transactions | Zero private keys | Execution LOCKED');
  console.log('═══════════════════════════════════════════════════════════════');

  const config = loadConfig();

  const primaryProvider = new RpcProvider({
    id: config.rpcEndpointId || 'base-primary',
    url: config.baseRpcUrl,
    chainId: 8453,
  });

  const secondaryProvider = config.baseRpcUrlSecondary
    ? new RpcProvider({
        id: 'base-secondary',
        url: config.baseRpcUrlSecondary,
        chainId: 8453,
      })
    : null;

  const dataSource = new RpcManager({
    primaryProvider,
    secondaryProvider,
    maxRetries: 3,
  });

  const adapters = [
    new UniswapV3Adapter(dataSource),
    new AerodromeAdapter(dataSource),
    new PancakeSwapV3Adapter(dataSource),
    new AerodromeSlipstreamAdapter(),
  ];

  const observer = new MarketObserver(
    config,
    dataSource,
    adapters,
    ALL_ACTIVE_POOLS,
    RESEARCH_PAIRS
  );

  console.log(`Configured pools: ${ALL_ACTIVE_POOLS.length}`);
  console.log(`Configured research pairs: ${RESEARCH_PAIRS.length}`);
  console.log(`Adapters registered: ${adapters.map((a) => a.protocol).join(', ')}`);

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n─── Cycle ${cycle} / 3 Starting ───`);
    const cycleStart = performance.now();
    await observer.runCycle();
    const cycleDuration = Math.round(performance.now() - cycleStart);
    console.log(`─── Cycle ${cycle} Complete (${cycleDuration}ms) ───\n`);

    if (cycle < 3) {
      console.log('Waiting 5s before next cycle...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' RPC METRICS SUMMARY:');
  const metrics = dataSource.getMetrics();
  console.log(`  Active provider:      ${metrics.activeProviderId}`);
  console.log(`  Total requests:       ${metrics.primaryMetrics.totalRequests}`);
  console.log(`  Successful requests:  ${metrics.primaryMetrics.successfulRequests}`);
  console.log(`  Failed requests:      ${metrics.primaryMetrics.failedRequests}`);
  console.log(`  Timeout requests:     ${metrics.primaryMetrics.timeoutRequests}`);
  console.log(`  Rate limit hits:      ${metrics.primaryMetrics.rateLimitHits}`);
  console.log(`  P50 latency:          ${metrics.primaryMetrics.p50LatencyMs}ms`);
  console.log(`  P90 latency:          ${metrics.primaryMetrics.p90LatencyMs}ms`);
  console.log(`  P99 latency:          ${metrics.primaryMetrics.p99LatencyMs}ms`);
  console.log(`  Provider failovers:   ${metrics.totalFailovers}`);
  console.log(`  Primary health:       ${primaryProvider.isHealthy() ? 'HEALTHY' : 'UNHEALTHY'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Validation finished successfully. All calls read-only. Zero transactions signed.');
}

main().catch((err) => {
  console.error('Fatal error during validation:', err);
  process.exit(1);
});
