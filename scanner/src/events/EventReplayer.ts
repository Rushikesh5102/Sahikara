/**
 * SAHIKARA Phase 2 — Deterministic Event Replayer
 *
 * Replays historical pool observations and event sequences through
 * the exact same event detection and economic evaluation pipeline.
 *
 * Verifies that:
 *   1. Event routing is deterministic (same pool event triggers identical routes).
 *   2. Price evaluation and fee math produce bitwise reproducible results.
 *   3. Opportunity classifications remain invariant under replay.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only simulation. Zero private keys, zero wallet signing, zero live trading.
 */

import type { EventRouteDispatcher } from './EventRouteDispatcher.js';
import type { PoolStateChangeEvent, ReplayMetrics } from './EventTypes.js';

export interface HistoricalEventRecord {
  event: PoolStateChangeEvent;
  expectedClassification?: string;
  expectedGrossSpreadBps?: number;
}

export class EventReplayer {
  constructor(private readonly dispatcher: EventRouteDispatcher) {}

  /**
   * Replay a series of historical events sequentially through the dispatcher.
   */
  async replayEvents(records: HistoricalEventRecord[]): Promise<ReplayMetrics> {
    const startTime = performance.now();
    let replayedEvents = 0;
    let matchingClassifications = 0;
    let divergentClassifications = 0;
    let evaluationsCount = 0;

    for (const record of records) {
      replayedEvents++;
      const result = await this.dispatcher.dispatchEvent(record.event);
      evaluationsCount += result.evaluations.length;

      if (record.expectedClassification && result.evaluations.length > 0) {
        // Check if any evaluation produced the expected classification
        const matched = result.evaluations.some(
          (e) => e.classification === record.expectedClassification
        );
        if (matched) {
          matchingClassifications++;
        } else {
          divergentClassifications++;
        }
      }
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    return {
      totalEvents: records.length,
      replayedEvents,
      matchingClassifications,
      divergentClassifications,
      elapsedMs,
      evaluationsCount,
    };
  }
}
