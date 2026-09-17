import { describe, it, expect } from 'vitest';
import { CrossVenueValidator } from '../src/crossvenue/CrossVenueValidator.js';
import { CrossVenueEconomics } from '../src/crossvenue/CrossVenueEconomics.js';

describe('Cross-Venue Validator & Signal Gate', () => {
  const baseParams = {
    direction: 'DEX_TO_CEX' as const,
    notionalUsd: 1000,
    cexVwapPrice: 2470,
    dexExecutablePrice: 2450,
    cexTakerFeeRateBps: 10,
    dexGasUnits: 150000,
    gasPriceGwei: 0.05,
    ethPriceUsd: 2500,
    riskBufferBps: 10,
  };

  it('approves legitimate positive candidate and confirms independent recalculation match', () => {
    const initialEcon = CrossVenueEconomics.evaluate(baseParams);
    const report = CrossVenueValidator.validate(baseParams, initialEcon, {
      cexDataAgeMs: 500,
      dexDataAgeMs: 800,
      cexBestBid: 2470,
      cexBestAsk: 2471,
      isDepthSufficient: true,
      assetMappingVerified: true,
    });

    expect(report.classification).toBe('REVALIDATED_NET_POSITIVE');
    expect(report.isAuthenticGross).toBe(true);
    expect(report.isAuthenticNet).toBe(true);
    expect(report.isRevalidated).toBe(true);
    expect(report.recalculationMatch).toBe(true);
  });

  it('rejects candidate when data is stale (> 30s)', () => {
    const initialEcon = CrossVenueEconomics.evaluate(baseParams);
    const report = CrossVenueValidator.validate(baseParams, initialEcon, {
      cexDataAgeMs: 35000, // 35 seconds old
      dexDataAgeMs: 500,
      cexBestBid: 2470,
      cexBestAsk: 2471,
      isDepthSufficient: true,
      assetMappingVerified: true,
    });

    expect(report.classification).toBe('FALSE_POSITIVE');
    const staleCheck = report.checks.find((c) => c.code === 'DATA_STALE');
    expect(staleCheck?.passed).toBe(false);
  });

  it('quarantines candidate when spread exceeds 1000 bps plausible boundary', () => {
    const anomalousParams = {
      ...baseParams,
      cexVwapPrice: 3000, // +2,244 bps spread
    };
    const initialEcon = CrossVenueEconomics.evaluate(anomalousParams);
    const report = CrossVenueValidator.validate(anomalousParams, initialEcon, {
      cexDataAgeMs: 500,
      dexDataAgeMs: 500,
      cexBestBid: 3000,
      cexBestAsk: 3001,
      isDepthSufficient: true,
      assetMappingVerified: true,
    });

    expect(report.classification).toBe('FALSE_POSITIVE');
    const quarantineCheck = report.checks.find((c) => c.code === 'ANOMALY_QUARANTINED');
    expect(quarantineCheck?.passed).toBe(false);
  });

  it('rejects candidate when CEX order book is inverted', () => {
    const initialEcon = CrossVenueEconomics.evaluate(baseParams);
    const report = CrossVenueValidator.validate(baseParams, initialEcon, {
      cexDataAgeMs: 500,
      dexDataAgeMs: 500,
      cexBestBid: 2475,
      cexBestAsk: 2470, // Ask lower than Bid (inverted)
      isDepthSufficient: true,
      assetMappingVerified: true,
    });

    expect(report.classification).toBe('FALSE_POSITIVE');
    const invCheck = report.checks.find((c) => c.code === 'CEX_BOOK_INVERTED');
    expect(invCheck?.passed).toBe(false);
  });
});
