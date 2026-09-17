# PHASE 4.13B.1 — Transfer Latency & Settlement Assumptions Audit

> **PHASE ID**: Phase 4.13B.1  
> **SCOPE**: Forensic Audit of Blockchain Confirmation vs. Exchange Settlement  
> **STATUS**: COMPLETED  
> **AUTHORITY**: Directive 4.13B.1  
> **CAPITAL ALLOCATION**: strictly ₹0.00 / $0.00  
> **EXECUTION STATUS**: LOCKED  

---

## 1. Audit of Confirmation Assumptions

Phase 4.13B modeled transfer latency across three chains in `TransferCostModel.ts`:
- **Base**: 12 blocks ($\approx 24\text{ seconds}$ at 2s block time)
- **Arbitrum One**: 64 blocks ($\approx 16\text{ seconds}$ at 0.25s block time)
- **Polygon PoS**: 128 blocks ($\approx 256\text{ seconds}$ at 2s block time)

### Forensic Investigation:
What do these values actually represent?
1. **Source**: Published public exchange deposit documentation (e.g., Coinbase and Binance deposit confirmation schedules).
2. **Classification**: **`[MODEL ASSUMPTION]`**.
3. **Definition**: The number of sequencer / consensus blocks an exchange requires before crediting user balances.

---

## 2. Separation of the Five Transfer Stages

A common industry fallacy is assuming that "block confirmation time" equals "funds available for trading." In reality, an end-to-end transfer consists of five distinct, sequential phases:

```
[Stage 1: Client Dispatch]
          │
          ▼
[Stage 2: On-Chain Inclusion & Consensus Confirmation] (e.g. 12 Base blocks)
          │
          ▼
[Stage 3: Exchange Node Ingestion & Reorg Depth Buffer]
          │
          ▼
[Stage 4: Exchange Internal Risk Engine & Accounting Credit]
          │
          ▼
[Stage 5: Trading Account Balance Release]
```

### Breakdown by Stage:
1. **Stage 1 (Client Dispatch & Mempool Propagation)**: Monitored locally; typically 50–300 ms on L2 networks.
2. **Stage 2 (Blockchain Protocol Confirmation)**: 12 to 128 blocks. This is the **only** stage captured by the mathematical model ($16\text{s}$ to $256\text{s}$).
3. **Stage 3 (Exchange Ingestion)**: Centralized exchanges run internal indexing nodes that often trail live RPC tips by several seconds to minutes to avoid micro-reorganizations.
4. **Stage 4 (Risk & Compliance Processing)**: Automated risk checks (AML/travel rule, hot wallet velocity checks).
5. **Stage 5 (Balance Credit)**: Final ledger balance update in the trading wallet.

---

## 3. The Unobservability of Real Exchange Settlement

Under the absolute security directives of SAHIKARA:
- Zero funded exchange accounts exist.
- Zero deposit addresses have been generated.
- Zero withdrawals or deposits have been executed.

Therefore:
- **Stages 3, 4, and 5 cannot be observed or measured using public unauthenticated market-data endpoints.**
- Actual end-to-end deposit crediting latency can range from 30 seconds to over 30 minutes depending on exchange server load, hot wallet liquidity, and compliance flags.
- Real withdrawal latency is similarly gated by exchange internal batching, transaction signing cycles, and hot wallet balances.

---

## 4. Formal Rectification of Transfer Wording

### Prohibited Overbroad Claim:
> *"Base transfers take 24 seconds."* (False: conflates block confirmation with complete exchange settlement).

### Adopted Bounded Standard Wording:
> *"The model assumed 12 block confirmations (~24 seconds) for Base L2 as a simulation parameter. Real end-to-end deposit and withdrawal settlement latency is UNKNOWN / VARIABLE and cannot be measured without live funded accounts."*

---

## 5. Table of Audited Transfer Parameters

### Table 5.1: Transfer Parameters and Provenance Status

| Chain / Venue | Parameter | Model Value | Physical Reality | Provenance & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Base (8453)** | Block Confirmation | 12 blocks (~24s) | 2s block interval | `[MODEL ASSUMPTION]` |
| **Base (8453)** | Withdrawal Processing | Modeled as 0s | 1 to 15+ minutes | `UNKNOWN / VARIABLE` |
| **Base (8453)** | Withdrawal Fee | $0.50 | Exchange hot wallet fee | `[ESTIMATED DOCUMENTED FEE]` |
| **Arbitrum (42161)** | Block Confirmation | 64 blocks (~16s) | ~0.25s block interval | `[MODEL ASSUMPTION]` |
| **Arbitrum (42161)** | Withdrawal Processing | Modeled as 0s | 1 to 15+ minutes | `UNKNOWN / VARIABLE` |
| **Arbitrum (42161)** | Withdrawal Fee | $0.80 | Exchange hot wallet fee | `[ESTIMATED DOCUMENTED FEE]` |
| **Polygon (137)** | Block Confirmation | 128 blocks (~256s) | ~2.0s block interval | `[MODEL ASSUMPTION]` |
| **Polygon (137)** | Withdrawal Processing | Modeled as 0s | 5 to 30+ minutes | `UNKNOWN / VARIABLE` |
| **Polygon (137)** | Withdrawal Fee | $1.00 | Exchange hot wallet fee | `[ESTIMATED DOCUMENTED FEE]` |
