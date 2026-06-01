# Status

## Before you start

**Read the playbook first.** Do not skip:

1. `.github/copilot-instructions.md` — workflow discipline and anti-patch protocol
2. `DIAGRAM.md` — the canonical diagram-language contract (colors, typography, layout, components)
3. Use the v3 frame-engine workflow in `.github/agents/agent.md` — do not route work through deleted pipelines.

## What this repo is

`diagram-generator` is the active workspace for rebuilding rough sketches and inconsistent diagrams into on-brand, editable draw.io and SVG outputs. It owns the current diagram rules, the batch renderers, and the review artifacts for the refreshed starter-block system.

## Current state

The repo's live interactive path is **v3 autolayout** with **TypeScript local-only relayout**. Browser measurement is HarfBuzz-backed, and the editor does not fall back to a Python relayout endpoint.

Canonical authored state is **frame YAML**. Save/load writes supported edits back into the YAML directly. There is no JSON sidecar authority for v3 diagram state.

Python remains intentionally narrow: YAML parsing/defaults, batch/export rendering, and parity-oracle coverage. It is not the interactive relayout executor.

Frame-class semantics are authored in [`docs/frame-classes.md`](docs/frame-classes.md) and implemented in both TS and Python. There is no hand-authored JSON contract for frame/editor semantics.

**Active focus (2026-06-01):** `specs/009-client-side-ts-rendering/` Phases 1–3 complete (T001–T012). The preview editor now renders SVG entirely from the TS pipeline on first load – no Python SVG fetch. `loadSVG()` calls `renderFreshSvg()` which runs resolveStyles → layoutFrameTree → renderFrameTreeToSvg in the browser. Python SVG is only used as fallback if the TS bridge fails to initialise. 3/23 diagrams browser-verified (maas-architecture, complex-routing-usecase, aws-hld). Phases 4–6 (batch validation, grid overlay, error handling) are next.

`specs/008-repo-coherence-rewrite/` has Phases 1-4 and 6-8 complete; Phase 5 (resolved style snapshot end-to-end) is deferred to a focused follow-up.

### Frame classes

Four visual treatments (section, panel, leaf, annotation) plus two specials (highlight, separator). See [`docs/frame-classes.md`](docs/frame-classes.md) for the full spec.

- **Content-width alignment:** Two-pass VERTICAL layout separates content width from outer width. Panels with borders wrap content with INSET padding; standalone boxes align to the panel's inner content corridor. All 4 vertical diagrams (request-to-hardware-stack, inference-snaps, diagram-intake-workflow, diagram-language-workflow) have flush right edges.
- **col_span/row_span:** Boxes inside panels can span multiple grid columns without explicit width overrides.
- **BOX_MIN_HEIGHT enforcement:** Single-line boxes without icons are clamped to 64px minimum.
- **Preview slot metadata:** Client-side relayout now uses server-declared `col` / `row` / span metadata plus measured gutters instead of inferring grouped slots back from child geometry.
- **BASELINE_UNIT = 8px**, **GRID_GUTTER = 24px**, **OUTER_MARGIN = 24px**, **BODY_SIZE = 18px**.
- **Autolayout review status (2026-05-13):** The durable docs now define a parent-scoped equal-split/outdent model for grouped layouts. Current implementation is clean: `equal_split_cell()` and `span_size()` are shared via `diagram_shared.py` (Python) and `editor-base.js` (JS). Both `diagram_layout.py` and `component-model.js` call the shared versions. v2 `sp_outer_w` intentionally keeps ceil rounding for backwards compatibility (documented).
- **v3 Frame engine features (2026-05-25):** HUG/FILL/FIXED per-axis sizing, 9-point alignment, justify modes (PACKED/SPACE_BETWEEN/SPACE_AROUND/SPACE_EVENLY), absolute positioning, min/max constraints, horizontal wrap mode, proportional FILL weights, border thickness in layout math, coercion visibility. Client-side TypeScript layout engine with mock and Canvas text adapters. 166 TS + 188 Python tests passing, 9 shared parity fixtures.

## Architecture status

The project has evolved from a batch diagram generator into a **constrained interactive diagram editor** – a lean Figma/draw.io that enforces brand rules while allowing targeted polish. The 4-phase architectural refactor is complete:

- **Phase A (done, commit 2eff23d):** `BoxStyle` enum, YAML/JSON diagram loader, JSON schema for agent-generated definitions.
- **Phase B (done, commit 6b7ba57):** Viewer JS/CSS/HTML extracted from the Python f-string monolith into `scripts/preview/`. Server is now ~1380 lines (was 2672; grew from 485 after adding v3 frame engine routes, SSE, and override persistence). Static files served at `/preview/*`.
- **Phase C (done, commit d763e3a):** `ComponentModel` class with indexed tree, parent/child navigation, override management. `InteractionManager` state machine skeleton. Old globals backed by model/manager.
- **Phase D (done, commit 35cfb85):** Constraint enforcement system with 6 built-in brand constraints (grid alignment, approved fills, highlight limit, orange reservation, containment). Violations shown in sidebar and per-component inspector.

