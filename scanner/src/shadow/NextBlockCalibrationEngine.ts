/**
 * SAHIKARA Phase 4 — Next-Block Market Calibration Engine
 *
 * Compares predicted opportunity execution against actual next-block market conditions:
 *
 *   Predicted State (Block B) vs Realized State (Block B+1)
 *
 * Calibrates:
 * 1. Spread Decay: How quickly the price dislocation evaporated between blocks.
 * 2. Gas Drift: Difference between predicted base fee and realized base fee.
 * 3. Slippage / Price Impact Error: Difference between predicted and realized marginal price.
 * 4. Opportunity Persistence: Whether the opportunity remained viable into block B+1.
 *
 * CRITICAL TRANSPARENCY PRINCIPLE:
 * Next-block observation is an empirical market-state calibration proxy.
 * It is NOT an assertion that a live transaction would have succeeded or been included.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only calibration. Zero transaction broadcasting.
 */

import type { ShadowOpportunity, NextBlockCalibration } from './types.js';

export interface NextBlockObservationInput {
  observedBlockNumber: bigint;
  observedLeg1Output: bigint;
  observedLeg2Output: bigint;
  observedL2BaseFeeGwei: number;
  observedGasUnits?: number;
  observedL1DataFeeUsd?: number;
}

export class NextBlockCalibrationEngine {
  /**
   * Evaluates the next-block realized market state against the predicted opportunity state.
   */
  public static calibrate(
    opportunity: ShadowOpportunity,
    nextBlockInput: NextBlockObservationInput
  ): NextBlockCalibration {
    const {
      opportunityId,
      triggerBlockNumber,
      tradeSizeUsd,
      initialAmount,
      grossSpreadBps: predictedSpreadBps,
      grossProfitUsd: predictedGrossProfitUsd,
      gasBreakdown,
      netExpectedPnLUsd: predictedNetPnLUsd,
      isSynthetic,
    } = opportunity;

    const {
      observedBlockNumber,
      observedLeg2Output,
      observedL2BaseFeeGwei,
      observedGasUnits = gasBreakdown.executionGasUnits,
      observedL1DataFeeUsd = gasBreakdown.l1DataFeeUsd,
    } = nextBlockInput;

    // Calculate observed gross spread
    let observedSpreadBps = 0;
    let observedGrossProfitUsd = 0;

    if (initialAmount > 0n && observedLeg2Output > 0n) {
      const diffWei = observedLeg2Output - initialAmount;
      observedSpreadBps = (Number(diffWei) / Number(initialAmount)) * 10_000;
      observedGrossProfitUsd = (observedSpreadBps / 10_000) * tradeSizeUsd;
    }

    // Calculate observed gas cost
    const effectiveGasPriceGwei = observedL2BaseFeeGwei + gasBreakdown.priorityFeeGwei;
    const observedL2GasCostEth = (observedGasUnits * effectiveGasPriceGwei) / 1e9;
    const observedL2GasCostUsd = observedL2GasCostEth * gasBreakdown.ethPriceUsd;
    const observedGasCostUsd = observedL2GasCostUsd + observedL1DataFeeUsd;

    // Calculate observed net PnL (Gross - Observed Gas - Risk Buffer)
    const observedNetPnLUsd = observedGrossProfitUsd - observedGasCostUsd - opportunity.riskBufferUsd;

    // Prediction errors
    const spreadPredictionErrorBps = observedSpreadBps - predictedSpreadBps;
    const netPnLPredictionErrorUsd = observedNetPnLUsd - predictedNetPnLUsd;
    const gasPredictionErrorUsd = observedGasCostUsd - gasBreakdown.totalGasCostUsd;

    // Spread decay: how much spread was lost from B to B+1
    const observedSpreadDecayBps = Math.max(0, predictedSpreadBps - observedSpreadBps);

    // Persistence: remained profitable in block B+1
    const opportunityPersisted = observedSpreadBps > 0 && observedNetPnLUsd > 0;

    const calibrationId = `cal_${opportunityId}_b${observedBlockNumber}_${Date.now()}`;

    return {
      calibrationId,
      opportunityId,
      predictedBlockNumber: triggerBlockNumber,
      observedBlockNumber,
      predictedSpreadBps,
      predictedGrossProfitUsd,
      predictedGasCostUsd: gasBreakdown.totalGasCostUsd,
      predictedNetPnLUsd,
      observedSpreadBps,
      observedGrossProfitUsd,
      observedGasCostUsd,
      observedNetPnLUsd,
      spreadPredictionErrorBps,
      netPnLPredictionErrorUsd,
      gasPredictionErrorUsd,
      opportunityPersisted,
      observedSpreadDecayBps,
      isSynthetic,
      calibrationTimestampMs: Date.now(),
      notes: isSynthetic ? '[SYNTHETIC CALIBRATION FIXTURE]' : '[EMPIRICAL CALIBRATION PROXY]',
    };
  }
}
