# Spec 012 – TypeScript SVG renderer (retire `diagram_render_svg.py`)

**Branch**: `feat/012-ts-svg-renderer-retire-python`  
**Created**: 2026-06-03  
**Status**: In progress (T010 gap inventory done)  
**Depends on**: Spec 011 (TS layout + minimal `svg-render.ts`)

## Mission

Replace `scripts/diagram_render_svg.py` and the Python primitive render path with a **full-fidelity TypeScript SVG renderer** in `packages/layout-engine/`. After this spec ships, **no Python code emits diagram SVG**.

Frame YAML remains the **only authored source of truth**. Layout and render are derived operations in TS.

## Problem

Spec 011 introduced `svg-render.ts` and `export-frame-svg.mjs` for layout + basic boxes/text/icons-placeholder/arrows. Preview and batch still fall back to `diagram_render_svg.py`, which implements:

- Real icon SVG embedding (`load_icon`)
- Arrow heads, labels, waypoint styling
- Overlays, separators, matrix tiles, terminal chrome
- Grid overlay metadata in SVG
- Ontology metadata block

Two renderers means drift (spec 011 already proved measure drift when Python laid out).

## User scenarios

### US1 – Batch export parity (P1)

**Given** any v3 frame YAML in `scripts/diagrams/frames/`, **When** `export-frame-svg.mjs` runs, **Then** output matches current Python SVG within agreed tolerances (geometry ±0.5px, same structure/classes).

### US2 – Preview server no Python render (P1)

**Given** preview requests `v3:<slug>.svg`, **When** TS export succeeds, **Then** Python `diagram_render_svg` is never invoked.

### US3 – Delete Python renderer (P1)

**Given** US1–US2 pass, **When** the spec closes, **Then** `diagram_render_svg.py` is deleted and no import references remain.

## Scope

| In scope | Out of scope |
|----------|----------------|
| Port primitive emitters from `diagram_layout` + `diagram_render_svg` to TS | draw.io export |
| HarfBuzz text in SVG tspans (small caps, letter-spacing) | New visual styles |
| Icon fetch/embed from `assets/icons/` | Figma plugin |
| Arrow routing reuse from `layout-bridge.js` (lift to shared TS module) | Python layout |

## Deliverables

1. `packages/layout-engine/src/svg-render/` (or expanded `svg-render.ts`) — full primitive coverage
2. Golden SVG tests (selected corpus slugs)
3. Remove `diagram_render_svg.py`, drop preview_server fallback
4. Update `copilot-instructions.md`, `STATUS.md`, spec 008 migration notes

## Success criteria

- `node packages/layout-engine/scripts/export-frame-svg.mjs --slug <each corpus slug>` exits 0
- Preview server grep shows zero `import diagram_render_svg`
- Python test suite adjusted: drop renderer tests or replace with TS golden harness
