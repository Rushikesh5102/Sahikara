/**
 * SAHIKARA Phase 4 — Real-Time Shadow / Paper Execution Engine
 *
 * Continuously operates as a strictly read-only shadow orchestrator:
 *
 *   Pool State Event (Swap / Sync / Block)
 *                ↓
 *   Selective Route Re-Quoting (Pinned to Block)
 *                ↓
 *   Execution-Grade Simulation & OP Stack Gas Modeling
 *                ↓
 *   10-Point False-Positive Economic & Risk Gates
 *                ↓
 *   Shadow Portfolio Paper Ledger ($100 Virtual Capital)
 *                ↓
 *   Next-Block Market Calibration (B → B+1)
 *                ↓
 *   Diagnostic Missed-Opportunity Tracking
 *
 * STRICT SAFETY DIRECTIVE:
 * Read-only telemetry and virtual paper execution only.
 * Zero private keys, zero wallet signing, zero transaction broadcasting.
 */

import type { IDataSource } from '../data-sources/IDataSource.js';
import type { ObservationStore } from '../storage/ObservationStore.js';
import type { PoolStateChangeEvent } from '../events/EventTypes.js';
import type { RoundTripRouteDef, RoundTripEvaluation } from '../economics/roundTripEvaluator.js';
import { evaluateRoundTrip } from '../economics/roundTripEvaluator.js';
import { BaseGasModel } from './BaseGasModel.js';
import { OpportunityLifecycleManager } from './OpportunityLifecycleManager.js';
import { NextBlockCalibrationEngine, type NextBlockObservationInput } from './NextBlockCalibrationEngine.js';
import { ShadowPortfolioLedger } from './ShadowPortfolioLedger.js';
import { StatisticalReporter, type StatisticalRecord, type StatisticalSummaryReport } from './StatisticalReporter.js';
import type {
  ShadowOpportunity,
  NextBlockCalibration,
  EconomicPolicyConfig,
  MissedOpportunityReport,
  ShadowPortfolioState,
} from './types.js';

export interface RealTimeShadowEngineOptions {
  dataSource: IDataSource;
  store: ObservationStore;
  routes: RoundTripRouteDef[];
  researchSizesUsd?: number[];
  policyConfig?: Partial<EconomicPolicyConfig>;
  gasModel?: BaseGasModel;
}

export class RealTimeShadowEngine {
  private readonly dataSource: IDataSource;
  private readonly store: ObservationStore;
  private readonly routes: RoundTripRouteDef[];
  private readonly researchSizesUsd: number[];
  private readonly policyConfig: EconomicPolicyConfig;
  private readonly gasModel: BaseGasModel;

  // Inverted pool index: poolAddress -> affected routes
  private readonly routesByPool = new Map<string, RoundTripRouteDef[]>();

  // Separate Paper Portfolios: Live Market vs Synthetic Fixtures
  public readonly liveLedger: ShadowPortfolioLedger;
  public readonly syntheticLedger: ShadowPortfolioLedger;

  // Active shadow opportunities awaiting next-block calibration (keyed by routeId)
  private readonly pendingCalibrations = new Map<string, ShadowOpportunity>();

  // Telemetry metrics
  private eventsReceived = 0;
  private eventsProcessed = 0;
  private quotesTriggered = 0;
  private failedQuotes = 0;

  // Statistical records cache for distribution reporting
  private readonly statisticalRecords: StatisticalRecord[] = [];

  // Missed Opportunity Diagnostics
  private readonly missedReport: MissedOpportunityReport = {
    totalEventsProcessed: 0,
    totalRoutesEvaluated: 0,
    candidatesDetected: 0,
    rejectedByZeroOrNegativeSpread: 0,
    rejectedByEconomicGates: 0,
    rejectedByGasCost: 0,
    rejectedBySlippage: 0,
    rejectedByLatency: 0,
    rejectedByRiskBuffer: 0,
    rejectedByQuoterFailure: 0,
    rejectedByRpcFailure: 0,
    rejectedByWebSocketFailure: 0,
    expiredBeforeExecution: 0,
    missedDueToLatencyWindow: 0,
    viableShadowTradesSubmitted: 0,
    tier0Count: 0,
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 0,
    tier4Count: 0,
  };

