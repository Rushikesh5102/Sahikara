import { describe, it, expect } from 'vitest';
import { InventoryModel } from '../src/crossvenue/InventoryModel.js';
import { TransferCostModel } from '../src/crossvenue/TransferCostModel.js';

describe('Inventory & Transfer Cost Models', () => {
  it('evaluates Model A sequential transfer constraints and classifies as NOT_ATOMIC', () => {
    const invA = InventoryModel.evaluateInventory('MODEL_A_SEQUENTIAL_TRANSFER', 1000);
    expect(invA.atomicity).toBe('NOT_ATOMIC');
    expect(invA.isExecutableConcurrently).toBe(false);
    expect(invA.deltaRiskProfile).toBe('SEVERE_DIRECTIONAL_EXPOSURE');
    expect(invA.totalCapitalAllocatedUsd).toBe(1000);
    expect(invA.capitalUtilizationRatio).toBe(1.0);
  });

  it('evaluates Model B pre-positioned inventory capital drag and buffer requirements', () => {
    const invB = InventoryModel.evaluateInventory('MODEL_B_PREPOSITIONED_DUAL', 1000, 2.5);
    expect(invB.atomicity).toBe('NOT_ATOMIC');
    expect(invB.isExecutableConcurrently).toBe(true);
    expect(invB.deltaRiskProfile).toBe('IMMEDIATE_LEG_HEDGED');
    // Total capital = 1000 * 2.5 * 4 = $10,000 committed
    expect(invB.totalCapitalAllocatedUsd).toBe(10000);
    expect(invB.capitalUtilizationRatio).toBe(0.1); // 10% utilization

    // Yield on committed capital is 10x lower than per-trade return
    const perTradeNetProfit = 5.0; // $5 profit on $1,000 trade = 50 bps
    const committedYieldBps = InventoryModel.calculateReturnOnCommittedCapitalBps(
      perTradeNetProfit,
      invB.totalCapitalAllocatedUsd
    );
    expect(committedYieldBps).toBe(5.0); // 5 bps return on $10,000 committed
  });

  it('correctly models chain-specific deposit confirmation latencies and fees', () => {
    const baseTransfer = TransferCostModel.calculateSequentialTransferPenalty(8453, 500);
    expect(baseTransfer.atomicity).toBe('NOT_ATOMIC');
    expect(baseTransfer.estimatedDelaySec).toBe(24); // 12 blocks * 2s
    expect(baseTransfer.withdrawalFeeUsd).toBe(0.50);

    const polygonTransfer = TransferCostModel.calculateSequentialTransferPenalty(137, 500);
    expect(polygonTransfer.estimatedDelaySec).toBe(256); // 128 blocks * 2s
    expect(polygonTransfer.withdrawalFeeUsd).toBe(1.00);
  });
});
