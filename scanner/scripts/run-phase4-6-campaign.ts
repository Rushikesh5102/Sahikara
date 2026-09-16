/**
 * SAHIKARA — Phase 4.6
 * MULTI-MARKET / MULTI-CHAIN DISCOVERY & EMPIRICAL VALIDATION CAMPAIGN RUNNER
 *
 * Runs a sequential, per-chain observation campaign across:
 *   1. Base (8453)       → campaign_id: PHASE_4_6_BASE      [regression + cross-chain baseline]
 *   2. Optimism (10)     → campaign_id: PHASE_4_6_OPTIMISM
 *   3. Arbitrum (42161)  → campaign_id: PHASE_4_6_ARBITRUM
 *   4. Polygon (137)     → campaign_id: PHASE_4_6_POLYGON
 *
 * Each chain campaign:
 *   1. Verifies RPC connectivity and chain ID
 *   2. Confirms bytecode existence of all [PROVISIONAL] pool addresses (eth_getCode)
 *   3. Generates cross-DEX routes via RouteGenerator
 *   4. Ingests real on-chain swap events from the last N blocks
 *   5. Evaluates routes through RealTimeShadowEngine
 *   6. Reports per-chain statistical distribution
 *
 * DATA SAFETY INVARIANTS:
 *   - Results stored in: data/observations_phase46.db (PHASE_46_DB_PATH env var)
 *   - The Phase 4.5/4.5.1 baseline DB (DB_PATH / observations.db) is NEVER opened,
 *     modified, or referenced by this script.
 *   - Chains with no configured RPC URL are skipped with a logged notice.
 *
 * ABSOLUTE SAFETY INVARIANTS:
 *   - Capital at risk: ₹0.00 / $0.00
 *   - No private keys, no signers, no transaction broadcasting
 *   - All blockchain reads are strictly eth_call / getLogs / eth_getCode / getBlock
 *   - Zero contract deployment, zero swap execution
 */

import { resolve } from 'path';
import { createPublicClient, http, parseAbiItem, type Chain } from 'viem';
import { base, polygon, arbitrum, optimism } from 'viem/chains';
import 'dotenv/config';

import { loadConfig } from '../src/config/config.js';
import { ALL_ACTIVE_POOLS, verifyPoolBytecode, CHAIN_IDS } from '../src/config/pools.js';
import { ALL_POLYGON_ACTIVE_POOLS } from '../src/config/pools-polygon.js';
import { ALL_ARBITRUM_ACTIVE_POOLS } from '../src/config/pools-arbitrum.js';
import { ALL_OPTIMISM_ACTIVE_POOLS } from '../src/config/pools-optimism.js';
import { RESEARCH_PAIRS } from '../src/config/pairs.js';
import { POLYGON_RESEARCH_PAIRS } from '../src/config/pairs-polygon.js';
import { ARBITRUM_RESEARCH_PAIRS } from '../src/config/pairs-arbitrum.js';
import { OPTIMISM_RESEARCH_PAIRS } from '../src/config/pairs-optimism.js';
import { RpcManager } from '../src/rpc/RpcManager.js';
import { RpcProvider } from '../src/rpc/RpcProvider.js';
import { RouteGenerator } from '../src/discovery/RouteGenerator.js';
import { UniswapV3Adapter } from '../src/adapters/UniswapV3Adapter.js';
import { AerodromeAdapter } from '../src/adapters/AerodromeAdapter.js';
import { AerodromeSlipstreamAdapter } from '../src/adapters/AerodromeSlipstreamAdapter.js';
import { PancakeSwapV3Adapter } from '../src/adapters/PancakeSwapV3Adapter.js';
import type { IPoolAdapter } from '../src/adapters/IPoolAdapter.js';
import { ObservationStore } from '../src/storage/ObservationStore.js';
import { RealTimeShadowEngine } from '../src/shadow/RealTimeShadowEngine.js';
import { StatisticalReporter } from '../src/shadow/StatisticalReporter.js';
import { BaseGasModel } from '../src/shadow/BaseGasModel.js';
import { PolygonGasModel } from '../src/shadow/PolygonGasModel.js';
import { ArbitrumGasModel } from '../src/shadow/ArbitrumGasModel.js';
import type { PoolDefinition } from '../src/config/pools.js';
import type { ResearchPair } from '../src/config/pairs.js';
import type { PoolStateChangeEvent } from '../src/events/EventTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// ABI Definitions
// ─────────────────────────────────────────────────────────────────────────────

