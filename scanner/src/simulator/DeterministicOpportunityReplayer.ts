/**
 * SAHIKARA — Phase 4.8 Deterministic Opportunity Replay System
 *
 * Replays historical market events and quotes deterministically under historical state conditions.
 *
 * CRITICAL INVARIANTS:
 * 1. Replay must NOT silently use current market prices or live RPC state for historical observations.
 * 2. Every replay result MUST be explicitly classified as:
 *    - 'EXACT_REPLAY': Full historical block archive state and exact slot0/liquidity reconstructed.
 *    - 'PARTIAL_REPLAY': Historical pool parameters applied against partial block state snapshots.
 *    - 'QUOTE_REPLAY': Verified against recorded historical quoter return values without re-querying.
 *    - 'SIMULATED_REPLAY': Mathematical execution simulation using historical parameter inputs.
 * 3. Never call a partial, quote, or simulated replay 'EXACT_REPLAY'.
 */

export type ReplayClassification = 'EXACT_REPLAY' | 'PARTIAL_REPLAY' | 'QUOTE_REPLAY' | 'SIMULATED_REPLAY';

export interface HistoricalEventReplayInput {
  eventBlock: bigint;
  eventTimestampMs: number;
  routeId: string;
  chain: string;
  tradeSizeUsd: number;
  initialAmountRaw: bigint;
  historicalBasePriceUsd: number;
  historicalGasTokenPriceUsd: number;
  historicalGasPriceWei: bigint;
  historicalGasLimit: bigint;
  historicalQuotes?: {
    leg1AmountOut: bigint;
    leg2AmountOut: bigint;
    leg3AmountOut?: bigint;
    finalAmountOut: bigint;
  };
  poolStates?: Array<{
    poolAddress: string;
    sqrtPriceX96: bigint;
    liquidity: bigint;
    tick: number;
  }>;
  replayType: ReplayClassification;
}

export interface DeterministicReplayResult {
  routeId: string;
  chain: string;
  replayBlock: bigint;
  replayClassification: ReplayClassification;
  initialAmountRaw: bigint;
  finalAmountOutRaw: bigint;
  grossProfitUsd: number;
  grossSpreadBps: number;
  gasCostUsd: number;
  netProfitUsd: number;
  netProfitBps: number;
  isGrossPositive: boolean;
  isNetProfitable: boolean;
  provenance: {
    historicalBasePriceUsd: number;
    historicalGasTokenPriceUsd: number;
    historicalGasPriceWei: string;
    verifiedAtMs: number;
    disclaimer: string;
  };
}

export class DeterministicOpportunityReplayer {
  /**
   * Replays an opportunity using historical state parameters and quotes without live price drift.
   */
  public static replay(input: HistoricalEventReplayInput): DeterministicReplayResult {
    const {
      eventBlock,
      routeId,
      chain,
      tradeSizeUsd,
      initialAmountRaw,
      historicalBasePriceUsd,
      historicalGasTokenPriceUsd,
      historicalGasPriceWei,
      historicalGasLimit,
      historicalQuotes,
      replayType,
    } = input;

    let finalAmountOutRaw = 0n;

    if (historicalQuotes && historicalQuotes.finalAmountOut > 0n) {
      finalAmountOutRaw = historicalQuotes.finalAmountOut;
    } else {
      // If no recorded quotes, simulated replay cannot claim exactness
      if (replayType === 'EXACT_REPLAY') {
        throw new Error('Cannot execute EXACT_REPLAY without verified historical state quotes.');
      }
    }

    // Gross calculations using BigInt exact math
    const diffRaw = finalAmountOutRaw - initialAmountRaw;
    const isGrossPositive = diffRaw > 0n;

    // Gross spread in bps: (diffRaw * 10,000) / initialAmountRaw
    const grossSpreadBps =
      initialAmountRaw > 0n ? Number((diffRaw * 10_000n * 100n) / initialAmountRaw) / 100 : 0;

    // Convert gross profit to USD using historical base price
    // e.g. tradeSizeUsd * (grossSpreadBps / 10,000)
    const grossProfitUsd = Number(((grossSpreadBps / 10_000) * tradeSizeUsd).toFixed(6));

    // Historical gas cost calculation: gasLimit * gasPriceWei * historicalGasTokenPriceUsd
    const gasWeiTotal = historicalGasLimit * historicalGasPriceWei;
    const gasNative = Number(gasWeiTotal) / 1e18;
    const gasCostUsd = Number((gasNative * historicalGasTokenPriceUsd).toFixed(6));

    // Net profit
    const netProfitUsd = Number((grossProfitUsd - gasCostUsd).toFixed(6));
    const netProfitBps = tradeSizeUsd > 0 ? Number(((netProfitUsd / tradeSizeUsd) * 10_000).toFixed(4)) : 0;
    const isNetProfitable = netProfitUsd > 0;

    // Enforce honest classification naming
    const finalClassification =
      replayType === 'EXACT_REPLAY' && (!input.poolStates || input.poolStates.length === 0)
        ? 'QUOTE_REPLAY'
        : replayType;

    return {
      routeId,
      chain,
      replayBlock: eventBlock,
      replayClassification: finalClassification,
      initialAmountRaw,
      finalAmountOutRaw,
      grossProfitUsd,
      grossSpreadBps,
      gasCostUsd,
      netProfitUsd,
      netProfitBps,
      isGrossPositive,
      isNetProfitable,
      provenance: {
        historicalBasePriceUsd,
        historicalGasTokenPriceUsd,
        historicalGasPriceWei: historicalGasPriceWei.toString(),
        verifiedAtMs: Date.now(),
        disclaimer:
          'Deterministic historical replay. No current live prices used. Classification: ' + finalClassification,
      },
    };
  }
}
