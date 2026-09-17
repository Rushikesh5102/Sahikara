/**
 * SAHIKARA — Phase 4.13A.1 Clock Domain Separation & Timing Model
 *
 * Formalizes three strictly segregated clock domains:
 *   1. PROTOCOL_TIME: Blockchain protocol-level timestamps from block headers (seconds since Unix epoch).
 *   2. LOCAL_WALL_TIME: Machine operating-system wall-clock timestamps (Date.now(), UTC milliseconds).
 *   3. LOCAL_MONOTONIC_TIME: Machine high-resolution monotonic timer (process.hrtime.bigint(), nanoseconds).
 *
 * CRITICAL RULE:
 * Never subtract timestamps across domains to measure physical or network latency.
 * Specifically:
 *   INVALID: Date.now() - block.timestamp (Conflates clock drift, block quantization, and sequencer seal time).
 *   INVALID: performance.now() - block.timestamp (Different reference origins and units).
 *
 * Capital at risk: ₹0.00 / $0.00 | Execution strictly LOCKED.
 */

export type ClockDomain = 'PROTOCOL_TIME' | 'LOCAL_WALL_TIME' | 'LOCAL_MONOTONIC_TIME';

export interface TimestampMetadata {
  domain: ClockDomain;
  source: string;
  precision: 'seconds' | 'milliseconds' | 'nanoseconds';
  isMonotonic: boolean;
  value: bigint | number;
}

export interface TimestampReferenceDelta {
  localWallTimeMs: number;
  protocolTimeMs: number;
  deltaMs: number;
  classification: 'TIMESTAMP_REFERENCE_DELTA' | 'PROTOCOL_TO_LOCAL_CLOCK_OFFSET';
  epistemicWarning: string;
}

export type EventObservationLatencyStatus = 'UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN';

export class ClockDomainManager {
  /**
   * Captures the current local monotonic timestamp in nanoseconds.
   * Monotonic clock never jumps backward due to NTP adjustments.
   */
  public static nowMonotonicNs(): bigint {
    return process.hrtime.bigint();
  }

  /**
   * Captures the current local wall-clock timestamp in milliseconds.
   * Subject to operating system time adjustments and NTP clock skew.
   */
  public static nowWallClockMs(): number {
    return Date.now();
  }

  /**
   * Measures local elapsed duration between two monotonic nanosecond timestamps.
   * Guaranteed to be non-negative and free from wall-clock skew.
   */
  public static elapsedMonotonicMs(startNs: bigint, endNs: bigint): number {
    if (endNs < startNs) {
      throw new Error(`Monotonic violation: endNs (${endNs}) < startNs (${startNs})`);
    }
    return Number(endNs - startNs) / 1_000_000;
  }

  /**
   * Calculates diagnostic reference delta between local machine wall-clock and on-chain protocol timestamp.
   *
   * IMPORTANT:
   * This value MUST NOT be labeled as "network latency", "RPC latency", or "event latency".
   * It reflects the combined sum of sequencer block-time quantization, batching delay, and NTP clock drift.
   */
  public static calculateReferenceDelta(
    localWallMs: number,
    protocolTimestampSeconds: bigint | number
  ): TimestampReferenceDelta {
    const protocolTimeMs = Number(protocolTimestampSeconds) * 1000;
    const deltaMs = localWallMs - protocolTimeMs;

    return {
      localWallTimeMs: localWallMs,
      protocolTimeMs,
      deltaMs,
      classification: 'TIMESTAMP_REFERENCE_DELTA',
      epistemicWarning:
        'This delta reflects protocol block quantization and clock-reference differences between the sequencer and host OS. It is NOT a measurement of network latency or RPC transit time.',
    };
  }

  /**
   * Validates whether two timestamps belong to the same clock domain before comparison.
   */
  public static assertSameDomain(a: TimestampMetadata, b: TimestampMetadata): void {
    if (a.domain !== b.domain) {
      throw new Error(
        `Clock Domain Violation: Attempted to compare ${a.domain} with ${b.domain}. Cross-domain subtraction is prohibited.`
      );
    }
  }

  /**
   * Formally classifies event observation latency when no external synchronized origin exists.
   */
  public static getObservationLatencyClassification(): EventObservationLatencyStatus {
    return 'UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN';
  }
}
