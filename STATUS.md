# Status

**Last updated:** 2026-06-05  
**Branch:** `main` @ `e45bd18` + local runtime dist-fix edits

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
| **Authoring** | Frame YAML in `scripts/diagrams/frames/` — **only** source of truth (11 canonical invariant-pack diagrams) |
| **Interactive preview** | TS layout via `layout-bridge.js` + HarfBuzz; save → YAML via `frame_yaml_persistence.py` |
| **Preview APIs** | TS-only: frame-tree, grid, component tree (`preview_ts_layout.py`) |
| **Live preview SVG** | TS-only Node export (`preview_ts_export.py`); no Python SVG renderer (spec 012) |
| **Batch SVG** | `export-frame-svg.mjs` — TS-only (`svg-render.ts`); golden harness `tests/svg-golden.test.ts` (3 canonical slugs after the first pruning pass) |
| **Tests** | 241 TS vitest (229 pass; 12 known `test-deep-nesting` width parity failures). Focused preview browser regressions green; `test_preview_frames_dir.py` and `test_preview_ts_api.py` green. Full `pytest scripts -q` still has legacy parity drift outside the active TS path |

### Current delta — runtime dist freshness fix (2026-06-05)

- `export-frame-svg.mjs`, `emit-frame-diagram-json.mjs`, and sibling Node CLIs now auto-rebuild `packages/layout-engine/dist/` when TS source is newer than the requested dist artifact, so the active runtime no longer drifts behind source edits.
- Added runtime regressions in `scripts/test_preview_frames_dir.py` proving the live DTO/export scripts strip retired line-level style fields rather than only the source-level unit tests doing so.
- Force routes and the orphaned benchmark now fail explicitly: `preview_server.py` returns a clear backend-unavailable response for `/force` surfaces when `force_preview.py` is absent, and `benchmark_force.py` exits with migration guidance instead of a raw `ModuleNotFoundError` traceback.

### Recent work — spec 012 complete + arrow editing (2026-06-04)

Commit **`a6822da`** (`scripts: land ts svg renderer cleanup`):

- **Spec 012 closed:** TS-only SVG runtime; `diagram_render_svg.py` removed; golden SVG harness + fixtures; agent docs refreshed (T070).
- **Arrow editing:** Arrows in `ComponentModel`; segment hit areas; `arrowComponentId` parity with `svg-render.ts`; double-click waypoint + clear-override routing tests green.
- **Spec 019:** Inspector deduped; id in Auto-layout heading.
- **Headed-container contract:** one `gap` per container (header/body split is internal; body gap derives from composition and there is no `stack_gap` compatibility path).
- **Audit snapshot:** TS preview tests green (`11/11`), full TS suite still only has the known 12 `test-deep-nesting` parity failures, and Python red state is confined to stale legacy `scripts/test_parity.py` reconstruction logic rather than the active TS preview/render path.

### Active focus

| Priority | Work |
|----------|------|
| Now | Spec **020** lean variant-only style authority + fixture-pruning rewrite |
| Next | Spec **005** WS2–WS5 (style ownership, heading/body docs, padding parity) |
| Parallel | Spec **021** arrow labels use annotation variant — landed |
| Parallel | Spec **018** PNG export |
| Parallel | Re-scope Spec **008** Phase 5 so it does not deepen Python authority |
| Next major slice | New TS force-layout restoration spec |

## Key files

| Purpose | File |
|---------|------|
| TS layout engine | `packages/layout-engine/` |
| TS SVG export | `packages/layout-engine/src/svg-render.ts`, `src/icon-embed.ts` |
| Golden SVG tests | `packages/layout-engine/tests/svg-golden.test.ts`, `tests/svg-golden-harness.ts` |
| Browser relayout | `scripts/preview/layout-bridge.js` |
| Editor UI | `scripts/preview/editor.js` |
| Preview server | `scripts/preview_server.py` |
| Frame YAML | `scripts/diagrams/frames/*.yaml` |
| Visual contract | `DIAGRAM.md` |
| Stakeholder how-to | `docs/stakeholder-guide.md` |

## Critical invariants

- `DIAGRAM.md` governs tokens and output constraints.  
- Deliverable SVG: Illustrator-safe (no `<symbol>`, `<use>`, external `<image href>`, marker refs).
- Headed containers: author **one gap** per container; do not reintroduce separate header/body gap controls in the inspector.
