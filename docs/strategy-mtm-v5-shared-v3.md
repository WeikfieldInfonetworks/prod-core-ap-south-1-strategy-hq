# MTM V5 Shared Strategy V3 and V3 Anti

This document covers both **`MTM V5 Shared Strategy V3`** (`strategies/mtm-v5-shared-v3.js`, class `MTMV5SharedStrategyV3`) and **`MTM V5 Shared Strategy V3 Anti`** (`strategies/mtm-v5-shared-v3-anti.js`, class `MTMV5SharedStrategyV3Anti`). They implement a **mark-to-market (MTM)** style workflow with **interim low** detection, **prebuy** flows, multi-leg exits (including **+24 / -36 / -10** style milestones), **rebuy** handling, and rich **scenario** flags (1A–1F, SL4, SL5, etc.).

## Purpose and positioning

- **V3** is the primary variant: default internal mode is **`REGULAR`**; it can switch to **`ANTI`** when **`universalDict.useOppositeStrategy`** is `true` (see [Mode: REGULAR vs ANTI](#mode-regular-vs-anti)).
- **V3 Anti** is a separately registered strategy with the **same overall state machine and blocks**, but the **default strategy mode is `ANTI`**, and the **`useOppositeStrategy` mapping is inverted** relative to V3 (see below). Use it when operators want the Anti behavior **without** relying on the same toggle semantics as the main V3 strategy.

Both strategies:

- Extend **`BaseStrategy`** and use **`StrategyUtils`** for sequential filtering, token/symbol helpers, and logging.
- Use **`TradeQueue`** (`collection-framework/TradeQueue.js`) to enqueue deferred trade steps where the implementation requires queued execution.
- Rely on **`TradingUtils`** injected by **`UserStrategyManager`** for live orders; **`enableTrading`** in **`universalDict`** gates real broker calls vs paper-style logging.

## Registration and names

| Property | V3 | V3 Anti |
|----------|----|---------|
| **`this.name`** | `MTM V5 Shared Strategy V3` | `MTM V5 Shared Strategy V3 Anti` |
| Initial **`defaultStrategy`** | `"REGULAR"` | `"ANTI"` |

The server registers strategies by **`strategy.name`** when scanning `strategies/*.js`.

## Tick loop overview

On each batch, **`processTicks`**:

1. Increments **`tickCount`**, logs batch size and **`universalDict.cycles`**.
2. Runs cross-cutting checks: **`checkCommonParameters`**, **`checkResidual`**, **`checkGalacticCompletionState`**, **`checkGalacticOppositeStrategy`**, **`checkBookMark`** (or commented variants in some builds).
3. Dispatches **one or more blocks** in the same tick using **non-exclusive `if` chains** (multiple blocks may run in one batch when flags allow).
4. Calls **`emitInstrumentDataUpdate()`** for dashboard-oriented payloads.

### Block state machine

Boolean flags **`blockInit`**, **`blockUpdate`**, **`blockFinalRef`**, **`blockRef3`**, **`blockDiff10`**, **`blockNextCycle`** select which processors run:

| Block | Typical role |
|-------|----------------|
| **INIT** (`blockInit`) | Cycle/instance setup, rebuy/completion bookkeeping, token universe acceptance, transition out of init when instruments and gates are satisfied. |
| **UPDATE** (`blockUpdate`) | Maintains **`instrumentMap`** from ticks; tracks prebuy lows, peaks, **`cycleInfo`** fields; runs **`strategyUtils.applySequentialFilterFlow`** until **`interimLowReached`** (unless disabled/skipped); may transition to FINAL_REF. |
| **FINAL_REF** (`blockFinalRef`) | Captures reference around interim low / ref logic; coordinates buying phases when **`buyingCompleted`** is false. |
| **REF3** (`blockRef3`) | Additional reference/refinement stage after final ref (exact conditions are encoded in `shouldTransitionToRef3` / related helpers). |
| **DIFF10** (`blockDiff10`) | Post-ref trading logic: MTM milestones, sells, buy-backs, scenario branches, stop/target handling across CE/PE legs. |
| **NEXT_CYCLE** (`blockNextCycle`) | Resets state for **`universalDict.cycles`**, clears flags, returns toward INIT for a new cycle. |

Exact transitions depend on predicates such as **`shouldTransitionToFinalRef`**, **`shouldTransitionToRef3`**, completion of buying, **`interimLowReached`**, **`calcRefReached`**, and scenario completion flags.

## Mode: REGULAR vs ANTI

Throughout **UPDATE**, both files set **`defaultStrategy`** from **`universalDict.useOppositeStrategy`**, but **the mapping differs**:

**V3** (`mtm-v5-shared-v3.js`):

- `useOppositeStrategy === true` → **`defaultStrategy = "ANTI"`**
- `useOppositeStrategy === false` → **`defaultStrategy = "REGULAR"`**

**V3 Anti** (`mtm-v5-shared-v3-anti.js`):

- `useOppositeStrategy === true` → **`defaultStrategy = "REGULAR"`**
- `useOppositeStrategy === false` → **`defaultStrategy = "ANTI"`**

So the Anti **strategy file** flips the interpretation of the same boolean. Operators should treat **`useOppositeStrategy`** as a **mode switch** whose meaning depends on **which registered strategy name** they selected.

Downstream branches that key off **`defaultStrategy`** (and related scenario code) therefore see **opposite modes** for the same toggle value between the two strategy entries.

## Key state concepts

- **`mainToken` / `oppToken` / `boughtToken` / `prebuyBoughtToken`** — Active legs for MTM and prebuy tracking.
- **`cycleInfo`** — Serializable snapshot fields (e.g. **`lowBeforeRebuy`**, **`oppositeSymbol`**, **`lowBeforeTarget`**, **`rebuy_value`**, **`target`**) used for analytics, UI, and completion announcements.
- **MTM milestone flags** — Examples: **`mtmSoldAt24`**, **`mtmSoldAt36`**, **`mtmSoldAt10`**, **`mtmBuyBackInstrument`**, prices at sell times, assisted targets.
- **Scenario flags** — **`scenario1Adone`** … **`scenario1FAdone`**, **`scenarioSL4Done`**, **`scenarioSL5Done`**, etc., serialize branching recovery paths.
- **`galactic` / opposite / bookmark** helpers — Support multi-cycle coordination and “opposite strategy” announcements (`announceGalacticOppositeStrategy`, `checkGalacticOppositeStrategy`, …).

## Parameters (configuration)

### `globalDict` (via `getGlobalDictParameters`)

Includes risk and structural knobs, for example:

- **`stoploss`**, **`realBuyStoploss`**, **`microStoplossControl`**, **`microRebuyControl`**
- **`peakDef`**, **`peakAndFallDef`**, **`upperLimit`**
- **`halfTargetThreshold`**
- **`skipAfterCycles`** — After enough **`universalDict.cycles`**, INIT may adjust behavior (e.g. peak definition / trading pressure).

*Note:* In **`initialize`**, defaults are applied with a pattern that **always overwrites** from schema defaults (`|| true` on the undefined check). Treat **`globalDict`** as **reset toward defaults on each `initialize`** unless you change that logic.

### `universalDict` (via `getUniversalDictParameters`)

Includes:

- **`usePrebuy`**, **`expiry`**, **`residual`**, **`cycles`**
- **`peakDefInCurrentCycle`**, **`peakDefAfterFirstCycle`**
- **`quantity`**, **`extraPairs`**
- **`mtmTarget`**, **`target`**, **`rebuyAt`**
- **`exitAtFirstBuy`**, **`exitAtNegativeRebuy`**, **`buySame`**, **`enableExitAfterRebuy`**
- **`enableMTM`**, **`useOppositeStrategy`**, **`goingLiveInFirstCycle`**
- **`disableSecondTrade`**
- **`enableTrading`**, **`enableTradingForNextCycle`**, **`enableManualEntry`**, **`enterNow`**

**Special case — `updateUniversalDictParameter` on V3:**

- If **`parameter === 'useOppositeStrategy'`** and **`actualRebuyDone`** is true, the update **returns early** (`true`) without applying the change (silent guard).

V3 Anti’s version of this method should be compared in-repo if rebuy locking semantics diverge.

## Realtime and UI

- **`getConfig()`** returns a large snapshot: tokens, MTM flags, block flags, **`universalDict`**, buy/sell completion, etc., for **`node_update`** payloads.
- **`updateGlobalDictParameter`** / **`updateUniversalDictParameter`** emit **`emitStatusUpdate`** for important MTM knobs (targets, stoploss, sell limits, **`enableTrading`**, **`interimLowDisabled`**, etc.).
- **`emitBlockTransition`** notifies the UI when moving between major blocks (e.g. UPDATE → FINAL_REF).

## Files and maintenance

- **V3**: `strategies/mtm-v5-shared-v3.js` (~4700+ lines)
- **V3 Anti**: `strategies/mtm-v5-shared-v3-anti.js` (parallel structure; diff for regressions)

When fixing bugs, **apply parallel fixes** to both files unless the change is intentionally mode-specific.

## See also

- [WORKFLOW.md](./WORKFLOW.md) — Server tick pipeline and dictionary model.
