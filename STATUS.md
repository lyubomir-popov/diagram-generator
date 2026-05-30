# Status

## Before you start

**Read the playbook first.** Do not skip:

1. `.github/copilot-instructions.md` — workflow discipline and anti-patch protocol
2. `DIAGRAM.md` — the canonical diagram-language contract (colors, typography, layout, components)
3. Ask the cold-start pipeline question (see `.github/agents/agent.md`)

## What this repo is

`diagram-generator` is the active workspace for rebuilding rough sketches and inconsistent diagrams into on-brand, editable draw.io and SVG outputs. It owns the current diagram rules, the batch renderers, and the review artifacts for the refreshed starter-block system.

## Current state

The repo uses a single render engine: **v3 autolayout**. All v2/v1 pipeline code has been deleted.

**Active focus (2026-05-30):** On branch `feat/spec-kit-retrofit-core-engine-specs`. Three formal spec packages added: `specs/005-autolayout-hardening/`, `specs/006-arrow-routing-redesign/`, `specs/007-style-foundation-unification/`. Spec 007 Phase 3 complete: `resolve_styles()` fully ported to TypeScript (`packages/layout-engine/src/resolve-styles.ts`), eliminating the heuristic style derivation in `_frameBoxRenderState()` that caused changing one frame's style to corrupt all others. 190 TS + 241 Python tests passing. Spec 007 Phases 4–7 remain (readiness hardening, migration closure to single TS path, override schema, parity validation).

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

**Current state (2026-05-30):** Milestones 1–12 complete. **431 tests** passing (190 TS + 241 Python). **24 v3 Frame YAML definitions** (14 migrated from v2, 4 existing production, 6 test cases). Engine core stable with Figma-correct per-axis sizing (`sizing_w`/`sizing_h`), parent coercion model (HUG→FIXED for FILL children), coercion visibility in inspector ("Fixed (auto)" gold text), stale coercion cleanup with override value deletion, native Frame YAML definitions, InDesign/Figma-style layout grid with per-side margins, link-to-root toggle, and slack absorption (ported from design-foundry `resolveGridCore()`), unified editor shell (grid + force share `viewer-unified.html` + `editor-base.js`), drag-to-reorder, multi-select bulk editing (both grid and force), column-span/row-span inspector input, domain-specific undo/redo, InDesign-like deferred text composition, bidirectional text reflow, font metrics via `fonttools`, min/max size constraints with inspector UI (single-select + multi-select, auto-adjustment prevents min > max), constraint violation prevention (Figma-style auto-clamping), per-side padding UI with link/unlink toggle (Figma-style T/R/B/L fields), heading height consistency across all pipeline stages. The v3 render path now emits one `FrameBox` per frame, with the four visual treatments encoded as field values rather than separate primitive combinations, and the local preview relayout bridge rebuilds FrameBox rect/text/icon DOM from the relaid-out frame tree so width-driven reflow stays in sync with the engine. Borderless leaf frames now default to `sizing_w: FILL` unless they opt into `hug`, and the live v3 contract is now semantic rather than raw fill/border combinations: annotations render with no fill/no stroke, child boxes render stroke-only, parent boxes render grey fill with no stroke, and highlights render black with white text. TypeScript port complete (6 milestones). Force editor features: hover highlighting, double-click inline text editing, multi-select (shift/ctrl+click), keyboard nudge, stale-definition detection, snap guides, override tree highlighting. `diagram_shared.py` split into focused modules (`design_tokens.py`, `text_metrics.py`, `grid_helpers.py`). 5 test-case frame YAMLs + 3 real v2→v3 diagrams browser-verified.

**Snapped fill-column update (2026-05-24):** Horizontal `PACKED` roots with fill children now treat authored width as a minimum rather than a hard canvas width. Both layout engines expand the actual placed/page width to the next 8px-compatible fill-column span, and `scripts/preview/editor.js` refreshes `gridInfo` from the post-relayout SVG size so live guide bands stay aligned after gutter edits.

