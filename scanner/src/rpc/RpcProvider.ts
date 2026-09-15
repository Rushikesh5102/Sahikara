/**
 * SAHIKARA Observer — Viem-Backed Read-Only RPC Provider
 *
 * Implements IRpcProvider with:
 *   - Automatic URL credential masking for safe logging
 *   - Comprehensive latency metrics (p50, p90, p99)
 *   - Rate-limit and timeout detection
 *   - Circuit breaker with bounded cooldown
 *   - Zero signing capability (pure read-only publicClient)
 */

import { createPublicClient, http, type Chain } from 'viem';
import { base, polygon, arbitrum, optimism, mainnet } from 'viem/chains';
import type {
  IRpcProvider,
  RpcProviderMetrics,
} from './IRpcProvider.js';
import type {
  BlockHeader,
  GasPriceInfo,
  ContractCallParams,
  ContractCallResult,
} from '../data-sources/IDataSource.js';

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  8453: base,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  1: mainnet,
};

/** Mask sensitive query parameters, API keys, or basic auth tokens in URL */
export function maskRpcUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Mask path tokens (e.g., /v2/KEY -> /v2/***)
    const pathParts = url.pathname.split('/');
    if (pathParts.length > 2 && pathParts[pathParts.length - 1]!.length > 10) {
      pathParts[pathParts.length - 1] = '***';
      url.pathname = pathParts.join('/');
    }
    // Mask query params containing key/token
    for (const key of Array.from(url.searchParams.keys())) {
      if (/key|token|auth|secret/i.test(key)) {
        url.searchParams.set(key, '***');
      }
    }
    if (url.username || url.password) {
      url.username = '***';
      url.password = '***';
    }
    return url.toString();
  } catch {
    // If not a valid URL object, redact long hex/alphanumeric strings
    return rawUrl.replace(/[a-zA-Z0-9_-]{20,}/g, '***');
  }
}

function calculatePercentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sorted[lower]! * (1 - weight) + sorted[upper]! * weight);
}

export interface RpcProviderOptions {
  id: string;
  url: string;
  chainId: number;
  timeoutMs?: number;
  maxConsecutiveFailures?: number;
  circuitBreakerCooldownMs?: number;
  maxLatencySamples?: number;
}

export class RpcProvider implements IRpcProvider {
  public readonly id: string;
  public readonly maskedUrl: string;
  public readonly chainId: number;

  private readonly rawUrl: string;
  private readonly timeoutMs: number;
  private readonly maxConsecutiveFailures: number;
  private readonly circuitBreakerCooldownMs: number;
  private readonly maxLatencySamples: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: ReturnType<typeof createPublicClient<any, any>>;

  // Metrics
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private timeoutRequests = 0;
  private rateLimitHits = 0;
  private consecutiveFailures = 0;
  private circuitBreakerTripped = false;
  private circuitBreakerResetAt: number | null = null;
  private lastLatencyMs = 0;
  private readonly latencySamples: number[] = [];

  constructor(options: RpcProviderOptions) {
    this.id = options.id;
    this.rawUrl = options.url;
    this.maskedUrl = maskRpcUrl(options.url);
    this.chainId = options.chainId;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 5;
    this.circuitBreakerCooldownMs = options.circuitBreakerCooldownMs ?? 30_000;
    this.maxLatencySamples = options.maxLatencySamples ?? 100;

    const chain = SUPPORTED_CHAINS[this.chainId];
    if (!chain) {
      throw new Error(`[RpcProvider] Unsupported chain ID: ${this.chainId}`);
    }

    // createPublicClient is strictly read-only — zero wallet, zero signing
    this.client = createPublicClient({
      chain,
      transport: http(this.rawUrl, {
        timeout: this.timeoutMs,
      }),
    });
  }

  isHealthy(): boolean {
    if (!this.circuitBreakerTripped) return true;

    // Check if cooldown has elapsed (enter half-open probe state)
    if (this.circuitBreakerResetAt && Date.now() >= this.circuitBreakerResetAt) {
      return true;
    }
    return false;
  }

  getMetrics(): RpcProviderMetrics {
    return {
      endpointId: this.id,
      maskedUrl: this.maskedUrl,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      timeoutRequests: this.timeoutRequests,
      rateLimitHits: this.rateLimitHits,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerTripped: this.circuitBreakerTripped,
      circuitBreakerResetAt: this.circuitBreakerResetAt,
      lastLatencyMs: this.lastLatencyMs,
      latencySamples: [...this.latencySamples],
      p50LatencyMs: calculatePercentile(this.latencySamples, 50),
      p90LatencyMs: calculatePercentile(this.latencySamples, 90),
      p99LatencyMs: calculatePercentile(this.latencySamples, 99),
    };
  }

  private recordSuccess(latencyMs: number): void {
    this.totalRequests++;
    this.successfulRequests++;
    this.consecutiveFailures = 0;
    this.circuitBreakerTripped = false;
    this.circuitBreakerResetAt = null;
    this.lastLatencyMs = latencyMs;

    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }
  }

  private recordFailure(err: unknown): void {
    this.totalRequests++;
    this.failedRequests++;
    this.consecutiveFailures++;

    const message = err instanceof Error ? err.message : String(err);

    // Rate-limit detection
    if (/429|over rate limit|rate limit exceeded|too many requests/i.test(message)) {
      this.rateLimitHits++;
    }

    // Timeout detection
    if (/timeout|abort|etimedout/i.test(message)) {
      this.timeoutRequests++;
    }

    // Trip circuit breaker if consecutive failures exceed threshold
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerResetAt = Date.now() + this.circuitBreakerCooldownMs;
    }
  }

  async verifyConnectivity(expectedChainId: number): Promise<void> {
    const start = performance.now();
    try {
      const actualChainId = await this.client.getChainId();
      const latencyMs = Math.round(performance.now() - start);
      if (actualChainId !== expectedChainId) {
        throw new Error(
          `[RpcProvider:${this.id}] Chain ID mismatch. Expected ${expectedChainId}, got ${actualChainId}.`
        );
      }
      this.recordSuccess(latencyMs);
    } catch (err) {
      this.recordFailure(err);
      throw err;
    }
  }

  async getLatestBlock(): Promise<{ header: BlockHeader; latencyMs: number }> {
    const start = performance.now();
    try {
      const block = await this.client.getBlock({ blockTag: 'latest' });
      const latencyMs = Math.round(performance.now() - start);
      this.recordSuccess(latencyMs);
      return {
        header: {
          blockNumber: block.number,
          baseFeePerGas: block.baseFeePerGas ?? null,
          timestamp: block.timestamp,
        },
        latencyMs,
      };
    } catch (err) {
      this.recordFailure(err);
      throw err;
    }
  }

  async getGasPrice(): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }> {
    const start = performance.now();
    try {
      const block = await this.client.getBlock({ blockTag: 'latest' });
      const baseFeePerGas = block.baseFeePerGas ?? 0n;

      let priorityFeePerGas: bigint;
      try {
        priorityFeePerGas = await this.client.estimateMaxPriorityFeePerGas();
      } catch {
        priorityFeePerGas = 100_000_000n; // 0.1 gwei fallback
      }

      const latencyMs = Math.round(performance.now() - start);
      const gasPriceWei = baseFeePerGas + priorityFeePerGas;
      this.recordSuccess(latencyMs);

      return {
        gasPrice: {
          baseFeePerGas,
          priorityFeePerGas,
          gasPriceWei,
          gasPriceGwei: Number(gasPriceWei) / 1e9,
        },
        latencyMs,
      };
    } catch (err) {
      this.recordFailure(err);
      throw err;
    }
  }

  async readContract<T>(params: ContractCallParams): Promise<ContractCallResult<T>> {
    const start = performance.now();
    try {
      const data = await this.client.readContract({
        address: params.contractAddress,
        abi: params.abi as never,
        functionName: params.functionName,
        args: params.args as never,
      });
      const latencyMs = Math.round(performance.now() - start);
      this.recordSuccess(latencyMs);
      return { data: data as T, latencyMs };
    } catch (err) {
      this.recordFailure(err);
      throw err;
    }
  }

  /** Expose underlying viem client (for Multicall integration) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPublicClient(): ReturnType<typeof createPublicClient<any, any>> {
    return this.client;
  }
}