**Current frontend architecture:**
- `scripts/preview/editor-base.js` – shared shell infrastructure: `byId`, `escapeHtml`, `fetchJson`, `setStatus`, `setViewMode`, `initPreviewShell`, sidebar resize, diagram picker prev/next
- `scripts/preview/viewer-unified.html` – unified HTML template with `data-dg-mode="grid"|"force"`, `%MODE%`, `%MODE_SCRIPTS%`, `.dg-grid-only`/`.dg-force-only` CSS visibility
- `scripts/preview/component-model.js` – `ComponentModel` + `ComponentNode` tree with indexed lookup, `InteractionManager` state machine
- `scripts/preview/constraints.js` – `ConstraintRegistry` with pluggable constraint functions
- `scripts/preview/editor.js` – grid-mode interaction handlers, DOM sync, sidebar UI, BF-tabbed `Input` / `Output` / `Both` compare modes, 2-state grid overlay toggle
- `scripts/preview/force.js` – force-mode interaction handlers, simulation controls, SVG build, pin/unpin, node drag
- `scripts/preview/editor.css` – editor-specific styling, 3-column layout, mode visibility rules (`[data-dg-mode]`)
- `scripts/preview_server.py` – pure API server, serves unified template for both modes, watches HTML/CSS/JS for hot-reload

**Cold-start / portability status:** the preview ships a vendored BF `os` tier stylesheet and Ubuntu Sans snapshot under `assets/baseline-foundry/`, so fresh clones do not depend on a sibling checkout at runtime and do not vary based on one. The editor shell is back on the BF `navigation + main + aside` contract with local left/right resize bindings; the left navigation resize affordance is now owned locally in `scripts/preview/editor.css` because BF `os` no longer ships that selector. The desktop shell is also pinned locally to a single-row `navigation + main + aside` grid so upstream BF layout rules cannot reintroduce the broken extra top row, and the editor keeps DG-owned amber selection handles instead of depending on BF authoring-accent variables. The remaining editor work is undo/redo specialization rather than shell portability.

**Snap and guide system (2026-05-22):** Both editors now share snap primitives via `editor-base.js`: `snapRectToTargets` (shared snap algorithm), `collectPeerSnapTargets`, `collectGridSnapTargets`, `renderGuideLines`, `clearGuideLines`, `snapEdgeToTarget`. Grid editor snaps drag and resize to column/row edges with guide lines. Force editor snaps drag to peer node edges with guide lines. Shared `UndoRedoManager` class in `undo-manager.js` and shared resize handle rendering (`renderResizeHandles`, `clearHandlesByClass`) in `editor-base.js`. Abstract `EngineAdapter` class in `engine-interface.js` defines the swappable engine contract (Phase 1 interface + Phase 2a shared primitives + Phase 2b shared snap). Force inspector simplified to 3 fields (Node, Style, Actions). Force nodes have 8-handle resize (corners + midpoints) with 8px grid snap. Both editors have undo/redo: grid uses full-state + override-patch undo; force uses shared `UndoRedoManager` with per-node command undo. Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y keyboard shortcuts in both modes.

**Windows smoke pass complete (2026-05-11).** Moved to HISTORY; the BF-backed preview shell has been verified on Windows.

**Preview compare mode status:** when a diagram has a tracked rough sketch under `diagrams/1.input/`, the main editor area now exposes BF tabs for `Input`, `Output`, and `Both`; `Both` is a real 2-up center-pane layout rather than the older one-above-the-other reference strip.

**Remaining interactive editor work** (post-refactor):
- Undo/redo is domain-specific: 12 targeted override-patch actions (completed 2026-05-22). Only grid-adjust and clear-all-overrides still use full snapshots.

### v3 frame layout engine

**Vision:** Figma-like nested frame system with direction, gap, padding, per-axis sizing (HUG/FILL/FIXED), and 9-point alignment. Two-pass engine: measure (bottom-up) → place (top-down).