**TypeScript port (Stage 15.5) — complete, migration closure in progress:**
- **M1 complete:** Frame model ported to `packages/layout-engine/src/frame-model.ts` — Frame, Direction, Sizing, Align, Border, Arrow, enforceFillHugInvariant. 21 TS unit tests passing.
- **M2 complete:** Layout algorithm ported to `packages/layout-engine/src/layout.ts` — measure, distributeFillSpace, place, alignOffset, constrained re-measurement. Text measurement via adapter interface (MockTextAdapter for tests). Design tokens in `tokens.ts`. 46 additional tests (24 layout + 22 tokens).
- **M3 complete:** Canvas text adapter (`canvas-text-adapter.ts`) using `Canvas.measureText()` with Ubuntu Sans Variable. 6 tests. IIFE browser bundle builds (33KB via esbuild).
- **M4 complete:** Layout bridge (`layout-bridge.js`) replaces server round-trip with local layout. Frame tree JSON served via `/api/frame-tree/<slug>`. `performLocalRelayout()` runs TS engine client-side; falls back to server on failure. Browser-verified on android-container-vs-vm (gap/direction/padding changes work, SVG patching correct) and attention-qkv (bridge runs but text measurement differences cause visual variance — expected, will be resolved when TS engine owns full rendering).
- **M5 complete:** Shared parity test fixtures. 6 fixtures (vertical-stack, fill-distribution, mixed-sizing, nested-containers, deep-nesting, alignment-grid) as JSON with serialized frame tree + expected coordinates. TS parity test (39 tests) and Python parity test (6 tests + 33 subtests) both verify identical coordinates using mock text adapter. Discovered `_refresh_coerced_heights` bug (overwrites explicit FIXED heights) — same in both engines, tracked for post-parity fix.
- **M6 complete:** Server API cleanup. Removed `/api/relayout-v3/<slug>` endpoint, `_relayout_v3()`, `_serve_relayout_v3()`, and `test_relayout_v3.py`.
- **Port complete.** All 6 milestones done. Layout runs client-side via `performLocalRelayout()` in `layout-bridge.js`.
- **Style resolution ported to TS (2026-05-30).** `resolveStyles()` in `packages/layout-engine/src/resolve-styles.ts` — full port of Python's depth-aware 4-class style resolution. `_frameBoxRenderState()` in `layout-bridge.js` now consumes `resolvedFill`/`resolvedStroke` directly instead of re-deriving from raw fill/border. Frame model extended with `level`, `resolvedFill`, `resolvedStroke`. Python serializer includes `level` in frame-tree JSON. 15 dedicated tests.
- **Current migration caveat:** temporary server fallback is active in `editor.js` for robustness while remaining parity gaps are closed. Tracked in spec 007 Phases 4–5.
- **Migration end-state target:** one interactive execution path (TypeScript local relayout). Python remains batch/export oracle + parity reference.
- **Coercion visibility wired into inspector.** When the engine coerces HUG→FIXED (FILL children rule), the sizing dropdown shows "Fixed (auto)" in gold italic. Key mapping fix: TS engine uses camelCase (`sizingH`), overrides use snake_case (`sizing_h`). Stale coerced keys cleaned after each relayout. Immediate feedback when changing child sizing. Browser-verified.
- **Coercion lifecycle tests complete.** 7 new tests covering: lifecycle (coerce/revert), partial FILL removal, override values, horizontal axis, nested independent coercion, cross-axis non-coercion, and mixed FILL/HUG distribution. Tier 1 + Tier 3 edge cases fully covered.
- Architecture audit peer-reviewed: no pre-port gates found. See TODO.md for details.

**Stash:** `unverified-v3-ui-work` — old UI code superseded by M9/M11. Can be dropped.

**Open work:** See `TODO.md` — swappable engine interface Phase 3+ [S], constraint enforcement [S], arrow waypoint/endpoint editing [S], consistent stroke weight [S], force→declarative round-trip [S], preview_server.py decomposition [S], EditorState container [S], native text frames [H], Tier 4 advanced Figma parity [H].

