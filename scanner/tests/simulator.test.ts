/**
 * SAHIKARA Phase 3 — Simulator & Economic Modeling Test Suite
 *
 * Comprehensive test coverage for:
 * 1. Exact economic formula & zero double-counting
 * 2. Price impact & slippage curves (CPAMM & Quoted)
 * 3. Gas sensitivity & break-even calculations
 * 4. Latency drift & opportunity half-life decay
 * 5. Atomic execution & revert semantics (capital preservation, gas loss)
 * 6. Trade size sweep & concave net profit optimization
 * 7. Shadow execution paper portfolio ledger
 * 8. Deterministic replay & adversarial edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  PriceImpactModel,
  GasSensitivityEngine,
  LatencyDriftModel,
  AtomicExecutionSimulator,
  TradeSizeOptimizer,
  ShadowExecutionEngine,
  type CompleteSimulationResult,
} from '../src/simulator/index.js';

describe('Phase 3 Simulator: Price Impact & Slippage Models', () => {
  it('calculates CPAMM price impact correctly scaling with trade size', () => {
    // 100 WETH reserve, 250,000 USDC reserve (spot = 2500 USDC/WETH)
    const reserveIn = 100n * 10n ** 18n;
    const reserveOut = 250_000n * 10n ** 6n;

    // Small trade: 0.01 WETH (~$25)
    const smallTrade = 10n ** 16n;
    const smallImpact = PriceImpactModel.calculateConstantProductImpact(
      smallTrade,
      reserveIn,
      reserveOut,
      30, // 30 bps fee
      20  // 20 bps max tolerance
    );

    expect(smallImpact.priceImpactBps).toBeLessThanOrEqual(2);
    expect(smallImpact.exceedsTolerance).toBe(false);

    // Large trade: 2 WETH (~$5,000)
    const largeTrade = 2n * 10n ** 18n;
    const largeImpact = PriceImpactModel.calculateConstantProductImpact(
      largeTrade,
      reserveIn,
      reserveOut,
      30,
      20
    );

    // With 2 WETH on 100 WETH pool, price impact is ~1.9% (~190 bps)
    expect(largeImpact.priceImpactBps).toBeGreaterThan(150);
    expect(largeImpact.exceedsTolerance).toBe(true);
  });

  it('handles zero or invalid reserves gracefully without division by zero', () => {
    const zeroRes = PriceImpactModel.calculateConstantProductImpact(10n ** 18n, 0n, 1000n);
    expect(zeroRes.exceedsTolerance).toBe(true);
    expect(zeroRes.priceImpactBps).toBe(10_000);

    const zeroAmt = PriceImpactModel.calculateConstantProductImpact(0n, 1000n, 1000n);
    expect(zeroAmt.exceedsTolerance).toBe(true);
  });

  it('calculates quoted slippage against a micro-quote baseline', () => {
    // Micro quote: 1 WETH -> 2500 USDC (ratio 2500)
    const microIn = 10n ** 18n;
    const microOut = 2500n * 10n ** 6n;

    // Target quote: 10 WETH -> 24,900 USDC (ratio 2490)
    const targetIn = 10n * 10n ** 18n;
    const targetOut = 24_900n * 10n ** 6n;

    const slippage = PriceImpactModel.calculateQuotedSlippage(
      microIn,
      microOut,
      targetIn,
      targetOut,
      20
    );

    // Spot = 2500, Exec = 2490 -> 10/2500 = 0.40% = 40 bps
    expect(slippage.priceImpactBps).toBe(40);
    expect(slippage.exceedsTolerance).toBe(true); // 40 bps > 20 bps tolerance
  });
});

describe('Phase 3 Simulator: Gas Sensitivity Engine', () => {
  it('generates multi-dimensional gas sensitivity matrix', () => {
    const matrix = GasSensitivityEngine.generateMatrix({
      routeId: 'route_weth_usdc',
      tradeSizeUsd: 100,
      grossProfitUsd: 0.50, // $0.50 gross profit (50 bps)
      riskBufferUsd: 0.10,  // $0.10 risk buffer
      ethPriceUsd: 2500,
      testedBaseFeesGwei: [0.01, 0.05, 0.1, 0.5, 1.0],
      testedGasUnits: [150_000n, 220_000n],
      priorityFeeGwei: 0.05,
    });

    expect(matrix.points.length).toBe(10);
    // At low gas (0.01 Gwei base fee, 150k gas), cost is ~0.000009 ETH = $0.0225 -> Net PnL = $0.50 - $0.0225 - $0.10 = $0.3775
    const lowGasPoint = matrix.points.find(p => p.baseFeeGwei === 0.01 && p.gasUnits === 150_000n);
    expect(lowGasPoint).toBeDefined();
    expect(lowGasPoint!.isProfitable).toBe(true);
    expect(lowGasPoint!.netPnLUsd).toBeGreaterThan(0.35);

    // At high gas (1.0 Gwei base fee, 220k gas), cost is ~0.000231 ETH = $0.5775 -> Net PnL = $0.50 - $0.5775 - $0.10 = -$0.1775
    const highGasPoint = matrix.points.find(p => p.baseFeeGwei === 1.0 && p.gasUnits === 220_000n);
    expect(highGasPoint).toBeDefined();
    expect(highGasPoint!.isProfitable).toBe(false);
    expect(highGasPoint!.netPnLUsd).toBeLessThan(0);

    expect(matrix.breakEvenBaseFeeGwei).toBeGreaterThan(0);
  });

  it('calculates break-even base fee accurately', () => {
    // Gross = $0.30, RiskBuffer = $0.05, TargetNet = $0.05 -> Available for gas = $0.20
    // At ETH = $2000, $0.20 = 0.0001 ETH
    // At 200,000 gas units, effectiveGasPrice = 0.0001 / 200,000 = 0.5 Gwei
    // If priorityFee = 0.05 Gwei -> max base fee = 0.45 Gwei
    const breakEven = GasSensitivityEngine.calculateBreakEvenBaseFee(
      0.30,
      0.05,
      200_000n,
      2000,
      0.05,
      0.05
    );

    expect(breakEven).toBe(0.45);
  });
});

describe('Phase 3 Simulator: Latency & Adverse Drift Model', () => {
  it('models opportunity decay and half-life accurately', () => {
    const result = LatencyDriftModel.evaluateLatencyDecay({
      routeId: 'route_test',
      initialGrossSpreadBps: 20.0, // 20 bps initial spread
      tradeSizeUsd: 100,
      gasCostUsd: 0.02,
      riskBufferUsd: 0.01,
      driftRateBpsPerSec: 4.0, // 4 bps per sec
      testedLatenciesMs: [50, 200, 500, 1000, 2000],
      minNetProfitUsd: 0.05,
    });

    expect(result.points.length).toBe(5);
    // Latency 50ms should have tiny drift and survive
    expect(result.points[0].survived).toBe(true);
    expect(result.points[0].residualGrossSpreadBps).toBeGreaterThan(19.0);

    // Half-life should be non-null and positive
    expect(result.halfLifeMs).toBeGreaterThan(0);
  });
});

describe('Phase 3 Simulator: Atomic Execution & Revert Semantics', () => {
  const defaultParams = {
    routeId: 'weth-usdc-weth',
    routeName: 'UniV3 -> Aero Slipstream',
    chain: 'base',
    blockNumber: 51360000n,
    timestampMs: Date.now(),
    tradeSizeUsd: 100,
    initialAmount: 100n * 10n ** 6n, // 100 USDC (6 decimals)
    poolLeg1Address: '0x1111111111111111111111111111111111111111',
    dexLeg1: 'uniswap-v3',
    leg1QuoteOutput: 40_000_000_000_000_000n, // 0.04 WETH (18 decimals)
    leg1QuoterLatencyMs: 15,
    leg1FeeBps: 5,
    poolLeg2Address: '0x2222222222222222222222222222222222222222',
    dexLeg2: 'aerodrome-slipstream',
    leg2QuoteOutput: 100_300_000n, // 100.30 USDC (0.30% = 30 bps gross profit)
    leg2QuoterLatencyMs: 18,
    leg2FeeBps: 5,
    baseFeeWei: 50_000_000n, // 0.05 Gwei
    ethPriceUsd: 2500,
    baseTokenPriceUsd: 1.0,
    baseTokenDecimals: 6,
  };

  it('simulates a successful profitable round-trip with zero fee double-counting', () => {
    const result = AtomicExecutionSimulator.simulate(defaultParams);

    expect(result.simulated.reverted).toBe(false);
    expect(result.simulated.revertReason).toBe('NONE');
    expect(result.simulated.finalAmountReceived).toBe(100_300_000n);
    expect(result.simulated.grossProfitWei).toBe(300_000n); // 0.30 USDC
    expect(result.simulated.grossSpreadBps).toBe(30);

    // Gas cost: 220,000 units * (0.05 + 0.05 Gwei) = 22,000 Gwei = 0.000022 ETH * $2500 = $0.055
    // Risk buffer: $100 * 0.001 = $0.10
    // Net PnL = $0.30 - $0.055 - $0.10 = ~$0.145 USD
    expect(result.simulated.netPnLUsd).toBeGreaterThan(0.10);
    expect(result.simulated.isProfitableCandidate).toBe(true);
    expect(result.classification).toBe('POTENTIAL_CANDIDATE');
  });

  it('enforces revert economics when Leg 1 suffers excess slippage', () => {
    const result = AtomicExecutionSimulator.simulate({
      ...defaultParams,
      syntheticStressor: {
        adverseSlippageBpsLeg1: 35, // 35 bps slippage > 20 bps max tolerance
      },
    });

    expect(result.simulated.reverted).toBe(true);
    expect(result.simulated.revertReason).toBe('SLIPPAGE_EXCEEDED_LEG1');
    // Capital is 100% preserved (principal returned)
    expect(result.simulated.finalAmountReceived).toBe(defaultParams.initialAmount);
    // But gas is 100% consumed and lost
    expect(result.simulated.netPnLUsd).toBeLessThan(0);
    expect(result.simulated.netPnLUsd).toBe(-result.estimates.gasCostUsd);
    expect(result.simulated.isProfitableCandidate).toBe(false);
    expect(result.classification).toBe('SLIPPAGE_TOO_HIGH');
  });

  it('enforces atomic revert when net output is less than input (protecting principal)', () => {
    const result = AtomicExecutionSimulator.simulate({
      ...defaultParams,
      leg2QuoteOutput: 99_800_000n, // 99.80 USDC (< 100 USDC input)
    });

    expect(result.simulated.reverted).toBe(true);
    expect(result.simulated.revertReason).toBe('NET_LOSS_REVERT');
    expect(result.simulated.finalAmountReceived).toBe(defaultParams.initialAmount);
    expect(result.simulated.netPnLUsd).toBe(-result.estimates.gasCostUsd);
    expect(result.classification).toBe('SPREAD_TOO_SMALL');
  });

  it('reverts immediately upon stale block timeout', () => {
    const result = AtomicExecutionSimulator.simulate({
      ...defaultParams,
      syntheticStressor: {
        staleBlock: true,
      },
    });

    expect(result.simulated.reverted).toBe(true);
    expect(result.simulated.revertReason).toBe('STALE_BLOCK_TIMEOUT');
  });

  it('reverts upon severe gas price spikes exceeding safety caps', () => {
    const result = AtomicExecutionSimulator.simulate({
      ...defaultParams,
      baseFeeWei: 20_000_000_000n, // 20 Gwei > 10 Gwei max cap
    });

    expect(result.simulated.reverted).toBe(true);
    expect(result.simulated.revertReason).toBe('GAS_LIMIT_EXCEEDED');
    expect(result.classification).toBe('GAS_TOO_HIGH');
  });
});

describe('Phase 3 Simulator: Trade Size Optimizer', () => {
  it('identifies fixed gas dominance on micro trade sizes and optimal size Q*', async () => {
    // 30 bps gross spread reference
    const microLeg1Out = 400_000_000_000_000n; // $1 of WETH
    const microLeg2Out = 1_003_000n; // $1.003 (30 bps gross spread)

    const result = await TradeSizeOptimizer.optimizeTradeSize({
      routeId: 'test_opt_route',
      routeName: 'UniV3 -> Aero',
      chain: 'base',
      blockNumber: 51360000n,
      baseFeeWei: 50_000_000n,
      ethPriceUsd: 2500,
      baseTokenPriceUsd: 1.0,
      baseTokenDecimals: 6,
      poolLeg1Address: '0x1111111111111111111111111111111111111111',
      dexLeg1: 'uniswap-v3',
      leg1FeeBps: 5,
      poolLeg2Address: '0x2222222222222222222222222222222222222222',
      dexLeg2: 'aerodrome-slipstream',
      leg2FeeBps: 5,
      microQuoteLeg1Out: microLeg1Out,
      microQuoteLeg2Out: microLeg2Out,
      sweepSizesUsd: [1, 5, 10, 25, 50, 100, 250, 500],
    });

    expect(result.testedSizes.length).toBe(8);

    // Size $1 should be unprofitable because fixed gas (~$0.055) exceeds 30 bps gross profit ($0.003)
    const size1 = result.testedSizes.find(s => s.tradeSizeUsd === 1);
    expect(size1).toBeDefined();
    expect(size1!.isProfitable).toBe(false);
    expect(size1!.netPnLUsd).toBeLessThan(0);

    // Optimal size should be identified
    expect(result.optimalSizeUsd).not.toBeNull();
    expect(result.maxNetPnLUsd).toBeGreaterThan(0);
  });
});

describe('Phase 3 Simulator: Shadow / Paper Execution Engine', () => {
  it('manages paper portfolio ledger without live network calls', () => {
    const shadow = new ShadowExecutionEngine(100.0);
    const initial = shadow.getAccountState();
    expect(initial.currentCashBalanceUsd).toBe(100.0);
    expect(initial.tradesAttempted).toBe(0);

    // Create a mock winning simulation
    const mockWin = {
      simulationId: 'sim_test_win',
      routeId: 'route_win',
      timestampMs: Date.now(),
      tradeSizeUsd: 25,
      observed: { blockNumber: 51360000n },
      estimates: { gasCostUsd: 0.05 },
      simulated: {
        isProfitableCandidate: true,
        reverted: false,
        revertReason: 'NONE',
        grossSpreadBps: 40,
        netPnLUsd: 0.15,
      },
    } as unknown as CompleteSimulationResult;

    const trade = shadow.executeShadowTrade(mockWin);
    expect(trade).not.toBeNull();
    expect(trade!.reverted).toBe(false);

    const afterWin = shadow.getAccountState();
    expect(afterWin.tradesAttempted).toBe(1);
    expect(afterWin.tradesFilled).toBe(1);
    expect(afterWin.currentCashBalanceUsd).toBe(100.15);
    expect(afterWin.winRate).toBe(100.0);

    // Create a mock reverted simulation (revert on slippage)
    const mockRevert = {
      simulationId: 'sim_test_revert',
      routeId: 'route_revert',
      timestampMs: Date.now(),
      tradeSizeUsd: 25,
      observed: { blockNumber: 51360001n },
      estimates: { gasCostUsd: 0.05 },
      simulated: {
        isProfitableCandidate: true,
        reverted: true,
        revertReason: 'SLIPPAGE_EXCEEDED_LEG2',
        grossSpreadBps: 0,
        netPnLUsd: -0.05,
      },
    } as unknown as CompleteSimulationResult;

    const revertTrade = shadow.executeShadowTrade(mockRevert);
    expect(revertTrade).not.toBeNull();
    expect(revertTrade!.reverted).toBe(true);

    const afterRevert = shadow.getAccountState();
    expect(afterRevert.tradesAttempted).toBe(2);
    expect(afterRevert.tradesFilled).toBe(1);
    expect(afterRevert.tradesReverted).toBe(1);
    expect(afterRevert.currentCashBalanceUsd).toBeCloseTo(100.10, 2); // 100.15 - 0.05
    expect(afterRevert.winRate).toBe(50.0);
  });
});

describe('Phase 3 Simulator: Mathematical Determinism & Invariant Checks', () => {
  it('produces 100% identical outputs for identical simulation inputs', () => {
    const params = {
      routeId: 'det_route',
      routeName: 'Aero -> UniV3',
      chain: 'base',
      blockNumber: 51360050n,
      timestampMs: 1726480000000,
      tradeSizeUsd: 50,
      initialAmount: 50n * 10n ** 6n,
      poolLeg1Address: '0x1111111111111111111111111111111111111111',
      dexLeg1: 'aerodrome-slipstream',
      leg1QuoteOutput: 20_000_000_000_000_000n,
      leg1QuoterLatencyMs: 14,
      leg1FeeBps: 5,
      poolLeg2Address: '0x2222222222222222222222222222222222222222',
      dexLeg2: 'uniswap-v3',
      leg2QuoteOutput: 50_200_000n,
      leg2QuoterLatencyMs: 16,
      leg2FeeBps: 5,
      baseFeeWei: 45_000_000n,
      ethPriceUsd: 2500,
      baseTokenPriceUsd: 1.0,
      baseTokenDecimals: 6,
    };

    const run1 = AtomicExecutionSimulator.simulate(params);
    const run2 = AtomicExecutionSimulator.simulate(params);

    expect(run1.simulated.netPnLUsd).toBe(run2.simulated.netPnLUsd);
    expect(run1.simulated.grossProfitWei).toBe(run2.simulated.grossProfitWei);
    expect(run1.simulated.reverted).toBe(run2.simulated.reverted);
    expect(run1.classification).toBe(run2.classification);
  });
});
