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
import {
  evaluateRoundTrip,
} from '../economics/roundTripEvaluator.js';
import { RouteGenerator } from '../discovery/RouteGenerator.js';
import { RESEARCH_PAIRS, type ResearchPair } from '../config/pairs.js';

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
  DEGEN: parseFloat(process.env['DEGEN_PRICE_USD'] ?? '0.005'),
  VIRTUAL: parseFloat(process.env['VIRTUAL_PRICE_USD'] ?? '1.50'),
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
  private readonly routeGenerator: RouteGenerator;
  private readonly pairs: ResearchPair[];
  private running = false;

  constructor(
    private readonly config: ObserverConfig,
    private readonly dataSource: IDataSource,
    private readonly adapters: IPoolAdapter[],
    private readonly pools: PoolDefinition[],
    pairs: ResearchPair[] = RESEARCH_PAIRS
  ) {
    this.store = new ObservationStore(config.dbPath);
    this.pairs = pairs;
    this.routeGenerator = new RouteGenerator({
      maxRoutesPerPair: config.maxRoutesPerPair ?? 10,
    });
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

          // ── Print one-way quote report ─────────────────────────────────────────
          const amountInDisplay = (Number(quote.amountIn) / Math.pow(10, pool.token0.decimals)).toFixed(6);
          const amountOutDisplay = (Number(quote.amountOut) / Math.pow(10, pool.token1.decimals)).toFixed(6);

          console.log();
          console.log(`   ONE-WAY QUOTE: ${amountInDisplay} ${quote.tokenInSymbol} → ${amountOutDisplay} ${quote.tokenOutSymbol}`);
          console.log(`   IMPLIED SPREAD: ${formatBps(profit.grossSpreadBps)} (vs baseline)`);
          console.log(`   DEX FEES:       ${profit.poolFeeBps} bps (${(profit.poolFeeBps / 100).toFixed(2)}%)`);
          console.log(`   PRICE IMPACT:   ${formatBps(quote.priceImpactBps)} [ESTIMATE]`);
          console.log(`   GAS ESTIMATE:   ~${gasEst.gasUnits.toLocaleString()} units @ ${gasEst.gasPriceGwei.toFixed(4)} gwei = ${formatUsd(gasEst.gasCostUsd)} [ESTIMATE][PROVISIONAL]`);
          if (quote.crossedTick) {
            console.log(`   ⚠️  TICK CROSSING: Yes — gas spike accounted for in estimate.`);
          }
          console.log();
          console.log(`   ── Theoretical Conversion Breakdown ──────────────────`);
          console.log(`   Theoretical Gross Value:    ${formatUsd(profit.grossProfitUsd)}`);
          console.log(`   Net (before risk buffer):   ${formatUsd(profit.netProfitBeforeBufferUsd)}`);
          console.log(`   Risk Buffer:               -${formatUsd(profit.riskBufferUsd)} [PROVISIONAL]`);
          console.log(`   THEORETICAL NET OUTPUT:     ${formatUsd(profit.netExpectedProfitUsd)}`);
          console.log();

          const statusIcon = profit.status === 'CANDIDATE' ? 'ℹ️' : '❌';
          console.log(`   ONE-WAY STATUS: ${statusIcon} ${profit.status} (Note: One-way quote is NOT arbitrage)`);
          if (profit.rejectionReason) {
            console.log(`   REASON: ${profit.rejectionReason}`);
            console.log(`   DETAIL: ${profit.rejectionDetail}`);
          }

          // ── Store one-way quote observation ───────────────────────────
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

    // ── 3. Cross-DEX Round-Trip Arbitrage Evaluation ─────────────────────────
    const adapterMap = new Map<string, IPoolAdapter>();
    for (const a of this.adapters) {
      adapterMap.set(a.protocol, a);
    }
    const routes = this.routeGenerator.generateRoutes(this.pairs, this.pools, adapterMap);

    let roundTripEvaluationsCount = 0;
    let roundTripCandidatesCount = 0;

    if (routes.length > 0) {
      printSeparator();
      console.log(`🔄 CROSS-DEX ROUND-TRIP ARBITRAGE EVALUATION (${routes.length} dynamic routes generated)`);
      console.log(`   Evaluating complete round trips across ${this.pairs.filter((p) => p.enabled).length} pairs against live Base quotes:`);
      for (const r of routes) {
        console.log(`   • ${r.name}`);
      }
      printSeparator();

      for (const tradeSizeUsd of this.config.observationSizesUsd) {
        for (const route of routes) {
          try {
            const initialAmount = this.tradeSizeToAmountIn(
              tradeSizeUsd,
              route.leg1.tokenIn.symbol,
              route.leg1.tokenIn.decimals
            );

            const evalResult = await evaluateRoundTrip({
              route,
              initialAmount,
              tradeSizeUsd,
              blockNumber: block.blockNumber,
              gasPriceWei: gasPrice.gasPriceWei,
              ethPriceUsd,
              baseTokenPriceUsd: getTokenPrice(route.leg1.tokenIn.symbol),
              intermediateTokenPriceUsd: getTokenPrice(route.leg1.tokenOut.symbol),
              riskBufferFraction: this.config.riskBufferFraction,
              minNetProfitUsd: this.config.minNetProfitUsd,
            });

            roundTripEvaluationsCount++;
            this.store.insertRoundTrip(evalResult);

            const baseDecimals = route.leg1.tokenIn.decimals;
            const interDecimals = route.leg1.tokenOut.decimals;
            const initialDisplay = (Number(evalResult.initialAmount) / Math.pow(10, baseDecimals)).toFixed(6);
            const leg1Display = (Number(evalResult.leg1Output) / Math.pow(10, interDecimals)).toFixed(6);
            const leg2Display = (Number(evalResult.leg2Output) / Math.pow(10, baseDecimals)).toFixed(6);
            const diffDisplay = (Number(evalResult.grossRoundTripDiff) / Math.pow(10, baseDecimals)).toFixed(8);

            console.log(`\n📐 ${route.name} | Size: $${tradeSizeUsd.toFixed(2)}`);
            console.log(`   Leg 1 (${evalResult.leg1.dex}): ${initialDisplay} ${evalResult.baseToken.symbol} → ${leg1Display} ${evalResult.intermediateToken.symbol} (Fee: ${evalResult.leg1.feeBps} bps, Impact: ${formatBps(evalResult.leg1.priceImpactBps)})`);
            console.log(`   Leg 2 (${evalResult.leg2.dex}): ${leg1Display} ${evalResult.intermediateToken.symbol} → ${leg2Display} ${evalResult.baseToken.symbol} (Fee: ${evalResult.leg2.feeBps} bps, Impact: ${formatBps(evalResult.leg2.priceImpactBps)})`);
            console.log(`   Round-Trip Gross Diff: ${diffDisplay} ${evalResult.baseToken.symbol} (${formatBps(evalResult.grossSpreadBps)})`);
            console.log(`   Gross Profit:          ${formatUsd(evalResult.grossProfitUsd)}`);
            console.log(`   Total Pool Fees:       ${evalResult.poolFeesBps} bps (~${formatUsd(evalResult.poolFeesUsd)})`);
            console.log(`   Gas Estimate (2-hop):  ${evalResult.gasEstimate.gasUnits.toLocaleString()} units @ ${gasPrice.gasPriceGwei.toFixed(4)} gwei = ${formatUsd(evalResult.gasCostUsd)} [ESTIMATE][PROVISIONAL]`);
            console.log(`   Risk Buffer:          -${formatUsd(evalResult.riskBufferUsd)} [PROVISIONAL]`);
            console.log(`   Net Expected Profit:   ${formatUsd(evalResult.netExpectedProfitUsd)} (${evalResult.netProfitBps.toFixed(2)} bps)`);

            const statusIcon = evalResult.status === 'CANDIDATE' ? '✅' : '❌';
            console.log(`   STATUS: ${statusIcon} ${evalResult.status}`);
            if (evalResult.rejectionReason) {
              console.log(`   REASON: ${evalResult.rejectionReason}`);
              console.log(`   DETAIL: ${evalResult.rejectionDetail}`);
            }

            if (evalResult.status === 'CANDIDATE') {
              roundTripCandidatesCount++;
              console.log(`   ⚡ READ-ONLY CANDIDATE IDENTIFIED [READ-ONLY QUOTE-BASED — NOT PROOF OF EXECUTABLE PROFITABILITY]`);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`   ❌ ROUND-TRIP EVALUATION ERROR (${route.name}): ${message}`);
          }
        }
      }
    }

    const cycleDurationMs = Math.round(performance.now() - cycleStart);
    printSeparator();

    const stats = this.store.getStats();
    const rtStats = this.store.getRoundTripStats();
    console.log();
    console.log(`✅ Cycle complete in ${cycleDurationMs}ms`);
    console.log(`   One-way quotes: ${cycleObservations} evaluated`);
    console.log(`   Cross-DEX round trips: ${roundTripEvaluationsCount} evaluated, ${roundTripCandidatesCount} candidates`);
    console.log(`   Total DB one-way: ${stats.total} | Round-trip total: ${rtStats.total} (Candidates: ${rtStats.candidates}, Rejected: ${rtStats.rejected}, Errors: ${rtStats.errors})`);
    console.log(`   DB: ${this.config.dbPath}`);
    console.log();
    console.log(`⏱  Next observation in ${this.config.pollIntervalMs / 1000}s...`);
  }

  /** Start the continuous polling loop */
  async start(): Promise<void> {
    this.running = true;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' SAHIKARA — Phase 1D Market Observation Engine (Read-Only)');
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

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;

    while (this.running) {
      try {
        await this.runCycle();
        consecutiveErrors = 0; // Reset error counter on successful cycle
      } catch (err: unknown) {
        consecutiveErrors++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Observer] Cycle error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${message}`);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[Observer] FATAL: Reached maximum consecutive cycle failures (${MAX_CONSECUTIVE_ERRORS}).`);
          console.error('[Observer] Halting observation collector to prevent unmonitored crash looping.');
          this.running = false;
          break;
        }

        const backoffMs = Math.min(this.config.pollIntervalMs * Math.pow(1.5, consecutiveErrors - 1), 60000);
        console.error(`[Observer] Backing off for ${Math.round(backoffMs)}ms before retry...`);
        if (this.running) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
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
