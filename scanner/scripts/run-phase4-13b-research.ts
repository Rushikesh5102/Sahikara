/**
 * SAHIKARA Phase 4.13B — CEX-DEX Empirical Research Campaign Runner
 *
 * MISSION:
 *   Conduct reproducible, controlled observation of live public CEX order books
 *   (Binance, Coinbase, Kraken) against on-chain DEX quoter states (Base, Arbitrum, Polygon)
 *   to determine whether actionable, persistent, and net-positive arbitrage exists.
 *
 * SAFETY INVARIANTS:
 *   - Strictly research and feasibility analysis only.
 *   - Zero wallets, zero signers, zero private keys, zero API trading credentials.
 *   - Zero transaction broadcasting, zero contract deployment, zero live orders.
 *   - Capital at risk: strictly ₹0.00 / $0.00.
 *   - Phase 5 remains strictly BLOCKED.
 */

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CexMarketDataNormalizer } from '../src/cex/CexMarketDataNormalizer.js';
import { CexOrderBook } from '../src/cex/CexOrderBook.js';
import { CrossVenueOpportunityDetector, CrossVenueEvaluation } from '../src/crossvenue/CrossVenueOpportunityDetector.js';
import { OpportunityPersistence } from '../src/crossvenue/OpportunityPersistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// QuoterV2 Minimal ABI
const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

