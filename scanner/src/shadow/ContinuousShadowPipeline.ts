/**
 * SAHIKARA Phase 4.18 — Continuous Read-Only Shadow Detection Pipeline
 *
 * Integrated continuous shadow-arbitrage detection orchestrator connecting:
 *   CEX Market Snapshots (WebSockets)
 *            ↓
 *   Local DEX State (In-Memory Concentrated Liquidity & V2 Reserves)
 *            ↓
 *   Local Candidate Detector (Sub-Millisecond Multi-Notional Screening)
 *            ↓
 *   Economic / Risk Gates (Gross PnL, Gas Drag, Slippage, Risk Buffer)
 *            ↓
 *   Authoritative On-Chain RPC Verification (QuoterV2 / getAmountOut)
 *            ↓
 *   Candidate Revalidator & Shadow Execution Outcome (SHADOW_ONLY)
 *            ↓
 *   Forensic Persistence & Telemetry Recording
 *
 * ABSOLUTE SAFETY BOUNDARIES:
 * - 100% READ-ONLY. Zero wallets, zero signers, zero trading keys.
 * - Zero transaction broadcasting, zero CEX order creation.
 * - Capital deployed: strictly ₹0.00 / $0.00.
 * - Phase 5 remains STRICTLY BLOCKED.
 */

import { Address, PublicClient } from 'viem';
import { LocalPoolStateManager, V3PoolState, V2PoolState } from '../dexstate/LocalPoolState.js';
import { LocalPriceEngine } from '../dexstate/LocalPriceEngine.js';
import { CexOrderBook } from '../cex/CexOrderBook.js';
import { CexVwapCalculator } from '../cex/CexVwapCalculator.js';
import { CexVenue } from '../cex/ICexMarketDataSource.js';
import {
  ForensicCandidateRecord,
  PipelineFailureRecord,
  PipelineTelemetryMetrics,
  StateHealthStatus,
  CandidateLifecycleState,
  VerificationOutcome,
  DiscrepancyClassification,
  QuoteFreshnessClass,
  FailureCategory,
} from './ShadowForensicTypes.js';

export interface ContinuousPipelineConfig {
  runId: string;
  chain: string;
  chainId: number;
  maxDurationMs: number; // Configurable duration (e.g. 5m, 15m, 30m, 60m)
  notionalsUsd?: number[];
  riskBufferBps?: number;
  cexFeeBps?: number;
  maxSlippageBps?: number;
  maxGasUsd?: number;
  minExpectedProfitUsd?: number;
  ethPriceUsd?: number;
  gasPriceGwei?: number;
  replayMode?: boolean;
}

export interface PoolTrackingConfig {
  address: Address;
  protocol: 'uniswap-v3' | 'aerodrome-v2';
  token0: Address;
  token1: Address;
  decimals0: number;
  decimals1: number;
  feeTier?: number;
  tickSpacing?: number;
}

export interface CexFeedConfig {
  venue: CexVenue;
  symbol: string;
}

export class ContinuousShadowPipeline {
  public readonly config: Required<ContinuousPipelineConfig>;
  public readonly stateManager: LocalPoolStateManager;
  private readonly publicClient?: PublicClient;

  // Tracked pools and CEX books
  private readonly trackedPools = new Map<Address, PoolTrackingConfig>();
  private readonly poolHealth = new Map<Address, StateHealthStatus>();
  private readonly cexBooks = new Map<string, CexOrderBook>();

  // Forensic and Failure Repositories
  public readonly forensicCandidates: ForensicCandidateRecord[] = [];
  public readonly failureRecords: PipelineFailureRecord[] = [];

  // Sample Independence Sets
  private readonly seenMarketStateHashes = new Set<string>();
  private readonly seenBlockNumbers = new Set<string>();
  private readonly candidateIdsInCurrentBlock = new Set<string>();

  // Telemetry Metrics
  public readonly metrics: PipelineTelemetryMetrics;

  // Control loop state
  private isRunning = false;
  private timerHandle?: NodeJS.Timeout;
  private timeoutHandle?: NodeJS.Timeout;
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;

  // Latency samples
  private readonly localLatenciesUs: number[] = [];
  private readonly rpcLatenciesMs: number[] = [];
  private readonly lifecycleLatenciesMs: number[] = [];

