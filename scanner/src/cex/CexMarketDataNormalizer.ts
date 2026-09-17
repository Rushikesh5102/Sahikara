/**
 * SAHIKARA Phase 4.13B — CEX Public Market Data Normalizer
 *
 * Implements public unauthenticated HTTP clients for Binance, Coinbase, and Kraken.
 *
 * Adheres strictly to:
 * - Directives 4, 5, 6, 7, 8, 34, 35:
 *   - Read-only public endpoints only.
 *   - Zero API keys, zero authentication, zero account credentials.
 *   - Captures EXCHANGE_TIME, LOCAL_WALL_TIME, and LOCAL_MONOTONIC_TIME.
 *   - Calculates EXCHANGE_TO_LOCAL_CLOCK_DELTA.
 *   - Respects public rate limits with timeout and status handling.
 */

import {
  CexOrderBookLevel,
  CexOrderBookSnapshot,
  CexServerTime,
  CexTicker,
  CexVenue,
  ICexMarketDataSource,
} from './ICexMarketDataSource.js';

interface RawBinanceDepth {
  lastUpdateId?: number;
  bids?: [string, string][];
  asks?: [string, string][];
}

interface RawCoinbaseDepth {
  sequence?: number;
  time?: string;
  bids?: [string, string, number | string][];
  asks?: [string, string, number | string][];
}

interface RawKrakenDepth {
  result?: Record<string, {
    bids?: [string, string, string | number][];
    asks?: [string, string, string | number][];
  }>;
}

interface RawBinanceTicker {
  bidPrice?: string;
  askPrice?: string;
  bidQty?: string;
  askQty?: string;
}

interface RawCoinbaseTicker {
  bid?: string;
  ask?: string;
  volume?: string;
  time?: string;
}

interface RawKrakenTicker {
  result?: Record<string, {
    a?: [string, string, string];
    b?: [string, string, string];
  }>;
}

interface RawBinanceTime {
  serverTime?: number;
}

interface RawCoinbaseTime {
  epoch?: number;
}

interface RawKrakenTime {
  result?: {
    unixtime?: number;
  };
}

export class CexMarketDataNormalizer implements ICexMarketDataSource {
  public readonly venue: CexVenue;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(venue: CexVenue, timeoutMs = 8000) {
    this.venue = venue;
    this.timeoutMs = timeoutMs;
    switch (venue) {
      case 'binance':
        this.baseUrl = 'https://api.binance.com';
        break;
      case 'coinbase':
        this.baseUrl = 'https://api.exchange.coinbase.com';
        break;
      case 'kraken':
        this.baseUrl = 'https://api.kraken.com';
        break;
      default:
        throw new Error(`[CexMarketDataNormalizer] Unsupported venue: ${venue}`);
    }
  }

  public async getOrderBook(symbol: string, depth = 20): Promise<CexOrderBookSnapshot> {
    let url = '';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SAHIKARA/0.1.0',
      Accept: 'application/json',
    };

