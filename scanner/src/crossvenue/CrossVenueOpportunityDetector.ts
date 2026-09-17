/**
 * SAHIKARA Phase 4.13B — Cross-Venue Opportunity Detector
 *
 * Orchestrates multi-size, bidirectional evaluation across CEX order books and DEX quotes.
 *
 * Adheres strictly to Directives 15, 20, 39, 48, 49:
 * - Evaluates simulated notional sizes: $10, $25, $50, $100, $250, $500, $1,000, $5,000.
 * - Evaluates CEX->DEX and DEX->CEX independently.
 * - Integrates order-book VWAP with DEX executable quote.
 * - Integrates full cost breakdown, inventory allocation, transfer latency, and validation gate.
 */

import { CexOrderBook } from '../cex/CexOrderBook.js';
import { CexVwapCalculator } from '../cex/CexVwapCalculator.js';
import { CexSymbolMapper } from '../cex/CexSymbolMapper.js';
import {
  CrossVenueDirection,
  CrossVenueEconomics,
  CrossVenueEconomicResult,
} from './CrossVenueEconomics.js';
import { InventoryModel, InventoryAllocation } from './InventoryModel.js';
import { TransferCostModel } from './TransferCostModel.js';
import { CrossVenueValidator, CandidateValidationReport } from './CrossVenueValidator.js';

export interface CrossVenueEvaluation {
  pairId: string;
  cexVenue: string;
  cexSymbol: string;
  targetChainId: number;
  direction: CrossVenueDirection;
  notionalUsd: number;
  cexBestBid: number;
  cexBestAsk: number;
  cexVwapPrice: number;
  dexExecutablePrice: number;
  economics: CrossVenueEconomicResult;
  inventoryModelA: InventoryAllocation;
  inventoryModelB: InventoryAllocation;
  transferPenalty: ReturnType<typeof TransferCostModel.calculateSequentialTransferPenalty>;
  validation: CandidateValidationReport;
  dataTimestamps: {
    cexExchangeTimestamp: number | null;
    cexLocalReceiveWallClock: number;
    dexLocalReceiveWallClock: number;
  };
}

export class CrossVenueOpportunityDetector {
  public static readonly REQUIRED_NOTIONALS = [10, 25, 50, 100, 250, 500, 1000, 5000];

