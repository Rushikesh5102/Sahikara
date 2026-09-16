/**
 * SAHIKARA Phase 4.5 — Statistical Distribution Engine
 *
 * Implements parametric and percentile distribution analysis across:
 * - Gross spread (bps)
 * - Net spread (bps)
 * - Total gas cost ($)
 * - Trade size ($)
 * - Latency (ms)
 * - Opportunity lifetime (s)
 * - Quoted price impact (bps)
 * - Next-block spread decay (bps)
 *
 * For every metric computes:
 *   N, min, p25, median, mean, p75, p90, p95, p99, max
 *
 * RADICAL HONESTY & STATISTICAL INTEGRITY:
 *   - Never claims statistically significant conclusions from tiny samples (N < 30).
 *   - Safe handling for N = 0 (returns all zeros / N/A flags).
 *   - Strictly separates MODELLED DECAY from OBSERVED DECAY.
 */

export interface MetricDistribution {
  n: number;
  min: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  isTinySample: boolean;
}

export type StatisticalPopulation =
  | 'ALL_ATTEMPTS'
  | 'ALL_VALID_EXECUTABLE_QUOTES'
  | 'ALL_REJECTIONS';

export interface StatisticalRecord {
  grossSpreadBps: number;
  netProfitBps: number;
  gasCostUsd: number;
  tradeSizeUsd: number;
  latencyMs: number;
  opportunityLifetimeSec?: number;
  priceImpactBps: number;
  observedSpreadDecayBps?: number;
  isQuoteValid?: boolean;
}

export interface StatisticalSummaryReport {
  population: StatisticalPopulation;
  totalRecords: number;
  grossSpreadDist: MetricDistribution;
  netSpreadDist: MetricDistribution;
  gasCostDist: MetricDistribution;
  tradeSizeDist: MetricDistribution;
  latencyDist: MetricDistribution;
  lifetimeDist: MetricDistribution;
  priceImpactDist: MetricDistribution;
  spreadDecayDist: MetricDistribution;
}

export class StatisticalReporter {
  /**
   * Calculates percentile and summary statistics for a given array of numbers.
   */
  public static calculateDistribution(values: number[]): MetricDistribution {
    const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
    const n = valid.length;

    if (n === 0) {
      return {
        n: 0,
        min: 0,
        p25: 0,
        median: 0,
        mean: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        max: 0,
        isTinySample: true,
      };
    }

    const sorted = [...valid].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    return {
      n,
      min: sorted[0]!,
      p25: this.getPercentile(sorted, 0.25),
      median: this.getPercentile(sorted, 0.50),
      mean,
      p75: this.getPercentile(sorted, 0.75),
      p90: this.getPercentile(sorted, 0.90),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
      max: sorted[sorted.length - 1]!,
      isTinySample: n < 30,
    };
  }

  /**
   * Computes percentile via linear rank interpolation.
   */
  private static getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]!;

    const idx = p * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;

    if (lower === upper) return sorted[lower]!;
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }

  /**
   * Aggregates records into a full statistical report across the 8 key metrics.
   *
   * POPULATION FILTERING:
   *   - If population is ALL_VALID_EXECUTABLE_QUOTES, records with isQuoteValid === false
   *     or NaN/infinite spreads are excluded to prevent contaminating economic distributions.
   */
  public static generateReport(
    records: StatisticalRecord[],
    population: StatisticalPopulation = 'ALL_VALID_EXECUTABLE_QUOTES'
  ): StatisticalSummaryReport {
    const filtered =
      population === 'ALL_VALID_EXECUTABLE_QUOTES'
        ? records.filter((r) => r.isQuoteValid !== false && !isNaN(r.grossSpreadBps) && isFinite(r.grossSpreadBps))
        : records;

    const grossSpreads = filtered.map((r) => r.grossSpreadBps);
    const netSpreads = filtered.map((r) => r.netProfitBps);
    const gasCosts = filtered.map((r) => r.gasCostUsd);
    const tradeSizes = filtered.map((r) => r.tradeSizeUsd);
    const latencies = filtered.map((r) => r.latencyMs);
    const lifetimes = filtered
      .map((r) => r.opportunityLifetimeSec)
      .filter((v): v is number => typeof v === 'number');
    const priceImpacts = filtered.map((r) => r.priceImpactBps);
    const decays = filtered
      .map((r) => r.observedSpreadDecayBps)
      .filter((v): v is number => typeof v === 'number');

    return {
      population,
      totalRecords: filtered.length,
      grossSpreadDist: this.calculateDistribution(grossSpreads),
      netSpreadDist: this.calculateDistribution(netSpreads),
      gasCostDist: this.calculateDistribution(gasCosts),
      tradeSizeDist: this.calculateDistribution(tradeSizes),
      latencyDist: this.calculateDistribution(latencies),
      lifetimeDist: this.calculateDistribution(lifetimes),
      priceImpactDist: this.calculateDistribution(priceImpacts),
      spreadDecayDist: this.calculateDistribution(decays),
    };
  }

  /**
   * Formats a single metric distribution row for a Markdown table.
   */
  public static formatRow(name: string, unit: string, d: MetricDistribution): string {
    if (d.n === 0) {
      return `| ${name} (${unit}) | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |`;
    }
    const fmt = (v: number): string => (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(2) : v.toFixed(2));
    const sampleTag = d.isTinySample ? ' ⚠️ (Tiny Sample)' : '';
    return `| ${name} (${unit})${sampleTag} | ${d.n} | ${fmt(d.min)} | ${fmt(d.p25)} | ${fmt(d.median)} | ${fmt(d.mean)} | ${fmt(d.p75)} | ${fmt(d.p90)} | ${fmt(d.p95)} | ${fmt(d.p99)} | ${fmt(d.max)} |`;
  }

  /**
   * Formats the complete markdown distribution table.
   */
  public static formatMarkdownTable(report: StatisticalSummaryReport): string {
    const header = `### Statistical Population: [${report.population}] (Total Evaluated: ${report.totalRecords})`;
    const rows = [
      header,
      '| Metric | N | Min | p25 | Median | Mean | p75 | p90 | p95 | p99 | Max |',
      '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
      this.formatRow('Gross Spread', 'bps', report.grossSpreadDist),
      this.formatRow('Net Spread', 'bps', report.netSpreadDist),
      this.formatRow('Gas Cost', '$', report.gasCostDist),
      this.formatRow('Trade Size', '$', report.tradeSizeDist),
      this.formatRow('Latency', 'ms', report.latencyDist),
      this.formatRow('Opportunity Lifetime', 'sec', report.lifetimeDist),
      this.formatRow('Price Impact', 'bps', report.priceImpactDist),
      this.formatRow('Observed Next-Block Decay', 'bps', report.spreadDecayDist),
    ];
    return rows.join('\n');
  }
}
