/**
 * SAHIKARA Phase 3 — Shadow / Paper Execution Engine
 *
 * Implements an off-chain paper execution ledger:
 * - Maintains a simulated cash balance (e.g. $100 / ₹100 capital envelope)
 * - Evaluates atomic simulation outcomes without transmitting on-chain transactions
 * - Deducts gas costs on simulated reverts, credits net profit on simulated fills
 * - Produces audit records for every hypothetical trade
 *
 * ZERO LIVE CALLS:
 * - No private keys
 * - No wallet signers
 * - No transaction submission
 */

import type {
  CompleteSimulationResult,
  ShadowAccountState,
  ShadowTradeRecord,
} from './types.js';

export class ShadowExecutionEngine {
  private accountState: ShadowAccountState;
  private tradeHistory: ShadowTradeRecord[] = [];

  constructor(initialCapitalUsd: number = 100.0) {
    this.accountState = {
      initialCapitalUsd,
      currentCashBalanceUsd: initialCapitalUsd,
      realizedPnLUsd: 0.0,
      totalGasSpentUsd: 0.0,
      tradesAttempted: 0,
      tradesFilled: 0,
      tradesReverted: 0,
      winRate: 0.0,
    };
  }

  /**
   * Returns current account balance and performance metrics.
   */
  public getAccountState(): ShadowAccountState {
    const totalFinished = this.accountState.tradesFilled + this.accountState.tradesReverted;
    const winRate = totalFinished > 0
      ? (this.accountState.tradesFilled / totalFinished) * 100
      : 0;

    return {
      ...this.accountState,
      winRate: Number(winRate.toFixed(2)),
    };
  }

  /**
   * Returns all recorded shadow paper trades.
   */
  public getTradeHistory(): ShadowTradeRecord[] {
    return [...this.tradeHistory];
  }

  /**
   * Simulates paper execution for a given complete simulation result.
   */
  public executeShadowTrade(simulation: CompleteSimulationResult): ShadowTradeRecord | null {
    // Only attempt trade if candidate met theoretical profitability criteria
    if (!simulation.simulated.isProfitableCandidate) {
      return null;
    }

    this.accountState.tradesAttempted += 1;

    const tradeId = `shadow_${Date.now()}_${simulation.routeId}_${this.accountState.tradesAttempted}`;
    const gasCostUsd = simulation.estimates.gasCostUsd;
    const netPnLUsd = simulation.simulated.netPnLUsd;
    const grossProfitUsd = simulation.tradeSizeUsd * (simulation.simulated.grossSpreadBps / 10_000);

    let resultingBalanceUsd: number;

    if (simulation.simulated.reverted) {
      // Revert: capital preserved, but gas cost permanently deducted
      this.accountState.tradesReverted += 1;
      this.accountState.totalGasSpentUsd = Number((this.accountState.totalGasSpentUsd + gasCostUsd).toFixed(4));
      this.accountState.realizedPnLUsd = Number((this.accountState.realizedPnLUsd - gasCostUsd).toFixed(4));
      this.accountState.currentCashBalanceUsd = Number((this.accountState.currentCashBalanceUsd - gasCostUsd).toFixed(4));
      resultingBalanceUsd = this.accountState.currentCashBalanceUsd;
    } else {
      // Fill: net PnL credited to balance
      this.accountState.tradesFilled += 1;
      this.accountState.totalGasSpentUsd = Number((this.accountState.totalGasSpentUsd + gasCostUsd).toFixed(4));
      this.accountState.realizedPnLUsd = Number((this.accountState.realizedPnLUsd + netPnLUsd).toFixed(4));
      this.accountState.currentCashBalanceUsd = Number((this.accountState.currentCashBalanceUsd + netPnLUsd).toFixed(4));
      resultingBalanceUsd = this.accountState.currentCashBalanceUsd;
    }

    const tradeRecord: ShadowTradeRecord = {
      tradeId,
      timestampMs: simulation.timestampMs,
      blockNumber: simulation.observed.blockNumber,
      routeId: simulation.routeId,
      tradeSizeUsd: simulation.tradeSizeUsd,
      grossProfitUsd: Number(grossProfitUsd.toFixed(4)),
      gasCostUsd: Number(gasCostUsd.toFixed(4)),
      netPnLUsd: Number(netPnLUsd.toFixed(4)),
      reverted: simulation.simulated.reverted,
      revertReason: simulation.simulated.revertReason,
      resultingBalanceUsd: Number(resultingBalanceUsd.toFixed(4)),
    };

    this.tradeHistory.push(tradeRecord);
    return tradeRecord;
  }
}