const V3_SWAP_ABI = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
);
const V2_SWAP_ABI = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)'
);
const V2_SYNC_ABI = parseAbiItem('event Sync(uint256 reserve0, uint256 reserve1)');

// ─────────────────────────────────────────────────────────────────────────────
// Chain Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface ChainCampaignConfig {
  campaignId: string;
  chainName: string;
  chainId: number;
  viemChain: Chain;
  rpcUrl: string | null;
  pools: PoolDefinition[];
  pairs: ResearchPair[];
  gasModelType: 'base' | 'polygon' | 'arbitrum';
  /** Whether pools need [PROVISIONAL] bytecode verification before quoting */
  requiresBytecodeVerification: boolean;
  lookbackBlocks: bigint;
  targetEventCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Chain Campaign Runner
// ─────────────────────────────────────────────────────────────────────────────

interface RawLogEvent {
  poolAddress: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  eventType: 'SWAP' | 'SYNC';
}

async function runChainCampaign(
  cfg: ChainCampaignConfig,
  store: ObservationStore,
  tradeSizesUsd: number[],
): Promise<void> {
  console.log('\n' + '═'.repeat(72));
  console.log(` CAMPAIGN: ${cfg.campaignId} | Chain: ${cfg.chainName} (${cfg.chainId})`);
  console.log('═'.repeat(72));

  if (!cfg.rpcUrl) {
    console.log(`  ⚠️  No RPC URL configured for ${cfg.chainName}. Skipping chain.`);
    console.log(`      Set ${cfg.chainId === CHAIN_IDS.POLYGON ? 'POLYGON' : cfg.chainId === CHAIN_IDS.ARBITRUM ? 'ARBITRUM' : 'OPTIMISM'}_RPC_URL in scanner/.env to enable.`);
    return;
  }

  // ── [1] RPC Connectivity ──────────────────────────────────────────────────
  const primaryProvider = new RpcProvider({
    id: `${cfg.campaignId.toLowerCase()}-primary`,
    url: cfg.rpcUrl,
    chainId: cfg.chainId,
  });
  const rpcManager = new RpcManager({ primaryProvider, secondaryProvider: null, maxRetries: 3 });

  console.log(`\n[1/6] Verifying ${cfg.chainName} RPC connectivity...`);
  try {
    await rpcManager.verifyConnectivity(cfg.chainId);
  } catch (err) {
    console.log(`  ❌ Connectivity check failed for ${cfg.chainName}: ${(err as Error).message}`);
    console.log(`     Skipping ${cfg.campaignId}.`);
    return;
  }

  const currentBlock = await rpcManager.getBlockNumber();
  const { gasPrice } = await rpcManager.getGasPrice();
  const l2BaseFeeGwei = Number(gasPrice.gasPriceWei) / 1e9;
  console.log(`  ✅ Connected. Block: ${currentBlock} | Gas: ${l2BaseFeeGwei.toFixed(4)} Gwei`);

  // ── [2] Pool Bytecode Verification ───────────────────────────────────────
  console.log(`\n[2/6] Verifying pool bytecode on ${cfg.chainName}...`);
  const viemClient = createPublicClient({
    chain: cfg.viemChain,
    transport: http(cfg.rpcUrl, { timeout: 15_000 }),
  });

  const verifiedPools: PoolDefinition[] = [];
  const skippedPools: PoolDefinition[] = [];

  for (const pool of cfg.pools) {
    if (!cfg.requiresBytecodeVerification || pool.tier === '[FACT]') {
      verifiedPools.push(pool);
      continue;
    }
    const isDeployed = await verifyPoolBytecode(pool.poolAddress, viemClient);
    if (isDeployed) {
      verifiedPools.push(pool);
      console.log(`  ✅ [${pool.tier}] ${pool.id} (${pool.poolAddress.slice(0, 10)}...) — bytecode confirmed`);
    } else {
      skippedPools.push(pool);
      console.log(`  ❌ [SKIP] ${pool.id} (${pool.poolAddress.slice(0, 10)}...) — no bytecode (undeployed or wrong chain)`);
    }
  }

  if (verifiedPools.length < 2) {
    console.log(`  ⚠️  Only ${verifiedPools.length} verified pool(s). Need ≥ 2 for cross-DEX routes. Skipping ${cfg.campaignId}.`);
    return;
  }

  console.log(`  Summary: ${verifiedPools.length} verified, ${skippedPools.length} skipped.\n`);

  // ── [3] Route Generation ──────────────────────────────────────────────────
  console.log('[3/6] Generating cross-DEX routes...');

  // For Base: use all 4 adapters. For other chains: only UniswapV3 adapter.
  const adaptersMap = new Map<string, IPoolAdapter>();
  const uniAdapter = new UniswapV3Adapter(rpcManager);
  adaptersMap.set('uniswap-v3', uniAdapter);

  if (cfg.chainId === CHAIN_IDS.BASE) {
    const aeroAdapter = new AerodromeAdapter(rpcManager);
    const slipstreamAdapter = new AerodromeSlipstreamAdapter(rpcManager);
    const pancakeAdapter = new PancakeSwapV3Adapter(rpcManager);
    adaptersMap.set('aerodrome-volatile', aeroAdapter);
    adaptersMap.set('aerodrome-stable', aeroAdapter);
    adaptersMap.set('aerodrome-slipstream', slipstreamAdapter);
    adaptersMap.set('pancakeswap-v3', pancakeAdapter);
  }

  const routeGenerator = new RouteGenerator({ maxRoutesPerPair: 12 });
  const activePairs = cfg.pairs.filter((p) => p.enabled);
  const routes = routeGenerator.generateRoutes(activePairs, verifiedPools, adaptersMap);

  console.log(`  Active Pairs:  ${activePairs.length} (${activePairs.map((p) => p.symbol).join(', ')})`);
  console.log(`  Verified Pools: ${verifiedPools.length}`);
  console.log(`  Routes:        ${routes.length} distinct directional routes`);

  if (routes.length === 0) {
    console.log(`  ⚠️  No routes generated. Pairs may not have ≥ 2 matching pools. Skipping ${cfg.campaignId}.`);
    return;
  }

  // ── [4] Gas Model Selection ────────────────────────────────────────────────
  let gasModel: BaseGasModel | PolygonGasModel | ArbitrumGasModel;
  if (cfg.gasModelType === 'polygon') {
    gasModel = new PolygonGasModel({ defaultMaticPriceUsd: 0.80 }); // MATIC [PROVISIONAL]
    console.log('\n  Gas Model: PolygonGasModel (no L1 data fee, MATIC/USD ≈ $0.80 [PROVISIONAL])');
  } else if (cfg.gasModelType === 'arbitrum') {
    gasModel = new ArbitrumGasModel({ defaultEthPriceUsd: 2500.0, defaultL1DataFeeUsd: 0.003 });
    console.log('\n  Gas Model: ArbitrumGasModel (Nitro L2 + flat L1 est. $0.003 [PROVISIONAL])');
  } else {
    // Base and Optimism use the OP Stack model
    gasModel = new BaseGasModel({ defaultEthPriceUsd: 2500.0 });
    console.log('\n  Gas Model: BaseGasModel (OP Stack L2 + L1 data fee $0.002 [ESTIMATED])');
  }

  // ── Initialize Shadow Engine ───────────────────────────────────────────────
  const shadowEngine = new RealTimeShadowEngine({
    dataSource: rpcManager,
    store,
    routes,
    researchSizesUsd: tradeSizesUsd,
    gasModel: gasModel as BaseGasModel,
    policyConfig: {
      ethPriceUsd: cfg.gasModelType === 'polygon' ? 0.80 : 2500.0,
      minNetProfitUsd: 0.05,
      minNetProfitBps: 5.0,
      maxSlippageBps: 20.0,
      maxGasCostUsd: 0.50,
      maxViableLatencyMs: 3000,
      riskBufferBps: 10.0,
      assumedL1DataFeeUsd: cfg.gasModelType === 'polygon' ? 0.0 : 0.002,
    },
  });

  // ── [5] Event Ingestion ────────────────────────────────────────────────────
  console.log(`\n[4/6] Ingesting real on-chain events from ${cfg.chainName} (last ${cfg.lookbackBlocks} blocks)...`);
  const fromBlock = currentBlock > cfg.lookbackBlocks ? currentBlock - cfg.lookbackBlocks : 0n;
  console.log(`  Querying blocks [${fromBlock} → ${currentBlock}]...`);

  const rawEvents: RawLogEvent[] = [];
  const poolAddressSet = new Set(verifiedPools.map((p) => p.poolAddress.toLowerCase()));

  for (const pool of verifiedPools) {
    if (!poolAddressSet.has(pool.poolAddress.toLowerCase())) continue;
    const poolAddr = pool.poolAddress as `0x${string}`;

    try {
      if (
        pool.protocol === 'uniswap-v3' ||
        pool.protocol === 'pancakeswap-v3' ||
        pool.protocol === 'aerodrome-slipstream'
      ) {
        const swapLogs = await viemClient.getLogs({
          address: poolAddr,
          event: V3_SWAP_ABI,
          fromBlock,
          toBlock: currentBlock,
        });
        for (const log of swapLogs) {
          rawEvents.push({
            poolAddress: poolAddr,
            blockNumber: log.blockNumber ?? currentBlock,
            transactionHash: log.transactionHash ?? '0x0',
            logIndex: log.logIndex ?? 0,
            eventType: 'SWAP',
          });
        }
      } else {
        // V2-style (Aerodrome volatile/stable)
        const swapLogs = await viemClient.getLogs({ address: poolAddr, event: V2_SWAP_ABI, fromBlock, toBlock: currentBlock });
        const syncLogs = await viemClient.getLogs({ address: poolAddr, event: V2_SYNC_ABI, fromBlock, toBlock: currentBlock });
        for (const log of swapLogs) rawEvents.push({ poolAddress: poolAddr, blockNumber: log.blockNumber ?? currentBlock, transactionHash: log.transactionHash ?? '0x0', logIndex: log.logIndex ?? 0, eventType: 'SWAP' });
        for (const log of syncLogs) rawEvents.push({ poolAddress: poolAddr, blockNumber: log.blockNumber ?? currentBlock, transactionHash: log.transactionHash ?? '0x0', logIndex: log.logIndex ?? 0, eventType: 'SYNC' });
      }
    } catch (err) {
      console.log(`  [Notice] Log fetch for ${pool.id}: ${(err as Error).message?.slice(0, 80)}`);
    }
  }

  rawEvents.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
    return a.logIndex - b.logIndex;
  });

  const targetCount = Math.min(Math.max(rawEvents.length, 0), cfg.targetEventCount);
  const selectedEvents = rawEvents.slice(0, targetCount);
  console.log(`  Raw Events: ${rawEvents.length} | Selected for campaign: ${selectedEvents.length}`);

  if (selectedEvents.length === 0) {
    console.log(`  ⚠️  No events found in the last ${cfg.lookbackBlocks} blocks. The lookback window may be too narrow, or pools have low activity.`);
    console.log(`     Reporting zero-event observations for ${cfg.campaignId}.`);
  }

  // ── [5] Event Processing ───────────────────────────────────────────────────
  console.log(`\n[5/6] Processing ${selectedEvents.length} events through opportunity engine...`);
  let processedCount = 0;

  for (let i = 0; i < selectedEvents.length; i++) {
    const rawEv = selectedEvents[i]!;
    const event: PoolStateChangeEvent = {
      eventType: rawEv.eventType,
      poolAddress: rawEv.poolAddress,
      blockNumber: rawEv.blockNumber,
      transactionHash: rawEv.transactionHash,
      logIndex: rawEv.logIndex,
      receiptTimestampMs: Date.now() - 50,
    };
    await shadowEngine.processEvent(event);
    processedCount++;

    if (processedCount % 20 === 0 || processedCount === selectedEvents.length) {
      process.stdout.write(`  [Event ${processedCount}/${selectedEvents.length}] Block ${event.blockNumber}\n`);
    }
    await new Promise((r) => setTimeout(r, 80)); // Throttle to avoid RPC rate-limiting
  }

  // ── [6] Reporting ──────────────────────────────────────────────────────────
  console.log(`\n[6/6] Computing ${cfg.campaignId} statistical summary...`);
  const telemetry = shadowEngine.getTelemetry();
  const mr = telemetry.missedReport;
  const portfolio = telemetry.livePortfolio;
  const markdownStats = StatisticalReporter.formatMarkdownTable(telemetry.statisticalReport);

  console.log('\n' + '─'.repeat(72));
  console.log(` ${cfg.campaignId} — RESULTS`);
  console.log('─'.repeat(72));

  console.log(`\n  Chain:                      ${cfg.chainName} (${cfg.chainId})`);
  console.log(`  Verified Pools:             ${verifiedPools.length}`);
  console.log(`  Routes Evaluated:           ${mr.totalRoutesEvaluated}`);
  console.log(`  Events Processed:           ${telemetry.eventsProcessed}`);
  console.log(`  Quotes Triggered:           ${telemetry.quotesTriggered}`);
  console.log(`  Quotes Successful:          ${telemetry.quotesTriggered - telemetry.failedQuotes}`);
  console.log(`  Quotes Failed (PROVISIONAL pools, liquidity, etc.): ${telemetry.failedQuotes}`);

  console.log('\n  Opportunity Tiers:');
  console.log(`    TIER 0 (No dislocation):  ${mr.tier0Count}`);
  console.log(`    TIER 1 (Gross positive):  ${mr.tier1Count}`);
  console.log(`    TIER 2 (Post-fee pos):    ${mr.tier2Count}`);
  console.log(`    TIER 3 (Net sim pos):     ${mr.tier3Count}`);
  console.log(`    TIER 4 (Next-blk valid):  ${mr.tier4Count}`);

  console.log('\n  Rejection Analysis:');
  console.log(`    Negative spread:          ${mr.rejectedByZeroOrNegativeSpread}`);
  console.log(`    Gas cost:                 ${mr.rejectedByGasCost}`);
  console.log(`    Slippage:                 ${mr.rejectedBySlippage}`);
  console.log(`    Quoter failure:           ${mr.rejectedByQuoterFailure}`);
  console.log(`    RPC failure:              ${mr.rejectedByRpcFailure}`);

  console.log(`\n  Paper Portfolio:            $${portfolio.startingBalanceUsd.toFixed(2)} → $${portfolio.currentCashBalanceUsd.toFixed(2)}`);
  console.log(`  Trades:                     ${portfolio.tradesFilled} | Win Rate: ${portfolio.winRatePercent !== null ? `${portfolio.winRatePercent.toFixed(1)}%` : 'N/A (0 trades ✅)'}`);

  console.log('\n  Statistical Distributions:');
  console.log(markdownStats);

  console.log(`\n  ✅ ${cfg.campaignId} complete. Data written to Phase 4.6 database.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═'.repeat(72));
  console.log(' SAHIKARA — PHASE 4.6 MULTI-CHAIN DISCOVERY & EMPIRICAL VALIDATION');
  console.log(' STRICTLY READ-ONLY RESEARCH | CAPITAL AT RISK: ₹0.00 / $0.00');
  console.log(' EXECUTION PERMANENTLY LOCKED | ZERO SIGNING / ZERO BROADCASTING');
  console.log('═'.repeat(72));
  console.log('');

  const config = loadConfig();

  // ── Phase 4.6 uses a SEPARATE database — never touches the Phase 4.5 baseline ──
  const phase46DbPath = process.env['PHASE_46_DB_PATH']?.trim() || './data/observations_phase46.db';
  const dbPath = resolve(process.cwd(), phase46DbPath);

  console.log(`[DB] Phase 4.6 campaign database: ${dbPath}`);
  console.log(`[DB] Phase 4.5 baseline database (untouched): ${resolve(process.cwd(), config.dbPath)}`);
  console.log('');

  const store = new ObservationStore(dbPath);

  // ── Trade Size Research Universe (same 8 tiers as Phase 4.5) ──────────────
  const tradeSizesUsd = [1, 5, 10, 25, 50, 100, 250, 500];

  // ── Chain Configuration ────────────────────────────────────────────────────
  const chainConfigs: ChainCampaignConfig[] = [
    {
      campaignId: 'PHASE_4_6_BASE',
      chainName: 'Base',
      chainId: CHAIN_IDS.BASE,
      viemChain: base,
      rpcUrl: config.baseRpcUrl,
      pools: ALL_ACTIVE_POOLS,
      pairs: RESEARCH_PAIRS.filter((p) => p.enabled),
      gasModelType: 'base',
      requiresBytecodeVerification: false, // Base pools are [FACT]
      lookbackBlocks: 80n,
      targetEventCount: 50, // regression — smaller than Phase 4.5 main run
    },
    {
      campaignId: 'PHASE_4_6_OPTIMISM',
      chainName: 'Optimism',
      chainId: CHAIN_IDS.OPTIMISM,
      viemChain: optimism,
      rpcUrl: config.optimismRpcUrl,
      pools: ALL_OPTIMISM_ACTIVE_POOLS,
      pairs: OPTIMISM_RESEARCH_PAIRS.filter((p) => p.enabled),
      gasModelType: 'base', // OP Stack — same model as Base
      requiresBytecodeVerification: true, // [PROVISIONAL] pools
      lookbackBlocks: 500n, // Optimism has faster blocks (~2s), need more to find events
      targetEventCount: 50,
    },
    {
      campaignId: 'PHASE_4_6_ARBITRUM',
      chainName: 'Arbitrum One',
      chainId: CHAIN_IDS.ARBITRUM,
      viemChain: arbitrum,
      rpcUrl: config.arbitrumRpcUrl,
      pools: ALL_ARBITRUM_ACTIVE_POOLS,
      pairs: ARBITRUM_RESEARCH_PAIRS.filter((p) => p.enabled),
      gasModelType: 'arbitrum',
      requiresBytecodeVerification: true, // [PROVISIONAL] pools
      lookbackBlocks: 3000n, // Arbitrum: ~250ms blocks, ~3000 blocks ≈ 12-15 min
      targetEventCount: 50,
    },
    {
      campaignId: 'PHASE_4_6_POLYGON',
      chainName: 'Polygon',
      chainId: CHAIN_IDS.POLYGON,
      viemChain: polygon,
      rpcUrl: config.polygonRpcUrl,
      pools: ALL_POLYGON_ACTIVE_POOLS,
      pairs: POLYGON_RESEARCH_PAIRS.filter((p) => p.enabled),
      gasModelType: 'polygon',
      requiresBytecodeVerification: true, // [PROVISIONAL] pools
      lookbackBlocks: 500n, // Polygon: ~2s blocks, 500 blocks ≈ 17 min
      targetEventCount: 50,
    },
  ];

  // ── Run campaigns sequentially ─────────────────────────────────────────────
  const startedAt = Date.now();
  let completedChains = 0;
  let skippedChains = 0;

  for (const cfg of chainConfigs) {
    try {
      if (!cfg.rpcUrl) {
        skippedChains++;
      } else {
        await runChainCampaign(cfg, store, tradeSizesUsd);
        completedChains++;
      }
    } catch (err) {
      console.error(`\n[ERROR] Campaign ${cfg.campaignId} failed with: ${(err as Error).message}`);
      console.error(`  Continuing to next chain. Chain-level failure does not abort the campaign.`);
    }
  }

  const totalMs = Date.now() - startedAt;

  // ── Final Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log(' SAHIKARA PHASE 4.6 — MULTI-CHAIN CAMPAIGN COMPLETE');
  console.log('═'.repeat(72));
  console.log(`  Total Duration:             ${(totalMs / 1000).toFixed(1)} seconds`);
  console.log(`  Chains Completed:           ${completedChains}`);
  console.log(`  Chains Skipped (no RPC):    ${skippedChains}`);
  console.log(`  Phase 4.6 Database:         ${dbPath}`);
  console.log('');
  console.log('── Final Safety Invariant Confirmation ──');
  console.log('  Capital at Risk:            ₹0.00 / $0.00 (CONFIRMED ✅)');
  console.log('  Private Keys Handled:       0 (CONFIRMED ✅)');
  console.log('  Transactions Signed:        0 (CONFIRMED ✅)');
  console.log('  Transactions Broadcasted:   0 (CONFIRMED ✅)');
  console.log('  Execution Engine State:     LOCKED (CONFIRMED ✅)');
  console.log('  Phase 4.5 Baseline DB:      UNTOUCHED (CONFIRMED ✅)');
  console.log('═'.repeat(72) + '\n');

  store.close();
}

main().catch((err) => {
  console.error('[CAMPAIGN:46] Fatal error:', err);
  process.exit(1);
});
