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

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ProfitCalculation } from '../economics/profitCalculator.js';
import type { PoolObservation } from '../adapters/IPoolAdapter.js';
import type { GasPriceInfo } from '../data-sources/IDataSource.js';

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
  private readonly db: DatabaseSync;
  private readonly insertStmt: StatementSync;

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
    this.db.exec(CREATE_METADATA_TABLE);
    this.db.exec(CREATE_INDEXES);

    // Record schema version
    this.db.prepare(
      `INSERT OR REPLACE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'schema_version', value: '1' });
    this.db.prepare(
      `INSERT OR IGNORE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'created_at', value: String(Date.now()) });

    this.insertStmt = this.db.prepare(INSERT_SQL);
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

  getRecent(limit = 20): object[] {
    return this.db.prepare(
      `SELECT * FROM observations ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as object[];
  }

  close(): void {
    this.db.close();
  }
}
