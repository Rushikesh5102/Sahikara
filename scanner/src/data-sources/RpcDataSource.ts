/**
 * SAHIKARA Observer — JSON-RPC Data Source Implementation
 *
 * Implements IDataSource using viem's publicClient (read-only mode).
 *
 * SECURITY:
 *   Uses createPublicClient — NO wallet, NO signer, NO private key.
 *   viem's publicClient is structurally read-only.
 *
 * LATENCY MEASUREMENT:
 *   Every RPC call records wall-clock latency using performance.now().
 *   This data feeds into the observation storage for benchmarking.
 */

import { createPublicClient, http, fallback } from 'viem';
import { base } from 'viem/chains';
import type {
  IDataSource,
  BlockHeader,
  GasPriceInfo,
  ContractCallParams,
  ContractCallResult,
} from './IDataSource.js';

// ─────────────────────────────────────────────────────────────────────────────
// Base Chain ID
// ─────────────────────────────────────────────────────────────────────────────

/** [FACT] Base mainnet chain ID */
export const BASE_CHAIN_ID = 8453;

// ─────────────────────────────────────────────────────────────────────────────
// RpcDataSource
// ─────────────────────────────────────────────────────────────────────────────

export class RpcDataSource implements IDataSource {
  public readonly id: string;
  // ReturnType preserves the exact generic type returned by createPublicClient,
  // including chain-specific transaction types (e.g. Base 'deposit' tx type).
  // Using 'PublicClient' directly causes type incompatibility for getBlock().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: ReturnType<typeof createPublicClient<any, typeof base>>;

  /**
   * @param primaryRpcUrl  Primary HTTP RPC URL (from env var BASE_RPC_URL)
   * @param secondaryRpcUrl  Optional secondary RPC for fallback
   * @param endpointId     Human-readable identifier logged with observations
   *
   * SECURITY: URLs must come from environment variables — never hardcoded.
   */
  constructor(
    primaryRpcUrl: string,
    secondaryRpcUrl: string | null,
    endpointId: string
  ) {
    this.id = endpointId;

    const transports = [http(primaryRpcUrl)];
    if (secondaryRpcUrl) {
      transports.push(http(secondaryRpcUrl));
    }

    // createPublicClient = read-only viem client
    // No wallet, no signer, no account — structurally incapable of signing
    this.client = createPublicClient({
      chain: base,
      transport: transports.length > 1 ? fallback(transports) : transports[0]!,
    });
  }

  async verifyConnectivity(expectedChainId: number): Promise<void> {
    const chainId = await this.client.getChainId();
    if (chainId !== expectedChainId) {
      throw new Error(
        `[RpcDataSource] Chain ID mismatch. Expected ${expectedChainId}, got ${chainId}. ` +
          `Verify BASE_RPC_URL points to Base mainnet.`
      );
    }
  }

  async getLatestBlock(): Promise<{ header: BlockHeader; latencyMs: number }> {
    const start = performance.now();
    const block = await this.client.getBlock({ blockTag: 'latest' });
    const latencyMs = Math.round(performance.now() - start);

    return {
      header: {
        blockNumber: block.number,
        baseFeePerGas: block.baseFeePerGas ?? null,
        timestamp: block.timestamp,
      },
      latencyMs,
    };
  }

  async getGasPrice(): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }> {
    const start = performance.now();

    // Fetch base fee from latest block
    const block = await this.client.getBlock({ blockTag: 'latest' });
    const baseFeePerGas = block.baseFeePerGas ?? 0n;

    // [ASSUMPTION] Priority fee (tip): use eth_maxPriorityFeePerGas if available,
    // otherwise default to 0.1 gwei as conservative estimate for Base L2.
    // Base L2 priority fees are typically very low (0.001–0.01 gwei).
    let priorityFeePerGas: bigint;
    try {
      // viem exposes this as estimateMaxPriorityFeePerGas
      priorityFeePerGas = await this.client.estimateMaxPriorityFeePerGas();
    } catch {
      // [ASSUMPTION] Fallback: 0.1 gwei if estimation fails
      priorityFeePerGas = 100_000_000n; // 0.1 gwei in wei
    }

    const latencyMs = Math.round(performance.now() - start);
    const gasPriceWei = baseFeePerGas + priorityFeePerGas;

    return {
      gasPrice: {
        baseFeePerGas,
        priorityFeePerGas,
        gasPriceWei,
        gasPriceGwei: Number(gasPriceWei) / 1e9,
      },
      latencyMs,
    };
  }

  async readContract<T>(
    params: ContractCallParams
  ): Promise<ContractCallResult<T>> {
    const start = performance.now();

    // viem readContract uses eth_call internally — pure read, no signing
    const data = await this.client.readContract({
      address: params.contractAddress,
      abi: params.abi as never,
      functionName: params.functionName,
      args: params.args as never,
    });

    const latencyMs = Math.round(performance.now() - start);

    return { data: data as T, latencyMs };
  }
}
