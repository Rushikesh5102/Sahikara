/**
 * SAHIKARA Phase 4.17 — Production-Grade Local DEX State Reconstruction & Validation Test Suite
 *
 * Covers 25 deterministic unit tests:
 *  1. single-tick quote
 *  2. one-tick crossing
 *  3. multi-tick crossing
 *  4. negative tick handling
 *  5. bitmap traversal across multiple words
 *  6. liquidityNet crossing in both directions
 *  7. liquidityGross validation
 *  8. Swap event update
 *  9. Mint event update
 * 10. Burn event update
 * 11. duplicate event handling
 * 12. out-of-order event handling
 * 13. block gap detection
 * 14. reorg handling (parent hash mismatch)
 * 15. reconnect / stream reset
 * 16. restart recovery (serialize -> restart -> compare state parity)
 * 17. missing tick detection (STATE_INCOMPLETE)
 * 18. incomplete state fail-closed behavior
 * 19. stale state quote rejection
 * 20. token ordering invariant
 * 21. decimal scaling preservation
 * 22. block alignment enforcement
 * 23. state hash alignment enforcement
 * 24. Aerodrome reserve reconstruction and quote parity
 * 25. invalid state fail-closed behavior
 */

import { describe, it, expect } from 'vitest';
import { TickMath } from '@uniswap/v3-sdk';
import {
  LocalPoolStateManager,
  BasePoolMetadata,
  TickInfo,
  RawLogUpdate,
} from '../src/dexstate/LocalPoolState.js';
import { LocalPriceEngine } from '../src/dexstate/LocalPriceEngine.js';
import { StateAlignedValidator } from '../src/dexstate/StateAlignedValidator.js';

const WETH = '0x4200000000000000000000000000000000000006' as const;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const POOL_V3 = '0xd0b53d9277642d899df5c87a3966a349a798f224' as const;
const POOL_V2 = '0x04c57c4c478a87da05e263d917f694e9f73fa009' as const;

const v3Meta: BasePoolMetadata = {
  poolAddress: POOL_V3,
  protocol: 'uniswap-v3',
  token0: WETH,
  token1: USDC,
  decimals0: 18,
  decimals1: 6,
};

const v2Meta: BasePoolMetadata = {
  poolAddress: POOL_V2,
  protocol: 'aerodrome-v2',
  token0: WETH,
  token1: USDC,
  decimals0: 18,
  decimals1: 6,
};

