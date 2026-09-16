/**
 * SAHIKARA Phase 4 — Base OP Stack L2 Gas & L1 Data Fee Model
 *
 * Implements granular gas modeling specifically tailored for Base (OP Stack L2):
 *
 *   Total Transaction Cost = L2 Execution Cost + L1 Data Fee (Calldata/Blob)
 *
 * Components:
 * 1. L2 Execution Gas:
 *    G_exec * (f_l2_base + f_priority) * P_ETH
 *    Default G_exec = 220,000 gas units for a 2-hop atomic round trip.
 *
 * 2. L1 Data Fee (OP Stack Ecotone/Fjord Upgrade):
 *    On Base, batch transactions are compressed and posted to Ethereum L1 as blobs.
 *    Estimated calldata for a 2-hop multi-pool router call = ~320 bytes.
 *    Estimated L1 data fee = [ESTIMATED] ~$0.001 - $0.005 depending on L1 blob congestion.
 *
 * 3. Break-Even L2 Base Fee Derivation:
 *    f_base* = (GrossProfit - RiskBuffer - MinProfit - L1DataFee) / (G_exec * P_ETH) - f_priority
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only estimation. Zero transaction broadcasting.
 */

import type { BaseGasBreakdown } from './types.js';

export interface BaseGasModelOptions {
  /** Execution gas units estimate for 2-hop atomic execution (default: 220,000) [ESTIMATED] */
  defaultExecutionGasUnits?: number;
  /** Miner tip / priority fee in Gwei (default: 0.05 Gwei) [ASSUMPTION] */
  defaultPriorityFeeGwei?: number;
  /** Estimated L1 data fee in USD for ~320 bytes calldata (default: $0.002) [ESTIMATED] */
  defaultL1DataFeeUsd?: number;
  /** ETH/USD conversion rate (default: $2,500) [ESTIMATED] */
  defaultEthPriceUsd?: number;
}

export class BaseGasModel {
  public readonly executionGasUnits: number;
  public readonly priorityFeeGwei: number;
  public readonly l1DataFeeUsd: number;
  public readonly ethPriceUsd: number;

  constructor(options: BaseGasModelOptions = {}) {
    this.executionGasUnits = options.defaultExecutionGasUnits ?? 220_000;
    this.priorityFeeGwei = options.defaultPriorityFeeGwei ?? 0.05;
    this.l1DataFeeUsd = options.defaultL1DataFeeUsd ?? 0.002;
    this.ethPriceUsd = options.defaultEthPriceUsd ?? 2500.0;
  }

  /**
   * Decomposes total gas cost into L2 execution fee and L1 data fee.
   *
   * @param l2BaseFeeGwei Observed or estimated L2 base fee in Gwei
   * @param customGasUnits Optional custom execution gas units
   * @param customEthPriceUsd Optional dynamic ETH price
   * @param customL1DataFeeUsd Optional dynamic L1 data fee
   */
  calculateGasCost(
    l2BaseFeeGwei: number,
    customGasUnits?: number,
    customEthPriceUsd?: number,
    customL1DataFeeUsd?: number
  ): BaseGasBreakdown {
    const gasUnits = customGasUnits ?? this.executionGasUnits;
    const ethPrice = customEthPriceUsd ?? this.ethPriceUsd;
    const l1Fee = customL1DataFeeUsd ?? this.l1DataFeeUsd;

    // Effective L2 gas price: base fee + priority fee
    const effectiveGasPriceGwei = l2BaseFeeGwei + this.priorityFeeGwei;

    // L2 Gas Cost in ETH: gasUnits * effectiveGasPrice (in Gwei) * 1e-9
    const l2GasCostEth = (gasUnits * effectiveGasPriceGwei) / 1e9;
    const l2GasCostUsd = l2GasCostEth * ethPrice;

    // Total transaction cost
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
   * Analytically derives the break-even L2 base fee including L1 data fee.
   *
   * @param grossProfitUsd Gross gain from cycle (Q_final - Q_in)
   * @param riskBufferUsd Risk reserve in USD
   * @param minNetProfitUsd Minimum net profit hurdle in USD
   * @param customGasUnits Execution gas units
   * @param customEthPriceUsd ETH price in USD
   * @param customL1DataFeeUsd L1 data fee in USD
   */
  calculateBreakEvenBaseFee(
    grossProfitUsd: number,
    riskBufferUsd: number,
    minNetProfitUsd: number = 0.05,
    customGasUnits?: number,
    customEthPriceUsd?: number,
    customL1DataFeeUsd?: number
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

    // maxL2CostUsd = (gasUnits * (f_base + f_priority) / 1e9) * ethPrice
    // (f_base + f_priority) = (maxL2CostUsd * 1e9) / (gasUnits * ethPrice)
    const maxEffectiveGasPriceGwei = (maxAllowedL2GasCostUsd * 1e9) / (gasUnits * ethPrice);
    const breakEvenBaseFeeGwei = maxEffectiveGasPriceGwei - this.priorityFeeGwei;

    return {
      breakEvenBaseFeeGwei: Math.max(0, breakEvenBaseFeeGwei),
      isViableAtGas: breakEvenBaseFeeGwei > 0,
      maxAllowedGasCostUsd: maxAllowedTotalGasCostUsd,
    };
  }
}
