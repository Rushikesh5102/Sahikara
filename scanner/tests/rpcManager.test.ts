/**
 * SAHIKARA — RPC Provider & RpcManager Tests
 *
 * Tests for:
 *   - URL masking (security: no API keys/tokens exposed in logs or metrics)
 *   - Request routing via RpcManager
 *   - Provider failover when primary fails
 *   - Bounded retries and error reporting (no infinite loop)
 *   - Metrics aggregation (request count, error count, failovers)
 */

import { describe, it, expect } from 'vitest';
import { maskRpcUrl } from '../src/rpc/RpcProvider.js';
import { RpcManager } from '../src/rpc/RpcManager.js';
import type { IRpcProvider, RpcProviderMetrics } from '../src/rpc/IRpcProvider.js';
import type { BlockHeader, GasPriceInfo, ContractCallResult } from '../src/data-sources/IDataSource.js';

describe('RpcProvider URL Masking', () => {
  it('masks sensitive API keys in query parameters', () => {
    const raw = 'https://mainnet.base.org?key=secret_12345&foo=bar';
    const masked = maskRpcUrl(raw);
    expect(masked).toContain('key=***');
    expect(masked).not.toContain('secret_12345');
    expect(masked).toContain('foo=bar');
  });

  it('masks path-based API keys (e.g. Infura / Alchemy style)', () => {
    const raw = 'https://base-mainnet.g.alchemy.com/v2/abc1234567890def1234567890';
    const masked = maskRpcUrl(raw);
    expect(masked).not.toContain('abc1234567890def1234567890');
    expect(masked).toContain('***');
  });

  it('leaves clean standard URLs intact without credentials', () => {
    const raw = 'https://mainnet.base.org';
    const masked = maskRpcUrl(raw);
    expect(masked).toBe('https://mainnet.base.org/');
  });
});

describe('RpcManager Routing & Failover', () => {
  function makeMockProvider(
    id: string,
    options: {
      healthy?: boolean;
      blockNumber?: bigint;
      shouldFail?: boolean;
      failureError?: Error;
    } = {}
  ): IRpcProvider {
    const {
      healthy = true,
      blockNumber = 12345678n,
      shouldFail = false,
      failureError = new Error('RPC network timeout'),
    } = options;

    let isHealthyVal = healthy;
    let requestCount = 0;
    let errorCount = 0;

    const mockMetrics: RpcProviderMetrics = {
      endpointId: id,
      maskedUrl: `https://${id}.example.com`,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      rateLimitHits: 0,
      consecutiveFailures: 0,
      circuitBreakerTripped: false,
      circuitBreakerResetAt: null,
      lastLatencyMs: 20,
      latencySamples: [20],
      p50LatencyMs: 20,
      p90LatencyMs: 20,
      p99LatencyMs: 20,
    };

    return {
      id,
      maskedUrl: `https://${id}.example.com`,
      chainId: 8453,
      isHealthy: () => isHealthyVal,
      getMetrics: (): RpcProviderMetrics => {
        mockMetrics.totalRequests = requestCount;
        mockMetrics.successfulRequests = requestCount - errorCount;
        mockMetrics.failedRequests = errorCount;
        mockMetrics.consecutiveFailures = errorCount;
        return mockMetrics;
      },
      getLatestBlock: async (): Promise<{ header: BlockHeader; latencyMs: number }> => {
        requestCount++;
        if (shouldFail) {
          errorCount++;
          isHealthyVal = false;
          throw failureError;
        }
        return {
          header: {
            blockNumber,
            baseFeePerGas: 1000000n,
            timestamp: 1700000000n,
          },
          latencyMs: 15,
        };
      },
      getGasPrice: async (): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }> => {
        requestCount++;
        if (shouldFail) {
          errorCount++;
          isHealthyVal = false;
          throw failureError;
        }
        return {
          gasPrice: {
            baseFeePerGas: 1000000n,
            priorityFeePerGas: 100000n,
            gasPriceWei: 1100000n,
            gasPriceGwei: 0.0011,
          },
          latencyMs: 15,
        };
      },
      readContract: async <T>(): Promise<ContractCallResult<T>> => {
        requestCount++;
        if (shouldFail) {
          errorCount++;
          isHealthyVal = false;
          throw failureError;
        }
        return {
          data: 1000000000n as T,
          latencyMs: 15,
        };
      },
      verifyConnectivity: async (): Promise<void> => {},
      getPublicClient: () =>
        ({} as unknown as ReturnType<IRpcProvider['getPublicClient']>),
    };
  }

  it('routes calls to primary provider when healthy', async () => {
    const primary = makeMockProvider('primary', { blockNumber: 100n });
    const secondary = makeMockProvider('secondary', { blockNumber: 200n });

    const manager = new RpcManager({
      primaryProvider: primary,
      secondaryProvider: secondary,
      maxRetries: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 5,
    });
    const block = await manager.getBlockNumber();

    expect(block).toBe(100n);
    expect(manager.getActiveProvider().id).toBe('primary');
  });

  it('fails over to secondary provider when primary fails', async () => {
    const primary = makeMockProvider('primary', {
      shouldFail: true,
      failureError: new Error('Primary connection refused'),
    });
    const secondary = makeMockProvider('secondary', { blockNumber: 500n });

    const manager = new RpcManager({
      primaryProvider: primary,
      secondaryProvider: secondary,
      maxRetries: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 5,
    });
    const block = await manager.getBlockNumber();

    expect(block).toBe(500n);
    expect(manager.getActiveProvider().id).toBe('secondary');
    expect(manager.getMetrics().totalFailovers).toBe(1);
  });

  it('throws when all providers fail and does not fabricate data', async () => {
    const primary = makeMockProvider('primary', {
      shouldFail: true,
      failureError: new Error('Primary down'),
    });
    const secondary = makeMockProvider('secondary', {
      shouldFail: true,
      failureError: new Error('Secondary down'),
    });

    const manager = new RpcManager({
      primaryProvider: primary,
      secondaryProvider: secondary,
      maxRetries: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 5,
    });
    await expect(manager.getBlockNumber()).rejects.toThrow('All RPC attempts failed');
  });

  it('correctly aggregates metrics across providers', async () => {
    const primary = makeMockProvider('primary');
    const secondary = makeMockProvider('secondary');

    const manager = new RpcManager({
      primaryProvider: primary,
      secondaryProvider: secondary,
    });
    await manager.getBlockNumber();
    await manager.getGasPrice();

    const metrics = manager.getMetrics();
    expect(metrics.primaryMetrics.totalRequests).toBe(2);
    expect(metrics.secondaryMetrics?.totalRequests).toBe(0);
    expect(metrics.totalFailovers).toBe(0);
  });
});
