# TODO

## Purpose

This is the active execution queue for `diagram-generator`.

## Goal

Provide a cold-start-safe workflow and a consistent on-brand SVG system for redesigning batches of diagrams quickly, without re-deriving the style language from chat history every time.

## Scope

**In:** source-image intake, reference inspection, SVG redraws, icon selection from local assets, typography/layout normalization, reference-scaled proportions, workflow documentation, completed-work archiving.

**Out:** ad hoc extra markdown status files, new visual systems invented per diagram, non-local icon sourcing unless explicitly requested, rasterized final deliverables by default.

## Principles

1. Cold starts must be reliable: the next agent should not need prior chat context to continue.
2. Reference first: `diagrams/0.reference/sample.svg`, `diagrams/0.reference/sample.png`, and the user-updated `diagrams/0.reference/onbrand-svg-starter.svg` now define the canonical new-work block, arrow proportion, and overall visual weight; `diagrams/0.reference/_BRND-3284.drawio.svg` remains a secondary connector/layout reference.
3. For new diagrams, build from the sample block system: literal geometry, live text, natural-size local icons, and no hidden SVG reuse constructs.
4. Reuse exact style snippets: `diagrams/0.reference/onbrand-svg-starter.svg` is now the copy source for the canonical block proportions, inset rhythm, and literal orange arrow geometry.
5. Editable SVG over screenshots or embedded raster exports.
6. The imported dense application and documentation mapping from `canonical-spacing-spec` remains the reference tier, but `inference-snaps-dense` is now piloting a diagram tier with `16px` body copy and `20px` line height to keep live text proportionate to the standard `48px` icon treatment.
7. Orange is reserved for arrows and arrowheads; boxes do not get orange fills.
8. Geometry stays tight and reference-scaled; do not casually upscale diagrams.
9. Use local icons only, and omit the icon entirely when no suitable icon exists in `assets/icons/`.
10. The current canonical output exemplar is `diagrams/2.output/svg/memory-wall-onbrand.svg` (generated locally by `build_v2.py`); inspect it before treating any other output as precedent.
11. Canonical project state lives only in `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md`.

## Architecture

### Safe draw.io evolution lane

