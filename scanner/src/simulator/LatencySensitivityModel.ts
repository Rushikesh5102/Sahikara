/**
 * SAHIKARA — Phase 4.8 Latency Sensitivity Model
 *
 * Evaluates opportunity decay profile PnL(t + Δt) across discrete latency offsets:
 *   [10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1000ms, 2000ms, 5000ms]
 *
 * CRITICAL INVARIANT:
 * Every data point must be strictly classified as:
 *   - 'OBSERVED': Derived from empirical on-chain re-quotes at recorded timestamps.
 *   - 'MODELED': Derived from microstructural pool order flow and tick volatility models.
 *   - 'ASSUMED': Theoretical assumption/boundary test.
 * Under no circumstances may a modeled or assumed decay be reported as empirical.
 */

export const CANONICAL_LATENCY_OFFSETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000] as const;
export type LatencyOffsetMs = (typeof CANONICAL_LATENCY_OFFSETS_MS)[number];

export type DecayDataClassification = 'OBSERVED' | 'MODELED' | 'ASSUMED';

export interface LatencyDecayPoint {
  offsetMs: number;
  expectedGrossBps: number;
  expectedNetBps: number;
  expectedNetProfitUsd: number;
  survivalProbabilityPct: number;
  classification: DecayDataClassification;
  derivationNote: string;
}

export interface LatencySensitivityReport {
  routeId: string;
  chain: string;
  initialGrossBps: number;
  initialNetBps: number;
  initialNetProfitUsd: number;
  tradeSizeUsd: number;
  decayProfile: LatencyDecayPoint[];
  halfLifeMs: number | 'UNKNOWN';
  criticalLatencyThresholdMs: number | 'NEVER_PROFITABLE';
}

export class LatencySensitivityModel {
  /**
   * Evaluates latency sensitivity across discrete offsets.
   * If empirical observations exist, uses OBSERVED points; otherwise, marks as MODELED or ASSUMED.
   */
  public static evaluateDecay(params: {
    routeId: string;
    chain: string;
    initialGrossBps: number;
    initialNetBps: number;
    initialNetProfitUsd: number;
    tradeSizeUsd: number;
    empiricalRequotes?: Array<{ deltaMs: number; grossBps: number; netBps: number }>;
    assumedHalfLifeMs?: number;
  }): LatencySensitivityReport {
    const {
      routeId,
      chain,
      initialGrossBps,
      initialNetBps,
      initialNetProfitUsd,
      tradeSizeUsd,
      empiricalRequotes = [],
      assumedHalfLifeMs = 250, // Typical L2 block / searcher reaction timescale assumption
    } = params;

    const decayProfile: LatencyDecayPoint[] = [];
    let halfLifeMs: number | 'UNKNOWN' = 'UNKNOWN';
    let criticalLatencyThresholdMs: number | 'NEVER_PROFITABLE' = initialNetProfitUsd <= 0 ? 'NEVER_PROFITABLE' : 0;

    const hasEmpirical = empiricalRequotes.length > 0;

    for (const offsetMs of CANONICAL_LATENCY_OFFSETS_MS) {
      // Check if an empirical re-quote exists near this offset (within ±20%)
      const match = empiricalRequotes.find((r) => Math.abs(r.deltaMs - offsetMs) <= offsetMs * 0.25);

      if (match) {
        const netUsd = (match.netBps / 10_000) * tradeSizeUsd;
        decayProfile.push({
          offsetMs,
          expectedGrossBps: Number(match.grossBps.toFixed(4)),
          expectedNetBps: Number(match.netBps.toFixed(4)),
          expectedNetProfitUsd: Number(netUsd.toFixed(4)),
          survivalProbabilityPct: match.netBps > 0 ? 100.0 : 0.0,
          classification: 'OBSERVED',
          derivationNote: `Empirical re-quote observed at Δt=${match.deltaMs}ms`,
        });
      } else {
        // Modeled decay using exponential half-life model: Spread(t) = S0 * 2^(-t / T_half)
        const decayFactor = Math.pow(2, -offsetMs / assumedHalfLifeMs);
        const modeledGross = initialGrossBps * decayFactor;
        const modeledNet = initialNetBps * decayFactor;
        const modeledNetUsd = (modeledNet / 10_000) * tradeSizeUsd;
        const survivalProb = initialNetBps > 0 ? Math.max(0, Math.min(100, Number((decayFactor * 100).toFixed(1)))) : 0;

        decayProfile.push({
          offsetMs,
          expectedGrossBps: Number(modeledGross.toFixed(4)),
          expectedNetBps: Number(modeledNet.toFixed(4)),
          expectedNetProfitUsd: Number(modeledNetUsd.toFixed(4)),
          survivalProbabilityPct: survivalProb,
          classification: hasEmpirical ? 'MODELED' : 'ASSUMED',
          derivationNote: `Exponential microstructural decay model with T_half=${assumedHalfLifeMs}ms [${hasEmpirical ? 'MODELED' : 'ASSUMPTION'}]`,
        });
      }
    }

    if (initialNetProfitUsd > 0) {
      // Find the critical latency threshold where net profit drops below 0
      for (const pt of decayProfile) {
        if (pt.expectedNetProfitUsd > 0) {
          criticalLatencyThresholdMs = pt.offsetMs;
        } else {
          break;
        }
      }
      halfLifeMs = assumedHalfLifeMs;
    }

    return {
      routeId,
      chain,
      initialGrossBps,
      initialNetBps,
      initialNetProfitUsd,
      tradeSizeUsd,
      decayProfile,
      halfLifeMs,
      criticalLatencyThresholdMs,
    };
  }
}
