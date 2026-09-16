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
import type { CompleteSimulationResult, ShadowTradeRecord, AtomicRevertReason } from '../simulator/types.js';
import type { ShadowOpportunity, NextBlockCalibration } from '../shadow/types.js';

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

const CREATE_CANDIDATES_TABLE = `
CREATE TABLE IF NOT EXISTS opportunity_candidates (
  candidate_id           TEXT    PRIMARY KEY,
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
  gross_spread_bps       REAL    NOT NULL,
  gas_estimate           INTEGER NOT NULL,
  gas_cost_usd           REAL    NOT NULL,
  net_expected_profit_usd REAL   NOT NULL,
  net_profit_bps         REAL    NOT NULL,
  price_impact_bps       REAL    NOT NULL,
  detection_latency_ms   INTEGER NOT NULL,
  trigger_event_type     TEXT    NOT NULL,
  trigger_pool_address   TEXT    NOT NULL,
  raw_details_json       TEXT,
  created_at             INTEGER NOT NULL
);
`;

const CREATE_SIMULATED_EXECUTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS simulated_executions (
  simulation_id          TEXT    PRIMARY KEY,
  timestamp_ms           INTEGER NOT NULL,
  block_number           TEXT    NOT NULL,
  route_id               TEXT    NOT NULL,
  route_name             TEXT    NOT NULL,
  chain                  TEXT    NOT NULL,
  trade_size_usd         REAL    NOT NULL,
  initial_amount         TEXT    NOT NULL,
  leg1_simulated_output  TEXT    NOT NULL,
  leg2_simulated_output  TEXT    NOT NULL,
  final_amount_received  TEXT    NOT NULL,
  gross_profit_wei       TEXT    NOT NULL,
  gross_spread_bps       REAL    NOT NULL,
  total_price_impact_bps REAL    NOT NULL,
  gas_cost_usd           REAL    NOT NULL,
  net_pnl_usd            REAL    NOT NULL,
  net_profit_bps         REAL    NOT NULL,
  reverted               INTEGER NOT NULL,
  revert_reason          TEXT    NOT NULL,
  revert_detail          TEXT,
  classification         TEXT    NOT NULL,
  created_at             INTEGER NOT NULL
);
`;

const CREATE_SHADOW_TRADES_TABLE = `
CREATE TABLE IF NOT EXISTS shadow_trades (
  trade_id               TEXT    PRIMARY KEY,
  timestamp_ms           INTEGER NOT NULL,
  block_number           TEXT    NOT NULL,
  route_id               TEXT    NOT NULL,
  trade_size_usd         REAL    NOT NULL,
  gross_profit_usd       REAL    NOT NULL,
  gas_cost_usd           REAL    NOT NULL,
  net_pnl_usd            REAL    NOT NULL,
  reverted               INTEGER NOT NULL,
  revert_reason          TEXT    NOT NULL,
  resulting_balance_usd  REAL    NOT NULL,
  created_at             INTEGER NOT NULL
);
`;

const CREATE_SHADOW_OPPORTUNITIES_TABLE = `
CREATE TABLE IF NOT EXISTS shadow_opportunities (
  opportunity_id              TEXT    PRIMARY KEY,
  timestamp_ms                INTEGER NOT NULL,
  block_number                TEXT    NOT NULL,
  trigger_event_type          TEXT    NOT NULL,
  trigger_pool_address        TEXT    NOT NULL,
  route_id                    TEXT    NOT NULL,
  route_name                  TEXT    NOT NULL,
  token_pair                  TEXT    NOT NULL,
  pool_leg1                   TEXT    NOT NULL,
  pool_leg2                   TEXT    NOT NULL,
  dex_leg1                    TEXT    NOT NULL,
  dex_leg2                    TEXT    NOT NULL,
  trade_size_usd              REAL    NOT NULL,
  initial_amount              TEXT    NOT NULL,
  quoted_leg1_output          TEXT    NOT NULL,
  quoted_leg2_output          TEXT    NOT NULL,
  gross_spread_bps            REAL    NOT NULL,
  gross_profit_usd            REAL    NOT NULL,
  execution_gas_units         INTEGER NOT NULL,
  l2_base_fee_gwei            REAL    NOT NULL,
  priority_fee_gwei           REAL    NOT NULL,
  l2_gas_cost_usd             REAL    NOT NULL,
  l1_data_fee_usd             REAL    NOT NULL,
  total_gas_cost_usd          REAL    NOT NULL,
  risk_buffer_usd             REAL    NOT NULL,
  net_expected_profit_usd     REAL    NOT NULL,
  net_profit_bps              REAL    NOT NULL,
  price_impact_bps            REAL    NOT NULL,
  detection_latency_ms        INTEGER NOT NULL,
  simulation_latency_ms       INTEGER NOT NULL,
  assumed_latency_ms          INTEGER NOT NULL,
  total_latency_ms            INTEGER NOT NULL,
  expected_inclusion_block    TEXT    NOT NULL,
  lifecycle_state             TEXT    NOT NULL,
  classification              TEXT    NOT NULL,
  rejection_reason            TEXT,
  is_synthetic                INTEGER NOT NULL,
  provenance_json             TEXT    NOT NULL,
  created_at                  INTEGER NOT NULL
);
`;

const CREATE_SHADOW_CALIBRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS shadow_calibrations (
  calibration_id              TEXT    PRIMARY KEY,
  opportunity_id              TEXT    NOT NULL,
  predicted_block_number      TEXT    NOT NULL,
  observed_block_number       TEXT    NOT NULL,
  predicted_spread_bps        REAL    NOT NULL,
  predicted_gross_profit_usd  REAL    NOT NULL,
  predicted_gas_cost_usd      REAL    NOT NULL,
  predicted_net_pnl_usd       REAL    NOT NULL,
  observed_spread_bps         REAL    NOT NULL,
  observed_gross_profit_usd   REAL    NOT NULL,
  observed_gas_cost_usd       REAL    NOT NULL,
  observed_net_pnl_usd        REAL    NOT NULL,
  spread_prediction_error_bps REAL    NOT NULL,
  net_pnl_prediction_error_usd REAL   NOT NULL,
  gas_prediction_error_usd    REAL    NOT NULL,
  opportunity_persisted       INTEGER NOT NULL,
  observed_spread_decay_bps   REAL    NOT NULL,
  is_synthetic                INTEGER NOT NULL,
  calibration_timestamp_ms    INTEGER NOT NULL,
  notes                       TEXT,
  created_at                  INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_cand_timestamp ON opportunity_candidates (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_cand_block ON opportunity_candidates (block_number);
CREATE INDEX IF NOT EXISTS idx_cand_route ON opportunity_candidates (route);
CREATE INDEX IF NOT EXISTS idx_sim_timestamp ON simulated_executions (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_sim_block ON simulated_executions (block_number);
CREATE INDEX IF NOT EXISTS idx_sim_route ON simulated_executions (route_id);
CREATE INDEX IF NOT EXISTS idx_shadow_timestamp ON shadow_trades (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_shadow_opp_timestamp ON shadow_opportunities (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_shadow_opp_block ON shadow_opportunities (block_number);
CREATE INDEX IF NOT EXISTS idx_shadow_opp_route ON shadow_opportunities (route_id);
CREATE INDEX IF NOT EXISTS idx_shadow_opp_synthetic ON shadow_opportunities (is_synthetic);
CREATE INDEX IF NOT EXISTS idx_shadow_cal_opp ON shadow_calibrations (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_shadow_cal_block ON shadow_calibrations (observed_block_number);
`;

