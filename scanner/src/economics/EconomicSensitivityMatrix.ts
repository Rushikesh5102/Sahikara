/**
 * SAHIKARA — Phase 4.9 Economic Sensitivity Matrix
 *
 * Research-only analytical module to evaluate candidate profitability across
 * a parameterized spectrum of risk-buffer values ($0.00 to $0.25).
 *
 * ABSOLUTE POLICY DIRECTIVES:
 * 1. This module is for RESEARCH SENSITIVITY MODELING ONLY.
 * 2. Production risk policies and execution gates remain strictly LOCKED.
 * 3. Sensitivity matrix outputs MUST NEVER be declared as "empirical profitability".
 * 4. Net PnL = finalAmountOutUsd - initialAmountInUsd - gasCostUsd - otherExecutionCostsUsd - riskBufferUsd.
 */

export interface HistoricalCandidateParams {
  candidateId: string;
  routeId: string;
  chain: string;
  blockNumber: string;
  tradeSizeUsd: number;
  grossProfitUsd: number;
  grossSpreadBps: number;
  dexFeeDragUsd: number;
  dexFeeDragBps: number;
  gasCostUsd: number;
  otherExecutionCostsUsd: number;
  sourceEventTimestampMs: number;
}

export interface SensitivityTierResult {
  riskBufferUsd: number;
  grossPnLUsd: number;
  dexFeeDragUsd: number;
  gasCostUsd: number;
  otherCostsUsd: number;
  effectiveRiskBufferUsd: number;
  netPnLUsd: number;
  netProfitBps: number;
  isNetProfitable: boolean;
  provenance: {
    grossCalculation: string;
    gasAssumption: string;
    bufferStatus: 'RESEARCH_HYPOTHETICAL' | 'POLICY_LOCKED';
  };
}

export interface CandidateSensitivityEvaluation {
  candidateId: string;
  routeId: string;
  chain: string;
  tradeSizeUsd: number;
  testedTiers: SensitivityTierResult[];
  minBufferForBreakevenUsd: number | null;
  profitableAtZeroBuffer: boolean;
  limitingConstraint: 'GAS_DRAG' | 'DEX_FEES' | 'PRICE_IMPACT' | 'RISK_BUFFER';
}

export class EconomicSensitivityMatrix {
  /**
   * Standard research-only risk buffer tiers ($0 to $0.25)
   */
  public static readonly STANDARD_TIERS: readonly number[] = [
    0.0,
    0.001,
    0.005,
    0.01,
    0.025,
    0.05,
    0.10,
    0.25,
  ];

  /**
   * Evaluates a candidate across the standard risk-buffer tiers.
   */
  public static evaluateCandidate(
    candidate: HistoricalCandidateParams,
    customTiers?: number[]
  ): CandidateSensitivityEvaluation {
    const tiers = customTiers ?? this.STANDARD_TIERS;
    const testedTiers: SensitivityTierResult[] = [];

    let profitableAtZeroBuffer = false;

    for (const buffer of tiers) {
      // Net PnL calculation:
      // Note: Quoted gross profit already incorporates DEX fees via the exchange pool contract.
      // dexFeeDragUsd is displayed for informational provenance.
      const netPnLUsd =
        candidate.grossProfitUsd -
        candidate.gasCostUsd -
        candidate.otherExecutionCostsUsd -
        buffer;

      const netProfitBps =
        candidate.tradeSizeUsd > 0
          ? (netPnLUsd / candidate.tradeSizeUsd) * 10_000
          : 0;

      const isNetProfitable = netPnLUsd > 0;

      if (buffer === 0.0 && isNetProfitable) {
        profitableAtZeroBuffer = true;
      }

      testedTiers.push({
        riskBufferUsd: buffer,
        grossPnLUsd: candidate.grossProfitUsd,
        dexFeeDragUsd: candidate.dexFeeDragUsd,
        gasCostUsd: candidate.gasCostUsd,
        otherCostsUsd: candidate.otherExecutionCostsUsd,
        effectiveRiskBufferUsd: buffer,
        netPnLUsd: Number(netPnLUsd.toFixed(6)),
        netProfitBps: Number(netProfitBps.toFixed(4)),
        isNetProfitable,
        provenance: {
          grossCalculation: 'EVM_SIMULATION_OBSERVED',
          gasAssumption: `GAS_ESTIMATE_${candidate.chain.toUpperCase()}`,
          bufferStatus: buffer === 0.25 ? 'POLICY_LOCKED' : 'RESEARCH_HYPOTHETICAL',
        },
      });
    }

    // Determine limiting economic constraint
    let limitingConstraint: CandidateSensitivityEvaluation['limitingConstraint'] = 'GAS_DRAG';
    if (candidate.gasCostUsd > candidate.grossProfitUsd) {
      limitingConstraint = 'GAS_DRAG';
    } else if (candidate.dexFeeDragUsd > candidate.tradeSizeUsd * 0.01) {
      limitingConstraint = 'DEX_FEES';
    } else if (candidate.otherExecutionCostsUsd > candidate.grossProfitUsd) {
      limitingConstraint = 'PRICE_IMPACT';
    } else {
      limitingConstraint = 'RISK_BUFFER';
    }

    // Breakeven buffer: buffer where grossProfit - gasCost - otherCosts - buffer = 0
    const rawBreakeven =
      candidate.grossProfitUsd -
      candidate.gasCostUsd -
      candidate.otherExecutionCostsUsd;
    const minBufferForBreakevenUsd =
      rawBreakeven >= 0 ? Number(rawBreakeven.toFixed(6)) : null;

    return {
      candidateId: candidate.candidateId,
      routeId: candidate.routeId,
      chain: candidate.chain,
      tradeSizeUsd: candidate.tradeSizeUsd,
      testedTiers,
      minBufferForBreakevenUsd,
      profitableAtZeroBuffer,
      limitingConstraint,
    };
  }

