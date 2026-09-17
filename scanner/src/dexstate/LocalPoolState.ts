/**
 * SAHIKARA Phase 4.17 — Production-Grade Local DEX Pool State Model & Reorg Safety
 *
 * Implements deterministic in-memory pool state management for:
 * 1. Constant-product V2-style pools (Aerodrome, Uniswap V2)
 * 2. Concentrated-liquidity V3-style pools (Uniswap V3)
 *
 * SAFETY INVARIANTS:
 * - Deterministic sequence and log index validation.
 * - Canonical ordering: blockNumber -> transactionIndex -> logIndex.
 * - Out-of-order logs and sequence gaps immediately flip state to STATE_INVALID.
 * - Reorg detection (block parent mismatch) marks state as STATE_INVALID and requires resync.
 * - Complete tick bitmap manipulation and initialized tick tracking for multi-tick traversal.
 * - Serialization / deserialization methods for restart and state recovery verification.
 * - Read-only architecture. Capital at risk: strictly ₹0.00 / $0.00.
 */

export type StateFreshnessClass =
  | 'STATE_FRESH'    // Updated within current block (<= 1 block age), clean log sequence
  | 'STATE_RECENT'   // 1-2 blocks old, valid sequence, no gaps
  | 'STATE_STALE'    // > 2 blocks old without updates
  | 'STATE_UNKNOWN'  // Initial state or unverified block provenance
  | 'STATE_INVALID'; // Gap detected, reorg, out-of-order, or deserialization error

export type StateLifecycleStatus =
  | 'BOOTSTRAP'
  | 'SYNCING'
  | 'VALID'
  | 'UPDATED'
  | 'STALE'
  | 'INVALID'
  | 'INCOMPLETE'
  | 'RESYNC_REQUIRED';

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
  lastTransactionIndex?: number;
  lastUpdateMonotonicMs: number;
  lastUpdateWallClockIso: string;
  freshness: StateFreshnessClass;
  lifecycle: StateLifecycleStatus;
  stateVersion: number;
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
  tickSpacing: number; // e.g. 10, 60, 200
  initializedTicks: Map<number, TickInfo>;
  tickBitmap: Map<number, bigint>; // wordPos (int16) => uint256 word
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  lastLogIndex: number;
  lastTransactionIndex?: number;
  lastUpdateMonotonicMs: number;
  lastUpdateWallClockIso: string;
  freshness: StateFreshnessClass;
  lifecycle: StateLifecycleStatus;
  stateVersion: number;
}

export interface RawLogUpdate {
  poolAddress: `0x${string}`;
  blockNumber: bigint;
  blockHash: string;
  parentHash?: string;
  transactionHash: string;
  transactionIndex?: number;
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
   * Computes word position, bit position, and compressed tick for Uniswap V3 bitmap.
   */
  public static getWordAndBitPos(tick: number, tickSpacing: number): { wordPos: number; bitPos: number; compressed: number } {
    const compressed = Math.floor(tick / tickSpacing);
    const wordPos = Math.floor(compressed / 256);
    const bitPos = ((compressed % 256) + 256) % 256;
    return { wordPos, bitPos, compressed };
  }

  /**
   * Sets the initialized bit in the tick bitmap for a given tick.
   */
  public static setTickBitmapBit(tickBitmap: Map<number, bigint>, tick: number, tickSpacing: number): void {
    const { wordPos, bitPos } = LocalPoolStateManager.getWordAndBitPos(tick, tickSpacing);
    const word = tickBitmap.get(wordPos) ?? 0n;
    tickBitmap.set(wordPos, word | (1n << BigInt(bitPos)));
  }

  /**
   * Clears the initialized bit in the tick bitmap for a given tick.
   */
  public static clearTickBitmapBit(tickBitmap: Map<number, bigint>, tick: number, tickSpacing: number): void {
    const { wordPos, bitPos } = LocalPoolStateManager.getWordAndBitPos(tick, tickSpacing);
    const word = tickBitmap.get(wordPos) ?? 0n;
    const newWord = word & ~(1n << BigInt(bitPos));
    if (newWord === 0n) {
      tickBitmap.delete(wordPos);
    } else {
      tickBitmap.set(wordPos, newWord);
    }
  }

