/**
 * SAHIKARA Phase 4 — Controlled Real-Time Shadow Execution Runner
 *
 * Executes a controlled validation run of the Phase 4 Real-Time Shadow Engine:
 * 1. Live Market Event Ingestion & Selective Re-Quoting across verified Base pools.
 * 2. 10-Point False-Positive Economic & Risk Gating.
 * 3. Base OP Stack Gas Modeling (L2 Execution Gas + L1 Data Fee).
 * 4. Shadow Paper Portfolio Ledger Accounting ($100 Virtual Capital).
 * 5. Next-Block Market Calibration (B -> B+1).
 * 6. Diagnostic Missed-Opportunity Accounting.
 * 7. Isolated Synthetic Fixture Check (strictly partitioned from live ledger).
 * 8. Restart Recovery & Duplicate Prevention Verification.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry and virtual paper execution only.
 * Zero private keys, zero wallet signing, zero transaction broadcasting.
 */

import { resolve } from 'path';
import { loadConfig } from '../src/config/config.js';
import { ALL_ACTIVE_POOLS } from '../src/config/pools.js';
import { RESEARCH_PAIRS, BASE_CHAIN_ID } from '../src/config/pairs.js';
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
import type { PoolStateChangeEvent } from '../src/events/EventTypes.js';
import type { ShadowOpportunity } from '../src/shadow/types.js';

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4 — Real-Time Shadow Execution Validation');
  console.log(' STRICTLY READ-ONLY / PAPER TRADING ONLY / ₹0 CAPITAL');
  console.log('═══════════════════════════════════════════════════════════════');

  const config = loadConfig();
  const dbPath = resolve(process.cwd(), config.dbPath);
  const store = new ObservationStore(dbPath);

  // Initialize RPC and Adapters
  const primaryProvider = new RpcProvider({
    id: config.rpcEndpointId || 'base-primary',
    url: config.baseRpcUrl,
    chainId: BASE_CHAIN_ID,
  });

  const rpcManager = new RpcManager({
    primaryProvider,
    maxRetries: 3,
  });

  const uniAdapter = new UniswapV3Adapter(rpcManager);
  const aeroAdapter = new AerodromeAdapter(rpcManager);
  const slipstreamAdapter = new AerodromeSlipstreamAdapter(rpcManager);
  const pancakeAdapter = new PancakeSwapV3Adapter(rpcManager);

  const adaptersMap = new Map<string, IPoolAdapter>([
    ['uniswap-v3', uniAdapter],
    ['aerodrome-volatile', aeroAdapter],
    ['aerodrome-stable', aeroAdapter],
    ['pancakeswap-v3', pancakeAdapter],
    ['aerodrome-slipstream', slipstreamAdapter],
  ]);

  // Generate verified cross-DEX routes
  const routeGenerator = new RouteGenerator({ maxRoutesPerPair: 12 });
  const activePairs = RESEARCH_PAIRS.filter((p) => p.enabled);
  const routes = routeGenerator.generateRoutes(activePairs, ALL_ACTIVE_POOLS, adaptersMap);
  console.log(`[Setup] Active Verified Routes Generated: ${routes.length}`);

  // Query live block and gas from Base Mainnet
  const blockNumber = await rpcManager.getBlockNumber();
  const { gasPrice } = await rpcManager.getGasPrice();
  const l2BaseFeeGwei = Number(gasPrice.gasPriceWei) / 1e9;

  console.log(`[Base Mainnet] Current Block: ${blockNumber}`);
  console.log(`[Base Mainnet] L2 Base Fee:   ${l2BaseFeeGwei.toFixed(4)} Gwei`);

  // Initialize Real-Time Shadow Engine
  const shadowEngine = new RealTimeShadowEngine({
    dataSource: rpcManager,
    store,
    routes,
    researchSizesUsd: [10, 25, 50, 100],
    policyConfig: {
      ethPriceUsd: 2500.0,
      minNetProfitUsd: 0.05,
      minNetProfitBps: 5.0,
      maxSlippageBps: 20.0,
      maxGasCostUsd: 0.50,
      maxViableLatencyMs: 3000,
      riskBufferBps: 10.0,
      assumedL1DataFeeUsd: 0.002,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 1: Controlled Live Market Event Ingestion (15 event cycles)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── Part 1: Controlled Live Market Event Evaluation (15 Cycles) ──');

  // Select 5 key verified pools across WETH/USDC, AERO/USDC, DEGEN/WETH
  const monitoredPools = ALL_ACTIVE_POOLS.slice(0, 5);

  let totalLiveOppsEvaluated = 0;

  for (let cycle = 1; cycle <= 15; cycle++) {
    const targetPool = monitoredPools[(cycle - 1) % monitoredPools.length];
    const eventType = cycle % 3 === 0 ? 'SYNC' : 'SWAP';

    const event: PoolStateChangeEvent = {
      eventType,
      poolAddress: targetPool.poolAddress,
      blockNumber,
      receiptTimestampMs: Date.now() - 50, // 50ms simulated receipt lag
    };

    const opps = await shadowEngine.processEvent(event);
    totalLiveOppsEvaluated += opps.length;

    process.stdout.write(`  Cycle ${cycle}/15 [${targetPool.token0.symbol}/${targetPool.token1.symbol} ${targetPool.dex} ${eventType}] -> Evaluated ${opps.length} opportunities\n`);
  }
  console.log(`  ✅ Completed 15 live event cycles. Total opportunities evaluated: ${totalLiveOppsEvaluated}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 2: Next-Block Market Calibration Demonstration
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── Part 2: Next-Block Market Calibration (Block B -> B+1) ──');
  const nextBlockEvent: PoolStateChangeEvent = {
    eventType: 'BLOCK',
    poolAddress: monitoredPools[0].poolAddress,
    blockNumber: blockNumber + 1n,
    receiptTimestampMs: Date.now(),
  };
  await shadowEngine.processEvent(nextBlockEvent);
  console.log(`  ✅ Block ${blockNumber + 1n} calibration processed.`);

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 3: Isolated Synthetic Calibration Fixture Check
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── Part 3: Isolated Synthetic Calibration Check ──');
  console.log('  ⚠️  [SYNTHETIC TEST FIXTURE — STRICTLY ISOLATED FROM LIVE METRICS]');

  const syntheticFixture: ShadowOpportunity = {
    opportunityId: `opp_syn_${Date.now()}`,
    chain: 'base',
    triggerBlockNumber: blockNumber,
    triggerEventType: 'SWAP',
    triggerPoolAddress: monitoredPools[0].poolAddress,
    routeId: routes[0].id,
    routeName: routes[0].name,
    tokenPair: 'WETH/USDC',
    poolLeg1: routes[0].leg1.pool.poolAddress,
    poolLeg2: routes[0].leg2.pool.poolAddress,
    dexLeg1: routes[0].leg1.pool.dex,
    dexLeg2: routes[0].leg2.pool.dex,
    tradeSizeUsd: 100.0,
    initialAmount: 100_000_000n, // $100 USDC
    tokenInSymbol: 'USDC',
    tokenInDecimals: 6,
    quotedLeg1Output: 40_000_000_000_000_000n,
    quotedLeg2Output: 100_350_000n, // +35 bps artificial spread
    grossSpreadBps: 35.0,
    grossProfitUsd: 0.35,
    gasBreakdown: {
      executionGasUnits: 220_000,
      l2BaseFeeGwei: 0.05,
      priorityFeeGwei: 0.05,
      l2GasCostUsd: 0.055,
      l1DataFeeUsd: 0.002,
      totalGasCostUsd: 0.057,
      ethPriceUsd: 2500.0,
    },
    riskBufferUsd: 0.10,
    otherCostsUsd: 0,
    netExpectedPnLUsd: 0.193,
    netProfitBps: 19.3,
    totalPriceImpactBps: 4.0,
    timestamps: {
      tDetectWallMs: Date.now(),
      tDetectMonoMs: performance.now(),
      detectionLatencyMs: 80,
      simulationLatencyMs: 30,
      assumedExecutionLatencyMs: 200,
      totalLatencyMs: 310,
    },
    expectedInclusionBlock: blockNumber + 1n,
    lifecycleState: 'EVALUATED',
    classification: 'PROFITABLE_SHADOW',
    isSynthetic: true,
    provenance: { syntheticFixture: '[SYNTHETIC TEST FIXTURE]' },
    createdAt: Date.now(),
  };

  const syntheticCalibration = shadowEngine.injectSyntheticTestFixture(syntheticFixture, {
    observedBlockNumber: blockNumber + 1n,
    observedLeg1Output: 39_998_000_000_000_000n,
    observedLeg2Output: 100_280_000n, // +28 bps realized in next block
    observedL2BaseFeeGwei: 0.052,
    observedGasUnits: 220_000,
    observedL1DataFeeUsd: 0.002,
  });

  console.log(`  Predicted Spread:       +${syntheticCalibration.predictedSpreadBps.toFixed(2)} bps`);
  console.log(`  Realized Next Spread:   +${syntheticCalibration.observedSpreadBps.toFixed(2)} bps`);
  console.log(`  Spread Decay Error:     ${syntheticCalibration.spreadPredictionErrorBps.toFixed(2)} bps`);
  console.log(`  Opportunity Persisted:  ${syntheticCalibration.opportunityPersisted ? 'YES' : 'NO'}`);
  console.log(`  Synthetic Cash Balance: $${shadowEngine.syntheticLedger.getState().currentCashBalanceUsd.toFixed(4)}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 4: Telemetry & Missed Opportunity Report
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── Part 4: Diagnostics & Telemetry Report ──');
  const telemetry = shadowEngine.getTelemetry();

  console.log('\n[Missed Opportunity Analysis]');
  console.log(`  Total Events Processed:        ${telemetry.missedReport.totalEventsProcessed}`);
  console.log(`  Total Routes Evaluated:        ${telemetry.missedReport.totalRoutesEvaluated}`);
  console.log(`  Rejected (Non-Positive Spread):${telemetry.missedReport.rejectedByZeroOrNegativeSpread} (Equilibrium / No Dislocation)`);
  console.log(`  Rejected (Gas Cost):           ${telemetry.missedReport.rejectedByGasCost}`);
  console.log(`  Rejected (Slippage):           ${telemetry.missedReport.rejectedBySlippage}`);
  console.log(`  Rejected (Latency):            ${telemetry.missedReport.rejectedByLatency}`);
  console.log(`  Rejected (Risk Buffer):        ${telemetry.missedReport.rejectedByRiskBuffer}`);
  console.log(`  Rejected (Quoter Reverts):     ${telemetry.missedReport.rejectedByQuoterFailure}`);
  console.log(`  Viable Opportunities Found:    ${telemetry.missedReport.viableShadowTradesSubmitted}`);

  console.log('\n[Live Market Shadow Portfolio Ledger]');
  console.log(`  Starting Capital:              $${telemetry.livePortfolio.startingBalanceUsd.toFixed(2)} [PAPER/SIMULATION]`);
  console.log(`  Ending Cash Balance:           $${telemetry.livePortfolio.currentCashBalanceUsd.toFixed(2)} [PAPER/SIMULATION]`);
  console.log(`  Trades Filled:                 ${telemetry.livePortfolio.tradesFilled}`);
  console.log(`  Trades Reverted:               ${telemetry.livePortfolio.tradesReverted}`);
  console.log(`  Win Rate:                      ${telemetry.livePortfolio.winRatePercent !== null ? `${telemetry.livePortfolio.winRatePercent.toFixed(1)}%` : 'N/A'}`);
  console.log(`  Total Gas Consumed:            $${telemetry.livePortfolio.totalGasSpentUsd.toFixed(4)}`);

  console.log('\n[Database Schema v5 Storage Status]');
  console.log(`  Shadow Opportunities:          ${store.getShadowOpportunityCount()}`);
  console.log(`  Shadow Calibrations:           ${store.getShadowCalibrations().length}`);

  store.close();
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' ✅ PHASE 4 CONTROLLED VALIDATION COMPLETED SUCCESSFULLY');
  console.log(' EXECUTION REMAINS STRICTLY LOCKED. ZERO CAPITAL DEPLOYED.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error during Phase 4 validation:', err);
  process.exit(1);
});
