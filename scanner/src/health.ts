/**
 * SAHIKARA Phase 1D — Read-Only Collector Health Check
 *
 * Checks:
 *   - database connectivity
 *   - latest observation timestamp & age
 *   - latest block number
 *   - total one-way and round-trip observations
 *   - count of candidate, rejected, and error records
 *   - disk size of SQLite database file and WAL file
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function main(): void {
  const config = loadConfig();
  const dbPath = resolve(process.cwd(), config.dbPath);
  const walPath = `${dbPath}-wal`;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA — Collector Health & Storage Status (Read-Only)');
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
  const dupCheck = store.checkDuplicateIntegrity();
  store.close();

  const nowMs = Date.now();

  console.log('── Activity & Block Sync ──────────────────────────────────────');
  if (health.lastRoundTripTimestampMs) {
    const ageSec = Math.round((nowMs - health.lastRoundTripTimestampMs) / 1000);
    const dateStr = new Date(health.lastRoundTripTimestampMs).toISOString();
    console.log(`Last Round-Trip Block:     ${health.lastRoundTripBlock ?? 'None'}`);
    console.log(`Last Round-Trip Timestamp: ${dateStr} (${ageSec}s ago)`);
    if (ageSec > 120) {
      console.log(`⚠️  Warning: Last round trip is ${ageSec}s old (> 120s). Collector may be stopped.`);
    } else {
      console.log('✅ Collector is actively observing.');
    }
  } else {
    console.log('Last Round-Trip: None recorded.');
  }

  if (health.lastOneWayTimestampMs) {
    const ageSec = Math.round((nowMs - health.lastOneWayTimestampMs) / 1000);
    console.log(`Last One-Way Block:        ${health.lastOneWayBlock ?? 'None'}`);
    console.log(`Last One-Way Age:          ${ageSec}s ago`);
  }

  console.log('');
  console.log('── Observation Statistics ─────────────────────────────────────');
  console.log(`Total One-Way Quotes:          ${health.oneWayTotal}`);
  console.log(`Total Round Trips:             ${health.roundTripTotal}`);
  console.log(`Candidates (Gross > 0 & pass): ${health.candidates}`);
  console.log(`Rejected:                      ${health.rejected}`);
  console.log(`Errors (Last 1h):              ${health.recentErrors} ${health.recentErrors === 0 ? '✅ (Clean current run)' : '⚠️'}`);
  console.log(`Historical Errors (All time):  ${health.historicalErrors} [Pre-fix setup / rate-limits from Phase 1C]`);

  // Duplicate integrity check
  console.log('');
  console.log('── Data Integrity ─────────────────────────────────────────────');
  console.log(`Logical Duplicate One-Way:     ${dupCheck.oneWayDuplicates} ${dupCheck.oneWayDuplicates === 0 ? '✅' : '❌'}`);
  console.log(`Logical Duplicate Round-Trips: ${dupCheck.roundTripDuplicates} ${dupCheck.roundTripDuplicates === 0 ? '✅' : '❌'}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main();
