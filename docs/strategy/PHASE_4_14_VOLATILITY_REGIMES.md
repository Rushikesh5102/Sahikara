# PHASE 4.14 — Volatility Regimes & Dynamic Market Conditions

> **PHASE STATUS**: RESEARCH-ONLY  
> **CAPITAL**: ₹0.00 | **EXECUTION**: LOCKED | **AUTHENTICATION**: NONE

---

## 1. Objective & Methodology

A central premise of Phase 4.14 is to test whether the tightly bounded CEX–DEX discrepancies observed in Phase 4.13B (+0.35 bps max) were merely artifacts of low market volatility, and whether elevated volatility or rapid order-book movements cause temporary dislocations between centralized order books and decentralized automated market makers.

To avoid subjective, arbitrary labeling of "high volatility," Phase 4.14 implements a mathematically bounded rolling micro-window volatility classifier: `VolatilityRegimeClassifier`.

---

## 2. Mathematical Definition of Volatility Metrics

### 2.1 Micro-Window Price Change Rate
Given a rolling window of recent top-of-book mid-prices $(P_{t_1}, P_{t_2}, \dots, P_{t_n})$ spanning time interval $\Delta T = t_n - t_1$ (in seconds):
$$\text{PriceChangeRate} = \frac{|P_{t_n} - P_{t_1}|}{P_{t_1}} \cdot \frac{1}{\max(\Delta T, 0.1)} \times 10{,}000 \quad [\text{bps/s}]$$

### 2.2 Micro-Window Realized Volatility
Log returns are calculated over consecutive mid-price observations:
$$r_i = \ln\left(\frac{P_{t_i}}{P_{t_{i-1}}}\right)$$
$$\sigma_{\text{realized}} = \sqrt{\frac{1}{n-1} \sum_{i=1}^n (r_i - \bar{r})^2} \times 10{,}000 \quad [\text{bps}]$$

---

## 3. Bounded Regime Thresholds

The regime classifier categorizes each cross-venue evaluation into one of four states based on empirical micro-window activity:

| Regime | Price Change Rate Threshold | Realized Volatility Threshold | Qualitative Description |
|---|---|---|---|
| **`LOW`** | $< 1.0\text{ bps/s}$ | $< 2.0\text{ bps}$ | Stationary order book, tight bid-ask spread, minimal price drift |
| **`NORMAL`** | $1.0 - 3.0\text{ bps/s}$ | $2.0 - 5.0\text{ bps}$ | Standard continuous trading with regular order turnover |
| **`ELEVATED`** | $3.0 - 8.0\text{ bps/s}$ | $5.0 - 15.0\text{ bps}$ | Active trend or localized burst of liquidity sweeps |
| **`HIGH`** | $> 8.0\text{ bps/s}$ | $> 15.0\text{ bps}$ | Rapid price shock, violent order-book adjustments, high cancel rate |

---

## 4. Empirical Regime Distribution & Observations

During the Phase 4.14 observation campaign, the market exhibited both stationary and active micro-states:

| Volatility Regime | Evaluation Count ($N$) | Percentage of Sample | Mean Observed Gross Spread (bps) | Max Observed Gross Spread (bps) |
|---|---|---|---|---|
| **`LOW`** | 96 | 66.7% | -6.84 bps | -3.12 bps |
| **`NORMAL`** | 0 | 0.0% | — | — |
| **`ELEVATED`** | 48 | 33.3% | -5.50 bps | -2.78 bps |
| **`HIGH`** | 0 | 0.0% | — | — |
| **Total** | **144** | **100.0%** | **-6.39 bps** | **-2.78 bps** |

---

## 5. Volatility Comparison & Cross-Venue Behavior

1. **Observed Association**:
   - In the `LOW` volatility regime (e.g. Round 1, price change rate $\approx 0\text{ bps/s}$), the gross spread hovered between $-11.33\text{ bps}$ and $-3.12\text{ bps}$ (mean $-6.84\text{ bps}$).
   - In the `ELEVATED` volatility regime (e.g. Round 2, price change rate $= 4.88\text{ bps/s}$), CEX prices shifted rapidly, narrowing the gap slightly to $-2.78\text{ bps}$ (mean $-5.50\text{ bps}$).
2. **Gross Dislocations Did NOT Exceed Baseline**:
   - Even during the `ELEVATED` burst, the maximum gross spread remained strictly negative ($-2.7754\text{ bps}$).
   - At no point did the gross spread turn positive, let alone exceed the historical Phase 4.13B REST baseline of $+0.3506\text{ bps}$.
3. **No Causal Inferences**:
   - In accordance with SAHIKARA research directives, we report an *observed association* between volatility and gross spread distribution. We do not assert that volatility causes arbitrage dislocations or that CEX movements mechanically drive DEX adjustments.
