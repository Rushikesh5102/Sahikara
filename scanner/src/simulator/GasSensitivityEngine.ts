/**
 * SAHIKARA Phase 3 — Gas Sensitivity Engine
 *
 * Models the sensitivity of net round-trip arbitrage returns to:
 * 1. Base fee per gas volatility (0.01 Gwei to 10.0 Gwei on Base)
 * 2. Miner priority fee / tip variations (0.01 Gwei to 1.0 Gwei)
 * 3. Execution gas consumption variability (120,000 to 350,000 gas units)
 *
 * Implements deterministic break-even calculations:
 *   G_break_even = (GrossProfitUSD - RiskBufferUSD) / (GasUnits * ETH_USD)
 */

import type { GasSensitivityMatrix, GasSensitivityPoint } from './types.js';

export interface GasSensitivityParams {
  routeId: string;
  tradeSizeUsd: number;
  grossProfitUsd: number;
  riskBufferUsd: number;
  ethPriceUsd: number;
  testedBaseFeesGwei?: number[];
  testedGasUnits?: bigint[];
  priorityFeeGwei?: number;
}

export class GasSensitivityEngine {
  public static readonly DEFAULT_BASE_FEES_GWEI = [0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0];
  public static readonly DEFAULT_GAS_UNITS = [150_000n, 220_000n, 300_000n];
  public static readonly DEFAULT_PRIORITY_FEE_GWEI = 0.05;

  /**
   * Generates a complete multi-dimensional gas sensitivity matrix.
   */
  public static generateMatrix(params: GasSensitivityParams): GasSensitivityMatrix {
    const {
      routeId,
      tradeSizeUsd,
      grossProfitUsd,
      riskBufferUsd,
      ethPriceUsd,
      testedBaseFeesGwei = this.DEFAULT_BASE_FEES_GWEI,
      testedGasUnits = this.DEFAULT_GAS_UNITS,
      priorityFeeGwei = this.DEFAULT_PRIORITY_FEE_GWEI,
    } = params;

    const points: GasSensitivityPoint[] = [];

    // Evaluate cross product of base fees and gas units
    for (const baseFee of testedBaseFeesGwei) {
      for (const gasUnits of testedGasUnits) {
        const effectiveGasPriceGwei = baseFee + priorityFeeGwei;
        const totalGasEth = (effectiveGasPriceGwei * 1e-9) * Number(gasUnits);
        const gasCostUsd = totalGasEth * ethPriceUsd;

        const netPnLUsd = grossProfitUsd - gasCostUsd - riskBufferUsd;
        const netProfitBps = tradeSizeUsd > 0
          ? Math.round((netPnLUsd / tradeSizeUsd) * 10_000)
          : 0;

        points.push({
          baseFeeGwei: baseFee,
          gasUnits,
          gasCostUsd,
          netPnLUsd,
          netProfitBps,
          isProfitable: netPnLUsd >= 0.05, // $0.05 threshold per RISK_POLICY.md
        });
      }
    }

    // Calculate break-even base fee at baseline 220k gas units
    const baselineGasUnits = 220_000n;
    const breakEvenBaseFeeGwei = this.calculateBreakEvenBaseFee(
      grossProfitUsd,
      riskBufferUsd,
      baselineGasUnits,
      ethPriceUsd,
      priorityFeeGwei
    );

    // Calculate maximum tolerable gas units at current baseline base fee (e.g. 0.05 Gwei)
    const baselineBaseFeeGwei = 0.05;
    const maxTolerableGasUnits = this.calculateMaxTolerableGasUnits(
      grossProfitUsd,
      riskBufferUsd,
      baselineBaseFeeGwei + priorityFeeGwei,
      ethPriceUsd
    );

    return {
      routeId,
      tradeSizeUsd,
      grossProfitUsd,
      points,
      breakEvenBaseFeeGwei,
      maxTolerableGasUnits,
    };
  }

  /**
   * Calculates the exact base fee (in Gwei) at which net profit equals $0.05.
   */
  public static calculateBreakEvenBaseFee(
    grossProfitUsd: number,
    riskBufferUsd: number,
    gasUnits: bigint,
    ethPriceUsd: number,
    priorityFeeGwei: number = 0.05,
    targetNetProfitUsd: number = 0.05
  ): number | null {
    if (gasUnits <= 0n || ethPriceUsd <= 0) return null;

    const availableForGasUsd = grossProfitUsd - riskBufferUsd - targetNetProfitUsd;
    if (availableForGasUsd <= 0) return 0; // Already unprofitable before gas

    const availableGasEth = availableForGasUsd / ethPriceUsd;
    const effectiveGasPriceGwei = (availableGasEth / Number(gasUnits)) * 1e9;
    const maxBaseFeeGwei = effectiveGasPriceGwei - priorityFeeGwei;

    return Math.max(0, Number(maxBaseFeeGwei.toFixed(4)));
  }

  /**
   * Calculates the maximum gas units a trade can consume before falling below target profit.
   */
  public static calculateMaxTolerableGasUnits(
    grossProfitUsd: number,
    riskBufferUsd: number,
    effectiveGasPriceGwei: number,
    ethPriceUsd: number,
    targetNetProfitUsd: number = 0.05
  ): bigint | null {
    if (effectiveGasPriceGwei <= 0 || ethPriceUsd <= 0) return null;

    const availableForGasUsd = grossProfitUsd - riskBufferUsd - targetNetProfitUsd;
    if (availableForGasUsd <= 0) return 0n;

    const gasPriceEth = effectiveGasPriceGwei * 1e-9;
    const gasCostPerUnitUsd = gasPriceEth * ethPriceUsd;
    if (gasCostPerUnitUsd <= 0) return null;

    const maxUnits = Math.floor(availableForGasUsd / gasCostPerUnitUsd);
    return BigInt(maxUnits);
  }
}
