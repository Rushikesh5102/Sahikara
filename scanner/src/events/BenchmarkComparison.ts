/**
 * SAHIKARA Phase 2 — Architecture Benchmark Comparison
 *
 * Quantitatively benchmarks the performance difference between:
 *   1. Phase 1F Polling Architecture (sequential sweep of all 26 routes)
 *   2. Phase 2 Event-Driven Architecture (selective re-quoting of only affected routes)
 *
 * Metrics compared:
 *   - Total quotes dispatched per update
 *   - Total execution duration (ms)
 *   - RPC compute unit and call reduction (%)
 *   - End-to-end detection latency reduction (%)
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only profiling. Zero private keys, zero wallet signing, zero live trading.
 */

import type { MarketDiscoveryEngine } from '../discovery/MarketDiscoveryEngine.js';
import type { EventRouteDispatcher } from './EventRouteDispatcher.js';
import type { PoolStateChangeEvent, BenchmarkMetrics } from './EventTypes.js';

export class BenchmarkComparison {
  constructor(
    private readonly discoveryEngine: MarketDiscoveryEngine,
    private readonly routeDispatcher: EventRouteDispatcher
  ) {}

  /**
   * Run a side-by-side benchmark comparing one polling cycle vs one event-driven dispatch.
   */
  async runComparison(sampleEvent: PoolStateChangeEvent): Promise<BenchmarkMetrics> {
    // 1. Benchmark Sequential Polling Architecture
    const pollStart = performance.now();
    const pollResult = await this.discoveryEngine.runCycle();
    const pollingDurationMs = Math.round(performance.now() - pollStart);
    // Each route evaluated across research sizes (2 quotes per round trip)
    const pollingRoutesEvaluated = pollResult.routesEvaluated;
    const pollingQuotesAttempted = pollResult.evaluations.length * 2;

    // 2. Benchmark Event-Driven Selective Architecture
    const eventStart = performance.now();
    const eventResult = await this.routeDispatcher.dispatchEvent(sampleEvent);
    const eventDurationMs = Math.round(performance.now() - eventStart);
    const eventRoutesEvaluated = eventResult.affectedRoutesCount;
    const eventQuotesAttempted = eventResult.evaluations.length * 2;

    // 3. Calculate Relative Efficiency Improvements
    const rpcCallReductionPercent =
      pollingQuotesAttempted > 0
        ? Math.round(((pollingQuotesAttempted - eventQuotesAttempted) / pollingQuotesAttempted) * 1000) / 10
        : 0;

    const latencyReductionPercent =
      pollingDurationMs > 0
        ? Math.round(((pollingDurationMs - eventDurationMs) / pollingDurationMs) * 1000) / 10
        : 0;

    return {
      pollingDurationMs,
      pollingQuotesAttempted,
      pollingRoutesEvaluated,
      eventDurationMs,
      eventQuotesAttempted,
      eventRoutesEvaluated,
      rpcCallReductionPercent,
      latencyReductionPercent,
    };
  }
}