  /**
   * Checks whether a tick is marked initialized in the tick bitmap.
   */
  public static isTickInitialized(tickBitmap: Map<number, bigint>, tick: number, tickSpacing: number): boolean {
    const { wordPos, bitPos } = LocalPoolStateManager.getWordAndBitPos(tick, tickSpacing);
    const word = tickBitmap.get(wordPos) ?? 0n;
    return (word & (1n << BigInt(bitPos))) !== 0n;
  }

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
    lastLogIndex = 0,
    parentHash?: string
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
      parentHash,
      lastLogIndex,
      lastUpdateMonotonicMs: performance.now(),
      lastUpdateWallClockIso: new Date().toISOString(),
      freshness: 'STATE_FRESH',
      lifecycle: 'VALID',
      stateVersion: 1,
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
    ticks?: Map<number, TickInfo>,
    tickSpacing = 10,
    tickBitmap?: Map<number, bigint>,
    parentHash?: string
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

    const bitmap = tickBitmap ?? new Map<number, bigint>();
    if (ticks && !tickBitmap) {
      for (const t of ticks.keys()) {
        LocalPoolStateManager.setTickBitmapBit(bitmap, t, tickSpacing);
      }
    }

    const state: V3PoolState = {
      metadata,
      sqrtPriceX96,
      tick,
      liquidity,
      feeUint24,
      tickSpacing,
      initializedTicks: ticks ?? new Map<number, TickInfo>(),
      tickBitmap: bitmap,
      blockNumber,
      blockHash,
      parentHash,
      lastLogIndex,
      lastUpdateMonotonicMs: performance.now(),
      lastUpdateWallClockIso: new Date().toISOString(),
      freshness: 'STATE_FRESH',
      lifecycle: 'VALID',
      stateVersion: 1,
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
   * Applies an incremental log event to a V2 pool state with canonical sequence validation.
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
        current.lifecycle = 'RESYNC_REQUIRED';
        return { success: false, reason: 'REORG_DETECTED_PARENT_HASH_MISMATCH' };
      }
    }

    // 2. Block gap check
    if (log.blockNumber > current.blockNumber + 1n) {
      current.freshness = 'STATE_INVALID';
      current.lifecycle = 'RESYNC_REQUIRED';
      return { success: false, reason: `BLOCK_GAP_DETECTED: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 3. Stale block check
    if (log.blockNumber < current.blockNumber) {
      return { success: false, reason: `STALE_BLOCK: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 4. Same block log sequence check (canonical: txIndex -> logIndex)
    if (log.blockNumber === current.blockNumber) {
      if (log.transactionIndex !== undefined && current.lastTransactionIndex !== undefined) {
        if (log.transactionIndex < current.lastTransactionIndex) {
          current.freshness = 'STATE_INVALID';
          current.lifecycle = 'INVALID';
          return { success: false, reason: `OUT_OF_ORDER_TRANSACTION: last=${current.lastTransactionIndex}, received=${log.transactionIndex}` };
        }
      }
      if (log.logIndex === current.lastLogIndex) {
        return { success: false, reason: `DUPLICATE_LOG: logIndex=${log.logIndex}` };
      }
      if (log.logIndex < current.lastLogIndex) {
        current.freshness = 'STATE_INVALID';
        current.lifecycle = 'INVALID';
        return { success: false, reason: `OUT_OF_ORDER_LOG: last=${current.lastLogIndex}, received=${log.logIndex}` };
      }
    }

    // 5. Apply event data
    if (log.eventType === 'SYNC') {
      const r0 = log.data.reserve0 as bigint;
      const r1 = log.data.reserve1 as bigint;
      if (r0 === undefined || r1 === undefined || r0 <= 0n || r1 <= 0n) {
        current.freshness = 'STATE_INVALID';
        current.lifecycle = 'INVALID';
        return { success: false, reason: 'INVALID_RESERVES_IN_SYNC_EVENT' };
      }
      current.reserve0 = r0;
      current.reserve1 = r1;
    } else if (log.eventType === 'SWAP') {
      if (log.data.reserve0 !== undefined && log.data.reserve1 !== undefined) {
        current.reserve0 = log.data.reserve0 as bigint;
        current.reserve1 = log.data.reserve1 as bigint;
      } else if (log.data.amount0In !== undefined && log.data.amount1Out !== undefined) {
        current.reserve0 += log.data.amount0In as bigint;
        current.reserve1 -= log.data.amount1Out as bigint;
      } else if (log.data.amount1In !== undefined && log.data.amount0Out !== undefined) {
        current.reserve1 += log.data.amount1In as bigint;
        current.reserve0 -= log.data.amount0Out as bigint;
      }
    } else if (log.eventType === 'MINT') {
      const a0 = (log.data.amount0 as bigint) ?? 0n;
      const a1 = (log.data.amount1 as bigint) ?? 0n;
      current.reserve0 += a0;
      current.reserve1 += a1;
    } else if (log.eventType === 'BURN') {
      const a0 = (log.data.amount0 as bigint) ?? 0n;
      const a1 = (log.data.amount1 as bigint) ?? 0n;
      current.reserve0 -= a0;
      current.reserve1 -= a1;
    }

    current.blockNumber = log.blockNumber;
    current.blockHash = log.blockHash;
    if (log.parentHash) current.parentHash = log.parentHash;
    current.lastLogIndex = log.logIndex;
    if (log.transactionIndex !== undefined) current.lastTransactionIndex = log.transactionIndex;
    current.lastUpdateMonotonicMs = log.receiptMonotonicMs;
    current.lastUpdateWallClockIso = new Date().toISOString();
    current.freshness = 'STATE_FRESH';
    current.lifecycle = 'UPDATED';
    current.stateVersion += 1;

    if (log.blockNumber > this.highestBlockNumber) {
      this.highestBlockNumber = log.blockNumber;
    }

    return { success: true };
  }

  /**
   * Applies an incremental log event to a V3 pool state with canonical sequence validation.
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
        current.lifecycle = 'RESYNC_REQUIRED';
        return { success: false, reason: 'REORG_DETECTED_PARENT_HASH_MISMATCH' };
      }
    }

    // 2. Block gap check
    if (log.blockNumber > current.blockNumber + 1n) {
      current.freshness = 'STATE_INVALID';
      current.lifecycle = 'RESYNC_REQUIRED';
      return { success: false, reason: `BLOCK_GAP_DETECTED: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 3. Stale block check
    if (log.blockNumber < current.blockNumber) {
      return { success: false, reason: `STALE_BLOCK: current=${current.blockNumber}, received=${log.blockNumber}` };
    }

    // 4. Same block log sequence check (canonical: txIndex -> logIndex)
    if (log.blockNumber === current.blockNumber) {
      if (log.transactionIndex !== undefined && current.lastTransactionIndex !== undefined) {
        if (log.transactionIndex < current.lastTransactionIndex) {
          current.freshness = 'STATE_INVALID';
          current.lifecycle = 'INVALID';
          return { success: false, reason: `OUT_OF_ORDER_TRANSACTION: last=${current.lastTransactionIndex}, received=${log.transactionIndex}` };
        }
      }
      if (log.logIndex === current.lastLogIndex) {
        return { success: false, reason: `DUPLICATE_LOG: logIndex=${log.logIndex}` };
      }
      if (log.logIndex < current.lastLogIndex) {
        current.freshness = 'STATE_INVALID';
        current.lifecycle = 'INVALID';
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
        current.lifecycle = 'INVALID';
        return { success: false, reason: 'INVALID_SWAP_EVENT_PAYLOAD' };
      }

      current.sqrtPriceX96 = sqrtP;
      current.tick = tick;
      current.liquidity = liq;
    } else if (log.eventType === 'MINT') {
      const tickLower = log.data.tickLower as number;
      const tickUpper = log.data.tickUpper as number;
      const amount = log.data.amount as bigint; // liquidity delta

      if (tickLower === undefined || tickUpper === undefined || !amount || amount <= 0n) {
        current.freshness = 'STATE_INVALID';
        current.lifecycle = 'INVALID';
        return { success: false, reason: 'INVALID_MINT_EVENT_PAYLOAD' };
      }

      // Update lower tick
      const lower = current.initializedTicks.get(tickLower) ?? {
        tick: tickLower,
        liquidityGross: 0n,
        liquidityNet: 0n,
        initialized: false,
      };
      lower.liquidityGross += amount;
      lower.liquidityNet += amount;
      lower.initialized = true;
      current.initializedTicks.set(tickLower, lower);
      LocalPoolStateManager.setTickBitmapBit(current.tickBitmap, tickLower, current.tickSpacing);

      // Update upper tick
      const upper = current.initializedTicks.get(tickUpper) ?? {
        tick: tickUpper,
        liquidityGross: 0n,
        liquidityNet: 0n,
        initialized: false,
      };
      upper.liquidityGross += amount;
      upper.liquidityNet -= amount;
      upper.initialized = true;
      current.initializedTicks.set(tickUpper, upper);
      LocalPoolStateManager.setTickBitmapBit(current.tickBitmap, tickUpper, current.tickSpacing);

      // If active tick is in range [tickLower, tickUpper), update current liquidity
      if (current.tick >= tickLower && current.tick < tickUpper) {
        current.liquidity += amount;
      }
    } else if (log.eventType === 'BURN') {
      const tickLower = log.data.tickLower as number;
      const tickUpper = log.data.tickUpper as number;
      const amount = log.data.amount as bigint; // liquidity delta

      if (tickLower === undefined || tickUpper === undefined || !amount || amount <= 0n) {
        current.freshness = 'STATE_INVALID';
        current.lifecycle = 'INVALID';
        return { success: false, reason: 'INVALID_BURN_EVENT_PAYLOAD' };
      }

      const lower = current.initializedTicks.get(tickLower);
      if (lower) {
        lower.liquidityGross = lower.liquidityGross >= amount ? lower.liquidityGross - amount : 0n;
        lower.liquidityNet -= amount;
        if (lower.liquidityGross === 0n) {
          lower.initialized = false;
          current.initializedTicks.delete(tickLower);
          LocalPoolStateManager.clearTickBitmapBit(current.tickBitmap, tickLower, current.tickSpacing);
        }
      }

      const upper = current.initializedTicks.get(tickUpper);
      if (upper) {
        upper.liquidityGross = upper.liquidityGross >= amount ? upper.liquidityGross - amount : 0n;
        upper.liquidityNet += amount;
        if (upper.liquidityGross === 0n) {
          upper.initialized = false;
          current.initializedTicks.delete(tickUpper);
          LocalPoolStateManager.clearTickBitmapBit(current.tickBitmap, tickUpper, current.tickSpacing);
        }
      }

      // If active tick is in range [tickLower, tickUpper), decrement current liquidity
      if (current.tick >= tickLower && current.tick < tickUpper) {
        current.liquidity = current.liquidity >= amount ? current.liquidity - amount : 0n;
      }
    }

    current.blockNumber = log.blockNumber;
    current.blockHash = log.blockHash;
    if (log.parentHash) current.parentHash = log.parentHash;
    current.lastLogIndex = log.logIndex;
    if (log.transactionIndex !== undefined) current.lastTransactionIndex = log.transactionIndex;
    current.lastUpdateMonotonicMs = log.receiptMonotonicMs;
    current.lastUpdateWallClockIso = new Date().toISOString();
    current.freshness = 'STATE_FRESH';
    current.lifecycle = 'UPDATED';
    current.stateVersion += 1;

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
      if (state.freshness === 'STATE_STALE') state.lifecycle = 'STALE';
    }
    for (const state of this.v3States.values()) {
      state.freshness = checkFreshness(state.blockNumber, state.freshness);
      if (state.freshness === 'STATE_STALE') state.lifecycle = 'STALE';
    }
  }

  /**
   * Invalidate pool state upon WebSocket disconnect or stream error.
   */
  public invalidateAll(reason?: string): void {
    void reason;
    for (const state of this.v2States.values()) {
      state.freshness = 'STATE_INVALID';
      state.lifecycle = 'RESYNC_REQUIRED';
    }
    for (const state of this.v3States.values()) {
      state.freshness = 'STATE_INVALID';
      state.lifecycle = 'RESYNC_REQUIRED';
    }
  }

  /**
   * Serializes pool state to JSON string for persistence and restart recovery.
   */
  public exportStateSnapshot(poolAddress: string): string {
    const key = poolAddress.toLowerCase();
    const v2 = this.v2States.get(key);
    if (v2) {
      return JSON.stringify({
        type: 'v2',
        metadata: v2.metadata,
        reserve0: v2.reserve0.toString(),
        reserve1: v2.reserve1.toString(),
        feeBps: v2.feeBps,
        blockNumber: v2.blockNumber.toString(),
        blockHash: v2.blockHash,
        parentHash: v2.parentHash,
        lastLogIndex: v2.lastLogIndex,
        lastTransactionIndex: v2.lastTransactionIndex,
        lastUpdateMonotonicMs: v2.lastUpdateMonotonicMs,
        lastUpdateWallClockIso: v2.lastUpdateWallClockIso,
        freshness: v2.freshness,
        lifecycle: v2.lifecycle,
        stateVersion: v2.stateVersion,
      });
    }

    const v3 = this.v3States.get(key);
    if (v3) {
      const ticksArray = Array.from(v3.initializedTicks.entries()).map(([t, info]) => [
        t,
        {
          tick: info.tick,
          liquidityNet: info.liquidityNet.toString(),
          liquidityGross: info.liquidityGross.toString(),
          initialized: info.initialized,
        },
      ]);
      const bitmapArray = Array.from(v3.tickBitmap.entries()).map(([w, word]) => [w, word.toString()]);
      return JSON.stringify({
        type: 'v3',
        metadata: v3.metadata,
        sqrtPriceX96: v3.sqrtPriceX96.toString(),
        tick: v3.tick,
        liquidity: v3.liquidity.toString(),
        feeUint24: v3.feeUint24,
        tickSpacing: v3.tickSpacing,
        initializedTicks: ticksArray,
        tickBitmap: bitmapArray,
        blockNumber: v3.blockNumber.toString(),
        blockHash: v3.blockHash,
        parentHash: v3.parentHash,
        lastLogIndex: v3.lastLogIndex,
        lastTransactionIndex: v3.lastTransactionIndex,
        lastUpdateMonotonicMs: v3.lastUpdateMonotonicMs,
        lastUpdateWallClockIso: v3.lastUpdateWallClockIso,
        freshness: v3.freshness,
        lifecycle: v3.lifecycle,
        stateVersion: v3.stateVersion,
      });
    }

    throw new Error(`Pool state not found for ${poolAddress}`);
  }

  /**
   * Restores pool state from serialized JSON snapshot.
   */
  public importStateSnapshot(snapshotJson: string): void {
    const data = JSON.parse(snapshotJson);
    if (data.type === 'v2') {
      const state: V2PoolState = {
        metadata: data.metadata,
        reserve0: BigInt(data.reserve0),
        reserve1: BigInt(data.reserve1),
        feeBps: data.feeBps,
        blockNumber: BigInt(data.blockNumber),
        blockHash: data.blockHash,
        parentHash: data.parentHash,
        lastLogIndex: data.lastLogIndex,
        lastTransactionIndex: data.lastTransactionIndex,
        lastUpdateMonotonicMs: performance.now(),
        lastUpdateWallClockIso: new Date().toISOString(),
        freshness: data.freshness,
        lifecycle: data.lifecycle,
        stateVersion: data.stateVersion,
      };
      this.v2States.set(state.metadata.poolAddress.toLowerCase(), state);
    } else if (data.type === 'v3') {
      const ticks = new Map<number, TickInfo>();
      for (const [t, info] of data.initializedTicks) {
        ticks.set(Number(t), {
          tick: info.tick,
          liquidityNet: BigInt(info.liquidityNet),
          liquidityGross: BigInt(info.liquidityGross),
          initialized: info.initialized,
        });
      }
      const bitmap = new Map<number, bigint>();
      for (const [w, word] of data.tickBitmap) {
        bitmap.set(Number(w), BigInt(word));
      }
      const state: V3PoolState = {
        metadata: data.metadata,
        sqrtPriceX96: BigInt(data.sqrtPriceX96),
        tick: data.tick,
        liquidity: BigInt(data.liquidity),
        feeUint24: data.feeUint24,
        tickSpacing: data.tickSpacing,
        initializedTicks: ticks,
        tickBitmap: bitmap,
        blockNumber: BigInt(data.blockNumber),
        blockHash: data.blockHash,
        parentHash: data.parentHash,
        lastLogIndex: data.lastLogIndex,
        lastTransactionIndex: data.lastTransactionIndex,
        lastUpdateMonotonicMs: performance.now(),
        lastUpdateWallClockIso: new Date().toISOString(),
        freshness: data.freshness,
        lifecycle: data.lifecycle,
        stateVersion: data.stateVersion,
      };
      this.v3States.set(state.metadata.poolAddress.toLowerCase(), state);
    }
  }
}

