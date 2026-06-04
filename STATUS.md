# Status

**Last updated:** 2026-06-04  
**Branch:** `main` @ `2f78098` (pushed to `origin/main`)

## Stakeholder path

Making a diagram for a review or deck: **[`docs/stakeholder-guide.md`](docs/stakeholder-guide.md)** — copy a frame YAML, run `python scripts/preview_server.py`, open `/view/v3:<slug>`, save and optionally export SVG.

## What this repo is

`diagram-generator` is a constrained interactive diagram editor that turns frame YAML into on-brand SVG and draw.io outputs. It owns the single autolayout codebase in the workspace (`packages/layout-engine/`, TypeScript), eventually porting to `design-foundry` as `@design-foundry/operator-autolayout`. See `../design-foundry/PIVOT.md`.

**TypeScript is the implementation language** for layout, measure, and SVG export. Python is narrowing to YAML persistence helpers and legacy batch code being retired under spec 012.

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
| **Batch SVG** | `export-frame-svg.mjs` — boxes, text, **real icons** (T020); simple elbows; arrows/overlays parity in progress |
| **Tests** | 224 TS layout-engine (vitest); Python suite for YAML/legacy parity |

### Active focus — spec 012

Finish **TS-only render runtime** (not “move to YAML” — YAML is already authoritative):

- [x] T060a — preview server: no Python SVG fallback  
- [x] T020 — batch icon embed (`icon-embed.ts`)  
- [ ] T030–T040 — arrow heads, overlays in `svg-render.ts`  
- [ ] T050 — golden SVG subset  
- [ ] T060b — remove `diagram_render_svg.py` from batch  

Then: spec **005** WS2, spec **008** Phase 5.

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
