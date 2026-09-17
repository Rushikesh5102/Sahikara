/**
 * SAHIKARA Phase 4.16 — Local DEX Pool State Model & Reorg Safety
 *
 * Implements deterministic in-memory pool state management for:
 * 1. Constant-product V2-style pools (Aerodrome, Uniswap V2)
 * 2. Concentrated-liquidity V3-style pools (Uniswap V3)
 *
 * SAFETY INVARIANTS:
 * - Deterministic sequence and log index validation.
 * - Out-of-order logs and sequence gaps immediately flip state to STATE_INVALID.
 * - Reorg detection (block parent mismatch) marks state as STATE_INVALID and requires resync.
 * - Every state snapshot tracks local monotonic receipt timestamp and block metadata.
 * - Read-only architecture. Capital at risk: ₹0.00 / $0.00.
 */

export type StateFreshnessClass =
  | 'STATE_FRESH'    // Updated within current block (<= 1 block age), clean log sequence
  | 'STATE_RECENT'   // 1-2 blocks old, valid sequence, no gaps
  | 'STATE_STALE'    // > 2 blocks old without updates
  | 'STATE_UNKNOWN'  // Initial state or unverified block provenance
  | 'STATE_INVALID'; // Gap detected, reorg, out-of-order, or deserialization error

export interface BasePoolMetadata {
  poolAddress: `0x${string}`;
  protocol: 'uniswap-v3' | 'aerodrome-v2';
  token0: `0x${string}`;
  token1: `0x${string}`;
  decimals0: number;
  decimals1: number;
}

export interface V2PoolState {
  metadata: BasePoolMetadata;
  reserve0: bigint;
  reserve1: bigint;
  feeBps: number;
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  lastLogIndex: number;
  lastUpdateMonotonicMs: number;
  lastUpdateWallClockIso: string;
  freshness: StateFreshnessClass;
}

export interface TickInfo {
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
  initialized: boolean;
}

export interface V3PoolState {
  metadata: BasePoolMetadata;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  feeUint24: number; // e.g. 500 = 0.05%
  initializedTicks: Map<number, TickInfo>;
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  lastLogIndex: number;
  lastUpdateMonotonicMs: number;
  lastUpdateWallClockIso: string;
  freshness: StateFreshnessClass;
}

export interface RawLogUpdate {
  poolAddress: `0x${string}`;
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  transactionHash: string;
  logIndex: number;
  receiptMonotonicMs: number;
  eventType: 'SYNC' | 'SWAP' | 'MINT' | 'BURN';
  data: Record<string, unknown>;
}

export class LocalPoolStateManager {
  private v2States = new Map<string, V2PoolState>();
  private v3States = new Map<string, V3PoolState>();
  private highestBlockNumber = 0n;

  /**
   * Initializes or replaces V2 pool state from an authoritative snapshot.
   */
  public initV2State(
    metadata: BasePoolMetadata,
    reserve0: bigint,
    reserve1: bigint,
    feeBps: number,
    blockNumber: bigint,
    blockHash: string,
    lastLogIndex = 0
  ): V2PoolState {
    if (metadata.token0.toLowerCase() === metadata.token1.toLowerCase()) {
      throw new Error(`Invalid pool tokens: token0 and token1 must be distinct`);
    }
    if (metadata.token0.toLowerCase() > metadata.token1.toLowerCase()) {
      throw new Error(`Token ordering violation: token0 must be strictly less than token1`);
    }

    const state: V2PoolState = {
      metadata,
      reserve0,
      reserve1,
      feeBps,
      blockNumber,
      blockHash,
      lastLogIndex,
      lastUpdateMonotonicMs: performance.now(),
      lastUpdateWallClockIso: new Date().toISOString(),
      freshness: 'STATE_FRESH',
    };

    this.v2States.set(metadata.poolAddress.toLowerCase(), state);
    if (blockNumber > this.highestBlockNumber) {
      this.highestBlockNumber = blockNumber;
    }
    return state;
  }

