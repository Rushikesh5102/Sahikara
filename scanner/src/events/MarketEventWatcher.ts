/**
 * SAHIKARA Phase 2 — Real-Time Market Event Watcher
 *
 * Stream-oriented event ingestion engine for Base Mainnet:
 *   1. Manages WebSocket connection to Base with auto-reconnection and exponential backoff.
 *   2. Automatically falls back to HTTP log polling if WebSocket is unavailable or disconnected.
 *   3. Subscribes to Swap & Sync events across all registered on-chain pools.
 *   4. Subscribes to real-time block headers.
 *   5. Deduplicates events via sliding LRU set of (txHash:logIndex).
 *   6. Discards stale blocks and orders intra-block events deterministically by logIndex.
 *   7. Accurately captures arrival timestamp (receiptTimestampMs) for sub-second latency profiling.
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry. Zero private keys, zero wallet signing, zero live trading.
 */

import {
  createPublicClient,
  webSocket,
  http,
  parseAbiItem,
  type PublicClient,
  type Chain,
} from 'viem';
import { base } from 'viem/chains';
import type { PoolDefinition } from '../config/pools.js';
import type {
  PoolStateChangeEvent,
  EventDetectionMetrics,
  LatencyPercentiles,
} from './EventTypes.js';

export const V3_SWAP_ABI = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
);

export const V2_SWAP_ABI = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)'
);

export const V2_SYNC_ABI = parseAbiItem(
  'event Sync(uint256 reserve0, uint256 reserve1)'
);

export interface MarketEventWatcherOptions {
  wsUrl: string;
  httpUrl: string;
  pools: PoolDefinition[];
  chain?: Chain;
  onEvent: (event: PoolStateChangeEvent) => Promise<void> | void;
  onError?: (err: Error) => void;
  reconnectBaseDelayMs?: number;
  maxReconnectDelayMs?: number;
  maxDeduplicationWindow?: number;
  staleBlockThreshold?: bigint;
}

export type WatcherConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'fallback_polling'
  | 'stopped';

export class MarketEventWatcher {
  private readonly wsUrl: string;
  private readonly httpUrl: string;
  private readonly chain: Chain;
  private readonly pools: PoolDefinition[];
  private readonly poolAddresses: `0x${string}`[];
  private readonly onEvent: (event: PoolStateChangeEvent) => Promise<void> | void;
  private readonly onError?: (err: Error) => void;

  private readonly reconnectBaseDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly maxDeduplicationWindow: number;
  private readonly staleBlockThreshold: bigint;

  // Status & Clients
  private status: WatcherConnectionStatus = 'idle';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wsClient: PublicClient<any, any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private httpClient: PublicClient<any, any> | null = null;

  // Unsubscribe callbacks
  private unwatchList: Array<() => void> = [];

  // Deduplication & State Tracking
  private seenEvents = new Set<string>();
  private seenEventKeysQueue: string[] = [];
  private highestBlockSeen = 0n;
  private reconnectAttempts = 0;
  private isStopping = false;

  // Latency samples (rolling window up to 1,000 samples)
  private latencySamples: number[] = [];