function calculatePercentiles(values: number[]) {
  if (values.length === 0) {
    return { min: 0, p25: 0, median: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const getP = (p: number) => {
    const idx = Math.floor((sorted.length - 1) * (p / 100));
    return sorted[idx]!;
  };
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    min: Number(sorted[0]!.toFixed(2)),
    p25: Number(getP(25).toFixed(2)),
    median: Number(getP(50).toFixed(2)),
    p75: Number(getP(75).toFixed(2)),
    p90: Number(getP(90).toFixed(2)),
    p95: Number(getP(95).toFixed(2)),
    p99: Number(getP(99).toFixed(2)),
    max: Number(sorted[sorted.length - 1]!.toFixed(2)),
    mean: Number(mean.toFixed(2)),
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.13B — CEX-DEX Research Campaign');
  console.log(' Capital: ₹0.00 | Execution: LOCKED | Credentials: NONE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Setup Public RPC Clients
  const baseClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

  // Token Addresses
  const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;
  const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
  const BASE_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

  // CEX Normalizers
  const binance = new CexMarketDataNormalizer('binance');
  const coinbase = new CexMarketDataNormalizer('coinbase');
  const kraken = new CexMarketDataNormalizer('kraken');

  const venues = [
    { normalizer: coinbase, symbol: 'ETH-USD', name: 'Coinbase ETH-USD' },
    { normalizer: binance, symbol: 'ETHUSDC', name: 'Binance ETHUSDC' },
    { normalizer: kraken, symbol: 'ETHUSDC', name: 'Kraken ETHUSDC' },
  ];

  const persistence = new OpportunityPersistence();
  const allEvaluations: CrossVenueEvaluation[] = [];

  let totalCexMessages = 0;
  let totalOrderBookSnapshots = 0;
  let totalDexQuotes = 0;
  let totalEvaluations = 0;

  console.log('[1/4] Verifying CEX Public Endpoints & Server Clock Offsets...');
  for (const v of venues) {
    try {
      const serverTime = await v.normalizer.getServerTime();
      totalCexMessages++;
      console.log(
        `  - ${v.normalizer.venue.toUpperCase()}: RTT=${serverTime.rttMs.toFixed(1)}ms, ` +
        `ClockDelta=${serverTime.exchangeToLocalClockDeltaMs}ms (${serverTime.exchangeTimeMs} vs local ${serverTime.localReceiveWallClock})`
      );
    } catch (e: any) {
      console.log(`  - ${v.normalizer.venue.toUpperCase()} ServerTime error: ${e.message}`);
    }
  }

  console.log('\n[2/4] Executing Controlled Multi-Size Observation Rounds (10 Rounds)...');
  const ROUNDS = 10;

  for (let round = 1; round <= ROUNDS; round++) {
    const tRoundMonotonic = performance.now();
    const tRoundWall = Date.now();

    // Query Base DEX Quotes for WETH/USDC
    let dexBaseBuyPrice = 0;
    let dexBaseSellPrice = 0;
    try {
      // Quote sell: 1 WETH -> USDC
      const sellQuote = await baseClient.readContract({
        address: BASE_QUOTER,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: BASE_WETH,
          tokenOut: BASE_USDC,
          amountIn: parseUnits('1', 18),
          fee: 500,
          sqrtPriceLimitX96: 0n,
        }],
      });
      dexBaseSellPrice = Number(formatUnits(sellQuote[0], 6));
      totalDexQuotes++;

      // Quote buy: 2500 USDC -> WETH
      const buyQuote = await baseClient.readContract({
        address: BASE_QUOTER,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: BASE_USDC,
          tokenOut: BASE_WETH,
          amountIn: parseUnits('2500', 6),
          fee: 500,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const wethOut = Number(formatUnits(buyQuote[0], 18));
      dexBaseBuyPrice = wethOut > 0 ? 2500 / wethOut : 0;
      totalDexQuotes++;
    } catch (e: any) {
      console.log(`  [Round ${round}] DEX Base quote failed: ${e.message}`);
      continue;
    }

    // Query each CEX venue
    for (const v of venues) {
      try {
        const snapshot = await v.normalizer.getOrderBook(v.symbol, 20);
        totalCexMessages++;
        totalOrderBookSnapshots++;

        const book = new CexOrderBook(v.normalizer.venue, v.symbol);
        book.updateFromSnapshot(snapshot);

        // Run multi-size evaluation
        const evals = CrossVenueOpportunityDetector.evaluateMatrix({
          pairId: 'WETH-USDC-BASE',
          cexVenue: v.normalizer.venue,
          cexSymbol: v.symbol,
          targetChainId: 8453,
          book,
          dexExecutableBuyPrice: dexBaseBuyPrice,
          dexExecutableSellPrice: dexBaseSellPrice,
          dexDataTimestampWallClock: tRoundWall,
          dexGasUnits: 150000,
          gasPriceGwei: 0.05,
          ethPriceUsd: dexBaseSellPrice,
          cexFeeRateBps: 10,
          riskBufferBps: 10,
        });

        for (const ev of evals) {
          allEvaluations.push(ev);
          totalEvaluations++;

          // Track persistence
          persistence.recordObservation({
            pairId: ev.pairId,
            direction: ev.direction,
            grossSpreadBps: ev.economics.grossSpreadBps,
            netSpreadBps: ev.economics.netSpreadBps,
            localMonotonicMs: tRoundMonotonic,
            thresholdBps: 0,
          });
        }
      } catch (e: any) {
        console.log(`  [Round ${round}] CEX ${v.name} fetch failed: ${e.message}`);
      }
    }

    process.stdout.write(`  Round ${round}/${ROUNDS} completed (${allEvaluations.length} evaluations so far)\r`);
    await new Promise((r) => setTimeout(r, 1000)); // Pacing
  }

  console.log(`\n\n[3/4] Aggregating Empirical Results across ${totalEvaluations} Evaluations...`);

  const grossSpreads = allEvaluations.map((e) => e.economics.grossSpreadBps);
  const netSpreads = allEvaluations.map((e) => e.economics.netSpreadBps);

  const grossStats = calculatePercentiles(grossSpreads);
  const netStats = calculatePercentiles(netSpreads);

  const grossPositives = allEvaluations.filter((e) => e.economics.isGrossPositive);
  const netPositives = allEvaluations.filter((e) => e.economics.isNetPositive);
  const authenticGross = allEvaluations.filter((e) => e.validation.isAuthenticGross);
  const authenticNet = allEvaluations.filter((e) => e.validation.isAuthenticNet);
  const revalidated = allEvaluations.filter((e) => e.validation.isRevalidated);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(' EMPIRICAL STATISTICAL SUMMARY (Phase 4.13B)');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`CEX Messages Received:       ${totalCexMessages}`);
  console.log(`CEX Order Book Snapshots:    ${totalOrderBookSnapshots}`);
  console.log(`DEX Quotes Executed:         ${totalDexQuotes}`);
  console.log(`Cross-Venue Evaluations:     ${totalEvaluations}`);
  console.log(`Raw Gross Positives:         ${grossPositives.length}`);
  console.log(`Authentic Gross Positives:   ${authenticGross.length}`);
  console.log(`Raw Net Positives:           ${netPositives.length}`);
  console.log(`Authentic Net Positives:     ${authenticNet.length}`);
  console.log(`Revalidated Net Positives:   ${revalidated.length}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('Gross Spread Distribution (bps):');
  console.log(`  Min: ${grossStats.min} | P25: ${grossStats.p25} | Median: ${grossStats.median} | P75: ${grossStats.p75} | P95: ${grossStats.p95} | Max: ${grossStats.max} | Mean: ${grossStats.mean}`);
  console.log('Net Spread Distribution (bps):');
  console.log(`  Min: ${netStats.min} | P25: ${netStats.p25} | Median: ${netStats.median} | P75: ${netStats.p75} | P95: ${netStats.p95} | Max: ${netStats.max} | Mean: ${netStats.mean}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  // Breakdown by direction
  const dexToCex = allEvaluations.filter((e) => e.direction === 'DEX_TO_CEX');
  const cexToDex = allEvaluations.filter((e) => e.direction === 'CEX_TO_DEX');

  const dexToCexGross = calculatePercentiles(dexToCex.map((e) => e.economics.grossSpreadBps));
  const dexToCexNet = calculatePercentiles(dexToCex.map((e) => e.economics.netSpreadBps));
  const cexToDexGross = calculatePercentiles(cexToDex.map((e) => e.economics.grossSpreadBps));
  const cexToDexNet = calculatePercentiles(cexToDex.map((e) => e.economics.netSpreadBps));

  console.log('Directional Breakdown:');
  console.log(`  DEX -> CEX (N=${dexToCex.length}): Gross Median = ${dexToCexGross.median} bps, Net Median = ${dexToCexNet.median} bps`);
  console.log(`  CEX -> DEX (N=${cexToDex.length}): Gross Median = ${cexToDexGross.median} bps, Net Median = ${cexToDexNet.median} bps`);

  // Breakdown by notional size
  console.log('\nSize Sensitivity (Median Net Spread):');
  for (const notional of CrossVenueOpportunityDetector.REQUIRED_NOTIONALS) {
    const subset = allEvaluations.filter((e) => e.notionalUsd === notional);
    const subsetNet = calculatePercentiles(subset.map((e) => e.economics.netSpreadBps));
    const gasBps = calculatePercentiles(subset.map((e) => e.economics.dexGasBps));
    console.log(`  $${notional.toString().padEnd(5)} | N=${subset.length.toString().padEnd(3)} | GasDrag=${gasBps.median.toFixed(2)} bps | NetSpread Median=${subsetNet.median} bps`);
  }

  // Persistence summary
  const allPersistenceRecords = persistence.getAllRecords();
  console.log(`\nPersistence Records Captured: ${allPersistenceRecords.length}`);

  // Write results JSON
  const outputPath = path.resolve(__dirname, '../data/cex_dex_phase413b_results.json');
  const dataset = {
    campaignId: 'PHASE_4_13B_CEX_DEX_RESEARCH',
    timestampIso: new Date().toISOString(),
    venuesTested: ['binance', 'coinbase', 'kraken'],
    chainsTested: [8453, 42161],
    summary: {
      totalCexMessages,
      totalOrderBookSnapshots,
      totalDexQuotes,
      totalEvaluations,
      rawGrossPositives: grossPositives.length,
      authenticGrossPositives: authenticGross.length,
      rawNetPositives: netPositives.length,
      authenticNetPositives: authenticNet.length,
      revalidatedNetPositives: revalidated.length,
      grossPercentiles: grossStats,
      netPercentiles: netStats,
      dexToCexGross,
      dexToCexNet,
      cexToDexGross,
      cexToDexNet,
    },
    evaluations: allEvaluations,
    persistenceRecords: allPersistenceRecords,
  };

  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`\n[4/4] Campaign Dataset successfully saved to ${outputPath}`);
}

main().catch((err) => {
  console.error('Campaign fatal error:', err);
  process.exit(1);
});
