/**
 * SAHIKARA Phase 4.13B — Cross-Venue Candidate Validator & Forensic Gate
 *
 * Implements strict, independent secondary validation for all candidate opportunities.
 *
 * Adheres strictly to Directives 27, 28, 29, 52:
 * - Independent recalculation path catching inverted tokens, decimal bugs, and flipped operands.
 * - Enforces order-book depth verification (no extrapolation).
 * - Flags stale market data (> 30s) as invalid.
 * - Flags spread anomalies (> 1000 bps) as ANOMALY_QUARANTINED per Phase 4.13A patch.
 * - Categorizes signals: FALSE_POSITIVE, THEORETICAL_ONLY, AUTHENTIC_GROSS_POSITIVE,
 *   AUTHENTIC_NET_POSITIVE, or REVALIDATED_NET_POSITIVE.
 */

import { CrossVenueEconomicResult, CrossVenueQuoteParams } from './CrossVenueEconomics.js';

export type CandidateClassification =
  | 'FALSE_POSITIVE'
  | 'THEORETICAL_ONLY'
  | 'AUTHENTIC_GROSS_POSITIVE'
  | 'AUTHENTIC_NET_POSITIVE'
  | 'REVALIDATED_NET_POSITIVE';

export interface ValidationCheckResult {
  passed: boolean;
  code: string;
  detail: string;
}

export interface CandidateValidationReport {
  classification: CandidateClassification;
  isAuthenticGross: boolean;
  isAuthenticNet: boolean;
  isRevalidated: boolean;
  recalculatedGrossBps: number;
  recalculatedNetBps: number;
  recalculationMatch: boolean;
  checks: ValidationCheckResult[];
}

export class CrossVenueValidator {
  private static readonly MAX_CREDIBLE_SPREAD_BPS = 1000; // Signals > 1000 bps are quarantined anomalies
  private static readonly MAX_DATA_AGE_MS = 30000;         // Data older than 30s is rejected

