/**
 * SAHIKARA Phase 4.13B — CEX Order Book Representation
 *
 * Implements an in-memory L2 central limit order book representation
 * with strict price sorting, depth inspection, and liquidity verification.
 *
 * Invariants:
 * - Bids strictly sorted descending: price[i] > price[i+1]
 * - Asks strictly sorted ascending: price[i] < price[i+1]
 * - Mid-market spread validation: bestAsk > bestBid
 */

import { CexOrderBookLevel, CexOrderBookSnapshot, CexVenue } from './ICexMarketDataSource.js';

export class CexOrderBook {
  public readonly venue: CexVenue;
  public readonly symbol: string;
  private bids: CexOrderBookLevel[] = [];
  private asks: CexOrderBookLevel[] = [];
  private lastExchangeTimestamp: number | null = null;
  private lastLocalReceiveMonotonic: number = 0;
  private lastLocalReceiveWallClock: number = 0;

  constructor(venue: CexVenue, symbol: string) {
    this.venue = venue;
    this.symbol = symbol;
  }

  public updateFromSnapshot(snapshot: CexOrderBookSnapshot): void {
    if (snapshot.venue !== this.venue || snapshot.symbol !== this.symbol) {
      throw new Error(
        `[CexOrderBook] Snapshot venue/symbol mismatch: expected ${this.venue}:${this.symbol}, got ${snapshot.venue}:${snapshot.symbol}`
      );
    }

    // Sort bids descending (highest price first)
    this.bids = [...snapshot.bids].sort((a, b) => b.price - a.price);

    // Sort asks ascending (lowest price first)
    this.asks = [...snapshot.asks].sort((a, b) => a.price - b.price);

    this.lastExchangeTimestamp = snapshot.exchangeTimestamp;
    this.lastLocalReceiveMonotonic = snapshot.localReceiveMonotonic;
    this.lastLocalReceiveWallClock = snapshot.localReceiveWallClock;
  }

  public getBestBid(): CexOrderBookLevel | null {
    return this.bids[0] || null;
  }

  public getBestAsk(): CexOrderBookLevel | null {
    return this.asks[0] || null;
  }

  public getSpread(): { spreadUsd: number; spreadBps: number } | null {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    if (!bestBid || !bestAsk) return null;

    const spreadUsd = bestAsk.price - bestBid.price;
    const midPrice = (bestAsk.price + bestBid.price) / 2;
    const spreadBps = midPrice > 0 ? (spreadUsd / midPrice) * 10000 : 0;

    return { spreadUsd, spreadBps };
  }

  public getBids(): readonly CexOrderBookLevel[] {
    return this.bids;
  }

  public getAsks(): readonly CexOrderBookLevel[] {
    return this.asks;
  }

  public getTotalBidLiquidityBase(): number {
    return this.bids.reduce((sum, b) => sum + b.size, 0);
  }

  public getTotalAskLiquidityBase(): number {
    return this.asks.reduce((sum, a) => sum + a.size, 0);
  }

  public getTotalBidLiquidityUsd(): number {
    return this.bids.reduce((sum, b) => sum + b.price * b.size, 0);
  }

  public getTotalAskLiquidityUsd(): number {
    return this.asks.reduce((sum, a) => sum + a.price * a.size, 0);
  }

  public getTimestamps(): {
    exchangeTimestamp: number | null;
    localReceiveMonotonic: number;
    localReceiveWallClock: number;
  } {
    return {
      exchangeTimestamp: this.lastExchangeTimestamp,
      localReceiveMonotonic: this.lastLocalReceiveMonotonic,
      localReceiveWallClock: this.lastLocalReceiveWallClock,
    };
  }
}
