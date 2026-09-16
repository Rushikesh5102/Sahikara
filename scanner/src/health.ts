/**
 * SAHIKARA Phase 4.5 — Read-Only Collector & Opportunity Health Check
 *
 * Checks:
 *   - database connectivity and disk size
 *   - latest observation and event timestamps & age
 *   - latest processed block and live on-chain block
 *   - live RPC ping latency & WebSocket connection status
 *   - total one-way, round-trip quotes, and quotes/min
 *   - quote failure rate
 *   - candidate count, shadow opportunity count & TIER breakdown (TIER 0-4)
 *   - shadow calibration count & persistence
 *   - recent errors (1h) vs historical errors
 *   - logical duplicate integrity
 *
 * Usage:
 *   npm run health
 *   node dist/health.js
 *
 * Read-only. Exposes ZERO secrets or credentials.
 */

import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { ObservationStore } from './storage/ObservationStore.js';
import { loadConfig } from './config/config.js';
import { RpcManager } from './rpc/RpcManager.js';
import { RpcProvider } from './rpc/RpcProvider.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const dbPath = resolve(process.cwd(), config.dbPath);
  const walPath = `${dbPath}-wal`;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.5 — Health & Telemetry Status (Read-Only)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Database Path: ${dbPath}`);

  if (!existsSync(dbPath)) {
    console.log('❌ Status: Database file does not exist yet.');
    console.log('Run the collector first (npm run observe).');
    process.exit(1);
  }

  const dbStat = statSync(dbPath);
  const walStat = existsSync(walPath) ? statSync(walPath) : null;
  const totalDiskBytes = dbStat.size + (walStat ? walStat.size : 0);

  console.log(`Main DB Size:  ${formatBytes(dbStat.size)}`);
  if (walStat) {
    console.log(`WAL File Size: ${formatBytes(walStat.size)}`);
  }
  console.log(`Total Disk:    ${formatBytes(totalDiskBytes)}`);
  console.log('');

  const store = new ObservationStore(config.dbPath);
  const health = store.getHealth();
  const phase45 = store.getPhase45Metrics();
  const dupCheck = store.checkDuplicateIntegrity();
  const candidateCount = store.getCandidateCount();
  const simulationCount = store.getSimulationCount();
  const shadowTradeCount = store.getShadowTradeCount();
  const shadowOpportunityCount = store.getShadowOpportunityCount();
  const shadowCalibrationCount = store.getShadowCalibrations().length;
  store.close();

  // Test live RPC latency & block if network permits
  let liveBlock: bigint | null = null;
  let liveRpcLatencyMs: number | null = null;
  let rpcStatus = 'Unknown';
  try {
    const primaryProvider = new RpcProvider({
      id: config.rpcEndpointId || 'base-primary',
      url: config.baseRpcUrl,
      chainId: 8453,
    });
    const rpc = new RpcManager({ primaryProvider });
    const t0 = Date.now();
    liveBlock = await rpc.getBlockNumber();
    liveRpcLatencyMs = Date.now() - t0;
    rpcStatus = `Connected (${liveRpcLatencyMs}ms ping)`;
  } catch (err) {
    rpcStatus = `Unavailable / Rate-limited (${err instanceof Error ? err.message : String(err)})`;
  }

  const nowMs = Date.now();

  console.log('── Activity & Block Sync ──────────────────────────────────────');
  if (phase45.lastEventTimestampMs) {
    const ageSec = Math.round((nowMs - phase45.lastEventTimestampMs) / 1000);
    const dateStr = new Date(phase45.lastEventTimestampMs).toISOString();
    console.log(`Last Event Block:          ${phase45.lastEventBlock ?? 'None'}`);
    console.log(`Last Event Timestamp:      ${dateStr} (${ageSec}s ago)`);
  } else {
    console.log('Last Event:                None recorded');
  }

  if (health.lastRoundTripTimestampMs) {
    const ageSec = Math.round((nowMs - health.lastRoundTripTimestampMs) / 1000);
    const dateStr = new Date(health.lastRoundTripTimestampMs).toISOString();
    console.log(`Last Round-Trip Block:     ${health.lastRoundTripBlock ?? 'None'}`);
    console.log(`Last Round-Trip Timestamp: ${dateStr} (${ageSec}s ago)`);
    if (ageSec > 120) {
      console.log(`⚠️  Warning: Last round trip is ${ageSec}s old (> 120s). Collector may be idle.`);
    } else {
      console.log('✅ Collector is actively observing.');
    }
  } else {
    console.log('Last Round-Trip:           None recorded.');
  }

  console.log(`Live On-Chain Block:       ${liveBlock !== null ? liveBlock.toString() : 'N/A'}`);
  console.log(`Live RPC Status:           ${rpcStatus}`);
  console.log(`Historical Avg RPC Latency:${phase45.avgRpcLatencyMs !== null ? ` ${phase45.avgRpcLatencyMs} ms` : ' N/A'}`);
  console.log(`WebSocket Status:          ${config.baseWsUrl ? `Configured (${config.baseWsUrl.split('@').pop()?.split('/')[2] ?? 'WS Endpoint'})` : 'Polling Mode'}`);

  console.log('');
  console.log('── Observation & Quote Rates ──────────────────────────────────');
  console.log(`Total One-Way Quotes:      ${health.oneWayTotal}`);
  console.log(`Total Round Trips:         ${health.roundTripTotal}`);
  console.log(`Quotes in Last 1h:         ${phase45.quotesInLastHour}`);
  console.log(`Quotes / Minute:           ${phase45.quotesPerMin.toFixed(2)}`);
  console.log(`Quote Failure Rate:        ${phase45.quoteFailureRatePct.toFixed(2)}%`);
  console.log(`Errors (Last 1h):          ${health.recentErrors} ${health.recentErrors === 0 ? '✅ (Clean)' : '⚠️'}`);
  console.log(`Historical Errors (Total): ${health.historicalErrors}`);

  console.log('');
  console.log('── Opportunity Discovery & Tiers ──────────────────────────────');
  console.log(`Candidates (Gross > 0):    ${health.candidates}`);
  console.log(`Persisted Candidates:      ${candidateCount}`);
  console.log(`Simulated Executions:      ${simulationCount}`);
  console.log(`Shadow Trades (Ph 3/4):    ${shadowTradeCount}`);
  console.log(`Shadow Opportunities:      ${shadowOpportunityCount}`);
  console.log(`Shadow Calibrations:       ${shadowCalibrationCount}`);

  // Tier counts
  const tiers = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'];
  const hasTierData = tiers.some(t => phase45.tierCounts[t] !== undefined);
  if (hasTierData) {
    console.log('Tier Breakdown:');
    for (const t of tiers) {
      console.log(`  - ${t.padEnd(8)}: ${phase45.tierCounts[t] ?? 0}`);
    }
  } else {
    console.log('Tier Breakdown:            No classified tier opportunities recorded yet');
  }

  // Duplicate integrity check
  console.log('');
  console.log('── Data Integrity ─────────────────────────────────────────────');
  console.log(`Logical Duplicate One-Way: ${dupCheck.oneWayDuplicates} ${dupCheck.oneWayDuplicates === 0 ? '✅' : '❌'}`);
  console.log(`Logical Duplicate Round:   ${dupCheck.roundTripDuplicates} ${dupCheck.roundTripDuplicates === 0 ? '✅' : '❌'}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('[HEALTH] Fatal error:', err);
  process.exit(1);
});