**Key files:**
- `scripts/frame_model.py` — `Frame`, `FrameDiagram`, `Align`, `Sizing`, `Direction`
- `scripts/frame_loader.py` — YAML parser, omission/default rules frozen by `test_frame_loader.py`
- `scripts/layout_v3.py` — `measure()` → `place()` → `_render_frame()` → `LayoutResult`
- `scripts/test_autolayout.py` — comprehensive test suite
- `scripts/test_layout_v3.py` — original integration tests
- `scripts/test_svg_renderer.py` — SVG golden-file snapshot tests
- `scripts/diagrams/frames/*.yaml` — native frame definitions
- `packages/layout-engine/` — TypeScript layout engine (190 tests, IIFE browser bundle)
- `packages/layout-engine/src/resolve-styles.ts` — single-source-of-truth style resolution (TS port of Python `resolve_styles()`)
- `scripts/preview/layout-bridge.js` — bridges server frame-tree JSON → TS layout engine client-side

### Repo infrastructure

- Centralized root workflow: `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, `docs/specs.md`.
- `DIAGRAM.md` is the canonical diagram language spec with `sourceSpecs:` frontmatter linking to `canonical-specs`.
- `.github/skills/` holds repeatable workflow procedures (redraw, build-validate, draw.io review).
- Declarative diagram architecture complete (Stage 6a): typed component trees in `scripts/diagram_model.py`, Müller-Brockmann grid placement in `scripts/diagram_layout.py`.
- Both SVG and draw.io renderers share `scripts/diagram_shared.py` primitives.
- Generated draw.io cells carry provenance metadata (`data-dg-source`, `data-dg-role`, `data-dg-style-tokens`).
- Tracked draw.io library: `assets/drawio/diagram-generator-primitives.mxlibrary`.
- Token-aware draw.io style sync: `scripts/drawio_style_sync.py`.
- Protected manual draw.io workflow: `scripts/drawio_review_workflow.py`.
- Baseline grid validator, arrow crossing validator, and Illustrator-safety sanitizer are live.
- Body text: 18px/24px. Bars auto-size from content. Canvas constraints and auto-fill available.
- Playwright visual validation wired into `build_outputs.py` (skip with `--no-visual`).
- Native draw.io and Illustrator desktop smoke tests remain pending (need workstation with those tools).

### Known build issues

- `build_v2.py` exits nonzero on pre-existing arrow-clearance violations in `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, `lt-summit-identity`. Warning-only baseline-grid drift on several older diagrams.

## Draw.io evolution plan

- Preserve three draw.io lanes: generated base files, manually polished working files, and explicit checkpoints for easy revert.
- Introduce a repo-owned draw.io library, exported from the scratchpad or maintained as library XML, for the canonical reusable primitives instead of repeated copy-editing.
- Add provenance markers and style-token metadata to generated cells so future tooling can tell generator-owned shapes from manual additions.
- Build a style-sync path for batch changes such as `spacingTop`, text padding, connector defaults, or dash patterns, because draw.io libraries are copy-based and do not live-update already-placed shapes.
- Pilot the review-copy workflow on the existing manually edited draw.io files before adopting it as the repo default for all protected manual edits.

## Where to look

| What | Where |
|------|-------|
| Diagram design language | `DIAGRAM.md` |
| Active work, principles, architecture | `TODO.md` |
| Long-term direction | `ROADMAP.md` |
| Completed work | `HISTORY.md` |
| Source docs and governing references | `docs/specs.md` |
| Async user notes | `INBOX.md` |
| Agent handoffs and diagnostics | `AGENT-INBOX.md` |

## Key files