  /**
   * Initializes or replaces V3 pool state from an authoritative snapshot.
   */
  public initV3State(
    metadata: BasePoolMetadata,
    sqrtPriceX96: bigint,
    tick: number,
    liquidity: bigint,
    feeUint24: number,
    blockNumber: bigint,
    blockHash: string,
    lastLogIndex = 0,
    ticks?: Map<number, TickInfo>
  ): V3PoolState {
    if (metadata.token0.toLowerCase() === metadata.token1.toLowerCase()) {
      throw new Error(`Invalid pool tokens: token0 and token1 must be distinct`);
    }
    if (metadata.token0.toLowerCase() > metadata.token1.toLowerCase()) {
      throw new Error(`Token ordering violation: token0 must be strictly less than token1`);
    }
    if (sqrtPriceX96 === 0n) {
      throw new Error(`Invalid V3 state: sqrtPriceX96 cannot be 0`);
    }

    const state: V3PoolState = {
      metadata,
      sqrtPriceX96,
      tick,
      liquidity,
      feeUint24,
      initializedTicks: ticks ?? new Map<number, TickInfo>(),
      blockNumber,
      blockHash,
      lastLogIndex,
      lastUpdateMonotonicMs: performance.now(),
      lastUpdateWallClockIso: new Date().toISOString(),
      freshness: 'STATE_FRESH',
    };

    this.v3States.set(metadata.poolAddress.toLowerCase(), state);
    if (blockNumber > this.highestBlockNumber) {
      this.highestBlockNumber = blockNumber;
    }
    return state;
  }

  public getV2State(poolAddress: string): V2PoolState | undefined {
    return this.v2States.get(poolAddress.toLowerCase());
  }

  public getV3State(poolAddress: string): V3PoolState | undefined {
    return this.v3States.get(poolAddress.toLowerCase());
  }

