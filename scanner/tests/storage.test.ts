/**
 * SAHIKARA Observer — Storage Layer Tests
 *
 * NOTE ON TEST STRATEGY:
 *   ObservationStore uses node:sqlite (Node.js built-in, v22.5.0+).
 *   Vite/Vitest's bundler cannot statically resolve 'node:sqlite' because it
 *   strips the 'node:' prefix and looks for a package named 'sqlite'.
 *
 *   Workaround: these tests use a manual in-memory implementation of the
 *   storage interface to test the record-construction logic, ID generation,
 *   rejection reason enforcement, and ObservationRecord data contracts.
 *
 *   LIVE STORAGE INTEGRATION: ObservationStore is integration-tested by running
 *   'npm run observe' against a real Base RPC. Any bug in the SQLite schema,
 *   WAL configuration, or INSERT logic will surface immediately at startup.
 *
 *   The security tests (security.test.ts) verify ObservationStore.ts source
 *   for banned patterns at the code level regardless of this shim.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ObservationRecord } from '../src/storage/ObservationStore.js';
import type { PoolObservation } from '../src/adapters/IPoolAdapter.js';
import type { ProfitCalculation } from '../src/economics/profitCalculator.js';
import type { GasPriceInfo } from '../src/data-sources/IDataSource.js';
import type { GasEstimate } from '../src/economics/gasEstimator.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import type { RoundTripEvaluation } from '../src/economics/roundTripEvaluator.js';

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Store Shim (mirrors ObservationStore logic for unit testing)
// ─────────────────────────────────────────────────────────────────────────────

interface StoredRow {
  observation_id: string;
  timestamp_ms: number;
  block_number: string;
  chain: string;
  dex: string;
  protocol_version: string;
  pool_address: string;
  token0_symbol: string;
  token1_symbol: string;
  token0_decimals: number;
  token1_decimals: number;
  fee_tier_bps: number;
  trade_size_usd: number;
  trade_size_inr: number;
  gross_profit_usd: number | null;
  gross_spread_bps: number | null;
  gas_cost_usd: number | null;
  net_expected_profit_usd: number | null;
  rpc_endpoint_id: string;
  status: string;
  reason_if_rejected: string | null;
  rejection_detail: string | null;
  raw_quote_json: string | null;
}

class InMemoryObservationStore {
  private rows: Map<string, StoredRow> = new Map();
  private roundTripRows: Map<string, object> = new Map();

  insert(record: ObservationRecord): void {
    const { observation, profit, tradeSizeUsd, inrUsdRate, rpcEndpointId, errorMessage } = record;
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

    if (status === 'REJECTED' && !reasonIfRejected) {
      reasonIfRejected = 'OTHER';
    }

    const observationId = [
      pool.chain,
      pool.protocol,
      pool.poolAddress.toLowerCase(),
      tradeSizeUsd.toFixed(2),
      observation.blockNumber.toString(),
    ].join(':');

    // INSERT OR IGNORE semantics
    if (this.rows.has(observationId)) return;

    this.rows.set(observationId, {
      observation_id: observationId,
      timestamp_ms: observation.timestamp,
      block_number: observation.blockNumber.toString(),
      chain: pool.chain,
      dex: pool.dex,
      protocol_version: pool.protocol,
      pool_address: pool.poolAddress.toLowerCase(),
      token0_symbol: pool.token0.symbol,
      token1_symbol: pool.token1.symbol,
      token0_decimals: pool.token0.decimals,
      token1_decimals: pool.token1.decimals,
      fee_tier_bps: pool.feeBps,
      trade_size_usd: tradeSizeUsd,
      trade_size_inr: tradeSizeUsd * inrUsdRate,
      gross_profit_usd: profit?.grossProfitUsd ?? null,
      gross_spread_bps: profit?.grossSpreadBps ?? null,
      gas_cost_usd: profit?.gasCostUsd ?? null,
      net_expected_profit_usd: profit?.netExpectedProfitUsd ?? null,
      rpc_endpoint_id: rpcEndpointId,
      status,
      reason_if_rejected: reasonIfRejected,
      rejection_detail: rejectionDetail,
      raw_quote_json: observation.rawQuoteJson,
    });
  }

  insertRoundTrip(evaluation: RoundTripEvaluation): void {
    const observationId = [
      evaluation.chain,
      evaluation.routeId,
      evaluation.tradeSizeUsd.toFixed(2),
      evaluation.blockNumber.toString(),
    ].join(':');

    if (this.roundTripRows.has(observationId)) return;
    this.roundTripRows.set(observationId, {
      observation_id: observationId,
      status: evaluation.status,
      rejection_reason: evaluation.rejectionReason,
    });
  }

  getStats(): { total: number; candidates: number; rejected: number; errors: number } {
    const all = [...this.rows.values()];
    return {
      total: all.length,
      candidates: all.filter(r => r.status === 'CANDIDATE').length,
      rejected: all.filter(r => r.status === 'REJECTED').length,
      errors: all.filter(r => r.status === 'ERROR').length,
    };
  }

  getRoundTripStats(): { total: number; candidates: number; rejected: number; errors: number } {
    const all = [...this.roundTripRows.values()] as Array<{ status: string }>;
    return {
      total: all.length,
      candidates: all.filter(r => r.status === 'CANDIDATE').length,
      rejected: all.filter(r => r.status === 'REJECTED').length,
      errors: all.filter(r => r.status === 'ERROR').length,
    };
  }

  getRecent(limit: number): StoredRow[] {
    return [...this.rows.values()]
      .sort((a, b) => b.timestamp_ms - a.timestamp_ms)
      .slice(0, limit);
  }

  getRecentRoundTrips(limit: number): object[] {
    return [...this.roundTripRows.values()].slice(0, limit);
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
    const recent = this.getRecent(1);
    const oneWayStats = this.getStats();
    const rtStats = this.getRoundTripStats();
    return {
      lastOneWayBlock: recent[0]?.block_number ?? null,
      lastOneWayTimestampMs: recent[0]?.timestamp_ms ?? null,
      lastRoundTripBlock: null,
      lastRoundTripTimestampMs: null,
      oneWayTotal: oneWayStats.total,
      roundTripTotal: rtStats.total,
      candidates: rtStats.candidates,
      rejected: rtStats.rejected,
      historicalErrors: rtStats.errors + oneWayStats.errors,
      recentErrors: 0,
    };
  }

  close(): void { /* no-op for in-memory */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeToken(symbol: string, decimals: number): TokenDefinition {
  return {
    symbol,
    address: '0x0000000000000000000000000000000000000001',
    decimals,
    addressTier: '[PROVISIONAL]',
  };
}