| Purpose | File |
|---------|------|
| Canonical diagram language spec | `DIAGRAM.md` |
| Declarative data model | `scripts/diagram_model.py` |
| Layout engine | `scripts/diagram_layout.py` |
| SVG renderer | `scripts/diagram_render_svg.py` |
| Diagram definitions | `scripts/diagrams/` (e.g. `logic_data_vram.py`) |
| Shared tokens and helpers | `scripts/diagram_shared.py`, `scripts/design_tokens.py`, `scripts/text_metrics.py`, `scripts/grid_helpers.py` |
| Visual comparison tool | `scripts/visual_compare.py` |
| Canonical exemplar for current rules | `diagrams/2.output/svg/memory-wall-onbrand.svg` |
| Spec-led workflow explainer exemplar | `diagrams/2.output/svg/diagram-language-workflow-onbrand.svg` |
| Current vertical-stack exemplar | `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg` |
| Wide infographic exemplar | `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg` |
| Sparse request-flow exemplar | `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg` |
| Workflow explainer exemplar | `diagrams/2.output/svg/diagram-intake-workflow-onbrand.svg` |
| Current four-panel attention exemplar | `diagrams/2.output/svg/attention-qkv-onbrand.svg` |
| Grouped package/layout exemplar | `diagrams/2.output/svg/inference-snaps-onbrand.svg` |
| Dense comparison variant | `diagrams/2.output/svg/inference-snaps-dense-onbrand.svg` |
| SVG output set | `diagrams/2.output/svg/` |
| Editable draw.io batch | `diagrams/2.output/draw.io/` |
| Tracked draw.io library | `assets/drawio/diagram-generator-primitives.mxlibrary` |
| Shared primitive source | `scripts/diagram_shared.py` (monolith, kept for compat) + focused modules: `design_tokens.py`, `text_metrics.py`, `grid_helpers.py` |
| Primary build entrypoint | `scripts/build_outputs.py` |
| Draw.io library exporter | `scripts/export_drawio_library.py` |
| Draw.io exporter | `scripts/export_drawio_batch.py` |
| Draw.io style sync | `scripts/drawio_style_sync.py` |
| SVG renderer | `scripts/generate_remaining_diagrams.py` |
| Compare-page builder | `scripts/build_compare_pages.py` |
| Illustrator-safe sanitizer | `scripts/svg_illustrator_sanitize.py` |
| Style references | `diagrams/0.reference/` |
| Source sketch lane | `diagrams/1.input/` |
| Local icon source | `assets/icons/` |

## Critical invariants

- `DIAGRAM.md` is the canonical source for diagram tokens, layout rules, and output constraints; do not duplicate that material in `TODO.md`.
- Keep text-bearing draw.io boxes, panels, and notation widgets as native editable `mxCell` geometry; reserve image-backed cells for icons or genuinely non-text special shapes only.
- Final SVG deliverables must stay Illustrator-safe: no `<symbol>`, no `<use>`, no external `<image href="...">`, and no marker refs.
- Final SVGs should reference `font-family: 'Ubuntu Sans', sans-serif` by family name only rather than shipping a file-path `@font-face` dependency.
- Use icons from `assets/icons/` only; if no suitable icon exists, omit the icon rather than sourcing a new one implicitly.
- For new work, keep the `192px` / `64px` / `8px` / `48x48` block system and the imported dense spacing baseline, but treat `18px` / `24px` as the current body text size.
- Prefer hierarchy by weight before hierarchy by size; move from `18px` regular to `18px` strong and small-caps, then `24px/32px` only when the smaller ladder is not enough.
- Orange is reserved for connectors and arrowheads only; boxes stay white or `#F3F3F3`, with at most one black emphasis box when clearly justified.
- Orange connectors should run edge-to-edge, midpoint-to-midpoint, behind the destination box, using literal line-plus-triangle geometry.
- `diagrams/2.output/svg/memory-wall-onbrand.svg` is the canonical implementation checkpoint for palette, icon placement, side-icon clusters, and overall scale.
- The `Memory wall` node remains the one semantic exception that keeps jagged top and bottom edges.
- Use an `8px` baseline unit for snapping heights and line steps.

## Next session should

- Start by reading this file.
- Read `DIAGRAM.md` before changing diagram behavior.
- Drain `INBOX.md`.
- Drain `AGENT-INBOX.md`.
- Continue from `TODO.md`.
- Read `docs/specs.md` before changing spec-governed behavior.
- **Note:** The TS port is complete (M1–M6). Layout runs client-side. Remaining work is mostly [S]-tier feature work (force editor parity, arrow editing, engine interface Phase 3+) and [H]-tier advanced Figma parity (space-between, absolute positioning, native text frames). All remaining items need browser verification — start the preview server (`python scripts/preview_server.py`) and verify changes visually.