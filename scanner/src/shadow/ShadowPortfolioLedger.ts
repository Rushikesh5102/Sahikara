/**
 * SAHIKARA Phase 4 — Shadow / Paper Portfolio Ledger
 *
 * Maintains a strict off-chain virtual paper trading account:
 * - Default virtual capital: $100.00 [PAPER/SIMULATION]
 * - Tracks available vs committed balance
 * - Enforces on-chain contract revert economics (100% principal protection, 100% gas loss)
 * - Calculates ROI, Win Rate, Drawdown, and PnL metrics
 *
 * CRITICAL SEPARATION RULE:
 * Synthetic test fixtures and Live Market shadow trades are maintained
 * in separate ledger instances to prevent synthetic results from corrupting
 * empirical market discovery statistics.
 *
 * STRICT SAFETY DIRECTIVE:
 * Virtual paper accounting only. Zero real capital.
 */

import type { ShadowOpportunity, ShadowPortfolioState } from './types.js';

export interface ShadowPortfolioOptions {
  startingBalanceUsd?: number;
  isSyntheticLedger?: boolean;
}

export class ShadowPortfolioLedger {
  private readonly startingBalanceUsd: number;
  private readonly isSyntheticLedger: boolean;

  private availableBalanceUsd: number;
  private committedBalanceUsd: number;
  private currentCashBalanceUsd: number;

  private grossPnLUsd: number = 0;
  private l2GasCostUsd: number = 0;
  private l1DataFeeUsd: number = 0;
  private totalGasSpentUsd: number = 0;
  private otherCostUsd: number = 0;
  private riskBufferUsd: number = 0;
  private netPnLUsd: number = 0;

  private tradesAttempted: number = 0;
  private tradesFilled: number = 0;
  private tradesReverted: number = 0;
  private opportunitiesExpired: number = 0;
  private opportunitiesMissed: number = 0;
  private opportunitiesRejected: number = 0;

  private winCount: number = 0;
  private lossCount: number = 0;
  private peakBalanceUsd: number;
  private maxDrawdownUsd: number = 0;
  private consecutiveLosses: number = 0;
  private maxConsecutiveLosses: number = 0;

  constructor(options: ShadowPortfolioOptions = {}) {
    this.startingBalanceUsd = options.startingBalanceUsd ?? 100.0;
    this.isSyntheticLedger = options.isSyntheticLedger ?? false;

    this.availableBalanceUsd = this.startingBalanceUsd;
    this.committedBalanceUsd = 0;
    this.currentCashBalanceUsd = this.startingBalanceUsd;
    this.peakBalanceUsd = this.startingBalanceUsd;
  }

  /**
   * Commits virtual capital for a shadow opportunity prior to execution.
   */
  public commitCapital(opportunity: ShadowOpportunity): boolean {
    if (opportunity.tradeSizeUsd > this.availableBalanceUsd) {
      return false; // Insufficient virtual balance
    }

    this.availableBalanceUsd -= opportunity.tradeSizeUsd;
    this.committedBalanceUsd += opportunity.tradeSizeUsd;
    this.tradesAttempted++;
    return true;
  }

  /**
   * Settles a filled shadow trade (simulated successful inclusion).
   */
  public settleTrade(opportunity: ShadowOpportunity, realizedNetPnLUsd?: number): void {
    const netPnL = realizedNetPnLUsd ?? opportunity.netExpectedPnLUsd;
    const gas = opportunity.gasBreakdown;

    // Release committed capital
    this.committedBalanceUsd -= opportunity.tradeSizeUsd;

    // Update cash balance with net outcome
    this.currentCashBalanceUsd += netPnL;
    this.availableBalanceUsd += opportunity.tradeSizeUsd + netPnL;

    // Update accounting metrics
    this.grossPnLUsd += opportunity.grossProfitUsd;
    this.l2GasCostUsd += gas.l2GasCostUsd;
    this.l1DataFeeUsd += gas.l1DataFeeUsd;
    this.totalGasSpentUsd += gas.totalGasCostUsd;
    this.riskBufferUsd += opportunity.riskBufferUsd;
    this.netPnLUsd += netPnL;

    this.tradesFilled++;

    if (netPnL > 0) {
      this.winCount++;
      this.consecutiveLosses = 0;
    } else {
      this.lossCount++;
      this.consecutiveLosses++;
      if (this.consecutiveLosses > this.maxConsecutiveLosses) {
        this.maxConsecutiveLosses = this.consecutiveLosses;
      }
    }

    this.updateDrawdown();
  }

