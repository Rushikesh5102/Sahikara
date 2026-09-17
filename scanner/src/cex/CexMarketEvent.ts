/**
 * SAHIKARA Phase 4.13B — Normalized Market Event Architecture
 *
 * Provides a unified event abstraction across CEX order books/trades
 * and on-chain DEX pool state transitions (Swap, Sync, Mint, Burn).
 *
 * Adheres to Directives 32 and 33:
 * - Strict segregation of clock domains.
 * - Source and venue tagging with full provenance.
 * - Zero execution capabilities.
 */

export type MarketEventSource = 'cex' | 'dex';

export type MarketEventType =
  | 'CEX_BOOK_UPDATE'
  | 'CEX_TRADE'
  | 'DEX_SWAP'
  | 'DEX_MINT'
  | 'DEX_BURN'
  | 'DEX_SYNC';

export interface MarketEvent {
  source: MarketEventSource;
  venue: string;
  chainId?: number;
  symbol: string;
  assetId: string;
  eventType: MarketEventType;
  eventTimestamp: number | null;     // Source event timestamp (EXCHANGE_TIME or PROTOCOL_TIME)
  localReceiveMonotonic: number;    // LOCAL_MONOTONIC_TIME (performance.now())
  localReceiveWallClock: number;    // LOCAL_WALL_TIME (Date.now())
  sequence?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  blockNumber?: number;
  blockHash?: string;
  metadata?: Record<string, unknown>;
}

export function createCexBookEvent(params: {
  venue: string;
  symbol: string;
  assetId: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  exchangeTimestamp: number | null;
  localReceiveMonotonic: number;
  localReceiveWallClock: number;
  sequence?: number;
}): MarketEvent {
  return {
    source: 'cex',
    venue: params.venue,
    symbol: params.symbol,
    assetId: params.assetId,
    eventType: 'CEX_BOOK_UPDATE',
    eventTimestamp: params.exchangeTimestamp,
    localReceiveMonotonic: params.localReceiveMonotonic,
    localReceiveWallClock: params.localReceiveWallClock,
    bid: params.bid,
    ask: params.ask,
    bidSize: params.bidSize,
    askSize: params.askSize,
    sequence: params.sequence,
  };
}

export function createDexSwapEvent(params: {
  venue: string;
  chainId: number;
  symbol: string;
  assetId: string;
  blockNumber: number;
  blockHash: string;
  protocolTimestamp: number | null;
  localReceiveMonotonic: number;
  localReceiveWallClock: number;
  metadata?: Record<string, unknown>;
}): MarketEvent {
  return {
    source: 'dex',
    venue: params.venue,
    chainId: params.chainId,
    symbol: params.symbol,
    assetId: params.assetId,
    eventType: 'DEX_SWAP',
    eventTimestamp: params.protocolTimestamp,
    localReceiveMonotonic: params.localReceiveMonotonic,
    localReceiveWallClock: params.localReceiveWallClock,
    blockNumber: params.blockNumber,
    blockHash: params.blockHash,
    metadata: params.metadata,
  };
}
