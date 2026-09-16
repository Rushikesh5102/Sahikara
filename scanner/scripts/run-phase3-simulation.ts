/**
 * SAHIKARA Phase 3 — Controlled Simulation & Fee Modeling Experiment
 *
 * Runs a controlled, strictly read-only execution-grade simulation:
 * 1. Trade-size sweep & optimization ($1, $5, $10, $25, $50, $100, $250, $500)
 * 2. Gas price and consumption sensitivity matrix
 * 3. Latency drift and opportunity decay modeling
 * 4. Atomic execution & revert semantics demonstration
 * 5. Historical replay & era comparison (Polling-Era vs. Event-Driven-Era)
 * 6. Shadow paper execution ledger audit
 *
 * STRICT MODE: READ-ONLY RESEARCH (Zero transactions, Zero keys, Zero trading)
 */

import { config } from 'dotenv';
config();

import { RpcManager } from '../src/rpc/RpcManager.js';
import { ObservationStore } from '../src/storage/ObservationStore.js';
import { loadConfig } from '../src/config/config.js';
import { BASE_CHAIN_ID } from '../src/config/pairs.js';
import { ALL_POOLS } from '../src/config/pools.js';
import { RpcProvider } from '../src/rpc/RpcProvider.js';
import { UniswapV3Adapter } from '../src/adapters/UniswapV3Adapter.js';
import { AerodromeSlipstreamAdapter } from '../src/adapters/AerodromeSlipstreamAdapter.js';
import {
  GasSensitivityEngine,
  LatencyDriftModel,
  AtomicExecutionSimulator,
  TradeSizeOptimizer,
  ShadowExecutionEngine,
  HistoricalReplaySimulator,
} from '../src/simulator/index.js';

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 3 — Execution-Grade Simulator & Fee Modeling Validation');
  console.log(' Strict Mode: READ-ONLY RESEARCH (Zero transactions, Zero keys)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Initialize DB store
  const store = new ObservationStore('data/observations.db');

  // Initialize RPC manager
  const appConfig = loadConfig();
  const primaryProvider = new RpcProvider({
    id: appConfig.rpcEndpointId || 'base-primary',
    url: appConfig.baseRpcUrl,
    chainId: BASE_CHAIN_ID,
  });

  const rpcManager = new RpcManager({
    primaryProvider,
    maxRetries: 3,
  });

  const blockNumber = await rpcManager.getBlockNumber();
  const gasPriceRes = await rpcManager.getGasPrice();
  const gasPriceWei = gasPriceRes.gasPrice.baseFeePerGas > 0n
    ? gasPriceRes.gasPrice.baseFeePerGas
    : 50_000_000n; // 0.05 Gwei default if null
  const ethPriceUsd = 2500.0;
  const usdcPriceUsd = 1.0;

  console.log(`[Setup] Base Mainnet connected at block ${blockNumber.toString()}.`);
  console.log(`[Setup] Current gas price: ${(Number(gasPriceWei) * 1e-9).toFixed(4)} Gwei.\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Trade Size Sweep & Optimization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 1. Trade Size Sweep & Optimization ──────────────────────────────────');

  // We evaluate WETH/USDC across UniV3 (5 bps) and Aerodrome Slipstream (ts=50, 5 bps)
  const poolUniV3Def = ALL_POOLS.find(p => p.id === 'univ3-base-weth-usdc-500')!;
  const poolSlipstreamDef = ALL_POOLS.find(p => p.id === 'aero-slipstream-weth-usdc-50')!;

  const poolUniV3 = poolUniV3Def.poolAddress;
  const poolSlipstream = poolSlipstreamDef.poolAddress;

  const uniV3Adapter = new UniswapV3Adapter(rpcManager);
  const slipstreamAdapter = new AerodromeSlipstreamAdapter(rpcManager);

  // Micro quote reference ($1 USDC -> 1e6 wei)
  const microIn = 1_000_000n; // 1 USDC
  let microQuoteLeg1Out = 400_000_000_000_000n; // 0.0004 WETH
  let microQuoteLeg2Out = 999_500n; // 0.9995 USDC

  try {
    const uniQuote = await uniV3Adapter.getDirectionalQuote(
      poolUniV3Def,
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      1.0,
      microIn,
      blockNumber
    );
    if (uniQuote.quote) {
      microQuoteLeg1Out = uniQuote.quote.amountOut;
      const slipQuote = await slipstreamAdapter.getDirectionalQuote(
        poolSlipstreamDef,
        '0x4200000000000000000000000000000000000006', // WETH
        1.0,
        microQuoteLeg1Out,
        blockNumber
      );
      if (slipQuote.quote) {
        microQuoteLeg2Out = slipQuote.quote.amountOut;
      }
    }
  } catch (err: any) {
    console.log(`[Notice] Live quoter query fallback to analytical model: ${err.message}`);
  }

  const sweepResult = await TradeSizeOptimizer.optimizeTradeSize({
    routeId: 'usdc-weth-usdc-univ3-slipstream',
    routeName: 'Uniswap V3 (5 bps) -> Aerodrome Slipstream (5 bps)',
    chain: 'base',
    blockNumber,
    baseFeeWei: gasPriceWei,
    ethPriceUsd,
    baseTokenPriceUsd: usdcPriceUsd,
    baseTokenDecimals: 6,
    poolLeg1Address: poolUniV3,
    dexLeg1: 'uniswap-v3',
    leg1FeeBps: 5,
    poolLeg2Address: poolSlipstream,
    dexLeg2: 'aerodrome-slipstream',
    leg2FeeBps: 5,
    microQuoteLeg1Out,
    microQuoteLeg2Out,
    sweepSizesUsd: [1, 5, 10, 25, 50, 100, 250, 500],
    quoteFetcher: async (_sizeUsd: number, amountInWei: bigint) => {
      const start = Date.now();
      const q1 = await uniV3Adapter.getDirectionalQuote(
        poolUniV3Def,
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        1.0,
        amountInWei,
        blockNumber
      );
      if (!q1.quote) throw new Error('Leg 1 quote failed');
      const q2 = await slipstreamAdapter.getDirectionalQuote(
        poolSlipstreamDef,
        '0x4200000000000000000000000000000000000006',
        1.0,
        q1.quote.amountOut,
        blockNumber
      );
      if (!q2.quote) throw new Error('Leg 2 quote failed');
      return {
        leg1Out: q1.quote.amountOut,
        leg2Out: q2.quote.amountOut,
        latencyMs: Date.now() - start,
      };
    },
  });

  console.log(`Evaluated Route: ${sweepResult.routeName}`);
  console.log(`Dominant Bottleneck: ${sweepResult.dominantConstraint}`);
  console.log(`Optimal Trade Size: ${sweepResult.optimalSizeUsd ? `$${sweepResult.optimalSizeUsd}` : 'None'}`);
  console.log(`Summary: ${sweepResult.summary}\n`);

  console.log('  Size ($) | Gross Spread (bps) | Price Impact (bps) | Gas Cost ($) | Net PnL ($) | Status');
  console.log('  ---------|--------------------|--------------------|--------------|-------------|---------');
  for (const pt of sweepResult.testedSizes) {
    const statusStr = pt.reverted ? `REVERT (${pt.revertReason})` : (pt.isProfitable ? 'PROFITABLE' : 'NET_LOSS');
    console.log(
      `  $${String(pt.tradeSizeUsd).padEnd(7)}| ` +
      `${String(pt.grossSpreadBps).padStart(18)} | ` +
      `${String(pt.totalPriceImpactBps).padStart(18)} | ` +
      `$${pt.gasCostUsd.toFixed(4).padStart(11)} | ` +
      `$${pt.netPnLUsd.toFixed(4).padStart(10)} | ${statusStr}`
    );
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Gas Sensitivity Matrix
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 2. Gas Price & Gas Unit Sensitivity Matrix ──────────────────────────');
  const gasMatrix = GasSensitivityEngine.generateMatrix({
    routeId: 'usdc-weth-usdc',
    tradeSizeUsd: 100,
    grossProfitUsd: 0.40, // 40 bps gross spread on $100 trade
    riskBufferUsd: 0.10,  // 10 bps risk buffer
    ethPriceUsd,
    testedBaseFeesGwei: [0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0],
    testedGasUnits: [150_000n, 220_000n, 300_000n],
    priorityFeeGwei: 0.05,
  });

  console.log(`Evaluated Trade: $100 with $0.40 Gross Gain (40 bps), Risk Buffer: $0.10`);
  console.log(`Break-Even Base Fee: ${gasMatrix.breakEvenBaseFeeGwei?.toFixed(4) ?? 'N/A'} Gwei`);
  console.log(`Max Tolerable Gas Units: ${gasMatrix.maxTolerableGasUnits?.toString() ?? 'N/A'} units\n`);

  console.log('  Base Fee (Gwei) | Gas Units | Gas Cost ($) | Net PnL ($) | Net Margin (bps) | Pass Gate');
  console.log('  ----------------|-----------|--------------|-------------|------------------|----------');
  for (const pt of gasMatrix.points.slice(0, 9)) {
    console.log(
      `  ${pt.baseFeeGwei.toFixed(2).padStart(15)} | ` +
      `${pt.gasUnits.toString().padStart(9)} | ` +
      `$${pt.gasCostUsd.toFixed(4).padStart(11)} | ` +
      `$${pt.netPnLUsd.toFixed(4).padStart(10)} | ` +
      `${String(pt.netProfitBps).padStart(16)} | ` +
      `${pt.isProfitable ? '✅ PASS' : '❌ FAIL'}`
    );
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Latency Drift & Opportunity Decay Modeling
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 3. Latency & Opportunity Decay Modeling ─────────────────────────────');
  const latencyResult = LatencyDriftModel.evaluateLatencyDecay({
    routeId: 'weth-usdc-weth',
    initialGrossSpreadBps: 25.0, // 25 bps initial spread
    tradeSizeUsd: 100,
    gasCostUsd: 0.05,
    riskBufferUsd: 0.05,
    driftRateBpsPerSec: 3.5, // 3.5 bps/sec adverse drift
    testedLatenciesMs: [50, 150, 300, 500, 1000, 2000, 3000],
    minNetProfitUsd: 0.05,
  });

  console.log(`Initial Spread: 25.0 bps | Initial Net PnL: $${latencyResult.initialNetPnLUsd}`);
  console.log(`Spread Half-Life (t_1/2): ${latencyResult.halfLifeMs ? `${latencyResult.halfLifeMs} ms` : 'N/A'}`);
  console.log(`Max Viable Latency Cutoff: ${latencyResult.maxViableLatencyMs} ms\n`);

  console.log('  Latency (ms) | Adverse Drift (bps) | Residual Spread (bps) | Net PnL ($) | Opportunity State');
  console.log('  -------------|---------------------|-----------------------|-------------|------------------');
  for (const pt of latencyResult.points) {
    const stateStr = pt.survived ? '✅ SURVIVED' : `❌ DROPPED (${pt.dropReason})`;
    console.log(
      `  ${String(pt.latencyMs).padEnd(12)} | ` +
      `${pt.adverseDriftBps.toFixed(1).padStart(19)} | ` +
      `${pt.residualGrossSpreadBps.toFixed(1).padStart(21)} | ` +
      `$${pt.residualNetPnLUsd.toFixed(4).padStart(10)} | ${stateStr}`
    );
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Atomic Execution Revert Simulation [SYNTHETIC TEST FIXTURE]
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 4. Atomic Execution & Revert Semantics [SYNTHETIC TEST FIXTURE] ─────');
  console.log('[Notice] The following scenarios use synthetic test fixtures (35 bps artificial spread and 30 bps adverse slippage) to verify contract revert mechanics and paper ledger accounting.\n');

  // Scenario A: Clean profitable atomic execution (Synthetic test fixture)
  const cleanSim = AtomicExecutionSimulator.simulate({
    routeId: 'usdc-weth-usdc',
    routeName: 'UniV3 -> Aero Slipstream [SYNTHETIC]',
    chain: 'base',
    blockNumber,
    timestampMs: Date.now(),
    tradeSizeUsd: 100,
    initialAmount: 100_000_000n, // 100 USDC
    poolLeg1Address: poolUniV3,
    dexLeg1: 'uniswap-v3',
    leg1QuoteOutput: 40_000_000_000_000_000n, // 0.04 WETH
    leg1QuoterLatencyMs: 14,
    leg1FeeBps: 5,
    poolLeg2Address: poolSlipstream,
    dexLeg2: 'aerodrome-slipstream',
    leg2QuoteOutput: 100_350_000n, // 100.35 USDC (+35 bps gross spread - SYNTHETIC)
    leg2QuoterLatencyMs: 18,
    leg2FeeBps: 5,
    baseFeeWei: gasPriceWei,
    ethPriceUsd,
    baseTokenPriceUsd: 1.0,
    baseTokenDecimals: 6,
  });

  // Scenario B: Excess slippage on Leg 2 triggering atomic revert (Synthetic test fixture)
  const revertSim = AtomicExecutionSimulator.simulate({
    routeId: 'usdc-weth-usdc',
    routeName: 'UniV3 -> Aero Slipstream [SYNTHETIC]',
    chain: 'base',
    blockNumber,
    timestampMs: Date.now(),
    tradeSizeUsd: 100,
    initialAmount: 100_000_000n,
    poolLeg1Address: poolUniV3,
    dexLeg1: 'uniswap-v3',
    leg1QuoteOutput: 40_000_000_000_000_000n,
    leg1QuoterLatencyMs: 14,
    leg1FeeBps: 5,
    poolLeg2Address: poolSlipstream,
    dexLeg2: 'aerodrome-slipstream',
    leg2QuoteOutput: 100_350_000n,
    leg2QuoterLatencyMs: 18,
    leg2FeeBps: 5,
    baseFeeWei: gasPriceWei,
    ethPriceUsd,
    baseTokenPriceUsd: 1.0,
    baseTokenDecimals: 6,
    syntheticStressor: {
      adverseSlippageBpsLeg2: 30, // 30 bps slippage > 20 bps tolerance -> atomic revert
    },
  });

  console.log(`[Scenario A: Clean Execution (SYNTHETIC)] Reverted: ${cleanSim.simulated.reverted} | Net PnL: $${cleanSim.simulated.netPnLUsd} | Classification: ${cleanSim.classification}`);
  console.log(`[Scenario B: Adverse Slippage (SYNTHETIC)] Reverted: ${revertSim.simulated.reverted} | Reason: ${revertSim.simulated.revertReason} | Net PnL: $${revertSim.simulated.netPnLUsd} | Principal Capital Lost: $0.00 (Protected) | Gas Lost: $${revertSim.estimates.gasCostUsd}`);

  // Persist simulated execution records
  store.insertSimulatedExecution(cleanSim);
  store.insertSimulatedExecution(revertSim);
  console.log(`✅ Persisted simulation records to database (Total simulations: ${store.getSimulationCount()}).\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Historical Replay & Era Comparison
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 5. Historical Replay & Era Comparison ───────────────────────────────');
  const replayEngine = new HistoricalReplaySimulator(store);
  const replayReport = await replayEngine.replayHistoricalDataset(200, ethPriceUsd);

  console.log(`Total Records Replayed: ${replayReport.totalReplayed}`);
  console.log(`  - Polling-Era Observations:     ${replayReport.pollingEraObservations} (avg latency: ${replayReport.observationsByEra.pollingEra.avgLatencyMs} ms)`);
  console.log(`  - Event-Driven-Era Observations: ${replayReport.eventDrivenEraObservations} (avg latency: ${replayReport.observationsByEra.eventDrivenEra.avgLatencyMs} ms)`);
  console.log('\nFailure / Rejection Distribution across Replay:');
  for (const [key, count] of Object.entries(replayReport.failureDistribution)) {
    console.log(`  ${key.padEnd(28)}: ${count}`);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Shadow / Paper Execution Run [SYNTHETIC TEST VECTOR]
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 6. Shadow Paper Execution Ledger [SYNTHETIC TEST VECTOR] ────────────');
  console.log('[Notice] Shadow trade executed against synthetic test vector to verify balance accounting without live capital.\n');
  const shadowEngine = new ShadowExecutionEngine(100.0);

  // Execute paper trades over simulated candidates
  const shadowTradeA = shadowEngine.executeShadowTrade(cleanSim);
  if (shadowTradeA) store.insertShadowTrade(shadowTradeA);

  const shadowTradeB = shadowEngine.executeShadowTrade(revertSim);
  if (shadowTradeB) store.insertShadowTrade(shadowTradeB);

  const shadowState = shadowEngine.getAccountState();
  console.log(`Initial Cash Balance: $${shadowState.initialCapitalUsd.toFixed(2)}`);
  console.log(`Current Cash Balance: $${shadowState.currentCashBalanceUsd.toFixed(2)} [SYNTHETIC SIMULATION]`);
  console.log(`Realized PnL:         $${shadowState.realizedPnLUsd.toFixed(4)} [SYNTHETIC SIMULATION]`);
  console.log(`Total Gas Spent:      $${shadowState.totalGasSpentUsd.toFixed(4)}`);
  console.log(`Trades Attempted:     ${shadowState.tradesAttempted}`);
  console.log(`Trades Filled:        ${shadowState.tradesFilled}`);
  console.log(`Trades Reverted:      ${shadowState.tradesReverted}`);
  console.log(`Paper Win Rate:       ${shadowState.winRate.toFixed(1)}%`);
  console.log(`Total Shadow Trades Stored: ${store.getShadowTradeCount()}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Final Security Confirmation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(' Final Security Confirmation:');
  console.log(' SAHIKARA execution remains LOCKED.');
  console.log(' Zero transaction signing or live trading was introduced.');
  console.log(' Capital deployed: ₹0.00 / $0.00.');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  store.close();
}

main().catch((err) => {
  console.error('[CRITICAL] Simulation validation failed:', err);
  process.exit(1);
});
