/**
 * SAHIKARA Observer — SQLite Observation Store
 *
 * Storage engine: node:sqlite (Node.js built-in, v22.5.0+)
 *
 * WHY node:sqlite INSTEAD OF better-sqlite3:
 *   better-sqlite3 requires native C++ compilation via node-gyp.
 *   On Windows paths containing special characters (e.g., '&' in the project
 *   directory name), prebuild-install's shell invocation fails. node:sqlite is
 *   a first-party Node.js built-in with NO native compilation step, NO external
 *   dependencies, and an API nearly identical to better-sqlite3.
 *   [DEC-016] SQLite selected for Phase 1C storage.
 *
 * NODE VERSION REQUIREMENT: Node.js >= 22.5.0 (node:sqlite was added in v22.5.0)
 * User's Node.js version: v24.6.0 ✅
 *
 * NOTE: node:sqlite prints an ExperimentalWarning at startup in Node.js v22–v24.
 * This is expected behaviour and does not affect functionality.
 * Suppress with: NODE_NO_WARNINGS=1 npm run observe
 *
 * SCHEMA VERSION: 1 (Phase 1C)
 */

import { createRequire } from 'node:module';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
// node:sqlite is a Node.js built-in (>= v22.5.0).
// createRequire prevents Vite's ESM bundler from stripping the 'node:' prefix during test collection.
interface SqliteStatement {
  run(params?: Record<string, unknown> | unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};
import type { ProfitCalculation } from '../economics/profitCalculator.js';
import type { PoolObservation } from '../adapters/IPoolAdapter.js';
import type { GasPriceInfo } from '../data-sources/IDataSource.js';
import type { RoundTripEvaluation } from '../economics/roundTripEvaluator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Schema DDL
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_OBSERVATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS observations (
  observation_id         TEXT    PRIMARY KEY,
  timestamp_ms           INTEGER NOT NULL,
  block_number           TEXT    NOT NULL,
  chain                  TEXT    NOT NULL,
  dex                    TEXT    NOT NULL,
  protocol_version       TEXT    NOT NULL,
  pool_address           TEXT    NOT NULL,
  token0_address         TEXT    NOT NULL,
  token1_address         TEXT    NOT NULL,
  token0_symbol          TEXT    NOT NULL,
  token1_symbol          TEXT    NOT NULL,
  token0_decimals        INTEGER NOT NULL,
  token1_decimals        INTEGER NOT NULL,
  fee_tier_bps           REAL    NOT NULL,
  trade_size_usd         REAL    NOT NULL,
  trade_size_inr         REAL,
  input_amount_raw       TEXT,
  buy_quote_raw          TEXT,
  sell_quote_raw         TEXT,
  gross_spread_bps       REAL,
  pool_fee_bps           REAL,
  price_impact_bps       REAL,
  gas_units_estimate     INTEGER,
  gas_price_gwei         REAL,
  gas_cost_usd           REAL,
  gross_profit_usd       REAL,
  net_profit_before_buffer_usd REAL,
  net_expected_profit_usd      REAL,
  rpc_endpoint_id        TEXT    NOT NULL,
  rpc_latency_ms         INTEGER,
  status                 TEXT    NOT NULL,
  reason_if_rejected     TEXT,
  rejection_detail       TEXT,
  raw_quote_json         TEXT,
  created_at             INTEGER NOT NULL
);
`;

const CREATE_ROUND_TRIP_TABLE = `
CREATE TABLE IF NOT EXISTS round_trip_observations (
  observation_id         TEXT    PRIMARY KEY,
  timestamp_ms           INTEGER NOT NULL,
  block_number           TEXT    NOT NULL,
  route                  TEXT    NOT NULL,
  dex_leg1               TEXT    NOT NULL,
  dex_leg2               TEXT    NOT NULL,
  pool_leg1              TEXT    NOT NULL,
  pool_leg2              TEXT    NOT NULL,
  token_in               TEXT    NOT NULL,
  intermediate_token     TEXT    NOT NULL,
  token_out              TEXT    NOT NULL,
  amount_in              TEXT    NOT NULL,
  leg1_amount_out        TEXT    NOT NULL,
  leg2_amount_out        TEXT    NOT NULL,
  gross_profit           TEXT    NOT NULL,
  gross_profit_usd       REAL    NOT NULL,
  leg1_fee_bps           REAL    NOT NULL,
  leg2_fee_bps           REAL    NOT NULL,
  leg1_fee_amount        TEXT    NOT NULL,
  leg2_fee_amount        TEXT    NOT NULL,
  pool_fees              REAL    NOT NULL,
  gas_estimate           INTEGER NOT NULL,
  gas_cost               REAL    NOT NULL,
  net_expected_profit    REAL    NOT NULL,
  net_profit_bps         REAL    NOT NULL,
  price_impact           REAL    NOT NULL,
  latency                INTEGER NOT NULL,
  status                 TEXT    NOT NULL,
  rejection_reason       TEXT,
  rejection_detail       TEXT,
  created_at             INTEGER NOT NULL
);
`;

const CREATE_METADATA_TABLE = `
CREATE TABLE IF NOT EXISTS schema_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_obs_timestamp ON observations (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_obs_pool ON observations (pool_address, chain);
CREATE INDEX IF NOT EXISTS idx_obs_status ON observations (status);
CREATE INDEX IF NOT EXISTS idx_obs_block ON observations (block_number);
CREATE INDEX IF NOT EXISTS idx_rt_timestamp ON round_trip_observations (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_rt_route ON round_trip_observations (route);
CREATE INDEX IF NOT EXISTS idx_rt_status ON round_trip_observations (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rt_logical_pool_unique ON round_trip_observations (pool_leg1, pool_leg2, amount_in, block_number);
`;

const INSERT_ROUND_TRIP_SQL = `
INSERT OR IGNORE INTO round_trip_observations (
  observation_id, timestamp_ms, block_number, route,
  dex_leg1, dex_leg2, pool_leg1, pool_leg2,
  token_in, intermediate_token, token_out,
  amount_in, leg1_amount_out, leg2_amount_out,
  gross_profit, gross_profit_usd,
  leg1_fee_bps, leg2_fee_bps, leg1_fee_amount, leg2_fee_amount,
  pool_fees, gas_estimate, gas_cost, net_expected_profit, net_profit_bps,
  price_impact, latency, status, rejection_reason, rejection_detail, created_at
) VALUES (
  :observation_id, :timestamp_ms, :block_number, :route,
  :dex_leg1, :dex_leg2, :pool_leg1, :pool_leg2,
  :token_in, :intermediate_token, :token_out,
  :amount_in, :leg1_amount_out, :leg2_amount_out,
  :gross_profit, :gross_profit_usd,
  :leg1_fee_bps, :leg2_fee_bps, :leg1_fee_amount, :leg2_fee_amount,
  :pool_fees, :gas_estimate, :gas_cost, :net_expected_profit, :net_profit_bps,
  :price_impact, :latency, :status, :rejection_reason, :rejection_detail, :created_at
)
`;

const INSERT_SQL = `
INSERT OR IGNORE INTO observations (
  observation_id, timestamp_ms, block_number, chain, dex, protocol_version,
  pool_address, token0_address, token1_address,
  token0_symbol, token1_symbol, token0_decimals, token1_decimals, fee_tier_bps,
  trade_size_usd, trade_size_inr, input_amount_raw,
  buy_quote_raw, sell_quote_raw,
  gross_spread_bps, pool_fee_bps, price_impact_bps,
  gas_units_estimate, gas_price_gwei, gas_cost_usd,
  gross_profit_usd, net_profit_before_buffer_usd, net_expected_profit_usd,
  rpc_endpoint_id, rpc_latency_ms,
  status, reason_if_rejected, rejection_detail,
  raw_quote_json, created_at
) VALUES (
  :observation_id, :timestamp_ms, :block_number, :chain, :dex, :protocol_version,
  :pool_address, :token0_address, :token1_address,
  :token0_symbol, :token1_symbol, :token0_decimals, :token1_decimals, :fee_tier_bps,
  :trade_size_usd, :trade_size_inr, :input_amount_raw,
  :buy_quote_raw, :sell_quote_raw,
  :gross_spread_bps, :pool_fee_bps, :price_impact_bps,
  :gas_units_estimate, :gas_price_gwei, :gas_cost_usd,
  :gross_profit_usd, :net_profit_before_buffer_usd, :net_expected_profit_usd,
  :rpc_endpoint_id, :rpc_latency_ms,
  :status, :reason_if_rejected, :rejection_detail,
  :raw_quote_json, :created_at
)
`;

// ─────────────────────────────────────────────────────────────────────────────
// Record Type
// ─────────────────────────────────────────────────────────────────────────────

export interface ObservationRecord {
  observation: PoolObservation;
  profit: ProfitCalculation | null;
  tradeSizeUsd: number;
  inrUsdRate: number;
  gasPrice: GasPriceInfo;
  rpcEndpointId: string;
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export class ObservationStore {
  private readonly db: SqliteDatabase;
  private readonly insertStmt: SqliteStatement;
  private readonly insertRoundTripStmt: SqliteStatement;

  constructor(dbPath: string) {
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });

    // node:sqlite built-in — no native compilation required
    this.db = new DatabaseSync(dbPath);

    // WAL mode + NORMAL sync for better concurrent read performance
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');

    // Create schema
    this.db.exec(CREATE_OBSERVATIONS_TABLE);
    this.db.exec(CREATE_ROUND_TRIP_TABLE);
    this.db.exec(CREATE_METADATA_TABLE);
    this.db.exec(CREATE_INDEXES);

    // Safe non-destructive schema migration for round_trip_observations (Phase 1C.2.1 fee metadata)
    const newFeeColumns = [
      'ALTER TABLE round_trip_observations ADD COLUMN leg1_fee_bps REAL DEFAULT 0',
      'ALTER TABLE round_trip_observations ADD COLUMN leg2_fee_bps REAL DEFAULT 0',
      'ALTER TABLE round_trip_observations ADD COLUMN leg1_fee_amount TEXT DEFAULT "0"',
      'ALTER TABLE round_trip_observations ADD COLUMN leg2_fee_amount TEXT DEFAULT "0"',
    ];
    for (const sql of newFeeColumns) {
      try {
        this.db.exec(sql);
      } catch {
        // Column already exists in newly created table or migrated DB; ignore error
      }
    }

    // Record schema version
    this.db.prepare(
      `INSERT OR REPLACE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'schema_version', value: '2' });
    this.db.prepare(
      `INSERT OR IGNORE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'created_at', value: String(Date.now()) });

    this.insertStmt = this.db.prepare(INSERT_SQL);
    this.insertRoundTripStmt = this.db.prepare(INSERT_ROUND_TRIP_SQL);
  }

  insert(record: ObservationRecord): void {
    const { observation, profit, tradeSizeUsd, inrUsdRate, gasPrice, rpcEndpointId, errorMessage } = record;
    const pool = observation.pool;

    let status: string;
    let reasonIfRejected: string | null = null;
    let rejectionDetail: string | null = null;

    if (errorMessage !== null) {
      status = 'ERROR';
      reasonIfRejected = 'QUOTE_FAILED';
      rejectionDetail = errorMessage;
    } else if (profit !== null) {
      status = profit.status;
      reasonIfRejected = profit.rejectionReason;
      rejectionDetail = profit.rejectionDetail || null;
    } else {
      status = 'ERROR';
      reasonIfRejected = 'OTHER';
      rejectionDetail = 'Profit calculation produced no result.';
    }

    // Enforce: reason_if_rejected must be set when status = REJECTED
    if (status === 'REJECTED' && !reasonIfRejected) {
      reasonIfRejected = 'OTHER';
      rejectionDetail = 'Rejection reason not set — defaulted.';
    }

    const observationId = [
      pool.chain,
      pool.protocol,
      pool.poolAddress.toLowerCase(),
      tradeSizeUsd.toFixed(2),
      observation.blockNumber.toString(),
    ].join(':');

    this.insertStmt.run({
      observation_id: observationId,
      timestamp_ms: observation.timestamp,
      block_number: observation.blockNumber.toString(),
      chain: pool.chain,
      dex: pool.dex,
      protocol_version: pool.protocol,
      pool_address: pool.poolAddress.toLowerCase(),
      token0_address: pool.token0.address.toLowerCase(),
      token1_address: pool.token1.address.toLowerCase(),
      token0_symbol: pool.token0.symbol,
      token1_symbol: pool.token1.symbol,
      token0_decimals: pool.token0.decimals,
      token1_decimals: pool.token1.decimals,
      fee_tier_bps: pool.feeBps,
      trade_size_usd: tradeSizeUsd,
      trade_size_inr: tradeSizeUsd * inrUsdRate,
      input_amount_raw: observation.quote?.amountIn.toString() ?? null,
      buy_quote_raw: observation.quote?.amountOut.toString() ?? null,
      sell_quote_raw: null,
      gross_spread_bps: profit?.grossSpreadBps ?? null,
      pool_fee_bps: profit?.poolFeeBps ?? pool.feeBps,
      price_impact_bps: observation.quote?.priceImpactBps ?? null,
      gas_units_estimate: profit?.gasEstimate.gasUnits ?? null,
      gas_price_gwei: gasPrice.gasPriceGwei,
      gas_cost_usd: profit?.gasCostUsd ?? null,
      gross_profit_usd: profit?.grossProfitUsd ?? null,
      net_profit_before_buffer_usd: profit?.netProfitBeforeBufferUsd ?? null,
      net_expected_profit_usd: profit?.netExpectedProfitUsd ?? null,
      rpc_endpoint_id: rpcEndpointId,
      rpc_latency_ms: observation.rpcLatencyMs,
      status,
      reason_if_rejected: reasonIfRejected,
      rejection_detail: rejectionDetail,
      raw_quote_json: observation.rawQuoteJson,
      created_at: Date.now(),
    });
  }

  insertRoundTrip(evaluation: RoundTripEvaluation): void {
    // Logical identity: chain:routeId:pool1:pool2:size:blockNumber
    // Distinguishes distinct pools for the same pair/DEX and guarantees duplicate prevention.
    const observationId = [
      evaluation.chain,
      evaluation.routeId,
      evaluation.leg1.pool.poolAddress.toLowerCase(),
      evaluation.leg2.pool.poolAddress.toLowerCase(),
      evaluation.tradeSizeUsd.toFixed(2),
      evaluation.blockNumber.toString(),
    ].join(':');

    this.insertRoundTripStmt.run({
      observation_id: observationId,
      timestamp_ms: evaluation.timestamp,
      block_number: evaluation.blockNumber.toString(),
      route: evaluation.routeName,
      dex_leg1: evaluation.leg1.dex,
      dex_leg2: evaluation.leg2.dex,
      pool_leg1: evaluation.leg1.pool.poolAddress.toLowerCase(),
      pool_leg2: evaluation.leg2.pool.poolAddress.toLowerCase(),
      token_in: evaluation.baseToken.symbol,
      intermediate_token: evaluation.intermediateToken.symbol,
      token_out: evaluation.baseToken.symbol,
      amount_in: evaluation.initialAmount.toString(),
      leg1_amount_out: evaluation.leg1Output.toString(),
      leg2_amount_out: evaluation.leg2Output.toString(),
      gross_profit: evaluation.grossRoundTripDiff.toString(),
      gross_profit_usd: evaluation.grossProfitUsd,
      leg1_fee_bps: evaluation.leg1FeeBps,
      leg2_fee_bps: evaluation.leg2FeeBps,
      leg1_fee_amount: evaluation.leg1FeeAmount.toString(),
      leg2_fee_amount: evaluation.leg2FeeAmount.toString(),
      pool_fees: evaluation.poolFeesUsd,
      gas_estimate: evaluation.gasEstimate.gasUnits,
      gas_cost: evaluation.gasCostUsd,
      net_expected_profit: evaluation.netExpectedProfitUsd,
      net_profit_bps: evaluation.netProfitBps,
      price_impact: evaluation.maxPriceImpactBps,
      latency: evaluation.totalLatencyMs,
      status: evaluation.status,
      rejection_reason: evaluation.rejectionReason,
      rejection_detail: evaluation.rejectionDetail,
      created_at: Date.now(),
    });
  }

  getStats(): { total: number; candidates: number; rejected: number; errors: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'CANDIDATE' THEN 1 ELSE 0 END) as candidates,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors
      FROM observations
    `).get() as { total: number; candidates: number; rejected: number; errors: number };
    return row;
  }

