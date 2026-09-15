/**
 * SAHIKARA Observer — Central RPC Provider Manager
 *
 * Implements IDataSource to provide seamless drop-in compatibility.
 * Features:
 *   - Provider failover (primary -> secondary)
 *   - Bounded exponential retry backoff (never retries indefinitely)
 *   - Aggregated metrics across all providers
 *   - Zero fallback to fabricated or default data
 *   - Zero signing capability (purely read-only)
 */

import type {
  IDataSource,
  BlockHeader,
  GasPriceInfo,
  ContractCallParams,
  ContractCallResult,
} from '../data-sources/IDataSource.js';
import type {
  IRpcProvider,
  RpcProviderMetrics,
} from './IRpcProvider.js';

export interface RpcManagerOptions {
  primaryProvider: IRpcProvider;
  secondaryProvider?: IRpcProvider | null;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface RpcManagerMetrics {
  primaryMetrics: RpcProviderMetrics;
  secondaryMetrics: RpcProviderMetrics | null;
  totalFailovers: number;
  activeProviderId: string;
}

export class RpcManager implements IDataSource {
  public readonly id: string;
  private readonly primary: IRpcProvider;
  private readonly secondary: IRpcProvider | null;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;

  private totalFailovers = 0;
  private activeProvider: IRpcProvider;

  constructor(options: RpcManagerOptions) {
    this.primary = options.primaryProvider;
    this.secondary = options.secondaryProvider ?? null;
    this.id = `mgr-${this.primary.id}`;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 200;
    this.maxBackoffMs = options.maxBackoffMs ?? 2000;

    this.activeProvider = this.primary;
  }

  getActiveProvider(): IRpcProvider {
    // If primary is healthy, stick with primary
    if (this.primary.isHealthy()) {
      return this.primary;
    }
    // If secondary is available and healthy, fail over
    if (this.secondary && this.secondary.isHealthy()) {
      if (this.activeProvider !== this.secondary) {
        this.totalFailovers++;
        this.activeProvider = this.secondary;
      }
      return this.secondary;
    }
    // Default back to primary (e.g. half-open probe)
    return this.primary;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute an asynchronous RPC operation with bounded retry and failover.
   * If both primary and secondary fail, throws an error.
   * NEVER returns mocked or fabricated data.
   */
  async executeWithRetry<T>(
    operationName: string,
    operation: (provider: IRpcProvider) => Promise<T>
  ): Promise<T> {
    let lastError: unknown = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const provider = this.getActiveProvider();

      try {
        const result = await operation(provider);
        return result;
      } catch (err: unknown) {
        lastError = err;
        attempt++;

        // If secondary provider exists and we just failed on primary, fail over immediately
        if (this.secondary && provider === this.primary && this.secondary.isHealthy()) {
          this.totalFailovers++;
          this.activeProvider = this.secondary;
          try {
            const secondaryResult = await operation(this.secondary);
            return secondaryResult;
          } catch (secErr: unknown) {
            lastError = secErr;
          }
        }

        if (attempt <= this.maxRetries) {
          const backoff = Math.min(
            this.initialBackoffMs * Math.pow(2, attempt - 1),
            this.maxBackoffMs
          );
          await this.sleep(backoff);
        }
      }
    }

    const errMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `[RpcManager] All RPC attempts failed for operation "${operationName}". ` +
        `Total attempts: ${attempt}. Last error: ${errMessage}`
    );
  }

  async verifyConnectivity(expectedChainId: number): Promise<void> {
    await this.primary.verifyConnectivity(expectedChainId);
    if (this.secondary) {
      try {
        await this.secondary.verifyConnectivity(expectedChainId);
      } catch {
        // Non-fatal if secondary fails initial probe, logged as degraded
      }
    }
  }

  async getLatestBlock(): Promise<{ header: BlockHeader; latencyMs: number }> {
    return this.executeWithRetry('getLatestBlock', (p) => p.getLatestBlock());
  }

  async getGasPrice(): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }> {
    return this.executeWithRetry('getGasPrice', (p) => p.getGasPrice());
  }

  async readContract<T>(params: ContractCallParams): Promise<ContractCallResult<T>> {
    return this.executeWithRetry(`readContract:${params.functionName}`, (p) =>
      p.readContract<T>(params)
    );
  }

  async getBlockNumber(): Promise<bigint> {
    const { header } = await this.getLatestBlock();
    return header.blockNumber;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getLatestBlock();
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): RpcManagerMetrics {
    return {
      primaryMetrics: this.primary.getMetrics(),
      secondaryMetrics: this.secondary ? this.secondary.getMetrics() : null,
      totalFailovers: this.totalFailovers,
      activeProviderId: this.activeProvider.id,
    };
  }
}
