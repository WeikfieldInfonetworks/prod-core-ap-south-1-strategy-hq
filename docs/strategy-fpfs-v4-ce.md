# Fifty Percent Full Spectrum V4 CE

**File:** `strategies/FPFS-v4-CE.js`  
**Class:** `FPFSV4CE`  
**Registered name:** `Fifty Percent Full Spectrum V4 CE`

This file mirrors [Fifty Percent Full Spectrum V4](./strategy-fpfs-v4.md) (`FPFS-v4.js`) with:

1. **CE-specific branding** — distinct class name, console logs, and **`this.name`** for the strategy picker.
2. **CE-only rolling updates** — in **`processUpdateBlock`**, secondary instrument metrics advance **only** when `universalDict.ceTokens.includes(token)`.

## Why a CE-only variant exists

The full-spectrum parent updates both sides:

```text
ceTokens.includes(token) || peTokens.includes(token)
```

The CE edition restricts maintenance to:

```text
ceTokens.includes(token)
```

Use it when the strategy should **react primarily to call premiums** (e.g. directional call books) while still constructing a paired universe during INIT.

## Numeric coercion

Like the PE variant, CE adds **`parseFloat`** / **`toFixed(2)`** in rebuy and P&L delta calculations to normalize types coming from **`instrumentMap`** or execution results.

Keep **FPFS-v4.js**, **FPFS-v4-PE.js**, and **FPFS-v4-CE.js** in sync for bugfixes unless the change is deliberately scoped to one listing.

## Configuration

Parameter definitions match **`FPFS-v4.js`** exactly; see [strategy-fpfs-v4.md](./strategy-fpfs-v4.md).

## See also

- [strategy-fpfs-v4-pe.md](./strategy-fpfs-v4-pe.md) — PE-only counterpart.
- [WORKFLOW.md](./WORKFLOW.md) — Server and dictionary model.
