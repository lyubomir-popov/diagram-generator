# Spec 011 – Figma autolayout fidelity

**Branch**: `feat/011-figma-autolayout-fidelity`  
**Created**: 2026-06-03  
**Status**: Complete (2026-06-03)

## North star

The TypeScript layout engine in `packages/layout-engine/` targets a **faithful port of Figma autolayout semantics**. Interactive preview and future `design-foundry` integration use this engine exclusively. Python layout is legacy — **no new layout or measure features land in Python**.

Deviations from Figma behavior require an explicit documented exception in this spec or `DIAGRAM.md`.

## Why Python only round-trips `max_width_chars` (not measure)

| Layer | Responsibility |
|-------|----------------|
| **TS** (`text-layout.ts`, `layout.ts`) | Default 66ch, wrap width, HUG measure, HarfBuzz |
| **Python** (`frame_loader.py`, `frame_yaml_persistence.py`) | Parse/serialize YAML fields only so saved diagrams and CI fixtures keep the value |

Python `layout_v3.py` does **not** implement spec 011 measure semantics. Batch SVG and `/preview/*.svg` use **TS export** (`export-frame-svg.mjs` / `preview_ts_export.py`). No Python SVG fallback on preview (spec 012 T060a).

## Problem

HUG-sized text boxes wrapped at hardcoded `BLOCK_WIDTH` (192px). Figma instead:

1. Applies an optional **max width** (designer-set or default typographic measure)
2. Wraps text at that max width
3. Hugs the resulting **multi-line block** (width = longest line, height = stacked lines)

Default measure: **66 characters** (Bringhurst ~45–75ch).

## User scenarios

### US1 – Default typographic max width (P1)

**Given** a text-bearing leaf with no explicit `max_width` or `max_width_chars`, **When** layout runs, **Then** text wraps at 66 characters (HarfBuzz) and the box hugs the wrapped block.

### US2 – Figma-style HUG width (P1)

**Given** `sizing_w: hug` and text content, **When** measured, **Then** width equals longest wrapped line + padding (+ icon column). **Given** `max_width_chars: 0`, **When** layout runs, **Then** text does not wrap at a char cap (unbounded single line).

### US3 – Explicit overrides (P1)

**Given** explicit `max_width` (px) or `max_width_chars`, **When** layout runs, **Then** that value takes priority over the default 66. Px max wins over char measure when both are set.

### US4 – Parent placement constraints (P1)

**Given** FILL or FIXED width from parent placement, **When** remeasure runs, **Then** wrap width uses the resolved placement width.

### US5 – Inspector defaults (P2)

**Given** a text-bearing HUG frame in the preview editor, **When** the inspector opens, **Then** `max_width_chars` shows 66, derived `max_width` (px) uses the **live HarfBuzz adapter**, and Max chars is disabled when explicit Max W (px) is set.

### US6 – FILL constraint fields (P1)

**Given** `sizing_w: fill` or `sizing_h: fill`, **When** the inspector opens, **Then** Min W / Max W (width axis) or Min H / Max H (height axis) are always shown, independent of text content.

### US7 – TS batch SVG export (P1)

**Given** a v3 frame YAML, **When** `node packages/layout-engine/scripts/export-frame-svg.mjs --slug <name>` or preview server serves `v3:*.svg`, **Then** layout and SVG are produced by the TS engine + HarfBuzz (not `layout_v3.py`).

## Non-goals (this spec)

- Full Figma justify/align matrix audit
- Python layout parity for measure logic
- Full icon SVG embedding in TS export (placeholder rect until icon port)

## References

- Figma auto-layout: text auto-width vs fixed width, max width on text nodes
- Robert Bringhurst, *The Elements of Typographic Style*
- Spec 005, Spec 010
