/**
 * SAHIKARA — Multicall3 Batcher Tests
 *
 * Tests for:
 *   - Batching contract calls using Multicall3
 *   - Graceful handling of empty call arrays
 *   - Independent call failure handling (allowFailure: true)
 *   - Metrics tracking (batches, total calls, successes, failures, latency)
 */

import { describe, it, expect, vi } from 'vitest';
import { Multicall3Batcher } from '../src/rpc/Multicall3Batcher.js';
import type { IRpcProvider, RpcProviderMetrics } from '../src/rpc/IRpcProvider.js';

describe('Multicall3Batcher', () => {
  function makeMockProvider(
    multicallImpl: (args: unknown) => Promise<unknown>
  ): IRpcProvider {
    const mockClient = {
      multicall: vi.fn(multicallImpl),
    };

    return {
      id: 'mock-provider',
      maskedUrl: 'https://mock.example.com',
      chainId: 8453,
      isHealthy: (): boolean => true,
      getMetrics: (): RpcProviderMetrics => ({
        endpointId: 'mock-provider',
        maskedUrl: 'https://mock.example.com',
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        timeoutRequests: 0,
        rateLimitHits: 0,
        consecutiveFailures: 0,
        circuitBreakerTripped: false,
        circuitBreakerResetAt: null,
        lastLatencyMs: 0,
        latencySamples: [],
        p50LatencyMs: 0,
        p90LatencyMs: 0,
        p99LatencyMs: 0,
      }),
      getLatestBlock: async () => ({
        header: {
          blockNumber: 1n,
          baseFeePerGas: 1000000n,
          timestamp: 1000n,
        },
        latencyMs: 0,
      }),
      getGasPrice: async () => ({
        gasPrice: {
          baseFeePerGas: 1000000n,
          priorityFeePerGas: 100000n,
          gasPriceWei: 1100000n,
          gasPriceGwei: 0.0011,
        },
        latencyMs: 0,
      }),
      readContract: async <T>() => ({
        data: null as unknown as T,
        latencyMs: 0,
      }),
      verifyConnectivity: async (): Promise<void> => {},
      getPublicClient: () =>
        mockClient as unknown as ReturnType<IRpcProvider['getPublicClient']>,
    };
  }

  it('returns empty results when call array is empty without making RPC call', async () => {
    const provider = makeMockProvider(async () => []);
    const batcher = new Multicall3Batcher(provider);

    const result = await batcher.executeBatch([]);
    expect(result.results).toEqual([]);
    expect(result.latencyMs).toBe(0);
    expect(batcher.getMetrics().totalBatchesExecuted).toBe(0);
  });

  it('successfully batches multiple calls and records metrics', async () => {
    const mockResults = [
      { status: 'success', result: 1000n },
      { status: 'success', result: 2000n },
    ];
    const provider = makeMockProvider(async () => mockResults);
    const batcher = new Multicall3Batcher(provider);

    const calls = [
      {
        contractAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        abi: [],
        functionName: 'balanceOf',
        args: ['0xuser1'],
      },
      {
        contractAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
        abi: [],
        functionName: 'balanceOf',
        args: ['0xuser2'],
      },
    ];

    const { results } = await batcher.executeBatch<bigint>(calls);
    expect(results.length).toBe(2);
    expect(results[0]).toEqual({ success: true, data: 1000n });
    expect(results[1]).toEqual({ success: true, data: 2000n });

    const metrics = batcher.getMetrics();
    expect(metrics.totalBatchesExecuted).toBe(1);
    expect(metrics.totalCallsAttempted).toBe(2);
    expect(metrics.successfulCalls).toBe(2);
    expect(metrics.failedCalls).toBe(0);
  });

  it('handles partial failures gracefully without aborting entire batch', async () => {
    const mockResults = [
      { status: 'success', result: 500n },
      { status: 'failure', error: new Error('Reverted with custom error') },
    ];
    const provider = makeMockProvider(async () => mockResults);
    const batcher = new Multicall3Batcher(provider);

    const calls = [
      {
        contractAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        abi: [],
        functionName: 'getReserves',
        args: [],
      },
      {
        contractAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
        abi: [],
        functionName: 'getReserves',
        args: [],
      },
    ];

    const { results } = await batcher.executeBatch<bigint>(calls);
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[0].data).toBe(500n);
    expect(results[1].success).toBe(false);
    expect(results[1].data).toBeNull();
    expect(results[1].error).toContain('Reverted with custom error');

    const metrics = batcher.getMetrics();
    expect(metrics.successfulCalls).toBe(1);
    expect(metrics.failedCalls).toBe(1);
  });
});
