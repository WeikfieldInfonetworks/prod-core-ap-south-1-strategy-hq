# Fifty Percent Full Spectrum V4 PE

**File:** `strategies/FPFS-v4-PE.js`  
**Class:** `FPFSV4PE`  
**Registered name:** `Fifty Percent Full Spectrum V4 PE`

This strategy is a **line-for-line sibling** of [Fifty Percent Full Spectrum V4](./strategy-fpfs-v4.md) (`FPFS-v4.js`) with two categories of differences:

1. **Identity** — class name, log strings, and **`this.name`** reflect the **PE** variant so it appears as a **separate selectable strategy** in Strategy HQ.
2. **Instrument filtering** — during **UPDATE**, price/peak/scenario maintenance runs **only for tokens listed in `universalDict.peTokens`**, not CE.

## Behavioral impact of PE-only filtering

In **`processUpdateBlock`**, the full-spectrum file updates secondary metrics when:

```text
ceTokens.includes(token) || peTokens.includes(token)
```

The PE variant narrows this to:

```text
peTokens.includes(token)
```

**Consequences:**

- **Call (CE)** legs still exist in **`instrumentMap`** for INIT selection and pairing logic, but **do not receive the same rolling peak/drop/scenario updates** as in the combined V4 file unless another code path touches them.
- Operators typically choose this variant when the trading thesis is **PUT-centric** and CE data should not drive fifty-percent style transitions.

## Numeric parsing hardening

Compared to base `FPFS-v4.js`, the PE file uses **`parseFloat`** (and **`toFixed(2)`** where averages are stored) in several **rebuy / change-from-buy** calculations to avoid string/number quirks from broker or map data.

If you patch scenario math in one FPFS file, **mirror the change** in V4, CE, and PE unless the fix is intentionally single-sided.

## Parameters and blocks

Identical schema to **`FPFS-v4.js`**:

- Same **`getGlobalDictParameters`** and **`getUniversalDictParameters`**
- Same **INIT / UPDATE / DIFF10 / NEXT_CYCLE** structure

Refer to [strategy-fpfs-v4.md](./strategy-fpfs-v4.md) for full parameter tables and narrative.

## See also

- [strategy-fpfs-v4-ce.md](./strategy-fpfs-v4-ce.md) — CE-only mirror.
- [WORKFLOW.md](./WORKFLOW.md) — Runtime wiring.