  /**
   * Evaluate cross-venue arbitrage across all 8 standard notional sizes.
   */
  public static evaluateMatrix(params: {
    pairId: string;
    cexVenue: 'binance' | 'coinbase' | 'kraken';
    cexSymbol: string;
    targetChainId: number;
    book: CexOrderBook;
    dexExecutableBuyPrice: number;  // Price to BUY on DEX (USDC per base token)
    dexExecutableSellPrice: number; // Price to SELL on DEX (USDC per base token)
    dexDataTimestampWallClock: number;
    dexGasUnits?: number;
    gasPriceGwei?: number;
    ethPriceUsd?: number;
    cexFeeRateBps?: number;
    riskBufferBps?: number;
  }): CrossVenueEvaluation[] {
    const {
      pairId,
      cexVenue,
      cexSymbol,
      targetChainId,
      book,
      dexExecutableBuyPrice,
      dexExecutableSellPrice,
      dexDataTimestampWallClock,
      dexGasUnits = 150000,
      gasPriceGwei = 0.05,
      ethPriceUsd = 2500,
      cexFeeRateBps = 10,
      riskBufferBps = 10,
    } = params;

    const results: CrossVenueEvaluation[] = [];
    const bestBid = book.getBestBid()?.price || 0;
    const bestAsk = book.getBestAsk()?.price || 0;
    const bookTimestamps = book.getTimestamps();
    const nowWall = Date.now();
    const cexDataAgeMs = Math.max(0, nowWall - bookTimestamps.localReceiveWallClock);
    const dexDataAgeMs = Math.max(0, nowWall - dexDataTimestampWallClock);

    const mapping = CexSymbolMapper.getMapping(cexVenue, cexSymbol);
    const assetMappingVerified = mapping !== null && mapping.verificationStatus === 'VERIFIED';

    for (const notional of this.REQUIRED_NOTIONALS) {
      // ─────────────────────────────────────────────────────────────────────────
      // Direction 1: DEX_TO_CEX (Buy on DEX, Sell on CEX)
      // ─────────────────────────────────────────────────────────────────────────
      const vwapSell = CexVwapCalculator.calculateVwapForNotional(book, 'SELL', notional);
      const isDepthSell = vwapSell.status === 'FILLED';
      const cexVwapSellPrice = vwapSell.averagePrice > 0 ? vwapSell.averagePrice : bestBid;

      const quoteParamsDexToCex = {
        direction: 'DEX_TO_CEX' as CrossVenueDirection,
        notionalUsd: notional,
        cexVwapPrice: cexVwapSellPrice,
        dexExecutablePrice: dexExecutableBuyPrice,
        cexTakerFeeRateBps: cexFeeRateBps,
        dexGasUnits,
        gasPriceGwei,
        ethPriceUsd,
        riskBufferBps,
      };

      const econDexToCex = CrossVenueEconomics.evaluate(quoteParamsDexToCex);
      const valDexToCex = CrossVenueValidator.validate(quoteParamsDexToCex, econDexToCex, {
        cexDataAgeMs,
        dexDataAgeMs,
        cexBestBid: bestBid,
        cexBestAsk: bestAsk,
        isDepthSufficient: isDepthSell,
        assetMappingVerified,
      });

      const invADexToCex = InventoryModel.evaluateInventory('MODEL_A_SEQUENTIAL_TRANSFER', notional);
      const invBDexToCex = InventoryModel.evaluateInventory('MODEL_B_PREPOSITIONED_DUAL', notional);
      const transferPenalty = TransferCostModel.calculateSequentialTransferPenalty(targetChainId, notional);

      results.push({
        pairId,
        cexVenue,
        cexSymbol,
        targetChainId,
        direction: 'DEX_TO_CEX',
        notionalUsd: notional,
        cexBestBid: bestBid,
        cexBestAsk: bestAsk,
        cexVwapPrice: cexVwapSellPrice,
        dexExecutablePrice: dexExecutableBuyPrice,
        economics: econDexToCex,
        inventoryModelA: invADexToCex,
        inventoryModelB: invBDexToCex,
        transferPenalty,
        validation: valDexToCex,
        dataTimestamps: {
          cexExchangeTimestamp: bookTimestamps.exchangeTimestamp,
          cexLocalReceiveWallClock: bookTimestamps.localReceiveWallClock,
          dexLocalReceiveWallClock: dexDataTimestampWallClock,
        },
      });

      // ─────────────────────────────────────────────────────────────────────────
      // Direction 2: CEX_TO_DEX (Buy on CEX, Sell on DEX)
      // ─────────────────────────────────────────────────────────────────────────
      const vwapBuy = CexVwapCalculator.calculateVwapForNotional(book, 'BUY', notional);
      const isDepthBuy = vwapBuy.status === 'FILLED';
      const cexVwapBuyPrice = vwapBuy.averagePrice > 0 ? vwapBuy.averagePrice : bestAsk;

      const quoteParamsCexToDex = {
        direction: 'CEX_TO_DEX' as CrossVenueDirection,
        notionalUsd: notional,
        cexVwapPrice: cexVwapBuyPrice,
        dexExecutablePrice: dexExecutableSellPrice,
        cexTakerFeeRateBps: cexFeeRateBps,
        dexGasUnits,
        gasPriceGwei,
        ethPriceUsd,
        riskBufferBps,
      };

      const econCexToDex = CrossVenueEconomics.evaluate(quoteParamsCexToDex);
      const valCexToDex = CrossVenueValidator.validate(quoteParamsCexToDex, econCexToDex, {
        cexDataAgeMs,
        dexDataAgeMs,
        cexBestBid: bestBid,
        cexBestAsk: bestAsk,
        isDepthSufficient: isDepthBuy,
        assetMappingVerified,
      });

      const invACexToDex = InventoryModel.evaluateInventory('MODEL_A_SEQUENTIAL_TRANSFER', notional);
      const invBCexToDex = InventoryModel.evaluateInventory('MODEL_B_PREPOSITIONED_DUAL', notional);

      results.push({
        pairId,
        cexVenue,
        cexSymbol,
        targetChainId,
        direction: 'CEX_TO_DEX',
        notionalUsd: notional,
        cexBestBid: bestBid,
        cexBestAsk: bestAsk,
        cexVwapPrice: cexVwapBuyPrice,
        dexExecutablePrice: dexExecutableSellPrice,
        economics: econCexToDex,
        inventoryModelA: invACexToDex,
        inventoryModelB: invBCexToDex,
        transferPenalty,
        validation: valCexToDex,
        dataTimestamps: {
          cexExchangeTimestamp: bookTimestamps.exchangeTimestamp,
          cexLocalReceiveWallClock: bookTimestamps.localReceiveWallClock,
          dexLocalReceiveWallClock: dexDataTimestampWallClock,
        },
      });
    }

    return results;
  }
}
