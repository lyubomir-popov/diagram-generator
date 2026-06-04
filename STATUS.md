# Status

**Last updated:** 2026-06-05  
**Branch:** `main` @ `edcf6ca`

## Stakeholder path

Making a diagram for a review or deck: **[`docs/stakeholder-guide.md`](docs/stakeholder-guide.md)** — copy a frame YAML, run `python scripts/preview_server.py`, open `/view/v3:<slug>`, save and optionally export SVG.

## What this repo is

`diagram-generator` is a constrained interactive diagram editor that turns frame YAML into on-brand SVG and draw.io outputs. It owns the single autolayout codebase in the workspace (`packages/layout-engine/`, TypeScript), eventually porting to `design-foundry` as `@design-foundry/operator-autolayout`. See `../design-foundry/PIVOT.md`.

**TypeScript is the implementation language** for layout, measure, and SVG export. Python is narrowing to YAML persistence helpers and layout parity tests (`layout_v3.py`).

## Project context

**Stream E** (constrained editor) under [DE-941](https://warthogs.atlassian.net/browse/DE-941):

| Layer | Tool |
|-------|------|
| Strategic | Jira DE-941 |
| Working surface | Coda (`diagram-generator-planning`) |
| Execution | spec-kit `specs/` + `TODO.md` |

## Current state (engineering)

| Area | State |
|------|--------|
| **Authoring** | Frame YAML in `scripts/diagrams/frames/` — **only** source of truth (32 diagrams) |
| **Interactive preview** | TS layout via `layout-bridge.js` + HarfBuzz; save → YAML via `frame_yaml_persistence.py` |
| **Preview APIs** | TS-only: frame-tree, grid, component tree (`preview_ts_layout.py`) |
| **Live preview SVG** | TS-only Node export (`preview_ts_export.py`); no Python SVG fallback (spec 012 T060a) |
| **Batch SVG** | `export-frame-svg.mjs` — TS-only (`svg-render.ts`); golden tests in `tests/svg-golden.test.ts` |
| **Tests** | 240 TS layout-engine (vitest); Python suite (46 tests) for YAML/legacy parity |

### Recent work — spec 012 close-out + inspector (2026-06-05)

- **T050:** Golden SVG regression harness — 6 corpus slugs, `UPDATE_SVG_GOLDEN=1` refresh path.
- **T060b:** Deleted `scripts/diagram_render_svg.py`; no Python code emits diagram SVG.
- **Spec 019:** Inspector no longer duplicates Component / position / size / layout rows; id shown in Auto-layout heading.
- **Arrow editing:** Arrows indexed in `ComponentModel`; preview selection uses segment hit areas + `arrowComponentId` parity with `svg-render.ts`.

### Prior — gap semantics + inspector (2026-06-04)

Adversarial review complete. Composer work verified and one bug found + fixed:

- **Headed-container spacing contract**: headed containers author one gap per container. The header/body split is internal structure, the body keeps child items grouped, and nesting stays simpler because each container contributes one gap value.
- **Legacy stack-gap plumbing**: the loader/preview path still carries `stack_gap` support from earlier work, but the active authoring contract is the single-gap headed-container model above.
- **Inspector**: primary single-select cleanup landed; Auto-layout remains the main editing surface and headed containers intentionally keep a single `Gap` control.
- **android-custom-to-cloud**: Correct structure — 4 sections, leaf text labels, 3 arrows. No wrapper panels.
- **15 files** uncommitted (composer work + bug fix). Pre-existing parity failures: 12 TS (`test-deep-nesting` width), 5 Python (`__body` frame ID).

### Active focus — spec 012

Finish **TS-only render runtime** (not “move to YAML” — YAML is already authoritative):

- [x] T060a — preview server: no Python SVG fallback  
- [x] T020 — batch icon embed (`icon-embed.ts`)  
- [x] T030–T040 — arrow heads, overlays in `svg-render.ts`  
- [x] T050 — golden SVG subset (`tests/svg-golden.test.ts`, 6 corpus slugs)  
- [x] T060b — removed `diagram_render_svg.py` (TS-only SVG emit)  
- [ ] T070 — agent docs + `docs/specs.md` (close 012)

Then: spec **018** PNG export, spec **005** WS2, spec **008** Phase 5.

## Key files

| Purpose | File |
|---------|------|
| TS layout engine | `packages/layout-engine/` |
| TS SVG export | `packages/layout-engine/src/svg-render.ts`, `src/icon-embed.ts` |
| Browser relayout | `scripts/preview/layout-bridge.js` |
| Editor UI | `scripts/preview/editor.js` |
| Preview server | `scripts/preview_server.py` |
| Frame YAML | `scripts/diagrams/frames/*.yaml` |
| Visual contract | `DIAGRAM.md` |
| Stakeholder how-to | `docs/stakeholder-guide.md` |

## Critical invariants

- `DIAGRAM.md` governs tokens and output constraints.  
- Deliverable SVG: Illustrator-safe (no `<symbol>`, `<use>`, external `<image href>`, marker refs).
