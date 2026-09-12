# AGENTS.md — Mandatory Directives for Autonomous & Human Contributors

> **SCOPE**: This document establishes binding operational guidelines for any artificial intelligence system (including Claude, GPT, Antigravity, Gemini, or custom subagents) or human engineer interacting with the SAHIKARA repository. Compliance is mandatory.

---

## 1. Core Operating Principles for Agents

As an agent operating on SAHIKARA, you are an auxiliary engineer, researcher, and auditor. Capital security is paramount. You are bound by the following imperatives:

1. **Memory Precedence**: The repository is the canonical source of truth. External assumptions, vague heuristics, or stale training data must never supersede repository documentation.
2. **Context Intake Before Action**: You must read relevant Project Brain files before modifying code or documentation. Never act on assumptions when repository records provide ground truth.
3. **Inspect Before Proposing**: Never propose code replacements, architectural pivots, or library removals without inspecting current repository state and existing files first.
4. **Deterministic Capital Authority**: AI models provide research, simulation modeling, code generation, and anomaly detection. Under no circumstances may an AI agent be granted runtime authority over trade execution or live capital routing.
5. **Radical Honesty & Zero Hallucination**: If code does not work, a library is unfamiliar, a test fails, or an economic assumption is unviable, state it immediately. Never fabricate success, mock data without explicit labels, or conceal operational hurdles.
6. **No Silent Changes**: Never silently modify risk thresholds, slippage tolerances, gas limits, or mathematical models. Every modification must be logged in `DECISIONS.md` and `CHANGELOG.md`.
7. **Strict Testing Requirement**: All functional additions must be accompanied by comprehensive tests. Code without verification tests is incomplete.

---

## 2. Onboarding Workflow for Every Session

Every agent session must execute the following preliminary sequence before proposing or executing changes:

1. **Verify Operating Phase**: Read [`PROJECT_STATE.md`](./PROJECT_STATE.md). Identify the active phase. Ensure you do not write code designated for a future phase.
2. **Check Rules & Security**: Read [`PROJECT_RULES.md`](./PROJECT_RULES.md) and [`SECURITY.md`](./SECURITY.md). Verify that planned actions conform to all 18 non-negotiable rules.
3. **Review Architectural Context**: Consult [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`STRATEGY.md`](./STRATEGY.md), and [`MASTER_PLAN.md`](./MASTER_PLAN.md).
4. **Inspect Decision & Change Logs**: Review recent entries in [`DECISIONS.md`](./DECISIONS.md) and [`CHANGELOG.md`](./CHANGELOG.md) to ensure awareness of approved or rejected proposals.
5. **Inspect Workspace**: Check directory layout and existing source files before writing new code.

---

## 3. Strict Prohibitions

Agents are explicitly forbidden from:

- **Introducing Live Trading Logic Prematurely**: Do not write live transaction dispatchers, private-key signers, or broadcast calls while the project is in Phases 0 through 4.
- **Handling Real Private Keys or Seed Phrases**: Never ask the operator for, generate, print, or commit real private keys or mnemonics.
- **Bypassing Simulation & Safety Gates**: Never bypass transaction pre-simulation or ignore negative net profit calculations.
- **Inventing Arbitrage Profitability**: Never present unverified or gross-spread opportunities as "profitable" without factoring in pool fees, gas costs, slippage, and execution risk.
- **Committing Secrets**: Never create files containing real RPC API keys, wallet keys, or secret tokens. Always use `.env.example` templates with explicit placeholders.
- **Installing Unvetted Dependencies**: Do not introduce unmaintained, esoteric, or unverified packages for core cryptographic, mathematical, or blockchain operations.

---

## 4. Documentation & Maintenance Protocol

When an agent completes a task, the agent is obligated to update the Project Brain:

1. **Update `PROJECT_STATE.md`**: Record progress, updated task status, new blockers, and metric changes.
2. **Record Decisions in `DECISIONS.md`**: Any architectural, dependency, chain, or strategy decision must be assigned an ID (e.g., `DEC-008`), marked `APPROVED` or `PROVISIONAL`, and documented with rationale.
3. **Record Changes in `CHANGELOG.md`**: Document every modified, added, or deleted file following the Keep a Changelog standard.
4. **Record Empirical Discoveries in `EXPERIMENTS.md`**: Log any test runs, benchmarks, or simulations with hypotheses, data, and outcomes.
5. **Log Anomalies & Failures in `LESSONS_LEARNED.md` & `TRANSPARENCY_POLICY.md`**: Any bug, reverted call, or flawed assumption must be formally documented to prevent recurrence.

---

## 5. Verification Checklist Before Terminating Any Turn

Before concluding any interaction, the agent must verify:
- [ ] Are all newly introduced files and changes strictly aligned with the current phase?
- [ ] Has any secret, private key, or credential been exposed or committed?
- [ ] Are all risk parameters marked as PROVISIONAL until validated by empirical evidence?
- [ ] Have `PROJECT_STATE.md` and `CHANGELOG.md` been synchronized?
- [ ] Are all assumptions clearly articulated to the operator?
