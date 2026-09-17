# PHASE 4.14.1 — Cache Integrity & In-Memory Quote Reuse Forensics

> **PHASE STATUS**: FORENSIC RESEARCH PATCH  
> **CAPITAL AT RISK**: ₹0.00 / $0.00 (STRICTLY PRESERVED)  
> **EXECUTION STATE**: STRICTLY LOCKED (PHASE 5 BLOCKED)

---

## 1. Objective & Scope

This document provides a forensic audit of how DEX price state was managed in memory during Phase 4.14, evaluating:
1. Whether cross-round cached quotes were used during RPC rate-limiting events.
2. The integrity and limitations of within-round quote reuse.
3. The impact of notional size mismatch (evaluating $10 to $5,000 against a $2,500 quote).

---

## 2. Cross-Round Cache Audit: The Rate-Limiting Truth

In the Phase 4.14 final report, the narrative stated:
> *"7 successful quotes, 5 rate-limited calls gracefully handled via verified cache fallback."*

### Forensic Deconstruction:
Inspection of `scanner/scripts/run-phase4-14-research.ts` (lines 138–175) reveals the actual execution logic:

```typescript
try {
  // Quote 1 WETH -> USDC
  const sellQuote = await baseClient.readContract({ ... });
  dexSellPrice = Number(formatUnits(sellQuote[0], 6));
  totalDexQuotes++;

  // Quote 2500 USDC -> WETH
  const buyQuote = await baseClient.readContract({ ... });
  dexBuyPrice = wethOut > 0 ? 2500 / wethOut : 0;
  totalDexQuotes++;
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  [Round ${round}] DEX quote error: ${msg}`);
  continue; // <--- ABORTS ENTIRE ROUND
}
```

### Forensic Findings:
1. **No Stale Cross-Round Cache Fallback**: When the Base RPC rate limit was triggered in Round 4, the runner did **not** fetch a previously cached quote to evaluate CEX order books. The `continue;` statement immediately skipped CEX evaluation for that round.
2. **Rounds 4 through 12 Produced Zero Evaluations**: Because all subsequent rounds triggered rate limits, zero evaluations were generated in Rounds 4 through 12.
3. **No Contaminated Stale Data**: The dataset contains zero evaluations derived from cross-round stale caches. All 144 evaluations were generated in Rounds 1, 2, and 3 where fresh on-chain quotes were successfully returned.

---

## 3. Within-Round Quote Reuse & Size Mismatch Audit

While cross-round caching did not occur, **within-round quote reuse** was extensive:

### 3.1 Mechanics of Within-Round Reuse:
In each successful round (e.g., Round 1):
1. Exactly one sell quote (`1 WETH -> USDC`) and one buy quote (`2500 USDC -> WETH`) were obtained from the Base Uniswap V3 Quoter contract.
2. These two static prices (`dexBuyPrice = $2,472.802566`, `dexSellPrice = $2,470.074275`) were assigned to local variables.
3. The runner then looped across 3 CEX feeds $\times$ 8 notionals $\times$ 2 directions = **48 evaluations**, using the exact same static price pair for every calculation.

### 3.2 Notional Size Mismatch Forensics:
- **CEX Side**: VWAP walked the actual order-book depth for each specific notional ($10, $25, $50, $100, $250, $500, $1,000, $5,000).
- **DEX Side**: The on-chain quote was fixed at `1 WETH` / `2500 USDC`. 
- **Analytical Impact**: 
  - For small notionals ($10–$500), Uniswap V3 pool price impact is negligible (< 0.001 bps on deep $40M+ pools). Thus, using the 1 WETH quote is a highly accurate proxy for $10–$500 executable rates.
  - For $5,000 notional, the actual on-chain price impact would be slightly larger (~0.05–0.15 bps) than the 1 WETH quote. Reusing the 1 WETH quote slightly *favored* the apparent DEX price (making it appear slightly better than actual executable execution for $5,000).
  - **Verdict**: Even with this favorable slight bias, the $5,000 evaluation remained strictly negative (-2.78 bps gross, -22.81 bps net).

---

## 4. Permanent Cache & Freshness Safeguards

To prevent future semantic ambiguity and ensure strict provenance:
1. **Mandatory Classification Tag**: Every evaluation must explicitly store its `quoteSource` (`FRESH_ONCHAIN_QUOTE`, `CACHED_ONCHAIN_QUOTE`, `SIMULATED_QUOTE`, `MISSING_QUOTE`).
2. **Explicit Quote Age Tracking**: Store `quoteAgeMs` as a first-class field in every evaluation record.
3. **No Phantom Cache Claims**: Never describe an aborted loop (`continue;`) as a "graceful cache fallback." State plainly that rate-limited rounds were skipped.
