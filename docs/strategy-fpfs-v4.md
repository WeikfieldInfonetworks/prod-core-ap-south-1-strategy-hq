# Fifty Percent Full Spectrum V4 (CE + PE)

**File:** `strategies/FPFS-v4.js`  
**Class:** `FPFSV4`  
**Registered name:** `Fifty Percent Full Spectrum V4`

FPFS V4 implements a **“fifty percent / full spectrum”** options strategy: it scans a **wide premium band** for both **CE and PE**, maintains a rich **`instrumentMap`**, and progresses through **INIT → UPDATE → DIFF10 → NEXT_CYCLE** blocks. It combines **prebuy**, **half-drop**, **rebuy**, and **multi-scenario recovery** paths (1A, 1B, 1C, etc.) similar in spirit to other fifty-percent family strategies in the repo history.

## Block workflow

### INIT (`blockInit`)

- Normalizes **`universalDict.cycles`**.
- If **`cycles >= skipAfterCycles`**, sets **`universalDict.enableTrading = false`** (stops new live trading after N cycles).
- Sets strike scan window from **`expiry`** weekday (`strikeBase`, `strikeDiff`, `strikeLowest`; **110** width on expiry-adjacent days in current code).
- Sorts ticks toward **`targetPrice`** (**100**).
- **`findTokensInDynamicRange`** → accepted tokens; **`separateCETokensAndPETokens`** fills **`ceTokens`** and **`peTokens`**.
- Seeds **`instrumentMap`**, **`observedTicks`**, then moves **`blockInit → false`**, **`blockUpdate → true`**.

### UPDATE (`blockUpdate`)

- Updates **`instrumentMap`** for incoming ticks.
- **Peak / drop / prebuy** machinery updates per-instrument state (half-drop token, mode state, manually added instruments, etc., depending on branch).
- For instruments in **`ceTokens` OR `peTokens`**, tracks peaks, drops, rebuy thresholds, and scenario flags.
- Eventually enables **`blockDiff10`** (exact transition is encoded in the latter portion of `processUpdateBlock`).

### DIFF10 (`blockDiff10`)

- Core trading loop: evaluates **buy/sell/rebuy** against **`globalDict.target`**, **`stoploss`**, **`rebuyAt`**, **`realBuyStoploss`**, **`prebuyStoploss`**, **`halfTargetThreshold`**, **`prebuySignificantThreshold`**, and scenario helpers.
- Uses **`instrument_bought`**, **`buyPriceOnce`**, **`prebuyBuyPriceTwice`**, **`rebuyAveragePrice`**, and **`flagSet`** (`reached_rebuy_price`, `reached_average_price`) to coordinate second entries.
- May invoke **`buyInstrument` / sell helpers** that respect **`enableTrading`**.

### NEXT_CYCLE (`blockNextCycle`)

- Resets internal flags, increments cycle counters, returns to **INIT**.

## Parameters

### `globalDict`

| Key | Default | Notes |
|-----|---------|--------|
| `target` | 12 | Profit target (points) |
| `stoploss` | -50 | Stop loss |
| `enableTrading` | false | Master live toggle |
| `dropThreshold` | 0.25 | Percent move for drop detection |
| `prebuyStoploss` | -15 | Prebuy leg stop |
| `realBuyStoploss` | -10 | Threshold to allow/force second buy path |
| `rebuyAt` | 7 | Rebuy trigger distance |
| `halfTargetThreshold` | 5 | Partial target handling |
| `prebuySignificantThreshold` | -11 | “Significant” adverse move for prebuy |
| `buySame` | false | Allow re-entry on same symbol |
| `useManuallyAddedInstruments` | false | Blend manual token list |
| `manuallyAddedInstruments` | `''` | Encoded pairs string |
| `setNoPrebuyStrategy` | false | Alternative half-drop configuration |
| `quantity` | 65 | Order size |

### `universalDict`

| Key | Default | Notes |
|-----|---------|--------|
| `expiry` | 2 | Expiry weekday index |
| `skipAfterCycles` | 2 | After this many cycles, disable trading in INIT |
| `usePrebuy` | false | Toggle prebuy path |

## Realtime hooks

- Parameter updates emit **`emitStatusUpdate`** for **`enableTrading`**, **`cycles`**, **`expiry`**, and key **`globalDict`** fields (`target`, `stoploss`, `quantity`).
- **`emitInstrumentDataUpdate`** is overridden to **`return null`** in this file (no MTM-style instrument push from base helper).

## Variants: PE-only and CE-only

The same algorithm is specialized in:

- [strategy-fpfs-v4-pe.md](./strategy-fpfs-v4-pe.md) — tracks **PE tokens only** in UPDATE.
- [strategy-fpfs-v4-ce.md](./strategy-fpfs-v4-ce.md) — tracks **CE tokens only** in UPDATE.

Use those when you want **single-side** premium books while keeping scenario logic aligned with V4.

## See also

- [WORKFLOW.md](./WORKFLOW.md) — Dictionary and socket overview.
