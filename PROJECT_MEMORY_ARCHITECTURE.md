# PROJECT_MEMORY_ARCHITECTURE.md — Repository as Canonical Memory

> **FOUNDATIONAL AXIOM**: The Git repository is the sole canonical memory of SAHIKARA. Any knowledge, decision, assumption, or agreement that is not committed to the repository does not exist.

---

## 1. The Repository-as-Memory Concept

In an engineering project involving autonomous AI agents and human collaborators across asynchronous sessions, conversational memory is ephemeral, fragmented, and prone to context decay or hallucination. 

To achieve industrial-grade reliability, SAHIKARA establishes a formal **Project Memory Architecture** where all knowledge is persisted, versioned, and indexed directly in the filesystem:

```mermaid
graph TD
    subgraph Ephemeral Layer
        Chat[Chat / Session Interactions]
        Scratchpad[Local Working Memory]
    end

    subgraph Canonical Persistence Layer [Git Repository]
        State[PROJECT_STATE.md — Current Reality]
        Rules[PROJECT_RULES.md — Immutable Invariants]
        Decisions[DECISIONS.md — Rationale & ADRs]
        Changelog[CHANGELOG.md — Linear History]
        Experiments[EXPERIMENTS.md — Empirical Data]
        Lessons[LESSONS_LEARNED.md — Failure Knowledge]
        Code[contracts / scanner / simulator / executor]
        Docs[docs/ — Deep Knowledge Base]
    end

    Chat -->|Distill & Commit| Canonical Persistence Layer
    Scratchpad -->|Formalize & Commit| Canonical Persistence Layer
```

---

## 2. Memory Tier Taxonomy

| Layer | Medium | Function | Permanence |
| :--- | :--- | :--- | :--- |
| **Canonical Memory** | Git Repository (`main` branch) | Single source of truth for code, policies, and designs | Permanent & Immutable |
| **Project Brain** | Root Markdown Files | Instant, comprehensive operational context for agents | Continuously Synchronized |
| **Audit Traceability** | Git Commit History | Linear chronological log of who changed what, when, and why | Permanent |
| **Empirical Memory** | `EXPERIMENTS.md` & test artifacts | Quantitative verification, simulation logs, benchmark data | Cumulative |
| **Decision Memory** | `DECISIONS.md` (ADRs) | Context, options considered, and justification for decisions | Immutable once approved |
| **Failure Memory** | `LESSONS_LEARNED.md` | Post-mortems, anti-patterns, and resolved vulnerabilities | Cumulative |
| **Ephemeral Working Context** | Chat sessions, subagent contexts | Scratchpads for active problem-solving | Temporary (must be distilled) |

---

## 3. Memory Lifecycle & Synchronization Rules

### 3.1 Distillation Mandate
At the conclusion of every working session or significant task, the collaborating agent or engineer must distill actionable outcomes into the appropriate Project Brain files:
- Did an architectural decision get made? $\rightarrow$ Add entry to `DECISIONS.md`.
- Did code or documentation change? $\rightarrow$ Record in `CHANGELOG.md`.
- Did a test run yield new empirical data? $\rightarrow$ Record in `EXPERIMENTS.md`.
- Did an unexpected error or revert occur? $\rightarrow$ Record in `LESSONS_LEARNED.md`.
- Did the overall milestone or task status progress? $\rightarrow$ Update `PROJECT_STATE.md`.

### 3.2 Agent Onboarding via Repository
New or restarted AI agents cannot rely on prior prompt memories. They must reconstruct complete operational context exclusively by reading:
1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `PROJECT_RULES.md`
4. `MASTER_PLAN.md`
5. `ARCHITECTURE.md` & `STRATEGY.md`
6. `DECISIONS.md`

### 3.3 Zero Redundancy & Divergence
When information changes (e.g., risk parameter adjustments), update the canonical document (`RISK_POLICY.md` or `STRATEGY.md`) directly and reference it elsewhere, rather than duplicating inconsistent values across disparate files.