  constructor(options: RealTimeShadowEngineOptions) {
    this.dataSource = options.dataSource;
    this.store = options.store;
    this.routes = options.routes;
    this.researchSizesUsd = options.researchSizesUsd ?? [1, 5, 10, 25, 50, 100, 250, 500];

    const ethPrice = options.policyConfig?.ethPriceUsd ?? 2500.0;

    this.policyConfig = {
      minNetProfitUsd: options.policyConfig?.minNetProfitUsd ?? 0.05,
      minNetProfitBps: options.policyConfig?.minNetProfitBps ?? 5.0,
      maxSlippageBps: options.policyConfig?.maxSlippageBps ?? 20.0,
      maxGasCostUsd: options.policyConfig?.maxGasCostUsd ?? 0.50,
      maxTradeSizeUsd: options.policyConfig?.maxTradeSizeUsd ?? 500.0,
      minLiquidityUsd: options.policyConfig?.minLiquidityUsd ?? 1000.0,
      maxQuoteAgeMs: options.policyConfig?.maxQuoteAgeMs ?? 2000,
      maxViableLatencyMs: options.policyConfig?.maxViableLatencyMs ?? 3000,
      riskBufferBps: options.policyConfig?.riskBufferBps ?? 10.0,
      ethPriceUsd: ethPrice,
      assumedL1DataFeeUsd: options.policyConfig?.assumedL1DataFeeUsd ?? 0.002,
    };

    this.gasModel = options.gasModel ?? new BaseGasModel({
      defaultExecutionGasUnits: 220_000,
      defaultPriorityFeeGwei: 0.05,
      defaultL1DataFeeUsd: this.policyConfig.assumedL1DataFeeUsd,
      defaultEthPriceUsd: ethPrice,
    });

    this.liveLedger = new ShadowPortfolioLedger({ startingBalanceUsd: 100.0, isSyntheticLedger: false });
    this.syntheticLedger = new ShadowPortfolioLedger({ startingBalanceUsd: 100.0, isSyntheticLedger: true });

    this.buildPoolIndex();
  }

  private buildPoolIndex(): void {
    for (const route of this.routes) {
      const p1 = route.leg1.pool.poolAddress.toLowerCase();
      const p2 = route.leg2.pool.poolAddress.toLowerCase();

      if (!this.routesByPool.has(p1)) this.routesByPool.set(p1, []);
      this.routesByPool.get(p1)!.push(route);

      if (!this.routesByPool.has(p2)) this.routesByPool.set(p2, []);
      if (p1 !== p2) {
        this.routesByPool.get(p2)!.push(route);
      }
    }
  }

  public getAffectedRoutes(poolAddress: string): RoundTripRouteDef[] {
    return this.routesByPool.get(poolAddress.toLowerCase()) ?? [];
  }

