/**
 * SAHIKARA Observer — Market Observer Orchestrator
 *
 * Coordinates the full polling loop:
 *   1. Verify RPC connectivity
 *   2. Fetch current block and gas price
 *   3. For each registered pool × trade size:
 *      a. Call adapter to get executable quote
 *      b. Calculate economics (gross / net / net-with-buffer)
 *      c. Store observation in SQLite
 *      d. Print formatted report to stdout
 *   4. Sleep for configured interval
 *   5. Repeat
 *
 * SECURITY INVARIANTS:
 *   - No transaction signing
 *   - No transaction submission
 *   - No private key access
 *   - All operations are read-only
 *
 * TOKEN PRICE HANDLING:
 *   [ASSUMPTION] Token prices for USD conversion are NOT fetched from a live oracle.
 *   Phase 1C uses configurable price assumptions. This is adequate for research
 *   observation (we care about spreads, not absolute USD values) but must be
 *   replaced with a live price feed in Phase 3+.
 *
 *   Default assumptions:
 *   - WETH: $2,400 [ASSUMPTION — update via WETH_PRICE_USD env var]
 *   - USDC/USDbC: $1.00 [FACT — stablecoin peg]
 *   - cbBTC: $62,000 [ASSUMPTION — update via CBBTC_PRICE_USD env var]
 *   - AERO: $1.20 [ASSUMPTION — update via AERO_PRICE_USD env var]
 */

import type { ObserverConfig } from '../config/config.js';
import type { IDataSource } from '../data-sources/IDataSource.js';
import type { IPoolAdapter } from '../adapters/IPoolAdapter.js';
import type { PoolDefinition } from '../config/pools.js';
import { ObservationStore } from '../storage/ObservationStore.js';
import { estimateGasCost, FALLBACK_ETH_PRICE_USD } from '../economics/gasEstimator.js';
import {
  calculateProfit,
  usdToTokenAmount,
  type TokenPriceContext,
} from '../economics/profitCalculator.js';
import { BASE_CHAIN_ID } from '../data-sources/RpcDataSource.js';

// ─────────────────────────────────────────────────────────────────────────────
// Token Price Registry (configurable, non-oracle)
// ─────────────────────────────────────────────────────────────────────────────

/** [ASSUMPTION] Fallback token prices in USD. Must be updated by operator. */
const TOKEN_PRICE_USD: Record<string, number> = {
  WETH: parseFloat(process.env['WETH_PRICE_USD'] ?? '2400'),
  USDC: 1.0,
  USDbC: 1.0,
  DAI: 1.0,
  cbBTC: parseFloat(process.env['CBBTC_PRICE_USD'] ?? '62000'),
  AERO: parseFloat(process.env['AERO_PRICE_USD'] ?? '1.20'),
};

