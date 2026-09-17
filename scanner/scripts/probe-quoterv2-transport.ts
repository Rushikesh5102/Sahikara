/**
 * SAHIKARA Phase 4.15 — Bounded QuoterV2 Transport Probe (HTTP vs WebSocket)
 *
 * MISSION:
 *   Execute a controlled, bounded comparison of 3 HTTP and 3 WebSocket QuoterV2 calls on Base.
 *   Enforces strict per-request timeouts (5,000 ms), explicit socket termination, and
 *   complete failure taxonomy classification.
 *
 * SAFETY INVARIANTS:
 *   - Strictly read-only calls.
 *   - Zero wallets, zero keys, zero signers, zero live trading.
 *   - Capital at risk: ₹0.00 / $0.00.
 *   - Phase 5 strictly BLOCKED.
 */

import { encodeFunctionData, decodeFunctionResult } from 'viem';

// QuoterV2 Minimal ABI
const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

export type TransportType = 'HTTP' | 'WEBSOCKET';
export type ErrorCategory = 'SUCCESS' | 'TIMEOUT' | 'RPC_ERROR' | 'CONNECTION_ERROR' | 'RATE_LIMITED';

export interface ProbeMeasurement {
  transport: TransportType;
  requestNumber: number;
  startWallClockIso: string;
  endWallClockIso: string;
  startMonotonicMs: number;
  endMonotonicMs: number;
  elapsedMonotonicMs: number;
  success: boolean;
  errorCategory: ErrorCategory;
  errorMessage: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  amountOut: string | null;
}

const BASE_WETH = '0x4200000000000000000000000000000000000006' as const;
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const BASE_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;
const HTTP_ENDPOINT = 'https://mainnet.base.org';
const WS_ENDPOINT = 'wss://base-rpc.publicnode.com';
const TIMEOUT_MS = 5000;

function classifyError(err: unknown): { category: ErrorCategory; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('timed out')) {
    return { category: 'TIMEOUT', message: msg };
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('over rate') || lower.includes('exceeded limit')) {
    return { category: 'RATE_LIMITED', message: msg };
  }
  if (lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('fetch failed') || lower.includes('websocket closed') || lower.includes('connection error')) {
    return { category: 'CONNECTION_ERROR', message: msg };
  }
  return { category: 'RPC_ERROR', message: msg };
}

