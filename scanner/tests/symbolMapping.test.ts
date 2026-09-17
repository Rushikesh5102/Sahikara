import { describe, it, expect } from 'vitest';
import { CexSymbolMapper } from '../src/cex/CexSymbolMapper.js';

describe('CEX Symbol & Asset Mapper', () => {
  it('maps Binance, Coinbase, and Kraken symbols to verified canonical assets', () => {
    const binanceEth = CexSymbolMapper.getMapping('binance', 'ETHUSDC');
    expect(binanceEth).not.toBeNull();
    expect(binanceEth?.canonicalSymbol).toBe('WETH/USDC');
    expect(binanceEth?.targetChainId).toBe(8453);
    expect(binanceEth?.verificationStatus).toBe('VERIFIED');

    const coinbaseEth = CexSymbolMapper.getMapping('coinbase', 'ETH-USD');
    expect(coinbaseEth).not.toBeNull();
    expect(coinbaseEth?.canonicalSymbol).toBe('WETH/USDC');
    expect(coinbaseEth?.targetChainId).toBe(8453);

    const krakenEth = CexSymbolMapper.getMapping('kraken', 'ETHUSDC');
    expect(krakenEth).not.toBeNull();
    expect(krakenEth?.canonicalSymbol).toBe('WETH/USDC');
  });

  it('correctly distinguishes native USDC from bridged USDC.e on Arbitrum', () => {
    const nativeUsdc = CexSymbolMapper.getDexAsset('ARB:USDC');
    const bridgedUsdc = CexSymbolMapper.getDexAsset('ARB:USDC.e');

    expect(nativeUsdc).not.toBeNull();
    expect(bridgedUsdc).not.toBeNull();
    expect(nativeUsdc?.contractAddress.toLowerCase()).toBe('0xaf88d065e77c8cc2239327c5edb3a432268e5831');
    expect(bridgedUsdc?.contractAddress.toLowerCase()).toBe('0xff970a61a04b1ca14834a43f5de4533ebddb5cc8');
    expect(nativeUsdc?.tokenType).toBe('STABLECOIN');
    expect(bridgedUsdc?.tokenType).toBe('BRIDGED_STABLECOIN');
  });

  it('correctly normalizes symbol strings', () => {
    expect(CexSymbolMapper.normalizeCexSymbol('ETH-USD')).toBe('ETHUSD');
    expect(CexSymbolMapper.normalizeCexSymbol('ETH/USDT')).toBe('ETHUSDT');
    expect(CexSymbolMapper.normalizeCexSymbol('weth_usdc')).toBe('WETHUSDC');
  });
});