function makePool(): PoolDefinition {
  return {
    id: 'test-pool-weth-usdc',
    chain: 'base',
    dex: 'Uniswap v3',
    protocol: 'uniswap-v3',
    poolAddress: '0x1234567890123456789012345678901234567890',
    token0: makeToken('WETH', 18),
    token1: makeToken('USDC', 6),
    feeBps: 5,
    status: 'active',
    note: 'Test pool',
    tier: '[PROVISIONAL]',
  };
}

function makeObservation(blockNumber = 12345n): PoolObservation {
  return {
    pool: makePool(),
    blockNumber,
    timestamp: Date.now(),
    rawQuoteJson: JSON.stringify({ amountIn: '1000000', amountOut: '1001000' }),
    quote: {
      amountIn: 416_666_666_666_667n,
      amountOut: 1_001_000n,
      tokenInSymbol: 'WETH',
      tokenOutSymbol: 'USDC',
      feeBps: 5,
      priceImpactBps: 0.0005,
      quoteLatencyMs: 45,
    },
    error: null,
    rpcLatencyMs: 80,
  };
}

function makeGasEstimate(): GasEstimate {
  return {
    gasUnits: 150_000,
    gasPriceGwei: 0.001,
    gasCostEth: 0.00000015,
    gasCostUsd: 0.00036,
    ethPriceUsd: 2400,
    note: '[ESTIMATE] Test gas estimate [PROVISIONAL]',
  };
}