  // Telemetry metrics
  private metrics: EventDetectionMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    duplicateEvents: 0,
    staleEvents: 0,
    outOfOrderEvents: 0,
    reconnects: 0,
    quotesTriggered: 0,
    successfulQuotes: 0,
    failedQuotes: 0,
    roundTripsEvaluated: 0,
    grossPositiveRoundTrips: 0,
    candidatesDetected: 0,
    detectionLatency: { min: 0, p50: 0, p90: 0, p99: 0, max: 0 },
  };

  constructor(options: MarketEventWatcherOptions) {
    this.wsUrl = options.wsUrl;
    this.httpUrl = options.httpUrl;
    this.chain = options.chain ?? base;
    this.pools = options.pools;
    this.poolAddresses = options.pools.map(
      (p) => p.poolAddress.toLowerCase() as `0x${string}`
    );
    this.onEvent = options.onEvent;
    this.onError = options.onError;

    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 10000;
    this.maxDeduplicationWindow = options.maxDeduplicationWindow ?? 10000;
    this.staleBlockThreshold = options.staleBlockThreshold ?? 2n;
  }

  /**
   * Start the event watcher. Attempts WebSocket connection first,
   * with automatic reconnect and HTTP fallback.
   */
  async start(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    this.isStopping = false;
    this.status = 'connecting';

    try {
      await this.connectWebSocket();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      // Fallback to HTTP polling if WebSocket fails initially
      await this.startHttpFallback();
    }
  }

  /**
   * Connect to Base via WebSocket and establish subscriptions.
   */
  private async connectWebSocket(): Promise<void> {
    this.cleanupSubscriptions();

    this.wsClient = createPublicClient({
      chain: this.chain,
      transport: webSocket(this.wsUrl, {
        timeout: 10000,
        retryCount: 3,
        retryDelay: 1000,
      }),
    });

    // Test connectivity by getting current block number
    const currentBlock = await this.wsClient.getBlockNumber();
    this.highestBlockSeen = currentBlock;
    this.status = 'connected';
    this.reconnectAttempts = 0;

    this.setupSubscriptions(this.wsClient);
  }

  /**
   * Fallback to HTTP event log polling if WebSocket is unavailable.
   */
  private async startHttpFallback(): Promise<void> {
    if (this.isStopping) return;

    this.status = 'fallback_polling';
    this.cleanupSubscriptions();

    this.httpClient = createPublicClient({
      chain: this.chain,
      transport: http(this.httpUrl, {
        timeout: 10000,
      }),
    });

    const currentBlock = await this.httpClient.getBlockNumber();
    this.highestBlockSeen = currentBlock;

    this.setupSubscriptions(this.httpClient);
  }

  /**
   * Establish event listeners on the active Viem client.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setupSubscriptions(client: PublicClient<any, any>): void {
    // 1. New Blocks Listener
    const unwatchBlocks = client.watchBlocks({
      onBlock: (block) => {
        const receiptTimestampMs = Date.now();
        const blockNumber = block.number;
        if (!blockNumber) return;

        if (blockNumber > this.highestBlockSeen) {
          this.highestBlockSeen = blockNumber;
        }

        this.processEvent({
          eventType: 'BLOCK',
          poolAddress: '0x0000000000000000000000000000000000000000',
          blockNumber,
          blockHash: block.hash ?? undefined,
          receiptTimestampMs,
          data: { timestamp: block.timestamp },
        });
      },
      onError: (err) => this.handleStreamError(err),
    });
    this.unwatchList.push(unwatchBlocks);

    // 2. V3 Swap Events Listener (Uniswap V3, Slipstream, PancakeSwap V3)
    const unwatchV3Swaps = client.watchEvent({
      address: this.poolAddresses,
      event: V3_SWAP_ABI,
      onLogs: (logs) => {
        const receiptTimestampMs = Date.now();
        // Sort logs in ascending order of logIndex to guarantee deterministic processing
        const sortedLogs = [...logs].sort((a, b) => Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0));
        for (const log of sortedLogs) {
          this.processEvent({
            eventType: 'SWAP',
            poolAddress: log.address.toLowerCase(),
            blockNumber: log.blockNumber ?? this.highestBlockSeen,
            blockHash: log.blockHash ?? undefined,
            transactionHash: log.transactionHash ?? undefined,
            logIndex: log.logIndex !== null ? Number(log.logIndex) : undefined,
            receiptTimestampMs,
            data: log.args,
          });
        }
      },
      onError: (err) => this.handleStreamError(err),
    });
    this.unwatchList.push(unwatchV3Swaps);

    // 3. V2 Swap Events Listener (Aerodrome Volatile / Stable)
    const unwatchV2Swaps = client.watchEvent({
      address: this.poolAddresses,
      event: V2_SWAP_ABI,
      onLogs: (logs) => {
        const receiptTimestampMs = Date.now();
        const sortedLogs = [...logs].sort((a, b) => Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0));
        for (const log of sortedLogs) {
          this.processEvent({
            eventType: 'SWAP',
            poolAddress: log.address.toLowerCase(),
            blockNumber: log.blockNumber ?? this.highestBlockSeen,
            blockHash: log.blockHash ?? undefined,
            transactionHash: log.transactionHash ?? undefined,
            logIndex: log.logIndex !== null ? Number(log.logIndex) : undefined,
            receiptTimestampMs,
            data: log.args,
          });
        }
      },
      onError: (err) => this.handleStreamError(err),
    });
    this.unwatchList.push(unwatchV2Swaps);

    // 4. V2 Sync Events Listener (Aerodrome Volatile / Stable)
    const unwatchV2Sync = client.watchEvent({
      address: this.poolAddresses,
      event: V2_SYNC_ABI,
      onLogs: (logs) => {
        const receiptTimestampMs = Date.now();
        const sortedLogs = [...logs].sort((a, b) => Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0));
        for (const log of sortedLogs) {
          this.processEvent({
            eventType: 'SYNC',
            poolAddress: log.address.toLowerCase(),
            blockNumber: log.blockNumber ?? this.highestBlockSeen,
            blockHash: log.blockHash ?? undefined,
            transactionHash: log.transactionHash ?? undefined,
            logIndex: log.logIndex !== null ? Number(log.logIndex) : undefined,
            receiptTimestampMs,
            data: log.args,
          });
        }
      },
      onError: (err) => this.handleStreamError(err),
    });
    this.unwatchList.push(unwatchV2Sync);
  }

  /**
   * Process and filter an incoming event, applying deduplication and stale block filters.
   */
  processEvent(event: PoolStateChangeEvent): boolean {
    if (this.isStopping || this.status === 'stopped') {
      return false;
    }
    this.metrics.eventsReceived++;

    // 1. Deduplication Filter: Key on `${txHash}:${logIndex}` or `${block}:${pool}:${eventType}`
    const eventKey = event.transactionHash && event.logIndex !== undefined
      ? `${event.transactionHash.toLowerCase()}:${event.logIndex}`
      : `${event.blockNumber}:${event.poolAddress.toLowerCase()}:${event.eventType}:${event.logIndex ?? 0}`;

    if (this.seenEvents.has(eventKey)) {
      this.metrics.duplicateEvents++;
      return false;
    }

    this.seenEvents.add(eventKey);
    this.seenEventKeysQueue.push(eventKey);
    if (this.seenEventKeysQueue.length > this.maxDeduplicationWindow) {
      const oldestKey = this.seenEventKeysQueue.shift()!;
      this.seenEvents.delete(oldestKey);
    }

    // 2. Stale Block Filter
    if (event.blockNumber + this.staleBlockThreshold < this.highestBlockSeen) {
      this.metrics.staleEvents++;
      return false;
    }

    if (event.blockNumber > this.highestBlockSeen) {
      this.highestBlockSeen = event.blockNumber;
    }

    this.metrics.eventsProcessed++;

    // 3. Dispatch to handler
    try {
      const maybePromise = this.onEvent(event);
      if (maybePromise instanceof Promise) {
        maybePromise.catch((err) => {
          this.onError?.(err instanceof Error ? err : new Error(String(err)));
        });
      }
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    return true;
  }

  /**
   * Record a completed detection latency sample (in ms).
   */
  recordLatencySample(latencyMs: number): void {
    if (latencyMs < 0) return;
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift();
    }
    this.metrics.detectionLatency = this.calculatePercentiles(this.latencySamples);
  }

  /**
   * Update downstream execution metrics (e.g. from dispatcher).
   */
  updateExecutionMetrics(delta: {
    quotesTriggered?: number;
    successfulQuotes?: number;
    failedQuotes?: number;
    roundTripsEvaluated?: number;
    grossPositiveRoundTrips?: number;
    candidatesDetected?: number;
  }): void {
    if (delta.quotesTriggered) this.metrics.quotesTriggered += delta.quotesTriggered;
    if (delta.successfulQuotes) this.metrics.successfulQuotes += delta.successfulQuotes;
    if (delta.failedQuotes) this.metrics.failedQuotes += delta.failedQuotes;
    if (delta.roundTripsEvaluated) this.metrics.roundTripsEvaluated += delta.roundTripsEvaluated;
    if (delta.grossPositiveRoundTrips) this.metrics.grossPositiveRoundTrips += delta.grossPositiveRoundTrips;
    if (delta.candidatesDetected) this.metrics.candidatesDetected += delta.candidatesDetected;
  }

  /**
   * Handle connection or stream errors. Attempts reconnect with exponential backoff.
   */
  private handleStreamError(err: Error): void {
    if (this.isStopping) return;

    this.onError?.(err);

    if (this.status === 'connected') {
      this.status = 'reconnecting';
      this.metrics.reconnects++;

      const delay = Math.min(
        this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelayMs
      );
      this.reconnectAttempts++;

      setTimeout(async () => {
        if (this.isStopping) return;
        try {
          await this.connectWebSocket();
        } catch {
          // If WS reconnect fails, switch to HTTP fallback
          await this.startHttpFallback();
        }
      }, delay);
    }
  }

  private cleanupSubscriptions(): void {
    for (const unwatch of this.unwatchList) {
      try {
        unwatch();
      } catch {
        // Ignore unwatch errors during teardown
      }
    }
    this.unwatchList = [];
  }

  /**
   * Stop the event watcher gracefully.
   */
  async stop(): Promise<void> {
    this.isStopping = true;
    this.status = 'stopped';
    this.cleanupSubscriptions();
    this.wsClient = null;
    this.httpClient = null;
  }

  getStatus(): WatcherConnectionStatus {
    return this.status;
  }

  getPools(): PoolDefinition[] {
    return this.pools;
  }

  getMetrics(): EventDetectionMetrics {
    return {
      ...this.metrics,
      detectionLatency: this.calculatePercentiles(this.latencySamples),
    };
  }

  private calculatePercentiles(values: number[]): LatencyPercentiles {
    if (values.length === 0) {
      return { min: 0, p50: 0, p90: 0, p99: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const getP = (p: number): number => {
      const idx = Math.floor(p * (n - 1));
      return sorted[idx]!;
    };

    return {
      min: sorted[0]!,
      p50: getP(0.50),
      p90: getP(0.90),
      p99: getP(0.99),
      max: sorted[n - 1]!,
    };
  }
}
