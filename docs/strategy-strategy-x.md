# Strategy X

**File:** `strategies/strategy-x.js`  
**Class:** `StrategyX`  
**Registered name:** `Strategy X`

Strategy X is a **dual-option (CE + PE)** playbook built around **strike selection from live ticks**, an **UPDATE** phase that hydrates an **`instrumentMap`**, and a **DIFF10** phase that runs **three phased buy/sell sequences** (phase 1–3) with explicit completion flags. It is aimed at **short-term option swings** using proximity to a **reference premium** (implementation uses a fixed sort target of **100** in INIT).

## Design summary

1. **INIT (`blockInit`)**  
   - Optionally caps behavior when **`universalDict.cycles >= 2`** (`enableTrading` forced false).  
   - Sets **`strikeBase` / `strikeDiff` / `strikeLowest`** from weekday vs **`universalDict.expiry`**.  
   - Sorts ticks by distance to **`targetPrice`** (currently **100**).  
   - **`findTokensInDynamicRange`** selects **accepted** instrument tokens; **`separateCETokensAndPETokens`** splits CE vs PE.  
   - Requires **at least one CE and one PE**; builds **`observedTicks`** ordered by premium; then **`blockInit = false`**, **`blockUpdate = true`**.

2. **UPDATE (`blockUpdate`)**  
   - Stamps **`globalDict.timestamp`**.  
   - For each tick, ensures **`instrumentMap[token]`** exists with first/last price, peaks, calc-ref fields, buy tracking, etc.  
   - On first entry, sets **`initialDIFF10entry`**, enables **`blockDiff10`**, disables **`blockUpdate`** path for the DIFF10 transition (see code: `blockDiff10 = true` after first update).

3. **DIFF10 (`blockDiff10`)**  
   - Resolves **`mainToken`** (closest **CE** above price band) and **`oppToken`** (closest **PE** above price band) via **`StrategyUtils`**.  
   - Binds **`mainInstrument`** / **`oppInstrument`**.  
   - While **`boughtSold`** is false, evaluates **`shouldPhaseNBuy/Sell`** guards and runs **`phaseNBuy` / `phaseNSell`** (`async` order flow).  
   - When **`boughtSold`** becomes true: **`blockDiff10 = false`**, **`blockNextCycle = true`**, emits strategy update with **`cycle_completion_data`**.

4. **NEXT_CYCLE (`blockNextCycle`)**  
   - **`resetForNextCycle()`**: increments **`universalDict.cycles`**, clears phase flags, tokens, instruments, resets blocks to **INIT** only.

## Tick gating

**`processTicks`** only runs block logic after **`tickCount >= 10`**, so the first batches warm up counters while the market snapshot stabilizes.

## Parameters

### `globalDict` (`getGlobalDictParameters`)

| Key | Default (schema) | Role |
|-----|------------------|------|
| `target` | 9 | Primary profit target (points) |
| `stoploss` | -100 | Stop loss (points) |
| `dropThreshold` | 0 | Drop threshold (% points) |
| `secondBuyThreshold` | 19 | Second leg buy threshold |
| `secondTarget` | 16 | Second leg target |
| `thirdBuyThreshold` | 31 | Third leg buy threshold |
| `thirdTarget` | 50 | Third leg target |
| `quantity` | 65 | Order quantity |

### `universalDict` (`getUniversalDictParameters`)

| Key | Default | Role |
|-----|---------|------|
| `expiry` | 2 | Weekday index for expiry-aware strike setup (see in-file comments; align with your calendar convention) |
| `enableTrading` | false | Live vs paper-style behavior inside buy/sell helpers |

## Logging and user context

- **`setUserInfo`** forwards to **`StrategyUtils`**; log lines may refer to **“20 Pair Strategy”** internally while the registered **`name`** remains **`Strategy X`**.
- **`updateGlobalDictParameter` / `updateUniversalDictParameter`** call `super` and log changes.

## Realtime / `getConfig`

`getConfig()` exposes:

- Tokens and instruments (**`mainToken`**, **`oppToken`**, **`mainInstrument`**, **`oppInstrument`**, **`lockedQuantity`**)
- Block flags and phase completion booleans
- Full **`universalDict`** for dashboards

## See also

- [WORKFLOW.md](./WORKFLOW.md) — How ticks reach this strategy.
- [strategy-fpfs-v4.md](./strategy-fpfs-v4.md) — Cousin “full spectrum” fifty-percent style flow with a different block graph.
