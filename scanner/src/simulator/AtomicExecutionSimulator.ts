/**
 * SAHIKARA Phase 3 — Atomic Execution Simulator
 *
 * Simulates the on-chain atomic execution semantics of `ArbitrageExecutor.sol`:
 *
 * 1. ATOMIC TWO-LEG INVARIANT:
 *    - Leg 1: Swaps Q_in -> Q_intermediate. If Q_intermediate < minOutputLeg1, REVERT.
 *    - Leg 2: Swaps Q_intermediate -> Q_final. If Q_final < minOutputLeg2, REVERT.
 *    - Balance Assertion: If Q_final < Q_in + minGrossGain, REVERT.
 *
 * 2. REVERT ECONOMICS:
 *    - On revert: Principal capital is 100% protected (0 token balance loss).
 *    - Gas is NOT protected: 100% of execution gas is consumed and lost to validators.
 *    - Net PnL on revert = -GasCost.
 *
 * 3. SUCCESS ECONOMICS:
 *    - netPnL = Q_final - Q_in - GasCost - OtherCosts - RiskBuffer
 *    - Pool fees are NOT double-counted (Quoter outputs already deduct pool fees).
 *
 * 4. COMPLETE PROVENANCE TAGGING:
 *    - Returns structured output separating [OBSERVED], [QUOTED], [SIMULATED],
 *      [ESTIMATED], and [ASSUMPTION] fields.
 */

import type {
  CompleteSimulationResult,
  ObservedOnChainState,
  QuotedOutput,
  SimulatedExecution,
  EstimatedValues,
  SimulationAssumptions,
  AtomicRevertReason,
} from './types.js';
import type { OpportunityClassification } from '../adapters/IPoolAdapter.js';

export interface SimulateAtomicParams {
  routeId: string;
  routeName: string;
  chain: string;
  blockNumber: bigint;
  timestampMs: number;
  tradeSizeUsd: number;
  initialAmount: bigint;

  // Leg 1 Quoter Data
  poolLeg1Address: string;
  dexLeg1: string;
  leg1QuoteOutput: bigint;
  leg1QuoterLatencyMs: number;
  leg1FeeBps: number;

  // Leg 2 Quoter Data
  poolLeg2Address: string;
  dexLeg2: string;
  leg2QuoteOutput: bigint;
  leg2QuoterLatencyMs: number;
  leg2FeeBps: number;

  // Market & Valuation Environment
  baseFeeWei: bigint;
  ethPriceUsd: number;
  baseTokenPriceUsd: number;
  baseTokenDecimals: number;

  // Operational & Risk Controls
  assumptions?: Partial<SimulationAssumptions>;

  // Optional synthetic stressors for adversarial edge-case testing
  syntheticStressor?: {
    forceRevertLeg1?: boolean;
    forceRevertLeg2?: boolean;
    forceNetLoss?: boolean;
    adverseSlippageBpsLeg1?: number;
    adverseSlippageBpsLeg2?: number;
    gasSpikeMultiplier?: number;
    staleBlock?: boolean;
  };
}

export class AtomicExecutionSimulator {
  public static readonly DEFAULT_ASSUMPTIONS: SimulationAssumptions = {
    maxSlippageToleranceBps: 20,     // 0.20% per RISK_POLICY.md
    minNetProfitUsd: 0.05,           // $0.05 minimum net profit hurdle
    riskBufferFraction: 0.001,       // 0.10% (10 bps) buffer
    simulatedLatencyDelayMs: 150,    // 150ms execution delay assumption
    priorityFeeWei: 50_000_000n,     // 0.05 Gwei priority fee
    maxBaseFeeWei: 10_000_000_000n,  // 10 Gwei max base fee cap
    driftMultiplierPerSec: 2.5,      // 2.5 bps adverse drift per second
  };

  public static readonly TWO_HOP_GAS_UNITS = 220_000n;

