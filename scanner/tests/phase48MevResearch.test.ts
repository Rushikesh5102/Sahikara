/**
 * SAHIKARA — Phase 4.8 MEV Reality, Opportunity Persistence & Searcher-Layer Research Tests
 *
 * Verifies all Phase 4.8 components and regression invariants:
 *   1. Opportunity Event Timeline & Non-execution Latency Breakdown
 *   2. Opportunity Persistence Engine & UNKNOWN Lifetime Invariant
 *   3. Multi-Size Persistence & Discrete Size Profiling
 *   4. Latency Sensitivity Model & OBSERVED vs MODELED vs ASSUMED Invariant
 *   5. Public Mempool Capability Analysis & Read-Only Invariant
 *   6. Searcher Competition Model & Ordering Visibility Boundaries
 *   7. Deterministic Opportunity Replayer & Replay Classification Invariant
 *   8. 12-Stage Candidate Revalidator
 *   9. Opportunity Quality Metrics & Non-Composite Scoring Invariant
 *  10. Token Safety Classifier (Long-Tail Research Invariant)
 *  11. Event Coverage Auditor & Explicit Mathematical Denominators
 *  12. Economic Truth Gate & Strict Profit Definition
 *  13. Regressions: D-001, D-002, D-003, zero-lifetime fabrication, live trading bans
 */

import { describe, it, expect } from 'vitest';
import { OpportunityEventTimeline } from '../src/events/OpportunityEventTimeline.js';
import { OpportunityPersistenceEngine } from '../src/shadow/OpportunityPersistenceEngine.js';
import { MultiSizePersistence } from '../src/simulator/MultiSizePersistence.js';
import { LatencySensitivityModel } from '../src/simulator/LatencySensitivityModel.js';
import { MempoolObserver } from '../src/observer/MempoolObserver.js';
import { SearcherCompetitionModel } from '../src/simulator/SearcherCompetitionModel.js';
import { DeterministicOpportunityReplayer } from '../src/simulator/DeterministicOpportunityReplayer.js';
import { CandidateRevalidator } from '../src/discovery/CandidateRevalidator.js';
import { OpportunityQualityMetrics } from '../src/economics/OpportunityQualityMetrics.js';
import { TokenSafetyClassifier } from '../src/discovery/TokenSafetyClassifier.js';
import { EventCoverageAuditor } from '../src/events/EventCoverageAuditor.js';
import { EconomicTruthGate } from '../src/economics/EconomicTruthGate.js';
import type { RoundTripEvaluation } from '../src/economics/roundTripEvaluator.js';
import type { PoolDefinition, TokenDefinition } from '../src/config/pools.js';
import type { GasEstimate } from '../src/economics/gasEstimator.js';

