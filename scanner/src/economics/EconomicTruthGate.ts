/**
 * SAHIKARA — Phase 4.8 Economic Truth Gate
 *
 * Enforces the non-negotiable definition of economic profitability:
 *   Net Economic Profit = finalAmountOut - initialAmountIn - gasCostUsd - otherExecutionCosts - riskBufferUsd > 0
 *
 * CRITICAL INVARIANTS:
 * 1. The following are NEVER sufficient to declare an opportunity:
 *    - Price difference / pool spot price divergence
 *    - Fee-floor advantage alone
 *    - Theoretical spread without executable quote
 *    - Gross positive quote without gas subtraction
 *    - Simulated positive PnL without executable route
 *    - Historical non-reconstructed results
 * 2. Every non-observed term (gas price, asset conversion rate, risk buffer) MUST carry provenance.
 */

export interface EconomicTruthTerms {
  initialAmountRaw: bigint;
  finalAmountOutRaw: bigint;
  tokenDecimals: number;
  tradeTokenPriceUsd: number;
  gasCostUsd: number;
  otherExecutionCostsUsd: number;
  riskBufferUsd: number;
  provenance: {
    gasTokenPriceSource: string;
    tradeTokenPriceSource: string;
    gasEstimateSource: string;
    timestampMs: number;
  };
}

export interface EconomicTruthVerification {
  isEconomicallyViable: boolean;
  rawProfitAmount: bigint;
  grossProfitUsd: number;
  totalCostsUsd: number;
  netEconomicProfitUsd: number;
  netEconomicProfitBps: number;
  falsificationReasons: string[];
  provenance: EconomicTruthTerms['provenance'];
}

export class EconomicTruthGate {
  /**
   * Verifies an evaluation against the absolute Economic Truth Gate.
   */
  public static verify(terms: EconomicTruthTerms): EconomicTruthVerification {
    const falsificationReasons: string[] = [];

    // 1. Raw token output must exceed input
    const rawProfitAmount = terms.finalAmountOutRaw - terms.initialAmountRaw;
    if (rawProfitAmount <= 0n) {
      falsificationReasons.push('FINAL_AMOUNT_DOES_NOT_EXCEED_INITIAL_AMOUNT');
    }

    // 2. Convert to USD
    const scaleFactor = 10 ** terms.tokenDecimals;
    const grossProfitTokens = Number(rawProfitAmount) / scaleFactor;
    const grossProfitUsd = grossProfitTokens * terms.tradeTokenPriceUsd;

    // 3. Subtract all execution friction
    const totalCostsUsd = terms.gasCostUsd + terms.otherExecutionCostsUsd + terms.riskBufferUsd;
    const netEconomicProfitUsd = grossProfitUsd - totalCostsUsd;

    const initialAmountTokens = Number(terms.initialAmountRaw) / scaleFactor;
    const initialAmountUsd = initialAmountTokens * terms.tradeTokenPriceUsd;
    const netEconomicProfitBps =
      initialAmountUsd > 0 ? (netEconomicProfitUsd / initialAmountUsd) * 10_000 : 0;

    if (grossProfitUsd <= terms.gasCostUsd) {
      falsificationReasons.push('GROSS_PROFIT_BELOW_GAS_COST');
    }
    if (netEconomicProfitUsd <= 0) {
      falsificationReasons.push('NET_ECONOMIC_PROFIT_NON_POSITIVE');
    }
    if (terms.riskBufferUsd < 0) {
      falsificationReasons.push('NEGATIVE_RISK_BUFFER_INVALID');
    }

    const isEconomicallyViable = falsificationReasons.length === 0;

    return {
      isEconomicallyViable,
      rawProfitAmount,
      grossProfitUsd: Number(grossProfitUsd.toFixed(6)),
      totalCostsUsd: Number(totalCostsUsd.toFixed(6)),
      netEconomicProfitUsd: Number(netEconomicProfitUsd.toFixed(6)),
      netEconomicProfitBps: Number(netEconomicProfitBps.toFixed(4)),
      falsificationReasons,
      provenance: terms.provenance,
    };
  }
}