- draw.io shape libraries and the scratchpad are copy-based insertion tools: they improve reuse for future additions, but changing a library item later does not retroactively update shapes already placed in diagrams.
- draw.io default shape and connector styles are editor-scoped convenience settings, useful during a manual edit session but not a durable repo-wide source of truth.
- For repo-wide style changes such as reducing top padding on text-bearing boxes, the real solution is a tokenized batch-update path over the diagram XML, not relying on manual paste-style passes.
- draw.io custom stencils are still useful for reusable special shapes because they can define geometry, connection points, and local style overrides while inheriting fill and stroke from the applied style when appropriate.
- Direct XML editing through draw.io and git-versioned `.drawio` files makes a deterministic merge and revert workflow feasible, provided generator-owned cells carry stable identity and provenance metadata.
- `assets/drawio/diagram-generator-primitives.mxlibrary` is the tracked reusable library export for the current canonical primitives, and `scripts/export_drawio_library.py` regenerates it during the canonical batch build.
- Generated draw.io cells now carry `data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, and matching `tags`, so generator-owned cells can be filtered safely before any batch rewrite or merge logic touches them.
- `scripts/drawio_style_sync.py` is the batch rewrite entrypoint for tokenized style changes such as `spacingTop`, text spacing, connector styles, and dash patterns.
- Protected manual-edit workflow: when a manually polished draw.io file needs changes, create a mirrored review copy under `diagrams/2.output/draw.io/review/`, edit only that copy first, let the user review it, and promote it back only after checkpointing the original under `diagrams/2.output/draw.io/checkpoints/`.
- Use `scripts/drawio_review_workflow.py` for the routine copy-review-promote steps so the original manually edited file is never the first place changes land.

### Cold-start shareability findings

- The repo is runnable from the tracked workflow docs, starter-block references, icon library, draw.io primitive library, and generator scripts, so a fresh clone still preserves the core on-brand style system.
- The current `.gitignore` excludes `diagrams/1.input/`, `diagrams/2.output/`, `diagrams/0.reference/_BRND-3284.drawio.svg`, and `diagrams/0.reference/onbrand-reference.png`, which means most of the documented before/after corpus and two named governing references do not survive a normal clone.
- The shareable repo currently contains only one real tracked input/output pair in the live diagram lanes, so the transformation workflow is under-sampled for a cold-start agent or an external PM trying to learn the process from examples.
- Most compare pages remain tracked, but they point at ignored source and output assets, so the review lane is not self-contained for external users even though the HTML files are present.
- Conclusion: the repo can be shared as a runnable style-and-generator workspace, but it is not yet cold-start-safe enough for PM self-serve trials without a curated tracked exemplar pack and the missing governing reference assets.

### Diagram language contract

- `DIAGRAM.md` is the canonical plain-text diagram language spec. It owns tokens, rules, output constraints, and the default redraw workflow.
- `.github/copilot-instructions.md` keeps the short always-on guardrails.
- Workflow skills under `.github/skills/` hold repeatable procedures that should not bloat the permanent docs.

## Active TODO

### v2 declarative pipeline – defect registry

SVG element audit (v1 vs v2, April 2026). Use `python scripts/_compare_3way.py` for visual comparison and `python scripts/_audit_v2.py` for element counts.

| Diagram | Status | Orange | Texts | Details |
|---|---|---|---|---|
| attention-qkv | OK | 30→50 | 55=55 | Matrix tiles + fan-out arrows now rendering. v2 has more orange segments due to individual Z-bend arrows vs v1 shared trunks; visual coverage is equivalent. Frameless panels, correct box heights, white text on black boxes. |
| gpu-waiting-scheduler | OK | 4→4 | 6=6 | Fixed: added explicit waypoints to match v1 orthogonal path. |
| inference-snaps | OK | 8→12 | 17=17 | Wrapper alignment fixed (dashed frame and inner pad col_width derived from peer box width). |
| logic-data-vram | OK | 8→9 | 27=27 | Fixed: added missing "GPU" annotation labels under both sub-panels. |
| memory-wall | OK | 12=12 | 11=11 | All elements match. Dashed separator present. |
| request-to-hardware-stack | OK | 10=10 | 27=27 | All elements match. |
| rise-of-inference-economy | OK | 8=8 | 19=19 | All elements match. |

**Resolved:** MatrixWidget support added to `_layout_panel()`. All matrix tiles now render inside frameless panels with proper grid placement and bounds registration for arrow resolution.

**Arrow clearance enforced:** `validate_arrows()` runs in `build_v2.py` and checks every arrow segment. All diagrams pass except logic-data-vram (1 minor first-segment violation on the frag→packed horizontal arrow — 4px exit segment due to sub-panel height mismatch). Arrow clearance tokens (`ARROW_GAP`, `MIN_ARROW_SEGMENT`, `ARROW_EXIT_CLEARANCE`) documented in DIAGRAM.md and skills.

### Declarative diagram model (Roadmap Stage 6a – highest priority)

Replace the current per-diagram imperative functions with a declarative tree model and a shared layout engine. This is the prerequisite for PM self-serve: a PM downloads the repo, feeds a sketch or mermaid, and the tool recreates it on-brand without writing Python.

**Why now:** The imperative approach (one ~200-line Python function per diagram, ×2 renderers) does not scale. Every diagram re-derives the same box/text/arrow patterns. The existing grid engine helpers (`tight_box_height`, `panel_grid`) are useful but sit below the problem – diagrams still need hundreds of lines of manual coordinate wiring.

**Component types** (modelled after draw.io cells / Figma components):
- `Box` — single labelled box with optional icon, auto-height from content
- `Panel` — grid of boxes with heading, uniform row heights, inside-out sizing
- `Bar` — VRAM-style horizontal allocation strip with labelled segments
- `Terminal` — command bar with chrome dots and monospace text
- `Arrow` — connector between two components (orange, orthogonal)
- `Helper` — annotation text below/beside a component
- `Matrix` — the attention-QKV matrix widget

**Implementation order:**

- [x] **Step 1 – data model.** Define `@dataclass` component types in `scripts/diagram_model.py`. A `Diagram` is a tree of positioned components. Pure data, no rendering.
- [x] **Step 2 – layout engine.** Add `layout(diagram) → LayoutResult` in `scripts/diagram_layout.py`. Walks the tree, computes all positions/dimensions using existing grid helpers, enforces uniform row heights and containment. Output-agnostic.
- [x] **Step 3 – SVG renderer.** Add `render_svg(layout_result) → str` in `scripts/diagram_render_svg.py`. Consumes layout geometry, emits SVG. Replaces per-diagram `build_*()` functions.
- [x] **Step 4 – draw.io renderer.** Add `render_drawio(layout_result) → str` in `scripts/diagram_render_drawio.py`. Consumes same layout geometry, emits draw.io XML.
- [x] **Step 5 – convert logic-data-vram.** Rewrite `logic-data-vram` as a declarative tree using the new model. Validated – output matches the manually-edited reference with uniform row heights, nested panels, and proper arrows.
- [x] **Step 6 – convert remaining diagrams.** All 9 diagrams converted to declarative definitions under `scripts/diagrams/`. Müller-Brockmann explicit grid placement (col/row/col_span/row_span) replaced the need for free-form absolute positioning. `inference-snaps-dense` remains as a variant of `inference-snaps` in the imperative generator.
- [x] **Step 6b – component library refactor.** Unified component types: `Border` enum replaces `borderless`/`frameless`/`dashed` booleans; `Annotation` replaces `Helper` and borderless `Box` for annotations; `JaggedPanel` replaces `MemoryWall`; `IconCluster` replaces `IconComponent`/`RequestCluster`; `GridSpec` consolidates grid parameters. All 9 diagram definitions migrated to new types. Deprecated types kept for backward compatibility.
- [x] **Step 7 – Playwright visual validation.** Add a post-build headless browser check that renders each SVG and flags text overflow, misalignment, and box-height inconsistencies.

### Visual validation process

`scripts/visual_compare.py` runs Playwright comparisons between generated SVGs and manually-edited raster references. It produces:

- Side-by-side combined PNG
- Individual left/right screenshots at 2x device pixels
- Red-on-white pixel diff heatmap
- Percentage of changed pixels

Wired into `build_outputs.py` as the final step (skip with `--no-visual`). Manual pairs are defined in `VISUAL_PAIRS` in `build_outputs.py`. Add new pairs as diagrams get manual edits.

Standalone usage:

```powershell
python scripts/visual_compare.py \
  --left diagrams/2.output/svg/logic-data-vram-onbrand-v2.svg \
  --right diagrams/2.output/draw.io/manually-edited/raster/logic-data-vram-onbrand.jpg \
  --output diagrams/3.compare/visual-diff/my-comparison.png