  /**
   * Simulates a complete atomic two-hop execution.
   */
  public static simulate(params: SimulateAtomicParams): CompleteSimulationResult {
    const assumptions: SimulationAssumptions = {
      ...this.DEFAULT_ASSUMPTIONS,
      ...params.assumptions,
    };

    const stressor = params.syntheticStressor ?? {};

    // ── 1. Construct [OBSERVED] State ──────────────────────────────────────────
    const observed: ObservedOnChainState = {
      blockNumber: params.blockNumber,
      timestampMs: params.timestampMs,
      baseFeePerGasWei: params.baseFeeWei,
      poolAddress: params.poolLeg1Address,
      dex: params.dexLeg1,
    };

    // ── 2. Construct [QUOTED] Outputs ──────────────────────────────────────────
    const leg1Quote: QuotedOutput = {
      amountIn: params.initialAmount,
      amountOut: params.leg1QuoteOutput,
      feeBps: params.leg1FeeBps,
      quoterLatencyMs: params.leg1QuoterLatencyMs,
    };

    const leg2Quote: QuotedOutput = {
      amountIn: params.leg1QuoteOutput,
      amountOut: params.leg2QuoteOutput,
      feeBps: params.leg2FeeBps,
      quoterLatencyMs: params.leg2QuoterLatencyMs,
    };

    // ── 3. Calculate [ESTIMATED] Values ────────────────────────────────────────
    const multiplier = BigInt(Math.round(stressor.gasSpikeMultiplier ?? 1));
    const effectiveGasPriceWei =
      (params.baseFeeWei * multiplier) + assumptions.priorityFeeWei;

    const estimatedGasUnits = this.TWO_HOP_GAS_UNITS;
    const totalGasCostWei = estimatedGasUnits * effectiveGasPriceWei;

    // Convert gas cost to USD: totalGasCostWei (in native ETH wei) * ethPriceUsd / 1e18
    const totalGasEth = Number(totalGasCostWei) / 1e18;
    const gasCostUsd = totalGasEth * params.ethPriceUsd;

    // Risk buffer in USD and base token units:
    const riskBufferUsd = params.tradeSizeUsd * assumptions.riskBufferFraction;
    const baseTokenUnit = Math.pow(10, params.baseTokenDecimals);
    const riskBufferTokens = params.baseTokenPriceUsd > 0
      ? (riskBufferUsd / params.baseTokenPriceUsd)
      : 0;
    const riskBufferWei = BigInt(Math.round(riskBufferTokens * baseTokenUnit));

    // Convert gas cost to base token units:
    const gasCostInBaseTokens = params.baseTokenPriceUsd > 0
      ? (gasCostUsd / params.baseTokenPriceUsd)
      : 0;
    const gasCostInBaseWei = BigInt(Math.round(gasCostInBaseTokens * baseTokenUnit));

    const estimates: EstimatedValues = {
      estimatedGasUnits,
      effectiveGasPriceWei,
      gasCostWei: gasCostInBaseWei,
      gasCostUsd: Number(gasCostUsd.toFixed(4)),
      baseTokenPriceUsd: params.baseTokenPriceUsd,
      ethPriceUsd: params.ethPriceUsd,
      riskBufferWei,
      riskBufferUsd: Number(riskBufferUsd.toFixed(4)),
    };

    // ── 4. Evaluate [SIMULATED] Execution & Revert Semantics ───────────────────
    let reverted = false;
    let revertReason: AtomicRevertReason = 'NONE';
    let revertDetail: string | undefined;

    // Check Stale Block
    if (stressor.staleBlock) {
      reverted = true;
      revertReason = 'STALE_BLOCK_TIMEOUT';
      revertDetail = 'Transaction mined in a block beyond acceptable freshness deadline.';
    }

    // Check Base Fee Cap
    if (!reverted && params.baseFeeWei > assumptions.maxBaseFeeWei) {
      reverted = true;
      revertReason = 'GAS_LIMIT_EXCEEDED';
      revertDetail = `Base fee (${params.baseFeeWei.toString()} wei) exceeds safety cap (${assumptions.maxBaseFeeWei.toString()} wei).`;
    }

    // Leg 1 Execution Simulation
    let leg1SimulatedOutput = params.leg1QuoteOutput;
    let leg1PriceImpactBps = 0;

    if (!reverted) {
      if (stressor.forceRevertLeg1 || leg1SimulatedOutput <= 0n) {
        reverted = true;
        revertReason = 'INSUFFICIENT_LIQUIDITY_LEG1';
        revertDetail = 'Leg 1 liquidity exhausted or pool rejected swap.';
      } else {
        // Apply adverse slippage if configured
        const adverseBps = stressor.adverseSlippageBpsLeg1 ?? 0;
        if (adverseBps > 0) {
          leg1SimulatedOutput = (leg1SimulatedOutput * BigInt(10_000 - adverseBps)) / 10_000n;
          leg1PriceImpactBps += adverseBps;
        }

        // Check if Leg 1 slipped beyond allowed tolerance
        const minOutputLeg1 =
          (params.leg1QuoteOutput * BigInt(10_000 - assumptions.maxSlippageToleranceBps)) / 10_000n;
        if (leg1SimulatedOutput < minOutputLeg1) {
          reverted = true;
          revertReason = 'SLIPPAGE_EXCEEDED_LEG1';
          revertDetail = `Leg 1 output (${leg1SimulatedOutput.toString()}) fell below minimum slippage bound (${minOutputLeg1.toString()}).`;
        }
      }
    }

    // Leg 2 Execution Simulation
    let leg2SimulatedOutput = params.leg2QuoteOutput;
    let leg2PriceImpactBps = 0;

    if (!reverted) {
      if (stressor.forceRevertLeg2 || leg2SimulatedOutput <= 0n) {
        reverted = true;
        revertReason = 'INSUFFICIENT_LIQUIDITY_LEG2';
        revertDetail = 'Leg 2 liquidity exhausted or pool rejected swap.';
      } else {
        // Apply adverse slippage if configured
        const adverseBps = stressor.adverseSlippageBpsLeg2 ?? 0;
        if (adverseBps > 0) {
          leg2SimulatedOutput = (leg2SimulatedOutput * BigInt(10_000 - adverseBps)) / 10_000n;
          leg2PriceImpactBps += adverseBps;
        }

        // Check if Leg 2 slipped beyond allowed tolerance
        const minOutputLeg2 =
          (params.leg2QuoteOutput * BigInt(10_000 - assumptions.maxSlippageToleranceBps)) / 10_000n;
        if (leg2SimulatedOutput < minOutputLeg2) {
          reverted = true;
          revertReason = 'SLIPPAGE_EXCEEDED_LEG2';
          revertDetail = `Leg 2 output (${leg2SimulatedOutput.toString()}) fell below minimum slippage bound (${minOutputLeg2.toString()}).`;
        }
      }
    }

    // Atomic Profit Assertion
    if (!reverted) {
      if (stressor.forceNetLoss || leg2SimulatedOutput <= params.initialAmount) {
        reverted = true;
        revertReason = 'NET_LOSS_REVERT';
        revertDetail = `Atomic balance assertion failed: leg2 output (${leg2SimulatedOutput.toString()}) <= input (${params.initialAmount.toString()}). Reverted to preserve principal.`;
      }
    }

    // Compute PnL according to Revert Economics
    let finalAmountReceived: bigint;
    let grossProfitWei: bigint;
    let netPnLWei: bigint;
    let netPnLUsd: number;
    let grossSpreadBps: number;
    let netProfitBps: number;

    if (reverted) {
      // Principal is returned intact, but gas is lost
      finalAmountReceived = params.initialAmount;
      grossProfitWei = 0n;
      netPnLWei = -gasCostInBaseWei;
      netPnLUsd = -gasCostUsd;
      grossSpreadBps = 0;
      netProfitBps = params.tradeSizeUsd > 0
        ? Math.round((-gasCostUsd / params.tradeSizeUsd) * 10_000)
        : 0;
      leg1SimulatedOutput = 0n;
      leg2SimulatedOutput = 0n;
    } else {
      // Successful execution:
      finalAmountReceived = leg2SimulatedOutput;
      grossProfitWei = leg2SimulatedOutput - params.initialAmount;

      // Net PnL = GrossProfit - Gas - RiskBuffer
      netPnLWei = grossProfitWei - gasCostInBaseWei - riskBufferWei;

      const grossTokens = Number(grossProfitWei) / baseTokenUnit;
      const grossProfitUsd = grossTokens * params.baseTokenPriceUsd;

      netPnLUsd = grossProfitUsd - gasCostUsd - riskBufferUsd;

      grossSpreadBps = params.initialAmount > 0n
        ? Number((grossProfitWei * 10_000n) / params.initialAmount)
        : 0;

      netProfitBps = params.tradeSizeUsd > 0
        ? Math.round((netPnLUsd / params.tradeSizeUsd) * 10_000)
        : 0;
    }

    const totalPriceImpactBps = leg1PriceImpactBps + leg2PriceImpactBps;
    const isProfitableCandidate = !reverted && netPnLUsd >= assumptions.minNetProfitUsd;

    const simulated: SimulatedExecution = {
      reverted,
      revertReason,
      revertDetail,
      leg1SimulatedOutput,
      leg2SimulatedOutput,
      finalAmountReceived,
      leg1PriceImpactBps,
      leg2PriceImpactBps,
      totalPriceImpactBps,
      grossProfitWei,
      grossSpreadBps,
      netPnLWei,
      netPnLUsd: Number(netPnLUsd.toFixed(4)),
      netProfitBps,
      isProfitableCandidate,
    };

    // Determine 8-way OpportunityClassification
    let classification: OpportunityClassification = 'NO_OPPORTUNITY';
    if (isProfitableCandidate) {
      classification = 'POTENTIAL_CANDIDATE';
    } else if (revertReason === 'SLIPPAGE_EXCEEDED_LEG1' || revertReason === 'SLIPPAGE_EXCEEDED_LEG2') {
      classification = 'SLIPPAGE_TOO_HIGH';
    } else if (revertReason === 'INSUFFICIENT_LIQUIDITY_LEG1' || revertReason === 'INSUFFICIENT_LIQUIDITY_LEG2') {
      classification = 'INSUFFICIENT_LIQUIDITY';
    } else if (revertReason === 'GAS_LIMIT_EXCEEDED') {
      classification = 'GAS_TOO_HIGH';
    } else if (revertReason === 'NET_LOSS_REVERT') {
      classification = 'SPREAD_TOO_SMALL';
    } else if (reverted) {
      classification = 'RISK_REJECTED';
    } else if (netPnLUsd < assumptions.minNetProfitUsd) {
      classification = 'SPREAD_TOO_SMALL';
    }

    return {
      simulationId: `sim_${params.routeId}_${params.blockNumber}_${params.initialAmount}_${params.timestampMs}`,
      routeId: params.routeId,
      routeName: params.routeName,
      chain: params.chain,
      timestampMs: params.timestampMs,
      tradeSizeUsd: params.tradeSizeUsd,
      initialAmount: params.initialAmount,
      observed,
      leg1Quote,
      leg2Quote,
      simulated,
      estimates,
      assumptions,
      classification,
    };
  }
}