const INSERT_SIMULATED_EXECUTION_SQL = `
INSERT OR IGNORE INTO simulated_executions (
  simulation_id, timestamp_ms, block_number, route_id, route_name, chain,
  trade_size_usd, initial_amount, leg1_simulated_output, leg2_simulated_output,
  final_amount_received, gross_profit_wei, gross_spread_bps, total_price_impact_bps,
  gas_cost_usd, net_pnl_usd, net_profit_bps, reverted, revert_reason, revert_detail,
  classification, created_at
) VALUES (
  :simulation_id, :timestamp_ms, :block_number, :route_id, :route_name, :chain,
  :trade_size_usd, :initial_amount, :leg1_simulated_output, :leg2_simulated_output,
  :final_amount_received, :gross_profit_wei, :gross_spread_bps, :total_price_impact_bps,
  :gas_cost_usd, :net_pnl_usd, :net_profit_bps, :reverted, :revert_reason, :revert_detail,
  :classification, :created_at
)
`;

const INSERT_SHADOW_TRADE_SQL = `
INSERT OR IGNORE INTO shadow_trades (
  trade_id, timestamp_ms, block_number, route_id,
  trade_size_usd, gross_profit_usd, gas_cost_usd, net_pnl_usd,
  reverted, revert_reason, resulting_balance_usd, created_at
) VALUES (
  :trade_id, :timestamp_ms, :block_number, :route_id,
  :trade_size_usd, :gross_profit_usd, :gas_cost_usd, :net_pnl_usd,
  :reverted, :revert_reason, :resulting_balance_usd, :created_at
)
`;

