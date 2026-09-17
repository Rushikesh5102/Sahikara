/**
 * SAHIKARA Phase 4.14 — Volatility Regime Classifier
 *
 * Implements deterministic classification of market volatility over micro-windows
 * based on:
 * 1. Price Change Rate: |dP| / dt in basis points per second.
 * 2. Rolling Realized Volatility: standard deviation of logarithmic returns in basis points.
 *
 * Defined Regimes:
 * - LOW:      Rate <= 1.0 bps/sec  OR  Sigma <= 5.0 bps
 * - NORMAL:   Rate <= 3.0 bps/sec  OR  Sigma <= 15.0 bps
 * - ELEVATED: Rate <= 7.0 bps/sec  OR  Sigma <= 30.0 bps
 * - HIGH:     Rate >  7.0 bps/sec  OR  Sigma >  30.0 bps
 */

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';

export interface PricePoint {
  price: number;
  monotonicMs: number;
}

export interface VolatilityMetrics {
  regime: VolatilityRegime;
  priceChangeRateBpsPerSec: number;
  realizedVolBps: number;
  observationCount: number;
  windowDurationSec: number;
}

export class VolatilityRegimeClassifier {
  private readonly history: PricePoint[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 10000) {
    this.windowMs = windowMs;
  }

  public recordPrice(price: number, monotonicMs: number): void {
    this.history.push({ price, monotonicMs });
    const cutoff = monotonicMs - this.windowMs;
    while (this.history.length > 0 && this.history[0]!.monotonicMs < cutoff) {
      this.history.shift();
    }
  }

  public classifyCurrentRegime(): VolatilityMetrics {
    if (this.history.length < 2) {
      return {
        regime: 'LOW',
        priceChangeRateBpsPerSec: 0,
        realizedVolBps: 0,
        observationCount: this.history.length,
        windowDurationSec: 0,
      };
    }

    const first = this.history[0]!;
    const last = this.history[this.history.length - 1]!;
    const windowDurationSec = (last.monotonicMs - first.monotonicMs) / 1000;

    if (windowDurationSec <= 0) {
      return {
        regime: 'LOW',
        priceChangeRateBpsPerSec: 0,
        realizedVolBps: 0,
        observationCount: this.history.length,
        windowDurationSec: 0,
      };
    }

    // 1. Calculate price change rate: total absolute price movement over time
    let totalAbsoluteDeltaBps = 0;
    const logReturns: number[] = [];

    for (let i = 1; i < this.history.length; i++) {
      const pPrev = this.history[i - 1]!.price;
      const pCurr = this.history[i]!.price;
      if (pPrev > 0 && pCurr > 0) {
        const deltaBps = Math.abs((pCurr - pPrev) / pPrev) * 10000;
        totalAbsoluteDeltaBps += deltaBps;
        logReturns.push(Math.log(pCurr / pPrev) * 10000);
      }
    }

    const priceChangeRateBpsPerSec = Number((totalAbsoluteDeltaBps / windowDurationSec).toFixed(2));

    // 2. Calculate standard deviation of log returns in bps
    let realizedVolBps = 0;
    if (logReturns.length > 1) {
      const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
      const variance = logReturns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / (logReturns.length - 1);
      realizedVolBps = Number(Math.sqrt(variance).toFixed(2));
    }

    // 3. Classify into documented regimes
    let regime: VolatilityRegime = 'LOW';
    if (priceChangeRateBpsPerSec > 7.0 || realizedVolBps > 30.0) {
      regime = 'HIGH';
    } else if (priceChangeRateBpsPerSec > 3.0 || realizedVolBps > 15.0) {
      regime = 'ELEVATED';
    } else if (priceChangeRateBpsPerSec > 1.0 || realizedVolBps > 5.0) {
      regime = 'NORMAL';
    } else {
      regime = 'LOW';
    }

    return {
      regime,
      priceChangeRateBpsPerSec,
      realizedVolBps,
      observationCount: this.history.length,
      windowDurationSec: Number(windowDurationSec.toFixed(2)),
    };
  }
}
