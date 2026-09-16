/**
 * SAHIKARA — Phase 4.8 Opportunity Persistence Engine
 *
 * Tracks empirical opportunity persistence across time and blocks.
 *
 * CRITICAL INVARIANTS:
 * 1. If no positive opportunity is detected, opportunity lifetime MUST be reported as "UNKNOWN".
 *    Zero ms (0 ms) or arbitrary synthetic numbers must NEVER be fabricated.
 * 2. Only actual re-quotes and observed state changes count toward persistence duration.
 */

export interface CandidatePersistenceRecord {
  candidateId: string;
  routeId: string;
  chain: string;
  firstPositiveBlock: bigint;
  firstPositiveTimestamp: number;
  peakPositiveBlock: bigint;
  peakGrossBps: number;
  peakNetBps: number;
  lastPositiveBlock: bigint;
  lastPositiveTimestamp: number;
  durationMs: number;
  numberOfPositiveObservations: number;
  numberOfRequotes: number;
  minimumObservedNetBps: number;
  maximumObservedNetBps: number;
  terminationReason:
    | 'SPREAD_BECAME_NEGATIVE'
    | 'ROUTE_INVALID'
    | 'LIQUIDITY_CHANGED'
    | 'QUOTE_FAILED'
    | 'OBSERVATION_WINDOW_ENDED'
    | 'ACTIVE';
}

export interface RequoteObservation {
  blockNumber: bigint;
  timestampMs: number;
  grossSpreadBps: number;
  netProfitBps: number;
  isSuccessfulQuote: boolean;
  liquidityUsd?: number;
}

export class OpportunityPersistenceEngine {
  private activeCandidates = new Map<string, CandidatePersistenceRecord>();
  private completedCandidates: CandidatePersistenceRecord[] = [];
  private totalOpportunitiesTracked = 0;

  /**
   * Registers or updates an observation for a specific route.
   */
  public recordObservation(params: {
    routeId: string;
    chain: string;
    observation: RequoteObservation;
    windowTimeoutMs?: number;
  }): CandidatePersistenceRecord | null {
    const { routeId, chain, observation, windowTimeoutMs = 60_000 } = params;
    this.totalOpportunitiesTracked++;

    const isPositive = observation.isSuccessfulQuote && observation.grossSpreadBps > 0 && observation.netProfitBps > 0;
    const existing = this.activeCandidates.get(routeId);

    if (existing) {
      existing.numberOfRequotes++;

      // Check termination conditions
      const timeSinceFirst = observation.timestampMs - existing.firstPositiveTimestamp;
      if (timeSinceFirst > windowTimeoutMs) {
        existing.terminationReason = 'OBSERVATION_WINDOW_ENDED';
        this.activeCandidates.delete(routeId);
        this.completedCandidates.push(existing);
        return existing;
      }

      if (!observation.isSuccessfulQuote) {
        existing.terminationReason = 'QUOTE_FAILED';
        this.activeCandidates.delete(routeId);
        this.completedCandidates.push(existing);
        return existing;
      }

      if (!isPositive) {
        existing.terminationReason = 'SPREAD_BECAME_NEGATIVE';
        this.activeCandidates.delete(routeId);
        this.completedCandidates.push(existing);
        return existing;
      }

      // Still positive! Update stats
      existing.numberOfPositiveObservations++;
      existing.lastPositiveBlock = observation.blockNumber;
      existing.lastPositiveTimestamp = observation.timestampMs;
      existing.durationMs = existing.lastPositiveTimestamp - existing.firstPositiveTimestamp;

      if (observation.netProfitBps > existing.peakNetBps) {
        existing.peakNetBps = observation.netProfitBps;
        existing.peakPositiveBlock = observation.blockNumber;
      }
      if (observation.grossSpreadBps > existing.peakGrossBps) {
        existing.peakGrossBps = observation.grossSpreadBps;
      }

      if (observation.netProfitBps < existing.minimumObservedNetBps) {
        existing.minimumObservedNetBps = observation.netProfitBps;
      }
      if (observation.netProfitBps > existing.maximumObservedNetBps) {
        existing.maximumObservedNetBps = observation.netProfitBps;
      }

      return existing;
    } else {
      // New candidate initiation: ONLY start tracking if currently positive
      if (isPositive) {
        const candidateId = `cand:${chain}:${routeId}:${observation.blockNumber}:${observation.timestampMs}`;
        const newRecord: CandidatePersistenceRecord = {
          candidateId,
          routeId,
          chain,
          firstPositiveBlock: observation.blockNumber,
          firstPositiveTimestamp: observation.timestampMs,
          peakPositiveBlock: observation.blockNumber,
          peakGrossBps: observation.grossSpreadBps,
          peakNetBps: observation.netProfitBps,
          lastPositiveBlock: observation.blockNumber,
          lastPositiveTimestamp: observation.timestampMs,
          durationMs: 0,
          numberOfPositiveObservations: 1,
          numberOfRequotes: 1,
          minimumObservedNetBps: observation.netProfitBps,
          maximumObservedNetBps: observation.netProfitBps,
          terminationReason: 'ACTIVE',
        };
        this.activeCandidates.set(routeId, newRecord);
        return newRecord;
      }
      return null;
    }
  }

  /**
   * Finalizes tracking for all remaining active candidates.
   */
  public finalizeAll(): void {
    for (const [routeId, cand] of this.activeCandidates.entries()) {
      if (cand.terminationReason === 'ACTIVE') {
        cand.terminationReason = 'OBSERVATION_WINDOW_ENDED';
      }
      this.completedCandidates.push(cand);
      this.activeCandidates.delete(routeId);
    }
  }

  /**
   * Returns empirical summary statistics.
   * If zero positive opportunities existed, lifetime report is strictly "UNKNOWN".
   */
  public getSummary(): {
    totalEvaluations: number;
    positiveCandidatesCount: number;
    empiricalLifetimeReport: string;
    averageDurationMs: number | 'UNKNOWN';
    maxDurationMs: number | 'UNKNOWN';
    minDurationMs: number | 'UNKNOWN';
    candidates: CandidatePersistenceRecord[];
  } {
    const allCandidates = [...this.completedCandidates, ...Array.from(this.activeCandidates.values())];
    const positiveCount = allCandidates.length;

    if (positiveCount === 0) {
      return {
        totalEvaluations: this.totalOpportunitiesTracked,
        positiveCandidatesCount: 0,
        empiricalLifetimeReport: 'UNKNOWN (0 positive signals detected in empirical universe)',
        averageDurationMs: 'UNKNOWN',
        maxDurationMs: 'UNKNOWN',
        minDurationMs: 'UNKNOWN',
        candidates: [],
      };
    }

    let totalDuration = 0;
    let maxDuration = -1;
    let minDuration = Infinity;

    for (const c of allCandidates) {
      totalDuration += c.durationMs;
      if (c.durationMs > maxDuration) maxDuration = c.durationMs;
      if (c.durationMs < minDuration) minDuration = c.durationMs;
    }

    return {
      totalEvaluations: this.totalOpportunitiesTracked,
      positiveCandidatesCount: positiveCount,
      empiricalLifetimeReport: `Observed ${positiveCount} candidates, mean duration: ${(totalDuration / positiveCount).toFixed(1)}ms`,
      averageDurationMs: Number((totalDuration / positiveCount).toFixed(2)),
      maxDurationMs: maxDuration,
      minDurationMs: minDuration,
      candidates: allCandidates,
    };
  }
}