  /**
   * Settles a reverted shadow trade (100% principal protected, 100% gas consumed).
   */
  public revertTrade(opportunity: ShadowOpportunity): void {
    const gas = opportunity.gasBreakdown;

    // Release committed principal 100% back to available balance
    this.committedBalanceUsd -= opportunity.tradeSizeUsd;
    this.availableBalanceUsd += opportunity.tradeSizeUsd;

    // Deduct gas burned from cash balance
    this.currentCashBalanceUsd -= gas.totalGasCostUsd;
    this.availableBalanceUsd -= gas.totalGasCostUsd;

    this.l2GasCostUsd += gas.l2GasCostUsd;
    this.l1DataFeeUsd += gas.l1DataFeeUsd;
    this.totalGasSpentUsd += gas.totalGasCostUsd;
    this.netPnLUsd -= gas.totalGasCostUsd;

    this.tradesReverted++;
    this.lossCount++;
    this.consecutiveLosses++;
    if (this.consecutiveLosses > this.maxConsecutiveLosses) {
      this.maxConsecutiveLosses = this.consecutiveLosses;
    }

    this.updateDrawdown();
  }

  public recordExpired(): void {
    this.opportunitiesExpired++;
  }

  public recordMissed(): void {
    this.opportunitiesMissed++;
  }

  public recordRejected(): void {
    this.opportunitiesRejected++;
  }

  private updateDrawdown(): void {
    if (this.currentCashBalanceUsd > this.peakBalanceUsd) {
      this.peakBalanceUsd = this.currentCashBalanceUsd;
    }
    const currentDrawdown = this.peakBalanceUsd - this.currentCashBalanceUsd;
    if (currentDrawdown > this.maxDrawdownUsd) {
      this.maxDrawdownUsd = currentDrawdown;
    }
  }

  /**
   * Returns a snapshot of current portfolio state and performance metrics.
   */
  public getState(): ShadowPortfolioState {
    const totalClosed = this.winCount + this.lossCount;
    const winRatePercent = totalClosed > 0 ? (this.winCount / totalClosed) * 100 : null;
    const roiPercent = ((this.currentCashBalanceUsd - this.startingBalanceUsd) / this.startingBalanceUsd) * 100;

    return {
      startingBalanceUsd: this.startingBalanceUsd,
      availableBalanceUsd: this.availableBalanceUsd,
      committedBalanceUsd: this.committedBalanceUsd,
      grossPnLUsd: this.grossPnLUsd,
      l2GasCostUsd: this.l2GasCostUsd,
      l1DataFeeUsd: this.l1DataFeeUsd,
      totalGasSpentUsd: this.totalGasSpentUsd,
      otherCostUsd: this.otherCostUsd,
      riskBufferUsd: this.riskBufferUsd,
      netPnLUsd: this.netPnLUsd,
      currentCashBalanceUsd: this.currentCashBalanceUsd,

      tradesAttempted: this.tradesAttempted,
      tradesFilled: this.tradesFilled,
      tradesReverted: this.tradesReverted,
      opportunitiesExpired: this.opportunitiesExpired,
      opportunitiesMissed: this.opportunitiesMissed,
      opportunitiesRejected: this.opportunitiesRejected,

      winCount: this.winCount,
      lossCount: this.lossCount,
      winRatePercent,
      roiPercent,

      maxDrawdownUsd: this.maxDrawdownUsd,
      peakBalanceUsd: this.peakBalanceUsd,
      consecutiveLosses: this.consecutiveLosses,
      maxConsecutiveLosses: this.maxConsecutiveLosses,

      isSyntheticLedger: this.isSyntheticLedger,
      lastUpdatedMs: Date.now(),
    };
  }
}
