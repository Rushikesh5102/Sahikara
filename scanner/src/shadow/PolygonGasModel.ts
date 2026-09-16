/**
 * SAHIKARA Phase 4.6 — Polygon (137) Gas Model
 *
 * Polygon is an independent EVM sidechain — NOT an OP Stack rollup.
 * There is NO L1 data fee. Gas cost is solely:
 *
 *   totalGasCost = gasUnits × (baseFee + priorityFee) × MATIC_USD
 *
 * Key differences from BaseGasModel:
 *   - l1DataFeeUsd is always 0.0 (no L1 calldata posting)
 *   - Native gas token is MATIC, not ETH
 *   - MATIC_USD is substantially lower than ETH_USD
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only estimation. Zero transaction broadcasting.
 *
 * All gas values are labeled [ESTIMATED] / [PROVISIONAL].
 * MATIC_USD must be provided by the operator via configuration.
 */

import type { BaseGasBreakdown } from './types.js';

export interface PolygonGasModelOptions {
  /** Execution gas units estimate for 2-hop atomic execution (default: 220,000) [ESTIMATED] */
  defaultExecutionGasUnits?: number;
  /** Miner tip / priority fee in Gwei (default: 30 Gwei — Polygon typical) [ESTIMATED] */
  defaultPriorityFeeGwei?: number;
  /** MATIC/USD exchange rate (default: $0.80) [PROVISIONAL — set by operator] */
  defaultMaticPriceUsd?: number;
  /** Alias for defaultMaticPriceUsd for API compatibility with BaseGasModel */
  defaultEthPriceUsd?: number;
}

export class PolygonGasModel {
  public readonly executionGasUnits: number;
  public readonly priorityFeeGwei: number;
  public readonly maticPriceUsd: number;
  /**
   * L1 data fee is always 0 on Polygon (sidechain, not a rollup).
   * Exposed as a field for API compatibility with BaseGasModel.
   */
  public readonly l1DataFeeUsd: number = 0.0;
  /** Alias ethPriceUsd -> maticPriceUsd for API compatibility with BaseGasModel */
  public get ethPriceUsd(): number { return this.maticPriceUsd; }

  constructor(options: PolygonGasModelOptions = {}) {
    this.executionGasUnits = options.defaultExecutionGasUnits ?? 220_000;
    this.priorityFeeGwei = options.defaultPriorityFeeGwei ?? 30.0;
    this.maticPriceUsd = options.defaultMaticPriceUsd ?? options.defaultEthPriceUsd ?? 0.80;
  }

  /**
   * Calculates total Polygon transaction gas cost in USD.
   *
   * Formula: gasUnits × (baseFee + priorityFee) / 1e9 × MATIC_USD
   * L1 data fee = 0 (not applicable on Polygon).
   *
   * @param l2BaseFeeGwei  Observed Polygon base fee in Gwei
   * @param customGasUnits Optional custom execution gas units
   * @param customMaticPriceUsd Optional dynamic MATIC price
   */
  calculateGasCost(
    l2BaseFeeGwei: number,
    customGasUnits?: number,
    customMaticPriceUsd?: number,
  ): BaseGasBreakdown {
    const gasUnits = customGasUnits ?? this.executionGasUnits;
    const maticPrice = customMaticPriceUsd ?? this.maticPriceUsd;

    // Effective gas price: base fee + priority fee
    const effectiveGasPriceGwei = l2BaseFeeGwei + this.priorityFeeGwei;

    // Execution cost in MATIC, then USD
    const l2GasCostEth = (gasUnits * effectiveGasPriceGwei) / 1e9; // "eth" slot reused for MATIC
    const l2GasCostUsd = l2GasCostEth * maticPrice;

    // No L1 data fee on Polygon
    const totalGasCostUsd = l2GasCostUsd; // l1DataFeeUsd = 0

    return {
      executionGasUnits: gasUnits,
      l2BaseFeeGwei,
      priorityFeeGwei: this.priorityFeeGwei,
      l2GasCostUsd,
      l1DataFeeUsd: 0.0,
      totalGasCostUsd,
      ethPriceUsd: maticPrice, // BaseGasBreakdown.ethPriceUsd field reused for MATIC price
    };
  }

  /**
   * Analytically derives the break-even Polygon base fee.
   */
  calculateBreakEvenBaseFee(
    grossProfitUsd: number,
    riskBufferUsd: number,
    minNetProfitUsd: number = 0.05,
    customGasUnits?: number,
    customMaticPriceUsd?: number,
  ): { breakEvenBaseFeeGwei: number; isViableAtGas: boolean; maxAllowedGasCostUsd: number } {
    const gasUnits = customGasUnits ?? this.executionGasUnits;
    const maticPrice = customMaticPriceUsd ?? this.maticPriceUsd;

    const maxAllowedTotalGasCostUsd = grossProfitUsd - riskBufferUsd - minNetProfitUsd;

    if (maxAllowedTotalGasCostUsd <= 0) {
      return {
        breakEvenBaseFeeGwei: 0,
        isViableAtGas: false,
        maxAllowedGasCostUsd: 0,
      };
    }

    // No L1 fee, so entire budget goes to execution
    const maxEffectiveGasPriceGwei = (maxAllowedTotalGasCostUsd * 1e9) / (gasUnits * maticPrice);
    const breakEvenBaseFeeGwei = maxEffectiveGasPriceGwei - this.priorityFeeGwei;

    return {
      breakEvenBaseFeeGwei: Math.max(0, breakEvenBaseFeeGwei),
      isViableAtGas: breakEvenBaseFeeGwei > 0,
      maxAllowedGasCostUsd: maxAllowedTotalGasCostUsd,
    };
  }
}
