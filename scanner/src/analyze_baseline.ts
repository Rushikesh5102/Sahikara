import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'path';
import { statSync, writeFileSync } from 'fs';
import { loadConfig } from './config/config.js';

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function runAnalysis(): void {
  const config = loadConfig();
  const dbPath = resolve(process.cwd(), config.dbPath);
  const db = new DatabaseSync(dbPath);

  console.log('--- DATABASE INTEGRITY ---');
  const integrity = db.prepare('PRAGMA integrity_check').all() as any[];
  console.log('PRAGMA integrity_check:', integrity);

  const quickCheck = db.prepare('PRAGMA quick_check').all() as any[];
  console.log('PRAGMA quick_check:', quickCheck);

  const dbSize = statSync(dbPath).size;
  console.log('Database size (bytes):', dbSize, `(${(dbSize / (1024 * 1024)).toFixed(2)} MB)`);

  console.log('\n--- OBSERVATION COUNTS ---');
  const obsCount = db.prepare('SELECT count(*) as total FROM observations').get() as any;
  const rtCount = db.prepare('SELECT count(*) as total FROM round_trip_observations').get() as any;
  console.log('One-way observations count:', obsCount.total);
  console.log('Round-trip observations count:', rtCount.total);

  console.log('\n--- TIMESTAMPS & DURATION ---');
  const rtTime = db.prepare(`
    SELECT
      min(timestamp_ms) as min_ts,
      max(timestamp_ms) as max_ts,
      min(CAST(block_number AS INTEGER)) as min_block,
      max(CAST(block_number AS INTEGER)) as max_block
    FROM round_trip_observations
  `).get() as any;

  const obsTime = db.prepare(`
    SELECT
      min(timestamp_ms) as min_ts,
      max(timestamp_ms) as max_ts,
      min(CAST(block_number AS INTEGER)) as min_block,
      max(CAST(block_number AS INTEGER)) as max_block
    FROM observations
  `).get() as any;

  console.log('Round-trip timestamps:', {
    min_ts: rtTime.min_ts,
    max_ts: rtTime.max_ts,
    start_iso: new Date(rtTime.min_ts).toISOString(),
    end_iso: new Date(rtTime.max_ts).toISOString(),
    start_ist: new Date(rtTime.min_ts + 5.5 * 3600 * 1000).toISOString().replace('Z', ' IST'),
    end_ist: new Date(rtTime.max_ts + 5.5 * 3600 * 1000).toISOString().replace('Z', ' IST'),
    duration_ms: rtTime.max_ts - rtTime.min_ts,
    duration_hours: ((rtTime.max_ts - rtTime.min_ts) / (1000 * 3600)).toFixed(4),
    min_block: rtTime.min_block,
    max_block: rtTime.max_block,
    block_span: rtTime.max_block - rtTime.min_block
  });

  console.log('One-way timestamps:', {
    min_ts: obsTime.min_ts,
    max_ts: obsTime.max_ts,
    start_iso: new Date(obsTime.min_ts).toISOString(),
    end_iso: new Date(obsTime.max_ts).toISOString(),
    duration_hours: ((obsTime.max_ts - obsTime.min_ts) / (1000 * 3600)).toFixed(4),
    min_block: obsTime.min_block,
    max_block: obsTime.max_block,
    block_span: obsTime.max_block - obsTime.min_block
  });

  console.log('\n--- STATUS BREAKDOWN ---');
  const rtStatus = db.prepare(`
    SELECT status, count(*) as count, count(*) * 100.0 / (SELECT count(*) FROM round_trip_observations) as pct
    FROM round_trip_observations GROUP BY status
  `).all();
  console.log('Round-trip status:', rtStatus);

  const obsStatus = db.prepare(`
    SELECT status, count(*) as count, count(*) * 100.0 / (SELECT count(*) FROM observations) as pct
    FROM observations GROUP BY status
  `).all();
  console.log('One-way status:', obsStatus);

  console.log('\n--- REJECTION REASONS ---');
  const rtRejections = db.prepare(`
    SELECT rejection_reason, count(*) as count, count(*) * 100.0 / (SELECT count(*) FROM round_trip_observations) as pct
    FROM round_trip_observations GROUP BY rejection_reason ORDER BY count DESC
  `).all();
  console.log('Round-trip rejection reasons:', rtRejections);

  const obsRejections = db.prepare(`
    SELECT reason_if_rejected, count(*) as count, count(*) * 100.0 / (SELECT count(*) FROM observations) as pct
    FROM observations GROUP BY reason_if_rejected ORDER BY count DESC
  `).all();
  console.log('One-way rejection reasons:', obsRejections);

  console.log('\n--- ROUND-TRIP ROUTES & SIZES ---');
  const rtRoutes = db.prepare(`
    SELECT route, count(*) as count FROM round_trip_observations GROUP BY route
  `).all();
  console.log('Round-trip routes:', rtRoutes);

  const rtSizes = db.prepare(`
    SELECT
      route,
      amount_in,
      count(*) as count
    FROM round_trip_observations
    GROUP BY route, amount_in
  `).all();
  console.log('Round-trip sizes breakdown:', rtSizes);

  // Analyze sizes by mapping amount_in or route
  // Trade sizes configured: $1, $5, $10
  // Let's inspect distinct amount_in
  const distinctAmounts = db.prepare(`
    SELECT DISTINCT route, amount_in FROM round_trip_observations
  `).all();
  console.log('Distinct route + amount_in:', distinctAmounts);

  console.log('\n--- GROSS & NET PROFIT STATS (ALL ROUND TRIPS) ---');
  const allRtRows = db.prepare(`
    SELECT
      gross_profit,
      gross_profit_usd,
      leg1_amount_out,
      leg2_amount_out,
      pool_fees,
      gas_cost,
      net_expected_profit,
      net_profit_bps,
      latency,
      price_impact,
      route,
      amount_in
    FROM round_trip_observations
  `).all() as any[];

  // Let's compute gross_profit_bps: (gross_profit_usd / trade_size_usd) * 10000
  // To get trade_size_usd accurately, we can deduce it from route and amount_in or calculate:
  // Note: let's inspect trade sizes
  const grossUsd = allRtRows.map(r => r.gross_profit_usd);
  const netUsd = allRtRows.map(r => r.net_expected_profit);
  const netBps = allRtRows.map(r => r.net_profit_bps);
  const poolFees = allRtRows.map(r => r.pool_fees);
  const gasCosts = allRtRows.map(r => r.gas_cost);
  const latencies = allRtRows.map(r => r.latency);

  console.log('Positive gross observations (gross_profit_usd > 0):', grossUsd.filter(v => v > 0).length);
  console.log('Zero gross observations (gross_profit_usd == 0):', grossUsd.filter(v => v === 0).length);
  console.log('Negative gross observations (gross_profit_usd < 0):', grossUsd.filter(v => v < 0).length);
  console.log('Positive net observations (net_expected_profit > 0):', netUsd.filter(v => v > 0).length);

  // Check raw gross profit (token diff) > 0
  const positiveGrossToken = db.prepare(`
    SELECT count(*) as count FROM round_trip_observations WHERE CAST(gross_profit AS REAL) > 0
  `).get() as any;
  console.log('Positive gross profit raw token count:', positiveGrossToken.count);

  console.log('\n--- SUMMARY METRICS (OVERALL ROUND TRIPS) ---');
  const calcDist = (arr: number[]) => ({
    min: Math.min(...arr),
    p25: percentile(arr, 25),
    median: percentile(arr, 50),
    mean: mean(arr),
    p75: percentile(arr, 75),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    max: Math.max(...arr)
  });

  console.log('Gross Profit USD:', calcDist(grossUsd));
  console.log('Net Profit USD:', calcDist(netUsd));
  console.log('Net Profit BPS:', calcDist(netBps));
  console.log('Pool Fees USD:', calcDist(poolFees));
  console.log('Gas Cost USD:', calcDist(gasCosts));
  console.log('Latency MS:', calcDist(latencies));

  console.log('\n--- BY ROUTE & SIZE BREAKDOWN ---');
  // Group by route and amount_in
  const groups: { [k: string]: any[] } = {};
  for (const r of allRtRows) {
    const key = `${r.route} | ${r.amount_in}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  for (const [key, rows] of Object.entries(groups)) {
    const gUsd = rows.map(r => r.gross_profit_usd);
    const nUsd = rows.map(r => r.net_expected_profit);
    const nBps = rows.map(r => r.net_profit_bps);
    const pFees = rows.map(r => r.pool_fees);
    const gCost = rows.map(r => r.gas_cost);
    const posGross = gUsd.filter(v => v > 0).length;

    console.log(`\nGroup: ${key} (N = ${rows.length})`);
    console.log(`  Positive Gross Count: ${posGross}`);
    console.log(`  Gross USD: min=${Math.min(...gUsd).toFixed(6)}, med=${percentile(gUsd, 50).toFixed(6)}, mean=${mean(gUsd).toFixed(6)}, max=${Math.max(...gUsd).toFixed(6)}`);
    console.log(`  Net USD:   min=${Math.min(...nUsd).toFixed(6)}, med=${percentile(nUsd, 50).toFixed(6)}, mean=${mean(nUsd).toFixed(6)}, max=${Math.max(...nUsd).toFixed(6)}`);
    console.log(`  Net BPS:   min=${Math.min(...nBps).toFixed(2)}, med=${percentile(nBps, 50).toFixed(2)}, mean=${mean(nBps).toFixed(2)}, max=${Math.max(...nBps).toFixed(2)}`);
    console.log(`  Pool Fees: mean=$${mean(pFees).toFixed(6)}`);
    console.log(`  Gas Cost:  mean=$${mean(gCost).toFixed(6)}`);
  }

  console.log('\n--- DUPLICATE AUDIT ---');
  const obsDups = db.prepare(`
    SELECT pool_address, trade_size_usd, block_number, COUNT(*) as cnt
    FROM observations
    GROUP BY pool_address, trade_size_usd, block_number
    HAVING count(*) > 1
  `).all();
  const rtDups = db.prepare(`
    SELECT route, amount_in, block_number, COUNT(*) as cnt
    FROM round_trip_observations
    GROUP BY route, amount_in, block_number
    HAVING count(*) > 1
  `).all();
  console.log('One-way logical duplicates:', obsDups.length);
  console.log('Round-trip logical duplicates:', rtDups.length);

  console.log('\n--- POLLING INTERVALS & BLOCK PROGRESSION ---');
  // Order by timestamp_ms
  const tsList = db.prepare(`
    SELECT timestamp_ms, CAST(block_number AS INTEGER) as block_num
    FROM (
      SELECT DISTINCT timestamp_ms, block_number FROM round_trip_observations
    )
    ORDER BY timestamp_ms ASC
  `).all() as Array<{ timestamp_ms: number; block_num: number }>;

  const intervalsSec: number[] = [];
  const blockDeltas: number[] = [];
  for (let i = 1; i < tsList.length; i++) {
    const diffSec = (tsList[i].timestamp_ms - tsList[i - 1].timestamp_ms) / 1000;
    const bDelta = tsList[i].block_num - tsList[i - 1].block_num;
    intervalsSec.push(diffSec);
    blockDeltas.push(bDelta);
  }

  console.log('Distinct polling rounds:', tsList.length);
  console.log('Interval between rounds (sec):', calcDist(intervalsSec));
  console.log('Block deltas between rounds:', calcDist(blockDeltas));

  console.log('\n--- ONE-WAY POOL DETAILS ---');
  const poolStats = db.prepare(`
    SELECT
      chain,
      dex,
      protocol_version,
      fee_tier_bps,
      trade_size_usd,
      count(*) as count,
      avg(gross_spread_bps) as avg_spread_bps,
      avg(price_impact_bps) as avg_impact_bps,
      avg(gas_price_gwei) as avg_gas_gwei,
      avg(gas_cost_usd) as avg_gas_usd,
      avg(rpc_latency_ms) as avg_rpc_lat
    FROM observations
    GROUP BY dex, trade_size_usd
  `).all();
  console.log('One-way pool stats:', poolStats);

  const errors = db.prepare(`
    SELECT status, reason_if_rejected, rejection_detail, count(*) as count
    FROM observations
    WHERE status = 'ERROR'
    GROUP BY reason_if_rejected, rejection_detail
  `).all();

  const rtErrors = db.prepare(`
    SELECT status, rejection_reason, rejection_detail, count(*) as count
    FROM round_trip_observations
    WHERE status = 'ERROR'
    GROUP BY rejection_reason, rejection_detail
  `).all();

  // Save summary object
  const summary = {
    integrityCheck: integrity,
    quickCheck,
    databaseSizeBytes: dbSize,
    databaseSizeMB: (dbSize / (1024 * 1024)).toFixed(2),
    counts: {
      oneWayTotal: obsCount.total,
      roundTripTotal: rtCount.total,
      candidates: rtStatus.find((s: any) => s.status === 'CANDIDATE')?.count ?? 0,
      rejected: rtStatus.find((s: any) => s.status === 'REJECTED')?.count ?? 0,
      errors: rtStatus.find((s: any) => s.status === 'ERROR')?.count ?? 0,
    },
    timestamps: {
      roundTrip: {
        minTimestampMs: rtTime.min_ts,
        maxTimestampMs: rtTime.max_ts,
        startIso: new Date(rtTime.min_ts).toISOString(),
        endIso: new Date(rtTime.max_ts).toISOString(),
        startIst: new Date(rtTime.min_ts + 5.5 * 3600 * 1000).toISOString().replace('Z', ' IST'),
        endIst: new Date(rtTime.max_ts + 5.5 * 3600 * 1000).toISOString().replace('Z', ' IST'),
        durationMs: rtTime.max_ts - rtTime.min_ts,
        durationSeconds: (rtTime.max_ts - rtTime.min_ts) / 1000,
        durationMinutes: (rtTime.max_ts - rtTime.min_ts) / (1000 * 60),
        durationHours: (rtTime.max_ts - rtTime.min_ts) / (1000 * 3600),
        minBlock: rtTime.min_block,
        maxBlock: rtTime.max_block,
        blockSpan: rtTime.max_block - rtTime.min_block,
      },
      oneWay: {
        minTimestampMs: obsTime.min_ts,
        maxTimestampMs: obsTime.max_ts,
        startIso: new Date(obsTime.min_ts).toISOString(),
        endIso: new Date(obsTime.max_ts).toISOString(),
        durationHours: (obsTime.max_ts - obsTime.min_ts) / (1000 * 3600),
        minBlock: obsTime.min_block,
        maxBlock: obsTime.max_block,
        blockSpan: obsTime.max_block - obsTime.min_block,
      }
    },
    statusBreakdown: {
      roundTrip: rtStatus,
      oneWay: obsStatus,
    },
    rejectionReasons: {
      roundTrip: rtRejections,
      oneWay: obsRejections,
    },
    routesAndSizes: {
      routes: rtRoutes,
      routeSizes: rtSizes,
    },
    profitDistributions: {
      allRoundTrips: {
        positiveGrossUsdCount: grossUsd.filter(v => v > 0).length,
        positiveGrossTokenCount: positiveGrossToken.count,
        positiveNetCount: netUsd.filter(v => v > 0).length,
        grossProfitUsd: calcDist(grossUsd),
        netExpectedProfitUsd: calcDist(netUsd),
        netProfitBps: calcDist(netBps),
        poolFeesUsd: calcDist(poolFees),
        gasCostUsd: calcDist(gasCosts),
        latencyMs: calcDist(latencies),
      },
      byGroup: {} as Record<string, any>,
    },
    duplicateAudit: {
      oneWayDuplicates: obsDups.length,
      roundTripDuplicates: rtDups.length,
    },
    pollingIntervals: {
      distinctRounds: tsList.length,
      intervalSeconds: calcDist(intervalsSec),
      blockDeltas: calcDist(blockDeltas),
    },
    poolStats,
    errorsAudit: {
      observationErrors: errors,
      roundTripErrors: rtErrors,
    }
  };

  // Populate byGroup
  for (const [key, rows] of Object.entries(groups)) {
    const gUsd = rows.map(r => r.gross_profit_usd);
    const nUsd = rows.map(r => r.net_expected_profit);
    const nBps = rows.map(r => r.net_profit_bps);
    const pFees = rows.map(r => r.pool_fees);
    const gCost = rows.map(r => r.gas_cost);
    const lat = rows.map(r => r.latency);

    // Compute gross bps from amount_in and leg2_amount_out
    const gBps = rows.map(r => {
      const inAmt = BigInt(r.amount_in);
      const outAmt = BigInt(r.leg2_amount_out);
      const diff = Number(outAmt - inAmt);
      return (diff / Number(inAmt)) * 10000;
    });

    summary.profitDistributions.byGroup[key] = {
      count: rows.length,
      positiveGrossCount: gUsd.filter(v => v > 0).length,
      grossUsd: calcDist(gUsd),
      grossBps: calcDist(gBps),
      netUsd: calcDist(nUsd),
      netBps: calcDist(nBps),
      poolFeesUsd: calcDist(pFees),
      gasCostUsd: calcDist(gCost),
      latencyMs: calcDist(lat),
    };
  }

  // Also compute overall gross bps
  const allGrossBps = allRtRows.map(r => {
    const inAmt = BigInt(r.amount_in);
    const outAmt = BigInt(r.leg2_amount_out);
    const diff = Number(outAmt - inAmt);
    return (diff / Number(inAmt)) * 10000;
  });
  (summary.profitDistributions.allRoundTrips as any).grossBps = calcDist(allGrossBps);

  const outPath = resolve(process.cwd(), 'baseline_summary.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\nSuccessfully wrote summary to ${outPath}`);

  db.close();
}

runAnalysis();
