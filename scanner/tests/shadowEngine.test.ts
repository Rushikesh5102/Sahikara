/**
 * SAHIKARA Phase 4 — Real-Time Shadow Execution Engine Test Suite
 *
 * Comprehensive tests covering:
 * - Opportunity Lifecycle State Transitions & Validation
 * - High-Resolution Latency & Monotonic Timestamps
 * - Base OP Stack Gas & L1 Data Fee Accounting
 * - 10-Point False-Positive Protection Gates
 * - Next-Block Market Calibration Math & Prediction Error
 * - Virtual Paper Portfolio Ledger ($100 Virtual Capital)
 * - Strict Separation: Synthetic Fixtures vs Live Market Ledger
 * - SQLite Schema v5 Persistence & Verification
 *
 * STRICT SAFETY DIRECTIVE:
 * Zero private keys, zero wallet signing, zero live trading.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import {
  BaseGasModel,
  OpportunityLifecycleManager,
  NextBlockCalibrationEngine,
  ShadowPortfolioLedger,
  type ShadowOpportunity,
  type NextBlockObservationInput,
  type EconomicPolicyConfig,
} from '../src/shadow/index.js';
import { ObservationStore } from '../src/storage/ObservationStore.js';

describe('Phase 4: Base OP Stack Gas Model', () => {
  const gasModel = new BaseGasModel({
    defaultExecutionGasUnits: 220_000,
    defaultPriorityFeeGwei: 0.05,
    defaultL1DataFeeUsd: 0.002,
    defaultEthPriceUsd: 2500.0,
  });

  it('correctly decomposes total gas cost into L2 execution fee and L1 data fee', () => {
    // At L2 base fee 0.05 Gwei + 0.05 priority = 0.10 Gwei effective
    // 220,000 * 0.10 * 1e-9 * 2500 = $0.055 L2 execution cost
    // + $0.002 L1 data fee = $0.057 total
    const breakdown = gasModel.calculateGasCost(0.05);

    expect(breakdown.executionGasUnits).toBe(220_000);
    expect(breakdown.l2BaseFeeGwei).toBe(0.05);
    expect(breakdown.priorityFeeGwei).toBe(0.05);
    expect(breakdown.l2GasCostUsd).toBeCloseTo(0.055, 4);
    expect(breakdown.l1DataFeeUsd).toBeCloseTo(0.002, 4);
    expect(breakdown.totalGasCostUsd).toBeCloseTo(0.057, 4);
  });

  it('correctly derives break-even L2 base fee including L1 data fee', () => {
    // $100 trade, $0.40 gross profit, $0.10 risk buffer, $0.05 min net profit, $0.002 L1 data fee
    // Available for total gas = $0.40 - $0.10 - $0.05 = $0.25
    // Available for L2 gas = $0.25 - $0.002 = $0.248
    // L2 Gas Price = ($0.248 * 1e9) / (220,000 * 2500) = 0.450909 Gwei
    // Break-even base fee = 0.450909 - 0.05 = 0.400909 Gwei
    const result = gasModel.calculateBreakEvenBaseFee(0.40, 0.10, 0.05);

    expect(result.isViableAtGas).toBe(true);
    expect(result.breakEvenBaseFeeGwei).toBeCloseTo(0.4009, 3);
    expect(result.maxAllowedGasCostUsd).toBeCloseTo(0.25, 4);
  });

  it('marks opportunity non-viable if gross gain cannot cover L1 data fee + hurdle', () => {
    const result = gasModel.calculateBreakEvenBaseFee(0.05, 0.05, 0.05); // $0 available
    expect(result.isViableAtGas).toBe(false);
    expect(result.breakEvenBaseFeeGwei).toBe(0);
  });
});

describe('Phase 4: Opportunity Lifecycle Manager', () => {
  const mockOpportunity = (): ShadowOpportunity => ({
    opportunityId: 'opp_test_1',
    chain: 'base',
    triggerBlockNumber: 50_000_000n,
    triggerEventType: 'SWAP',
    triggerPoolAddress: '0x1111111111111111111111111111111111111111',
    routeId: 'route_univ3_aero',
    routeName: 'WETH/USDC UniV3 -> Aero',
    tokenPair: 'WETH/USDC',
    poolLeg1: '0x1111111111111111111111111111111111111111',
    poolLeg2: '0x2222222222222222222222222222222222222222',
    dexLeg1: 'UniswapV3',
    dexLeg2: 'AerodromeSlipstream',
    tradeSizeUsd: 100.0,
    initialAmount: 100_000_000n,
    tokenInSymbol: 'USDC',
    tokenInDecimals: 6,
    quotedLeg1Output: 40_000_000_000_000_000n,
    quotedLeg2Output: 100_400_000n, // +40 bps spread
    grossSpreadBps: 40.0,
    grossProfitUsd: 0.40,
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
    netExpectedPnLUsd: 0.243,
    netProfitBps: 24.3,
    totalPriceImpactBps: 5.0,
    timestamps: {
      tDetectWallMs: Date.now(),
      tDetectMonoMs: performance.now(),
      detectionLatencyMs: 150,
      simulationLatencyMs: 50,
      assumedExecutionLatencyMs: 200,
      totalLatencyMs: 400,
    },
    expectedInclusionBlock: 50_000_001n,
    lifecycleState: 'DETECTED',
    classification: 'NO_OPPORTUNITY',
    isSynthetic: false,
    provenance: {},
    createdAt: Date.now(),
  });

  const config: EconomicPolicyConfig = {
    minNetProfitUsd: 0.05,
    minNetProfitBps: 5.0,
    maxSlippageBps: 20.0,
    maxGasCostUsd: 0.50,
    maxTradeSizeUsd: 500.0,
    minLiquidityUsd: 1000.0,
    maxQuoteAgeMs: 2000,
    maxViableLatencyMs: 3000,
    riskBufferBps: 10.0,
    ethPriceUsd: 2500.0,
    assumedL1DataFeeUsd: 0.002,
  };

  it('allows valid lifecycle transitions', () => {
    const opp = mockOpportunity();
    expect(opp.lifecycleState).toBe('DETECTED');

    OpportunityLifecycleManager.transition(opp, 'EVALUATED');
    expect(opp.lifecycleState).toBe('EVALUATED');
    expect(opp.timestamps.tEvaluateWallMs).toBeDefined();

    OpportunityLifecycleManager.transition(opp, 'SHADOW_SUBMITTED');
    expect(opp.lifecycleState).toBe('SHADOW_SUBMITTED');
    expect(opp.timestamps.tShadowSubmitWallMs).toBeDefined();

    OpportunityLifecycleManager.transition(opp, 'INCLUDED');
    expect(opp.lifecycleState).toBe('INCLUDED');
    expect(opp.timestamps.tHypotheticalInclusionWallMs).toBeDefined();
  });

  it('rejects illegal lifecycle transitions', () => {
    const opp = mockOpportunity();
    // Cannot transition directly from DETECTED to INCLUDED
    expect(() => OpportunityLifecycleManager.transition(opp, 'INCLUDED')).toThrow(
      /Illegal lifecycle transition/
    );
  });

  it('enforces 10-point false-positive protection: qualifies clean profitable opportunity', () => {
    const opp = mockOpportunity();
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_000n);

    expect(result.passes).toBe(true);
    expect(result.classification).toBe('PROFITABLE_SHADOW');
  });

  it('rejects opportunity with zero quoter output (QUOTE_FAILED)', () => {
    const opp = mockOpportunity();
    opp.quotedLeg2Output = 0n;
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_000n);

    expect(result.passes).toBe(false);
    expect(result.classification).toBe('QUOTE_FAILED');
  });

  it('rejects opportunity with stale block distance > 2 (INVALIDATED)', () => {
    const opp = mockOpportunity();
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_005n); // 5 blocks ahead

    expect(result.passes).toBe(false);
    expect(result.classification).toBe('INVALIDATED');
  });

  it('rejects opportunity exceeding max slippage tolerance (SLIPPAGE_TOO_HIGH)', () => {
    const opp = mockOpportunity();
    opp.totalPriceImpactBps = 35.0; // > 20 bps limit
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_000n);

    expect(result.passes).toBe(false);
    expect(result.classification).toBe('SLIPPAGE_TOO_HIGH');
  });

  it('rejects opportunity exceeding latency cutoff (LATENCY_TOO_HIGH)', () => {
    const opp = mockOpportunity();
    opp.timestamps.detectionLatencyMs = 2500;
    opp.timestamps.simulationLatencyMs = 1000; // 3500ms > 3000ms
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_000n);

    expect(result.passes).toBe(false);
    expect(result.classification).toBe('LATENCY_TOO_HIGH');
  });

  it('rejects opportunity with negative net profit (RISK_REJECTED)', () => {
    const opp = mockOpportunity();
    opp.netExpectedPnLUsd = -0.05;
    const result = OpportunityLifecycleManager.evaluateGates(opp, config, 50_000_000n);

    expect(result.passes).toBe(false);
    expect(result.classification).toBe('RISK_REJECTED');
  });
});

describe('Phase 4: Next-Block Market Calibration Engine', () => {
  it('calibrates predicted execution against actual block B+1 state and calculates errors', () => {
    const opp: ShadowOpportunity = {
      opportunityId: 'opp_cal_test',
      chain: 'base',
      triggerBlockNumber: 51_000_000n,
      triggerEventType: 'SWAP',
      triggerPoolAddress: '0x1111111111111111111111111111111111111111',
      routeId: 'route_test',
      routeName: 'Test Route',
      tokenPair: 'WETH/USDC',
      poolLeg1: '0x1111111111111111111111111111111111111111',
      poolLeg2: '0x2222222222222222222222222222222222222222',
      dexLeg1: 'UniswapV3',
      dexLeg2: 'AerodromeSlipstream',
      tradeSizeUsd: 100.0,
      initialAmount: 100_000_000n,
      tokenInSymbol: 'USDC',
      tokenInDecimals: 6,
      quotedLeg1Output: 40_000_000_000_000_000n,
      quotedLeg2Output: 100_400_000n,
      grossSpreadBps: 40.0,
      grossProfitUsd: 0.40,
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
      netExpectedPnLUsd: 0.243,
      netProfitBps: 24.3,
      totalPriceImpactBps: 5.0,
      timestamps: {
        tDetectWallMs: Date.now(),
        tDetectMonoMs: performance.now(),
        detectionLatencyMs: 100,
        simulationLatencyMs: 50,
        assumedExecutionLatencyMs: 200,
        totalLatencyMs: 350,
      },
      expectedInclusionBlock: 51_000_001n,
      lifecycleState: 'SHADOW_SUBMITTED',
      classification: 'PROFITABLE_SHADOW',
      isSynthetic: false,
      provenance: {},
      createdAt: Date.now(),
    };

    const nextBlockInput: NextBlockObservationInput = {
      observedBlockNumber: 51_000_001n,
      observedLeg1Output: 39_995_000_000_000_000n,
      observedLeg2Output: 100_250_000n, // Decayed from +40 bps to +25 bps
      observedL2BaseFeeGwei: 0.06, // Slight gas bump
      observedGasUnits: 220_000,
      observedL1DataFeeUsd: 0.002,
    };

    const calibration = NextBlockCalibrationEngine.calibrate(opp, nextBlockInput);

    expect(calibration.opportunityId).toBe('opp_cal_test');
    expect(calibration.predictedBlockNumber).toBe(51_000_000n);
    expect(calibration.observedBlockNumber).toBe(51_000_001n);
    expect(calibration.predictedSpreadBps).toBe(40.0);
    expect(calibration.observedSpreadBps).toBe(25.0);
    expect(calibration.spreadPredictionErrorBps).toBe(-15.0); // Lost 15 bps
    expect(calibration.observedSpreadDecayBps).toBe(15.0);
    expect(calibration.opportunityPersisted).toBe(true); // Still positive (+25 bps)
    expect(calibration.notes).toContain('[EMPIRICAL CALIBRATION PROXY]');
  });
});

describe('Phase 4: Shadow / Paper Portfolio Ledger', () => {
  it('initializes with $100 virtual capital and tracks fill accounting', () => {
    const ledger = new ShadowPortfolioLedger({ startingBalanceUsd: 100.0 });
    const state0 = ledger.getState();

    expect(state0.startingBalanceUsd).toBe(100.0);
    expect(state0.availableBalanceUsd).toBe(100.0);
    expect(state0.committedBalanceUsd).toBe(0.0);
    expect(state0.currentCashBalanceUsd).toBe(100.0);
    expect(state0.winRatePercent).toBeNull();

    const mockOpp: ShadowOpportunity = {
      opportunityId: 'opp_trade_1',
      chain: 'base',
      triggerBlockNumber: 50_000_000n,
      triggerEventType: 'SWAP',
      triggerPoolAddress: '0x1111111111111111111111111111111111111111',
      routeId: 'route_test',
      routeName: 'Test',
      tokenPair: 'WETH/USDC',
      poolLeg1: '0x1111111111111111111111111111111111111111',
      poolLeg2: '0x2222222222222222222222222222222222222222',
      dexLeg1: 'UniswapV3',
      dexLeg2: 'Aerodrome',
      tradeSizeUsd: 25.0,
      initialAmount: 25_000_000n,
      tokenInSymbol: 'USDC',
      tokenInDecimals: 6,
      quotedLeg1Output: 10_000_000_000_000_000n,
      quotedLeg2Output: 25_100_000n,
      grossSpreadBps: 40.0,
      grossProfitUsd: 0.10,
      gasBreakdown: {
        executionGasUnits: 220_000,
        l2BaseFeeGwei: 0.05,
        priorityFeeGwei: 0.05,
        l2GasCostUsd: 0.055,
        l1DataFeeUsd: 0.002,
        totalGasCostUsd: 0.057,
        ethPriceUsd: 2500.0,
      },
      riskBufferUsd: 0.025,
      otherCostsUsd: 0,
      netExpectedPnLUsd: 0.018,
      netProfitBps: 7.2,
      totalPriceImpactBps: 3.0,
      timestamps: {
        tDetectWallMs: Date.now(),
        tDetectMonoMs: performance.now(),
        detectionLatencyMs: 100,
        simulationLatencyMs: 50,
        assumedExecutionLatencyMs: 200,
        totalLatencyMs: 350,
      },
      expectedInclusionBlock: 50_000_001n,
      lifecycleState: 'SHADOW_SUBMITTED',
      classification: 'PROFITABLE_SHADOW',
      isSynthetic: false,
      provenance: {},
      createdAt: Date.now(),
    };

    // Commit capital
    const committed = ledger.commitCapital(mockOpp);
    expect(committed).toBe(true);
    expect(ledger.getState().availableBalanceUsd).toBe(75.0);
    expect(ledger.getState().committedBalanceUsd).toBe(25.0);

    // Settle trade with +$0.018 profit
    ledger.settleTrade(mockOpp, 0.018);
    const state1 = ledger.getState();

    expect(state1.committedBalanceUsd).toBe(0.0);
    expect(state1.currentCashBalanceUsd).toBeCloseTo(100.018, 3);
    expect(state1.availableBalanceUsd).toBeCloseTo(100.018, 3);
    expect(state1.tradesFilled).toBe(1);
    expect(state1.winCount).toBe(1);
    expect(state1.winRatePercent).toBe(100.0);
  });

  it('enforces revert economics: 100% principal protected, 100% gas consumed', () => {
    const ledger = new ShadowPortfolioLedger({ startingBalanceUsd: 100.0 });
    const mockOpp: ShadowOpportunity = {
      opportunityId: 'opp_revert_1',
      chain: 'base',
      triggerBlockNumber: 50_000_000n,
      triggerEventType: 'SWAP',
      triggerPoolAddress: '0x1111111111111111111111111111111111111111',
      routeId: 'route_test',
      routeName: 'Test',
      tokenPair: 'WETH/USDC',
      poolLeg1: '0x1111111111111111111111111111111111111111',
      poolLeg2: '0x2222222222222222222222222222222222222222',
      dexLeg1: 'UniswapV3',
      dexLeg2: 'Aerodrome',
      tradeSizeUsd: 50.0,
      initialAmount: 50_000_000n,
      tokenInSymbol: 'USDC',
      tokenInDecimals: 6,
      quotedLeg1Output: 20_000_000_000_000_000n,
      quotedLeg2Output: 50_000_000n,
      grossSpreadBps: 0.0,
      grossProfitUsd: 0.0,
      gasBreakdown: {
        executionGasUnits: 220_000,
        l2BaseFeeGwei: 0.05,
        priorityFeeGwei: 0.05,
        l2GasCostUsd: 0.055,
        l1DataFeeUsd: 0.002,
        totalGasCostUsd: 0.057,
        ethPriceUsd: 2500.0,
      },
      riskBufferUsd: 0.05,
      otherCostsUsd: 0,
      netExpectedPnLUsd: -0.107,
      netProfitBps: -21.4,
      totalPriceImpactBps: 3.0,
      timestamps: {
        tDetectWallMs: Date.now(),
        tDetectMonoMs: performance.now(),
        detectionLatencyMs: 100,
        simulationLatencyMs: 50,
        assumedExecutionLatencyMs: 200,
        totalLatencyMs: 350,
      },
      expectedInclusionBlock: 50_000_001n,
      lifecycleState: 'SHADOW_SUBMITTED',
      classification: 'UNPROFITABLE_SHADOW',
      isSynthetic: false,
      provenance: {},
      createdAt: Date.now(),
    };

    ledger.commitCapital(mockOpp);
    expect(ledger.getState().committedBalanceUsd).toBe(50.0);

    // Revert!
    ledger.revertTrade(mockOpp);
    const state = ledger.getState();

    // 100% of $50 principal returned
    expect(state.committedBalanceUsd).toBe(0.0);
    // Only gas ($0.057) lost from $100 cash
    expect(state.currentCashBalanceUsd).toBeCloseTo(99.943, 3);
    expect(state.availableBalanceUsd).toBeCloseTo(99.943, 3);
    expect(state.tradesReverted).toBe(1);
    expect(state.lossCount).toBe(1);
    expect(state.consecutiveLosses).toBe(1);
    expect(state.maxDrawdownUsd).toBeCloseTo(0.057, 3);
  });

  it('prevents over-allocation when trade size exceeds available virtual balance', () => {
    const ledger = new ShadowPortfolioLedger({ startingBalanceUsd: 50.0 });
    const mockLargeOpp = { tradeSizeUsd: 75.0 } as ShadowOpportunity;

    const committed = ledger.commitCapital(mockLargeOpp);
    expect(committed).toBe(false);
    expect(ledger.getState().availableBalanceUsd).toBe(50.0);
  });
});

describe('Phase 4: SQLite Schema v5 Persistence', () => {
  let dbPath: string;
  let store: ObservationStore;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test_phase4_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    store = new ObservationStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it('persists and retrieves shadow opportunities in schema v5', () => {
    const opp: ShadowOpportunity = {
      opportunityId: 'opp_db_test_1',
      chain: 'base',
      triggerBlockNumber: 52_000_000n,
      triggerEventType: 'SWAP',
      triggerPoolAddress: '0x1111111111111111111111111111111111111111',
      routeId: 'route_db_1',
      routeName: 'DB Test Route',
      tokenPair: 'WETH/USDC',
      poolLeg1: '0x1111111111111111111111111111111111111111',
      poolLeg2: '0x2222222222222222222222222222222222222222',
      dexLeg1: 'UniswapV3',
      dexLeg2: 'AerodromeSlipstream',
      tradeSizeUsd: 10.0,
      initialAmount: 10_000_000n,
      tokenInSymbol: 'USDC',
      tokenInDecimals: 6,
      quotedLeg1Output: 4_000_000_000_000_000n,
      quotedLeg2Output: 10_040_000n,
      grossSpreadBps: 40.0,
      grossProfitUsd: 0.04,
      gasBreakdown: {
        executionGasUnits: 220_000,
        l2BaseFeeGwei: 0.05,
        priorityFeeGwei: 0.05,
        l2GasCostUsd: 0.055,
        l1DataFeeUsd: 0.002,
        totalGasCostUsd: 0.057,
        ethPriceUsd: 2500.0,
      },
      riskBufferUsd: 0.01,
      otherCostsUsd: 0,
      netExpectedPnLUsd: -0.027,
      netProfitBps: -27.0,
      totalPriceImpactBps: 2.0,
      timestamps: {
        tDetectWallMs: Date.now(),
        tDetectMonoMs: performance.now(),
        detectionLatencyMs: 120,
        simulationLatencyMs: 45,
        assumedExecutionLatencyMs: 200,
        totalLatencyMs: 365,
      },
      expectedInclusionBlock: 52_000_001n,
      lifecycleState: 'EVALUATED',
      classification: 'UNPROFITABLE_SHADOW',
      isSynthetic: false,
      provenance: { triggerBlockNumber: '[OBSERVED]' },
      createdAt: Date.now(),
    };

    store.insertShadowOpportunity(opp);

    expect(store.getShadowOpportunityCount()).toBe(1);
    const opps = store.getShadowOpportunities(10);
    expect(opps.length).toBe(1);
    expect(opps[0].opportunity_id).toBe('opp_db_test_1');
    expect(opps[0].classification).toBe('UNPROFITABLE_SHADOW');
    expect(opps[0].is_synthetic).toBe(0);
  });

  it('persists and retrieves next-block calibrations in schema v5', () => {
    store.insertShadowCalibration({
      calibrationId: 'cal_db_test_1',
      opportunityId: 'opp_db_test_1',
      predictedBlockNumber: 52_000_000n,
      observedBlockNumber: 52_000_001n,
      predictedSpreadBps: 40.0,
      predictedGrossProfitUsd: 0.40,
      predictedGasCostUsd: 0.057,
      predictedNetPnLUsd: 0.243,
      observedSpreadBps: 38.0,
      observedGrossProfitUsd: 0.38,
      observedGasCostUsd: 0.058,
      observedNetPnLUsd: 0.222,
      spreadPredictionErrorBps: -2.0,
      netPnLPredictionErrorUsd: -0.021,
      gasPredictionErrorUsd: 0.001,
      opportunityPersisted: true,
      observedSpreadDecayBps: 2.0,
      isSynthetic: false,
      calibrationTimestampMs: Date.now(),
      notes: '[EMPIRICAL CALIBRATION PROXY]',
    });

    const cals = store.getShadowCalibrations(10);
    expect(cals.length).toBe(1);
    expect(cals[0].calibration_id).toBe('cal_db_test_1');
    expect(cals[0].opportunity_persisted).toBe(1);
    expect(cals[0].spread_prediction_error_bps).toBe(-2.0);
  });
});
