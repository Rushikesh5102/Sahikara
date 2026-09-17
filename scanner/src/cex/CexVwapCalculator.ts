/**
 * SAHIKARA Phase 4.13B — Deterministic CEX Order Book VWAP Calculator
 *
 * Implements exact order-book traversal for simulated executions across notional sizes.
 *
 * Adheres strictly to Directive 40:
 * - BUY: walks asks ascending from best ask upward.
 * - SELL: walks bids descending from best bid downward.
 * - Returns requestedSize, filledSize, averagePrice, totalCost, unfilledSize, levelsConsumed, priceImpact.
 * - Fails immediately if order book depth is insufficient; NEVER extrapolates.
 */

import { CexOrderBook } from './CexOrderBook.js';

export type VwapDirection = 'BUY' | 'SELL';

export interface VwapResult {
  status: 'FILLED' | 'INSUFFICIENT_DEPTH';
  direction: VwapDirection;
  requestedNotionalUsd: number;
  requestedBaseQuantity: number;
  filledBaseQuantity: number;
  filledNotionalUsd: number;
  unfilledNotionalUsd: number;
  averagePrice: number;
  bestPrice: number;
  levelsConsumed: number;
  priceImpactBps: number;
}

export class CexVwapCalculator {
  /**
   * Calculate VWAP execution for a given notional USD trade size.
   *
   * @param book In-memory order book
   * @param direction 'BUY' (consume asks) or 'SELL' (consume bids)
   * @param targetNotionalUsd Trade size in USD (e.g. 10, 50, 500, 1000, 5000)
   */
  public static calculateVwapForNotional(
    book: CexOrderBook,
    direction: VwapDirection,
    targetNotionalUsd: number
  ): VwapResult {
    if (targetNotionalUsd <= 0) {
      throw new Error(`[CexVwapCalculator] Target notional must be positive, got ${targetNotionalUsd}`);
    }

    const levels = direction === 'BUY' ? book.getAsks() : book.getBids();
    if (levels.length === 0) {
      return {
        status: 'INSUFFICIENT_DEPTH',
        direction,
        requestedNotionalUsd: targetNotionalUsd,
        requestedBaseQuantity: 0,
        filledBaseQuantity: 0,
        filledNotionalUsd: 0,
        unfilledNotionalUsd: targetNotionalUsd,
        averagePrice: 0,
        bestPrice: 0,
        levelsConsumed: 0,
        priceImpactBps: 0,
      };
    }

    const bestPrice = levels[0].price;
    let remainingNotionalUsd = targetNotionalUsd;
    let accumulatedBase = 0;
    let accumulatedUsd = 0;
    let levelsConsumed = 0;

    for (const level of levels) {
      if (remainingNotionalUsd <= 0.000001) break;

      levelsConsumed++;
      const levelNotionalUsd = level.price * level.size;

      if (levelNotionalUsd >= remainingNotionalUsd) {
        // Partial fill of this level
        const baseNeeded = remainingNotionalUsd / level.price;
        accumulatedBase += baseNeeded;
        accumulatedUsd += remainingNotionalUsd;
        remainingNotionalUsd = 0;
        break;
      } else {
        // Full fill of this level
        accumulatedBase += level.size;
        accumulatedUsd += levelNotionalUsd;
        remainingNotionalUsd -= levelNotionalUsd;
      }
    }

    const isFilled = remainingNotionalUsd <= 0.000001;
    const averagePrice = accumulatedBase > 0 ? accumulatedUsd / accumulatedBase : 0;

    // Price impact relative to best level
    let priceImpactBps = 0;
    if (bestPrice > 0 && averagePrice > 0) {
      if (direction === 'BUY') {
        priceImpactBps = ((averagePrice - bestPrice) / bestPrice) * 10000;
      } else {
        priceImpactBps = ((bestPrice - averagePrice) / bestPrice) * 10000;
      }
    }

    return {
      status: isFilled ? 'FILLED' : 'INSUFFICIENT_DEPTH',
      direction,
      requestedNotionalUsd: targetNotionalUsd,
      requestedBaseQuantity: accumulatedBase + (isFilled ? 0 : remainingNotionalUsd / (levels[levels.length - 1]?.price || bestPrice)),
      filledBaseQuantity: accumulatedBase,
      filledNotionalUsd: accumulatedUsd,
      unfilledNotionalUsd: remainingNotionalUsd,
      averagePrice,
      bestPrice,
      levelsConsumed,
      priceImpactBps: Math.max(0, priceImpactBps),
    };
  }
}
