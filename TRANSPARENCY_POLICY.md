# TRANSPARENCY_POLICY.md — Radical Transparency & Anomaly Disclosure Policy

> **ETHOS**: In autonomous financial engineering, concealment is fatal. True robustness is built on unflinching, transparent exposure of mistakes, flawed hypotheses, simulation discrepancies, and edge-case failures.

---

## 1. Mandatory Disclosure Mandate

Every contributor, agent, and reviewer working on SAHIKARA is obligated by contract and protocol to immediately surface, document, and catalog any anomaly. Concealing, downplaying, or silently patching over any failure is a direct breach of Rule 9 of [`PROJECT_RULES.md`](./PROJECT_RULES.md).

The following categories must be explicitly recorded and analyzed:

### 1.1 Failed Transactions & Reverts
- Every on-chain transaction that reverts (whether on testnet or mainnet).
- Full transaction hash, block number, gas consumed, error string, and raw trace must be archived in `docs/operations/reverts.md` (or relevant log file).
- The exact economic loss (gas burned) must be registered in financial records.

### 1.2 Unprofitable Opportunities & False Positives
- Instances where the Scanner or Simulator flagged an opportunity as profitable, but subsequent execution or higher-fidelity simulation revealed negative or zero net profit.
- Record the discrepancy between predicted profit and actual economics to recalibrate simulator parameters.

### 1.3 Incorrect Assumptions & Model Inaccuracies
- Flawed assumptions regarding pool liquidity depth, constant product approximations, token transfer taxes, or fee distributions.
- Mathematical oversights in slippage curves or price impact calculations.

### 1.4 Bugs, Flaws & Edge Cases
- All software bugs, logic errors, race conditions, memory leaks, or unhandled exceptions across the stack.
- Include failing test cases that reproduce the issue.

### 1.5 Security Findings & Vulnerabilities
- Any flaw discovered during static analysis (Slither), fuzzing, code reviews, or threat modeling (e.g., reentrancy vectors, access control gaps, front-running risks).
- Log severity, affected files, and mitigation status in `docs/security/vulnerability_log.md`.

### 1.6 Infrastructure & Network Failures
- RPC timeouts, dropped WebSocket feeds, rate limit bans, node desyncs, or chain reorg discrepancies.
- Document duration, root cause, and how the failover mechanism behaved.

### 1.7 Strategy Failures & Market Competition
- Losses caused by competing MEV searchers, sandwich bots, or validator reordering.
- Structural changes in DEX liquidity or pool incentives that invalidate historical edge.

### 1.8 Model & AI Mistakes
- Any hallucinated library functions, incorrect mathematical formulas, erroneous parameter proposals, or false reasoning produced by an AI assistant.
- Document what prompt or context caused the mistake and how prompt constraints or checks were updated.

### 1.9 Discrepancies Between Expected and Actual Results
- Any measurable variance between off-chain simulated outcomes (`eth_call`) and actual mined block inclusion state (execution price, slippage, gas used).

---

## 2. Psychological Safety & Objective Engineering

In the SAHIKARA culture:
- **Mistakes are expected and celebrated as research data** when discovered and documented rigorously.
- **Failures in paper trading or testnets are proof that validation gates are working** as designed to protect mainnet capital.
- **Punitive attitudes toward reporting errors are strictly rejected**: The only unacceptable action is hiding an error.

---

## 3. Transparency Reporting Workflow

When an anomaly occurs:
1. **Immediate Halt**: If on live testnet or mainnet, ensure automated circuit breaker has engaged.
2. **Log Anomaly**: Create an entry in `LESSONS_LEARNED.md` or the appropriate log under `docs/`.
3. **Notify Operator**: Directly inform the Human Operator with an unvarnished summary of the issue, root cause, and proposed remediation.
4. **Permanent Brain Update**: Update `DECISIONS.md` or `RISK_POLICY.md` if the finding necessitates an architectural or limit change.