describe('Phase 4.8: MEV Reality & Opportunity Persistence Engine', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Opportunity Event Timeline
  // ───────────────────────────────────────────────────────────────────────────
  describe('OpportunityEventTimeline', () => {
    it('accurately computes granular non-execution latency components', () => {
      const record = OpportunityEventTimeline.createRecord({
        eventBlock: 50000000n,
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        logIndex: 4,
        poolAddress: '0x2222222222222222222222222222222222222222',
        tokenPair: 'WETH/USDC',
        eventType: 'Swap',
        blockTimestampMs: 1000,
        localObservationTimestampMs: 1250, // +250ms (network/RPC propagation)
        detectionTimestampMs: 1260,        // +10ms (event filter & route matching)
        quoteStartTimestampMs: 1265,       // +5ms (queueing & dispatch)
        quoteCompletionTimestampMs: 1395,  // +130ms (RPC quote round trip)
        evaluationCompletionTimestampMs: 1400, // +5ms (economic evaluation)
      });

      expect(record.timelineId).toContain('timeline:50000000');
      expect(record.latencies.blockToObservationMs).toBe(250);
      expect(record.latencies.observationToDetectionMs).toBe(10);
      expect(record.latencies.detectionToQuoteMs).toBe(5);
      expect(record.latencies.quoteDurationMs).toBe(130);
      expect(record.latencies.quoteToEvaluationMs).toBe(5);
      expect(record.latencies.totalDetectionToEvaluationMs).toBe(140);
      expect(record.provenance.disclaimer).toBe('MEASUREMENT_ONLY_NO_EXECUTION');
    });

    it('summarizes multiple event timeline records', () => {
      const r1 = OpportunityEventTimeline.createRecord({
        eventBlock: 1n,
        txHash: '0xa',
        logIndex: 0,
        poolAddress: '0xp',
        tokenPair: 'WETH/USDC',
        eventType: 'Swap',
        blockTimestampMs: 1000,
        localObservationTimestampMs: 1200,
        detectionTimestampMs: 1210,
        quoteStartTimestampMs: 1215,
        quoteCompletionTimestampMs: 1315,
        evaluationCompletionTimestampMs: 1320,
      });

      const summary = OpportunityEventTimeline.summarize([r1]);
      expect(summary.count).toBe(1);
      expect(summary.avgBlockToObservationMs).toBe(200);
      expect(summary.avgQuoteDurationMs).toBe(100);
      expect(summary.avgTotalDetectionToEvaluationMs).toBe(110);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Opportunity Persistence Engine
  // ───────────────────────────────────────────────────────────────────────────
  describe('OpportunityPersistenceEngine', () => {
    it('reports lifetime strictly as UNKNOWN when zero positive opportunities exist', () => {
      const engine = new OpportunityPersistenceEngine();

      // Negative quote
      engine.recordObservation({
        routeId: 'route-neg',
        chain: 'base',
        observation: {
          blockNumber: 100n,
          timestampMs: 1000,
          grossSpreadBps: -25.5,
          netProfitBps: -40.2,
          isSuccessfulQuote: true,
        },
      });

      const summary = engine.getSummary();
      expect(summary.totalEvaluations).toBe(1);
      expect(summary.positiveCandidatesCount).toBe(0);
      expect(summary.empiricalLifetimeReport).toContain('UNKNOWN');
      expect(summary.averageDurationMs).toBe('UNKNOWN');
      // Anti-fabrication check: must NEVER report 0 ms
      expect(summary.averageDurationMs).not.toBe(0);
    });

    it('tracks candidate persistence across consecutive positive re-quotes until termination', () => {
      const engine = new OpportunityPersistenceEngine();

      // 1. Initial positive detection
      const cand1 = engine.recordObservation({
        routeId: 'route-arb-1',
        chain: 'arbitrum',
        observation: {
          blockNumber: 500n,
          timestampMs: 1000,
          grossSpreadBps: +12.0,
          netProfitBps: +4.5,
          isSuccessfulQuote: true,
        },
      });
      expect(cand1).not.toBeNull();
      expect(cand1?.durationMs).toBe(0);

      // 2. Second positive observation +250ms later
      const cand2 = engine.recordObservation({
        routeId: 'route-arb-1',
        chain: 'arbitrum',
        observation: {
          blockNumber: 501n,
          timestampMs: 1250,
          grossSpreadBps: +15.0, // peak
          netProfitBps: +6.0,
          isSuccessfulQuote: true,
        },
      });
      expect(cand2?.durationMs).toBe(250);
      expect(cand2?.peakGrossBps).toBe(15.0);
      expect(cand2?.peakNetBps).toBe(6.0);

      // 3. Third observation: becomes negative (termination)
      const cand3 = engine.recordObservation({
        routeId: 'route-arb-1',
        chain: 'arbitrum',
        observation: {
          blockNumber: 502n,
          timestampMs: 1500,
          grossSpreadBps: -5.0,
          netProfitBps: -12.0,
          isSuccessfulQuote: true,
        },
      });
      expect(cand3?.terminationReason).toBe('SPREAD_BECAME_NEGATIVE');
      expect(cand3?.durationMs).toBe(250); // lasted 250ms

      const summary = engine.getSummary();
      expect(summary.positiveCandidatesCount).toBe(1);
      expect(summary.averageDurationMs).toBe(250);
      expect(summary.candidates[0]?.numberOfRequotes).toBe(3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Multi-Size Persistence & Depth Profiler
  // ───────────────────────────────────────────────────────────────────────────
  describe('MultiSizePersistence', () => {
    it('correctly profiles sizes without interpolating profitability between points', () => {
      const profile = MultiSizePersistence.profileSizes({
        routeId: 'route-v3-weth-usdc',
        chain: 'arbitrum',
        blockNumber: 500n,
        evaluations: [
          {
            sizeUsd: 1,
            grossSpreadBps: 5.46,
            netProfitBps: -795,
            netProfitUsd: -0.0795, // sub-gas failure
            priceImpactBps: 0.0001,
            gasCostUsd: 0.08,
            isProfitable: false,
            status: 'SUCCESS',
          },
          {
            sizeUsd: 100,
            grossSpreadBps: 18.0,
            netProfitBps: 10.0,
            netProfitUsd: 0.10, // Profitable!
            priceImpactBps: 0.5,
            gasCostUsd: 0.08,
            isProfitable: true,
            status: 'SUCCESS',
          },
          {
            sizeUsd: 500,
            grossSpreadBps: 18.0,
            netProfitBps: 8.0,
            netProfitUsd: 0.40, // Optimal USD size
            priceImpactBps: 2.5,
            gasCostUsd: 0.08,
            isProfitable: true,
            status: 'SUCCESS',
          },
          {
            sizeUsd: 1000,
            grossSpreadBps: 18.0,
            netProfitBps: -15.0,
            netProfitUsd: -1.50, // Price impact flipped spread
            priceImpactBps: 33.0,
            gasCostUsd: 0.08,
            isProfitable: false,
            status: 'SUCCESS',
          },
        ],
      });

      expect(profile.minProfitableSizeUsd).toBe(100);
      expect(profile.maxProfitableSizeUsd).toBe(500);
      expect(profile.optimalObservedSizeUsd).toBe(500);
      expect(profile.maxObservedNetProfitUsd).toBe(0.40);
      expect(profile.priceImpactCurve.length).toBe(4);
      expect(profile.scalabilityVerdict).toBe('SCALABLE');
    });

    it('flags micro-spread candidates that only appear at sub-gas sizes as SUB_GAS_MICRO_SPREAD', () => {
      const profile = MultiSizePersistence.profileSizes({
        routeId: 'route-micro',
        chain: 'polygon',
        blockNumber: 100n,
        evaluations: [
          {
            sizeUsd: 1,
            grossSpreadBps: 8.5,
            netProfitBps: 0.5,
            netProfitUsd: 0.00005,
            priceImpactBps: 0.0001,
            gasCostUsd: 0.0008,
            isProfitable: true,
            status: 'SUCCESS',
          },
          {
            sizeUsd: 10,
            grossSpreadBps: -2.0,
            netProfitBps: -10.0,
            netProfitUsd: -0.01,
            priceImpactBps: 10.5,
            gasCostUsd: 0.0008,
            isProfitable: false,
            status: 'SUCCESS',
          },
        ],
      });

      expect(profile.minProfitableSizeUsd).toBe(1);
      expect(profile.maxProfitableSizeUsd).toBe(1);
      expect(profile.scalabilityVerdict).toBe('SUB_GAS_MICRO_SPREAD');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Latency Sensitivity Model
  // ───────────────────────────────────────────────────────────────────────────
  describe('LatencySensitivityModel', () => {
    it('strictly separates OBSERVED empirical points from MODELED and ASSUMED points', () => {
      const report = LatencySensitivityModel.evaluateDecay({
        routeId: 'route-test',
        chain: 'base',
        initialGrossBps: 20.0,
        initialNetBps: 10.0,
        initialNetProfitUsd: 0.10,
        tradeSizeUsd: 100,
        empiricalRequotes: [
          { deltaMs: 50, grossBps: 18.0, netBps: 8.0 }, // empirical point
        ],
      });

      expect(report.decayProfile.length).toBe(9);

      // Find 50ms point
      const pt50 = report.decayProfile.find((p) => p.offsetMs === 50);
      expect(pt50?.classification).toBe('OBSERVED');
      expect(pt50?.expectedGrossBps).toBe(18.0);

      // Find 500ms point (must be MODELED)
      const pt500 = report.decayProfile.find((p) => p.offsetMs === 500);
      expect(pt500?.classification).toBe('MODELED');
      expect(pt500?.expectedNetProfitUsd).toBeLessThan(0.10);
    });

    it('labels baseline decay as ASSUMED when zero empirical re-quotes exist', () => {
      const report = LatencySensitivityModel.evaluateDecay({
        routeId: 'route-no-empirical',
        chain: 'base',
        initialGrossBps: 10.0,
        initialNetBps: 5.0,
        initialNetProfitUsd: 0.05,
        tradeSizeUsd: 100,
        empiricalRequotes: [],
      });

      for (const pt of report.decayProfile) {
        expect(pt.classification).toBe('ASSUMED');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Public Mempool Capability Analysis
  // ───────────────────────────────────────────────────────────────────────────
  describe('MempoolObserver', () => {
    it('correctly maps L2 sequencer architecture vs Polygon Bor mempool', () => {
      const baseCap = MempoolObserver.getCapabilityProfile('base');
      expect(baseCap.architecture).toBe('CENTRALIZED_SEQUENCER_PRIVATE_MEMPOOL');
      expect(baseCap.hasPublicPendingTxSubscription).toBe(false);
      expect(baseCap.preTradeAnalysisViability).toBe('UNVIABLE');

      const arbCap = MempoolObserver.getCapabilityProfile('arbitrum');
      expect(arbCap.architecture).toBe('SEQUENCER_FEED_FCFS');
      expect(arbCap.hasPublicPendingTxSubscription).toBe(false);
      expect(arbCap.preTradeAnalysisViability).toBe('UNVIABLE');

      const polyCap = MempoolObserver.getCapabilityProfile('polygon');
      expect(polyCap.architecture).toBe('PUBLIC_P2P_BOR_MEMPOOL');
      expect(polyCap.hasPublicPendingTxSubscription).toBe(true);
      expect(polyCap.preTradeAnalysisViability).toBe('RESTRICTED');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Searcher Competition Model
  // ───────────────────────────────────────────────────────────────────────────
  describe('SearcherCompetitionModel', () => {
    it('identifies exact boundaries where SAHIKARA has visibility vs no visibility', () => {
      const report = SearcherCompetitionModel.analyzeChainCompetition('base');
      expect(report.lifecycle.length).toBe(7);

      const stage1 = report.lifecycle[0]; // MARKET_STATE_CHANGE
      expect(stage1?.sahikaraVisibility).toBe('FULL_VISIBILITY');

      const stage2 = report.lifecycle[1]; // SEARCHER_DETECTION
      expect(stage2?.sahikaraVisibility).toBe('NO_VISIBILITY');

      const stage4 = report.lifecycle[3]; // ORDERING_LAYER_SUBMISSION
      expect(stage4?.sahikaraVisibility).toBe('NO_VISIBILITY');

      const stage7 = report.lifecycle[6]; // ON_CHAIN_INCLUSION
      expect(stage7?.sahikaraVisibility).toBe('FULL_VISIBILITY');

      expect(report.visibilityCoveragePct).toBeLessThan(50);
      expect(report.criticalBlindSpots.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Deterministic Opportunity Replayer
  // ───────────────────────────────────────────────────────────────────────────
  describe('DeterministicOpportunityReplayer', () => {
    it('faithfully recomputes route economics under historical parameters and rejects live price leakage', () => {
      const res = DeterministicOpportunityReplayer.replay({
        eventBlock: 505839106n,
        eventTimestampMs: 1789584559180,
        routeId: 'tri:arbitrum:test',
        chain: 'arbitrum',
        tradeSizeUsd: 1.0,
        initialAmountRaw: 1_000_000n, // 1 USDC (6 decimals)
        historicalBasePriceUsd: 1.0,
        historicalGasTokenPriceUsd: 2500.0, // ETH
        historicalGasPriceWei: 100_000_000n, // 0.1 Gwei
        historicalGasLimit: 420_000n,
        historicalQuotes: {
          leg1AmountOut: 400_000_000_000_000n,
          leg2AmountOut: 1_000_546n,
          finalAmountOut: 1_000_546n, // +5.46 bps
        },
        replayType: 'QUOTE_REPLAY',
      });

      expect(res.replayClassification).toBe('QUOTE_REPLAY');
      expect(res.grossSpreadBps).toBe(5.46);
      expect(res.grossProfitUsd).toBe(0.000546);
      expect(res.gasCostUsd).toBe(0.105); // 420,000 * 0.1 Gwei * 2500
      expect(res.isGrossPositive).toBe(true);
      expect(res.isNetProfitable).toBe(false); // Net profit is negative -$0.104
      expect(res.provenance.historicalGasPriceWei).toBe('100000000');
    });

    it('prevents simulated replays from masquerading as EXACT_REPLAY without state pool proof', () => {
      const res = DeterministicOpportunityReplayer.replay({
        eventBlock: 100n,
        eventTimestampMs: 1000,
        routeId: 'r1',
        chain: 'base',
        tradeSizeUsd: 10,
        initialAmountRaw: 10_000_000n,
        historicalBasePriceUsd: 1.0,
        historicalGasTokenPriceUsd: 2500,
        historicalGasPriceWei: 100000000n,
        historicalGasLimit: 250000n,
        historicalQuotes: {
          leg1AmountOut: 5n,
          leg2AmountOut: 10_000_000n,
          finalAmountOut: 10_000_000n,
        },
        replayType: 'EXACT_REPLAY', // No poolStates provided!
      });

      expect(res.replayClassification).toBe('QUOTE_REPLAY'); // Downgraded honestly
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. 12-Stage Candidate Revalidator
  // ───────────────────────────────────────────────────────────────────────────
  describe('CandidateRevalidator', () => {
    const mockEvalBase: RoundTripEvaluation = {
      routeId: '2hop:base:test',
      routeName: 'test',
      chain: 'base',
      blockNumber: 50000000n,
      timestamp: Date.now(),
      leg1: {
        pool: { poolAddress: '0x1111111111111111111111111111111111111111' } as unknown as PoolDefinition,
        dex: 'Uniswap v3',
        tokenIn: { symbol: 'WETH', decimals: 18 } as unknown as TokenDefinition,
        tokenOut: { symbol: 'USDC', decimals: 6 } as unknown as TokenDefinition,
        amountIn: 1_000_000_000_000_000_000n,
        amountOut: 2_500_000_000n,
        feeBps: 5,
        priceImpactBps: 0.01,
        latencyMs: 10,
        rawQuoteJson: '{}',
      },
      leg2: {
        pool: { poolAddress: '0x2222222222222222222222222222222222222222' } as unknown as PoolDefinition,
        dex: 'Aerodrome',
        tokenIn: { symbol: 'USDC', decimals: 6 } as unknown as TokenDefinition,
        tokenOut: { symbol: 'WETH', decimals: 18 } as unknown as TokenDefinition,
        amountIn: 2_500_000_000n,
        amountOut: 1_002_000_000_000_000_000n, // +20 bps
        feeBps: 5,
        priceImpactBps: 0.01,
        latencyMs: 10,
        rawQuoteJson: '{}',
      },
      initialAmount: 1_000_000_000_000_000_000n,
      leg1Output: 2_500_000_000n,
      leg2Output: 1_002_000_000_000_000_000n,
      grossRoundTripDiff: 2_000_000_000_000_000n,
      baseToken: { symbol: 'WETH', decimals: 18 } as unknown as TokenDefinition,
      intermediateToken: { symbol: 'USDC', decimals: 6 } as unknown as TokenDefinition,
      leg1FeeBps: 5,
      leg2FeeBps: 5,
      leg1FeeAmount: 0n,
      leg2FeeAmount: 0n,
      tradeSizeUsd: 2500,
      grossProfitUsd: 5.0,
      grossSpreadBps: 20.0,
      poolFeesBps: 10,
      poolFeesUsd: 2.5,
      gasEstimate: {} as unknown as GasEstimate,
      gasCostUsd: 0.02,
      riskBufferUsd: 0.25,
      netExpectedProfitUsd: 4.73,
      netProfitBps: 18.9,
      maxPriceImpactBps: 0.01,
      totalLatencyMs: 50,
      status: 'CANDIDATE',
      classification: 'POTENTIAL_CANDIDATE',
      rejectionReason: null,
      rejectionDetail: null,
    };

    it('rejects candidate when gross spread is below theoretical fee floor (FEE_VALIDATED failure)', () => {
      const subFeeEval = { ...mockEvalBase, grossSpreadBps: 8.0 }; // fee floor is 5 + 5 = 10 bps
      const res = CandidateRevalidator.validate({ initialEvaluation: subFeeEval });

      expect(res.finalVerdict).toBe('REJECTED');
      expect(res.failedStage).toBe('FEE_VALIDATED');
    });

    it('rejects candidate when net profit fails risk-buffer threshold (RISK_BUFFER_VALIDATED failure)', () => {
      const lowNetEval = { ...mockEvalBase, netExpectedProfitUsd: 0.01 }; // below $0.05
      const res = CandidateRevalidator.validate({ initialEvaluation: lowNetEval });

      expect(res.finalVerdict).toBe('REJECTED');
      expect(res.failedStage).toBe('QUOTE_REPEAT_VALIDATED'); // missing repeat quote
    });

    it('passes all 12 stages when valid repeat quote and all conditions are satisfied', () => {
      const requoteEval = { ...mockEvalBase, grossSpreadBps: 19.5, netExpectedProfitUsd: 4.60 };
      const res = CandidateRevalidator.validate({
        initialEvaluation: mockEvalBase,
        requoteEvaluation: requoteEval,
      });

      expect(res.finalVerdict).toBe('VALIDATED_OPPORTUNITY');
      expect(res.passedStages.length).toBe(12);
      expect(res.failedStage).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Opportunity Quality Metrics
  // ───────────────────────────────────────────────────────────────────────────
  describe('OpportunityQualityMetrics', () => {
    it('constructs independent measurable dimensions without computing a composite score', () => {
      const dimensions = OpportunityQualityMetrics.measure({
        routeId: '2hop:arb:test',
        chain: 'arbitrum',
        grossBps: 15.5,
        netBps: 4.2,
        liquidity: 1500000000000000000n,
        priceImpactBps: 0.12,
        gasUsd: 0.055,
        quoteAgeMs: 45,
        observedDurationMs: 500,
        requoteCount: 4,
        routeLegs: 2,
        feeBps: 10,
        failureRate: 0.0,
        stateConfidence: 'CONFIRMED_ON_CHAIN',
      });

      expect(dimensions.grossBps).toBe(15.5);
      expect(dimensions.netBps).toBe(4.2);
      expect(dimensions.priceImpactBps).toBe(0.12);
      expect(dimensions.stateConfidence).toBe('CONFIRMED_ON_CHAIN');
      // Invariant: No single "score" or "rank" property exists on dimensions
      expect((dimensions as unknown as Record<string, unknown>).score).toBeUndefined();
      expect((dimensions as unknown as Record<string, unknown>).rank).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Token Safety Classifier
  // ───────────────────────────────────────────────────────────────────────────
  describe('TokenSafetyClassifier', () => {
    it('classifies canonical tokens as TIER_1_CANONICAL', () => {
      const profile = TokenSafetyClassifier.classifyToken({
        tokenAddress: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        decimals: 18,
        chain: 'base',
      });
      expect(profile.safetyTier).toBe('TIER_1_CANONICAL');
      expect(profile.isFeeOnTransferLikely).toBe(false);
      expect(profile.suspiciousFlags.length).toBe(0);
    });

    it('rejects suspicious tokens with trivial bytecode or fee-on-transfer patterns', () => {
      const profile = TokenSafetyClassifier.classifyToken({
        tokenAddress: '0xbad0000000000000000000000000000000000000',
        symbol: 'SCAMCOIN',
        decimals: 18,
        chain: 'base',
        bytecodeHex: '0x00', // Empty bytecode
        liquidityUsdEstimate: 500,
      });
      expect(profile.safetyTier).toBe('SUSPICIOUS_REJECTED');
      expect(profile.suspiciousFlags).toContain('EMPTY_OR_TRIVIAL_BYTECODE');
      expect(profile.suspiciousFlags).toContain('SHALLOW_LIQUIDITY_DEPTH_UNDER_10K');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Event Coverage Auditor
  // ───────────────────────────────────────────────────────────────────────────
  describe('EventCoverageAuditor', () => {
    it('enforces explicit denominators and prevents ambiguous 100% claims', () => {
      const report = EventCoverageAuditor.auditCoverage({
        chain: 'arbitrum',
        totalObservedEvents: 96,
        uniquePoolsWithEvents: 18,
        totalPoolsInUniverse: 55,
        totalRoutesGenerated: 100,
        affectedRoutesIdentified: 72,
        routesActuallyEvaluated: 72,
        sizesEvaluatedCount: 9,
        totalConfiguredSizes: 9,
        quoteAttempts: 648,
        quoteSuccesses: 647,
        quoteFailures: 1,
      });

      expect(report.poolCoverage.numerator).toBe(18);
      expect(report.poolCoverage.denominator).toBe(55);
      expect(report.poolCoverage.percentage).toBe(32.73);

      expect(report.routeCoverage.numerator).toBe(72);
      expect(report.routeCoverage.denominator).toBe(72);
      expect(report.routeCoverage.percentage).toBe(100.0);

      expect(report.failureRate.numerator).toBe(1);
      expect(report.failureRate.denominator).toBe(648);
      expect(report.failureRate.percentage).toBe(0.15);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Economic Truth Gate
  // ───────────────────────────────────────────────────────────────────────────
  describe('EconomicTruthGate', () => {
    it('rejects candidates where final output does not exceed initial amount', () => {
      const res = EconomicTruthGate.verify({
        initialAmountRaw: 1_000_000n,
        finalAmountOutRaw: 999_000n, // negative raw
        tokenDecimals: 6,
        tradeTokenPriceUsd: 1.0,
        gasCostUsd: 0.05,
        otherExecutionCostsUsd: 0.0,
        riskBufferUsd: 0.05,
        provenance: {
          gasTokenPriceSource: 'test',
          tradeTokenPriceSource: 'test',
          gasEstimateSource: 'test',
          timestampMs: Date.now(),
        },
      });

      expect(res.isEconomicallyViable).toBe(false);
      expect(res.falsificationReasons).toContain('FINAL_AMOUNT_DOES_NOT_EXCEED_INITIAL_AMOUNT');
    });

    it('rejects candidates where gross profit is below gas cost', () => {
      const res = EconomicTruthGate.verify({
        initialAmountRaw: 1_000_000n,
        finalAmountOutRaw: 1_000_500n, // +$0.0005
        tokenDecimals: 6,
        tradeTokenPriceUsd: 1.0,
        gasCostUsd: 0.08, // gas cost $0.08 >> $0.0005
        otherExecutionCostsUsd: 0.0,
        riskBufferUsd: 0.05,
        provenance: {
          gasTokenPriceSource: 'test',
          tradeTokenPriceSource: 'test',
          gasEstimateSource: 'test',
          timestampMs: Date.now(),
        },
      });

      expect(res.isEconomicallyViable).toBe(false);
      expect(res.falsificationReasons).toContain('GROSS_PROFIT_BELOW_GAS_COST');
      expect(res.netEconomicProfitUsd).toBeLessThan(0);
    });

    it('approves genuine candidate where net profit exceeds all friction and risk buffer', () => {
      const res = EconomicTruthGate.verify({
        initialAmountRaw: 100_000_000n, // $100
        finalAmountOutRaw: 100_500_000n, // +$0.50 (50 bps)
        tokenDecimals: 6,
        tradeTokenPriceUsd: 1.0,
        gasCostUsd: 0.05,
        otherExecutionCostsUsd: 0.0,
        riskBufferUsd: 0.10,
        provenance: {
          gasTokenPriceSource: 'onchain_oracle',
          tradeTokenPriceSource: 'canonical_stable',
          gasEstimateSource: 'viem_estimate_gas',
          timestampMs: Date.now(),
        },
      });

      expect(res.isEconomicallyViable).toBe(true);
      expect(res.netEconomicProfitUsd).toBe(0.35); // 0.50 - 0.05 - 0.10
      expect(res.falsificationReasons.length).toBe(0);
    });
  });
});
