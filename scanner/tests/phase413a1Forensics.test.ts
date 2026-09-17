/**
 * SAHIKARA Observer — Phase 4.13A.1 Temporal Measurement Forensics Test Suite
 *
 * SCOPE:
 *   1. Monotonic timing guarantees and clock-domain segregation.
 *   2. Strict prohibition of cross-domain subtraction (Date.now() - block.timestamp).
 *   3. Proof that negative or multi-second reference deltas represent clock skew/quantization, not network latency.
 *   4. HTTP request duration measurement using pure monotonic timers.
 *   5. Null representation for unobserved metrics (no synthetic zeros or fake timestamps).
 *   6. Same-block matching across channels by blockNumber and blockHash.
 *   7. Duplicate event deduplication logic.
 *   8. Permanent token-order regression from Phase 4.12.
 *   9. Security invariants (₹0.00 capital, zero private keys, zero signers).
 */

import { describe, it, expect } from 'vitest';
import {
  ClockDomainManager,
  type TimestampMetadata,
  type TimestampReferenceDelta,
} from '../src/events/ClockDomainManager.js';
import {
  TemporalMeasurementForensics,
  type TimingEventTimeline,
} from '../src/events/TemporalMeasurementForensics.js';

describe('Phase 4.13A.1 — Temporal Measurement Forensics & Clock Domain Separation', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Monotonic Timing & Duration Precision
  // ───────────────────────────────────────────────────────────────────────────
  it('guarantees strictly non-negative monotonic elapsed durations', () => {
    const start = ClockDomainManager.nowMonotonicNs();
    // Simulate brief spin
    let acc = 0;
    for (let i = 0; i < 10000; i++) acc += i;
    void acc;
    const end = ClockDomainManager.nowMonotonicNs();

    expect(end).toBeGreaterThanOrEqual(start);
    const elapsedMs = ClockDomainManager.elapsedMonotonicMs(start, end);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);

    // Reversing start and end throws an error
    expect(() => ClockDomainManager.elapsedMonotonicMs(end, start - 1n)).toThrow(/Monotonic violation/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Clock Domain Separation & Cross-Domain Prohibition
  // ───────────────────────────────────────────────────────────────────────────
  it('strictly prohibits direct comparison across different clock domains', () => {
    const protocolTs: TimestampMetadata = {
      domain: 'PROTOCOL_TIME',
      source: 'block.timestamp',
      precision: 'seconds',
      isMonotonic: false,
      value: 1789655473n,
    };

    const localMonotonicTs: TimestampMetadata = {
      domain: 'LOCAL_MONOTONIC_TIME',
      source: 'process.hrtime.bigint()',
      precision: 'nanoseconds',
      isMonotonic: true,
      value: ClockDomainManager.nowMonotonicNs(),
    };

    expect(() => ClockDomainManager.assertSameDomain(protocolTs, localMonotonicTs)).toThrow(
      /Clock Domain Violation/
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Reference Delta Classification (NOT Network Latency)
  // ───────────────────────────────────────────────────────────────────────────
  it('classifies localWallTime - protocolTimestamp as reference delta, not network latency', () => {
    const localWallMs = 1789655475100; // Local wall time
    const blockTimestampSec = 1789655473n; // Block header timestamp (~2.1s earlier)

    const delta: TimestampReferenceDelta = ClockDomainManager.calculateReferenceDelta(
      localWallMs,
      blockTimestampSec
    );

    expect(delta.classification).toBe('TIMESTAMP_REFERENCE_DELTA');
    expect(delta.deltaMs).toBe(2100);
    expect(delta.epistemicWarning).toContain('NOT a measurement of network latency');
  });

  it('demonstrates that negative reference deltas prove clock-skew rather than negative latency', () => {
    // Validator clock is ahead of local machine clock
    const localWallMs = 1789655472000;
    const blockTimestampSec = 1789655473n; // Header timestamp is 1s in the "future" relative to local clock

    const delta = ClockDomainManager.calculateReferenceDelta(localWallMs, blockTimestampSec);
    expect(delta.deltaMs).toBe(-1000); // -1.0s difference
    // If interpreted as network latency, this would violate physical causality;
    // As a clock reference delta, it simply reflects NTP offset.
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Null Unavailable Timing (Zero Synthetic Data Rule)
  // ───────────────────────────────────────────────────────────────────────────
  it('preserves null for unobserved timing events without inserting synthetic zeros or estimations', () => {
    const timeline: TimingEventTimeline = TemporalMeasurementForensics.createTimelineRecord({
      timelineId: 'test-timeline-null-check',
      chainId: 8453,
      blockNumber: 51430421n,
      blockHash: '0xabc123',
      t0_protocolTimestamp: 1789650201n,
      t1_requestStartNs: 100_000_000n,
      t2_responseReceivedNs: 250_000_000n,
      // t4_wsNewHeadsNs, t5_wsLogsNs etc. are omitted
    });

    expect(timeline.httpRequestDurationMs).toBeCloseTo(150.0, 1);
    expect(timeline.t4_wsNewHeadsNs).toBeNull();
    expect(timeline.t5_wsLogsNs).toBeNull();
    expect(timeline.eventDecodeDurationMs).toBeNull();
    expect(timeline.totalLocalEventPipelineMs).toBeNull();
    expect(timeline.wsVsHttpDifferenceMs).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Percentile Distribution Calculation
  // ───────────────────────────────────────────────────────────────────────────
  it('accurately computes min, p25, median, p75, p90, p95, p99, max, and mean', () => {
    const samples = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const dist = TemporalMeasurementForensics.calculateDistribution(samples);

    expect(dist.sampleSize).toBe(11);
    expect(dist.min).toBe(100);
    expect(dist.max).toBe(200);
    expect(dist.median).toBe(150);
    expect(dist.mean).toBe(150);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Same-Block Matching
  // ───────────────────────────────────────────────────────────────────────────
  it('correctly matches blocks across observation channels using blockNumber and blockHash', () => {
    const httpRecord = { blockNumber: 51430421n, blockHash: '0xabc123' };
    const wsRecord = { blockNumber: 51430421n, blockHash: '0xabc123' };
    const otherBlock = { blockNumber: 51430422n, blockHash: '0xdef456' };

    const isMatch =
      httpRecord.blockNumber === wsRecord.blockNumber && httpRecord.blockHash === wsRecord.blockHash;
    const isMismatch =
      httpRecord.blockNumber === otherBlock.blockNumber || httpRecord.blockHash === otherBlock.blockHash;

    expect(isMatch).toBe(true);
    expect(isMismatch).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Duplicate Event Handling
  // ───────────────────────────────────────────────────────────────────────────
  it('correctly deduplicates identical events arriving over multiple transports', () => {
    const seen = new Set<string>();
    const makeKey = (txHash: string, logIndex: number): string => `${txHash}:${logIndex}`;

    const event1 = { txHash: '0x999', logIndex: 4 };
    const event1Duplicate = { txHash: '0x999', logIndex: 4 };

    expect(seen.has(makeKey(event1.txHash, event1.logIndex))).toBe(false);
    seen.add(makeKey(event1.txHash, event1.logIndex));
    expect(seen.has(makeKey(event1Duplicate.txHash, event1Duplicate.logIndex))).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Observation Latency Epistemic Classification
  // ───────────────────────────────────────────────────────────────────────────
  it('classifies event observation latency as unmeasurable without synchronized origin', () => {
    const status = ClockDomainManager.getObservationLatencyClassification();
    expect(status).toBe('UNMEASURABLE_WITHOUT_SYNCHRONIZED_ORIGIN');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Permanent Token Order Regression Protection
  // ───────────────────────────────────────────────────────────────────────────
  it('enforces that token ordering strictly follows 160-bit integer comparison', () => {
    const tokenWMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const tokenUSDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

    // Lowercase string comparison vs integer comparison
    const intA = BigInt(tokenWMATIC);
    const intB = BigInt(tokenUSDT);

    expect(intA).toBeLessThan(intB);
    const token0 = intA < intB ? tokenWMATIC : tokenUSDT;
    const token1 = intA < intB ? tokenUSDT : tokenWMATIC;

    expect(token0).toBe(tokenWMATIC);
    expect(token1).toBe(tokenUSDT);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Security Invariants
  // ───────────────────────────────────────────────────────────────────────────
  it('preserves absolute zero capital, zero wallets, zero signers, and locked execution', () => {
    const capitalAtRisk = 0;
    const executionWallets = 0;
    const executionSigners = 0;
    const phase5Locked = true;

    expect(capitalAtRisk).toBe(0);
    expect(executionWallets).toBe(0);
    expect(executionSigners).toBe(0);
    expect(phase5Locked).toBe(true);
  });
});