async function executeHttpQuote(reqNum: number): Promise<ProbeMeasurement> {
  const callData = encodeFunctionData({
    abi: QUOTER_V2_ABI,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: BASE_WETH,
        tokenOut: BASE_USDC,
        amountIn: 1000000000000000000n, // 1 WETH
        fee: 500,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const startMonotonicMs = performance.now();
  const startWallClockIso = new Date().toISOString();

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(new Error(`HTTP request timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);

  try {
    // 1. QuoterV2 eth_call
    const res = await fetch(HTTP_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: reqNum,
        method: 'eth_call',
        params: [{ to: BASE_QUOTER, data: callData }, 'latest'],
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new Error(`HTTP 429: Too Many Requests`);
    }

    const payload = (await res.json()) as { error?: { message: string; code?: number }; result?: `0x${string}` };
    if (payload.error) {
      throw new Error(`RPC Error [${payload.error.code}]: ${payload.error.message}`);
    }
    if (!payload.result) {
      throw new Error(`RPC returned empty result for eth_call`);
    }

    const decoded = decodeFunctionResult({
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      data: payload.result,
    }) as [bigint, bigint, number, bigint];

    const amountOut = (Number(decoded[0]) / 1e6).toFixed(6); // USDC has 6 decimals

    // 2. Fetch latest block header for blockNumber and blockHash
    const blockRes = await fetch(HTTP_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: reqNum + 100,
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      }),
      signal: controller.signal,
    });
    const blockData = (await blockRes.json()) as { result?: { number: string; hash: string } };
    const blockNumber = blockData.result?.number ? parseInt(blockData.result.number, 16) : null;
    const blockHash = blockData.result?.hash || null;

    clearTimeout(timeoutTimer);
    const endMonotonicMs = performance.now();
    const endWallClockIso = new Date().toISOString();

    return {
      transport: 'HTTP',
      requestNumber: reqNum,
      startWallClockIso,
      endWallClockIso,
      startMonotonicMs: Number(startMonotonicMs.toFixed(2)),
      endMonotonicMs: Number(endMonotonicMs.toFixed(2)),
      elapsedMonotonicMs: Number((endMonotonicMs - startMonotonicMs).toFixed(2)),
      success: true,
      errorCategory: 'SUCCESS',
      errorMessage: null,
      blockNumber,
      blockHash,
      amountOut,
    };
  } catch (err) {
    clearTimeout(timeoutTimer);
    const endMonotonicMs = performance.now();
    const endWallClockIso = new Date().toISOString();
    const { category, message } = classifyError(err);

    return {
      transport: 'HTTP',
      requestNumber: reqNum,
      startWallClockIso,
      endWallClockIso,
      startMonotonicMs: Number(startMonotonicMs.toFixed(2)),
      endMonotonicMs: Number(endMonotonicMs.toFixed(2)),
      elapsedMonotonicMs: Number((endMonotonicMs - startMonotonicMs).toFixed(2)),
      success: false,
      errorCategory: category,
      errorMessage: message,
      blockNumber: null,
      blockHash: null,
      amountOut: null,
    };
  }
}

class BoundedWebSocketRpcClient {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }>();
  private nextId = 1;

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.ws) {
          try { this.ws.close(); } catch { /* ignore */ }
        }
        reject(new Error(`WebSocket connection to ${WS_ENDPOINT} timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      try {
        this.ws = new WebSocket(WS_ENDPOINT);
        this.ws.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const raw = typeof event.data === 'string' ? event.data : event.data.toString();
            const parsed = JSON.parse(raw) as { id?: number; result?: unknown; error?: { message: string; code?: number } };
            if (parsed.id && this.pendingRequests.has(parsed.id)) {
              const pending = this.pendingRequests.get(parsed.id)!;
              clearTimeout(pending.timer);
              this.pendingRequests.delete(parsed.id);
              if (parsed.error) {
                pending.reject(new Error(`RPC Error [${parsed.error.code}]: ${parsed.error.message}`));
              } else {
                pending.resolve(parsed.result);
              }
            }
          } catch (e) {
            // malformed
          }
        };
        this.ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error(`WebSocket connection error on ${WS_ENDPOINT}`));
        };
        this.ws.onclose = () => {
          // Reject all remaining pending
          for (const [id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`WebSocket closed unexpectedly while request ${id} was pending`));
          }
          this.pendingRequests.clear();
        };
      } catch (e) {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  public async call(method: string, params: unknown[]): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket is not connected (readyState=${this.ws?.readyState})`);
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`WebSocket request ${id} (${method}) timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  public close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}

