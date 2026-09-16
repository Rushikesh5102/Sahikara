/**
 * SAHIKARA Phase 4.6 — Arbitrum One (42161) Gas Model
 *
 * Arbitrum Nitro gas mechanics differ from OP Stack (Base/Optimism):
 *
 *   Total Transaction Cost = L2 Execution Cost + L1 Data Cost
 *
 * L2 Execution Cost:
 *   gasUnits × (l2BaseFee + priorityFee) × ETH_USD
 *   Where gasUnits includes ArbGas for L1 data amortized by default in Nitro.
 *
 * L1 Data Cost (Arbitrum Nitro):
 *   Arbitrum compresses and posts batches to Ethereum L1.
 *   The precise per-tx L1 cost requires NodeInterface.gasEstimateL1Component()
 *   which is a special Arbitrum precompile read call. For Phase 4.6 research,
 *   we approximate with a flat fee estimate [ESTIMATED] of $0.002–$0.01 USD
 *   depending on L1 blob congestion, analogous to Base's model.
 *
 * LABEL: All cost values are [ESTIMATED] / [PROVISIONAL].
 * The L1 data fee estimate must be empirically calibrated in a future phase.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only estimation. Zero transaction broadcasting.
 */

import type { BaseGasBreakdown } from './types.js';

export interface ArbitrumGasModelOptions {
  /** Execution gas units estimate for 2-hop atomic execution (default: 220,000) [ESTIMATED] */
  defaultExecutionGasUnits?: number;
  /** Priority fee in Gwei (default: 0.1 Gwei — Arbitrum typical) [ESTIMATED] */
  defaultPriorityFeeGwei?: number;
  /**
   * Estimated L1 data fee in USD [ESTIMATED].
   * Arbitrum batches calldata to Ethereum L1. Typical cost ~$0.002–$0.01 per tx.
   * Default: $0.003 [PROVISIONAL — must be empirically calibrated].
   */
  defaultL1DataFeeUsd?: number;
  /** ETH/USD conversion rate (default: $2,500) [ESTIMATED] */
  defaultEthPriceUsd?: number;
}

export class ArbitrumGasModel {
  public readonly executionGasUnits: number;
  public readonly priorityFeeGwei: number;
  public readonly l1DataFeeUsd: number;
  public readonly ethPriceUsd: number;

  constructor(options: ArbitrumGasModelOptions = {}) {
    this.executionGasUnits = options.defaultExecutionGasUnits ?? 220_000;
    this.priorityFeeGwei = options.defaultPriorityFeeGwei ?? 0.1;
    // [PROVISIONAL] L1 data fee flat estimate. Arbitrum actual cost via
    // NodeInterface.gasEstimateL1Component() is deferred to a future calibration phase.
    this.l1DataFeeUsd = options.defaultL1DataFeeUsd ?? 0.003;
    this.ethPriceUsd = options.defaultEthPriceUsd ?? 2500.0;
  }

  /**
   * Calculates Arbitrum transaction gas cost in USD.
   *
   * @param l2BaseFeeGwei  Observed Arbitrum L2 base fee in Gwei
   * @param customGasUnits Optional custom execution gas units
   * @param customEthPriceUsd Optional dynamic ETH price
   * @param customL1DataFeeUsd Optional L1 data fee override [PROVISIONAL]
   */
  calculateGasCost(
    l2BaseFeeGwei: number,
    customGasUnits?: number,
    customEthPriceUsd?: number,
    customL1DataFeeUsd?: number,
  ): BaseGasBreakdown {
    const gasUnits = customGasUnits ?? this.executionGasUnits;
    const ethPrice = customEthPriceUsd ?? this.ethPriceUsd;
    const l1Fee = customL1DataFeeUsd ?? this.l1DataFeeUsd;

    // L2 Execution cost
    const effectiveGasPriceGwei = l2BaseFeeGwei + this.priorityFeeGwei;
    const l2GasCostEth = (gasUnits * effectiveGasPriceGwei) / 1e9;
    const l2GasCostUsd = l2GasCostEth * ethPrice;

    // L1 data cost (flat estimate) [PROVISIONAL]
    const totalGasCostUsd = l2GasCostUsd + l1Fee;

    return {
      executionGasUnits: gasUnits,
      l2BaseFeeGwei,
      priorityFeeGwei: this.priorityFeeGwei,
      l2GasCostUsd,
      l1DataFeeUsd: l1Fee,
      totalGasCostUsd,
      ethPriceUsd: ethPrice,
    };
  }

  /**
   * Analytically derives the break-even Arbitrum L2 base fee.
   */
  calculateBreakEvenBaseFee(
    grossProfitUsd: number,
    riskBufferUsd: number,
    minNetProfitUsd: number = 0.05,
    customGasUnits?: number,
    customEthPriceUsd?: number,
    customL1DataFeeUsd?: number,
  ): { breakEvenBaseFeeGwei: number; isViableAtGas: boolean; maxAllowedGasCostUsd: number } {
    const gasUnits = customGasUnits ?? this.executionGasUnits;
    const ethPrice = customEthPriceUsd ?? this.ethPriceUsd;
    const l1Fee = customL1DataFeeUsd ?? this.l1DataFeeUsd;

    const maxAllowedTotalGasCostUsd = grossProfitUsd - riskBufferUsd - minNetProfitUsd;
    const maxAllowedL2GasCostUsd = maxAllowedTotalGasCostUsd - l1Fee;

    if (maxAllowedL2GasCostUsd <= 0) {
      return {
        breakEvenBaseFeeGwei: 0,
        isViableAtGas: false,
        maxAllowedGasCostUsd: Math.max(0, maxAllowedTotalGasCostUsd),
      };
    }

    const maxEffectiveGasPriceGwei = (maxAllowedL2GasCostUsd * 1e9) / (gasUnits * ethPrice);
    const breakEvenBaseFeeGwei = maxEffectiveGasPriceGwei - this.priorityFeeGwei;

    return {
      breakEvenBaseFeeGwei: Math.max(0, breakEvenBaseFeeGwei),
      isViableAtGas: breakEvenBaseFeeGwei > 0,
      maxAllowedGasCostUsd: maxAllowedTotalGasCostUsd,
    };
  }
}
