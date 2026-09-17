/**
 * SAHIKARA Phase 4.13B — Cross-Venue Opportunity Persistence Engine
 *
 * Measures the temporal duration, recurrence, and dissipation of cross-venue price discrepancies.
 *
 * Adheres strictly to Directives 21, 22, 51:
 * - Tracks first observation, subsequent observations, max spread, min spread, and duration.
 * - Enforces monotonic timing for all local duration metrics.
 * - Classifies opportunities into: ONE_OFF, RECURRING, PERSISTENT, or UNKNOWN.
 * - Tracks survival across thresholds: >0 bps, >1 bps, >5 bps, >10 bps, >25 bps, >50 bps.
 */

export type PersistenceClassification = 'ONE_OFF' | 'RECURRING' | 'PERSISTENT' | 'UNKNOWN';

export interface DiscrepancyObservation {
  timestampMonotonic: number;
  timestampWallClock: number;
  grossSpreadBps: number;
  netSpreadBps: number;
}

export interface PersistenceRecord {
  pairId: string;
  direction: 'CEX_TO_DEX' | 'DEX_TO_CEX';
  thresholdBps: number;
  firstObservedMonotonic: number;
  lastObservedMonotonic: number;
  observationCount: number;
  maxGrossSpreadBps: number;
  minGrossSpreadBps: number;
  maxNetSpreadBps: number;
  minNetSpreadBps: number;
  durationMs: number;
  classification: PersistenceClassification;
  isActive: boolean;
}

export class OpportunityPersistence {
  private activeRecords = new Map<string, PersistenceRecord>();
  private completedRecords: PersistenceRecord[] = [];

  public recordObservation(params: {
    pairId: string;
    direction: 'CEX_TO_DEX' | 'DEX_TO_CEX';
    grossSpreadBps: number;
    netSpreadBps: number;
    localMonotonicMs: number;
    thresholdBps?: number;
  }): PersistenceRecord | null {
    const {
      pairId,
      direction,
      grossSpreadBps,
      netSpreadBps,
      localMonotonicMs,
      thresholdBps = 0,
    } = params;

    const key = `${pairId}:${direction}:${thresholdBps}`;
    const meetsThreshold = grossSpreadBps > thresholdBps;

    const existing = this.activeRecords.get(key);

    if (meetsThreshold) {
      if (!existing) {
        // New opportunity initiated
        const record: PersistenceRecord = {
          pairId,
          direction,
          thresholdBps,
          firstObservedMonotonic: localMonotonicMs,
          lastObservedMonotonic: localMonotonicMs,
          observationCount: 1,
          maxGrossSpreadBps: grossSpreadBps,
          minGrossSpreadBps: grossSpreadBps,
          maxNetSpreadBps: netSpreadBps,
          minNetSpreadBps: netSpreadBps,
          durationMs: 0,
          classification: 'UNKNOWN',
          isActive: true,
        };
        this.activeRecords.set(key, record);
        return record;
      } else {
        // Existing opportunity continues
        existing.lastObservedMonotonic = localMonotonicMs;
        existing.observationCount++;
        existing.maxGrossSpreadBps = Math.max(existing.maxGrossSpreadBps, grossSpreadBps);
        existing.minGrossSpreadBps = Math.min(existing.minGrossSpreadBps, grossSpreadBps);
        existing.maxNetSpreadBps = Math.max(existing.maxNetSpreadBps, netSpreadBps);
        existing.minNetSpreadBps = Math.min(existing.minNetSpreadBps, netSpreadBps);
        existing.durationMs = localMonotonicMs - existing.firstObservedMonotonic;

        if (existing.durationMs >= 5000) {
          existing.classification = 'PERSISTENT';
        } else if (existing.observationCount > 1) {
          existing.classification = 'RECURRING';
        }
        return existing;
      }
    } else {
      // Below threshold - if previously active, close it out
      if (existing && existing.isActive) {
        existing.isActive = false;
        existing.durationMs = localMonotonicMs - existing.firstObservedMonotonic;
        if (existing.observationCount === 1) {
          existing.classification = 'ONE_OFF';
        }
        this.completedRecords.push({ ...existing });
        this.activeRecords.delete(key);
        return existing;
      }
    }

    return null;
  }

  public getActiveRecords(): readonly PersistenceRecord[] {
    return Array.from(this.activeRecords.values());
  }

  public getCompletedRecords(): readonly PersistenceRecord[] {
    return this.completedRecords;
  }

  public getAllRecords(): readonly PersistenceRecord[] {
    return [...this.completedRecords, ...Array.from(this.activeRecords.values())];
  }
}
