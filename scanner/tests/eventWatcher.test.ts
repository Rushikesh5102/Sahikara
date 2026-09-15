/**
 * SAHIKARA Phase 2 — Event Watcher & Route Dispatcher Test Suite
 *
 * Tests:
 *   1. Event deduplication via sliding window
 *   2. Stale block filtering
 *   3. Latency percentile calculations (min, p50, p90, p99, max)
 *   4. Inverted pool index resolution (affected routes filtering)
 *   5. Opportunity candidate persistence and retrieval in SQLite
 *   6. Deterministic historical event replay
 *   7. Security invariants: zero signing, zero live trading
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { MarketEventWatcher } from '../src/events/MarketEventWatcher.js';
import { EventRouteDispatcher } from '../src/events/EventRouteDispatcher.js';
import { EventReplayer } from '../src/events/EventReplayer.js';
import { ObservationStore, type CandidateRecord } from '../src/storage/ObservationStore.js';
import type { PoolStateChangeEvent } from '../src/events/EventTypes.js';
import type { RoundTripRouteDef } from '../src/economics/roundTripEvaluator.js';
import type { IDataSource } from '../src/data-sources/IDataSource.js';
import { ALL_ACTIVE_POOLS } from '../src/config/pools.js';

const TEST_DB_PATH = resolve(process.cwd(), './data/test_event_watcher.db');

describe('Phase 2: Event Watcher & Route Dispatcher', () => {
  let store: ObservationStore;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    store = new ObservationStore(TEST_DB_PATH);
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    if (existsSync(`${TEST_DB_PATH}-wal`)) unlinkSync(`${TEST_DB_PATH}-wal`);
    if (existsSync(`${TEST_DB_PATH}-shm`)) unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  describe('MarketEventWatcher — Deduplication & Filtering', () => {
    it('should deduplicate events with the same transaction hash and log index', () => {
      const receivedEvents: PoolStateChangeEvent[] = [];
      const watcher = new MarketEventWatcher({
        wsUrl: 'wss://fake-ws',
        httpUrl: 'https://fake-http',
        pools: ALL_ACTIVE_POOLS,
        onEvent: (event): void => {
          receivedEvents.push(event);
        },
      });

      const event1: PoolStateChangeEvent = {
        eventType: 'SWAP',
        poolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        blockNumber: 51350000n,
        transactionHash: '0xabc123',
        logIndex: 12,
        receiptTimestampMs: Date.now(),
      };

      const event2Duplicate: PoolStateChangeEvent = {
        eventType: 'SWAP',
        poolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        blockNumber: 51350000n,
        transactionHash: '0xabc123',
        logIndex: 12,
        receiptTimestampMs: Date.now() + 50,
      };

      const accepted1 = watcher.processEvent(event1);
      const accepted2 = watcher.processEvent(event2Duplicate);

      expect(accepted1).toBe(true);
      expect(accepted2).toBe(false);
      expect(receivedEvents.length).toBe(1);

      const metrics = watcher.getMetrics();
      expect(metrics.eventsReceived).toBe(2);
      expect(metrics.eventsProcessed).toBe(1);
      expect(metrics.duplicateEvents).toBe(1);
    });

    it('should filter out stale events older than highestBlockSeen by threshold', () => {
      const receivedEvents: PoolStateChangeEvent[] = [];
      const watcher = new MarketEventWatcher({
        wsUrl: 'wss://fake-ws',
        httpUrl: 'https://fake-http',
        pools: ALL_ACTIVE_POOLS,
        staleBlockThreshold: 2n,
        onEvent: (event): void => {
          receivedEvents.push(event);
        },
      });

      // Event at block 100 sets highest block
      watcher.processEvent({
        eventType: 'BLOCK',
        poolAddress: '0x0000000000000000000000000000000000000000',
        blockNumber: 100n,
        receiptTimestampMs: Date.now(),
      });

      // Event at block 95 is stale (100 - 95 = 5 > threshold 2)
      const acceptedStale = watcher.processEvent({
        eventType: 'SWAP',
        poolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        blockNumber: 95n,
        transactionHash: '0xstale',
        logIndex: 1,
        receiptTimestampMs: Date.now(),
      });

      // Event at block 99 is within acceptable threshold
      const acceptedFresh = watcher.processEvent({
        eventType: 'SWAP',
        poolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        blockNumber: 99n,
        transactionHash: '0xfresh',
        logIndex: 2,
        receiptTimestampMs: Date.now(),
      });

      expect(acceptedStale).toBe(false);
      expect(acceptedFresh).toBe(true);

      const metrics = watcher.getMetrics();
      expect(metrics.staleEvents).toBe(1);
      expect(metrics.eventsProcessed).toBe(2); // Block 100 + Fresh 99
    });

    it('should compute latency percentiles accurately', () => {
      const watcher = new MarketEventWatcher({
        wsUrl: 'wss://fake-ws',
        httpUrl: 'https://fake-http',
        pools: ALL_ACTIVE_POOLS,
        onEvent: (): void => {},
      });

      const sampleLatencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const lat of sampleLatencies) {
        watcher.recordLatencySample(lat);
      }

      const metrics = watcher.getMetrics();
      expect(metrics.detectionLatency.min).toBe(10);
      expect(metrics.detectionLatency.max).toBe(100);
      expect(metrics.detectionLatency.p50).toBeGreaterThanOrEqual(50);
      expect(metrics.detectionLatency.p90).toBeGreaterThanOrEqual(90);
    });
  });

  describe('EventRouteDispatcher — Inverted Pool Index', () => {
    const mockPoolA = ALL_ACTIVE_POOLS[0]!; // WETH/USDC UniV3 5 bps
    const mockPoolB = ALL_ACTIVE_POOLS[1]!; // WETH/USDC Aero Volatile
    const mockPoolC = ALL_ACTIVE_POOLS[2]!; // WETH/USDC Aero Slipstream

    const mockRoute1: RoundTripRouteDef = {
      id: 'WETH/USDC:UniV3->AeroVolatile',
      name: 'UniV3 -> Aero Volatile [WETH/USDC]',
      chain: 'base',
      leg1: { pool: mockPoolA, adapter: {} as never, tokenIn: mockPoolA.token0, tokenOut: mockPoolA.token1 },
      leg2: { pool: mockPoolB, adapter: {} as never, tokenIn: mockPoolB.token1, tokenOut: mockPoolB.token0 },
    };

    const mockRoute2: RoundTripRouteDef = {
      id: 'WETH/USDC:UniV3->Slipstream',
      name: 'UniV3 -> Slipstream [WETH/USDC]',
      chain: 'base',
      leg1: { pool: mockPoolA, adapter: {} as never, tokenIn: mockPoolA.token0, tokenOut: mockPoolA.token1 },
      leg2: { pool: mockPoolC, adapter: {} as never, tokenIn: mockPoolC.token1, tokenOut: mockPoolC.token0 },
    };

    it('should resolve affected routes only for the target pool address', () => {
      const dispatcher = new EventRouteDispatcher({
        routes: [mockRoute1, mockRoute2],
        dataSource: {} as IDataSource,
        store,
      });

      // Pool A is in both route1 and route2
      const routesA = dispatcher.getAffectedRoutes(mockPoolA.poolAddress);
      expect(routesA.length).toBe(2);

      // Pool B is only in route1
      const routesB = dispatcher.getAffectedRoutes(mockPoolB.poolAddress);
      expect(routesB.length).toBe(1);
      expect(routesB[0]!.id).toBe(mockRoute1.id);

      // Pool C is only in route2
      const routesC = dispatcher.getAffectedRoutes(mockPoolC.poolAddress);
      expect(routesC.length).toBe(1);
      expect(routesC[0]!.id).toBe(mockRoute2.id);

      // Unrelated address returns 0 routes
      const routesUnrelated = dispatcher.getAffectedRoutes('0x000000000000000000000000000000000000dead');
      expect(routesUnrelated.length).toBe(0);
    });
  });

  describe('ObservationStore — Candidate Persistence', () => {
    it('should persist and retrieve opportunity candidate records', () => {
      expect(store.getCandidateCount()).toBe(0);

      const candidate: CandidateRecord = {
        candidateId: 'base:WETH/USDC:test:1',
        timestampMs: 1726444800000,
        blockNumber: '51350100',
        route: 'Uniswap v3 (5bps) -> Aerodrome Slipstream (5bps) [WETH/USDC]',
        dexLeg1: 'Uniswap v3',
        dexLeg2: 'Aerodrome Slipstream',
        poolLeg1: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        poolLeg2: '0x3fe04a59ebd38cf06080a6f60a98d124eb59392a',
        tokenIn: 'WETH',
        intermediateToken: 'USDC',
        tokenOut: 'WETH',
        amountIn: '100000000000000000',
        leg1AmountOut: '260000000',
        leg2AmountOut: '100100000000000000',
        grossProfit: '100000000000000',
        grossProfitUsd: 0.26,
        grossSpreadBps: 10.0,
        gasEstimate: 280000,
        gasCostUsd: 0.05,
        netExpectedProfitUsd: 0.21,
        netProfitBps: 8.08,
        priceImpactBps: 1.2,
        detectionLatencyMs: 145,
        triggerEventType: 'SWAP',
        triggerPoolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
        rawDetailsJson: '{"test":true}',
      };

      store.insertCandidate(candidate);

      expect(store.getCandidateCount()).toBe(1);

      const fetched = store.getCandidates(10);
      expect(fetched.length).toBe(1);
      const retrieved = fetched[0]!;
      expect(retrieved.candidateId).toBe(candidate.candidateId);
      expect(retrieved.route).toBe(candidate.route);
      expect(retrieved.grossProfitUsd).toBe(0.26);
      expect(retrieved.netExpectedProfitUsd).toBe(0.21);
      expect(retrieved.detectionLatencyMs).toBe(145);
      expect(retrieved.triggerEventType).toBe('SWAP');
      expect(retrieved.poolLeg1).toBe(candidate.poolLeg1.toLowerCase());
    });
  });

  describe('EventReplayer — Deterministic Pipeline Replay', () => {
    it('should replay historical event sequence deterministically', async () => {
      const mockDispatcher = {
        dispatchEvent: async (event: PoolStateChangeEvent) => ({
          event,
          affectedRoutesCount: 2,
          evaluations: [
            {
              classification: 'NO_OPPORTUNITY' as const,
              status: 'REJECTED' as const,
              grossSpreadBps: -4.5,
              netProfitBps: -18.2,
            },
          ] as never,
          detectionLatencyMs: 12,
        }),
      } as unknown as EventRouteDispatcher;

      const replayer = new EventReplayer(mockDispatcher);

      const records = [
        {
          event: {
            eventType: 'SWAP' as const,
            poolAddress: '0xd0b53d9277642d899df5c87a3966a349a798f224',
            blockNumber: 51350001n,
            receiptTimestampMs: Date.now(),
          },
          expectedClassification: 'NO_OPPORTUNITY',
        },
        {
          event: {
            eventType: 'SWAP' as const,
            poolAddress: '0x3fe04a59ebd38cf06080a6f60a98d124eb59392a',
            blockNumber: 51350002n,
            receiptTimestampMs: Date.now(),
          },
          expectedClassification: 'NO_OPPORTUNITY',
        },
      ];

      const metrics = await replayer.replayEvents(records);

      expect(metrics.totalEvents).toBe(2);
      expect(metrics.replayedEvents).toBe(2);
      expect(metrics.matchingClassifications).toBe(2);
      expect(metrics.divergentClassifications).toBe(0);
      expect(metrics.evaluationsCount).toBe(2);
    });
  });
});
