/**
 * SAHIKARA — Phase 4.8 Token Safety Classifier
 *
 * Implements pre-observation security screening for potential token additions.
 * Evaluates contract characteristics to prevent toxic token pairs, fee-on-transfer (FoT) tokens,
 * honeypots, or illiquid traps from polluting the opportunity space.
 *
 * RESEARCH ONLY:
 * Under NO circumstances may classified tokens be traded with real capital.
 */

export interface TokenSafetyProfile {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  chain: string;
  hasVerifiedBytecode: boolean;
  bytecodeSizeBytes: number;
  isFeeOnTransferLikely: boolean;
  hasBlacklistFunction: boolean;
  hasMintFunction: boolean;
  liquidityUsdEstimate: number;
  suspiciousFlags: string[];
  safetyTier: 'TIER_1_CANONICAL' | 'TIER_2_VERIFIED_DEFI' | 'TIER_3_LONG_TAIL' | 'SUSPICIOUS_REJECTED';
}

export class TokenSafetyClassifier {
  /**
   * Classifies a token candidate based on contract inspection attributes and known invariants.
   */
  public static classifyToken(params: {
    tokenAddress: `0x${string}` | string;
    symbol: string;
    decimals: number;
    chain: string;
    bytecodeHex?: string;
    liquidityUsdEstimate?: number;
    knownCanonicalSymbols?: string[];
  }): TokenSafetyProfile {
    const {
      tokenAddress,
      symbol,
      decimals,
      chain,
      bytecodeHex = '0x',
      liquidityUsdEstimate = 0,
      knownCanonicalSymbols = ['WETH', 'USDC', 'USDC.E', 'USDBC', 'USDT', 'WBTC', 'CBBTC', 'ARB', 'OP', 'WMATIC', 'POL', 'AERO'],
    } = params;

    const symUpper = symbol.toUpperCase();
    const suspiciousFlags: string[] = [];
    const bytecodeClean = bytecodeHex.startsWith('0x') ? bytecodeHex.slice(2) : bytecodeHex;
    const bytecodeSizeBytes = bytecodeClean.length / 2;
    const hasVerifiedBytecode = bytecodeSizeBytes >= 50;

    // 1. Check canonical tier
    if (knownCanonicalSymbols.includes(symUpper)) {
      return {
        tokenAddress,
        symbol,
        decimals,
        chain,
        hasVerifiedBytecode: true,
        bytecodeSizeBytes: Math.max(bytecodeSizeBytes, 500),
        isFeeOnTransferLikely: false,
        hasBlacklistFunction: symUpper === 'USDC' || symUpper === 'USDT', // Stablecoins do have freeze/blacklist
        hasMintFunction: false,
        liquidityUsdEstimate: Math.max(liquidityUsdEstimate, 1_000_000),
        suspiciousFlags: [],
        safetyTier: 'TIER_1_CANONICAL',
      };
    }

    // 2. Bytecode inspection
    if (!hasVerifiedBytecode) {
      suspiciousFlags.push('EMPTY_OR_TRIVIAL_BYTECODE');
    }

    // 3. Decimals sanity check
    if (decimals < 2 || decimals > 18) {
      suspiciousFlags.push(`ANOMALOUS_DECIMALS_${decimals}`);
    }

    // 4. Heuristic signature check in bytecode (e.g. blacklist, fee, reflect)
    // 0x93308e67: blacklist(address) or similar selector heuristics
    const lowerBytecode = bytecodeClean.toLowerCase();
    const hasBlacklistFunction = lowerBytecode.includes('40e58ee2') || lowerBytecode.includes('93308e67');
    const isFeeOnTransferLikely = lowerBytecode.includes('fee') || lowerBytecode.includes('tax');
    const hasMintFunction = lowerBytecode.includes('40c10f19'); // mint(address,uint256)

    if (hasBlacklistFunction) {
      suspiciousFlags.push('CONTAINS_BLACKLIST_RESTRICTION');
    }
    if (isFeeOnTransferLikely) {
      suspiciousFlags.push('POTENTIAL_FEE_ON_TRANSFER');
    }

    // 5. Liquidity sanity
    if (liquidityUsdEstimate < 10_000) {
      suspiciousFlags.push('SHALLOW_LIQUIDITY_DEPTH_UNDER_10K');
    }

    let safetyTier: TokenSafetyProfile['safetyTier'] = 'TIER_3_LONG_TAIL';
    if (suspiciousFlags.length >= 2 || !hasVerifiedBytecode) {
      safetyTier = 'SUSPICIOUS_REJECTED';
    } else if (suspiciousFlags.length === 0 && liquidityUsdEstimate >= 100_000) {
      safetyTier = 'TIER_2_VERIFIED_DEFI';
    }

    return {
      tokenAddress,
      symbol,
      decimals,
      chain,
      hasVerifiedBytecode,
      bytecodeSizeBytes,
      isFeeOnTransferLikely,
      hasBlacklistFunction,
      hasMintFunction,
      liquidityUsdEstimate,
      suspiciousFlags,
      safetyTier,
    };
  }
}
