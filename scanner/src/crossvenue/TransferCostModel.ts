/**
 * SAHIKARA Phase 4.13B — CEX-DEX Transfer & Settlement Cost Model
 *
 * Models physical blockchain confirmation requirements, withdrawal fees,
 * and operational transfer latencies between centralized exchanges and on-chain wallets.
 *
 * Adheres strictly to Directives 16, 18, 43, 44:
 * - Documents public deposit confirmation requirements by chain.
 * - Documents exchange withdrawal fee schedules.
 * - Confirms that sequential transfer arbitrage is NOT_ATOMIC and latency-impaired.
 */

export interface ChainTransferProfile {
  chainId: number;
  chainName: string;
  depositConfirmations: number;
  estimatedConfirmationSec: number;
  nativeWithdrawalFeeUsd: number;
  stablecoinWithdrawalFeeUsd: number;
  settlementCertainty: 'PROBABILISTIC' | 'ECONOMIC_FINALITY';
  provenance: string;
}

export class TransferCostModel {
  private static readonly PROFILES: Record<number, ChainTransferProfile> = {
    // Base (8453)
    8453: {
      chainId: 8453,
      chainName: 'Base',
      depositConfirmations: 12,
      estimatedConfirmationSec: 24, // 12 blocks * 2.0s
      nativeWithdrawalFeeUsd: 0.25, // ~0.0001 ETH [OBSERVED]
      stablecoinWithdrawalFeeUsd: 0.50, // USDC on Base [OBSERVED]
      settlementCertainty: 'PROBABILISTIC',
      provenance: '[OBSERVED_EXCHANGE_DOCUMENTATION]',
    },

    // Arbitrum One (42161)
    42161: {
      chainId: 42161,
      chainName: 'Arbitrum One',
      depositConfirmations: 64,
      estimatedConfirmationSec: 16, // 64 blocks * 0.25s
      nativeWithdrawalFeeUsd: 0.25, // ~0.0001 ETH [OBSERVED]
      stablecoinWithdrawalFeeUsd: 0.80, // USDC on Arbitrum [OBSERVED]
      settlementCertainty: 'PROBABILISTIC',
      provenance: '[OBSERVED_EXCHANGE_DOCUMENTATION]',
    },

    // Optimism (10)
    10: {
      chainId: 10,
      chainName: 'OP Mainnet',
      depositConfirmations: 12,
      estimatedConfirmationSec: 24, // 12 blocks * 2.0s
      nativeWithdrawalFeeUsd: 0.25, // ~0.0001 ETH [OBSERVED]
      stablecoinWithdrawalFeeUsd: 0.50, // USDC on OP [OBSERVED]
      settlementCertainty: 'PROBABILISTIC',
      provenance: '[OBSERVED_EXCHANGE_DOCUMENTATION]',
    },

    // Polygon PoS (137)
    137: {
      chainId: 137,
      chainName: 'Polygon PoS',
      depositConfirmations: 128,
      estimatedConfirmationSec: 256, // 128 blocks * 2.0s
      nativeWithdrawalFeeUsd: 0.10, // ~0.25 POL [OBSERVED]
      stablecoinWithdrawalFeeUsd: 1.00, // USDC/USDT on Polygon [OBSERVED]
      settlementCertainty: 'PROBABILISTIC',
      provenance: '[OBSERVED_EXCHANGE_DOCUMENTATION]',
    },
  };

  public static getProfile(chainId: number): ChainTransferProfile {
    const profile = this.PROFILES[chainId];
    if (!profile) {
      throw new Error(`[TransferCostModel] No transfer profile documented for chainId ${chainId}`);
    }
    return profile;
  }

  public static calculateSequentialTransferPenalty(
    chainId: number,
    tradeSizeUsd: number
  ): {
    atomicity: 'NOT_ATOMIC';
    latencyClassification: 'LATENCY_IMPAIRED';
    estimatedDelaySec: number;
    withdrawalFeeUsd: number;
    feeDragBps: number;
  } {
    const profile = this.getProfile(chainId);
    const withdrawalFeeUsd = profile.stablecoinWithdrawalFeeUsd;
    const feeDragBps = tradeSizeUsd > 0 ? (withdrawalFeeUsd / tradeSizeUsd) * 10000 : 0;

    return {
      atomicity: 'NOT_ATOMIC',
      latencyClassification: 'LATENCY_IMPAIRED',
      estimatedDelaySec: profile.estimatedConfirmationSec,
      withdrawalFeeUsd,
      feeDragBps,
    };
  }
}