  public static validate(
    params: CrossVenueQuoteParams,
    initialResult: CrossVenueEconomicResult,
    metadata: {
      cexDataAgeMs: number;
      dexDataAgeMs: number;
      cexBestBid: number;
      cexBestAsk: number;
      isDepthSufficient: boolean;
      assetMappingVerified: boolean;
    }
  ): CandidateValidationReport {
    const checks: ValidationCheckResult[] = [];

    // 1. Asset Mapping Check
    if (!metadata.assetMappingVerified) {
      checks.push({
        passed: false,
        code: 'ASSET_MAPPING_UNVERIFIED',
        detail: 'CEX symbol is not canonically mapped to on-chain token addresses.',
      });
    } else {
      checks.push({ passed: true, code: 'ASSET_MAPPING_VERIFIED', detail: 'Canonical mapping verified.' });
    }

    // 2. Data Staleness Check
    if (metadata.cexDataAgeMs > this.MAX_DATA_AGE_MS || metadata.dexDataAgeMs > this.MAX_DATA_AGE_MS) {
      checks.push({
        passed: false,
        code: 'DATA_STALE',
        detail: `Data exceeds max age: cexAge=${metadata.cexDataAgeMs}ms, dexAge=${metadata.dexDataAgeMs}ms`,
      });
    } else {
      checks.push({ passed: true, code: 'DATA_FRESH', detail: 'Data timestamps within tolerance.' });
    }

    // 3. Order Book Integrity Check
    if (metadata.cexBestAsk <= metadata.cexBestBid) {
      checks.push({
        passed: false,
        code: 'CEX_BOOK_INVERTED',
        detail: `Best ask (${metadata.cexBestAsk}) <= best bid (${metadata.cexBestBid}).`,
      });
    } else {
      checks.push({ passed: true, code: 'CEX_BOOK_VALID', detail: 'Order book bid/ask order valid.' });
    }

    // 4. Depth Verification Check
    if (!metadata.isDepthSufficient) {
      checks.push({
        passed: false,
        code: 'INSUFFICIENT_ORDER_BOOK_DEPTH',
        detail: 'Requested trade size exceeds available order-book depth without extrapolation.',
      });
    } else {
      checks.push({ passed: true, code: 'DEPTH_SUFFICIENT', detail: 'Sufficient depth confirmed.' });
    }

    // 5. Anomaly Quarantine Check (> 1000 bps)
    if (Math.abs(initialResult.grossSpreadBps) > this.MAX_CREDIBLE_SPREAD_BPS) {
      checks.push({
        passed: false,
        code: 'ANOMALY_QUARANTINED',
        detail: `Gross spread (${initialResult.grossSpreadBps.toFixed(2)} bps) exceeds plausible limit (1000 bps). Likely decimal or unit inversion.`,
      });
    } else {
      checks.push({ passed: true, code: 'SPREAD_WITHIN_CREDIBLE_BOUNDS', detail: 'Spread within bounds.' });
    }

    // 6. Independent Recalculation Gate
    const recalculatedGrossBps = this.independentRecalculateGrossSpread(
      params.direction,
      params.cexVwapPrice,
      params.dexExecutablePrice
    );

    const recalculatedNetBps = this.independentRecalculateNetSpread(
      recalculatedGrossBps,
      params.notionalUsd,
      params.cexTakerFeeRateBps,
      params.dexGasUnits,
      params.gasPriceGwei,
      params.ethPriceUsd,
      params.riskBufferBps
    );

    const grossDelta = Math.abs(recalculatedGrossBps - initialResult.grossSpreadBps);
    const netDelta = Math.abs(recalculatedNetBps - initialResult.netSpreadBps);
    const recalculationMatch = grossDelta < 0.0001 && netDelta < 0.0001;

    if (!recalculationMatch) {
      checks.push({
        passed: false,
        code: 'RECALCULATION_MISMATCH',
        detail: `Independent recalculation diverged: grossDelta=${grossDelta}, netDelta=${netDelta}`,
      });
    } else {
      checks.push({ passed: true, code: 'RECALCULATION_VERIFIED', detail: 'Independent math verified 100%.' });
    }

    const allPassed = checks.every((c) => c.passed);
    const isAuthenticGross = allPassed && recalculatedGrossBps > 0;
    const isAuthenticNet = allPassed && recalculatedNetBps > 0;
    const isRevalidated = isAuthenticNet && recalculationMatch;

    let classification: CandidateClassification = 'FALSE_POSITIVE';
    if (!allPassed) {
      classification = 'FALSE_POSITIVE';
    } else if (isRevalidated) {
      classification = 'REVALIDATED_NET_POSITIVE';
    } else if (isAuthenticNet) {
      classification = 'AUTHENTIC_NET_POSITIVE';
    } else if (isAuthenticGross) {
      classification = 'AUTHENTIC_GROSS_POSITIVE';
    } else {
      classification = 'THEORETICAL_ONLY';
    }

    return {
      classification,
      isAuthenticGross,
      isAuthenticNet,
      isRevalidated,
      recalculatedGrossBps,
      recalculatedNetBps,
      recalculationMatch,
      checks,
    };
  }

  private static independentRecalculateGrossSpread(
    direction: 'CEX_TO_DEX' | 'DEX_TO_CEX',
    cexPrice: number,
    dexPrice: number
  ): number {
    if (direction === 'DEX_TO_CEX') {
      return ((cexPrice - dexPrice) / dexPrice) * 10000;
    } else {
      return ((dexPrice - cexPrice) / cexPrice) * 10000;
    }
  }

  private static independentRecalculateNetSpread(
    grossBps: number,
    notionalUsd: number,
    cexFeeBps: number,
    gasUnits: number,
    gasPriceGwei: number,
    ethPriceUsd: number,
    riskBufferBps: number
  ): number {
    const gasUsd = (gasUnits * ((gasPriceGwei * 1e9) / 1e18)) * ethPriceUsd;
    const gasBps = (gasUsd / notionalUsd) * 10000;
    const totalFrictionBps = cexFeeBps + gasBps + riskBufferBps;
    return grossBps - totalFrictionBps;
  }
}
