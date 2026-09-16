/**
 * SAHIKARA Observer — Abstract Data Source Interface
 *
 * This interface is designed to be implementation-agnostic.
 * Current implementation: JSON-RPC via viem (RpcDataSource)
 * Future implementation: Base Flashblocks WebSocket stream (FlashblocksDataSource)
 *
 * The abstraction ensures that adapters and the observer do not depend
 * directly on the RPC transport — they can be swapped for Flashblocks
 * without modifying the adapter layer.
 *
 * [ARCHITECTURE NOTE] Flashblocks integration is deferred per Phase 1C scope.
 * See ARCHITECTURE.md and docs/strategy/OBSERVATION_ENGINE.md for context.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared Data Structures
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockHeader {
  blockNumber: bigint;
  baseFeePerGas: bigint | null;
  timestamp: bigint;
}

export interface GasPriceInfo {
  /** Current base fee per gas in wei */
  baseFeePerGas: bigint;
  /** Recommended priority fee per gas in wei [ESTIMATE] */
  priorityFeePerGas: bigint;
  /** Combined gas price (base + priority) in wei */
  gasPriceWei: bigint;
  /** Gas price in gwei (for display) */
  gasPriceGwei: number;
}

export interface ContractCallParams {
  contractAddress: `0x${string}`;
  address?: `0x${string}`;
  abi: readonly object[];
  functionName: string;
  args?: readonly unknown[];
  blockNumber?: bigint;
}

export interface ContractCallResult<T> {
  data: T;
  /** RPC round-trip latency in milliseconds */
  latencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IDataSource {
  /** Human-readable identifier for this data source */
  readonly id: string;

  /**
   * Fetch the latest block header.
   * Returns block number, base fee, and timestamp.
   */
  getLatestBlock(): Promise<{ header: BlockHeader; latencyMs: number }>;

  /**
   * Fetch current gas price information from the network.
   * [ASSUMPTION] Uses eth_gasPrice and eth_feeHistory.
   * Marked as ESTIMATE — actual execution gas will differ.
   */
  getGasPrice(): Promise<{ gasPrice: GasPriceInfo; latencyMs: number }>;

  /**
   * Execute a read-only contract call (eth_call).
   * MUST NOT sign or submit any transaction.
   * MUST NOT require a signer or wallet.
   */
  readContract<T>(params: ContractCallParams): Promise<ContractCallResult<T>>;

  /**
   * Check connectivity by fetching the chain ID.
   * Throws if the RPC endpoint is unreachable or returns wrong chain.
   */
  verifyConnectivity(expectedChainId: number): Promise<void>;
}
