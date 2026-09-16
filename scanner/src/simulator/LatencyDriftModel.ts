/**
 * SAHIKARA Phase 3 — Latency & Opportunity Decay Drift Model
 *
 * Models the erosion of gross spread and net profitability as a function
 * of detection-to-execution latency:
 *
 *   Delta t = t_inclusion - t_detection
 *
 * In decentralized markets, MEV searchers and retail flow cause continuous
 * adverse price drift against stale opportunities.
 *
 * Models:
 *   1. Adverse Price Drift: Delta P_drift(Delta t) = alpha * (Delta t / 1000)^0.75
 *   2. Residual Spread: Spread_residual(Delta t) = Spread_initial - Delta P_drift(Delta t)
 *   3. Opportunity Half-Life: Time t_1/2 where gross spread degrades by 50%
 *   4. Maximum Tolerable Latency: Time t_max before net profit drops below $0.05
 */

import type { LatencySimulationResult, LatencyDriftPoint } from './types.js';

export interface LatencyDriftParams {
  routeId: string;
  initialGrossSpreadBps: number;
  tradeSizeUsd: number;
  gasCostUsd: number;
  riskBufferUsd: number;
  /** Drift rate in BPS per 1000ms (default: 5.0 bps/sec for volatile alts, 1.5 bps/sec for majors) */
  driftRateBpsPerSec?: number;
  testedLatenciesMs?: number[];
  minNetProfitUsd?: number;
}

export class LatencyDriftModel {
  public static readonly DEFAULT_TESTED_LATENCIES_MS = [50, 150, 300, 500, 1000, 2000, 4000];
  public static readonly DEFAULT_DRIFT_BPS_PER_SEC = 2.5;

  /**
   * Evaluates opportunity survival across an array of latency delays.
   */
  public static evaluateLatencyDecay(params: LatencyDriftParams): LatencySimulationResult {
    const {
      routeId,
      initialGrossSpreadBps,
      tradeSizeUsd,
      gasCostUsd,
      riskBufferUsd,
      driftRateBpsPerSec = this.DEFAULT_DRIFT_BPS_PER_SEC,
      testedLatenciesMs = this.DEFAULT_TESTED_LATENCIES_MS,
      minNetProfitUsd = 0.05,
    } = params;

    const points: LatencyDriftPoint[] = [];
    let maxViableLatencyMs = 0;

    // Initial gross profit in USD
    const initialGrossProfitUsd = (initialGrossSpreadBps / 10_000) * tradeSizeUsd;
    const initialNetPnLUsd = initialGrossProfitUsd - gasCostUsd - riskBufferUsd;

    for (const latencyMs of testedLatenciesMs) {
      // Sublinear diffusion drift model: alpha * (t/1000)^0.75
      const timeFractionSec = latencyMs / 1000;
      const adverseDriftBps = Math.round(driftRateBpsPerSec * Math.pow(timeFractionSec, 0.75) * 10) / 10;

      const residualGrossSpreadBps = initialGrossSpreadBps - adverseDriftBps;
      const residualGrossProfitUsd = (residualGrossSpreadBps / 10_000) * tradeSizeUsd;
      const residualNetPnLUsd = residualGrossProfitUsd - gasCostUsd - riskBufferUsd;

      const survived = residualNetPnLUsd >= minNetProfitUsd && residualGrossSpreadBps > 0;
      let dropReason: string | undefined;

      if (!survived) {
        if (residualGrossSpreadBps <= 0) {
          dropReason = 'SPREAD_INVERTED_BY_DRIFT';
        } else if (residualNetPnLUsd < minNetProfitUsd) {
          dropReason = 'NET_PROFIT_BELOW_THRESHOLD';
        }
      } else {
        if (latencyMs > maxViableLatencyMs) {
          maxViableLatencyMs = latencyMs;
        }
      }

      points.push({
        latencyMs,
        adverseDriftBps,
        residualGrossSpreadBps,
        residualNetPnLUsd: Number(residualNetPnLUsd.toFixed(4)),
        survived,
        dropReason,
      });
    }

    // Calculate theoretical half-life of the gross spread:
    // When adverseDriftBps == initialGrossSpreadBps / 2
    // initialGrossSpreadBps / 2 = driftRate * (t_half / 1000)^0.75
    let halfLifeMs: number | null = null;
    if (initialGrossSpreadBps > 0 && driftRateBpsPerSec > 0) {
      const halfTarget = initialGrossSpreadBps / 2;
      const ratio = halfTarget / driftRateBpsPerSec;
      if (ratio > 0) {
        const tHalfSec = Math.pow(ratio, 1 / 0.75);
        halfLifeMs = Math.round(tHalfSec * 1000);
      }
    }

    return {
      routeId,
      initialGrossSpreadBps,
      initialNetPnLUsd: Number(initialNetPnLUsd.toFixed(4)),
      points,
      halfLifeMs,
      maxViableLatencyMs,
    };
  }
}
