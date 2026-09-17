/**
 * SAHIKARA Phase 4.13B — Cross-Venue Inventory Allocation Model
 *
 * Quantifies capital requirements, utilization rates, and operational drag
 * across Model A (Sequential Post-Signal Transfer) and Model B (Pre-Positioned Dual Inventory).
 *
 * Adheres strictly to Directives 17, 19, 43, 44:
 * - Distinguishes Model A vs Model B execution constraints.
 * - Quantifies idle capital drag on allocated inventory.
 * - Models rebalancing transfer costs and inventory depletion.
 * - Formally classifies cross-venue execution as NOT_ATOMIC.
 */

export type InventoryArchitecture = 'MODEL_A_SEQUENTIAL_TRANSFER' | 'MODEL_B_PREPOSITIONED_DUAL';

export interface InventoryAllocation {
  architecture: InventoryArchitecture;
  tradeSizeUsd: number;
  cexCashUsd: number;
  cexCryptoUsd: number;
  dexCashUsd: number;
  dexCryptoUsd: number;
  totalCapitalAllocatedUsd: number;
  capitalUtilizationRatio: number; // tradeSizeUsd / totalCapitalAllocatedUsd
  isExecutableConcurrently: boolean;
  atomicity: 'NOT_ATOMIC';
  deltaRiskProfile: 'SEVERE_DIRECTIONAL_EXPOSURE' | 'IMMEDIATE_LEG_HEDGED';
  rebalanceThresholdUsd: number;
  rebalanceTransferCostUsd: number;
}

export class InventoryModel {
  /**
   * Evaluate inventory requirements for a given trade size.
   *
   * @param architecture Model A or Model B
   * @param tradeSizeUsd Size of the trade in USD
   * @param bufferMultiplier Capital buffer factor (default 2.5x for safety)
   */
  public static evaluateInventory(
    architecture: InventoryArchitecture,
    tradeSizeUsd: number,
    bufferMultiplier = 2.5
  ): InventoryAllocation {
    if (tradeSizeUsd <= 0) {
      throw new Error(`[InventoryModel] tradeSizeUsd must be positive, got ${tradeSizeUsd}`);
    }

    if (architecture === 'MODEL_A_SEQUENTIAL_TRANSFER') {
      // Model A: Capital is on one venue, transferred to the other upon signal
      const totalCapitalAllocatedUsd = tradeSizeUsd;
      return {
        architecture,
        tradeSizeUsd,
        cexCashUsd: tradeSizeUsd,
        cexCryptoUsd: 0,
        dexCashUsd: 0,
        dexCryptoUsd: 0,
        totalCapitalAllocatedUsd,
        capitalUtilizationRatio: 1.0,
        isExecutableConcurrently: false,
        atomicity: 'NOT_ATOMIC',
        deltaRiskProfile: 'SEVERE_DIRECTIONAL_EXPOSURE',
        rebalanceThresholdUsd: 0,
        rebalanceTransferCostUsd: 0.80, // Single transfer cost
      };
    }

    // Model B: Pre-positioned Dual Inventory
    // Requires USD and Crypto on both CEX and DEX to handle either direction
    const legAllocationUsd = tradeSizeUsd * bufferMultiplier;
    const cexCashUsd = legAllocationUsd;
    const cexCryptoUsd = legAllocationUsd;
    const dexCashUsd = legAllocationUsd;
    const dexCryptoUsd = legAllocationUsd;
    const totalCapitalAllocatedUsd = cexCashUsd + cexCryptoUsd + dexCashUsd + dexCryptoUsd;
    const capitalUtilizationRatio = tradeSizeUsd / totalCapitalAllocatedUsd;

    return {
      architecture,
      tradeSizeUsd,
      cexCashUsd,
      cexCryptoUsd,
      dexCashUsd,
      dexCryptoUsd,
      totalCapitalAllocatedUsd,
      capitalUtilizationRatio,
      isExecutableConcurrently: true,
      atomicity: 'NOT_ATOMIC', // Still structurally non-atomic across venues
      deltaRiskProfile: 'IMMEDIATE_LEG_HEDGED',
      rebalanceThresholdUsd: tradeSizeUsd * 2.0, // Rebalance when 2 trades accumulate
      rebalanceTransferCostUsd: 1.60, // Two-way transfer fee allowance [ESTIMATED]
    };
  }

  /**
   * Calculate capital-adjusted net return on total committed capital.
   */
  public static calculateReturnOnCommittedCapitalBps(
    netProfitUsd: number,
    totalCapitalAllocatedUsd: number
  ): number {
    if (totalCapitalAllocatedUsd <= 0) return 0;
    return (netProfitUsd / totalCapitalAllocatedUsd) * 10000;
  }
}
