/**
 * SAHIKARA Phase 4.14 — High-Resolution Opportunity Persistence Tracker
 *
 * Tracks opportunity emergence, persistence, and dissipation at sub-second
 * event/update granularity using local monotonic timers.
 */

export interface HighResPersistenceRecord {
  candidateKey: string;
  pairId: string;
  direction: 'DEX_TO_CEX' | 'CEX_TO_DEX';
  firstObservationMonotonicMs: number;
  lastObservationMonotonicMs: number;
  durationMs: number;
  updateCount: number;
  consecutivePositiveCount: number;
  maxGrossEdgeBps: number;
  minGrossEdgeBps: number;
  lastGrossEdgeBps: number;
  isActive: boolean;
  dissipationReason?: 'SPREAD_COMPRESSION' | 'DEX_QUOTE_UPDATE' | 'CEX_BOOK_SHIFT' | 'TIMEOUT';
}

export class HighResolutionPersistence {
  private readonly activeRecords: Map<string, HighResPersistenceRecord> = new Map();
  private readonly completedRecords: HighResPersistenceRecord[] = [];

  public recordObservation(params: {
    pairId: string;
    direction: 'DEX_TO_CEX' | 'CEX_TO_DEX';
    grossEdgeBps: number;
    monotonicMs: number;
  }): void {
    const key = `${params.pairId}:${params.direction}`;
    const existing = this.activeRecords.get(key);

    if (params.grossEdgeBps > 0) {
      if (existing) {
        // Update existing record
        existing.lastObservationMonotonicMs = params.monotonicMs;
        existing.durationMs = Number((params.monotonicMs - existing.firstObservationMonotonicMs).toFixed(2));
        existing.updateCount++;
        existing.consecutivePositiveCount++;
        existing.lastGrossEdgeBps = Number(params.grossEdgeBps.toFixed(4));
        if (params.grossEdgeBps > existing.maxGrossEdgeBps) {
          existing.maxGrossEdgeBps = Number(params.grossEdgeBps.toFixed(4));
        }
        if (params.grossEdgeBps < existing.minGrossEdgeBps) {
          existing.minGrossEdgeBps = Number(params.grossEdgeBps.toFixed(4));
        }
      } else {
        // Form new record
        this.activeRecords.set(key, {
          candidateKey: key,
          pairId: params.pairId,
          direction: params.direction,
          firstObservationMonotonicMs: params.monotonicMs,
          lastObservationMonotonicMs: params.monotonicMs,
          durationMs: 0,
          updateCount: 1,
          consecutivePositiveCount: 1,
          maxGrossEdgeBps: Number(params.grossEdgeBps.toFixed(4)),
          minGrossEdgeBps: Number(params.grossEdgeBps.toFixed(4)),
          lastGrossEdgeBps: Number(params.grossEdgeBps.toFixed(4)),
          isActive: true,
        });
      }
    } else {
      if (existing) {
        // Opportunity dissipated
        existing.isActive = false;
        existing.lastObservationMonotonicMs = params.monotonicMs;
        existing.durationMs = Number((params.monotonicMs - existing.firstObservationMonotonicMs).toFixed(2));
        existing.dissipationReason = 'SPREAD_COMPRESSION';
        this.completedRecords.push({ ...existing });
        this.activeRecords.delete(key);
      }
    }
  }

  public getAllRecords(): HighResPersistenceRecord[] {
    const active = Array.from(this.activeRecords.values()).map((r) => ({ ...r }));
    return [...this.completedRecords, ...active];
  }

  public getStats(): {
    totalTracked: number;
    completedCount: number;
    activeCount: number;
    medianDurationMs: number;
    maxDurationMs: number;
  } {
    const all = this.getAllRecords();
    if (all.length === 0) {
      return { totalTracked: 0, completedCount: 0, activeCount: 0, medianDurationMs: 0, maxDurationMs: 0 };
    }
    const durations = all.map((r) => r.durationMs).sort((a, b) => a - b);
    const medianDurationMs = durations[Math.floor(durations.length / 2)] || 0;
    const maxDurationMs = durations[durations.length - 1] || 0;

    return {
      totalTracked: all.length,
      completedCount: this.completedRecords.length,
      activeCount: this.activeRecords.size,
      medianDurationMs,
      maxDurationMs,
    };
  }
}
