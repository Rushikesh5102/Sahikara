import { describe, it, expect } from 'vitest';
import { CrossVenueEconomics } from '../src/crossvenue/CrossVenueEconomics.js';

describe('Cross-Venue Economic Calculations', () => {
  it('correctly calculates DEX_TO_CEX economics with fees and gas', () => {
    // Buy on DEX at 2450, Sell on CEX at 2460 (Gross spread = +40.8 bps)
    const result = CrossVenueEconomics.evaluate({
      direction: 'DEX_TO_CEX',
      notionalUsd: 1000,
      cexVwapPrice: 2460,
      dexExecutablePrice: 2450,
      cexTakerFeeRateBps: 10,  // $1.00
      dexGasUnits: 150000,
      gasPriceGwei: 0.05,      // L2 gas
      ethPriceUsd: 2500,       // Gas = 150000 * 0.05e-9 * 2500 = $0.01875
      riskBufferBps: 10,       // $1.00
    });

    expect(result.grossSpreadBps).toBeCloseTo(((2460 - 2450) / 2450) * 10000, 2);
    expect(result.grossProfitUsd).toBeCloseTo(4.0816, 2);
    expect(result.isGrossPositive).toBe(true);

    // Friction = CexFee (10 bps) + Gas (~0.19 bps) + RiskBuffer (10 bps) = ~20.19 bps ($2.02)
    expect(result.cexFeeUsd).toBe(1.0);
    expect(result.riskBufferUsd).toBe(1.0);
    expect(result.dexGasUsd).toBeCloseTo(0.01875, 4);
    expect(result.netProfitUsd).toBeCloseTo(4.0816 - 2.01875, 2);
    expect(result.isNetPositive).toBe(true);
  });

  it('correctly calculates CEX_TO_DEX economics when negative', () => {
    // Buy on CEX at 2460, Sell on DEX at 2455 (Gross spread = -20.3 bps)
    const result = CrossVenueEconomics.evaluate({
      direction: 'CEX_TO_DEX',
      notionalUsd: 500,
      cexVwapPrice: 2460,
      dexExecutablePrice: 2455,
      cexTakerFeeRateBps: 10,
      dexGasUnits: 150000,
      gasPriceGwei: 0.05,
      ethPriceUsd: 2500,
      riskBufferBps: 10,
    });

    expect(result.grossSpreadBps).toBeCloseTo(((2455 - 2460) / 2460) * 10000, 2);
    expect(result.grossProfitUsd).toBeLessThan(0);
    expect(result.isGrossPositive).toBe(false);
    expect(result.isNetPositive).toBe(false);
    expect(result.limitingVenue).toBe('DEX');
  });

  it('proves gas drag heavily penalizes small trade sizes ($10 vs $5,000)', () => {
    const smallTrade = CrossVenueEconomics.evaluate({
      direction: 'DEX_TO_CEX',
      notionalUsd: 10,
      cexVwapPrice: 2505,
      dexExecutablePrice: 2500, // +20 bps gross
      cexTakerFeeRateBps: 10,
      dexGasUnits: 150000,
      gasPriceGwei: 0.1,        // $0.0375 gas
      ethPriceUsd: 2500,
      riskBufferBps: 10,
    });

    const largeTrade = CrossVenueEconomics.evaluate({
      direction: 'DEX_TO_CEX',
      notionalUsd: 5000,
      cexVwapPrice: 2510, // +40 bps gross
      dexExecutablePrice: 2500,
      cexTakerFeeRateBps: 10,
      dexGasUnits: 150000,
      gasPriceGwei: 0.1,
      ethPriceUsd: 2500,
      riskBufferBps: 10,
    });

    // On $10, gas of $0.0375 represents 37.5 bps drag!
    expect(smallTrade.dexGasBps).toBeCloseTo(37.5, 1);
    expect(smallTrade.isNetPositive).toBe(false); // 20 bps gross - (10 + 37.5 + 10) = -37.5 bps net

    // On $5,000, gas of $0.0375 represents only 0.075 bps drag!
    expect(largeTrade.dexGasBps).toBeCloseTo(0.075, 2);
    expect(largeTrade.isNetPositive).toBe(true); // 40 bps gross - (10 + 0.075 + 10) = +19.925 bps net
  });
});