  getRoundTripStats(): { total: number; candidates: number; rejected: number; errors: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'CANDIDATE' THEN 1 ELSE 0 END) as candidates,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors
      FROM round_trip_observations
    `).get() as { total: number; candidates: number; rejected: number; errors: number };
    return row;
  }

  getRecent(limit = 20): object[] {
    return this.db.prepare(
      `SELECT * FROM observations ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as object[];
  }

  getRecentRoundTrips(limit = 20): object[] {
    return this.db.prepare(
      `SELECT * FROM round_trip_observations ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as object[];
  }

  getHealth(): {
    lastOneWayBlock: string | null;
    lastOneWayTimestampMs: number | null;
    lastRoundTripBlock: string | null;
    lastRoundTripTimestampMs: number | null;
    oneWayTotal: number;
    roundTripTotal: number;
    candidates: number;
    rejected: number;
    historicalErrors: number;
    recentErrors: number;
  } {
    const lastOneWay = this.db.prepare(
      `SELECT block_number, timestamp_ms FROM observations ORDER BY timestamp_ms DESC LIMIT 1`
    ).get() as { block_number: string; timestamp_ms: number } | undefined;

    const lastRoundTrip = this.db.prepare(
      `SELECT block_number, timestamp_ms FROM round_trip_observations ORDER BY timestamp_ms DESC LIMIT 1`
    ).get() as { block_number: string; timestamp_ms: number } | undefined;

    const oneWayStats = this.getStats();
    const rtStats = this.getRoundTripStats();

    // Recent errors (within last 1 hour)
    const oneHourAgo = Date.now() - 3600 * 1000;
    const recentErrorsRow = this.db.prepare(
      `SELECT count(*) as count FROM observations WHERE status = 'ERROR' AND timestamp_ms > :oneHourAgo`
    ).get({ oneHourAgo }) as { count: number };

    const recentRtErrorsRow = this.db.prepare(
      `SELECT count(*) as count FROM round_trip_observations WHERE status = 'ERROR' AND timestamp_ms > :oneHourAgo`
    ).get({ oneHourAgo }) as { count: number };

    return {
      lastOneWayBlock: lastOneWay ? lastOneWay.block_number : null,
      lastOneWayTimestampMs: lastOneWay ? lastOneWay.timestamp_ms : null,
      lastRoundTripBlock: lastRoundTrip ? lastRoundTrip.block_number : null,
      lastRoundTripTimestampMs: lastRoundTrip ? lastRoundTrip.timestamp_ms : null,
      oneWayTotal: oneWayStats.total,
      roundTripTotal: rtStats.total,
      candidates: rtStats.candidates,
      rejected: rtStats.rejected,
      historicalErrors: rtStats.errors + oneWayStats.errors,
      recentErrors: recentErrorsRow.count + recentRtErrorsRow.count,
    };
  }

  /**
   * SQLite-safe online backup using VACUUM INTO.
   * Produces a transactionally consistent, isolated snapshot file even while WAL writes are active.
   *
   * @param destinationPath File path for the backup database
   */
  backupTo(destinationPath: string): void {
    mkdirSync(dirname(destinationPath), { recursive: true });
    // Normalize slashes for SQLite string literal
    const safePath = destinationPath.replace(/\\/g, '/');
    this.db.exec(`VACUUM INTO '${safePath}'`);
  }

  /**
   * Audit database for duplicate logical observations.
   * Logical identity:
   *   - One-way: (pool_address, trade_size_usd, block_number)
   *   - Round-trip: (route, amount_in, block_number)
   */
  checkDuplicateIntegrity(): {
    oneWayDuplicates: number;
    roundTripDuplicates: number;
    details: string[];
  } {
    const details: string[] = [];

    const obsDups = this.db.prepare(`
      SELECT pool_address, trade_size_usd, block_number, COUNT(*) as cnt
      FROM observations
      GROUP BY pool_address, trade_size_usd, block_number
      HAVING count(*) > 1
    `).all() as Array<{ pool_address: string; trade_size_usd: number; block_number: string; cnt: number }>;

    const rtDups = this.db.prepare(`
      SELECT pool_leg1, pool_leg2, amount_in, block_number, COUNT(*) as cnt
      FROM round_trip_observations
      GROUP BY pool_leg1, pool_leg2, amount_in, block_number
      HAVING count(*) > 1
    `).all() as Array<{ pool_leg1: string; pool_leg2: string; amount_in: string; block_number: string; cnt: number }>;

    for (const d of obsDups) {
      details.push(`OneWay duplicate: pool=${d.pool_address}, size=${d.trade_size_usd}, block=${d.block_number} (${d.cnt} occurrences)`);
    }
    for (const d of rtDups) {
      details.push(`RoundTrip duplicate: pool1=${d.pool_leg1}, pool2=${d.pool_leg2}, amountIn=${d.amount_in}, block=${d.block_number} (${d.cnt} occurrences)`);
    }

    return {
      oneWayDuplicates: obsDups.length,
      roundTripDuplicates: rtDups.length,
      details,
    };
  }

  close(): void {
    this.db.close();
  }
}