function getTokenPrice(symbol: string): number {
  const price = TOKEN_PRICE_USD[symbol];
  if (price === undefined || price <= 0) {
    console.warn(
      `[Observer] [ASSUMPTION] No price configured for token "${symbol}". ` +
        `Using $1.00 as fallback. Set ${symbol.toUpperCase()}_PRICE_USD env var to override.`
    );
    return 1.0;
  }
  return price;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatBps(bps: number): string {
  return `${bps.toFixed(4)} bps (${(bps / 100).toFixed(4)}%)`;
}

function formatUsd(usd: number): string {
  return `$${usd.toFixed(6)}`;
}

function printSeparator(): void {
  console.log('═'.repeat(65));
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Observer
// ─────────────────────────────────────────────────────────────────────────────

export class MarketObserver {
  private readonly store: ObservationStore;
  private running = false;

  constructor(
    private readonly config: ObserverConfig,
    private readonly dataSource: IDataSource,
    private readonly adapters: IPoolAdapter[],
    private readonly pools: PoolDefinition[]
  ) {
    this.store = new ObservationStore(config.dbPath);
  }

  /** Find the appropriate adapter for a given pool */
  private getAdapter(pool: PoolDefinition): IPoolAdapter | null {
    return this.adapters.find((a) => a.supports(pool)) ?? null;
  }

  /** Convert USD trade size to amountIn for a given token */
  private tradeSizeToAmountIn(tradeSizeUsd: number, tokenSymbol: string, decimals: number): bigint {
    const price = getTokenPrice(tokenSymbol);
    return usdToTokenAmount(tradeSizeUsd, price, decimals);
  }

  /** Run a single observation cycle across all pools × trade sizes */
  async runCycle(): Promise<void> {
    const cycleStart = performance.now();

    // ── 1. Fetch block and gas price ────────────────────────────────────────
    const { header: block, latencyMs: blockLatency } =
      await this.dataSource.getLatestBlock();
    const { gasPrice } = await this.dataSource.getGasPrice();

    const ethPriceUsd = parseFloat(process.env['ETH_PRICE_USD'] ?? String(FALLBACK_ETH_PRICE_USD));

    console.log();
    console.log(
      `📦 Block: ${block.blockNumber.toString()}  ` +
      `⛽ Gas: ${gasPrice.gasPriceGwei.toFixed(4)} gwei  ` +
      `🕐 ${new Date().toISOString()}  ` +
      `📡 RPC latency: ${blockLatency}ms`
    );
    console.log(
      `[ASSUMPTION] ETH price for gas conversion: $${ethPriceUsd} (configurable via ETH_PRICE_USD)`
    );

    // ── 2. Observe each pool × each trade size ────────────────────────────
    let cycleObservations = 0;
    let cycleCandidates = 0;

    for (const pool of this.pools) {
      const adapter = this.getAdapter(pool);

      if (!adapter) {
        console.warn(`[Observer] No adapter found for pool ${pool.id} (${pool.protocol}). Skipping.`);
        continue;
      }

      for (const tradeSizeUsd of this.config.observationSizesUsd) {
        printSeparator();
        console.log(`📊 POOL: ${pool.dex} | ${pool.token0.symbol}/${pool.token1.symbol} | ${pool.id}`);
        console.log(`   Status: ${pool.status.toUpperCase()} | Address: ${pool.poolAddress}`);
        console.log(`   Trade size: ${formatUsd(tradeSizeUsd)} / ₹${(tradeSizeUsd * this.config.inrUsdRate).toFixed(2)} [OBSERVATION ONLY — NOT EXECUTED]`);

        try {
          // Convert trade size to amountIn
          const amountIn = this.tradeSizeToAmountIn(
            tradeSizeUsd,
            pool.token0.symbol,
            pool.token0.decimals
          );

          // ── Get quote ──────────────────────────────────────────────────
          const observation = await adapter.getQuote(
            pool,
            tradeSizeUsd,
            amountIn,
            block.blockNumber
          );

          if (observation.error || !observation.quote) {
            const reason = observation.error ?? 'No quote returned';
            console.log(`   ❌ QUOTE FAILED: ${reason}`);
            this.store.insert({
              observation,
              profit: null,
              tradeSizeUsd,
              inrUsdRate: this.config.inrUsdRate,
              gasPrice,
              rpcEndpointId: this.dataSource.id,
              errorMessage: reason,
            });
            cycleObservations++;
            continue;
          }

          const quote = observation.quote;

          // ── Calculate economics ────────────────────────────────────────
          const gasEst = estimateGasCost(
            pool.protocol,
            gasPrice.gasPriceWei,
            ethPriceUsd,
            false // single-hop observation
          );

          const priceContext: TokenPriceContext = {
            token0PriceUsd: getTokenPrice(pool.token0.symbol),
            token1PriceUsd: getTokenPrice(pool.token1.symbol),
            token0Decimals: pool.token0.decimals,
            token1Decimals: pool.token1.decimals,
          };

          const profit = calculateProfit({
            quote,
            inputCapitalUsd: tradeSizeUsd,
            priceContext,
            gasEstimate: gasEst,
            riskBufferFraction: this.config.riskBufferFraction,
            minNetProfitUsd: this.config.minNetProfitUsd,
          });

          // ── Print report ───────────────────────────────────────────────
          const amountInDisplay = (Number(quote.amountIn) / Math.pow(10, pool.token0.decimals)).toFixed(6);
          const amountOutDisplay = (Number(quote.amountOut) / Math.pow(10, pool.token1.decimals)).toFixed(6);

          console.log();
          console.log(`   BUY QUOTE:    ${amountInDisplay} ${quote.tokenInSymbol} → ${amountOutDisplay} ${quote.tokenOutSymbol}`);
          console.log(`   GROSS SPREAD: ${formatBps(profit.grossSpreadBps)}`);
          console.log(`   DEX FEES:     ${profit.poolFeeBps} bps (${(profit.poolFeeBps / 100).toFixed(2)}%)`);
          console.log(`   PRICE IMPACT: ${formatBps(quote.priceImpactBps)} [ESTIMATE]`);
          console.log(`   GAS ESTIMATE: ~${gasEst.gasUnits.toLocaleString()} units @ ${gasEst.gasPriceGwei.toFixed(4)} gwei = ${formatUsd(gasEst.gasCostUsd)} [ESTIMATE][PROVISIONAL]`);
          if (quote.crossedTick) {
            console.log(`   ⚠️  TICK CROSSING: Yes — gas spike accounted for in estimate.`);
          }
          console.log();
          console.log(`   ── Profit Breakdown ──────────────────────────────────`);
          console.log(`   Gross Profit:               ${formatUsd(profit.grossProfitUsd)}`);
          console.log(`   Net (before risk buffer):   ${formatUsd(profit.netProfitBeforeBufferUsd)}`);
          console.log(`   Risk Buffer:               -${formatUsd(profit.riskBufferUsd)} [PROVISIONAL]`);
          console.log(`   NET EXPECTED PROFIT:        ${formatUsd(profit.netExpectedProfitUsd)}`);
          console.log();

          const statusIcon = profit.status === 'CANDIDATE' ? '✅' : '❌';
          console.log(`   STATUS: ${statusIcon} ${profit.status}`);
          if (profit.rejectionReason) {
            console.log(`   REASON: ${profit.rejectionReason}`);
            console.log(`   DETAIL: ${profit.rejectionDetail}`);
          }

          if (profit.status === 'CANDIDATE') {
            cycleCandidates++;
            console.log(`   ⚡ CANDIDATE OPPORTUNITY — logged for research analysis.`);
            console.log(`   NOTE: This is NOT executable. Phase 1C is observation only.`);
          }

          // ── Store ──────────────────────────────────────────────────────
          this.store.insert({
            observation,
            profit,
            tradeSizeUsd,
            inrUsdRate: this.config.inrUsdRate,
            gasPrice,
            rpcEndpointId: this.dataSource.id,
            errorMessage: null,
          });

          cycleObservations++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`   ❌ OBSERVATION ERROR: ${message}`);
        }
      }
    }

    const cycleDurationMs = Math.round(performance.now() - cycleStart);
    printSeparator();

    const stats = this.store.getStats();
    console.log();
    console.log(`✅ Cycle complete in ${cycleDurationMs}ms`);
    console.log(`   This cycle: ${cycleObservations} observations, ${cycleCandidates} candidates`);
    console.log(`   Total stored: ${stats.total} | Candidates: ${stats.candidates} | Rejected: ${stats.rejected} | Errors: ${stats.errors}`);
    console.log(`   DB: ${this.config.dbPath}`);
    console.log();
    console.log(`⏱  Next observation in ${this.config.pollIntervalMs / 1000}s...`);
  }

  /** Start the continuous polling loop */
  async start(): Promise<void> {
    this.running = true;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' SAHIKARA — Phase 1C Market Observation Engine');
    console.log(' READ-ONLY MODE | No transactions | No signing | No execution');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Chain:          Base (chain ID ${BASE_CHAIN_ID})`);
    console.log(`RPC endpoint:   ${this.config.rpcEndpointId}`);
    console.log(`Poll interval:  ${this.config.pollIntervalMs}ms`);
    console.log(`Trade sizes:    $${this.config.observationSizesUsd.join(', $')} [OBSERVATION ONLY]`);
    console.log(`INR/USD rate:   ${this.config.inrUsdRate} [ASSUMPTION]`);
    console.log(`DB path:        ${this.config.dbPath}`);
    console.log(`Active pools:   ${this.pools.length}`);
    console.log('');
    console.log('⚠️  SECURITY CHECK: This engine is structurally read-only.');
    console.log('    Zero transaction signing. Zero capital deployed.');
    console.log('');

    // Verify connectivity before starting loop
    await this.dataSource.verifyConnectivity(BASE_CHAIN_ID);
    console.log(`✅ RPC connectivity verified (Base mainnet, chain ID ${BASE_CHAIN_ID})`);

    while (this.running) {
      try {
        await this.runCycle();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Observer] Cycle error: ${message}`);
        console.error('[Observer] Waiting before retry...');
      }

      if (this.running) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.pollIntervalMs)
        );
      }
    }

    console.log('[Observer] Shutting down...');
    this.store.close();
    console.log('[Observer] Database closed. Goodbye.');
  }

  stop(): void {
    this.running = false;
  }
}