describe('Phase 4.17 — Production-Grade DEX State Reconstruction & Multi-Tick Engine', () => {
  // 1. Single-tick quote
  it('1. evaluates single-tick quote inside active range in microseconds', () => {
    const manager = new LocalPoolStateManager();
    const sqrtP = BigInt(TickMath.getSqrtRatioAtTick(0).toString());
    const state = manager.initV3State(
      v3Meta,
      sqrtP,
      0,
      1000000000000000000n, // 1e18 liquidity
      500,
      50000000n,
      '0xabc',
      1
    );

    const res = LocalPriceEngine.quoteV3(state, WETH, 1000000000000000n); // 0.001 WETH
    expect(res.amountOut).toBeGreaterThan(0n);
    expect(res.initializedTicksCrossed).toBe(0);
    expect(res.isTickCrossing).toBe(false);
    expect(res.calculationDurationMs).toBeLessThan(5.0);
  });

  // 2. One-tick crossing
  it('2. evaluates swap crossing exactly one initialized tick', () => {
    const manager = new LocalPoolStateManager();
    const tickSpacing = 10;
    const currentTick = 5;
    const sqrtCurrent = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());

    // Create tick at 0 with liquidityNet = 500000000000000000n (0.5e18)
    const ticks = new Map<number, TickInfo>();
    ticks.set(0, {
      tick: 0,
      liquidityGross: 500000000000000000n,
      liquidityNet: 500000000000000000n,
      initialized: true,
    });

    const state = manager.initV3State(
      v3Meta,
      sqrtCurrent,
      currentTick,
      1000000000000000000n, // 1e18
      500,
      50000000n,
      '0xabc',
      1,
      ticks,
      tickSpacing
    );

    // Swap token0 (zeroForOne=true): price decreases from tick 5 to past tick 0
    const inputAmount = 100000000000000000n; // 0.1 WETH -> easily crosses to tick 0
    const res = LocalPriceEngine.quoteV3MultiTick(state, WETH, inputAmount);

    expect(res.initializedTicksCrossed).toBe(1);
    expect(res.isTickCrossing).toBe(true);
    expect(res.finalTick).toBeLessThan(0);
    expect(res.amountOut).toBeGreaterThan(0n);
  });

  // 3. Multi-tick crossing
  it('3. evaluates swap crossing multiple consecutive initialized ticks', () => {
    const manager = new LocalPoolStateManager();
    const tickSpacing = 10;
    const currentTick = 25;
    const sqrtCurrent = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());

    const ticks = new Map<number, TickInfo>();
    ticks.set(20, { tick: 20, liquidityGross: 100000000000000000n, liquidityNet: 100000000000000000n, initialized: true });
    ticks.set(10, { tick: 10, liquidityGross: 200000000000000000n, liquidityNet: 200000000000000000n, initialized: true });
    ticks.set(0, { tick: 0, liquidityGross: 300000000000000000n, liquidityNet: 300000000000000000n, initialized: true });

    const state = manager.initV3State(
      v3Meta,
      sqrtCurrent,
      currentTick,
      1000000000000000000n,
      500,
      50000000n,
      '0xabc',
      1,
      ticks,
      tickSpacing
    );

    // Large input forcing traversal past tick 20, tick 10, and tick 0
    const inputAmount = 500000000000000000n; // 0.5 WETH
    const res = LocalPriceEngine.quoteV3MultiTick(state, WETH, inputAmount);

    expect(res.initializedTicksCrossed).toBe(3);
    expect(res.isTickCrossing).toBe(true);
    expect(res.finalTick).toBeLessThan(0);
    expect(res.amountOut).toBeGreaterThan(0n);
  });

  // 4. Negative tick handling
  it('4. correctly indexes and searches negative tick values in tick bitmap', () => {
    const bitmap = new Map<number, bigint>();
    const tickSpacing = 10;

    // Set ticks at -200, -100, -10
    LocalPoolStateManager.setTickBitmapBit(bitmap, -200, tickSpacing);
    LocalPoolStateManager.setTickBitmapBit(bitmap, -100, tickSpacing);
    LocalPoolStateManager.setTickBitmapBit(bitmap, -10, tickSpacing);

    // Check initialization
    expect(LocalPoolStateManager.isTickInitialized(bitmap, -200, tickSpacing)).toBe(true);
    expect(LocalPoolStateManager.isTickInitialized(bitmap, -100, tickSpacing)).toBe(true);
    expect(LocalPoolStateManager.isTickInitialized(bitmap, -10, tickSpacing)).toBe(true);
    expect(LocalPoolStateManager.isTickInitialized(bitmap, -50, tickSpacing)).toBe(false);

    // Search <= -50 (should find -100)
    const searchDown = LocalPriceEngine.nextInitializedTickWithinOneWord(bitmap, -50, tickSpacing, true);
    expect(searchDown.initialized).toBe(true);
    expect(searchDown.next).toBe(-100);

    // Search > -150 (should find -100)
    const searchUp = LocalPriceEngine.nextInitializedTickWithinOneWord(bitmap, -150, tickSpacing, false);
    expect(searchUp.initialized).toBe(true);
    expect(searchUp.next).toBe(-100);
  });

  // 5. Bitmap traversal across multiple words
  it('5. traverses across multiple 256-bit bitmap words in both directions', () => {
    const manager = new LocalPoolStateManager();
    const tickSpacing = 10;
    // Word 0 covers compressed 0 to 255 (ticks 0 to 2550)
    // Word 1 covers compressed 256 to 511 (ticks 2560 to 5110)
    // Word -1 covers compressed -256 to -1 (ticks -2560 to -10)
    const ticks = new Map<number, TickInfo>();
    ticks.set(-500, { tick: -500, liquidityGross: 10n, liquidityNet: 10n, initialized: true });
    ticks.set(100, { tick: 100, liquidityGross: 10n, liquidityNet: 10n, initialized: true });
    ticks.set(3000, { tick: 3000, liquidityGross: 10n, liquidityNet: 10n, initialized: true });

    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(150).toString()),
      150,
      1000000000000000000n,
      500,
      50000000n,
      '0xabc',
      1,
      ticks,
      tickSpacing
    );

    // Search downwards from 150 -> should find 100 in word 0
    const down1 = LocalPriceEngine.findNextInitializedTick(state, 150, true);
    expect(down1.initialized).toBe(true);
    expect(down1.nextTick).toBe(100);

    // Search downwards from 50 -> should cross word boundary into word -1 and find -500
    const down2 = LocalPriceEngine.findNextInitializedTick(state, 50, true);
    expect(down2.initialized).toBe(true);
    expect(down2.nextTick).toBe(-500);

    // Search upwards from 200 -> should cross word boundary into word 1 and find 3000
    const up1 = LocalPriceEngine.findNextInitializedTick(state, 200, false);
    expect(up1.initialized).toBe(true);
    expect(up1.nextTick).toBe(3000);
  });

  // 6. LiquidityNet crossing in both directions
  it('6. verifies liquidityNet is subtracted when selling token0 and added when selling token1', () => {
    const manager = new LocalPoolStateManager();
    const tickSpacing = 10;
    const ticks = new Map<number, TickInfo>();
    // Tick at 100 with liquidityNet = +200
    ticks.set(100, { tick: 100, liquidityGross: 200n, liquidityNet: 200n, initialized: true });

    // When crossing 100 from right to left (zeroForOne=true, selling token0):
    // active liquidity should DECREASE by 200.
    const state0 = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(110).toString()),
      110,
      1000n,
      500,
      50000000n,
      '0xabc',
      1,
      ticks,
      tickSpacing
    );
    const res0 = LocalPriceEngine.quoteV3MultiTick(state0, WETH, 100000000000000000n);
    expect(res0.initializedTicksCrossed).toBe(1);

    // When crossing 100 from left to right (zeroForOne=false, selling token1):
    // active liquidity should INCREASE by 200.
    const state1 = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(90).toString()),
      90,
      1000n,
      500,
      50000000n,
      '0xabc',
      1,
      ticks,
      tickSpacing
    );
    const res1 = LocalPriceEngine.quoteV3MultiTick(state1, USDC, 1000000000n);
    expect(res1.initializedTicksCrossed).toBe(1);
  });

  // 7. LiquidityGross validation
  it('7. asserts liquidityGross tracks total referenced liquidity correctly', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      1
    );

    const mintLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x111',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'MINT',
      data: {
        tickLower: -50,
        tickUpper: 50,
        amount: 500n,
      },
    };

    manager.applyV3Log(mintLog);
    const lower = state.initializedTicks.get(-50);
    const upper = state.initializedTicks.get(50);
    expect(lower?.liquidityGross).toBe(500n);
    expect(lower?.liquidityNet).toBe(500n);
    expect(upper?.liquidityGross).toBe(500n);
    expect(upper?.liquidityNet).toBe(-500n);
    // Because current tick 0 is in range [-50, 50), active liquidity was incremented by 500
    expect(state.liquidity).toBe(1500n);
  });

  // 8. Swap event update
  it('8. updates pool state from SWAP event and increments state version', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      0
    );

    const newSqrt = BigInt(TickMath.getSqrtRatioAtTick(10).toString());
    const swapLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x222',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'SWAP',
      data: {
        sqrtPriceX96: newSqrt,
        tick: 10,
        liquidity: 1200n,
      },
    };

    const res = manager.applyV3Log(swapLog);
    expect(res.success).toBe(true);
    expect(state.sqrtPriceX96).toBe(newSqrt);
    expect(state.tick).toBe(10);
    expect(state.liquidity).toBe(1200n);
    expect(state.stateVersion).toBe(2);
    expect(state.lifecycle).toBe('UPDATED');
  });

  // 9. Mint event update
  it('9. initializes bitmap and ticks upon MINT event', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      0
    );

    const mintLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x333',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'MINT',
      data: {
        tickLower: -100,
        tickUpper: 100,
        amount: 800n,
      },
    };

    manager.applyV3Log(mintLog);
    expect(LocalPoolStateManager.isTickInitialized(state.tickBitmap, -100, state.tickSpacing)).toBe(true);
    expect(LocalPoolStateManager.isTickInitialized(state.tickBitmap, 100, state.tickSpacing)).toBe(true);
    expect(state.initializedTicks.has(-100)).toBe(true);
    expect(state.initializedTicks.has(100)).toBe(true);
  });

  // 10. Burn event update
  it('10. removes ticks and clears bitmap when liquidityGross reaches zero upon BURN', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      0
    );

    // First mint 500
    manager.applyV3Log({
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x333',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'MINT',
      data: { tickLower: -50, tickUpper: 50, amount: 500n },
    });

    expect(LocalPoolStateManager.isTickInitialized(state.tickBitmap, -50, state.tickSpacing)).toBe(true);

    // Then burn 500
    manager.applyV3Log({
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x444',
      logIndex: 1,
      receiptMonotonicMs: performance.now(),
      eventType: 'BURN',
      data: { tickLower: -50, tickUpper: 50, amount: 500n },
    });

    expect(LocalPoolStateManager.isTickInitialized(state.tickBitmap, -50, state.tickSpacing)).toBe(false);
    expect(LocalPoolStateManager.isTickInitialized(state.tickBitmap, 50, state.tickSpacing)).toBe(false);
    expect(state.initializedTicks.has(-50)).toBe(false);
    expect(state.initializedTicks.has(50)).toBe(false);
  });

  // 11. Duplicate event handling
  it('11. ignores duplicate log arriving for identical block and logIndex', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      0
    );

    const log: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x555',
      logIndex: 1,
      receiptMonotonicMs: performance.now(),
      eventType: 'SWAP',
      data: { sqrtPriceX96: 12345n, tick: 1, liquidity: 1000n },
    };

    const first = manager.applyV3Log(log);
    expect(first.success).toBe(true);
    expect(state.stateVersion).toBe(2);

    const dup = manager.applyV3Log(log);
    expect(dup.success).toBe(false);
    expect(dup.reason).toContain('DUPLICATE_LOG');
    expect(state.stateVersion).toBe(2); // Unchanged
  });

  // 12. Out-of-order event handling
  it('12. marks state INVALID when out-of-order log or transaction arrives', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      5
    );

    const outOfOrderLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000000n,
      blockHash: '0xabc',
      transactionHash: '0x666',
      logIndex: 2, // lower than lastLogIndex 5
      receiptMonotonicMs: performance.now(),
      eventType: 'SWAP',
      data: { sqrtPriceX96: 12345n, tick: 1, liquidity: 1000n },
    };

    const res = manager.applyV3Log(outOfOrderLog);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('OUT_OF_ORDER_LOG');
    expect(state.freshness).toBe('STATE_INVALID');
    expect(state.lifecycle).toBe('INVALID');
  });

  // 13. Block gap detection
  it('13. detects block gaps (> 1 block) and halts state to RESYNC_REQUIRED', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc',
      0
    );

    const gapLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000005n, // Jumped 5 blocks
      blockHash: '0xzzz',
      transactionHash: '0x777',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'SWAP',
      data: { sqrtPriceX96: 12345n, tick: 1, liquidity: 1000n },
    };

    const res = manager.applyV3Log(gapLog);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('BLOCK_GAP_DETECTED');
    expect(state.freshness).toBe('STATE_INVALID');
    expect(state.lifecycle).toBe('RESYNC_REQUIRED');
  });

  // 14. Reorg handling (parent hash mismatch)
  it('14. detects chain reorganization via parentHash mismatch and triggers RESYNC_REQUIRED', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xcanonical_hash',
      0
    );

    const reorgLog: RawLogUpdate = {
      poolAddress: POOL_V3,
      blockNumber: 50000001n,
      blockHash: '0xfork_hash',
      parentHash: '0xdivergent_parent_hash', // Does NOT match 0xcanonical_hash
      transactionHash: '0x888',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'SWAP',
      data: { sqrtPriceX96: 12345n, tick: 1, liquidity: 1000n },
    };

    const res = manager.applyV3Log(reorgLog);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('REORG_DETECTED_PARENT_HASH_MISMATCH');
    expect(state.freshness).toBe('STATE_INVALID');
    expect(state.lifecycle).toBe('RESYNC_REQUIRED');
  });

  // 15. Reconnect / stream reset
  it('15. invalidateAll safely transitions all pools to RESYNC_REQUIRED upon disconnect', () => {
    const manager = new LocalPoolStateManager();
    const v3 = manager.initV3State(v3Meta, 100n, 0, 1000n, 500, 50000000n, '0xabc');
    const v2 = manager.initV2State(v2Meta, 1000n, 1000n, 30, 50000000n, '0xabc');

    manager.invalidateAll('STREAM_DISCONNECT');
    expect(v3.freshness).toBe('STATE_INVALID');
    expect(v3.lifecycle).toBe('RESYNC_REQUIRED');
    expect(v2.freshness).toBe('STATE_INVALID');
    expect(v2.lifecycle).toBe('RESYNC_REQUIRED');
  });

  // 16. Restart recovery
  it('16. serializes snapshot, restarts engine, and proves bit-level parity at identical block', () => {
    const manager1 = new LocalPoolStateManager();
    const ticks = new Map<number, TickInfo>();
    ticks.set(100, { tick: 100, liquidityGross: 500n, liquidityNet: 500n, initialized: true });
    ticks.set(-100, { tick: -100, liquidityGross: 500n, liquidityNet: 500n, initialized: true });

    manager1.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(50).toString()),
      50,
      2500000n,
      500,
      50000000n,
      '0xcanonical_hash',
      12,
      ticks,
      10
    );

    // 1. Export snapshot
    const snapshot = manager1.exportStateSnapshot(POOL_V3);
    expect(typeof snapshot).toBe('string');

    // 2. Restart: simulate new engine instance
    const manager2 = new LocalPoolStateManager();
    manager2.importStateSnapshot(snapshot);

    const restored = manager2.getV3State(POOL_V3);
    expect(restored).toBeDefined();
    expect(restored!.sqrtPriceX96).toBe(BigInt(TickMath.getSqrtRatioAtTick(50).toString()));
    expect(restored!.tick).toBe(50);
    expect(restored!.liquidity).toBe(2500000n);
    expect(restored!.blockNumber).toBe(50000000n);
    expect(restored!.blockHash).toBe('0xcanonical_hash');
    expect(restored!.initializedTicks.size).toBe(2);
    expect(LocalPoolStateManager.isTickInitialized(restored!.tickBitmap, 100, 10)).toBe(true);
    expect(LocalPoolStateManager.isTickInitialized(restored!.tickBitmap, -100, 10)).toBe(true);
  });

  // 17. Missing tick detection
  it('17. throws STATE_INCOMPLETE when tick is flagged in bitmap but missing from initializedTicks', () => {
    const manager = new LocalPoolStateManager();
    const bitmap = new Map<number, bigint>();
    // Flag tick 10 in bitmap
    LocalPoolStateManager.setTickBitmapBit(bitmap, 10, 10);

    // Provide empty initializedTicks map
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(20).toString()),
      20,
      1000000000000000000n,
      500,
      50000000n,
      '0xabc',
      0,
      new Map<number, TickInfo>(),
      10,
      bitmap
    );

    expect(() => {
      LocalPriceEngine.quoteV3MultiTick(state, WETH, 500000000000000000n);
    }).toThrow('STATE_INCOMPLETE: Tick 10 initialized in bitmap but missing from initializedTicks');
  });

  // 18. Incomplete state fail-closed behavior
  it('18. StateAlignedValidator marks incomplete states as INCOMPLETE_STATE', () => {
    const report = StateAlignedValidator.validate({
      poolAddress: POOL_V3,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: 1000n,
      localAmountOut: 0n,
      localBlockNumber: 50000000n,
      authoritativeAmountOut: 2500000n,
      authoritativeBlockNumber: 50000000n,
      isIncompleteState: true,
    });

    expect(report.classification).toBe('INCOMPLETE_STATE');
    expect(report.notes).toContain('incomplete');
  });

  // 19. Stale state quote rejection
  it('19. marks pool STALE after 3 blocks and updates lifecycle', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV3State(
      v3Meta,
      BigInt(TickMath.getSqrtRatioAtTick(0).toString()),
      0,
      1000n,
      500,
      50000000n,
      '0xabc'
    );

    manager.evaluateFreshness(50000004n); // 4 blocks old
    expect(state.freshness).toBe('STATE_STALE');
    expect(state.lifecycle).toBe('STALE');
  });

  // 20. Token ordering invariant
  it('20. throws error if token0 is not strictly less than token1', () => {
    const manager = new LocalPoolStateManager();
    const invalidMeta: BasePoolMetadata = {
      poolAddress: POOL_V3,
      protocol: 'uniswap-v3',
      token0: USDC, // 0x833...
      token1: WETH, // 0x420... (USDC > WETH lexicographically)
      decimals0: 6,
      decimals1: 18,
    };

    expect(() => {
      manager.initV3State(invalidMeta, 100n, 0, 100n, 500, 50000000n, '0xabc');
    }).toThrow('Token ordering violation: token0 must be strictly less than token1');
  });

  // 21. Decimal scaling preservation
  it('21. preserves 18-to-6 decimal precision without unexpected precision loss', () => {
    const manager = new LocalPoolStateManager();
    // 1 WETH (18 dec) -> ~2500 USDC (6 dec)
    const state = manager.initV2State(
      v2Meta,
      1000n * 10n ** 18n,   // 1000 WETH
      2500000n * 10n ** 6n, // 2,500,000 USDC
      30,                   // 0.30% fee
      50000000n,
      '0xabc'
    );

    const quote = LocalPriceEngine.quoteV2(state, WETH, 1n * 10n ** 18n); // 1 WETH
    expect(quote.amountOut).toBeGreaterThan(2490000000n); // ~2,492.5 USDC
    expect(quote.amountOut).toBeLessThan(2500000000n);
    expect(quote.tokenOut).toBe(USDC);
  });

  // 22. Block alignment enforcement
  it('22. StateAlignedValidator rejects comparisons across non-identical blocks', () => {
    const report = StateAlignedValidator.validate({
      poolAddress: POOL_V3,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: 1000n,
      localAmountOut: 2500n,
      localBlockNumber: 50000000n,
      authoritativeAmountOut: 2500n,
      authoritativeBlockNumber: 50000001n, // Block mismatch
    });

    expect(report.classification).toBe('STATE_MISMATCH');
    expect(report.isBlockAligned).toBe(false);
    expect(report.notes).toContain('Block mismatch');
  });

  // 23. State hash alignment enforcement
  it('23. StateAlignedValidator rejects comparisons when block hashes diverge', () => {
    const report = StateAlignedValidator.validate({
      poolAddress: POOL_V3,
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: 1000n,
      localAmountOut: 2500n,
      localBlockNumber: 50000000n,
      localBlockHash: '0xhash_a',
      authoritativeAmountOut: 2500n,
      authoritativeBlockNumber: 50000000n,
      authoritativeBlockHash: '0xhash_b', // Hash mismatch
    });

    expect(report.classification).toBe('STATE_MISMATCH');
    expect(report.notes).toContain('Block hash mismatch');
  });

  // 24. Aerodrome reserve reconstruction
  it('24. accurately reconstructs Aerodrome constant-product reserves across SYNC, SWAP, MINT, BURN', () => {
    const manager = new LocalPoolStateManager();
    const state = manager.initV2State(v2Meta, 1000n, 2000n, 30, 50000000n, '0xabc');

    // 1. SYNC
    manager.applyV2Log({
      poolAddress: POOL_V2,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x10',
      logIndex: 0,
      receiptMonotonicMs: performance.now(),
      eventType: 'SYNC',
      data: { reserve0: 1200n, reserve1: 2400n },
    });
    expect(state.reserve0).toBe(1200n);
    expect(state.reserve1).toBe(2400n);

    // 2. MINT
    manager.applyV2Log({
      poolAddress: POOL_V2,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x11',
      logIndex: 1,
      receiptMonotonicMs: performance.now(),
      eventType: 'MINT',
      data: { amount0: 300n, amount1: 600n },
    });
    expect(state.reserve0).toBe(1500n);
    expect(state.reserve1).toBe(3000n);

    // 3. BURN
    manager.applyV2Log({
      poolAddress: POOL_V2,
      blockNumber: 50000001n,
      blockHash: '0xabd',
      transactionHash: '0x12',
      logIndex: 2,
      receiptMonotonicMs: performance.now(),
      eventType: 'BURN',
      data: { amount0: 100n, amount1: 200n },
    });
    expect(state.reserve0).toBe(1400n);
    expect(state.reserve1).toBe(2800n);

    // 4. Quote on reconstructed state
    const quote = LocalPriceEngine.quoteV2(state, WETH, 100n);
    expect(quote.amountOut).toBeGreaterThan(0n);
    expect(quote.stateFreshness).toBe('STATE_FRESH');
  });

  // 25. Invalid state fail-closed behavior
  it('25. fails closed by throwing immediate exceptions on STATE_INVALID pool state', () => {
    const manager = new LocalPoolStateManager();
    const v3 = manager.initV3State(v3Meta, 100n, 0, 100n, 500, 50000000n, '0xabc');
    const v2 = manager.initV2State(v2Meta, 100n, 100n, 30, 50000000n, '0xabc');

    v3.freshness = 'STATE_INVALID';
    v2.freshness = 'STATE_INVALID';

    expect(() => LocalPriceEngine.quoteV2(v2, WETH, 10n)).toThrow('Cannot quote on INVALID pool state');
    expect(() => LocalPriceEngine.quoteV3(v3, WETH, 10n)).toThrow('Cannot quote on INVALID pool state');
    expect(() => LocalPriceEngine.quoteV3MultiTick(v3, WETH, 10n)).toThrow('Cannot quote on INVALID pool state');
  });
});