const INSERT_SHADOW_OPPORTUNITY_SQL = `
INSERT OR IGNORE INTO shadow_opportunities (
  opportunity_id, timestamp_ms, block_number, trigger_event_type, trigger_pool_address,
  route_id, route_name, token_pair, pool_leg1, pool_leg2, dex_leg1, dex_leg2,
  trade_size_usd, initial_amount, quoted_leg1_output, quoted_leg2_output,
  gross_spread_bps, gross_profit_usd, execution_gas_units, l2_base_fee_gwei,
  priority_fee_gwei, l2_gas_cost_usd, l1_data_fee_usd, total_gas_cost_usd,
  risk_buffer_usd, net_expected_profit_usd, net_profit_bps, price_impact_bps,
  detection_latency_ms, simulation_latency_ms, assumed_latency_ms, total_latency_ms,
  expected_inclusion_block, lifecycle_state, classification, rejection_reason,
  is_synthetic, provenance_json, created_at
) VALUES (
  :opportunity_id, :timestamp_ms, :block_number, :trigger_event_type, :trigger_pool_address,
  :route_id, :route_name, :token_pair, :pool_leg1, :pool_leg2, :dex_leg1, :dex_leg2,
  :trade_size_usd, :initial_amount, :quoted_leg1_output, :quoted_leg2_output,
  :gross_spread_bps, :gross_profit_usd, :execution_gas_units, :l2_base_fee_gwei,
  :priority_fee_gwei, :l2_gas_cost_usd, :l1_data_fee_usd, :total_gas_cost_usd,
  :risk_buffer_usd, :net_expected_profit_usd, :net_profit_bps, :price_impact_bps,
  :detection_latency_ms, :simulation_latency_ms, :assumed_latency_ms, :total_latency_ms,
  :expected_inclusion_block, :lifecycle_state, :classification, :rejection_reason,
  :is_synthetic, :provenance_json, :created_at
)
`;

