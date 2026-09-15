/**
 * SAHIKARA Observer — RPC Provider Interface
 *
 * Defines the contract for an individual RPC provider instance.
 * All operations are strictly read-only (eth_call / getBlock).
 * No transaction signing, no private keys, no wallet connections.
 */

import type {
  BlockHeader,
  GasPriceInfo,
  ContractCallParams,
  ContractCallResult,
} from '../data-sources/IDataSource.js';

export interface RpcProviderMetrics {
  endpointId: string;
  maskedUrl: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  rateLimitHits: number;
  consecutiveFailures: number;
  circuitBreakerTripped: boolean;
  circuitBreakerResetAt: number | null;
  lastLatencyMs: number;
  latencySamples: number[];
  p50LatencyMs: number;
  p90LatencyMs: number;
  p99LatencyMs: number;
}

export interface IRpcProvider {
  /** Identifier for logging and metrics */
  readonly id: string;
  /** Masked URL for safe logging (credentials hidden) */
  readonly maskedUrl: string;
  /** Expected chain ID */
  readonly chainId: number;

  /** Health state */
  isHealthy(): boolean;

  /** Snapshot of operational metrics */
  getMetrics(): RpcProviderMetrics;

  /** Fetch latest block header */
  getLatestBlock(): Promise<{ header: BlockHeader; latencyMs: number }>;

  /** Fetch current gas price info */
  getGasPrice(): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }>;

  /** Execute a read-only contract call (eth_call) */
  readContract<T>(params: ContractCallParams): Promise<ContractCallResult<T>>;

  /** Check connectivity and chain ID */
  verifyConnectivity(expectedChainId: number): Promise<void>;

  /** Expose underlying viem client for Multicall integration */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPublicClient(): any;
}
