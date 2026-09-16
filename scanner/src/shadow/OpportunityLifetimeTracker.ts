/**
 * SAHIKARA — Phase 4.7 Opportunity Lifetime Tracker
 *
 * Tracks empirical opportunity lifetime from detection through expiration:
 *   firstObservedAt
 *   firstPositiveAt
 *   peakObservedAt
 *   lastPositiveAt
 *   expiredAt
 *   lifetimeMs
 *   peakGrossBps
 *   peakNetBps
 *   initialNetBps
 *   finalNetBps
 *   numberOfRequotes
 *
 * CRITICAL INVARIANT:
 * If no positive opportunity occurs during a campaign:
 *   lifetime = UNKNOWN
 * Never write "0 ms" unless an actual zero-lifetime opportunity decay was measured.
 */

export interface OpportunityLifetimeRecord {
  routeId: string;
  chain: string;
  firstObservedAt: number;
  firstPositiveAt?: number;
  peakObservedAt?: number;
  lastPositiveAt?: number;
  expiredAt?: number;
  lifetimeMs?: number;
  peakGrossBps: number;
  peakNetBps: number;
  initialNetBps: number;
  finalNetBps: number;
  numberOfRequotes: number;
  isCurrentlyPositive: boolean;
}

export interface OpportunityLifetimeSummary {
  totalOpportunitiesTracked: number;
  positiveOpportunitiesCount: number;
  empiricalLifetimeReport: string; // e.g. "UNKNOWN (0 positive signals detected)" or percentile metrics
  averageLifetimeMs?: number;
  medianLifetimeMs?: number;
  maxLifetimeMs?: number;
  records: OpportunityLifetimeRecord[];
}

export class OpportunityLifetimeTracker {
  private readonly records: Map<string, OpportunityLifetimeRecord> = new Map();

  /**
   * Records a quote evaluation for a route at a specific timestamp.
   */
  public recordObservation(params: {
    routeId: string;
    chain: string;
    grossSpreadBps: number;
    netProfitBps: number;
    timestampMs: number;
  }): void {
    const { routeId, chain, grossSpreadBps, netProfitBps, timestampMs } = params;
    const isPositive = grossSpreadBps > 0 && netProfitBps > 0;

    let rec = this.records.get(routeId);

    if (!rec) {
      rec = {
        routeId,
        chain,
        firstObservedAt: timestampMs,
        peakGrossBps: grossSpreadBps,
        peakNetBps: netProfitBps,
        initialNetBps: netProfitBps,
        finalNetBps: netProfitBps,
        numberOfRequotes: 1,
        isCurrentlyPositive: isPositive,
      };

      if (isPositive) {
        rec.firstPositiveAt = timestampMs;
        rec.peakObservedAt = timestampMs;
        rec.lastPositiveAt = timestampMs;
      }

      this.records.set(routeId, rec);
      return;
    }

    // Update existing record
    rec.numberOfRequotes++;
    rec.finalNetBps = netProfitBps;

    if (grossSpreadBps > rec.peakGrossBps) {
      rec.peakGrossBps = grossSpreadBps;
    }
    if (netProfitBps > rec.peakNetBps) {
      rec.peakNetBps = netProfitBps;
      rec.peakObservedAt = timestampMs;
    }

    if (isPositive) {
      if (!rec.firstPositiveAt) {
        rec.firstPositiveAt = timestampMs;
      }
      rec.lastPositiveAt = timestampMs;
      rec.isCurrentlyPositive = true;
    } else {
      if (rec.isCurrentlyPositive && rec.firstPositiveAt) {
        // Opportunity has expired (decayed to negative)
        rec.expiredAt = timestampMs;
        rec.lifetimeMs = timestampMs - rec.firstPositiveAt;
      }
      rec.isCurrentlyPositive = false;
    }
  }

  /**
   * Computes summary across all tracked routes.
   */
  public getSummary(): OpportunityLifetimeSummary {
    const allRecords = Array.from(this.records.values());
    const positiveRecords = allRecords.filter((r) => r.firstPositiveAt !== undefined);

    if (positiveRecords.length === 0) {
      return {
        totalOpportunitiesTracked: allRecords.length,
        positiveOpportunitiesCount: 0,
        empiricalLifetimeReport: 'UNKNOWN (0 positive signals detected in empirical universe)',
        records: allRecords,
      };
    }

    const measuredLifetimes = positiveRecords
      .map((r) => r.lifetimeMs)
      .filter((l): l is number => l !== undefined && l > 0);

    let avgLife: number | undefined;
    let medLife: number | undefined;
    let maxLife: number | undefined;

    if (measuredLifetimes.length > 0) {
      const sum = measuredLifetimes.reduce((a, b) => a + b, 0);
      avgLife = sum / measuredLifetimes.length;
      measuredLifetimes.sort((a, b) => a - b);
      medLife = measuredLifetimes[Math.floor(measuredLifetimes.length / 2)];
      maxLife = measuredLifetimes[measuredLifetimes.length - 1];
    }

    return {
      totalOpportunitiesTracked: allRecords.length,
      positiveOpportunitiesCount: positiveRecords.length,
      empiricalLifetimeReport: measuredLifetimes.length > 0
        ? `Empirically measured (N=${measuredLifetimes.length}): avg=${avgLife?.toFixed(1)}ms, med=${medLife}ms, max=${maxLife}ms`
        : 'ACTIVE (opportunities observed positive without decay)',
      averageLifetimeMs: avgLife,
      medianLifetimeMs: medLife,
      maxLifetimeMs: maxLife,
      records: allRecords,
    };
  }
}