  constructor(
    config: ContinuousPipelineConfig,
    publicClient?: PublicClient
  ) {
    this.config = {
      runId: config.runId || `shadow_run_${Date.now()}`,
      chain: config.chain || 'base',
      chainId: config.chainId || 8453,
      maxDurationMs: config.maxDurationMs || 15 * 60 * 1000,
      notionalsUsd: config.notionalsUsd || [10, 25, 50, 100, 250, 500, 1000, 5000],
      riskBufferBps: config.riskBufferBps ?? 10,
      cexFeeBps: config.cexFeeBps ?? 10,
      maxSlippageBps: config.maxSlippageBps ?? 50,
      maxGasUsd: config.maxGasUsd ?? 2.0,
      minExpectedProfitUsd: config.minExpectedProfitUsd ?? 0.05,
      ethPriceUsd: config.ethPriceUsd ?? 2450.0,
      gasPriceGwei: config.gasPriceGwei ?? 0.05,
      replayMode: config.replayMode ?? false,
    };

    this.publicClient = publicClient;
    this.stateManager = new LocalPoolStateManager();

    this.metrics = {
      startTimeWallMs: Date.now(),
      elapsedMs: 0,
      isRunning: false,
      shutdownRequested: false,
      cexMessagesReceived: 0,
      dexEventsProcessed: 0,
      localEvaluationsPerformed: 0,
      candidatesDetectedLocal: 0,
      candidatesEconomicallyPassed: 0,
      rpcVerificationRequestsSent: 0,
      rpcVerificationsSucceeded: 0,
      candidatesShadowSimulated: 0,
      candidatesShadowExecutable: 0,
      rpcCallsAvoided: 0,
      rpcReductionRatio: 0,
      rpcCallsPerCandidate: 0,
      rawObservations: 0,
      uniqueMarketStates: 0,
      uniqueBlockStates: 0,
      uniqueCandidates: 0,
      effectiveSampleSize: 0,
      localDetectionLatencyUs: { min: 0, median: 0, p95: 0, max: 0 },
      rpcVerificationLatencyMs: { min: 0, median: 0, p95: 0, max: 0 },
      totalLifecycleLatencyMs: { min: 0, median: 0, p95: 0, max: 0 },
      stateHealthByPool: {},
      failureCountsByCategory: {
        RPC_RATE_LIMIT: 0,
        RPC_TIMEOUT: 0,
        RPC_ERROR: 0,
        WS_DISCONNECT: 0,
        WS_SEQUENCE_GAP: 0,
        STATE_GAP: 0,
        REORG: 0,
        STALE_STATE: 0,
        MISSING_TICK: 0,
        INVALID_TOKEN_ORDER: 0,
        DECIMAL_MISMATCH: 0,
        QUOTE_MISMATCH: 0,
        QUOTE_STALE: 0,
        INSUFFICIENT_LIQUIDITY: 0,
        ECONOMICS_REJECT: 0,
        GAS_REJECT: 0,
        RISK_REJECT: 0,
        SLIPPAGE_REJECT: 0,
        UNKNOWN: 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Configuration & Registration
  // ─────────────────────────────────────────────────────────────────────────────

  public registerPool(poolConfig: PoolTrackingConfig): void {
    this.trackedPools.set(poolConfig.address.toLowerCase() as Address, poolConfig);
    this.poolHealth.set(poolConfig.address.toLowerCase() as Address, 'UNKNOWN');
    this.metrics.stateHealthByPool[poolConfig.address.toLowerCase()] = 'UNKNOWN';
  }

  public registerCexFeed(feed: CexFeedConfig): void {
    const key = `${feed.venue}:${feed.symbol.toUpperCase()}`;
    if (!this.cexBooks.has(key)) {
      this.cexBooks.set(key, new CexOrderBook(feed.venue, feed.symbol));
    }
  }

  public getPoolHealth(poolAddress: Address): StateHealthStatus {
    return this.poolHealth.get(poolAddress.toLowerCase() as Address) || 'UNKNOWN';
  }

  public setPoolHealth(poolAddress: Address, health: StateHealthStatus): void {
    const addr = poolAddress.toLowerCase() as Address;
    this.poolHealth.set(addr, health);
    this.metrics.stateHealthByPool[addr] = health;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pipeline Lifecycle & Control
  // ─────────────────────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.metrics.isRunning = true;
    this.metrics.startTimeWallMs = Date.now();

    // Hook graceful termination signals
    this.sigintHandler = (): void => {
      void this.stop('SIGINT received');
    };
    this.sigtermHandler = (): void => {
      void this.stop('SIGTERM received');
    };
    process.on('SIGINT', this.sigintHandler);
    process.on('SIGTERM', this.sigtermHandler);

    // Set duration timeout
    if (this.config.maxDurationMs > 0) {
      this.timeoutHandle = setTimeout((): void => {
        void this.stop(`Configured duration of ${this.config.maxDurationMs / 1000}s elapsed`);
      }, this.config.maxDurationMs);
    }
  }

  public stop(reason?: string): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.metrics.isRunning = false;
    this.metrics.shutdownRequested = true;
    this.metrics.elapsedMs = Date.now() - this.metrics.startTimeWallMs;

    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    if (this.timerHandle) clearInterval(this.timerHandle);

    if (this.sigintHandler) process.removeListener('SIGINT', this.sigintHandler);
    if (this.sigtermHandler) process.removeListener('SIGTERM', this.sigtermHandler);

    this.recalculateSummaryMetrics();

    if (reason) {
      console.log(`[ContinuousShadowPipeline] Stopped: ${reason}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Ingestion (CEX & DEX)
  // ─────────────────────────────────────────────────────────────────────────────

  public onCexBookUpdate(venue: CexVenue, symbol: string, book: CexOrderBook): void {
    this.metrics.cexMessagesReceived++;
    const key = `${venue}:${symbol.toUpperCase()}`;
    this.cexBooks.set(key, book);
    this.evaluateCrossVenueOpportunities(venue, symbol, book);
  }

  public onDexStateUpdate(poolAddress: Address): void {
    this.metrics.dexEventsProcessed++;
    const addr = poolAddress.toLowerCase() as Address;
    const v3State = this.stateManager.getV3State(addr);
    const v2State = this.stateManager.getV2State(addr);

    if (v3State) {
      this.syncStateHealthFromV3(addr, v3State);
    } else if (v2State) {
      this.syncStateHealthFromV2(addr, v2State);
    }

    this.evaluateDexOpportunities(addr);
  }

  private syncStateHealthFromV3(addr: Address, state: V3PoolState): void {
    let health: StateHealthStatus = 'HEALTHY';
    if (state.lifecycle === 'INVALID') health = 'INVALID';
    else if (state.lifecycle === 'INCOMPLETE') health = 'INCOMPLETE';
    else if (state.lifecycle === 'STALE') health = 'STALE';
    else if (state.lifecycle === 'RESYNC_REQUIRED') health = 'RESYNC_REQUIRED';
    else if (state.lifecycle === 'SYNCING') health = 'DEGRADED';
    this.setPoolHealth(addr, health);
  }

  private syncStateHealthFromV2(addr: Address, state: V2PoolState): void {
    let health: StateHealthStatus = 'HEALTHY';
    if (state.lifecycle === 'INVALID') health = 'INVALID';
    else if (state.lifecycle === 'STALE') health = 'STALE';
    else if (state.lifecycle === 'RESYNC_REQUIRED') health = 'RESYNC_REQUIRED';
    this.setPoolHealth(addr, health);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Local Candidate Screening (Microseconds)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Evaluates DEX <-> DEX arbitrage candidates across supported registered pools.
   */
  public async evaluateDexOpportunities(triggerPoolAddress: Address): Promise<ForensicCandidateRecord[]> {
    const triggerAddr = triggerPoolAddress.toLowerCase() as Address;
    const triggerHealth = this.getPoolHealth(triggerAddr);
    this.metrics.rawObservations++;

    // Fail closed if state is not healthy or degraded
    if (triggerHealth !== 'HEALTHY' && triggerHealth !== 'DEGRADED') {
      this.recordFailure({
        category: 'STALE_STATE',
        details: `Skipping quote evaluation on pool ${triggerAddr}: health is ${triggerHealth}`,
        poolAddress: triggerAddr,
      });
      return [];
    }

    const v3Pools = Array.from(this.trackedPools.values()).filter((p) => p.protocol === 'uniswap-v3');
    const v2Pools = Array.from(this.trackedPools.values()).filter((p) => p.protocol === 'aerodrome-v2');

    const generatedCandidates: ForensicCandidateRecord[] = [];

    // Compare each V3 pool against each V2 pool sharing identical token pairs
    for (const v3Cfg of v3Pools) {
      for (const v2Cfg of v2Pools) {
        if (
          v3Cfg.token0.toLowerCase() === v2Cfg.token0.toLowerCase() &&
          v3Cfg.token1.toLowerCase() === v2Cfg.token1.toLowerCase()
        ) {
          for (const notional of this.config.notionalsUsd) {
            const cand = await this.evaluateDexPair(v3Cfg, v2Cfg, notional);
            if (cand) generatedCandidates.push(cand);
          }
        }
      }
    }

    return generatedCandidates;
  }

  private async evaluateDexPair(
    v3Cfg: PoolTrackingConfig,
    v2Cfg: PoolTrackingConfig,
    notionalUsd: number
  ): Promise<ForensicCandidateRecord | null> {
    const t0 = performance.now();
    this.metrics.localEvaluationsPerformed++;

    const v3Addr = v3Cfg.address.toLowerCase() as Address;
    const v2Addr = v2Cfg.address.toLowerCase() as Address;

    const v3State = this.stateManager.getV3State(v3Addr);
    const v2State = this.stateManager.getV2State(v2Addr);

    if (!v3State || !v2State) return null;
    if (this.getPoolHealth(v3Addr) !== 'HEALTHY' || this.getPoolHealth(v2Addr) !== 'HEALTHY') return null;

    // Approximate trade amount in token0 (WETH) based on notionalUsd and ethPriceUsd
    const tokenInAmount = BigInt(Math.floor((notionalUsd / this.config.ethPriceUsd) * 1e18));
    if (tokenInAmount <= 0n) return null;

    // Step 1: In-memory simulation of Leg 1 (Sell WETH on V3 for USDC)
    const quoteLeg1 = LocalPriceEngine.quoteV3MultiTick(v3State, v3Cfg.token0, tokenInAmount);
    if (quoteLeg1.amountOut <= 0n) return null;

    // Step 2: In-memory simulation of Leg 2 (Sell USDC on V2 for WETH)
    const quoteLeg2 = LocalPriceEngine.quoteV2(v2State, v2Cfg.token1, quoteLeg1.amountOut);
    if (quoteLeg2.amountOut <= 0n) return null;

    const t1 = performance.now();
    const localDurationUs = (t1 - t0) * 1000;
    this.localLatenciesUs.push(localDurationUs);

    const grossDeltaWei = quoteLeg2.amountOut - tokenInAmount;
    const grossPnLUsd = (Number(grossDeltaWei) / 1e18) * this.config.ethPriceUsd;

    // Gas & Risk Cost Models
    const estimatedGasUnits = 280000; // ~150k for V3 + ~130k for V2
    const estimatedGasCostUsd = (estimatedGasUnits * this.config.gasPriceGwei * 1e-9) * this.config.ethPriceUsd;
    const riskBufferCostUsd = notionalUsd * (this.config.riskBufferBps / 10000);
    const netExpectedPnLUsd = grossPnLUsd - estimatedGasCostUsd - riskBufferCostUsd;

    this.metrics.candidatesDetectedLocal++;

    const candidateId = `cand_${v3State.blockNumber}_${this.metrics.candidatesDetectedLocal}_${notionalUsd}`;
    const routeId = `BASE_DEX_DEX_${v3Cfg.address.slice(0, 6)}_${v2Cfg.address.slice(0, 6)}_${notionalUsd}`;

    const marketHash = `${v3State.blockNumber}:${v3State.sqrtPriceX96}:${v2State.reserve0}`;
    const isUniqueMarket = !this.seenMarketStateHashes.has(marketHash);
    if (isUniqueMarket) this.seenMarketStateHashes.add(marketHash);

    const isUniqueBlock = !this.seenBlockNumbers.has(v3State.blockNumber.toString());
    if (isUniqueBlock) this.seenBlockNumbers.add(v3State.blockNumber.toString());

    let lifecycle: CandidateLifecycleState = 'DETECTED_LOCAL';
    let verificationOutcome: VerificationOutcome = 'UNKNOWN';
    let rejectionReason: string | undefined;

    // Economic Gate Check
    const passesEconomics = netExpectedPnLUsd >= this.config.minExpectedProfitUsd;
    if (!passesEconomics) {
      lifecycle = 'REJECTED_ECONOMICS';
      verificationOutcome = 'REJECTED_ECONOMICS';
      rejectionReason = `Net expected PnL ($${netExpectedPnLUsd.toFixed(4)}) below minimum ($${this.config.minExpectedProfitUsd})`;
      this.metrics.rpcCallsAvoided++; // Track avoided RPC calls
    } else {
      lifecycle = 'ECONOMICALLY_FILTERED';
      this.metrics.candidatesEconomicallyPassed++;
    }

    const candidateRecord: ForensicCandidateRecord = {
      runId: this.config.runId,
      candidateId,
      routeId,
      routeClass: 'DEX_TO_DEX',
      chain: this.config.chain,
      chainId: this.config.chainId,
      triggerEvent: {
        source: 'DEX_EVENT',
        identifier: v3Addr,
        receivedMonotonicMs: performance.now(),
      },
      localDEXState: {
        poolAddress: v3Cfg.address,
        protocol: 'uniswap-v3',
        stateBlockNumber: v3State.blockNumber,
        stateBlockHash: v3State.blockHash as `0x${string}`,
        stateHealth: this.getPoolHealth(v3Addr),
        stateAgeMs: Math.round(performance.now() - v3State.lastUpdateMonotonicMs),
        sqrtPriceX96: v3State.sqrtPriceX96,
        activeTick: v3State.tick,
      },
      assumptions: {
        riskBufferBps: this.config.riskBufferBps,
        estimatedGasUnits,
        gasPriceGwei: this.config.gasPriceGwei,
        ethPriceUsd: this.config.ethPriceUsd,
        cexFeeRateBps: this.config.cexFeeBps,
        maxSlippageBps: this.config.maxSlippageBps,
      },
      inputAmount: tokenInAmount,
      inputToken: v3Cfg.token0,
      outputToken: v3Cfg.token0,
      notionalUsd,
      localPredictedOutput: quoteLeg2.amountOut,
      localPredictionProvenance: '[SIMULATED]',
      economics: {
        grossRoundTripPnLUsd: grossPnLUsd,
        estimatedGasCostUsd,
        riskBufferCostUsd,
        otherFeesUsd: 0,
        netExpectedPnLUsd,
        isEconomicallyViable: passesEconomics,
      },
      lifecycle,
      verificationOutcome,
      rejectionReason,
      sampleIndependence: {
        marketStateHash: marketHash,
        isUniqueMarketState: isUniqueMarket,
        isUniqueBlockState: isUniqueBlock,
        observationIndexInBlock: this.candidateIdsInCurrentBlock.size + 1,
      },
      lifetime: {
        firstDetectedMonotonicMs: performance.now(),
        lastObservedMonotonicMs: performance.now(),
        durationMs: 0,
        lifetimeStatus: 'MEASURED',
      },
      shadowOutcome: {
        executionClassification: 'SHADOW_ONLY',
        hypotheticalOutput: quoteLeg2.amountOut,
        hypotheticalNetProfitUsd: netExpectedPnLUsd,
        wouldHaveExecuted: false,
        simulatedAtMonotonicMs: performance.now(),
      },
    };

    // If candidate passed initial economic filter, trigger Authoritative Verification
    if (passesEconomics && this.publicClient && !this.config.replayMode) {
      await this.verifyCandidateAuthoritatively(candidateRecord, v3Cfg, v2Cfg, tokenInAmount);
    }

    this.forensicCandidates.push(candidateRecord);
    return candidateRecord;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Authoritative Verification Gate (QuoterV2 & getAmountOut)
  // ─────────────────────────────────────────────────────────────────────────────

  private async verifyCandidateAuthoritatively(
    candidate: ForensicCandidateRecord,
    v3Cfg: PoolTrackingConfig,
    v2Cfg: PoolTrackingConfig,
    amountInLeg1: bigint
  ): Promise<void> {
    if (!this.publicClient) return;
    this.metrics.rpcVerificationRequestsSent++;
    candidate.lifecycle = 'RPC_VERIFICATION_PENDING';

    const t0 = performance.now();
    try {
      // Step 1: Direct on-chain QuoterV2 call for Leg 1
      const V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;
      const v3QuoterAbi = [
        {
          name: 'quoteExactInputSingle',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: 'params',
              type: 'tuple',
              components: [
                { name: 'tokenIn', type: 'address' },
                { name: 'tokenOut', type: 'address' },
                { name: 'amountIn', type: 'uint256' },
                { name: 'fee', type: 'uint24' },
                { name: 'sqrtPriceLimitX96', type: 'uint160' },
              ],
            },
          ],
          outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'sqrtPriceX96After', type: 'uint160' },
            { name: 'initializedTicksCrossed', type: 'uint32' },
            { name: 'gasEstimate', type: 'uint256' },
          ],
        },
      ] as const;

      const [authLeg1Output] = (await this.publicClient.readContract({
        address: V3_QUOTER,
        abi: v3QuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn: v3Cfg.token0,
            tokenOut: v3Cfg.token1,
            amountIn: amountInLeg1,
            fee: v3Cfg.feeTier || 500,
            sqrtPriceLimitX96: 0n,
          },
        ],
        blockNumber: candidate.localDEXState.stateBlockNumber,
      })) as [bigint, bigint, number, bigint];

      // Step 2: Direct on-chain getAmountOut call for Leg 2
      const aeroAbi = [
        {
          name: 'getAmountOut',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'tokenIn', type: 'address' },
          ],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const;

      const authLeg2Output = (await this.publicClient.readContract({
        address: v2Cfg.address,
        abi: aeroAbi,
        functionName: 'getAmountOut',
        args: [authLeg1Output, v2Cfg.token1],
        blockNumber: candidate.localDEXState.stateBlockNumber,
      })) as bigint;

      const t1 = performance.now();
      const rpcDurationMs = t1 - t0;
      this.rpcLatenciesMs.push(rpcDurationMs);
      this.metrics.rpcVerificationsSucceeded++;

      // Compute exact discrepancy
      const localPredicted = candidate.localPredictedOutput;
      const absDeltaWei = localPredicted > authLeg2Output ? localPredicted - authLeg2Output : authLeg2Output - localPredicted;
      const deltaBps = localPredicted > 0n ? (Number(absDeltaWei) / Number(localPredicted)) * 10000 : 0;

      let discrepancyClass: DiscrepancyClassification = 'EXACT';
      if (absDeltaWei === 0n) discrepancyClass = 'EXACT';
      else if (deltaBps <= 1.0) discrepancyClass = 'SUB_BPS_DRIFT';
      else if (deltaBps <= 5.0) discrepancyClass = 'LOW_DRIFT';
      else discrepancyClass = 'MATERIAL_DRIFT';

      candidate.authoritativeQuote = {
        outputAmount: authLeg2Output,
        blockNumber: candidate.localDEXState.stateBlockNumber,
        blockHash: candidate.localDEXState.stateBlockHash,
        latencyMs: rpcDurationMs,
        provider: 'https://mainnet.base.org',
        quoteAgeMs: Math.max(0, Date.now() - candidate.localDEXState.stateAgeMs),
        freshnessClass: 'FRESH_ONCHAIN_QUOTE',
        provenance: '[QUOTED]',
      };

      candidate.discrepancy = {
        absoluteDeltaWei: absDeltaWei,
        deltaBps,
        classification: discrepancyClass,
      };

      // Revalidate economics using authoritative quote
      const authGrossDeltaWei = authLeg2Output - amountInLeg1;
      const authGrossPnLUsd = (Number(authGrossDeltaWei) / 1e18) * this.config.ethPriceUsd;
      const authNetExpectedPnLUsd =
        authGrossPnLUsd - candidate.economics.estimatedGasCostUsd - candidate.economics.riskBufferCostUsd;

      candidate.economics.grossRoundTripPnLUsd = authGrossPnLUsd;
      candidate.economics.netExpectedPnLUsd = authNetExpectedPnLUsd;

      if (discrepancyClass === 'MATERIAL_DRIFT') {
        candidate.lifecycle = 'REJECTED_DRIFT';
        candidate.verificationOutcome = 'REJECTED_LOCAL_RPC_MISMATCH';
        candidate.rejectionReason = `Material output drift: ${deltaBps.toFixed(4)} bps exceeded 5.0 bps tolerance`;
      } else if (authNetExpectedPnLUsd < this.config.minExpectedProfitUsd) {
        candidate.lifecycle = 'REJECTED_ECONOMICS';
        candidate.verificationOutcome = 'REJECTED_ECONOMICS';
        candidate.rejectionReason = `Authoritative net expected PnL ($${authNetExpectedPnLUsd.toFixed(4)}) below threshold`;
      } else {
        candidate.lifecycle = 'SHADOW_SIMULATED';
        candidate.verificationOutcome = 'VERIFIED';
        candidate.shadowOutcome.wouldHaveExecuted = true;
        candidate.shadowOutcome.hypotheticalOutput = authLeg2Output;
        candidate.shadowOutcome.hypotheticalNetProfitUsd = authNetExpectedPnLUsd;
        this.metrics.candidatesShadowSimulated++;
        this.metrics.candidatesShadowExecutable = this.metrics.candidatesShadowSimulated;
      }
    } catch (err: unknown) {
      const errStr = String(err);
      candidate.lifecycle = 'REJECTED_RPC';
      candidate.verificationOutcome = 'RPC_ERROR';
      candidate.rejectionReason = `Authoritative RPC call error: ${errStr}`;
      this.recordFailure({
        category: errStr.includes('rate limit') ? 'RPC_RATE_LIMIT' : 'RPC_ERROR',
        details: errStr,
        poolAddress: v3Cfg.address,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Venue Evaluation (CEX <-> DEX)
  // ─────────────────────────────────────────────────────────────────────────────

  public evaluateCrossVenueOpportunities(
    venue: CexVenue,
    symbol: string,
    book: CexOrderBook
  ): ForensicCandidateRecord[] {
    this.metrics.rawObservations++;
    const bestBid = book.getBestBid();
    const bestAsk = book.getBestAsk();
    if (!bestBid || !bestAsk) return [];

    const candidates: ForensicCandidateRecord[] = [];
    const v3Pools = Array.from(this.trackedPools.values()).filter((p) => p.protocol === 'uniswap-v3');

    for (const v3Cfg of v3Pools) {
      const poolAddr = v3Cfg.address.toLowerCase() as Address;
      const v3State = this.stateManager.getV3State(poolAddr);
      if (!v3State || this.getPoolHealth(poolAddr) !== 'HEALTHY') continue;

      for (const notional of this.config.notionalsUsd) {
        // CEX -> DEX (Buy on CEX, Sell on DEX)
        const vwapAsk = CexVwapCalculator.calculateVwapForNotional(book, 'BUY', notional);
        if (vwapAsk.status === 'FILLED' && vwapAsk.averagePrice > 0) {
          const cand = this.evaluateCexDex(v3Cfg, v3State, venue, symbol, book, vwapAsk.averagePrice, notional, 'CEX_TO_DEX');
          if (cand) candidates.push(cand);
        }

        // DEX -> CEX (Buy on DEX, Sell on CEX)
        const vwapBid = CexVwapCalculator.calculateVwapForNotional(book, 'SELL', notional);
        if (vwapBid.status === 'FILLED' && vwapBid.averagePrice > 0) {
          const cand = this.evaluateCexDex(v3Cfg, v3State, venue, symbol, book, vwapBid.averagePrice, notional, 'DEX_TO_CEX');
          if (cand) candidates.push(cand);
        }
      }
    }

    return candidates;
  }

  private evaluateCexDex(
    v3Cfg: PoolTrackingConfig,
    v3State: V3PoolState,
    venue: CexVenue,
    symbol: string,
    book: CexOrderBook,
    cexPrice: number,
    notionalUsd: number,
    direction: 'CEX_TO_DEX' | 'DEX_TO_CEX'
  ): ForensicCandidateRecord | null {
    this.metrics.localEvaluationsPerformed++;
    let tokenInAmount: bigint;
    let localPredictedOutput: bigint;
    let grossPnLUsd = 0;
    let inputToken: Address;
    let outputToken: Address;

    if (direction === 'CEX_TO_DEX') {
      // Direction: Buy WETH on CEX, sell WETH on DEX for USDC
      inputToken = v3Cfg.token0;
      outputToken = v3Cfg.token1;

      // Token in (WETH) bought on CEX at cexPrice (VWAP ask) for notionalUsd
      tokenInAmount = BigInt(Math.floor((notionalUsd / cexPrice) * 1e18));
      if (tokenInAmount <= 0n) return null;

      // Swap WETH on DEX for USDC
      const quote = LocalPriceEngine.quoteV3MultiTick(v3State, v3Cfg.token0, tokenInAmount);
      if (quote.amountOut <= 0n) return null;
      localPredictedOutput = quote.amountOut;

      const dexProceedsUsd = Number(quote.amountOut) / 1e6; // USDC has 6 decimals
      const cexCostUsd = (Number(tokenInAmount) / 1e18) * cexPrice;
      grossPnLUsd = dexProceedsUsd - cexCostUsd;
    } else {
      // Direction: Buy WETH on DEX with USDC, sell WETH on CEX at cexPrice (VWAP bid)
      inputToken = v3Cfg.token1;
      outputToken = v3Cfg.token0;

      const usdcIn = BigInt(Math.floor(notionalUsd * 1e6));
      tokenInAmount = usdcIn;

      // Swap USDC on DEX for WETH
      const quote = LocalPriceEngine.quoteV3MultiTick(v3State, v3Cfg.token1, usdcIn);
      if (quote.amountOut <= 0n) return null;
      localPredictedOutput = quote.amountOut;

      const cexProceedsUsd = (Number(quote.amountOut) / 1e18) * cexPrice;
      const dexCostUsd = notionalUsd;
      grossPnLUsd = cexProceedsUsd - dexCostUsd;
    }

    const estimatedGasUnits = 160000;
    const estimatedGasCostUsd = (estimatedGasUnits * this.config.gasPriceGwei * 1e-9) * this.config.ethPriceUsd;
    const cexFeeCostUsd = notionalUsd * (this.config.cexFeeBps / 10000);
    const riskBufferCostUsd = notionalUsd * (this.config.riskBufferBps / 10000);
    const netExpectedPnLUsd = grossPnLUsd - estimatedGasCostUsd - cexFeeCostUsd - riskBufferCostUsd;

    this.metrics.candidatesDetectedLocal++;
    const passesEconomics = netExpectedPnLUsd >= this.config.minExpectedProfitUsd;
    if (!passesEconomics) {
      this.metrics.rpcCallsAvoided++;
    } else {
      this.metrics.candidatesEconomicallyPassed++;
    }

    const timestamps = book.getTimestamps();
    const candidateId = `cand_cex_${v3State.blockNumber}_${this.metrics.candidatesDetectedLocal}_${notionalUsd}`;
    const routeId = `CEX_DEX_${venue.toUpperCase()}_${direction}_${notionalUsd}`;

    const candidateRecord: ForensicCandidateRecord = {
      runId: this.config.runId,
      candidateId,
      routeId,
      routeClass: direction,
      chain: this.config.chain,
      chainId: this.config.chainId,
      triggerEvent: {
        source: 'CEX_UPDATE',
        identifier: `${venue}:${symbol}`,
        receivedMonotonicMs: performance.now(),
      },
      localDEXState: {
        poolAddress: v3Cfg.address,
        protocol: 'uniswap-v3',
        stateBlockNumber: v3State.blockNumber,
        stateBlockHash: v3State.blockHash as `0x${string}`,
        stateHealth: this.getPoolHealth(v3Cfg.address.toLowerCase() as Address),
        stateAgeMs: Math.round(performance.now() - v3State.lastUpdateMonotonicMs),
        sqrtPriceX96: v3State.sqrtPriceX96,
        activeTick: v3State.tick,
      },
      cexState: {
        venue,
        symbol,
        bid: book.getBestBid()?.price || 0,
        ask: book.getBestAsk()?.price || 0,
        bidDepthUsd: book.getTotalBidLiquidityUsd(),
        askDepthUsd: book.getTotalAskLiquidityUsd(),
        updateAgeMs: Math.max(0, Date.now() - timestamps.localReceiveWallClock),
        exchangeTimestampMs: timestamps.exchangeTimestamp,
      },
      assumptions: {
        riskBufferBps: this.config.riskBufferBps,
        estimatedGasUnits,
        gasPriceGwei: this.config.gasPriceGwei,
        ethPriceUsd: this.config.ethPriceUsd,
        cexFeeRateBps: this.config.cexFeeBps,
        maxSlippageBps: this.config.maxSlippageBps,
      },
      inputAmount: tokenInAmount,
      inputToken,
      outputToken,
      notionalUsd,
      localPredictedOutput,
      localPredictionProvenance: '[SIMULATED]',
      economics: {
        grossRoundTripPnLUsd: grossPnLUsd,
        estimatedGasCostUsd,
        riskBufferCostUsd,
        otherFeesUsd: cexFeeCostUsd,
        netExpectedPnLUsd,
        isEconomicallyViable: passesEconomics,
      },
      lifecycle: passesEconomics ? 'ECONOMICALLY_FILTERED' : 'REJECTED_ECONOMICS',
      verificationOutcome: passesEconomics ? 'UNKNOWN' : 'REJECTED_ECONOMICS',
      rejectionReason: passesEconomics ? undefined : `Net expected PnL ($${netExpectedPnLUsd.toFixed(4)}) below hurdle`,
      sampleIndependence: {
        marketStateHash: `${v3State.blockNumber}:${cexPrice}:${v3State.sqrtPriceX96}`,
        isUniqueMarketState: true,
        isUniqueBlockState: true,
        observationIndexInBlock: 1,
      },
      lifetime: {
        firstDetectedMonotonicMs: performance.now(),
        lastObservedMonotonicMs: performance.now(),
        durationMs: 0,
        lifetimeStatus: 'MEASURED',
      },
      shadowOutcome: {
        executionClassification: 'SHADOW_ONLY',
        hypotheticalOutput: localPredictedOutput,
        hypotheticalNetProfitUsd: netExpectedPnLUsd,
        wouldHaveExecuted: false,
        simulatedAtMonotonicMs: performance.now(),
      },
    };

    this.forensicCandidates.push(candidateRecord);
    return candidateRecord;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Failure Logging & Metrics Recalculation
  // ─────────────────────────────────────────────────────────────────────────────

  public recordFailure(failure: {
    category: FailureCategory;
    details: string;
    poolAddress?: Address;
    blockNumber?: bigint;
    routeId?: string;
  }): void {
    const record: PipelineFailureRecord = {
      failureId: `fail_${Date.now()}_${this.failureRecords.length + 1}`,
      category: failure.category,
      timestampWallMs: Date.now(),
      timestampMonotonicMs: performance.now(),
      details: failure.details,
      poolAddress: failure.poolAddress,
      blockNumber: failure.blockNumber,
      routeId: failure.routeId,
      resolved: false,
    };
    this.failureRecords.push(record);
    this.metrics.failureCountsByCategory[failure.category] =
      (this.metrics.failureCountsByCategory[failure.category] || 0) + 1;
  }

  public recalculateSummaryMetrics(): void {
    const totalLocal = this.metrics.localEvaluationsPerformed;
    const rpcRequests = this.metrics.rpcVerificationRequestsSent;
    const avoided = Math.max(0, totalLocal - rpcRequests);
    this.metrics.rpcCallsAvoided = avoided;
    this.metrics.rpcReductionRatio = totalLocal > 0 ? avoided / totalLocal : 0;
    this.metrics.rpcCallsPerCandidate =
      this.metrics.candidatesDetectedLocal > 0 ? rpcRequests / this.metrics.candidatesDetectedLocal : 0;

    this.metrics.uniqueMarketStates = this.seenMarketStateHashes.size;
    this.metrics.uniqueBlockStates = this.seenBlockNumbers.size;
    this.metrics.uniqueCandidates = this.forensicCandidates.length;
    this.metrics.effectiveSampleSize = this.metrics.uniqueBlockStates;

    this.metrics.localDetectionLatencyUs = this.computeDistribution(this.localLatenciesUs);
    this.metrics.rpcVerificationLatencyMs = this.computeDistribution(this.rpcLatenciesMs);
    this.metrics.totalLifecycleLatencyMs = this.computeDistribution(this.lifecycleLatenciesMs);
  }

  private computeDistribution(samples: number[]): { min: number; median: number; p95: number; max: number } {
    if (samples.length === 0) return { min: 0, median: 0, p95: 0, max: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const median = sorted[Math.floor(sorted.length * 0.5)]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    return { min, median, p95, max };
  }

  public getTelemetryMetrics(): PipelineTelemetryMetrics {
    this.recalculateSummaryMetrics();
    return this.metrics;
  }

  public getSampleIndependenceMetrics(): {
    rawObservations: number;
    uniqueMarketStates: number;
    uniqueBlockNumbers: number;
    uniqueRouteStates: number;
    redundancyFactor: number;
  } {
    const raw = this.metrics.rawObservations;
    const uniqueStates = this.seenMarketStateHashes.size;
    return {
      rawObservations: raw,
      uniqueMarketStates: uniqueStates,
      uniqueBlockNumbers: this.seenBlockNumbers.size,
      uniqueRouteStates: this.forensicCandidates.length,
      redundancyFactor: uniqueStates > 0 ? raw / uniqueStates : 1.0,
    };
  }

  public getForensicSummary(): {
    discrepancyDistribution: Record<DiscrepancyClassification, number>;
    freshnessDistribution: Record<QuoteFreshnessClass, number>;
    lifecycleDistribution: Record<CandidateLifecycleState, number>;
    verificationDistribution: Record<VerificationOutcome, number>;
  } {
    const discrepancyDistribution: Record<DiscrepancyClassification, number> = {
      EXACT: 0,
      SUB_BPS_DRIFT: 0,
      LOW_DRIFT: 0,
      MATERIAL_DRIFT: 0,
      INVALID_STATE: 0,
    };
    const freshnessDistribution: Record<QuoteFreshnessClass, number> = {
      FRESH_ONCHAIN_QUOTE: 0,
      CACHED_ONCHAIN_QUOTE: 0,
      SIMULATED_QUOTE: 0,
      MISSING_QUOTE: 0,
    };
    const lifecycleDistribution: Record<CandidateLifecycleState, number> = {
      DETECTED_LOCAL: 0,
      ECONOMICALLY_FILTERED: 0,
      RPC_VERIFICATION_PENDING: 0,
      RPC_VERIFIED: 0,
      REVALIDATED: 0,
      SHADOW_SIMULATED: 0,
      SHADOW_EXECUTABLE: 0,
      SHADOW_EXPIRED: 0,
      REJECTED_ECONOMICS: 0,
      REJECTED_STALE: 0,
      REJECTED_STATE: 0,
      REJECTED_RPC: 0,
      REJECTED_DRIFT: 0,
      REJECTED_LIQUIDITY: 0,
      REJECTED_RISK: 0,
      REJECTED_GAS: 0,
      INVALIDATED: 0,
    };
    const verificationDistribution: Record<VerificationOutcome, number> = {
      VERIFIED: 0,
      VERIFIED_WITH_DRIFT: 0,
      REJECTED_LOCAL_RPC_MISMATCH: 0,
      REJECTED_STALE: 0,
      REJECTED_STATE_INVALID: 0,
      REJECTED_ECONOMICS: 0,
      REJECTED_LIQUIDITY: 0,
      REJECTED_GAS: 0,
      REJECTED_RISK: 0,
      RPC_ERROR: 0,
      UNKNOWN: 0,
    };

    for (const c of this.forensicCandidates) {
      if (c.discrepancy?.classification) {
        discrepancyDistribution[c.discrepancy.classification]++;
      }
      if (c.authoritativeQuote?.freshnessClass) {
        freshnessDistribution[c.authoritativeQuote.freshnessClass]++;
      } else {
        freshnessDistribution.SIMULATED_QUOTE++;
      }
      lifecycleDistribution[c.lifecycle]++;
      verificationDistribution[c.verificationOutcome]++;
    }

    return {
      discrepancyDistribution,
      freshnessDistribution,
      lifecycleDistribution,
      verificationDistribution,
    };
  }
}