const INSERT_SHADOW_CALIBRATION_SQL = `
INSERT OR IGNORE INTO shadow_calibrations (
  calibration_id, opportunity_id, predicted_block_number, observed_block_number,
  predicted_spread_bps, predicted_gross_profit_usd, predicted_gas_cost_usd, predicted_net_pnl_usd,
  observed_spread_bps, observed_gross_profit_usd, observed_gas_cost_usd, observed_net_pnl_usd,
  spread_prediction_error_bps, net_pnl_prediction_error_usd, gas_prediction_error_usd,
  opportunity_persisted, observed_spread_decay_bps, is_synthetic, calibration_timestamp_ms,
  notes, created_at
) VALUES (
  :calibration_id, :opportunity_id, :predicted_block_number, :observed_block_number,
  :predicted_spread_bps, :predicted_gross_profit_usd, :predicted_gas_cost_usd, :predicted_net_pnl_usd,
  :observed_spread_bps, :observed_gross_profit_usd, :observed_gas_cost_usd, :observed_net_pnl_usd,
  :spread_prediction_error_bps, :net_pnl_prediction_error_usd, :gas_prediction_error_usd,
  :opportunity_persisted, :observed_spread_decay_bps, :is_synthetic, :calibration_timestamp_ms,
  :notes, :created_at
)
`;

