/**
 * SAHIKARA Phase 4.14 — Microstructure Metrics Calculator
 *
 * Implements deterministic calculations for:
 * - Bid-Ask Spread ($ and bps)
 * - Order Book Depth (Bid Depth vs Ask Depth)
 * - Order Book Depth Imbalance:
 *     Imbalance = (BidDepth - AskDepth) / (BidDepth + AskDepth)
 *     Bounded strictly in [-1.0, +1.0].
 * - Book Slope: dP / dQ
 * - Rolling update and price change frequencies
 */

import { CexOrderBook } from './CexOrderBook.js';

export interface OrderBookMicrostructure {
  venue: string;
  symbol: string;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
  spreadUsd: number;
  spreadBps: number;
  topBidSize: number;
  topAskSize: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  totalDepthUsd: number;
  depthImbalance: number; // in [-1.0, +1.0]
  bookSlopeBpsPer10kUsd: number;
}

export class MicrostructureMetrics {
  /**
   * Evaluates instantaneous order-book microstructure for a given depth level.
   */
  public static evaluateBook(book: CexOrderBook, depthLevels = 10): OrderBookMicrostructure | null {
    const bestBid = book.getBestBid();
    const bestAsk = book.getBestAsk();

    if (!bestBid || !bestAsk || bestAsk.price <= bestBid.price) {
      return null;
    }

    const midPrice = (bestAsk.price + bestBid.price) / 2;
    const spreadUsd = bestAsk.price - bestBid.price;
    const spreadBps = (spreadUsd / midPrice) * 10000;

    const bids = book.getBids().slice(0, depthLevels);
    const asks = book.getAsks().slice(0, depthLevels);

    const bidDepthUsd = bids.reduce((acc, b) => acc + b.price * b.size, 0);
    const askDepthUsd = asks.reduce((acc, a) => acc + a.price * a.size, 0);
    const totalDepthUsd = bidDepthUsd + askDepthUsd;

    // Imbalance formula: (BidDepth - AskDepth) / (BidDepth + AskDepth)
    const depthImbalance = totalDepthUsd > 0
      ? (bidDepthUsd - askDepthUsd) / totalDepthUsd
      : 0;

    // Book slope: price distance between best level and N-th level per notional depth
    let bookSlopeBpsPer10kUsd = 0;
    if (asks.length > 1 && askDepthUsd > 0) {
      const askDeltaPrice = asks[asks.length - 1]!.price - bestAsk.price;
      const askDeltaBps = (askDeltaPrice / midPrice) * 10000;
      bookSlopeBpsPer10kUsd = (askDeltaBps / askDepthUsd) * 10000;
    }

    return {
      venue: book.venue,
      symbol: book.symbol,
      midPrice: Number(midPrice.toFixed(4)),
      bestBid: bestBid.price,
      bestAsk: bestAsk.price,
      spreadUsd: Number(spreadUsd.toFixed(4)),
      spreadBps: Number(spreadBps.toFixed(4)),
      topBidSize: bestBid.size,
      topAskSize: bestAsk.size,
      bidDepthUsd: Number(bidDepthUsd.toFixed(2)),
      askDepthUsd: Number(askDepthUsd.toFixed(2)),
      totalDepthUsd: Number(totalDepthUsd.toFixed(2)),
      depthImbalance: Number(depthImbalance.toFixed(4)),
      bookSlopeBpsPer10kUsd: Number(bookSlopeBpsPer10kUsd.toFixed(4)),
    };
  }

  /**
   * Tracks update frequency and mid-price change frequency over a rolling window.
   */
  public static calculateFrequencies(timestampsMonotonicMs: number[], windowMs = 5000): number {
    if (timestampsMonotonicMs.length < 2) return 0;
    const now = timestampsMonotonicMs[timestampsMonotonicMs.length - 1]!;
    const cutoff = now - windowMs;
    const recent = timestampsMonotonicMs.filter((t) => t >= cutoff);
    if (recent.length < 2) return 0;

    const elapsedSec = (now - recent[0]!) / 1000;
    return elapsedSec > 0 ? Number((recent.length / elapsedSec).toFixed(2)) : 0;
  }
}
