/**
 * SAHIKARA Phase 4.13B — Cross-Venue Clock Model & Domain Segregation
 *
 * Implements strict multi-clock domain tracking across centralized exchanges,
 * decentralized blockchain protocols, and host execution environments.
 *
 * Reuses and expands the forensic findings from Phase 4.13A.1:
 * - EXCHANGE_TIME: Server timestamp reported by CEX (Binance serverTime, Coinbase epoch, Kraken unix).
 * - PROTOCOL_TIME: Block header timestamp reported by consensus (block.timestamp).
 * - LOCAL_WALL_TIME: Machine clock in UTC milliseconds (Date.now()).
 * - LOCAL_MONOTONIC_TIME: Monotonic process clock in milliseconds (performance.now()).
 *
 * INVARIANT: Never subtract timestamps across domains without an explicit calibration model.
 */

export type ClockDomain =
  | 'EXCHANGE_TIME'
  | 'PROTOCOL_TIME'
  | 'LOCAL_WALL_TIME'
  | 'LOCAL_MONOTONIC_TIME';

export interface TimestampedObservation<T> {
  data: T;
  exchangeTimestampMs: number | null;
  protocolTimestampMs: number | null;
  localReceiveWallClockMs: number;
  localReceiveMonotonicMs: number;
}

export class CrossVenueClockModel {
  /**
   * Diagnostic indicator of clock offset between exchange server time and local wall time.
   * MUST NOT be labeled network latency.
   */
  public static calculateExchangeToLocalOffset(
    exchangeTimestampMs: number,
    localWallClockMs: number
  ): { offsetMs: number; label: string } {
    const offsetMs = localWallClockMs - exchangeTimestampMs;
    return {
      offsetMs,
      label: 'EXCHANGE_TO_LOCAL_CLOCK_DELTA',
    };
  }

  /**
   * Measure physical local request/response duration using monotonic clock.
   */
  public static measureMonotonicDurationMs(startMonotonicMs: number, endMonotonicMs: number): number {
    if (endMonotonicMs < startMonotonicMs) {
      throw new Error(
        `[CrossVenueClockModel] Non-monotonic time detected: start=${startMonotonicMs}, end=${endMonotonicMs}`
      );
    }
    return endMonotonicMs - startMonotonicMs;
  }

  /**
   * Diagnostic indicator of protocol to local wall clock offset.
   * Reused from Phase 4.13A.1 ClockDomainManager.
   */
  public static calculateProtocolToLocalOffset(
    protocolTimestampSec: number,
    localWallClockMs: number
  ): { offsetMs: number; label: string } {
    const protocolMs = protocolTimestampSec * 1000;
    const offsetMs = localWallClockMs - protocolMs;
    return {
      offsetMs,
      label: 'TIMESTAMP_REFERENCE_DELTA',
    };
  }

  /**
   * Strictly asserts that durations are not computed across incompatible domains.
   */
  public static assertSameDomain(domainA: ClockDomain, domainB: ClockDomain): void {
    if (domainA !== domainB) {
      throw new Error(
        `[CrossVenueClockModel] Invalid cross-domain subtraction: ${domainA} and ${domainB} cannot be directly subtracted.`
      );
    }
  }
}