const INSERT_CANDIDATE_SQL = `
INSERT OR IGNORE INTO opportunity_candidates (
  candidate_id, timestamp_ms, block_number, route,
  dex_leg1, dex_leg2, pool_leg1, pool_leg2,
  token_in, intermediate_token, token_out,
  amount_in, leg1_amount_out, leg2_amount_out,
  gross_profit, gross_profit_usd, gross_spread_bps,
  gas_estimate, gas_cost_usd, net_expected_profit_usd, net_profit_bps,
  price_impact_bps, detection_latency_ms, trigger_event_type, trigger_pool_address,
  raw_details_json, created_at
) VALUES (
  :candidate_id, :timestamp_ms, :block_number, :route,
  :dex_leg1, :dex_leg2, :pool_leg1, :pool_leg2,
  :token_in, :intermediate_token, :token_out,
  :amount_in, :leg1_amount_out, :leg2_amount_out,
  :gross_profit, :gross_profit_usd, :gross_spread_bps,
  :gas_estimate, :gas_cost_usd, :net_expected_profit_usd, :net_profit_bps,
  :price_impact_bps, :detection_latency_ms, :trigger_event_type, :trigger_pool_address,
  :raw_details_json, :created_at
)
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
// Record Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateRecord {
  candidateId: string;
  timestampMs: number;
  blockNumber: string;
  route: string;
  dexLeg1: string;
  dexLeg2: string;
  poolLeg1: string;
  poolLeg2: string;
  tokenIn: string;
  intermediateToken: string;
  tokenOut: string;
  amountIn: string;
  leg1AmountOut: string;
  leg2AmountOut: string;
  grossProfit: string;
  grossProfitUsd: number;
  grossSpreadBps: number;
  gasEstimate: number;
  gasCostUsd: number;
  netExpectedProfitUsd: number;
  netProfitBps: number;
  priceImpactBps: number;
  detectionLatencyMs: number;
  triggerEventType: string;
  triggerPoolAddress: string;
  rawDetailsJson?: string;
  createdAt?: number;
}

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
  private readonly insertCandidateStmt: SqliteStatement;
  private readonly insertSimExecutionStmt: SqliteStatement;
  private readonly insertShadowTradeStmt: SqliteStatement;
  private readonly insertShadowOppStmt: SqliteStatement;
  private readonly insertShadowCalStmt: SqliteStatement;

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
    this.db.exec(CREATE_CANDIDATES_TABLE);
    this.db.exec(CREATE_SIMULATED_EXECUTIONS_TABLE);
    this.db.exec(CREATE_SHADOW_TRADES_TABLE);
    this.db.exec(CREATE_SHADOW_OPPORTUNITIES_TABLE);
    this.db.exec(CREATE_SHADOW_CALIBRATIONS_TABLE);
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

    // Record schema version (v5 for Phase 4 Shadow Execution)
    this.db.prepare(
      `INSERT OR REPLACE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'schema_version', value: '5' });
    this.db.prepare(
      `INSERT OR IGNORE INTO schema_metadata (key, value) VALUES (:key, :value)`
    ).run({ key: 'created_at', value: String(Date.now()) });

    this.insertStmt = this.db.prepare(INSERT_SQL);
    this.insertRoundTripStmt = this.db.prepare(INSERT_ROUND_TRIP_SQL);
    this.insertCandidateStmt = this.db.prepare(INSERT_CANDIDATE_SQL);
    this.insertSimExecutionStmt = this.db.prepare(INSERT_SIMULATED_EXECUTION_SQL);
    this.insertShadowTradeStmt = this.db.prepare(INSERT_SHADOW_TRADE_SQL);
    this.insertShadowOppStmt = this.db.prepare(INSERT_SHADOW_OPPORTUNITY_SQL);
    this.insertShadowCalStmt = this.db.prepare(INSERT_SHADOW_CALIBRATION_SQL);
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

  insertCandidate(candidate: CandidateRecord): void {
    this.insertCandidateStmt.run({
      candidate_id: candidate.candidateId,
      timestamp_ms: candidate.timestampMs,
      block_number: candidate.blockNumber,
      route: candidate.route,
      dex_leg1: candidate.dexLeg1,
      dex_leg2: candidate.dexLeg2,
      pool_leg1: candidate.poolLeg1.toLowerCase(),
      pool_leg2: candidate.poolLeg2.toLowerCase(),
      token_in: candidate.tokenIn.toLowerCase(),
      intermediate_token: candidate.intermediateToken.toLowerCase(),
      token_out: candidate.tokenOut.toLowerCase(),
      amount_in: candidate.amountIn,
      leg1_amount_out: candidate.leg1AmountOut,
      leg2_amount_out: candidate.leg2AmountOut,
      gross_profit: candidate.grossProfit,
      gross_profit_usd: candidate.grossProfitUsd,
      gross_spread_bps: candidate.grossSpreadBps,
      gas_estimate: candidate.gasEstimate,
      gas_cost_usd: candidate.gasCostUsd,
      net_expected_profit_usd: candidate.netExpectedProfitUsd,
      net_profit_bps: candidate.netProfitBps,
      price_impact_bps: candidate.priceImpactBps,
      detection_latency_ms: candidate.detectionLatencyMs,
      trigger_event_type: candidate.triggerEventType,
      trigger_pool_address: candidate.triggerPoolAddress.toLowerCase(),
      raw_details_json: candidate.rawDetailsJson ?? null,
      created_at: candidate.createdAt ?? Date.now(),
    });
  }

  getCandidates(limit = 50): CandidateRecord[] {
    const rows = this.db.prepare(
      `SELECT * FROM opportunity_candidates ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      candidateId: String(r.candidate_id),
      timestampMs: Number(r.timestamp_ms),
      blockNumber: String(r.block_number),
      route: String(r.route),
      dexLeg1: String(r.dex_leg1),
      dexLeg2: String(r.dex_leg2),
      poolLeg1: String(r.pool_leg1),
      poolLeg2: String(r.pool_leg2),
      tokenIn: String(r.token_in),
      intermediateToken: String(r.intermediate_token),
      tokenOut: String(r.token_out),
      amountIn: String(r.amount_in),
      leg1AmountOut: String(r.leg1_amount_out),
      leg2AmountOut: String(r.leg2_amount_out),
      grossProfit: String(r.gross_profit),
      grossProfitUsd: Number(r.gross_profit_usd),
      grossSpreadBps: Number(r.gross_spread_bps),
      gasEstimate: Number(r.gas_estimate),
      gasCostUsd: Number(r.gas_cost_usd),
      netExpectedProfitUsd: Number(r.net_expected_profit_usd),
      netProfitBps: Number(r.net_profit_bps),
      priceImpactBps: Number(r.price_impact_bps),
      detectionLatencyMs: Number(r.detection_latency_ms),
      triggerEventType: String(r.trigger_event_type),
      triggerPoolAddress: String(r.trigger_pool_address),
      rawDetailsJson: r.raw_details_json ? String(r.raw_details_json) : undefined,
      createdAt: Number(r.created_at),
    }));
  }

  getCandidateCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM opportunity_candidates`).get() as { count: number };
    return row.count;
  }

  insertSimulatedExecution(sim: CompleteSimulationResult): void {
    this.insertSimExecutionStmt.run({
      simulation_id: sim.simulationId,
      timestamp_ms: sim.timestampMs,
      block_number: sim.observed.blockNumber.toString(),
      route_id: sim.routeId,
      route_name: sim.routeName,
      chain: sim.chain,
      trade_size_usd: sim.tradeSizeUsd,
      initial_amount: sim.initialAmount.toString(),
      leg1_simulated_output: sim.simulated.leg1SimulatedOutput.toString(),
      leg2_simulated_output: sim.simulated.leg2SimulatedOutput.toString(),
      final_amount_received: sim.simulated.finalAmountReceived.toString(),
      gross_profit_wei: sim.simulated.grossProfitWei.toString(),
      gross_spread_bps: sim.simulated.grossSpreadBps,
      total_price_impact_bps: sim.simulated.totalPriceImpactBps,
      gas_cost_usd: sim.estimates.gasCostUsd,
      net_pnl_usd: sim.simulated.netPnLUsd,
      net_profit_bps: sim.simulated.netProfitBps,
      reverted: sim.simulated.reverted ? 1 : 0,
      revert_reason: sim.simulated.revertReason,
      revert_detail: sim.simulated.revertDetail ?? null,
      classification: sim.classification,
      created_at: Date.now(),
    });
  }

  insertShadowTrade(trade: ShadowTradeRecord): void {
    this.insertShadowTradeStmt.run({
      trade_id: trade.tradeId,
      timestamp_ms: trade.timestampMs,
      block_number: trade.blockNumber.toString(),
      route_id: trade.routeId,
      trade_size_usd: trade.tradeSizeUsd,
      gross_profit_usd: trade.grossProfitUsd,
      gas_cost_usd: trade.gasCostUsd,
      net_pnl_usd: trade.netPnLUsd,
      reverted: trade.reverted ? 1 : 0,
      revert_reason: trade.revertReason,
      resulting_balance_usd: trade.resultingBalanceUsd,
      created_at: Date.now(),
    });
  }

  getSimulatedExecutions(limit = 50): Array<Record<string, unknown>> {
    return this.db.prepare(
      `SELECT * FROM simulated_executions ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as Array<Record<string, unknown>>;
  }

  getShadowTrades(limit = 50): ShadowTradeRecord[] {
    const rows = this.db.prepare(
      `SELECT * FROM shadow_trades ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      tradeId: String(r.trade_id),
      timestampMs: Number(r.timestamp_ms),
      blockNumber: BigInt(String(r.block_number)),
      routeId: String(r.route_id),
      tradeSizeUsd: Number(r.trade_size_usd),
      grossProfitUsd: Number(r.gross_profit_usd),
      gasCostUsd: Number(r.gas_cost_usd),
      netPnLUsd: Number(r.net_pnl_usd),
      reverted: Number(r.reverted) === 1,
      revertReason: String(r.revert_reason) as AtomicRevertReason,
      resultingBalanceUsd: Number(r.resulting_balance_usd),
    }));
  }

  getSimulationCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM simulated_executions`).get() as { count: number };
    return row.count;
  }

  getShadowTradeCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM shadow_trades`).get() as { count: number };
    return row.count;
  }

  insertShadowOpportunity(opp: ShadowOpportunity): void {
    this.insertShadowOppStmt.run({
      opportunity_id: opp.opportunityId,
      timestamp_ms: opp.timestamps.tDetectWallMs,
      block_number: opp.triggerBlockNumber.toString(),
      trigger_event_type: opp.triggerEventType,
      trigger_pool_address: opp.triggerPoolAddress,
      route_id: opp.routeId,
      route_name: opp.routeName,
      token_pair: opp.tokenPair,
      pool_leg1: opp.poolLeg1,
      pool_leg2: opp.poolLeg2,
      dex_leg1: opp.dexLeg1,
      dex_leg2: opp.dexLeg2,
      trade_size_usd: opp.tradeSizeUsd,
      initial_amount: opp.initialAmount.toString(),
      quoted_leg1_output: opp.quotedLeg1Output.toString(),
      quoted_leg2_output: opp.quotedLeg2Output.toString(),
      gross_spread_bps: opp.grossSpreadBps,
      gross_profit_usd: opp.grossProfitUsd,
      execution_gas_units: opp.gasBreakdown.executionGasUnits,
      l2_base_fee_gwei: opp.gasBreakdown.l2BaseFeeGwei,
      priority_fee_gwei: opp.gasBreakdown.priorityFeeGwei,
      l2_gas_cost_usd: opp.gasBreakdown.l2GasCostUsd,
      l1_data_fee_usd: opp.gasBreakdown.l1DataFeeUsd,
      total_gas_cost_usd: opp.gasBreakdown.totalGasCostUsd,
      risk_buffer_usd: opp.riskBufferUsd,
      net_expected_profit_usd: opp.netExpectedPnLUsd,
      net_profit_bps: opp.netProfitBps,
      price_impact_bps: opp.totalPriceImpactBps,
      detection_latency_ms: opp.timestamps.detectionLatencyMs,
      simulation_latency_ms: opp.timestamps.simulationLatencyMs,
      assumed_latency_ms: opp.timestamps.assumedExecutionLatencyMs,
      total_latency_ms: opp.timestamps.totalLatencyMs,
      expected_inclusion_block: opp.expectedInclusionBlock.toString(),
      lifecycle_state: opp.lifecycleState,
      classification: opp.classification,
      rejection_reason: opp.rejectionReason ?? null,
      is_synthetic: opp.isSynthetic ? 1 : 0,
      provenance_json: JSON.stringify(opp.provenance),
      created_at: Date.now(),
    });
  }

  insertShadowCalibration(cal: NextBlockCalibration): void {
    this.insertShadowCalStmt.run({
      calibration_id: cal.calibrationId,
      opportunity_id: cal.opportunityId,
      predicted_block_number: cal.predictedBlockNumber.toString(),
      observed_block_number: cal.observedBlockNumber.toString(),
      predicted_spread_bps: cal.predictedSpreadBps,
      predicted_gross_profit_usd: cal.predictedGrossProfitUsd,
      predicted_gas_cost_usd: cal.predictedGasCostUsd,
      predicted_net_pnl_usd: cal.predictedNetPnLUsd,
      observed_spread_bps: cal.observedSpreadBps,
      observed_gross_profit_usd: cal.observedGrossProfitUsd,
      observed_gas_cost_usd: cal.observedGasCostUsd,
      observed_net_pnl_usd: cal.observedNetPnLUsd,
      spread_prediction_error_bps: cal.spreadPredictionErrorBps,
      net_pnl_prediction_error_usd: cal.netPnLPredictionErrorUsd,
      gas_prediction_error_usd: cal.gasPredictionErrorUsd,
      opportunity_persisted: cal.opportunityPersisted ? 1 : 0,
      observed_spread_decay_bps: cal.observedSpreadDecayBps,
      is_synthetic: cal.isSynthetic ? 1 : 0,
      calibration_timestamp_ms: cal.calibrationTimestampMs,
      notes: cal.notes ?? null,
      created_at: Date.now(),
    });
  }

  getShadowOpportunities(limit = 50): Array<Record<string, unknown>> {
    return this.db.prepare(
      `SELECT * FROM shadow_opportunities ORDER BY timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as Array<Record<string, unknown>>;
  }

  getShadowCalibrations(limit = 50): Array<Record<string, unknown>> {
    return this.db.prepare(
      `SELECT * FROM shadow_calibrations ORDER BY calibration_timestamp_ms DESC LIMIT :limit`
    ).all({ limit }) as Array<Record<string, unknown>>;
  }

  getShadowOpportunityCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM shadow_opportunities`).get() as { count: number };
    return row.count;
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

  getPhase45Metrics(): {
    lastEventTimestampMs: number | null;
    lastEventBlock: string | null;
    quotesInLastHour: number;
    quotesPerMin: number;
    quoteFailureRatePct: number;
    tierCounts: Record<string, number>;
    avgRpcLatencyMs: number | null;
    recentErrors: number;
  } {
    const oneHourAgo = Date.now() - 3600 * 1000;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    const lastShadow = this.db.prepare(
      `SELECT block_number, timestamp_ms FROM shadow_opportunities ORDER BY timestamp_ms DESC LIMIT 1`
    ).get() as { block_number: string; timestamp_ms: number } | undefined;

    const lastCandidate = this.db.prepare(
      `SELECT block_number, timestamp_ms FROM opportunity_candidates ORDER BY timestamp_ms DESC LIMIT 1`
    ).get() as { block_number: string; timestamp_ms: number } | undefined;

    const lastRt = this.db.prepare(
      `SELECT block_number, timestamp_ms FROM round_trip_observations ORDER BY timestamp_ms DESC LIMIT 1`
    ).get() as { block_number: string; timestamp_ms: number } | undefined;

    let lastEventTimestampMs: number | null = null;
    let lastEventBlock: string | null = null;

    for (const item of [lastShadow, lastCandidate, lastRt]) {
      if (item && (!lastEventTimestampMs || item.timestamp_ms > lastEventTimestampMs)) {
        lastEventTimestampMs = item.timestamp_ms;
        lastEventBlock = item.block_number;
      }
    }

    const recent5mRow = this.db.prepare(
      `SELECT count(*) as count FROM round_trip_observations WHERE timestamp_ms > :fiveMinAgo`
    ).get({ fiveMinAgo }) as { count: number };
    const quotesPerMin = recent5mRow.count / 5;

    const recent1hRow = this.db.prepare(
      `SELECT count(*) as count FROM round_trip_observations WHERE timestamp_ms > :oneHourAgo`
    ).get({ oneHourAgo }) as { count: number };

    const rtStats = this.getRoundTripStats();
    const quoteFailureRatePct = rtStats.total > 0
      ? (rtStats.errors / rtStats.total) * 100
      : 0;

    const tierRows = this.db.prepare(
      `SELECT classification, count(*) as count FROM shadow_opportunities GROUP BY classification`
    ).all() as Array<{ classification: string; count: number }>;
    const tierCounts: Record<string, number> = {};
    for (const row of tierRows) {
      tierCounts[row.classification] = row.count;
    }

    const latencyRow = this.db.prepare(
      `SELECT AVG(rpc_latency_ms) as avg_latency FROM observations WHERE rpc_latency_ms IS NOT NULL`
    ).get() as { avg_latency: number | null };

    const recentErrorsRow = this.db.prepare(
      `SELECT count(*) as count FROM observations WHERE status = 'ERROR' AND timestamp_ms > :oneHourAgo`
    ).get({ oneHourAgo }) as { count: number };
    const recentRtErrorsRow = this.db.prepare(
      `SELECT count(*) as count FROM round_trip_observations WHERE status = 'ERROR' AND timestamp_ms > :oneHourAgo`
    ).get({ oneHourAgo }) as { count: number };

    return {
      lastEventTimestampMs,
      lastEventBlock,
      quotesInLastHour: recent1hRow.count,
      quotesPerMin,
      quoteFailureRatePct,
      tierCounts,
      avgRpcLatencyMs: latencyRow.avg_latency !== null ? Math.round(latencyRow.avg_latency) : null,
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
