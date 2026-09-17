/**
 * SAHIKARA Phase 4.13B — CEX Market Data Source Interface
 *
 * Defines strictly read-only, unauthenticated public market-data contracts for
 * centralized exchanges (Binance, Coinbase, Kraken).
 *
 * INVARIANTS:
 * - Read-only public market data only.
 * - ZERO trading credentials, ZERO order submission, ZERO private keys.
 * - Every observation preserves distinct clock-domain tags.
 */

export type CexVenue = 'binance' | 'coinbase' | 'kraken';

export interface CexOrderBookLevel {
  price: number;
  size: number;
  numOrders?: number;
}

export interface CexOrderBookSnapshot {
  venue: CexVenue;
  symbol: string;
  bids: CexOrderBookLevel[];
  asks: CexOrderBookLevel[];
  exchangeTimestamp: number | null; // Milliseconds in EXCHANGE_TIME domain
  localReceiveMonotonic: number;   // Milliseconds in LOCAL_MONOTONIC_TIME domain
  localReceiveWallClock: number;   // Milliseconds in LOCAL_WALL_TIME domain
  sequence?: number;
  depthRequested: number;
}

export interface CexTicker {
  venue: CexVenue;
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  exchangeTimestamp: number | null;
  localReceiveMonotonic: number;
  localReceiveWallClock: number;
}

export interface CexServerTime {
  venue: CexVenue;
  exchangeTimeMs: number;
  localReceiveMonotonic: number;
  localReceiveWallClock: number;
  exchangeToLocalClockDeltaMs: number; // localReceiveWallClock - exchangeTimeMs
  rttMs: number;
}

export interface ICexMarketDataSource {
  readonly venue: CexVenue;
  getOrderBook(symbol: string, depth?: number): Promise<CexOrderBookSnapshot>;
  getTicker(symbol: string): Promise<CexTicker>;
  getServerTime(): Promise<CexServerTime>;
}