  /**
   * Evaluates all 4 historical Phase 4.7 candidates under sensitivity analysis.
   */
  public static evaluateAllHistoricalCandidates(): CandidateSensitivityEvaluation[] {
    const historicalCandidates: HistoricalCandidateParams[] = [
      {
        candidateId: 'HIST-CAND-001',
        routeId: 'tri:arbitrum:uniswap v3-arbitrum-weth-usdc-1->uniswap v3-arbitrum-usdc-usdt-1->uniswap v3-arbitrum-weth-usdt-1',
        chain: 'arbitrum',
        blockNumber: '505839106',
        tradeSizeUsd: 1.0,
        grossProfitUsd: 0.000546,
        grossSpreadBps: 5.4649,
        dexFeeDragUsd: 0.0003, // 3 bps on $1
        dexFeeDragBps: 3.0,
        gasCostUsd: 0.0800,
        otherExecutionCostsUsd: 0.0001,
        sourceEventTimestampMs: 1789582691564,
      },
      {
        candidateId: 'HIST-CAND-002',
        routeId: 'tri:arbitrum:uniswap v3-arbitrum-weth-usdc-1->uniswap v3-arbitrum-usdc-usdt-1->uniswap v3-arbitrum-weth-usdt-1',
        chain: 'arbitrum',
        blockNumber: '505839106',
        tradeSizeUsd: 5.0,
        grossProfitUsd: 0.002085,
        grossSpreadBps: 4.1700,
        dexFeeDragUsd: 0.0015, // 3 bps on $5
        dexFeeDragBps: 3.0,
        gasCostUsd: 0.0800,
        otherExecutionCostsUsd: 0.0002,
        sourceEventTimestampMs: 1789582691564,
      },
      {
        candidateId: 'HIST-CAND-003',
        routeId: '2hop:polygon:uniswap v3-polygon-wmatic-usdc-1->uniswap v3-polygon-wmatic-usdc-5',
        chain: 'polygon',
        blockNumber: '93919709',
        tradeSizeUsd: 1.0,
        grossProfitUsd: 0.000851,
        grossSpreadBps: 8.5095,
        dexFeeDragUsd: 0.0006, // 6 bps on $1
        dexFeeDragBps: 6.0,
        gasCostUsd: 0.0010, // Polygon PoS gas is ~0.001 USD
        otherExecutionCostsUsd: 0.00005,
        sourceEventTimestampMs: 1789584634227,
      },
      {
        candidateId: 'HIST-CAND-004',
        routeId: '2hop:polygon:uniswap v3-polygon-wmatic-usdc.e-1->uniswap v3-polygon-wmatic-usdc.e-5',
        chain: 'polygon',
        blockNumber: '93919709',
        tradeSizeUsd: 1.0,
        grossProfitUsd: 0.000876,
        grossSpreadBps: 8.7589,
        dexFeeDragUsd: 0.0006, // 6 bps on $1
        dexFeeDragBps: 6.0,
        gasCostUsd: 0.0010,
        otherExecutionCostsUsd: 0.00005,
        sourceEventTimestampMs: 1789584668656,
      },
    ];

    return historicalCandidates.map((cand) => this.evaluateCandidate(cand));
  }
}
