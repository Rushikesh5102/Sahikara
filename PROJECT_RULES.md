# PROJECT_RULES.md — Non-Negotiable Engineering & Operational Principles

> **STATUS**: RATIFIED & PERMANENT  
> **APPLICABILITY**: All contributors, human engineers, AI systems, automated CI/CD runners, and subagents.  
> **VIOLATION CONSEQUENCE**: Immediate cessation of work, code rejection, and formal incident post-mortem in `LESSONS_LEARNED.md`.

---

## 1. Non-Negotiable Core Principles

### Rule 1: Security First
Capital preservation and system defense strictly take precedence over execution speed, code brevity, throughput, and profit optimization. In any trade-off between security and convenience, security wins unconditionally.

### Rule 2: Never Expose Private Keys or Seed Phrases
Private keys, raw cryptographic seeds, recovery phrases, and sensitive keystores must never be committed to Git repositories, pasted into AI tools or prompts, stored in source code or plain text, printed in execution logs, passed across chat interfaces, or surfaced in error messages.

### Rule 3: Personal Wallets Must Remain Isolated from the Trading System
Never connect personal wallets, primary DeFi addresses, cold-storage personal vaults, or non-project accounts to SAHIKARA code, tests, or scripts. Personal addresses must never interact directly with unverified experimental contracts.

### Rule 4: Tiered Wallet Lifecycle: Strict Separation of Development and Production Wallets
Wallet generation and usage are governed by a strict two-stage lifecycle:
- **Development Wallet**: May be created during Phase 0 or early Phase 1. Used strictly and exclusively for local development, scripts, and testnet experimentation. It must never contain meaningful real-world funds. Its private keys and seed phrases must never be committed to Git, pasted into AI tools, or stored in source code.
- **Production Wallet**: Creation and deployment must remain strictly deferred until the production/mainnet preparation stage (Phase 7/Phase 8). It must be a newly generated, dedicated SAHIKARA wallet, completely isolated from the operator's personal wallet, and funded only with authorized capital (capped at ₹100 for the Phase 8 experiment).

### Rule 5: Never Commit Secrets to Git
Zero-tolerance policy for committing `.env` files, API keys (Alchemy, Infura, QuickNode), RPC endpoints with embedded tokens, private keys, or credentials. Automated pre-commit hooks, strict `.gitignore` rules, and manual inspection gates must enforce this at every step.

### Rule 6: Never Enable Live Trading Accidentally
Live trading capabilities must be guarded by multiple independent compile-time and runtime locks:
1. Hard-coded environment check (`TRADING_MODE=LIVE`).
2. Explicit operator manual confirmation flag.
3. Network ID and wallet address assertion.
4. Phase validation check (`PROJECT_STATE.md` phase >= 8).

### Rule 7: Never Silently Change the Approved Strategy
The quantitative strategy, execution path, token pairs, pool types, and routing logic approved in `STRATEGY.md` cannot be altered on a whim or without formal documentation in `DECISIONS.md`.

### Rule 8: Never Silently Change Risk Limits
All risk boundaries (maximum slippage, maximum trade size, stop-loss triggers, consecutive failure ceilings, gas price caps) are locked. Any adjustment requires an ADR in `DECISIONS.md` citing empirical simulation or testnet data.

### Rule 9: Never Hide Failures, Losses, Bugs, Security Findings, or Uncertainty
Radical transparency is mandatory. If an assumption fails, a transaction reverts, a pool is illiquid, an edge case appears, or a security weakness is detected, it must be prominently reported, documented in `TRANSPARENCY_POLICY.md`, and investigated in `LESSONS_LEARNED.md`. Never pretend things work when they do not.

### Rule 10: Deterministic Code Controls Trading Execution
All live capital decisions, transaction creation, slippage verification, profit assertions, and execution routing must be governed solely by deterministic, auditable code. No probabilistic guesses, LLM output, or fuzzy logic may decide transaction parameters.

### Rule 11: AI Assists; AI Must Not Have Uncontrolled Authority Over Capital
AI agents (e.g., Antigravity, ChatGPT, Claude) exist to research, model, develop, test, fuzz, review, and monitor. AI systems must never possess autonomous signing capabilities, unchecked private key access, or the ability to dynamically route capital without deterministic guardrails.

### Rule 12: Use Proven, Maintained Libraries
Never reinvent standard cryptographic routines, elliptic curve math, keccak hashing, ABI encoding/decoding, web3 providers, or network clients. Use battle-tested, widely audited libraries (e.g., Ethers.js / Viem, OpenZeppelin, Foundry / Hardhat) rather than custom implementations.

### Rule 13: Optimize Only After Correctness and Security Are Established
Premature optimization (e.g., aggressive assembly tricks, unverified low-level gas micro-optimizations, custom memory allocators) is forbidden until the baseline logic is proven mathematically correct, robustly tested, and fully secure.

### Rule 14: Every Significant Architectural or Strategic Decision Must Be Documented
No architectural pivot, dependency addition, chain selection, or structural refactoring may occur without an Architecture Decision Record (ADR) logged in `DECISIONS.md`.

### Rule 15: Simulation/Paper Trading Is a Validation Gate, NOT the Final Objective
Paper trading and simulations serve as strict, necessary falsification filters to prove economic viability and rule out false positives. However, simulation success does not equate to production readiness; testnets and real-world execution friction must validate every hypothesis.

### Rule 16: Progress Toward Real-Money Execution Must Be Controlled and Evidence-Based
Transitions between roadmap phases require satisfying formal Exit Criteria backed by reproducible empirical data (logged in `EXPERIMENTS.md`) and verified by the Human Operator.

### Rule 17: Any Proposed Deviation from the Original Project Plan Must Be Explicitly Documented
Any proposed change in scope, target chain, DEX choice, or risk architecture must be formulated as a formal proposal, reviewed against these rules, and recorded in `DECISIONS.md` prior to implementation.

### Rule 18: The Repository Is the Canonical Project Memory / Source of Truth
The code, documentation, decision records, and test logs inside this Git repository constitute the complete, authoritative memory of the project. Knowledge stored only in ephemeral chat windows or operator memory is considered non-existent until committed.

---

## 2. Enforcement & Verification

- **Code Review Checklist**: Every pull request or agent response must be checked against these 18 rules.
- **Pre-Execution Assertions**: Runtime asserts must enforce rules 6, 8, 10, and 11 inside code modules.
- **Audit Requirement**: Any violation triggers an immediate freeze until resolved and documented.