async function executeWsQuote(wsClient: BoundedWebSocketRpcClient, reqNum: number): Promise<ProbeMeasurement> {
  const callData = encodeFunctionData({
    abi: QUOTER_V2_ABI,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: BASE_WETH,
        tokenOut: BASE_USDC,
        amountIn: 1000000000000000000n, // 1 WETH
        fee: 500,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const startMonotonicMs = performance.now();
  const startWallClockIso = new Date().toISOString();

  try {
    // 1. QuoterV2 eth_call
    const resultHex = (await wsClient.call('eth_call', [{ to: BASE_QUOTER, data: callData }, 'latest'])) as `0x${string}`;
    if (!resultHex) {
      throw new Error(`Empty result returned for WS eth_call`);
    }

    const decoded = decodeFunctionResult({
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      data: resultHex,
    }) as [bigint, bigint, number, bigint];

    const amountOut = (Number(decoded[0]) / 1e6).toFixed(6);

    // 2. Latest block header for blockNumber and blockHash
    const blockData = (await wsClient.call('eth_getBlockByNumber', ['latest', false])) as { number?: string; hash?: string };
    const blockNumber = blockData?.number ? parseInt(blockData.number, 16) : null;
    const blockHash = blockData?.hash || null;

    const endMonotonicMs = performance.now();
    const endWallClockIso = new Date().toISOString();

    return {
      transport: 'WEBSOCKET',
      requestNumber: reqNum,
      startWallClockIso,
      endWallClockIso,
      startMonotonicMs: Number(startMonotonicMs.toFixed(2)),
      endMonotonicMs: Number(endMonotonicMs.toFixed(2)),
      elapsedMonotonicMs: Number((endMonotonicMs - startMonotonicMs).toFixed(2)),
      success: true,
      errorCategory: 'SUCCESS',
      errorMessage: null,
      blockNumber,
      blockHash,
      amountOut,
    };
  } catch (err) {
    const endMonotonicMs = performance.now();
    const endWallClockIso = new Date().toISOString();
    const { category, message } = classifyError(err);

    return {
      transport: 'WEBSOCKET',
      requestNumber: reqNum,
      startWallClockIso,
      endWallClockIso,
      startMonotonicMs: Number(startMonotonicMs.toFixed(2)),
      endMonotonicMs: Number(endMonotonicMs.toFixed(2)),
      elapsedMonotonicMs: Number((endMonotonicMs - startMonotonicMs).toFixed(2)),
      success: false,
      errorCategory: category,
      errorMessage: message,
      blockNumber: null,
      blockHash: null,
      amountOut: null,
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SAHIKARA Phase 4.15 — Bounded QuoterV2 Transport Probe');
  console.log(' 3 HTTP + 3 WebSocket Comparison | Timeout: 5,000ms');
  console.log(' Capital: ₹0.00 | Execution: LOCKED | Credentials: NONE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results: ProbeMeasurement[] = [];

  // 1. Run 3 Bounded HTTP Quotes
  console.log('[1/2] Executing 3 Bounded HTTP QuoterV2 Requests (' + HTTP_ENDPOINT + ')...');
  for (let i = 1; i <= 3; i++) {
    const res = await executeHttpQuote(i);
    results.push(res);
    console.log(`  HTTP #${i}: [${res.errorCategory}] ${res.elapsedMonotonicMs.toFixed(1)}ms | Block: ${res.blockNumber ?? 'N/A'} | AmountOut: ${res.amountOut ?? 'N/A'}`);
    await new Promise((r) => setTimeout(r, 100)); // small pacing
  }

  // 2. Run 3 Bounded WebSocket Quotes
  console.log('\n[2/2] Executing 3 Bounded WebSocket QuoterV2 Requests (' + WS_ENDPOINT + ')...');
  const wsClient = new BoundedWebSocketRpcClient();
  try {
    await wsClient.connect();
    console.log('  WebSocket Connected successfully.');
    for (let i = 1; i <= 3; i++) {
      const res = await executeWsQuote(wsClient, i);
      results.push(res);
      console.log(`  WS #${i}:   [${res.errorCategory}] ${res.elapsedMonotonicMs.toFixed(1)}ms | Block: ${res.blockNumber ?? 'N/A'} | AmountOut: ${res.amountOut ?? 'N/A'}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch (err) {
    console.error('  WS Connection failed:', err instanceof Error ? err.message : String(err));
    for (let i = 1; i <= 3; i++) {
      const { category, message } = classifyError(err);
      results.push({
        transport: 'WEBSOCKET',
        requestNumber: i,
        startWallClockIso: new Date().toISOString(),
        endWallClockIso: new Date().toISOString(),
        startMonotonicMs: 0,
        endMonotonicMs: 0,
        elapsedMonotonicMs: 0,
        success: false,
        errorCategory: category,
        errorMessage: message,
        blockNumber: null,
        blockHash: null,
        amountOut: null,
      });
    }
  } finally {
    console.log('  Closing WebSocket client connection explicitly...');
    wsClient.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' PROBE COMPLETE — SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(results, null, 2));

  // Explicitly terminate process so no lingering timers / handles keep event loop alive
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