```

### Grid visualisation in 3-way comparison

- [x] Extend `_compare_3way.py` to show a grid-overlaid view: 4-panel layout (input → v1 → v2 → v2+grid). The grid panel renders the Müller-Brockmann layout grid (column/row boundaries, gaps, cell spans) on top of the v2 SVG so reviewers can see how boxes map to grid cells.
- [x] Layout-level grid overlay: `GridInfo` dataclass captures column widths, row heights, gap regions; `_layout_grid_overlay()` in `diagram_render_svg.py` draws dashed margin boundary, column/row cell bands, gap fills with dimension labels; `build_v2.py --grid` emits `*-v2-grid.svg` files.

### Grid engine fixes (folded into Step 2)

These gaps were discovered in the logic-data-vram audit and are now handled by the layout engine:

- [x] Uniform row heights: tallest box in a row wins, others stretch to match. (`uniform_height` flag on Panel)
- [x] Text-in-bar positioning: bars use ascent-based text placement, not `+ 6` magic numbers.
- [x] Helper text positioning: derive from parent panel bounds, not manual offsets.
- [x] Sub-panel layout: panels can contain child panels, laid out side-by-side.
- [x] GRID col_span: panels can span multiple columns in a GRID arrangement.
- [x] Bar auto-fill: last segment without explicit width fills to the remaining panel width.
- [x] Bar auto-height: bars auto-size from content (INSET + text_height + INSET), never shorter than needed for balanced padding.
- [x] Baseline grid validator: `validate_grid(result)` checks all layout coordinates land on the 4px grid; bar segment `width_px` values must be multiples of 4.

### Previous grid engine items (partially done, superseded by declarative model)

Layers 1–4 are done. Layer 5 (rollout) and the typography weight audit are superseded by the declarative conversion above.

- [x] Layer 1 – tight box height (`tight_box_height`)
- [x] Layer 2 – panel grid helper (`panel_grid`)
- [x] Layer 3 – containment check (`assert_text_fits`)
- [x] Layer 4 – refactor `build_logic_data_vram()` (reference implementation)
- [—] Layer 5 – roll out to remaining functions → superseded by Step 6
- [—] Typography weight audit → handled automatically by declarative model

### Interactive preview server – defects and missing features

Component IDs, drag-to-move, resize handles, and override persistence are working. The following issues were identified during user testing:

- [x] **Click targeting selects parent instead of child.** Fixed: uses `elementsFromPoint()` to find deepest nested component at click coordinates.
- [x] **Cannot select nested items.** Fixed: same `elementsFromPoint()` approach applied to both click and hover handlers.
- [x] **No undo.** Fixed: full undo/redo stack (50 entries), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, toolbar buttons.
- [x] **Resize in all directions.** Fixed: 8 resize handles (all edges + corners), top/left handles adjust position to keep opposite edge anchored.
- [x] **Explicit save button.** Fixed: dirty flag, Save button (turns orange when dirty), Ctrl+S, beforeunload warning.
- [x] **Top/left resize inverted.** Fixed: corrected sign logic so left/top handles move position and shrink/grow width/height in the correct direction.
- [x] **Undo records post-change state.** Fixed: snapshot is now recorded before the first actual drag/resize move, not after the action completes.
- [x] **Text and icons block mouse selection.** Fixed: CSS `pointer-events: none` on `<text>`, `<image>`, and `<tspan>` children of component groups so clicks pass through to the parent `<g>`.
- [x] **Arrows not selectable or moveable.** Fixed: arrows now carry `component_id` in layout, `data-component-id` in SVG, and invisible 12px-wide hit-area lines in the preview for easy click targeting. All component types (Helper, JaggedPanel, MatrixWidget, IconCluster, Terminal, Separator, Legend) now emit `component_id`.
- [x] **Icon anchoring on resize.** Fixed: icons re-anchor to top-right corner when a box is resized via `dw` override. `.dg-icon` class on SVG icon groups enables JS targeting.
- [x] **Icons and dashed lines not selectable.** Fixed: auto-generated separator IDs, transparent hit-area rects for icon clusters, wider hit-area lines for separators, CSS selection/hover feedback for non-rect components.
- [x] **1D resize handles.** Fixed: arrows show handles along primary axis only (vertical: top/bottom, horizontal: left/right). Separators show left/right only.
- [x] **Arrow attachment to boxes.** Fixed: arrows track their source/target box positions when boxes are dragged or resized. `source_ref`/`target_ref` fields on `ArrowPrimitive`, `source`/`target` on `ComponentInfo`, side-aware endpoint shifting in the preview JS.
- [x] **Grid overlay toggle (W key).** Cycles off → composition → baseline → off. Composition mode shows columns, rows, gutters, margins, and content boundary. Baseline mode adds 4px horizontal grid lines. Grid data served via `/api/grid/<slug>` endpoint.
- [x] **Editable grid controls.** Sidebar inputs for columns, rows, col gutter, row gutter, and margin. Changing gutter or margin re-runs layout via `/api/relayout/<slug>` so elements reflow in real-time.
- [x] **Selection color.** Changed selection outline, drop-shadow, and tree-item highlight from orange (#E95420) to golden-amber (#F6B73C) matching resize handles.
- [ ] **Keyboard nudging.** ★ simple — Arrow keys nudge selected element by 1px; Shift+Arrow nudges by baseline grid unit (8px).
- [ ] **Multi-select.** ★★ medium — Shift+click to select multiple elements; move them together.
- [ ] **Double-click nested selection.** ★★ medium — Double-click drills into groups to select nested children, Figma-style.
- [ ] **Baseline alignment guide.** ★★★ complex — Visual guide that moves with a dragged box showing which baseline it snaps to (see brand-layout-ops parity).
- [ ] **Component swap.** ★★★ complex — Select a component and swap it for another type from the shape library (like Figma component swap).

### Previously active

- [x] Ingest typography, spacing, and grid specs from the broader design language into `DIAGRAM.md` frontmatter and `scripts/diagram_shared.py`.
- [x] 16px/20px diagram-tier pilot → now the default body size across all diagrams.
- [x] Define the three-lane draw.io workflow: generated base file, manually polished working file, and checkpoint snapshots or pages for low-friction revert.
- [x] Export a repo-owned draw.io library for the canonical primitives: default box, accent box, black highlight box, helper note, orange connector, terminal command bar, matrix widget, memory-wall panel, and common grouped panels.
- [x] Refactor `scripts/export_drawio_batch.py` to emit style-token metadata and provenance markers on generated cells so future tools can distinguish generator-owned shapes from manual additions.
- [x] Add a style-sync tool that can batch-rewrite tokenized properties such as `spacingTop`, text spacing, connector styles, dash patterns, and related draw.io style fields across existing diagrams.
- [ ] Pilot the scripted review-copy workflow on `diagrams/2.output/draw.io/memory-wall-onbrand-edited-in-drawio.drawio` and one file under `diagrams/2.output/draw.io/manually-edited/`, including a documented revert procedure.
- [x] 3-way compare pages (Before / Agent / Refined): extend `scripts/build_compare_pages.py` so each compare page shows the source input, the agent-generated SVG, and the manually refined raster from `diagrams/2.output/draw.io/manually-edited/raster/` side by side, with a graceful "no manual edit yet" panel when the refined asset is missing.
- [ ] Re-audit the refreshed starter-block batch in Illustrator: `diagrams/2.output/svg/memory-wall-onbrand.svg`, `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg`, `diagrams/2.output/svg/inference-snaps-onbrand.svg`, `diagrams/2.output/svg/attention-qkv-onbrand.svg`, `diagrams/2.output/svg/logic-data-vram-onbrand.svg`, `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg`, and `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg`.
- [ ] Import-test the current `diagrams/2.output/draw.io/*-onbrand.drawio` batch in draw.io and note any renderer mismatches versus the SVG canonicals.
- [ ] Keep refining `DIAGRAM.md` as more diagram types appear.
- [ ] Re-audit the generator helpers whenever the user adjusts the starter block so the output set does not drift back into mixed inset or line-height rules.
- [ ] Make the repo PM-shareable by tracking a curated exemplar pack of at least `3` to `5` real before/after pairs plus their compare assets.
- [ ] Track the governing visual references currently excluded by gitignore: `diagrams/0.reference/_BRND-3284.drawio.svg`, `diagrams/0.reference/onbrand-reference.png`, and at least one canonical output exemplar beyond the workflow explainer.
- [ ] New component: stacked icon+text block (icon above label, both grid-aligned) to avoid keyline breaks from side-by-side icon placement pushing text out of alignment.
- [x] Reconcile `README.md`, `STATUS.md`, `docs/specs.md`, and `.github/copilot-instructions.md` with the actually tracked corpus so cold-start instructions do not point at ignored files.