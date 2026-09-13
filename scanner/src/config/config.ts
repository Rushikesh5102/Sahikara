/**
 * SAHIKARA Observer — Runtime Configuration
 *
 * Loads and validates all environment variables at startup.
 * Throws immediately if required variables are missing or malformed.
 * All assumptions are documented inline.
 *
 * SECURITY: This module contains ZERO credential defaults.
 * All RPC endpoints must be provided via environment variables.
 */

import 'dotenv/config';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[CONFIG] Required environment variable "${name}" is missing or empty.\n` +
        `Copy scanner/.env.example to scanner/.env and fill in all required values.`
    );
  }
  return value.trim();
}

function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

function parsePositiveFloat(raw: string, name: string): number {
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) {
    throw new Error(
      `[CONFIG] "${name}" must be a positive number. Got: "${raw}"`
    );
  }
  return n;
}

function parsePositiveInt(raw: string, name: string): number {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    throw new Error(
      `[CONFIG] "${name}" must be a positive integer. Got: "${raw}"`
    );
  }
  return n;
}

function parseObservationSizes(raw: string): number[] {
  const sizes = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        throw new Error(
          `[CONFIG] OBSERVATION_SIZES_USD contains invalid value: "${s}". All values must be positive numbers.`
        );
      }
      return n;
    });
  if (sizes.length === 0) {
    throw new Error('[CONFIG] OBSERVATION_SIZES_USD must contain at least one value.');
  }
  return sizes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Object
// ─────────────────────────────────────────────────────────────────────────────

export interface ObserverConfig {
  /** Base mainnet HTTP RPC URL (required) */
  baseRpcUrl: string;
  /** Base mainnet WebSocket URL (optional — used for future streaming) */
  baseWsUrl: string | null;
  /** Secondary RPC for cross-validation (optional) */
  baseRpcUrlSecondary: string | null;
  /** Human-readable identifier for the primary RPC endpoint */
  rpcEndpointId: string;
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  /** Observation trade sizes in USD (research only — not executed) */
  observationSizesUsd: number[];
  /** INR/USD exchange rate for display purposes
   *  [ASSUMPTION] Set by operator; not fetched dynamically in Phase 1C */
  inrUsdRate: number;
  /** Path to the SQLite observations database */
  dbPath: string;
  /** Risk buffer fraction (subtracted from gross profit in net profit formula)
   *  [ASSUMPTION] Default 0.001 (0.1%) — PROVISIONAL per RISK_POLICY.md */
  riskBufferFraction: number;
  /** Minimum net expected profit in USD to classify as a candidate opportunity
   *  [ASSUMPTION] Default $0.05 — PROVISIONAL per RISK_POLICY.md */
  minNetProfitUsd: number;
  /** Log verbosity */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

let _config: ObserverConfig | null = null;

export function loadConfig(): ObserverConfig {
  if (_config) return _config;

  const pollRaw = optionalEnv('POLL_INTERVAL_MS', '30000');
  const pollMs = parsePositiveInt(pollRaw, 'POLL_INTERVAL_MS');
  if (pollMs < 5000) {
    throw new Error(
      '[CONFIG] POLL_INTERVAL_MS must be >= 5000 ms to avoid RPC rate-limiting on free tiers.'
    );
  }

  const logLevelRaw = optionalEnv('LOG_LEVEL', 'info');
  const validLogLevels = ['debug', 'info', 'warn', 'error'] as const;
  if (!validLogLevels.includes(logLevelRaw as (typeof validLogLevels)[number])) {
    throw new Error(
      `[CONFIG] LOG_LEVEL must be one of: ${validLogLevels.join(', ')}. Got: "${logLevelRaw}"`
    );
  }

  const wsRaw = process.env['BASE_WS_URL']?.trim() ?? '';
  const secondaryRaw = process.env['BASE_RPC_URL_SECONDARY']?.trim() ?? '';

  _config = {
    baseRpcUrl: requireEnv('BASE_RPC_URL'),
    baseWsUrl: wsRaw !== '' ? wsRaw : null,
    baseRpcUrlSecondary: secondaryRaw !== '' ? secondaryRaw : null,
    rpcEndpointId: optionalEnv('RPC_ENDPOINT_ID', 'unnamed-endpoint'),
    pollIntervalMs: pollMs,
    observationSizesUsd: parseObservationSizes(
      optionalEnv('OBSERVATION_SIZES_USD', '1,5,10')
    ),
    inrUsdRate: parsePositiveFloat(
      optionalEnv('INR_USD_RATE', '83.50'),
      'INR_USD_RATE'
    ),
    dbPath: optionalEnv('DB_PATH', './data/observations.db'),
    riskBufferFraction: parsePositiveFloat(
      optionalEnv('RISK_BUFFER_FRACTION', '0.001'),
      'RISK_BUFFER_FRACTION'
    ),
    minNetProfitUsd: parsePositiveFloat(
      optionalEnv('MIN_NET_PROFIT_USD', '0.05'),
      'MIN_NET_PROFIT_USD'
    ),
    logLevel: logLevelRaw as ObserverConfig['logLevel'],
  };

  return _config;
}

/** Reset config singleton (for testing only) */
export function _resetConfig(): void {
  _config = null;
}
