/**
 * SAHIKARA Phase 4.16 — State-Aligned Cross-Venue & DEX Quote Validator
 *
 * Implements rigorous comparative validation between local in-memory quote
 * calculations and authoritative on-chain QuoterV2 / getAmountOut outputs.
 *
 * CLASSIFICATION TAXONOMY:
 * - MATCH: Exact mathematical match (<= 1 wei diff or <= 0.0001 bps)
 * - MINOR_DIFFERENCE: Negligible rounding / tick boundary delta (<= 0.50 bps)
 * - STATE_MISMATCH: Comparison across non-identical blocks or reorged states
 * - RECONSTRUCTION_ERROR: Divergence > 0.50 bps despite identical block state
 * - UNKNOWN: Incomplete block provenance or missing metadata
 */

export type ValidationClassification =
  | 'MATCH'
  | 'MINOR_DIFFERENCE'
  | 'STATE_MISMATCH'
  | 'RECONSTRUCTION_ERROR'
  | 'UNKNOWN';

export interface StateAlignedComparisonParams {
  poolAddress: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  localAmountOut: bigint;
  localBlockNumber: bigint;
  localBlockHash?: string;
  authoritativeAmountOut: bigint;
  authoritativeBlockNumber: bigint;
  authoritativeBlockHash?: string;
}

export interface StateAlignedValidationReport {
  poolAddress: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  localAmountOut: bigint;
  authoritativeAmountOut: bigint;
  absoluteDeltaWei: bigint;
  relativeDelta: number;
  bpsDelta: number;
  classification: ValidationClassification;
  isBlockAligned: boolean;
  notes: string;
}

export class StateAlignedValidator {
  public static validate(params: StateAlignedComparisonParams): StateAlignedValidationReport {
    const isBlockAligned = params.localBlockNumber === params.authoritativeBlockNumber;

    // 1. Check for block mismatch
    if (!isBlockAligned) {
      const diff = Number(params.localBlockNumber - params.authoritativeBlockNumber);
      return {
        poolAddress: params.poolAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        localAmountOut: params.localAmountOut,
        authoritativeAmountOut: params.authoritativeAmountOut,
        absoluteDeltaWei: params.localAmountOut > params.authoritativeAmountOut
          ? params.localAmountOut - params.authoritativeAmountOut
          : params.authoritativeAmountOut - params.localAmountOut,
        relativeDelta: 0,
        bpsDelta: 0,
        classification: 'STATE_MISMATCH',
        isBlockAligned: false,
        notes: `Block mismatch: local block ${params.localBlockNumber} vs authoritative block ${params.authoritativeBlockNumber} (delta ${diff})`,
      };
    }

    // 2. Check for hash mismatch if both present
    if (
      params.localBlockHash &&
      params.authoritativeBlockHash &&
      params.localBlockHash.toLowerCase() !== params.authoritativeBlockHash.toLowerCase()
    ) {
      return {
        poolAddress: params.poolAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        localAmountOut: params.localAmountOut,
        authoritativeAmountOut: params.authoritativeAmountOut,
        absoluteDeltaWei: params.localAmountOut > params.authoritativeAmountOut
          ? params.localAmountOut - params.authoritativeAmountOut
          : params.authoritativeAmountOut - params.localAmountOut,
        relativeDelta: 0,
        bpsDelta: 0,
        classification: 'STATE_MISMATCH',
        isBlockAligned: false,
        notes: `Block hash mismatch at block ${params.localBlockNumber}: local ${params.localBlockHash} vs auth ${params.authoritativeBlockHash}`,
      };
    }

    if (params.authoritativeAmountOut <= 0n) {
      return {
        poolAddress: params.poolAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        localAmountOut: params.localAmountOut,
        authoritativeAmountOut: params.authoritativeAmountOut,
        absoluteDeltaWei: params.localAmountOut,
        relativeDelta: 1.0,
        bpsDelta: 10000,
        classification: 'RECONSTRUCTION_ERROR',
        isBlockAligned: true,
        notes: `Authoritative quote returned zero or negative output`,
      };
    }

    // Compute exact arithmetic deltas
    const absDiff = params.localAmountOut > params.authoritativeAmountOut
      ? params.localAmountOut - params.authoritativeAmountOut
      : params.authoritativeAmountOut - params.localAmountOut;

    const diffFloat = Number(params.localAmountOut - params.authoritativeAmountOut);
    const authFloat = Number(params.authoritativeAmountOut);
    const relativeDelta = diffFloat / authFloat;
    const bpsDelta = Number((relativeDelta * 10000).toFixed(6));

    let classification: ValidationClassification;
    let notes: string;

    if (absDiff <= 1n || Math.abs(bpsDelta) <= 0.0001) {
      classification = 'MATCH';
      notes = `Exact mathematical alignment (${absDiff} wei delta, ${bpsDelta} bps)`;
    } else if (Math.abs(bpsDelta) <= 0.50) {
      classification = 'MINOR_DIFFERENCE';
      notes = `Minor rounding/tick boundary discrepancy (${bpsDelta} bps)`;
    } else {
      classification = 'RECONSTRUCTION_ERROR';
      notes = `Divergence exceeds tolerance (${bpsDelta} bps)`;
    }

    return {
      poolAddress: params.poolAddress,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      localAmountOut: params.localAmountOut,
      authoritativeAmountOut: params.authoritativeAmountOut,
      absoluteDeltaWei: absDiff,
      relativeDelta,
      bpsDelta,
      classification,
      isBlockAligned: true,
      notes,
    };
  }
}