  /**
   * Applies an incremental log event to a V2 pool state with strict sequence validation.
   */
  public applyV2Log(log: RawLogUpdate): { success: boolean; reason?: string } {
    const key = log.poolAddress.toLowerCase();
    const current = this.v2States.get(key);

    if (!current) {
      return { success: false, reason: 'POOL_NOT_INITIALIZED' };
    }

    // 1. Reorg / Parent hash check
    if (log.parentHash && current.blockHash && log.blockNumber === current.blockNumber + 1n) {
      if (log.parentHash.toLowerCase() !== current.blockHash.toLowerCase()) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: 'REORG_DETECTED_PARENT_HASH_MISMATCH' };
      }
    }

    // 2. Block gap check
    if (log.blockNumber > current.blockNumber + 1n) {
      current.freshness = 'STATE_INVALID';
      return { success: false, reason: `BLOCK_GAP_DETECTED: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 3. Stale block check
    if (log.blockNumber < current.blockNumber) {
      return { success: false, reason: `STALE_BLOCK: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 4. Same block log sequence check
    if (log.blockNumber === current.blockNumber) {
      if (log.logIndex === current.lastLogIndex) {
        return { success: false, reason: `DUPLICATE_LOG: logIndex=${log.logIndex}` };
      }
      if (log.logIndex < current.lastLogIndex) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: `OUT_OF_ORDER_LOG: last=${current.lastLogIndex}, received=${log.logIndex}` };
      }
    }

    // 5. Apply event data
    if (log.eventType === 'SYNC') {
      const r0 = log.data.reserve0 as bigint;
      const r1 = log.data.reserve1 as bigint;
      if (r0 === undefined || r1 === undefined || r0 <= 0n || r1 <= 0n) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: 'INVALID_RESERVES_IN_SYNC_EVENT' };
      }
      current.reserve0 = r0;
      current.reserve1 = r1;
    } else if (log.eventType === 'SWAP') {
      // If event contains updated reserves or deltas
      if (log.data.reserve0 !== undefined && log.data.reserve1 !== undefined) {
        current.reserve0 = log.data.reserve0 as bigint;
        current.reserve1 = log.data.reserve1 as bigint;
      }
    }

    current.blockNumber = log.blockNumber;
    current.blockHash = log.blockHash;
    if (log.parentHash) current.parentHash = log.parentHash;
    current.lastLogIndex = log.logIndex;
    current.lastUpdateMonotonicMs = log.receiptMonotonicMs;
    current.lastUpdateWallClockIso = new Date().toISOString();
    current.freshness = 'STATE_FRESH';

    if (log.blockNumber > this.highestBlockNumber) {
      this.highestBlockNumber = log.blockNumber;
    }

    return { success: true };
  }

  /**
   * Applies an incremental log event to a V3 pool state with strict sequence validation.
   */
  public applyV3Log(log: RawLogUpdate): { success: boolean; reason?: string } {
    const key = log.poolAddress.toLowerCase();
    const current = this.v3States.get(key);

    if (!current) {
      return { success: false, reason: 'POOL_NOT_INITIALIZED' };
    }

    // 1. Reorg / Parent hash check
    if (log.parentHash && current.blockHash && log.blockNumber === current.blockNumber + 1n) {
      if (log.parentHash.toLowerCase() !== current.blockHash.toLowerCase()) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: 'REORG_DETECTED_PARENT_HASH_MISMATCH' };
      }
    }

    // 2. Block gap check
    if (log.blockNumber > current.blockNumber + 1n) {
      current.freshness = 'STATE_INVALID';
      return { success: false, reason: `BLOCK_GAP_DETECTED: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 3. Stale block check
    if (log.blockNumber < current.blockNumber) {
      return { success: false, reason: `STALE_BLOCK: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 4. Same block log sequence check
    if (log.blockNumber === current.blockNumber) {
      if (log.logIndex === current.lastLogIndex) {
        return { success: false, reason: `DUPLICATE_LOG: logIndex=${log.logIndex}` };
      }
      if (log.logIndex < current.lastLogIndex) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: `OUT_OF_ORDER_LOG: last=${current.lastLogIndex}, received=${log.logIndex}` };
      }
    }

    // 5. Apply event data
    if (log.eventType === 'SWAP') {
      const sqrtP = log.data.sqrtPriceX96 as bigint;
      const tick = log.data.tick as number;
      const liq = log.data.liquidity as bigint;

      if (!sqrtP || sqrtP === 0n || tick === undefined || liq === undefined) {
        current.freshness = 'STATE_INVALID';
        return { success: false, reason: 'INVALID_SWAP_EVENT_PAYLOAD' };
      }

      current.sqrtPriceX96 = sqrtP;
      current.tick = tick;
      current.liquidity = liq;
    }

    current.blockNumber = log.blockNumber;
    current.blockHash = log.blockHash;
    if (log.parentHash) current.parentHash = log.parentHash;
    current.lastLogIndex = log.logIndex;
    current.lastUpdateMonotonicMs = log.receiptMonotonicMs;
    current.lastUpdateWallClockIso = new Date().toISOString();
    current.freshness = 'STATE_FRESH';

    if (log.blockNumber > this.highestBlockNumber) {
      this.highestBlockNumber = log.blockNumber;
    }

    return { success: true };
  }

  /**
   * Updates state freshness classifications against current highest known block height.
   */
  public evaluateFreshness(currentBlock: bigint): void {
    const checkFreshness = (blockNumber: bigint, currentClass: StateFreshnessClass): StateFreshnessClass => {
      if (currentClass === 'STATE_INVALID') return 'STATE_INVALID';
      const age = currentBlock - blockNumber;
      if (age <= 1n) return 'STATE_FRESH';
      if (age <= 2n) return 'STATE_RECENT';
      return 'STATE_STALE';
    };

    for (const state of this.v2States.values()) {
      state.freshness = checkFreshness(state.blockNumber, state.freshness);
    }
    for (const state of this.v3States.values()) {
      state.freshness = checkFreshness(state.blockNumber, state.freshness);
    }
  }

  /**
   * Invalidate pool state upon WebSocket disconnect or stream error.
   */
  public invalidateAll(reason?: string): void {
    void reason;
    for (const state of this.v2States.values()) {
      state.freshness = 'STATE_INVALID';
    }
    for (const state of this.v3States.values()) {
      state.freshness = 'STATE_INVALID';
    }
  }
}
