/**
 * SAHIKARA Phase 4.14 — High-Resolution WebSocket Microstructure & Volatility Campaign Runner
 *
 * MISSION:
 *   Conduct controlled observation of public CEX WebSocket order-book streams (Binance, Coinbase, Kraken)
 *   paired with live on-chain DEX quoter states (Base Uniswap V3) to determine whether materially larger
 *   gross price dislocations (> +0.35 bps) emerge at high temporal resolution or during elevated volatility.
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

import { CexWebSocketFeed } from '../src/cex/CexWebSocketFeed.js';
import { MicrostructureMetrics, OrderBookMicrostructure } from '../src/cex/MicrostructureMetrics.js';
import { VolatilityRegimeClassifier, VolatilityMetrics } from '../src/crossvenue/VolatilityRegimeClassifier.js';
import { HighResolutionPersistence } from '../src/crossvenue/HighResolutionPersistence.js';
import { CrossVenueOpportunityDetector, CrossVenueEvaluation } from '../src/crossvenue/CrossVenueOpportunityDetector.js';

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
    min: Number(sorted[0]!.toFixed(4)),
    p25: Number(getP(25).toFixed(4)),
    median: Number(getP(50).toFixed(4)),
    p75: Number(getP(75).toFixed(4)),
    p90: Number(getP(90).toFixed(4)),
    p95: Number(getP(95).toFixed(4)),
    p99: Number(getP(99).toFixed(4)),
    max: Number(sorted[sorted.length - 1]!.toFixed(4)),
    mean: Number(mean.toFixed(4)),
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.14 — WebSocket Microstructure Campaign');
  console.log(' Capital: ₹0.00 | Execution: LOCKED | Credentials: NONE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Setup Public RPC Client for Base
  const baseClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

  const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;
  const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
  const BASE_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

  // Initialize Public WebSocket Feeds
  console.log('[1/4] Initializing Public CEX WebSocket Streams...');
  const binanceFeed = new CexWebSocketFeed('binance', 'ETHUSDC');
  const coinbaseFeed = new CexWebSocketFeed('coinbase', 'ETH-USD');
  const krakenFeed = new CexWebSocketFeed('kraken', 'ETH/USDC');

  binanceFeed.connect();
  coinbaseFeed.connect();
  krakenFeed.connect();

  // Wait 3 seconds for initial snapshots
  await new Promise((r) => setTimeout(r, 3000));

  const feeds = [
    { feed: binanceFeed, name: 'Binance ETHUSDC', venue: 'binance' as const, symbol: 'ETHUSDC' },
    { feed: coinbaseFeed, name: 'Coinbase ETH-USD', venue: 'coinbase' as const, symbol: 'ETH-USD' },
    { feed: krakenFeed, name: 'Kraken ETH/USDC', venue: 'kraken' as const, symbol: 'ETH/USDC' },
  ];

  feeds.forEach((f) => {
    console.log(`  - ${f.name}: Connected=${f.feed.stats.connected}, Msgs=${f.feed.stats.messagesReceived}, Updates=${f.feed.stats.orderBookUpdates}`);
  });

  const volatilityClassifier = new VolatilityRegimeClassifier(10000);
  const persistenceTracker = new HighResolutionPersistence();
  const allEvaluations: CrossVenueEvaluation[] = [];
  const microstructureSnapshots: OrderBookMicrostructure[] = [];
  const volatilityRecords: VolatilityMetrics[] = [];

  let totalDexQuotes = 0;
  const CAMPAIGN_ROUNDS = 12;

  console.log(`\n[2/4] Executing High-Resolution Sampling across ${CAMPAIGN_ROUNDS} Rounds...`);

  for (let round = 1; round <= CAMPAIGN_ROUNDS; round++) {
    const tRoundMonotonic = performance.now();
    const tRoundWall = Date.now();

    // 1. Fetch current on-chain DEX quote
    let dexSellPrice = 0;
    let dexBuyPrice = 0;

    try {
      // Quote 1 WETH -> USDC
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
      dexSellPrice = Number(formatUnits(sellQuote[0], 6));
      totalDexQuotes++;

      // Quote 2500 USDC -> WETH
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
      dexBuyPrice = wethOut > 0 ? 2500 / wethOut : 0;
      totalDexQuotes++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  [Round ${round}] DEX quote error: ${msg}`);
      continue;
    }

    // 2. Evaluate against each live CEX WebSocket book
    for (const f of feeds) {
      const book = f.feed.book;
      const bestBid = book.getBestBid();
      const bestAsk = book.getBestAsk();

      if (!bestBid || !bestAsk || bestAsk.price <= bestBid.price) {
        continue;
      }

      // Record price in volatility classifier
      const mid = (bestBid.price + bestAsk.price) / 2;
      volatilityClassifier.recordPrice(mid, tRoundMonotonic);

      // Microstructure metrics
      const micro = MicrostructureMetrics.evaluateBook(book, 10);
      if (micro) {
        microstructureSnapshots.push(micro);
      }

      // Multi-size cross-venue evaluation
      const evals = CrossVenueOpportunityDetector.evaluateMatrix({
        pairId: 'WETH-USDC-BASE',
        cexVenue: f.venue,
        cexSymbol: f.symbol,
        targetChainId: 8453,
        book,
        dexExecutableBuyPrice: dexBuyPrice,
        dexExecutableSellPrice: dexSellPrice,
        dexDataTimestampWallClock: tRoundWall,
        dexGasUnits: 150000,
        gasPriceGwei: 0.05,
        ethPriceUsd: dexSellPrice,
        cexFeeRateBps: 10,
        riskBufferBps: 10,
      });

      evals.forEach((ev) => {
        allEvaluations.push(ev);

        // Record persistence
        persistenceTracker.recordObservation({
          pairId: ev.pairId,
          direction: ev.direction,
          grossEdgeBps: ev.economics.grossSpreadBps,
          monotonicMs: tRoundMonotonic,
        });
      });
    }

    const currentVol = volatilityClassifier.classifyCurrentRegime();
    volatilityRecords.push(currentVol);

    process.stdout.write(`  Round ${round}/${CAMPAIGN_ROUNDS} complete | VolRegime: ${currentVol.regime} (${currentVol.priceChangeRateBpsPerSec} bps/s) | Evals: ${allEvaluations.length}\r`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  // Disconnect WebSockets cleanly
  binanceFeed.disconnect();
  coinbaseFeed.disconnect();
  krakenFeed.disconnect();

  console.log(`\n\n[3/4] Synthesizing Results across ${allEvaluations.length} Cross-Venue Evaluations...`);

  const grossSpreads = allEvaluations.map((e) => e.economics.grossSpreadBps);
  const netSpreads = allEvaluations.map((e) => e.economics.netSpreadBps);

  const grossStats = calculatePercentiles(grossSpreads);
  const netStats = calculatePercentiles(netSpreads);

  const rawGrossPositives = allEvaluations.filter((e) => e.economics.isGrossPositive);
  const authenticGrossPositives = allEvaluations.filter((e) => e.validation.isAuthenticGross);
  const authenticNetPositives = allEvaluations.filter((e) => e.validation.isAuthenticNet);

  // Threshold counts
  const thresholds = [0, 0.5, 1, 2, 5, 10, 25, 50, 100];
  const thresholdCounts = thresholds.map((th) => ({
    thresholdBps: th,
    count: allEvaluations.filter((e) => e.economics.grossSpreadBps > th).length,
  }));

  // Fee sensitivity on gross positives
  const feeTiers = [10, 5, 2, 1, 0.5, 0];
  const feeSensitivityResults = feeTiers.map((fee) => {
    let positiveCount = 0;
    const netList: number[] = [];
    rawGrossPositives.forEach((cand) => {
      const gross = cand.economics.grossSpreadBps;
      const gas = cand.economics.dexGasBps;
      const risk = 10;
      const net = gross - fee - gas - risk;
      netList.push(net);
      if (net > 0) positiveCount++;
    });
    return {
      feeBps: fee,
      hypotheticalPositives: positiveCount,
      meanNetBps: netList.length > 0 ? Number((netList.reduce((a, b) => a + b, 0) / netList.length).toFixed(4)) : 0,
      range: netList.length > 0 ? [Number(Math.min(...netList).toFixed(4)), Number(Math.max(...netList).toFixed(4))] : [0, 0],
    };
  });

  // Microstructure summary
  const spreads = microstructureSnapshots.map((m) => m.spreadBps);
  const imbalances = microstructureSnapshots.map((m) => m.depthImbalance);
  const spreadStats = calculatePercentiles(spreads);
  const imbalanceStats = calculatePercentiles(imbalances);

  // Persistence summary
  const persistenceStats = persistenceTracker.getStats();

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(' PHASE 4.14 HIGH-RESOLUTION RESEARCH SUMMARY');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`WebSocket Messages:          Binance: ${binanceFeed.stats.messagesReceived}, Coinbase: ${coinbaseFeed.stats.messagesReceived}, Kraken: ${krakenFeed.stats.messagesReceived}`);
  console.log(`Order Book Updates:          Binance: ${binanceFeed.stats.orderBookUpdates}, Coinbase: ${coinbaseFeed.stats.orderBookUpdates}, Kraken: ${krakenFeed.stats.orderBookUpdates}`);
  console.log(`Sequence Gaps / Resyncs:     ${binanceFeed.stats.sequenceGaps + coinbaseFeed.stats.sequenceGaps + krakenFeed.stats.sequenceGaps}`);
  console.log(`DEX Quotes Executed:         ${totalDexQuotes}`);
  console.log(`Cross-Venue Evaluations:     ${allEvaluations.length}`);
  console.log(`Raw Gross Positives:         ${rawGrossPositives.length}`);
  console.log(`Authentic Gross Positives:   ${authenticGrossPositives.length}`);
  console.log(`Authentic Net Positives:     ${authenticNetPositives.length}`);
  console.log(`Historical Baseline Max:     +0.3506 bps (Phase 4.13B)`);
  console.log(`Phase 4.14 Max Gross Spread: ${grossStats.max > 0 ? `+${grossStats.max}` : grossStats.max} bps`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('Gross Spread Distribution (bps):');
  console.log(`  Min: ${grossStats.min} | P25: ${grossStats.p25} | Median: ${grossStats.median} | P75: ${grossStats.p75} | P95: ${grossStats.p95} | Max: ${grossStats.max} | Mean: ${grossStats.mean}`);
  console.log('Net Spread Distribution (bps):');
  console.log(`  Min: ${netStats.min} | P25: ${netStats.p25} | Median: ${netStats.median} | P75: ${netStats.p75} | P95: ${netStats.p95} | Max: ${netStats.max} | Mean: ${netStats.mean}`);
  console.log('Microstructure Spread (bps):');
  console.log(`  Median: ${spreadStats.median} bps | Min: ${spreadStats.min} bps | Max: ${spreadStats.max} bps`);
  console.log('Order Book Depth Imbalance:');
  console.log(`  Median: ${imbalanceStats.median} | Min: ${imbalanceStats.min} | Max: ${imbalanceStats.max}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  // Write canonical dataset
  const outputPath = path.resolve(__dirname, '../data/cex_dex_phase414_results.json');
  const dataset = {
    campaignId: 'PHASE_4_14_WEBSOCKET_MICROSTRUCTURE_RESEARCH',
    timestampIso: new Date().toISOString(),
    historicalBaselineMaxGrossBps: 0.3506,
    venues: [binanceFeed.stats, coinbaseFeed.stats, krakenFeed.stats],
    summary: {
      totalWsMessages: binanceFeed.stats.messagesReceived + coinbaseFeed.stats.messagesReceived + krakenFeed.stats.messagesReceived,
      totalOrderBookUpdates: binanceFeed.stats.orderBookUpdates + coinbaseFeed.stats.orderBookUpdates + krakenFeed.stats.orderBookUpdates,
      totalDexQuotes,
      totalEvaluations: allEvaluations.length,
      rawGrossPositives: rawGrossPositives.length,
      authenticGrossPositives: authenticGrossPositives.length,
      authenticNetPositives: authenticNetPositives.length,
      grossPercentiles: grossStats,
      netPercentiles: netStats,
      spreadPercentiles: spreadStats,
      imbalancePercentiles: imbalanceStats,
      thresholdCounts,
      feeSensitivity: feeSensitivityResults,
      persistence: persistenceStats,
    },
    evaluations: allEvaluations,
    microstructureSnapshots,
    volatilityRecords,
    persistenceRecords: persistenceTracker.getAllRecords(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`[4/4] Complete research dataset saved to ${outputPath}`);
}

main().catch((err) => {
  console.error('Fatal campaign error:', err);
  process.exit(1);
});
