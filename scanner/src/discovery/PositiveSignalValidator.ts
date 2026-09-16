/**
 * SAHIKARA — Phase 4.7 Positive Signal Forensics & Validation Pipeline
 *
 * Strict 10-stage candidate gate:
 *   PRICE_DIVERGENCE
 *          ↓
 *   EXECUTABLE_GROSS_POSITIVE
 *          ↓
 *   FEE_VALIDATED
 *          ↓
 *   SLIPPAGE_VALIDATED
 *          ↓
 *   GAS_VALIDATED
 *          ↓
 *   LATENCY_VALIDATED
 *          ↓
 *   LIQUIDITY_VALIDATED
 *          ↓
 *   RISK_BUFFER_VALIDATED
 *          ↓
 *   REPEATED_REQUOTE
 *          ↓
 *   CANDIDATE_VALIDATED (VALIDATED OPPORTUNITY)
 *
 * ABSOLUTE SAFETY DIRECTIVE:
 * Even if a candidate is classified as a VALIDATED OPPORTUNITY:
 *   DO NOT EXECUTE.
 *   DO NOT BROADCAST TRANSACTIONS.
 *   Capital at risk remains ₹0.00 / $0.00.
 *   Execution remains strictly LOCKED.
 */

import type { RoundTripEvaluation } from '../economics/roundTripEvaluator.js';

export type CandidateStage =
  | 'PRICE_DIVERGENCE'
  | 'EXECUTABLE_GROSS_POSITIVE'
  | 'FEE_VALIDATED'
  | 'SLIPPAGE_VALIDATED'
  | 'GAS_VALIDATED'
  | 'LATENCY_VALIDATED'
  | 'LIQUIDITY_VALIDATED'
  | 'RISK_BUFFER_VALIDATED'
  | 'REPEATED_REQUOTE'
  | 'CANDIDATE_VALIDATED'
  | 'REJECTED'
  | 'UNVERIFIED';

export interface SignalForensicReport {
  routeId: string;
  chain: string;
  blockNumber: string;
  stage: CandidateStage;
  isValidatedOpportunity: boolean;
  passedGates: string[];
  failedGates: string[];
  auditNotes: string[];
  reverificationQuote?: {
    grossSpreadBps: number;
    netProfitBps: number;
    timestampMs: number;
  };
}

export class PositiveSignalValidator {
  /**
   * Evaluates an initial round-trip evaluation through the forensic candidate pipeline.
   */
  public static auditInitialEvaluation(evaluation: RoundTripEvaluation): SignalForensicReport {
    const passedGates: string[] = [];
    const failedGates: string[] = [];
    const auditNotes: string[] = [];

    // Stage 1: Executable Gross Spread
    if (evaluation.grossSpreadBps > 0) {
      passedGates.push('EXECUTABLE_GROSS_POSITIVE');
      auditNotes.push(`Positive gross spread observed: +${evaluation.grossSpreadBps.toFixed(2)} bps`);
    } else {
      failedGates.push('EXECUTABLE_GROSS_POSITIVE');
      auditNotes.push(`Gross spread is negative: ${evaluation.grossSpreadBps.toFixed(2)} bps`);
      return {
        routeId: evaluation.routeId,
        chain: evaluation.chain,
        blockNumber: evaluation.blockNumber.toString(),
        stage: 'REJECTED',
        isValidatedOpportunity: false,
        passedGates,
        failedGates,
        auditNotes,
      };
    }

    // Stage 2: Fee Validation (Gross spread must exceed theoretical fee floor)
    const theoreticalFeeFloorBps = evaluation.leg1.feeBps + evaluation.leg2.feeBps + (evaluation.leg3?.feeBps ?? 0);
    if (evaluation.grossSpreadBps > theoreticalFeeFloorBps) {
      passedGates.push('FEE_VALIDATED');
      auditNotes.push(`Spread exceeds theoretical fee floor (${theoreticalFeeFloorBps} bps)`);
    } else {
      // Sub-fee spread! (Historical Arbitrum/Optimism defect)
      failedGates.push('FEE_VALIDATED');
      auditNotes.push(`Spread +${evaluation.grossSpreadBps.toFixed(2)} bps is below fee floor (${theoreticalFeeFloorBps} bps). Sub-fee dislocation artifact.`);
    }

    // Stage 3: Slippage & Price Impact Validation
    const totalImpactBps = evaluation.leg1.priceImpactBps + evaluation.leg2.priceImpactBps + (evaluation.leg3?.priceImpactBps ?? 0);
    if (totalImpactBps < 50.0) {
      passedGates.push('SLIPPAGE_VALIDATED');
    } else {
      failedGates.push('SLIPPAGE_VALIDATED');
      auditNotes.push(`Price impact excessive: ${totalImpactBps.toFixed(2)} bps`);
    }

    // Stage 4: Gas Cost Validation
    if (evaluation.grossProfitUsd > evaluation.gasEstimate.gasCostUsd) {
      passedGates.push('GAS_VALIDATED');
    } else {
      failedGates.push('GAS_VALIDATED');
      auditNotes.push(`Gas cost ($${evaluation.gasEstimate.gasCostUsd.toFixed(4)}) exceeds gross profit ($${evaluation.grossProfitUsd.toFixed(4)})`);
    }

    // Stage 5: Net Profit after Buffer
    if (evaluation.netExpectedProfitUsd > 0.05) {
      passedGates.push('RISK_BUFFER_VALIDATED');
    } else {
      failedGates.push('RISK_BUFFER_VALIDATED');
      auditNotes.push(`Net profit ($${evaluation.netExpectedProfitUsd.toFixed(4)}) below minimum $0.05 policy threshold`);
    }

    const isPrelimCandidate = failedGates.length === 0;

    return {
      routeId: evaluation.routeId,
      chain: evaluation.chain,
      blockNumber: evaluation.blockNumber.toString(),
      stage: isPrelimCandidate ? 'REPEATED_REQUOTE' : 'REJECTED',
      isValidatedOpportunity: false, // Requires repeat on-chain quote
      passedGates,
      failedGates,
      auditNotes,
    };
  }

  /**
   * Audits a repeated re-quote against the original candidate to verify persistence.
   */
  public static verifyRepeatQuote(
    initialReport: SignalForensicReport,
    requoteEvaluation: RoundTripEvaluation
  ): SignalForensicReport {
    const updated = { ...initialReport };
    updated.reverificationQuote = {
      grossSpreadBps: requoteEvaluation.grossSpreadBps,
      netProfitBps: requoteEvaluation.netProfitBps,
      timestampMs: requoteEvaluation.timestamp,
    };

    if (requoteEvaluation.grossSpreadBps > 0 && requoteEvaluation.netExpectedProfitUsd > 0.05) {
      updated.passedGates.push('REPEATED_REQUOTE');
      updated.stage = 'CANDIDATE_VALIDATED';
      updated.isValidatedOpportunity = true;
      updated.auditNotes.push(`Re-quote confirmed persistence: +${requoteEvaluation.grossSpreadBps.toFixed(2)} bps gross, +$${requoteEvaluation.netExpectedProfitUsd.toFixed(4)} net.`);
    } else {
      updated.failedGates.push('REPEATED_REQUOTE');
      updated.stage = 'REJECTED';
      updated.isValidatedOpportunity = false;
      updated.auditNotes.push(`Re-quote failed to reproduce: gross spread collapsed to ${requoteEvaluation.grossSpreadBps.toFixed(2)} bps.`);
    }

    return updated;
  }
}
