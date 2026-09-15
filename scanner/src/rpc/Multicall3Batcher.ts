/**
 * SAHIKARA Observer — Multicall3 Batch Reader
 *
 * Batches multiple read-only contract calls into a single RPC round trip
 * using the canonical Multicall3 contract deployed at:
 * 0xca11bde05977b3631167028862be2a173976ca11
 *
 * Metrics recorded:
 *   - totalCallsAttempted
 *   - totalBatchesExecuted
 *   - averageBatchSize
 *   - batchLatencyMs
 *   - successfulCalls
 *   - failedCalls
 */

import type { ContractCallParams } from '../data-sources/IDataSource.js';
import type { IRpcProvider } from './IRpcProvider.js';

export const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11' as const;

export interface MulticallBatchMetrics {
  totalCallsAttempted: number;
  totalBatchesExecuted: number;
  averageBatchSize: number;
  successfulCalls: number;
  failedCalls: number;
  lastBatchLatencyMs: number;
}

export interface MulticallItemResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export class Multicall3Batcher {
  private totalCallsAttempted = 0;
  private totalBatchesExecuted = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private lastBatchLatencyMs = 0;

  constructor(private readonly provider: IRpcProvider) {}

  /**
   * Execute multiple contract calls in a single batched multicall.
   * Uses allowFailure: true so a failure in one pool does not fail the entire batch.
   */
  async executeBatch<T = unknown>(
    calls: ContractCallParams[]
  ): Promise<{ results: MulticallItemResult<T>[]; latencyMs: number }> {
    if (calls.length === 0) {
      return { results: [], latencyMs: 0 };
    }

    const start = performance.now();
    this.totalCallsAttempted += calls.length;
    this.totalBatchesExecuted++;

    const client = this.provider.getPublicClient();

    try {
      // Map ContractCallParams into viem multicall contracts format
      const contracts = calls.map((c) => ({
        address: c.contractAddress,
        abi: c.abi as never,
        functionName: c.functionName,
        args: c.args as never,
      }));

      // viem multicall uses Multicall3 under the hood when available on the chain
      // allowFailure: true ensures independent error handling per call
      const rawResults = await client.multicall({
        contracts: contracts as never,
        allowFailure: true,
      });

      const latencyMs = Math.round(performance.now() - start);
      this.lastBatchLatencyMs = latencyMs;

      type MulticallContractResult =
        | { status: 'success'; result: unknown }
        | { status: 'failure'; error: unknown };

      const results: MulticallItemResult<T>[] = (
        rawResults as MulticallContractResult[]
      ).map((res) => {
        if (res.status === 'success') {
          this.successfulCalls++;
          return { success: true, data: res.result as T };
        } else {
          this.failedCalls++;
          const errMsg =
            res.error instanceof Error ? res.error.message : String(res.error);
          return { success: false, data: null, error: errMsg };
        }
      });

      return { results, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      this.lastBatchLatencyMs = latencyMs;
      this.failedCalls += calls.length;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Return failures for all items if whole multicall fails (e.g. transport error)
      const results: MulticallItemResult<T>[] = calls.map(() => ({
        success: false,
        data: null,
        error: `Multicall batch failure: ${errMsg}`,
      }));

      return { results, latencyMs };
    }
  }

  getMetrics(): MulticallBatchMetrics {
    const avgBatchSize =
      this.totalBatchesExecuted > 0
        ? Math.round((this.totalCallsAttempted / this.totalBatchesExecuted) * 10) / 10
        : 0;

    return {
      totalCallsAttempted: this.totalCallsAttempted,
      totalBatchesExecuted: this.totalBatchesExecuted,
      averageBatchSize: avgBatchSize,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      lastBatchLatencyMs: this.lastBatchLatencyMs,
    };
  }
}