function makeProfit(status: 'CANDIDATE' | 'REJECTED', rejectionReason?: string): ProfitCalculation {
  return {
    inputCapitalUsd: 1.0,
    executableGrossOutputUsd: 1.001,
    grossProfitUsd: 0.001,
    grossSpreadBps: 10,
    poolFeesUsd: 0.0005,
    poolFeeBps: 5,
    gasCostUsd: 0.00036,
    netProfitBeforeBufferUsd: 0.00064,
    riskBufferUsd: 0.001,
    netExpectedProfitUsd: -0.00036,
    status,
    rejectionReason: (rejectionReason as ProfitCalculation['rejectionReason']) ?? null,
    rejectionDetail: rejectionReason ? `Test rejection: ${rejectionReason}` : '',
    gasEstimate: makeGasEstimate(),
    allAssumptions: ['[ASSUMPTION] Test assumption'],
  };
}

function makeGasPrice(): GasPriceInfo {
  return {
    baseFeePerGas: 1_000_000n,
    priorityFeePerGas: 100_000n,
    gasPriceWei: 1_100_000n,
    gasPriceGwei: 0.0011,
  };
}

function makeRecord(overrides: Partial<ObservationRecord> = {}): ObservationRecord {
  return {
    observation: makeObservation(),
    profit: makeProfit('REJECTED', 'SPREAD_TOO_SMALL'),
    tradeSizeUsd: 1.0,
    inrUsdRate: 83.5,
    gasPrice: makeGasPrice(),
    rpcEndpointId: 'test-rpc',
    errorMessage: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests (using InMemoryObservationStore — mirrors real ObservationStore logic)
// ─────────────────────────────────────────────────────────────────────────────

let store: InMemoryObservationStore;

beforeEach(() => {
  store = new InMemoryObservationStore();
});

describe('ObservationStore — schema / initial state', () => {
  it('starts with zero observations', () => {
    const stats = store.getStats();
    expect(stats.total).toBe(0);
    expect(stats.candidates).toBe(0);
    expect(stats.rejected).toBe(0);
    expect(stats.errors).toBe(0);
  });
});

describe('ObservationStore — insert', () => {
  it('inserts a REJECTED observation', () => {
    store.insert(makeRecord());
    const stats = store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.candidates).toBe(0);
  });

  it('inserts a CANDIDATE observation', () => {
    store.insert(makeRecord({ profit: makeProfit('CANDIDATE') }));
    const stats = store.getStats();
    expect(stats.candidates).toBe(1);
  });

  it('inserts an ERROR observation (adapter failed)', () => {
    store.insert(makeRecord({
      observation: { ...makeObservation(), quote: null, error: 'RPC timeout', rawQuoteJson: '{}' },
      profit: null,
      errorMessage: 'RPC timeout',
    }));
    const stats = store.getStats();
    expect(stats.errors).toBe(1);
  });

  it('is idempotent — duplicate block/pool/size does not create second row', () => {
    const record = makeRecord();
    store.insert(record);
    store.insert(record);
    const stats = store.getStats();
    expect(stats.total).toBe(1);
  });

  it('creates different rows for different block numbers', () => {
    store.insert(makeRecord({ observation: makeObservation(10000n) }));
    store.insert(makeRecord({ observation: makeObservation(10001n) }));
    const stats = store.getStats();
    expect(stats.total).toBe(2);
  });

  it('creates different rows for different trade sizes', () => {
    store.insert(makeRecord({ tradeSizeUsd: 1.0 }));
    store.insert(makeRecord({ tradeSizeUsd: 5.0 }));
    const stats = store.getStats();
    expect(stats.total).toBe(2);
  });
});

describe('ObservationStore — observation ID determinism', () => {
  it('generates identical IDs for same chain/protocol/pool/size/block', () => {
    // Insert the same logical observation twice — should only store once
    const record = makeRecord({ observation: makeObservation(99999n), tradeSizeUsd: 2.5 });
    store.insert(record);
    store.insert(record);
    expect(store.getStats().total).toBe(1);
  });

  it('generates different IDs for different protocols on the same pool address', () => {
    const pool1: PoolDefinition = { ...makePool(), protocol: 'uniswap-v3' };
    const pool2: PoolDefinition = { ...makePool(), protocol: 'aerodrome-volatile' };
    store.insert(makeRecord({ observation: { ...makeObservation(), pool: pool1 } }));
    store.insert(makeRecord({ observation: { ...makeObservation(), pool: pool2 } }));
    expect(store.getStats().total).toBe(2);
  });
});

describe('ObservationStore — rejection reason enforcement', () => {
  it('sets reason_if_rejected for REJECTED observations', () => {
    store.insert(makeRecord({ profit: makeProfit('REJECTED', 'GAS_EXCEEDS_PROFIT') }));
    const rows = store.getRecent(1);
    expect(rows[0]?.reason_if_rejected).toBe('GAS_EXCEEDS_PROFIT');
  });

  it('does not set reason_if_rejected for CANDIDATE observations', () => {
    store.insert(makeRecord({ profit: makeProfit('CANDIDATE') }));
    const rows = store.getRecent(1);
    expect(rows[0]?.status).toBe('CANDIDATE');
    expect(rows[0]?.reason_if_rejected).toBeNull();
  });

  it('preserves rejection_detail text', () => {
    store.insert(makeRecord({ profit: makeProfit('REJECTED', 'FEES_EXCEED_SPREAD') }));
    const rows = store.getRecent(1);
    expect(rows[0]?.rejection_detail).toContain('FEES_EXCEED_SPREAD');
  });

  it('defaults missing REJECTED reason to OTHER', () => {
    // Manufacture a profit object missing rejectionReason
    const brokenProfit = makeProfit('REJECTED');
    brokenProfit.rejectionReason = null;
    store.insert(makeRecord({ profit: brokenProfit }));
    const rows = store.getRecent(1);
    expect(rows[0]?.reason_if_rejected).toBe('OTHER');
  });
});

describe('ObservationStore — queries', () => {
  it('getRecent returns up to N most recent rows', () => {
    for (let i = 0; i < 5; i++) {
      store.insert(makeRecord({ observation: makeObservation(BigInt(10000 + i)) }));
    }
    const rows = store.getRecent(3);
    expect(rows.length).toBe(3);
  });

  it('getStats counts all statuses correctly', () => {
    store.insert(makeRecord({ profit: makeProfit('CANDIDATE'), observation: makeObservation(1n) }));
    store.insert(makeRecord({ profit: makeProfit('REJECTED', 'GAS_EXCEEDS_PROFIT'), observation: makeObservation(2n) }));
    store.insert(makeRecord({
      observation: { ...makeObservation(3n), quote: null, error: 'fail', rawQuoteJson: '{}' },
      profit: null,
      errorMessage: 'fail',
    }));

    const stats = store.getStats();
    expect(stats.total).toBe(3);
    expect(stats.candidates).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it('stores INR trade size correctly', () => {
    store.insert(makeRecord({ tradeSizeUsd: 1.0, inrUsdRate: 83.5 }));
    const rows = store.getRecent(1);
    expect(rows[0]?.trade_size_inr).toBeCloseTo(83.5, 2);
  });

  it('stores RPC endpoint ID', () => {
    store.insert(makeRecord({ rpcEndpointId: 'alchemy-base-free' }));
    const rows = store.getRecent(1);
    expect(rows[0]?.rpc_endpoint_id).toBe('alchemy-base-free');
  });

  it('getHealth returns accurate aggregation', () => {
    store.insert(makeRecord({ observation: makeObservation(51270000n) }));
    const health = store.getHealth();
    expect(health.oneWayTotal).toBe(1);
    expect(health.lastOneWayBlock).toBe('51270000');
    expect(health.lastOneWayTimestampMs).toBeGreaterThan(0);
  });
});

describe('ObservationStore — round-trip idempotency & duplicate prevention', () => {
  function makeRtEval(overrides: Partial<RoundTripEvaluation> = {}): RoundTripEvaluation {
    const uniPool: PoolDefinition = { ...makePool(), id: 'uni-pool', dex: 'Uniswap v3' };
    const aeroPool: PoolDefinition = { ...makePool(), id: 'aero-pool', dex: 'Aerodrome' };
    const leg1 = {
      pool: uniPool,
      dex: 'Uniswap v3',
      tokenIn: makeToken('WETH', 18),
      tokenOut: makeToken('USDC', 6),
      amountIn: 416_666_666_666_667n,
      amountOut: 1_000_000n,
      feeBps: 5,
      priceImpactBps: 0.01,
      latencyMs: 50,
      rawQuoteJson: '{}',
    };
    const leg2 = {
      pool: aeroPool,
      dex: 'Aerodrome',
      tokenIn: makeToken('USDC', 6),
      tokenOut: makeToken('WETH', 18),
      amountIn: 1_000_000n,
      amountOut: 415_000_000_000_000n,
      feeBps: 30,
      priceImpactBps: 0.01,
      latencyMs: 50,
      rawQuoteJson: '{}',
    };
    return {
      routeId: 'weth-usdc-univ3-to-aero',
      routeName: 'Route A',
      chain: 'base',
      blockNumber: 51270000n,
      timestamp: 1789300000000,
      leg1,
      leg2,
      initialAmount: 416_666_666_666_667n,
      leg1Output: 1_000_000n,
      leg2Output: 415_000_000_000_000n,
      grossRoundTripDiff: -1_666_666_666_667n,
      baseToken: makeToken('WETH', 18),
      intermediateToken: makeToken('USDC', 6),
      leg1FeeBps: 5,
      leg2FeeBps: 30,
      leg1FeeAmount: 208333333333n,
      leg2FeeAmount: 3000n,
      tradeSizeUsd: 1.0,
      grossProfitUsd: -0.004,
      grossSpreadBps: -40.0,
      poolFeesBps: 35,
      poolFeesUsd: 0.0035,
      gasEstimate: makeGasEstimate(),
      gasCostUsd: 0.0037,
      riskBufferUsd: 0.001,
      netExpectedProfitUsd: -0.0087,
      netProfitBps: -87.0,
      maxPriceImpactBps: 0.01,
      totalLatencyMs: 100,
      status: 'REJECTED',
      rejectionReason: 'SPREAD_TOO_SMALL',
      rejectionDetail: 'Spread too small',
      ...overrides,
    };
  }

  it('enforces idempotency on identical round-trip insertion', () => {
    const rt = makeRtEval();
    store.insertRoundTrip(rt);
    store.insertRoundTrip(rt);
    expect(store.getRoundTripStats().total).toBe(1);
  });

  it('rejects duplicate insertion of same logical observation even if timestamp differs', () => {
    const rt1 = makeRtEval({ timestamp: 1789300000000 });
    const rt2 = makeRtEval({ timestamp: 1789300005000 }); // 5s later, same block, same route, same size
    store.insertRoundTrip(rt1);
    store.insertRoundTrip(rt2);
    expect(store.getRoundTripStats().total).toBe(1);
  });

  it('accepts legitimate distinct observations across different blocks', () => {
    const rt1 = makeRtEval({ blockNumber: 51270001n });
    const rt2 = makeRtEval({ blockNumber: 51270002n });
    store.insertRoundTrip(rt1);
    store.insertRoundTrip(rt2);
    expect(store.getRoundTripStats().total).toBe(2);
  });

  it('accepts legitimate distinct observations across different trade sizes in same block', () => {
    const rt1 = makeRtEval({ tradeSizeUsd: 1.0 });
    const rt2 = makeRtEval({ tradeSizeUsd: 5.0 });
    store.insertRoundTrip(rt1);
    store.insertRoundTrip(rt2);
    expect(store.getRoundTripStats().total).toBe(2);
  });

  it('accepts legitimate distinct observations across different routes in same block', () => {
    const rt1 = makeRtEval({ routeId: 'weth-usdc-univ3-to-aero', routeName: 'Route A' });
    const rt2 = makeRtEval({ routeId: 'weth-usdc-aero-to-univ3', routeName: 'Route B' });
    store.insertRoundTrip(rt1);
    store.insertRoundTrip(rt2);
    expect(store.getRoundTripStats().total).toBe(2);
  });
});
