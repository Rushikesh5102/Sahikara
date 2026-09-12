# LESSONS_LEARNED.md — Failure Analysis & Institutional Memory

> **PURPOSE**: In quantitative trading and autonomous systems, failures, bugs, reverted transactions, and flawed models are the most valuable learning signals.  
> **RULE**: Never conceal or minimize an error. Every mistake, failed transaction, or security finding must be analyzed through a rigorous root-cause post-mortem and translated into a permanent preventive safeguard in the Project Brain.

---

## 1. Post-Mortem Incident Template

When documenting a failure, bug, reverted transaction, or mistaken assumption, use this format:

```markdown
### INC-XXX: [Descriptive Title of Incident / Discovery]
- **Date**: YYYY-MM-DD
- **Phase**: [e.g., Phase 2 / Phase 4 / Phase 6 / Phase 8]
- **Severity**: [CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL]
- **Impact**: [Capital lost (₹/USD), downtime duration, false positive count, test delay]

#### 1. Summary of What Happened
[Concise narrative describing the sequence of events, symptoms observed, and how the issue was discovered.]

#### 2. Root Cause Analysis (The 5 Whys)
1. *Why did X fail?* -> [Direct cause]
2. *Why did [Direct cause] happen?* -> [Secondary factor]
3. *Why did [Secondary factor] occur?* -> [Tertiary factor]
4. *Why did our tests / simulator miss this?* -> [Testing blindspot]
5. *Why did our operational policies allow this?* -> [Root systemic cause]

#### 3. Immediate Remediation Taken
- [Step 1 taken to halt damage or freeze system]
- [Step 2 taken to patch code or recover state]

#### 4. Permanent Corrective Actions & Brain Updates
- **Code Change**: [Link to commit or PR fixing the underlying logic]
- **Test Addition**: [Specific regression test added to tests/ to prevent recurrence]
- **Rule / Risk Policy Update**: [Reference to updated invariant in PROJECT_RULES.md or RISK_POLICY.md]

#### 5. Verification of Fix
- [Details of test run, fuzzing run, or simulation proving the fix is effective]
```

---

## 2. Institutional Lessons & Historical Entries

### INC-000: Project Inception Baseline — The Danger of Unstructured Development
- **Date**: 2026-09-12
- **Phase**: Phase 0 — Foundation
- **Severity**: INFORMATIONAL
- **Impact**: Zero capital loss; foundational engineering insight.

#### 1. Summary of What Happened
Prior to formally initializing SAHIKARA's Project Brain, review of common decentralized trading bot failures revealed that $>90\%$ of amateur MEV and arbitrage bots suffer capital loss due to:
- Mixing personal and bot wallets.
- Neglecting exact pool fee tier math.
- Forgetting that reverted transactions still burn full gas fees.
- Underestimating public mempool front-running (sandwich attacks).
- Relying on LLM agents to execute live trades probabilistically.

#### 2. Root Cause Analysis
The root cause of these systemic failures is jumping directly into code implementation without rigorous architectural constraints, deterministic execution boundaries, and air-gapped security protocols.

#### 3. Immediate Remediation Taken
Established the SAHIKARA Project Brain with 18 non-negotiable rules, strict phased gating, and a hard lock preventing live trading until Phase 8.

#### 4. Permanent Corrective Actions
Created `PROJECT_RULES.md`, `SECURITY.md`, and `RISK_POLICY.md` as mandatory, enforceable invariants.