    if (this.venue === 'binance') {
      url = `${this.baseUrl}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${depth}`;
    } else if (this.venue === 'coinbase') {
      url = `${this.baseUrl}/products/${encodeURIComponent(symbol)}/book?level=2`;
    } else if (this.venue === 'kraken') {
      url = `${this.baseUrl}/0/public/Depth?pair=${encodeURIComponent(symbol)}&count=${depth}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      const tEndMonotonic = performance.now();
      const tEndWallClock = Date.now();

      if (!response.ok) {
        throw new Error(
          `[CexMarketDataNormalizer] ${this.venue} getOrderBook failed HTTP ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      return this.parseSnapshot(data, symbol, depth, tEndMonotonic, tEndWallClock);
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[CexMarketDataNormalizer] ${this.venue} getOrderBook(${symbol}) error: ${msg}`);
    }
  }

  public async getTicker(symbol: string): Promise<CexTicker> {
    let url = '';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SAHIKARA/0.1.0',
      Accept: 'application/json',
    };

    if (this.venue === 'binance') {
      url = `${this.baseUrl}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;
    } else if (this.venue === 'coinbase') {
      url = `${this.baseUrl}/products/${encodeURIComponent(symbol)}/ticker`;
    } else if (this.venue === 'kraken') {
      url = `${this.baseUrl}/0/public/Ticker?pair=${encodeURIComponent(symbol)}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      const tEndMonotonic = performance.now();
      const tEndWallClock = Date.now();

      if (!response.ok) {
        throw new Error(
          `[CexMarketDataNormalizer] ${this.venue} getTicker failed HTTP ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      return this.parseTicker(data, symbol, tEndMonotonic, tEndWallClock);
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[CexMarketDataNormalizer] ${this.venue} getTicker(${symbol}) error: ${msg}`);
    }
  }

  public async getServerTime(): Promise<CexServerTime> {
    const tStartMonotonic = performance.now();

    let url = '';
    if (this.venue === 'binance') {
      url = `${this.baseUrl}/api/v3/time`;
    } else if (this.venue === 'coinbase') {
      url = `${this.baseUrl}/time`;
    } else if (this.venue === 'kraken') {
      url = `${this.baseUrl}/0/public/Time`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 SAHIKARA/0.1.0', Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const tEndMonotonic = performance.now();
      const tEndWallClock = Date.now();

      if (!response.ok) {
        throw new Error(
          `[CexMarketDataNormalizer] ${this.venue} getServerTime failed HTTP ${response.status}`
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      let exchangeTimeMs = tEndWallClock;

      if (this.venue === 'binance') {
        const bTime = data as RawBinanceTime;
        exchangeTimeMs = Number(bTime.serverTime);
      } else if (this.venue === 'coinbase') {
        const cTime = data as RawCoinbaseTime;
        exchangeTimeMs = Math.round(Number(cTime.epoch) * 1000);
      } else if (this.venue === 'kraken') {
        const kTime = data as RawKrakenTime;
        exchangeTimeMs = Math.round(Number(kTime.result?.unixtime) * 1000);
      }

      const rttMs = tEndMonotonic - tStartMonotonic;
      const deltaMs = tEndWallClock - exchangeTimeMs;

      return {
        venue: this.venue,
        exchangeTimeMs,
        localReceiveMonotonic: tEndMonotonic,
        localReceiveWallClock: tEndWallClock,
        exchangeToLocalClockDeltaMs: deltaMs,
        rttMs,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[CexMarketDataNormalizer] ${this.venue} getServerTime error: ${msg}`);
    }
  }

  private parseSnapshot(
    data: Record<string, unknown>,
    symbol: string,
    depth: number,
    tEndMonotonic: number,
    tEndWallClock: number
  ): CexOrderBookSnapshot {
    let bids: CexOrderBookLevel[] = [];
    let asks: CexOrderBookLevel[] = [];
    let exchangeTimestamp: number | null = null;
    let sequence: number | undefined;

    if (this.venue === 'binance') {
      const bData = data as RawBinanceDepth;
      sequence = bData.lastUpdateId;
      bids = (bData.bids || []).slice(0, depth).map((b) => ({
        price: parseFloat(b[0]),
        size: parseFloat(b[1]),
      }));
      asks = (bData.asks || []).slice(0, depth).map((a) => ({
        price: parseFloat(a[0]),
        size: parseFloat(a[1]),
      }));
    } else if (this.venue === 'coinbase') {
      const cData = data as RawCoinbaseDepth;
      sequence = cData.sequence;
      if (cData.time) {
        exchangeTimestamp = new Date(cData.time).getTime();
      }
      bids = (cData.bids || []).slice(0, depth).map((b) => ({
        price: parseFloat(String(b[0])),
        size: parseFloat(String(b[1])),
        numOrders: parseInt(String(b[2]), 10),
      }));
      asks = (cData.asks || []).slice(0, depth).map((a) => ({
        price: parseFloat(String(a[0])),
        size: parseFloat(String(a[1])),
        numOrders: parseInt(String(a[2]), 10),
      }));
    } else if (this.venue === 'kraken') {
      const kData = data as RawKrakenDepth;
      const pairKey = Object.keys(kData.result || {})[0];
      const pairData = pairKey && kData.result ? kData.result[pairKey] : undefined;
      bids = (pairData?.bids || []).slice(0, depth).map((b) => ({
        price: parseFloat(String(b[0])),
        size: parseFloat(String(b[1])),
      }));
      asks = (pairData?.asks || []).slice(0, depth).map((a) => ({
        price: parseFloat(String(a[0])),
        size: parseFloat(String(a[1])),
      }));
      if (pairData?.bids?.[0]?.[2]) {
        exchangeTimestamp = Math.round(parseFloat(String(pairData.bids[0][2])) * 1000);
      }
    }

    return {
      venue: this.venue,
      symbol,
      bids,
      asks,
      exchangeTimestamp,
      localReceiveMonotonic: tEndMonotonic,
      localReceiveWallClock: tEndWallClock,
      sequence,
      depthRequested: depth,
    };
  }

  private parseTicker(
    data: Record<string, unknown>,
    symbol: string,
    tEndMonotonic: number,
    tEndWallClock: number
  ): CexTicker {
    let bid = 0;
    let ask = 0;
    let bidSize = 0;
    let askSize = 0;
    let exchangeTimestamp: number | null = null;

    if (this.venue === 'binance') {
      const bData = data as RawBinanceTicker;
      bid = parseFloat(bData.bidPrice || '0');
      ask = parseFloat(bData.askPrice || '0');
      bidSize = parseFloat(bData.bidQty || '0');
      askSize = parseFloat(bData.askQty || '0');
    } else if (this.venue === 'coinbase') {
      const cData = data as RawCoinbaseTicker;
      bid = parseFloat(cData.bid || '0');
      ask = parseFloat(cData.ask || '0');
      bidSize = parseFloat(cData.volume || '0');
      askSize = parseFloat(cData.volume || '0');
      if (cData.time) {
        exchangeTimestamp = new Date(cData.time).getTime();
      }
    } else if (this.venue === 'kraken') {
      const kData = data as RawKrakenTicker;
      const pairKey = Object.keys(kData.result || {})[0];
      const pairData = pairKey && kData.result ? kData.result[pairKey] : undefined;
      bid = parseFloat(pairData?.b?.[0] || '0');
      ask = parseFloat(pairData?.a?.[0] || '0');
      bidSize = parseFloat(pairData?.b?.[2] || '0');
      askSize = parseFloat(pairData?.a?.[2] || '0');
    }

    return {
      venue: this.venue,
      symbol,
      bid,
      ask,
      bidSize,
      askSize,
      exchangeTimestamp,
      localReceiveMonotonic: tEndMonotonic,
      localReceiveWallClock: tEndWallClock,
    };
  }
}
