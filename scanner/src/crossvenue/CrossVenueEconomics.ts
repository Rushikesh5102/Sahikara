/**
 * SAHIKARA Phase 4.13B — Cross-Venue Economic Accounting Engine
 *
 * Implements rigorous, bidirectional cost and profit modeling for CEX-DEX arbitrage.
 *
 * Adheres strictly to Directives 16, 42, 48, 56:
 * - Directional independence: CEX->DEX and DEX->CEX evaluated separately.
 * - Comprehensive friction modeling: CEX taker fees, DEX pool fees, DEX price impact,
 *   blockchain gas costs, and operational risk buffer.
 * - Zero double counting: DEX executable quote already incorporates pool fee & impact;
 *   CEX order-book VWAP already incorporates CLOB spread & depth.
 * - Every metric includes an explicit provenance tag.
 */

export type CrossVenueDirection = 'CEX_TO_DEX' | 'DEX_TO_CEX';

export interface CrossVenueQuoteParams {
  direction: CrossVenueDirection;
  notionalUsd: number;
  cexVwapPrice: number;       // Execution price from CEX VWAP calculator
  dexExecutablePrice: number;  // Execution price from DEX adapter quote (output/input)
  cexTakerFeeRateBps: number;  // e.g. 10 bps (standard) or 5 bps (VIP tier)
  dexGasUnits: number;         // e.g. 150,000 units
  gasPriceGwei: number;        // e.g. 0.05 gwei on L2, 15 gwei on Polygon
  ethPriceUsd: number;         // For gas valuation
  riskBufferBps: number;       // Operational risk margin (default 10 bps)
}

export interface CrossVenueEconomicResult {
  direction: CrossVenueDirection;
  notionalUsd: number;
  cexVwapPrice: number;
  dexExecutablePrice: number;

  // Gross metrics
  grossSpreadBps: number;
  grossProfitUsd: number;
  isGrossPositive: boolean;

  // Cost breakdowns with provenance
  cexFeeUsd: number;
  cexFeeBps: number;
  cexFeeProvenance: string;

  dexGasUsd: number;
  dexGasBps: number;
  dexGasProvenance: string;

  riskBufferUsd: number;
  riskBufferBps: number;
  riskBufferProvenance: string;

  totalFrictionUsd: number;
  totalFrictionBps: number;

  // Net metrics
  netProfitUsd: number;
  netSpreadBps: number;
  isNetPositive: boolean;

  // Limiting factors
  limitingVenue: 'CEX' | 'DEX' | 'NONE';
}

export class CrossVenueEconomics {
  public static evaluate(params: CrossVenueQuoteParams): CrossVenueEconomicResult {
    const {
      direction,
      notionalUsd,
      cexVwapPrice,
      dexExecutablePrice,
      cexTakerFeeRateBps,
      dexGasUnits,
      gasPriceGwei,
      ethPriceUsd,
      riskBufferBps,
    } = params;

    if (notionalUsd <= 0) {
      throw new Error(`[CrossVenueEconomics] notionalUsd must be positive, got ${notionalUsd}`);
    }
    if (cexVwapPrice <= 0 || dexExecutablePrice <= 0) {
      throw new Error(
        `[CrossVenueEconomics] Invalid prices: cex=${cexVwapPrice}, dex=${dexExecutablePrice}`
      );
    }

    let grossSpreadBps = 0;
    let grossProfitUsd = 0;

    if (direction === 'DEX_TO_CEX') {
      // Buy on DEX, Sell on CEX
      // DEX buy price: dexExecutablePrice (USD paid per base token)
      // CEX sell price: cexVwapPrice (USD received per base token)
      grossSpreadBps = ((cexVwapPrice - dexExecutablePrice) / dexExecutablePrice) * 10000;
      grossProfitUsd = (grossSpreadBps / 10000) * notionalUsd;
    } else {
      // Buy on CEX, Sell on DEX
      // CEX buy price: cexVwapPrice (USD paid per base token)
      // DEX sell price: dexExecutablePrice (USD received per base token)
      grossSpreadBps = ((dexExecutablePrice - cexVwapPrice) / cexVwapPrice) * 10000;
      grossProfitUsd = (grossSpreadBps / 10000) * notionalUsd;
    }

    // Cost Breakdown
    // 1. CEX Taker Fee: applies to the CEX leg
    const cexFeeBps = cexTakerFeeRateBps;
    const cexFeeUsd = (cexFeeBps / 10000) * notionalUsd;
    const cexFeeProvenance = '[OBSERVED_FEE_SCHEDULE]';

    // 2. DEX On-Chain Gas Cost
    const gasPriceEth = (gasPriceGwei * 1e9) / 1e18;
    const dexGasEth = dexGasUnits * gasPriceEth;
    const dexGasUsd = dexGasEth * ethPriceUsd;
    const dexGasBps = notionalUsd > 0 ? (dexGasUsd / notionalUsd) * 10000 : 0;
    const dexGasProvenance = '[QUOTED_GAS_PARAMS]';

    // 3. Operational Risk Buffer
    const riskBufferUsd = (riskBufferBps / 10000) * notionalUsd;
    const riskBufferProvenance = '[ASSUMPTION_POLICY]';

    // Total Friction
    const totalFrictionUsd = cexFeeUsd + dexGasUsd + riskBufferUsd;
    const totalFrictionBps = cexFeeBps + dexGasBps + riskBufferBps;

    // Net Result
    const netProfitUsd = grossProfitUsd - totalFrictionUsd;
    const netSpreadBps = grossSpreadBps - totalFrictionBps;

    const isGrossPositive = grossProfitUsd > 0;
    const isNetPositive = netProfitUsd > 0;

    let limitingVenue: 'CEX' | 'DEX' | 'NONE' = 'NONE';
    if (!isGrossPositive) {
      if (direction === 'DEX_TO_CEX') {
        limitingVenue = cexVwapPrice < dexExecutablePrice ? 'CEX' : 'DEX';
      } else {
        limitingVenue = dexExecutablePrice < cexVwapPrice ? 'DEX' : 'CEX';
      }
    }

    return {
      direction,
      notionalUsd,
      cexVwapPrice,
      dexExecutablePrice,
      grossSpreadBps,
      grossProfitUsd,
      isGrossPositive,
      cexFeeUsd,
      cexFeeBps,
      cexFeeProvenance,
      dexGasUsd,
      dexGasBps,
      dexGasProvenance,
      riskBufferUsd,
      riskBufferBps,
      riskBufferProvenance,
      totalFrictionUsd,
      totalFrictionBps,
      netProfitUsd,
      netSpreadBps,
      isNetPositive,
      limitingVenue,
    };
  }
}