  private getTokenPriceUsd(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s === 'WETH') return this.policyConfig.ethPriceUsd;
    if (s === 'WSTETH') return this.policyConfig.ethPriceUsd * 1.15;
    if (s === 'USDC' || s === 'USDBC' || s === 'DAI' || s === 'USDT') return 1.0;
    if (s === 'CBBTC') return 60_000.0;
    if (s === 'AERO') return 0.70;
    if (s === 'DEGEN') return 0.005;
    if (s === 'VIRTUAL') return 1.20;
    return 1.0;
  }

  /**
   * Process an incoming on-chain event through the real-time shadow pipeline.
   */
  public async processEvent(event: PoolStateChangeEvent): Promise<ShadowOpportunity[]> {
    this.eventsReceived++;
    const startMono = performance.now();
    const startWall = Date.now();

    const targetRoutes = event.eventType === 'BLOCK'
      ? this.routes.slice(0, 4)
      : this.getAffectedRoutes(event.poolAddress);

    if (targetRoutes.length === 0) {
      return [];
    }

    this.eventsProcessed++;
    this.missedReport.totalEventsProcessed++;

    // Query current Base L2 gas price
    let l2BaseFeeGwei = 0.05;
    try {
      const { gasPrice } = await this.dataSource.getGasPrice();
      l2BaseFeeGwei = Number(gasPrice.gasPriceWei) / 1e9;
    } catch {
      this.missedReport.rejectedByRpcFailure++;
    }

    const shadowOpportunities: ShadowOpportunity[] = [];

    // Check if we have any pending calibrations from previous block for these routes
    for (const route of targetRoutes) {
      const pending = this.pendingCalibrations.get(route.id);
      if (pending && event.blockNumber > pending.triggerBlockNumber) {
        // Perform next-block calibration check
        await this.calibratePendingOpportunity(pending, event, l2BaseFeeGwei);
        this.pendingCalibrations.delete(route.id);
      }
    }

    // Evaluate each target route across configured research trade sizes
    for (const route of targetRoutes) {
      for (const tradeSizeUsd of this.researchSizesUsd) {
        this.missedReport.totalRoutesEvaluated++;
        this.quotesTriggered++;

        const baseToken = route.leg1.tokenIn;
        const intermediateToken = route.leg1.tokenOut;
        const baseTokenPriceUsd = this.getTokenPriceUsd(baseToken.symbol);
        const intermediateTokenPriceUsd = this.getTokenPriceUsd(intermediateToken.symbol);

        const decimals = baseToken.decimals;
        const initialAmount = BigInt(
          Math.floor((tradeSizeUsd / baseTokenPriceUsd) * Math.pow(10, decimals))
        );

        if (initialAmount <= 0n) continue;

        let evalResult: RoundTripEvaluation;
        const quoteStartWall = Date.now();

        try {
          evalResult = await evaluateRoundTrip({
            route,
            tradeSizeUsd,
            initialAmount,
            baseTokenPriceUsd,
            intermediateTokenPriceUsd,
            blockNumber: event.blockNumber,
            gasPriceWei: BigInt(Math.floor(l2BaseFeeGwei * 1e9)),
            ethPriceUsd: this.policyConfig.ethPriceUsd,
            minNetProfitUsd: this.policyConfig.minNetProfitUsd,
            riskBufferFraction: this.policyConfig.riskBufferBps / 10_000,
            maxPriceImpactBps: this.policyConfig.maxSlippageBps,
          });
        } catch {
          this.failedQuotes++;
          this.missedReport.rejectedByQuoterFailure++;
          continue;
        }

        const quoteEndWall = Date.now();
        const detectionLatencyMs = Math.max(0, quoteStartWall - event.receiptTimestampMs);
        const simulationLatencyMs = Math.max(0, quoteEndWall - quoteStartWall);

        // Compute Base OP Stack gas breakdown (L2 gas + L1 data fee)
        const gasBreakdown = this.gasModel.calculateGasCost(
          l2BaseFeeGwei,
          evalResult.gasEstimate.gasUnits,
          this.policyConfig.ethPriceUsd,
          this.policyConfig.assumedL1DataFeeUsd
        );

        // Risk buffer in USD (10 bps of trade size)
        const riskBufferUsd = (this.policyConfig.riskBufferBps / 10_000) * tradeSizeUsd;

        // Net PnL = Gross Gain - Total Gas - Risk Buffer
        const netExpectedPnLUsd = evalResult.grossProfitUsd - gasBreakdown.totalGasCostUsd - riskBufferUsd;
        const netProfitBps = (netExpectedPnLUsd / tradeSizeUsd) * 10_000;

        // Deterministic opportunity ID
        const opportunityId = `opp_${route.id}_${event.blockNumber}_${initialAmount}_${quoteEndWall}`;

        const opportunity: ShadowOpportunity = {
          opportunityId,
          chain: evalResult.chain,
          triggerBlockNumber: event.blockNumber,
          triggerEventType: event.eventType,
          triggerPoolAddress: event.poolAddress,
          routeId: route.id,
          routeName: route.name,
          tokenPair: `${baseToken.symbol}/${intermediateToken.symbol}`,
          poolLeg1: route.leg1.pool.poolAddress,
          poolLeg2: route.leg2.pool.poolAddress,
          dexLeg1: route.leg1.pool.dex,
          dexLeg2: route.leg2.pool.dex,
          tradeSizeUsd,
          initialAmount,
          tokenInSymbol: baseToken.symbol,
          tokenInDecimals: baseToken.decimals,
          quotedLeg1Output: evalResult.leg1Output,
          quotedLeg2Output: evalResult.leg2Output,
          grossSpreadBps: evalResult.grossSpreadBps,
          grossProfitUsd: evalResult.grossProfitUsd,
          gasBreakdown,
          riskBufferUsd,
          otherCostsUsd: 0,
          netExpectedPnLUsd,
          netProfitBps,
          totalPriceImpactBps: evalResult.maxPriceImpactBps,
          timestamps: {
            tDetectWallMs: startWall,
            tDetectMonoMs: startMono,
            tQuoteWallMs: quoteEndWall,
            detectionLatencyMs,
            simulationLatencyMs,
            assumedExecutionLatencyMs: 200, // 200ms Flashblocks on Base
            totalLatencyMs: detectionLatencyMs + simulationLatencyMs + 200,
          },
          expectedInclusionBlock: event.blockNumber + 1n,
          lifecycleState: 'DETECTED',
          classification: 'NO_OPPORTUNITY',
          isSynthetic: false,
          provenance: {
            triggerBlockNumber: '[OBSERVED]',
            triggerEventType: '[OBSERVED]',
            triggerPoolAddress: '[OBSERVED]',
            quotedLeg1Output: '[QUOTED]',
            quotedLeg2Output: '[QUOTED]',
            grossSpreadBps: '[SIMULATED]',
            grossProfitUsd: '[SIMULATED]',
            executionGasUnits: '[ESTIMATED]',
            l2BaseFeeGwei: '[OBSERVED]',
            priorityFeeGwei: '[ASSUMPTION]',
            l1DataFeeUsd: '[ESTIMATED]',
            totalGasCostUsd: '[ESTIMATED]',
            riskBufferUsd: '[ASSUMPTION]',
            netExpectedPnLUsd: '[SIMULATED]',
            netProfitBps: '[SIMULATED]',
            isSynthetic: '[OBSERVED]',
          },
          createdAt: Date.now(),
        };

        // Transition to EVALUATED
        OpportunityLifecycleManager.transition(opportunity, 'EVALUATED');

        // Evaluate 10-point false-positive protection gates
        const gateResult = OpportunityLifecycleManager.evaluateGates(
          opportunity,
          this.policyConfig,
          event.blockNumber
        );

        opportunity.classification = gateResult.classification;
        const tier = OpportunityLifecycleManager.evaluateTier(opportunity, gateResult);
        opportunity.opportunityTier = tier;

        const isFailedQuote =
          evalResult.status === 'ERROR' ||
          gateResult.classification === 'QUOTE_FAILED' ||
          opportunity.quotedLeg1Output <= 0n ||
          opportunity.quotedLeg2Output <= 0n;

        if (isFailedQuote) {
          this.failedQuotes++;
          this.missedReport.rejectedByQuoterFailure++;
          // QUOTE FAILURE INVARIANT: Failed quotes must NEVER be added to statisticalRecords
          // or counted as market spread observations.
        } else {
          // Record statistical observation for valid executable quotes only
          this.statisticalRecords.push({
            grossSpreadBps: opportunity.grossSpreadBps,
            netProfitBps: opportunity.netProfitBps,
            gasCostUsd: opportunity.gasBreakdown.totalGasCostUsd,
            tradeSizeUsd: opportunity.tradeSizeUsd,
            latencyMs: opportunity.timestamps.totalLatencyMs,
            opportunityLifetimeSec: opportunity.timestamps.totalLatencyMs / 1000,
            priceImpactBps: opportunity.totalPriceImpactBps,
          });

          // Tier aggregation for valid market observations
          if (tier === 'TIER_0') {
            this.missedReport.tier0Count++;
          } else if (tier === 'TIER_1') {
            this.missedReport.tier1Count++;
            this.missedReport.rejectedByEconomicGates++;
          } else if (tier === 'TIER_2') {
            this.missedReport.tier2Count++;
          } else if (tier === 'TIER_3') {
            this.missedReport.tier3Count++;
          }
        }

        if (!gateResult.passes) {
          OpportunityLifecycleManager.transition(opportunity, 'REJECTED', gateResult.rejectionReason);
          this.liveLedger.recordRejected();

          // Diagnostic missed opportunity tracking
          if (opportunity.grossSpreadBps <= 0) {
            this.missedReport.rejectedByZeroOrNegativeSpread++;
          } else if (gateResult.classification === 'GAS_TOO_HIGH') {
            this.missedReport.rejectedByGasCost++;
          } else if (gateResult.classification === 'SLIPPAGE_TOO_HIGH') {
            this.missedReport.rejectedBySlippage++;
          } else if (gateResult.classification === 'LATENCY_TOO_HIGH') {
            this.missedReport.rejectedByLatency++;
          } else if (gateResult.classification === 'RISK_REJECTED') {
            this.missedReport.rejectedByRiskBuffer++;
          }
        } else {
          // Passed all gates! Qualified shadow opportunity (TIER 3)
          this.missedReport.candidatesDetected++;
          this.missedReport.viableShadowTradesSubmitted++;

          // Commit capital in live virtual paper ledger
          const committed = this.liveLedger.commitCapital(opportunity);
          if (committed) {
            OpportunityLifecycleManager.transition(opportunity, 'SHADOW_SUBMITTED');
            // Store as pending calibration for next block
            this.pendingCalibrations.set(route.id, opportunity);
          } else {
            OpportunityLifecycleManager.transition(
              opportunity,
              'MISSED',
              'Insufficient virtual cash in paper ledger'
            );
            this.liveLedger.recordMissed();
          }
        }

        // Persist shadow opportunity in SQLite schema v5
        this.store.insertShadowOpportunity(opportunity);
        shadowOpportunities.push(opportunity);
      }
    }

    return shadowOpportunities;
  }

  /**
   * Calibrate a pending opportunity against next block conditions.
   */
  private async calibratePendingOpportunity(
    pending: ShadowOpportunity,
    nextBlockEvent: PoolStateChangeEvent,
    nextBlockL2BaseFeeGwei: number
  ): Promise<void> {
    try {
      // Re-quote the same route at the new block
      const route = this.routes.find((r) => r.id === pending.routeId);
      if (!route) return;

      const baseToken = route.leg1.tokenIn;
      const intermediateToken = route.leg1.tokenOut;
      const baseTokenPriceUsd = this.getTokenPriceUsd(baseToken.symbol);
      const intermediateTokenPriceUsd = this.getTokenPriceUsd(intermediateToken.symbol);

      const evalNext = await evaluateRoundTrip({
        route,
        tradeSizeUsd: pending.tradeSizeUsd,
        initialAmount: pending.initialAmount,
        baseTokenPriceUsd,
        intermediateTokenPriceUsd,
        blockNumber: nextBlockEvent.blockNumber,
        gasPriceWei: BigInt(Math.floor(nextBlockL2BaseFeeGwei * 1e9)),
        ethPriceUsd: this.policyConfig.ethPriceUsd,
        minNetProfitUsd: this.policyConfig.minNetProfitUsd,
        riskBufferFraction: this.policyConfig.riskBufferBps / 10_000,
        maxPriceImpactBps: this.policyConfig.maxSlippageBps,
      });

      const calibrationInput: NextBlockObservationInput = {
        observedBlockNumber: nextBlockEvent.blockNumber,
        observedLeg1Output: evalNext.leg1Output,
        observedLeg2Output: evalNext.leg2Output,
        observedL2BaseFeeGwei: nextBlockL2BaseFeeGwei,
        observedGasUnits: evalNext.gasEstimate.gasUnits,
        observedL1DataFeeUsd: this.policyConfig.assumedL1DataFeeUsd,
      };

      const calibration = NextBlockCalibrationEngine.calibrate(pending, calibrationInput);

      // Settle paper trade based on calibration outcome
      if (calibration.opportunityPersisted) {
        OpportunityLifecycleManager.transition(pending, 'INCLUDED');
        pending.opportunityTier = 'TIER_4';
        this.missedReport.tier4Count++;
        if (this.missedReport.tier3Count > 0) {
          this.missedReport.tier3Count--;
        }
        this.liveLedger.settleTrade(pending, calibration.observedNetPnLUsd);
      } else {
        OpportunityLifecycleManager.transition(pending, 'EXPIRED', 'Dislocation evaporated before inclusion');
        this.liveLedger.revertTrade(pending);
      }

      // Record next-block decay statistics
      this.statisticalRecords.push({
        grossSpreadBps: pending.grossSpreadBps,
        netProfitBps: pending.netProfitBps,
        gasCostUsd: pending.gasBreakdown.totalGasCostUsd,
        tradeSizeUsd: pending.tradeSizeUsd,
        latencyMs: pending.timestamps.totalLatencyMs,
        opportunityLifetimeSec: 2.0,
        priceImpactBps: pending.totalPriceImpactBps,
        observedSpreadDecayBps: calibration.observedSpreadDecayBps,
      });

      // Persist calibration record in SQLite
      this.store.insertShadowCalibration(calibration);
    } catch {
      // Calibration error handling
    }
  }

  /**
   * Explicitly records a WebSocket stream failure.
   */
  public recordWebSocketFailure(): void {
    this.missedReport.rejectedByWebSocketFailure++;
  }

  /**
   * Explicitly records an RPC provider failure.
   */
  public recordRpcFailure(): void {
    this.missedReport.rejectedByRpcFailure++;
  }

  /**
   * Returns a complete statistical summary across all evaluated opportunities and calibrations.
   */
  public getStatisticalReport(): StatisticalSummaryReport {
    return StatisticalReporter.generateReport(this.statisticalRecords);
  }

  /**
   * Injects a synthetic calibration test vector into the isolated synthetic ledger.
   * STRICT SEPARATION: never touches the live market ledger or statistics.
   */
  public injectSyntheticTestFixture(fixture: ShadowOpportunity, nextBlockInput: NextBlockObservationInput): NextBlockCalibration {
    fixture.isSynthetic = true;
    this.syntheticLedger.commitCapital(fixture);
    OpportunityLifecycleManager.transition(fixture, 'SHADOW_SUBMITTED');

    const calibration = NextBlockCalibrationEngine.calibrate(fixture, nextBlockInput);

    if (calibration.opportunityPersisted) {
      OpportunityLifecycleManager.transition(fixture, 'INCLUDED');
      fixture.opportunityTier = 'TIER_4';
      this.syntheticLedger.settleTrade(fixture, calibration.observedNetPnLUsd);
    } else {
      OpportunityLifecycleManager.transition(fixture, 'EXPIRED');
      this.syntheticLedger.revertTrade(fixture);
    }

    this.store.insertShadowOpportunity(fixture);
    this.store.insertShadowCalibration(calibration);

    return calibration;
  }

  public getTelemetry(): {
    eventsReceived: number;
    eventsProcessed: number;
    quotesTriggered: number;
    failedQuotes: number;
    missedReport: MissedOpportunityReport;
    livePortfolio: ShadowPortfolioState;
    syntheticPortfolio: ShadowPortfolioState;
    statisticalReport: StatisticalSummaryReport;
  } {
    return {
      eventsReceived: this.eventsReceived,
      eventsProcessed: this.eventsProcessed,
      quotesTriggered: this.quotesTriggered,
      failedQuotes: this.failedQuotes,
      missedReport: { ...this.missedReport },
      livePortfolio: this.liveLedger.getState(),
      syntheticPortfolio: this.syntheticLedger.getState(),
      statisticalReport: this.getStatisticalReport(),
    };
  }
}