**Current state (2026-05-30):** Milestones 1–12 complete. **431 tests** passing (190 TS + 241 Python). **24 v3 Frame YAML definitions** (14 migrated from v2, 4 existing production, 6 test cases). Engine core stable with Figma-correct per-axis sizing (`sizing_w`/`sizing_h`), parent coercion model (HUG→FIXED for FILL children), coercion visibility in inspector ("Fixed (auto)" gold text), stale coercion cleanup with override value deletion, native Frame YAML definitions, InDesign/Figma-style layout grid with per-side margins, link-to-root toggle, and slack absorption (ported from design-foundry `resolveGridCore()`), unified editor shell (grid + force share `viewer-unified.html` + `editor-base.js`), drag-to-reorder, multi-select bulk editing (both grid and force), column-span/row-span inspector input, domain-specific undo/redo, InDesign-like deferred text composition, bidirectional text reflow, font metrics via `fonttools`, min/max size constraints with inspector UI (single-select + multi-select, auto-adjustment prevents min > max), constraint violation prevention (Figma-style auto-clamping), per-side padding UI with link/unlink toggle (Figma-style T/R/B/L fields), heading height consistency across all pipeline stages. The v3 render path now emits one `FrameBox` per frame, with the four visual treatments encoded as field values rather than separate primitive combinations, and the local preview relayout bridge rebuilds FrameBox rect/text/icon DOM from the relaid-out frame tree so width-driven reflow stays in sync with the engine. Borderless leaf frames now default to `sizing_w: FILL` unless they opt into `hug`, and the live v3 contract is now semantic rather than raw fill/border combinations: annotations render with no fill/no stroke, child boxes render stroke-only, parent boxes render grey fill with no stroke, and highlights render black with white text. TypeScript port complete (6 milestones). Force editor features: hover highlighting, double-click inline text editing, multi-select (shift/ctrl+click), keyboard nudge, stale-definition detection, snap guides, override tree highlighting. `diagram_shared.py` still coexists with extracted helpers (`design_tokens.py`, `text_metrics.py`) while active callers continue to use the monolith. 5 test-case frame YAMLs + 3 real v2→v3 diagrams browser-verified.

**Snapped fill-column update (2026-05-24):** Horizontal `PACKED` roots with fill children now treat authored width as a minimum rather than a hard canvas width. Both layout engines expand the actual placed/page width to the next 8px-compatible fill-column span, and `scripts/preview/editor.js` refreshes `gridInfo` from the post-relayout SVG size so live guide bands stay aligned after gutter edits.

**TypeScript interactive engine (Stage 15.5) — complete:**
- `packages/layout-engine/` owns the live interactive layout engine.
- `scripts/preview/layout-bridge.js` relayouts locally from frame-tree JSON and patches the live SVG/arrow DOM.
- Browser text measurement is HarfBuzz-backed; local relayout refuses non-authoritative adapter backends.
- `packages/layout-engine/src/resolve-styles.ts` and `scripts/frame_loader.py` implement the same frame-class semantics from [`docs/frame-classes.md`](docs/frame-classes.md).
- Python remains YAML/parser/export/parity support. Interactive relayout fallback is removed.
- Remaining work is cleanup and contraction, not another executor migration. Track it in `TODO.md` and `specs/008-repo-coherence-rewrite/`.

**Stash:** `unverified-v3-ui-work` — old UI code superseded by M9/M11. Can be dropped.

**Open work:** See `TODO.md` — swappable engine interface Phase 3+ [S], constraint enforcement [S], arrow waypoint/endpoint editing [S], consistent stroke weight [S], force→declarative round-trip [S], preview_server.py decomposition [S], EditorState container [S], native text frames [H], Tier 4 advanced Figma parity [H].

## Key files

| Purpose | File |
|---------|------|
| Frame dataclass | `scripts/frame_model.py` |
| YAML parser and style resolver | `scripts/frame_loader.py` |
| Measure → place engine | `scripts/layout_v3.py` |
| SVG output | `scripts/diagram_render_svg.py` |
| Frame-class resolution | `scripts/frame_style_classes.py` |
| Frame definitions | `scripts/diagrams/frames/*.yaml` |
| TypeScript layout engine | `packages/layout-engine/` |
| TypeScript style resolution | `packages/layout-engine/src/resolve-styles.ts` |
| TS relayout bridge | `scripts/preview/layout-bridge.js` |
| Interactive editor | `scripts/preview/editor.js` |
| Preview server | `scripts/preview_server.py` |
| Frame-class contract | `docs/frame-classes.md` |
| Visual language contract | `DIAGRAM.md` |

## Critical invariants

- `DIAGRAM.md` is the canonical source for diagram tokens, layout rules, and output constraints; do not duplicate that material in `TODO.md`.
- Final SVG deliverables must stay Illustrator-safe: no `<symbol>`, no `<use>`, no external `<image href="...">`, and no marker refs.

## Next session should

See `.github/copilot-instructions.md` for session workflow. Active tasks are in `TODO.md`.
