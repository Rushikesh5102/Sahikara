/**
 * SAHIKARA Phase 1F — Controlled Short Validation Runner (3–10 Cycles)
 *
 * Requirements:
 *   - Execute 5 controlled read-only observation cycles across verified multi-pair universe
 *   - Exercise Uniswap V3, Aerodrome Volatile/Stable, Aerodrome Slipstream, PancakeSwap V3
 *   - Validate low-fee pools (10 bps total round-trip fee friction)
 *   - Collect BPS distributions (min, p25, median, p75, p90, p95, p99, max)
 *   - Generate review matrices:
 *       1. PAIR MATRIX
 *       2. PAIR PROFITABILITY MATRIX
 *       3. DEX MATRIX
 *   - Verify database persistence and zero duplicate integrity
 *   - Strictly read-only: NO private keys, NO wallet signing, NO transaction broadcast
 */

import { loadConfig } from '../src/config/config.js';
import { RpcProvider } from '../src/rpc/RpcProvider.js';
import { RpcManager } from '../src/rpc/RpcManager.js';
import { UniswapV3Adapter } from '../src/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../src/adapters/AerodromeAdapter.js';
import { PancakeSwapV3Adapter } from '../src/adapters/PancakeSwapV3Adapter.js';
import { AerodromeSlipstreamAdapter } from '../src/adapters/AerodromeSlipstreamAdapter.js';
import { RouteGenerator } from '../src/discovery/RouteGenerator.js';
import { MarketDiscoveryEngine } from '../src/discovery/MarketDiscoveryEngine.js';
import { ObservationStore } from '../src/storage/ObservationStore.js';
import { ALL_ACTIVE_POOLS } from '../src/config/pools.js';
import { RESEARCH_PAIRS, BASE_CHAIN_ID } from '../src/config/pairs.js';
import type { IPoolAdapter } from '../src/adapters/IPoolAdapter.js';

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 1F — Controlled Multi-Pair Short Validation Sweep');
  console.log(' Strict Mode: READ-ONLY RESEARCH (Zero transactions, Zero keys)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const config = loadConfig();

  const primaryProvider = new RpcProvider({
    id: config.rpcEndpointId || 'base-primary',
    url: config.baseRpcUrl,
    chainId: BASE_CHAIN_ID,
  });

  const secondaryProvider = config.baseRpcUrlSecondary
    ? new RpcProvider({
        id: 'base-secondary',
        url: config.baseRpcUrlSecondary,
        chainId: BASE_CHAIN_ID,
      })
    : null;

  const dataSource = new RpcManager({
    primaryProvider,
    secondaryProvider,
    maxRetries: 3,
  });

  // Verify RPC connectivity
  console.log('[Setup] Verifying RPC connectivity...');
  await dataSource.verifyConnectivity(BASE_CHAIN_ID);
  console.log('✅ RPC connectivity confirmed.\n');

  // Instantiate adapters
  const uniAdapter = new UniswapV3Adapter(dataSource);
  const aeroAdapter = new AerodromeAdapter(dataSource);
  const cakeAdapter = new PancakeSwapV3Adapter(dataSource);
  const slipstreamAdapter = new AerodromeSlipstreamAdapter(dataSource);

  const adaptersMap = new Map<string, IPoolAdapter>([
    ['uniswap-v3', uniAdapter],
    ['aerodrome-volatile', aeroAdapter],
    ['aerodrome-stable', aeroAdapter],
    ['pancakeswap-v3', cakeAdapter],
    ['aerodrome-slipstream', slipstreamAdapter],
  ]);

  const routeGenerator = new RouteGenerator({
    maxRoutesPerPair: 12,
  });

  const store = new ObservationStore(config.dbPath);

  const discoveryEngine = new MarketDiscoveryEngine({
    pairs: RESEARCH_PAIRS,
    pools: ALL_ACTIVE_POOLS,
    adapters: adaptersMap,
    routeGenerator,
    dataSource,
    store,
    researchSizesUsd: [1.0, 10.0, 100.0],
    ethPriceUsd: parseFloat(process.env['ETH_PRICE_USD'] ?? '2400'),
    minNetProfitUsd: 0.05,
    riskBufferFraction: 0.001,
    maxPriceImpactBps: 100,
  });

  const TOTAL_CYCLES = 5;
  console.log(`[Validation Plan] Executing ${TOTAL_CYCLES} discovery cycles across ${RESEARCH_PAIRS.filter(p => p.enabled).length} active pairs and ${ALL_ACTIVE_POOLS.length} verified pools.`);
  console.log('Research Trade Sizes: $1.00, $10.00, $100.00\n');

  for (let cycle = 1; cycle <= TOTAL_CYCLES; cycle++) {
    const cycleStart = performance.now();
    console.log(`── Cycle ${cycle}/${TOTAL_CYCLES} ──────────────────────────────────────────`);

    const result = await discoveryEngine.runCycle();
    const cycleDurationMs = Math.round(performance.now() - cycleStart);

    console.log(
      `📦 Block: ${result.blockNumber} | Routes Evaluated: ${result.routesEvaluated} | ` +
      `Duration: ${cycleDurationMs}ms`
    );

    // Brief delay between validation cycles (1.5 seconds)
    if (cycle < TOTAL_CYCLES) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(' Phase 1F Validation Sweep Complete — Generating Metrics & Matrices');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const metrics = discoveryEngine.getMetrics();

  console.log('── Global Metrics Summary ─────────────────────────────────────────────');
  console.log(`Pairs Scanned:                  ${metrics.pairsScanned}`);
  console.log(`Pools Scanned:                  ${metrics.poolsScanned}`);
  console.log(`DEXs Scanned:                   ${metrics.dexsScanned}`);
  console.log(`Distinct Routes Generated:      ${metrics.routesGenerated}`);
  console.log(`Quotes Attempted:               ${metrics.quotesAttempted}`);
  console.log(`Successful Quotes:              ${metrics.successfulQuotes}`);
  console.log(`Failed Quotes:                  ${metrics.failedQuotes}`);
  console.log(`Round Trips Evaluated:          ${metrics.roundTripsEvaluated}`);
  console.log(`Positive Gross Observations:    ${metrics.positiveGrossRoundTrips}`);
  console.log(`Potential Candidates:           ${metrics.candidatesDetected}`);
  console.log(`Rejected Observations:          ${metrics.candidatesRejected}`);
  console.log('');

  console.log('── Opportunity Classification Breakdown ──────────────────────────────');
  for (const [classification, count] of Object.entries(metrics.classificationBreakdown)) {
    console.log(`  ${classification.padEnd(26)} : ${count}`);
  }
  console.log('');

  if (metrics.grossBpsDistribution) {
    const g = metrics.grossBpsDistribution;
    console.log('── Gross Spread BPS Distribution ──────────────────────────────────────');
    console.log(`  Min:     ${g.min.toFixed(2)} bps`);
    console.log(`  p25:     ${g.p25.toFixed(2)} bps`);
    console.log(`  Median:  ${g.median.toFixed(2)} bps`);
    console.log(`  p75:     ${g.p75.toFixed(2)} bps`);
    console.log(`  p90:     ${g.p90.toFixed(2)} bps`);
    console.log(`  p95:     ${g.p95.toFixed(2)} bps`);
    console.log(`  p99:     ${g.p99.toFixed(2)} bps`);
    console.log(`  Max:     ${g.max.toFixed(2)} bps`);
    console.log('');
  }

  if (metrics.netBpsDistribution) {
    const n = metrics.netBpsDistribution;
    console.log('── Net Expected Profit BPS Distribution ───────────────────────────────');
    console.log(`  Min:     ${n.min.toFixed(2)} bps`);
    console.log(`  Median:  ${n.median.toFixed(2)} bps`);
    console.log(`  p90:     ${n.p90.toFixed(2)} bps`);
    console.log(`  p95:     ${n.p95.toFixed(2)} bps`);
    console.log(`  p99:     ${n.p99.toFixed(2)} bps`);
    console.log(`  Max:     ${n.max.toFixed(2)} bps`);
    console.log('');
  }

  // 1. PAIR MATRIX
  console.log('── PAIR MATRIX (Pair × DEX A × DEX B) ─────────────────────────────────');
  console.log('| Pair            | DEX A                | DEX B                | Routes | Quotes | Failures | Candidates |');
  console.log('|-----------------|----------------------|----------------------|--------|--------|----------|------------|');
  const pairMatrix = discoveryEngine.generatePairMatrix();
  for (const row of pairMatrix) {
    console.log(
      `| ${row.pair.padEnd(15)} | ${row.dexA.padEnd(20)} | ${row.dexB.padEnd(20)} | ${String(row.routes).padStart(6)} | ${String(row.quotes).padStart(6)} | ${String(row.failures).padStart(8)} | ${String(row.candidates).padStart(10)} |`
    );
  }
  console.log('');

  // 2. PAIR PROFITABILITY MATRIX
  console.log('── PAIR PROFITABILITY MATRIX ──────────────────────────────────────────');
  console.log('| Pair            | Mean Gross BPS | Max Gross BPS | Mean Net BPS   | Max Net BPS    | Candidates |');
  console.log('|-----------------|----------------|---------------|----------------|----------------|------------|');
  const pairProfitability = discoveryEngine.generatePairProfitabilityMatrix();
  for (const row of pairProfitability) {
    console.log(
      `| ${row.pair.padEnd(15)} | ${String(row.meanGrossBps.toFixed(2)).padStart(14)} | ${String(row.maxGrossBps.toFixed(2)).padStart(13)} | ${String(row.meanNetBps.toFixed(2)).padStart(14)} | ${String(row.maxNetBps.toFixed(2)).padStart(14)} | ${String(row.candidates).padStart(10)} |`
    );
  }
  console.log('');

  // 3. DEX MATRIX
  console.log('── DEX MATRIX (DEX Combination Summary) ───────────────────────────────');
  console.log('| DEX Leg 1            | DEX Leg 2            | Routes | Opportunities | Quote Failures |');
  console.log('|----------------------|----------------------|--------|---------------|----------------|');
  const dexMatrix = discoveryEngine.generateDexMatrix();
  for (const row of dexMatrix) {
    console.log(
      `| ${row.dexA.padEnd(20)} | ${row.dexB.padEnd(20)} | ${String(row.routes).padStart(6)} | ${String(row.opportunities).padStart(13)} | ${String(row.quoteFailures).padStart(14)} |`
    );
  }
  console.log('');

  // Data integrity check
  console.log('── Database Storage & Integrity Check ─────────────────────────────────');
  const health = store.getHealth();
  const dupCheck = store.checkDuplicateIntegrity();
  console.log(`Total Stored Round Trips:       ${health.roundTripTotal}`);
  console.log(`Logical Duplicate Round-Trips:  ${dupCheck.roundTripDuplicates} ${dupCheck.roundTripDuplicates === 0 ? '✅ (Zero duplicates)' : '❌'}`);
  console.log(`Recent Errors:                  ${health.recentErrors} ${health.recentErrors === 0 ? '✅ (Clean run)' : '⚠️'}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  store.close();
}

main().catch((err: unknown) => {
  console.error('[FATAL] Short validation sweep encountered an error:', err);
  process.exit(1);
});
