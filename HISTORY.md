# History

Completed work belongs here so `TODO.md` stays lean.

## Short-term

### 2026-05-01 – Interaction manager migration + component swap

- **Full interaction manager adoption (commit 47d0760):** Migrated all 4 legacy state variables (`dragState`, `resizeState`, `wpDragState`, `textEditState`) to `InteractionManager`. All interaction flows now use `mgr.startXxx()`/`mgr.endInteraction()` with typed `InteractionMode` enum. Hover suppression unified via `mgr.suppressHover`.
- **Bug fixes (commit c8949d1):** Gutter save-button – grid overrides (col_gap, row_gap, outer_margin) now persist via override JSON and mark dirty on change. Ctrl+Z text undo – text edits store overrides with `data-orig-inner` and restore via `applyAllOverrides`.
- **Component swap / style picker (commit b5d7d91):** Added `BOX_STYLES` constant (default/accent/highlight), `applyStyleOverride()` function, and style picker dropdown in inspector panel. Overrides persist in JSON, undo/redo works, constraint system validates highlight limit. Fixed case-sensitivity bug in `getComponentType()` comparison.

### 2026-05-01 – Architectural refactor (Phases A–D)

Four-phase refactor completing Roadmap Stages 11–13:

- **Phase A (commit 2eff23d):** Added `BoxStyle` enum (DEFAULT/ACCENT/HIGHLIGHT) to `diagram_model.py` with auto-derived fill/text/icon colours. Created YAML/JSON diagram loader (`diagram_loader.py`), JSON schema (`docs/diagram-schema.json`), and 2 example YAML definitions. Migrated 6 diagram definitions from manual `Fill.BLACK` to `BoxStyle.HIGHLIGHT`.
- **Phase B (commit 6b7ba57):** Extracted 2200 lines of JS/CSS/HTML from `preview_server.py`'s Python f-string into `scripts/preview/editor.js` (2096 lines), `editor.css` (83 lines), and `viewer.html` (50 lines). Server dropped from 2672 to 485 lines. Config injected via `window.__DG_CONFIG`. Static files served at `/preview/*` with path-traversal protection. Fixed escaped-quote syntax error from f-string de-escaping.
- **Phase C (commit d763e3a):** Created `ComponentModel` class with indexed tree, parent/child navigation, override management, hit-testing, and effective delta computation. Created `InteractionManager` state machine skeleton. Replaced 6 tree-walking functions in `editor.js` with model delegations. Old globals backed by model/manager via property shims. Validated with Playwright across all diagrams.
- **Phase D (commit 35cfb85):** Created `ConstraintRegistry` with 6 built-in brand constraints: grid alignment, override grid alignment, approved fills, highlight box limit (max 1), orange fill prohibition (error severity), and box containment. Violations shown in sidebar "Constraints" panel and per-component in the inspector. Constraints run on load and after each override change.

Bug fixes included in the session:
- Auto-invert: layout engine auto-flips text/icons to white on `#000000` backgrounds.
- `GRID_GUTTER=16`: fixed gutter propagation into nested panels.
- Inset clamping: prevented negative insets.

### 2026-04-29 – Waypoint cleanup and architecture review

- **Collinear waypoint auto-pruning:** after a waypoint drag, any waypoint that sits on a straight line between its neighbours (within 2px tolerance) is automatically removed. Arrow SVG and handles are rebuilt.
- **Add waypoint by double-clicking segment:** replaced the old midpoint-circle approach with direct double-click on any point along a selected arrow's segment body. Click position is snapped to 4px grid.
- **Ghost affordances on resize:** fixed stale resize handles overlapping child icons during container resize (handles hidden during drag, hover effects suppressed during resize, hover cleared on mouseup).
- **INBOX triage:** 5 items drained into TODO (parenting audit, component swap, parent resize propagation, sticky port, children not selectable).
- **Architecture review:** wrote a comprehensive review of the preview server's evolution from batch generator to constrained interactive editor. Identified the 2300-line monolithic JS-in-Python as the key structural risk. Proposed 4-phase restructuring plan (extract JS → client-side model → interaction manager → brand constraint enforcement).
- **Roadmap retriage:** updated ROADMAP.md with new Stages 11–13 (viewer extraction, client-side model, brand constraints). Reorganised TODO into 3 categories: defects, safe-on-current-arch features, and features requiring restructuring.

### 2026-04-30 – Category 1+2 completion and preview server hardening

- **Auto-ID assignment:** layout engine now auto-assigns IDs to components that lack explicit ones, ensuring all boxes, panels, annotations, and arrows appear in the interactive preview's component tree.
- **Internal boxes selectable:** boxes inside nested panels (e.g. `left` panel in logic-data-vram) are now discoverable via double-click drill-in because they have auto-generated IDs.
- **Waypoint override persistence:** waypoint edits (drag, add, remove, prune) are now saved to the override JSON files alongside position/size deltas. Waypoints are restored from overrides on page load, undo/redo, and relayout. Inspector shows waypoint count and override status for arrows. Clearing an arrow override restores layout-engine waypoints.
- **Orthogonal constraint on waypoint drag:** when dragging a waypoint, movement is locked to the perpendicular axis if both adjacent segments are aligned (horizontal run → vertical-only drag; vertical run → horizontal-only drag). Corner waypoints retain free movement.
- **Gutter controls propagate to nested panels:** the relayout endpoint now recursively patches `col_gap` and `row_gap` on nested panels that rely on defaults, so adjusting the grid controls affects internal spacing throughout the diagram hierarchy.
- **Sticky preview port:** server startup auto-kills any process holding the target port before binding (Windows `Get-NetTCPConnection`).

### 2026-04-30 – Preview server interaction improvements

- **Selection color:** changed selection outline, drop-shadow, and tree-item highlight from orange (#E95420) to golden-amber (#F6B73C) matching resize handles.
- **Keyboard nudging:** Arrow keys nudge selected element(s) by 1px; Shift+Arrow nudges by 8px (baseline unit). Works with multi-select.
- **Multi-select:** Shift+click toggles additive selection. Group drag moves all selected elements together with 4px grid snap. Shift+click also works in tree sidebar.
- **Double-click drill-in:** single click now selects topmost parent group; double-click drills one level deeper into children, Figma-style. Hover preview follows current drill depth. Clicking a different top-level group resets depth.
- **TODO complexity triage:** rated all open tasks with ★/★★/★★★ complexity for delegation.

### 2026-04-29 – Preview server interactive editing fixes

- **Top/left resize sign fix:** corrected inverted delta signs in left-side and top-side resize handlers so dragging left/up correctly moves position and grows the element.
- **Undo/redo timing fix:** snapshot is now recorded before the first actual drag/resize move (via `snapshotRecorded` flag on drag/resize state), not after the action completes. This ensures Ctrl+Z restores the pre-change state.
- **Pointer-events fix:** CSS `pointer-events: none` on `<text>`, `<image>`, and `<tspan>` children of component groups so clicks pass through to the parent `<g>` for selection.
- **Arrow selectability:** arrows now carry `component_id` in layout, `data-component-id` in SVG, and invisible 12px-wide hit-area lines in the preview for click targeting. Added `Arrow.id` field to model. All component types (Helper, JaggedPanel, MatrixWidget, IconCluster, Terminal, Separator, Legend) now emit `component_id`.
- **ROADMAP.md:** added Stage 10 "Interactive preview and visual editing" with near-term, medium-term, and longer-term items.

### 2026-04-28 – Canvas constraints, uniform rows, and auto-fill

- **Diagram model:** added `canvas_width`, `canvas_height`, `uniform_rows` fields to `Diagram`.
- **Canvas width derivation:** when `canvas_width` is set, column widths are auto-derived as `(canvas_width − 2 × margin − (cols − 1) × gutter) / cols`, locked after the natural-size pass.
- **Uniform rows:** when `uniform_rows=True`, all grid rows are equalized to the tallest row's height.
- **Auto-fill for panels:** panels and sub-panels auto-derive `col_width` from their parent cell's available content span, eliminating manual nesting tax calculations. Auto-fill triggers only when cell width > BLOCK_WIDTH (explicitly sized grids).
- **Cleaned diagram definitions:** removed all explicit `col_width` from `aws_hld.py` sub-panels and `logic_data_vram.py` sub-panels.
- **DIAGRAM.md:** added "Sizing constraints" and "Auto-fill" sections, updated wrapper checklist.
- **All 10 diagrams build clean**, only 1 pre-existing arrow violation.

### 2026-04-28 – Revert wrapper outdent back to nesting tax

- **Removed `outdent` field** from `Panel` in `diagram_model.py`.
- **Reverted layout engine** (`diagram_layout.py`): pad logic back to `pad = 0 if border == NONE else INSET`; removed `min_width` parameter; removed frame/bounds outdent branches.
- **Reverted diagram definitions:** `aws_hld.py` (Core col_width 176→168, VPC/OU col_width 184→180), `logic_data_vram.py` (VRAM col_width 392→384). All `outdent=True` flags removed.
- **Restored "Nesting and alignment rules" section** in `DIAGRAM.md` with updated example (gutter=32, nesting tax = 8px per child).
- **Reverted wrapper guardrails** in `.github/copilot-instructions.md` and both skills back to indenting derivation.
- **Rationale:** outdenting created more alignment problems than it solved – Core frame protruded past Security/Shared-services, 5 keylines on the right edge. Indenting is simpler and predictable.

### 2026-04-28 – Gutter unification and AWS HLD diagram

- **New types:** `Border` enum (SOLID, DASHED, NONE), `Annotation` (replaces Helper + borderless Box), `JaggedPanel` (replaces MemoryWall), `IconCluster` (replaces IconComponent + RequestCluster), `GridSpec` (consolidates grid parameters).
- **Model + layout engine:** `diagram_model.py` and `diagram_layout.py` updated to support all new types alongside deprecated ones. Backward-compatible `effective_border` properties on Box and Panel.
- **Diagram migration:** All 9 definitions updated: `memory_wall.py` (JaggedPanel, IconCluster, Annotation), `gpu_waiting_scheduler.py` (Annotation, IconCluster), `logic_data_vram.py` (Annotation), `attention_qkv.py` (Annotation, Border.NONE), `inference_snaps.py` (Border.DASHED, Border.NONE), `diagram_language_workflow.py` (Border.DASHED), `diagram_intake_workflow.py` (Border.DASHED). No deprecated type imports remain in definitions.
- **DIAGRAM.md:** Components section rewritten with core types, border modes table, and deprecated types list.
- **All 9 diagrams build clean,** 0 regressions.

### 2026-04-27 – Equal-height panel equalization

- **Grid-row equalization:** Panels in a GRID arrangement now stretch their frames to fill the full cell height (the max height of all single-span components in that row). Fixes "Logic + data conflict" being shorter than "AI inference" in logic-data-vram.
- **Sub-panel equalization:** Side-by-side child panels inside a parent panel are equalized to the tallest sibling after layout. Fixes "Fragmented layout" being shorter than "Packed layout" in logic-data-vram VRAM section.
- **Implementation:** `min_height` parameter added to `_layout_panel()` and `_render_component()`. Top-level GRID pass sends `cell_h` as `min_height`; sub-panel path collects results first, finds max height, then stretches shorter frame Rects in place.
- **Documentation:** "Equal-height equalization" section added to DIAGRAM.md. Guardrail added to build-validate skill.
- **No regressions:** all 9 diagrams build clean, no arrow violations, element counts unchanged.

### 2026-04-27 – Grid visualisation in 3-way comparison

- **GridInfo dataclass:** Added to `diagram_layout.py` — captures `col_xs`, `col_widths`, `row_ys`, `row_heights`, `col_gap`, `row_gap`, `outer_margin` from both GRID and VERTICAL arrangements.
- **Grid overlay renderer:** `_layout_grid_overlay()` in `diagram_render_svg.py` draws dashed margin boundary (blue), column/row cell bands (light blue fills), gap fills (purple tint), and dimension labels, all in a `<g id="layout-grid" opacity="0.35">` group.
- **Build flag:** `build_v2.py --grid` emits `*-v2-grid.svg` files alongside standard v2 outputs.
- **4-panel compare:** `_compare_3way.py` updated from 3 to 4 columns (input → v1 → v2 → v2+grid) with graceful "not found" fallback when grid SVGs are missing.

### 2026-04-27 – Arrow clearance system: tokens, auto-router, validator

- **Arrow clearance tokens** added to `diagram_shared.py`: `ARROW_CLEARANCE` (12px), `MIN_ARROW_SEGMENT` (24px), `ARROW_EXIT_CLEARANCE` (8px), `ARROW_GAP` (32px). These define the minimum shaft visibility so arrows never overlap destination boxes.
- **Auto-router fix:** Z-bend waypoint placement in `_resolve_arrows()` now biases the bend toward the source, keeping the approach segment ≥ `MIN_ARROW_SEGMENT`. Prevents the midpoint split that left only ~1px of visible shaft in tight gaps.
- **Arrow validator:** `validate_arrows()` in `diagram_layout.py` checks every segment of every arrow post-layout. Wired into `build_v2.py` — violations print inline with build output.
- **Diagram fixes:** attention-qkv panels `row_gap` 8→32 (ARROW_GAP), inference-snaps `row_gap` 24→32, logic-data-vram right panel `row_gap` 16→24 and VRAM `col_gap` 24→32, memory-wall `col_gap` 16→32. 17 violations → 1 (minor known edge case).
- **Documentation:** "Arrow clearance" section added to DIAGRAM.md with token table and practical rules. Arrow non-negotiable added to copilot-instructions.md. Both build-validate and diagram-redraw skills updated.

### 2026-04-27 – v2 defect fixes: attention-qkv rewrite, wrapper alignment, MatrixWidget engine support

- **MatrixWidget panel support:** `_layout_panel()` in `scripts/diagram_layout.py` now extracts MatrixWidget children alongside Box, Bar, Helper, Terminal, and Panel. Matrix tiles participate in grid sizing and are placed as `MatrixTile` primitives with bounds registered for arrow resolution.
- **attention-qkv complete rewrite:** All 4 panels set to `frameless=True` and `uniform_height=False`. MatrixWidget instances placed inside panels. Value panel restructured to 3-column layout (helper text beside boxes, not below arrows). 14 top-level arrows added (Q→Ubuntu, K fan-out ×4, QK fan-out ×4, VQ→Ubuntu, VK→Linux, Ubuntu→Linux, Linux→ValueTransfer). Audit: rects 18=18, texts 55=55.
- **Wrapper alignment fix (inference-snaps):** Dashed frame `col_width` 616→600, inner pad `col_width` 296→288, derived from `peer_width − 2 × INSET`. All edges now flush at x=32/right=648.
- **Wrapper alignment fix (diagram-intake-workflow):** `col_width` 296→292 so outer (292×2+8+16=608) matches 608px peer boxes.
- **Documentation:** Added "Grid participants vs wrappers" section to `DIAGRAM.md` with derivation formula, table, and 5-step checklist. Added wrapper non-negotiable rule to `copilot-instructions.md`. Updated `diagram-build-validate` skill with v2 pipeline commands and wrapper guardrails.
- **Validation:** Both pipelines (v1 + v2) rebuild clean across all 9 diagrams. `_audit_v2.py` and `_compare_3way.py` confirm element parity.

### 2026-04-26 – Müller-Brockmann layout grid + remaining diagram conversions

- **Layout grid system:** Replaced sequential GRID fill with explicit Müller-Brockmann cell placement. Every component now carries `(col, row, col_span, row_span)`. The GRID arrangement computes column widths and row heights from component content, then positions each component at its grid cell. Sparse layouts, side annotations, and multi-quadrant diagrams all work without free-form absolute positioning.
- **Model additions:** Added `row_span` to all components. Added `col`/`row` to MatrixWidget, Terminal, MemoryWall, RequestCluster, Legend, Panel. Added `col_width`/`row_height` to Diagram for grid field sizing. Added `IconComponent` for standalone icons without box borders.
- **Layout engine refactor:** Extracted `_natural_size()` and `_render_component()` helpers so component sizing and rendering are separated from position calculation. GRID mode uses a 4-phase approach: determine grid dimensions → compute cell sizes → accumulate positions → render at grid cells.
- **3 final diagram conversions:**
  - `gpu_waiting_scheduler.py` – 4×5 grid, sparse layout with scheduler top-right, GPU bottom-left, standalone icons, orthogonal arrow. 776×368, 0 violations.
  - `memory_wall.py` – 2×7 grid, main stack col 0, side annotations (RequestCluster, helper text, black arrow) col 1. 672×656, 0 violations.
  - `attention_qkv.py` – 2×3 grid with 4 internal Panels (Query, Keys, Match, Value), MatrixWidgets, Legend, fill-coded boxes. 1712×624, 0 violations.
- **All 9 diagrams** now build from declarative definitions with both SVG and draw.io output, 0 grid violations across the board.
### 2026-04-26 — Declarative model: draw.io renderer + 6 diagram conversions

- **Draw.io renderer (Step 4):** Created `scripts/diagram_render_drawio.py` – consumes the same `LayoutResult` as the SVG renderer and emits native editable draw.io XML with `mxCell` boxes, labels, icons, and connected edges.
- **6 diagrams converted to declarative definitions** under `scripts/diagrams/`:
  - `request_to_hardware_stack.py` – VERTICAL arrangement, 5 panels (Orchestration, Model Runtime, Compute Kernel, Driver, Hardware) connected by arrows. 472×1176, 0 grid violations.
  - `rise_of_inference_economy.py` – GRID arrangement (2 cols), col_span=2 full-width boxes, sub-panels (Always-on compute, Revenue impact). 944×656, 0 grid violations.
  - `inference_snaps.py` – VERTICAL with dashed Panel frame, Terminal component, grey 2×4 tile grid, hardware boxes. 696×888, 0 grid violations.
  - `diagram_intake_workflow.py` – VERTICAL, dashed source frame → 4 sequential boxes (white/grey/white/black). 680×592, 0 grid violations.
  - `diagram_language_workflow.py` – VERTICAL, dashed 3-box input frame → 6-box skill chain (alternating black/white). 672×744, 0 grid violations.
  - (Prior session: `logic_data_vram.py` was the first conversion.)
- **Model additions:** Added `col_span: int = 1` to Box, `id: str = ""` to Terminal, `col`/`row` to Helper. Added top-level Terminal handling in layout engine. Fixed draw.io renderer `make_line()` call for terminal text.
- **Remaining:** 4 diagrams (memory-wall, attention-qkv, gpu-waiting-scheduler, inference-snaps-dense) need free-form absolute positioning not yet supported by VERTICAL/HORIZONTAL/GRID arrangements.

### 2026-04-26 — Bar auto-sizing and baseline grid validator

- Bar auto-fill: two-pass width computation – last segment without explicit `width_px` fills to remaining panel width.
- Bar auto-height: `_min_bar_height()` computes `max(bar.height, INSET + text_height + INSET)` so labelled bars grow from 32→40px.
- Baseline grid validator: `validate_grid(result)` checks all layout coordinates against the 4px grid.
- Grid overlay: `show_grid` parameter on `render_svg()` / `write_svg()` draws 8px red guide lines.
- Body text updated to 18px/24px across `diagram_shared.py` and `DIAGRAM.md`.

### 2026-04-25 — Diagram-tier pilot for inference snaps dense

- Updated `inference-snaps-dense-onbrand.drawio` and `inference-snaps-dense-onbrand.svg` to pilot a diagram-specific typography tier: `16px` main copy with `20px` line height, while keeping the imported dense grid, spacing, and box-height math from `canonical-spacing-spec`.
- Added explicit diagram-tier tokens and rollout notes to `DIAGRAM.md`, then wired the pilot through the shared helpers so the SVG and draw.io renderers both use the same `16px` line specs for the forked variant only.
- Fixed draw.io label export so the base `fontSize` now inherits from the line spec instead of always defaulting to `14`, which lets the pilot survive into the generated XML without per-call overrides.
- Rebuilt the output batch, re-sanitized the pilot SVG, and spot-checked the generated draw.io artifact to confirm the pilot now emits `16px` labels while the original `inference-snaps` artifact remains on `14px`.

### 2026-04-25 — Inference snaps dense comparison variant

- Added `inference-snaps-dense-onbrand.drawio` and `inference-snaps-dense-onbrand.svg` as a forked comparison variant of the grouped side-by-side `inference-snaps` diagram so the recent dense token sync can be inspected in a real layout rather than only in shared helpers.
- Re-laid that variant around the current dense defaults: `24px` inter-column and inter-row gutters, standard `192px` hardware tiles, wider `300px` paired tiles inside the grey substrate, and row placement derived from the shared box-height math instead of a fixed `72px` row step.
- Added `inference-snaps-dense` to the compare-page batch, rebuilt outputs, sanitized the new SVG deliverable, and regenerated the compare HTML so the original source and the new variant can be reviewed under a separate slug.

### 2026-04-25 — Dense design-language token sync

- Imported the dense application and documentation type, spacing, and grid rules from `canonical-spacing-spec` into `DIAGRAM.md`, including a `14px` body size, `4px` baseline unit, `20/24/32px` line-height ladder, and `24px` application gutter defaults.
- Refactored `scripts/diagram_shared.py` to use the new shared token layer, a canonical line-height table, and true ceiling-based baseline snapping instead of the old float-unsafe grid rounding shortcut.
- Updated `scripts/export_drawio_batch.py` so generated draw.io files now use a `4px` grid, auto-grow box heights from the shared text-stack math, and keep label and icon placement aligned with the shared box metrics.
- Rebuilt the output batch and spot-checked generated draw.io artifacts to confirm the new grid size, `14px` label output, and baseline-snapped taller boxes.
- Updated repo docs and workflow skills so `STATUS.md`, `TODO.md`, `docs/specs.md`, `.github/copilot-instructions.md`, `.github/agents/agent.md`, and the diagram-language sync skill all reflect the new dense default instead of the older `16px` / `24pt` guidance.

### 2026-04-25 — Diagram language spec, skills, and workflow explainer

- Added `DIAGRAM.md` as a design.md-inspired canonical diagram-language spec with machine-readable token frontmatter plus prose rules for colors, typography, layout, components, editability, and workflow application.
- Repointed `README.md`, `STATUS.md`, `TODO.md`, `docs/specs.md`, `.github/copilot-instructions.md`, `.github/agents/agent.md`, and `ROADMAP.md` so permanent diagram rules now live in `DIAGRAM.md` and `.github/skills/` is the home for repeatable procedures.
- Added four repo workflow skills under `.github/skills/`: `diagram-redraw`, `diagram-build-validate`, `drawio-review-promote`, and `diagram-language-sync`.
- Added `diagram-language-workflow-onbrand.drawio` and `diagram-language-workflow-onbrand.svg` as a new generated explainer for the spec-led workflow, with black boxes marking the new additions.
- Added the rough review asset `diagrams/1.input/diagram-language-workflow-rough.svg`, wired the new slug into `scripts/build_compare_pages.py`, rebuilt the batch, sanitized the new SVG, and regenerated compare pages.

### 2026-04-24 — Diagram intake workflow explainer

- Added `diagram-intake-workflow-onbrand.drawio` and `diagram-intake-workflow-onbrand.svg` as a generated explainer for the current intake path: known ChatGPT source, open PM input-format questions, repo workflow, compare mode, manual draw.io polish, and final SVG output.
- Added the rough reference asset `diagrams/1.input/diagram-intake-workflow-rough.svg` plus the matching compare-page entry so the explainer joins the existing before / agent / refined review lane.
- Rebuilt the output batch, sanitized the new SVG deliverable, and regenerated the compare pages.

### 2026-04-21 — Draw.io library export and tokenized style sync

- Added `scripts/export_drawio_library.py` and the tracked `assets/drawio/diagram-generator-primitives.mxlibrary` export so the canonical reusable draw.io primitives now live in a versioned library file instead of only in generated diagrams.
- Added `scripts/drawio_style_tokens.py` and `scripts/drawio_style_sync.py`, and refactored `scripts/export_drawio_batch.py` so generated `mxCell` nodes now carry provenance and style-token metadata that batch tools can target safely.
- Updated `scripts/build_outputs.py` to generate the tracked draw.io library before rebuilding the draw.io and SVG batches, then rebuilt the batch and validated the new style-sync path with a dry run against `memory-wall-onbrand.drawio`.

### 2026-04-19 — Protected manual draw.io review-copy workflow

- Added `scripts/drawio_review_workflow.py` so manual draw.io changes can start from a review copy, then promote back only after checkpointing the original file.
- Updated `.github/copilot-instructions.md`, `STATUS.md`, and `TODO.md` so protected manual draw.io edits now follow a copy, review, checkpoint, and promote flow instead of first-pass in-place overwrite.

### 2026-04-19 — Draw.io manual-edit workflow investigation

- Investigated how draw.io scratchpad exports, custom libraries, default styles, custom stencils, connector and text style editing, and direct XML editing can support a safer mixed manual and programmatic workflow.
- Recorded the key architectural constraint that draw.io libraries are copy-based rather than live-linked, so future reusability needs both a library lane for new insertions and a tokenized batch-update lane for existing diagrams.
- Updated `STATUS.md`, `TODO.md`, `ROADMAP.md`, and `docs/specs.md` with a concrete plan for generated base files, manually polished working files, revert checkpoints, library-backed reuse, and style-sync tooling.

### 2026-04-19 — Session: centralized workflow migration

- Adopted the centralized root workflow set: `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md` are now canonical in this repo.
- Migrated the older workflow content into the new root files and removed the obsolete parallel workflow files so the centralized layout is the only live path.
- Rewrote `.github/copilot-instructions.md`, `.github/agents/agent.md`, and `README.md` so session start, source precedence, inbox handling, and validation now match the centralized boilerplate while preserving the repo’s diagram-specific rules.

### 2026-04-15 — Output lane + input path cleanup

- [x] Split the final artifact lanes under `diagrams/2.output/` so SVG outputs now live in `diagrams/2.output/svg/` and editable draw.io files live in `diagrams/2.output/draw.io/`.
- [x] Moved the prototype block file out of the final-output lane into `diagrams/0.reference/prototypes/icon-box-48px-prototype.svg` so output folders contain only deliverable artifacts.
- [x] Renamed the source-sketch folder from `diagrams/1. input/` to `diagrams/1.input/` and updated the compare builder, docs, and ignore rules to match.
- [x] Rebuilt the output batch and compare pages after the folder cleanup so the generated artifacts match the new structure.

### 2026-04-15 — Draw.io-first build refactor

- [x] Added `scripts/diagram_shared.py` to hold the shared diagram tokens, icon loading, text metrics, and small helper primitives that both renderers need.
- [x] Removed the direct `export_drawio_batch.py` dependency on `generate_remaining_diagrams.py`, so the draw.io renderer no longer imports the SVG renderer for shared behavior.
- [x] Updated `scripts/generate_remaining_diagrams.py` to consume the shared primitives module instead of carrying a second copy of the same low-level constants and helpers.
- [x] Added `scripts/build_outputs.py` as the canonical batch entrypoint and made it generate draw.io first, then regenerate the matching SVG batch.
- [x] Revalidated the refactored build path by running the new unified batch build successfully.

### 2026-04-15 — Compare review workflow + helper polish pass

- [x] Added `scripts/build_compare_pages.py` so the current seven source images and seven `*-onbrand.svg` outputs can be reviewed side by side through generated local HTML pages and merged JPG compare sheets.
- [x] Fixed the compare-page path handling so local files whose paths contain spaces still render correctly outside the VS Code webview.
- [x] Moved the loose review screenshots out of `docs/` root and into `docs/inbox-assets/` so inbox references stay organized.
- [x] Updated the shared SVG and draw.io helpers so terminal command bars use Ubuntu Sans Mono plus a visible chrome strip, separator line, and window-control dots instead of reading like a plain label box.
- [x] Updated the shared SVG and draw.io matrix helpers so `Q` / `K` / `V` labels sit in an explicit header band above the grid, preventing the recurring label-on-divider collision.
- [x] Rebuilt the full SVG and draw.io batches and refreshed the merged compare JPG set after the helper changes.

### 2026-04-02 — Native draw.io export correction

- [x] Audited the local `diagrams/2.output/draw.io/BRND-3135*.drawio` reference files and confirmed that the editable examples use native `mxCell` rectangles, labels, groups, and edges rather than `shape=image` boxes.
- [x] Documented the resulting invariant in the canonical repo docs: text-bearing draw.io boxes and panels must stay native and editable; inline `data:image/svg+xml,...` cells are reserved for icons and special non-text ornaments only.
- [x] Rewrote `scripts/export_drawio_batch.py` around native editable draw.io primitives so the generated batch no longer bakes whole boxes and text panels into image cells.
- [x] Kept draw.io image cells only for embedded icons and special shapes such as the jagged memory-wall panel and the Q/K/V matrix mini-grids.
- [x] Updated `scripts/export_memory_wall_drawio.py` to delegate to the canonical batch exporter so the repo no longer has two divergent draw.io export paths.
- [x] Regenerated the full `diagrams/2.output/draw.io/*-onbrand.drawio` batch and locally XML-validated it after the exporter rewrite.
- [x] Tightened that invariant again after the attention editability check: Q/K/V matrix mini-grids are now also native draw.io geometry with editable text, so image cells are reserved strictly for icons and truly non-text special shapes.

### 2026-04-02 — Ascender-based spacing + draw.io batch export

- [x] Tightened the canonical geometry rules so the visible top of live text sits `8px` below the box edge using ascent-based baseline placement, instead of treating the text `y` value as the raw top inset.
- [x] Documented the remaining spacing invariants for cold starts: midpoint-to-midpoint box-edge connectors, consistent box-to-arrow gaps, `8px` padding around borderless grouping pads, and a requirement that text and icons stay clear of orange connector paths.
- [x] Updated `scripts/generate_remaining_diagrams.py` to derive box heights from live text metrics, keep repeated spacing on an `8px` grid, and route orange connectors so they touch the center of the destination side rather than stopping short.
- [x] Rebuilt and re-sanitized the current canonical SVG set so `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, `gpu-waiting-scheduler-onbrand.svg`, `logic-data-vram-onbrand.svg`, and `attention-qkv-onbrand.svg` all reflect the refreshed ascent-aware placement rules.
- [x] Added `scripts/export_drawio_batch.py` and generated native draw.io exports for the current output set under `diagrams/2.output/draw.io/`, using embedded `data:` SVG image cells for Illustrator-safe icon fidelity and native attached edges with `source` / `target` plus `entry` / `exit` anchors wherever the relationships are direct.
- [x] Forced the generated draw.io files toward light-mode rendering with `adaptiveColors="none"` and explicit color values so dark-theme import does not silently invert text and fills.

### 2026-04-02 — Starter-block migration refresh

- [x] Updated the canonical docs to capture the stricter starter-block system: top-left text at `x=8` / `y=8`, top-right `48px` icon artboards with the same inset, minimum `64px` box height, `72px` for three-line boxes, same-size `16px` `#666666` helper text, arrows drawn behind connected boxes, and a grid-first width discipline.
- [x] Rewrote `scripts/generate_remaining_diagrams.py` around those shared primitives so refreshed outputs come from the same generator instead of a mix of old compact geometry and pre-refresh sample-based spacing.
- [x] Refreshed `diagrams/2.output/svg/memory-wall-onbrand.svg`, `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg`, `diagrams/2.output/svg/inference-snaps-onbrand.svg`, `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg`, `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg`, and `diagrams/2.output/svg/logic-data-vram-onbrand.svg` to the updated starter-block system.
- [x] Rebuilt `diagrams/2.output/svg/attention-qkv-onbrand.svg` out of the earlier compact `9px` system and onto the refreshed `16px` grid, preserving the full query / keys / match / value content while keeping helper copy at body size.
- [x] Added the missing source labels back into `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg`, including the full compute-kernel set `CUDA`, `ROCm`, `Metal`, and `oneDNN`.
- [x] Re-sanitized and XML-validated the refreshed batch so the full main output set is again Illustrator-safe after the generator rewrite.

### 2026-04-01 — Sample-based system reset + memory wall rebuild

- [x] Rebuilt `diagrams/2.output/svg/memory-wall-onbrand.svg` from scratch around the user-provided `diagrams/0.reference/sample.svg` block system instead of continuing the older compact library.
- [x] Standardized the new canonical block around `192x64` boxes, literal `1px` orange line-plus-triangle arrows, live `16px` regular block text, and natural embedded `48x48` local icons.
- [x] Replaced `diagrams/0.reference/onbrand-svg-starter.svg` with a matching live-text sample-based starter so future redraws can copy the exact block and arrow geometry without introducing symbols or markers.
- [x] Updated the cold-start docs to make the sample-based system canonical for new work and to demote the earlier `144x26` / `128x26` / `9px` library to legacy-maintenance guidance.
- [x] Documented draw.io XML export as a plausible second output path that should be anchored to a real user-provided sample before implementation.
- [x] Tightened the canonical block rule so text is always top-left aligned and block height is derived from natural icon height plus `8px` padding on all sides, making the current canonical block `192x64`.
- [x] Added the remaining reusable clarifications from review: side icon clusters keep the same icon scale as the rest of the system, separators between stacked boxes should match box width and sit centered in the gap, and the `Memory wall` node retains jagged top and bottom edges as a semantic exception.
- [x] Compared the local `diagrams/2.output/draw.io/*.drawio` samples, implemented `scripts/export_memory_wall_drawio.py`, and generated `diagrams/2.output/draw.io/memory-wall-onbrand.drawio` as the first native draw.io export prototype with embedded `data:` SVG icons and a jagged memory-wall panel.
- [x] Refined the draw.io exporter so connected arrows are attached on both ends with `source` / `target` cell ids plus explicit `entry` / `exit` anchors, and forced light rendering with `adaptiveColors="none"` plus explicit text colors.
- [x] Tightened the cold-start typography and icon rules after auditing `request-to-hardware-stack-onbrand.svg`: prefer `16px` regular and bold before introducing another size and require an explicit icon-coverage pass across `assets/icons/` before treating a diagram as done. The brief intermediate idea of reserving `14px` for helper text was later superseded by the current `16px` and `24pt` rule captured below.
- [x] Clarified the scaled-up type system for current new work: `16px` is body text, `24pt` is the next size step when more hierarchy is needed, and `14px` is now documented as legacy from the pre-scale-up system rather than a current default.

### 2026-04-01 — Remaining sample-based batch completion

- [x] Recorded `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg` as the completed redraw of `diagrams/1.input/image 6.png`, making the scaled-up vertical-stack reference part of the tracked output set.
- [x] Rebuilt `diagrams/1.input/image.png` as the editable SVG `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg` using the scaled-up sample system, one `24pt` title step, `16px` body text, a single black emphasis box, and a fuller icon pass across the training, inference, compute, and revenue sections.
- [x] Rebuilt `diagrams/1.input/image 5.png` as the editable SVG `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg`, using the same `192x64` block system, a sparse orthogonal orange connector, and only the local icons that had clear semantic matches.
- [x] Added `scripts/generate_remaining_diagrams.py` so the final simple diagrams were generated from the same literal geometry, icon embedding, and `1px` line-plus-triangle arrow rules instead of being hand-drifted.
- [x] Sanitized and XML-validated the new batch outputs so the original six-input redraw queue is now complete on the SVG side.

### 2026-04-01 — Memory wall on-brand redraw

- [x] Rebuilt the hand-drawn Memory Wall diagram as an editable SVG.
- [x] Switched the file to Ubuntu Sans Variable and local SVG icon symbols.
- [x] Matched the draw.io reference more closely for compact box scale, black strokes, grey fills, and orange connectors.
- [x] Reworked the connector behavior so arrowheads touch the destination edges without the shaft visibly protruding through the head.
- [x] Converted the wall treatment into a double-jagged box with the label inside.

### 2026-04-01 — Cold-start workflow scaffold

- [x] Ported the original workflow scaffold into this repo: handoff, inbox, TODO, roadmap, history, and resume-agent structure.
- [x] Documented the current diagram redesign style system and process so additional diagrams can be handled without relying on prior chat context.

### 2026-04-01 — Path + type hierarchy refresh

- [x] Aligned the canonical docs with the `assets/` and `diagrams/` repo layout after the reorg.
- [x] Fixed the exemplar SVG's embedded font reference so `diagrams/2.output/svg/memory-wall-onbrand.svg` still resolves `assets/UbuntuSans[wdth,wght].ttf` correctly.
- [x] Added the optional larger typography ladder for deeper diagrams: `Body` (`1rem` and `400`), `D-Head` (`1rem` and `600`), `C-Head` (`1rem` and `600`, small-caps), `B-Head` (`1.5rem` and `400`), and `A-Head` (`1.5rem` and `600`), with guidance to use the smallest subset possible.

### 2026-04-01 — Logic/data + VRAM redraw

- [x] Rebuilt `diagrams/1.input/image 4.png` as the editable SVG `diagrams/2.output/svg/logic-data-vram-onbrand.svg`.
- [x] Collapsed the sketch into three clean on-brand panels: the logic and data conflict, AI inference, and VRAM fragmentation comparison.
- [x] Kept the redraw inside the repo palette and geometry rules by using compact titles, square-corner boxes, orange connectors, and a GPU-card treatment instead of preserving the hand-drawn shading.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Canonical rule clarification

- [x] Tightened the cold-start docs so the canonical style rules are explicit rather than implied.
- [x] Documented the strict text and icon layout rule: left-aligned text, flush-right icons, `8px` text inset, `144px` outer boxes, and `128px` nested boxes.
- [x] Replaced the overly broad heading ladder in the canonical docs with the intended draw.io-style type scale: `9px` regular, `9px` bold, `9px` bold small-caps, and optional `14px` regular or bold headings only when needed.
- [x] This clarification supersedes the older broader heading-ladder wording in the history log; `TODO.md`, `STATUS.md`, and `.github/copilot-instructions.md` are the canonical source of truth.
- [x] Documented the palette rule that orange is reserved for arrows, boxes default to white or `#F3F3F3`, and at most one black-filled box with white text is allowed.
- [x] Made `diagrams/2.output/svg/memory-wall-onbrand.svg` the explicit canonical implementation checkpoint for future cold starts.

### 2026-04-01 — Attention QKV redraw

- [x] Rebuilt `diagrams/1.input/image 3.png` as the editable SVG `diagrams/2.output/svg/attention-qkv-onbrand.svg`.
- [x] Translated the sketch into four clean panels for the query, keys, match, and value steps while keeping the wider composition compact.
- [x] Kept the redraw inside the stricter canonical rules: no orange boxes, strictly left-aligned text, white and `#F3F3F3` boxes, and a single black highlight box for the highest-relevance match.
- [x] Omitted icons entirely because no suitable local icon in `assets/icons/` matched the Q, K, and V matrix concept cleanly.
- [x] Tightened the layout so it now matches the memory-wall exemplar's exact `144x26` and `128x26` box scales, `8px` inset, `#666666` helper text, bottom-row legend, and orthogonal `90` degree arrow routing.
- [x] Refined the final spacing pass so legends use evenly spaced bottom-row markers, helper notes stay unboxed at `9px` and `#666666`, and orange arrows read box-to-box with larger heads and longer visible shafts.
- [x] Normalized the arrow treatment back to the memory-wall exemplar's smaller orange head proportions and extracted a reusable starter SVG for future diagrams to copy exact defs from.
- [x] Added explicit spacing constants to the reusable starter and the attention diagram: `8px` arrowheads, `16px` connected gaps without arrowheads, `24px` connected gaps with arrowheads, and `8px` gutters for repeated `128px` box rows.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Inference Snaps redraw

- [x] Rebuilt `diagrams/1.input/image 7.png` as the editable SVG `diagrams/2.output/svg/inference-snaps-onbrand.svg`.
- [x] Corrected the grouped layout to use full-width row bars instead of a centered composition, keeping the command bar, header row, and hardware row on the same panel-width grid.
- [x] Shifted the grouped reference to a stricter one-size typography pass for this case: all copy is `9px`, with regular and bold used for hierarchy instead of introducing extra sizes.
- [x] Refined the grey capability region into a borderless `#F3F3F3` substrate behind bordered child tiles so the semantic boxes, not the pad, carry the structure.
- [x] Kept the redraw on the canonical library system: `128x26` nested rows, `8px` text inset, `8px` row gutters, `8px` arrowheads, and `16` and `24` connector spacing.
- [x] Used only local icon motifs that mapped cleanly to the source concepts and kept all text left-aligned with flush-right icons.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Illustrator-safe SVG audit

- [x] Investigated why Illustrator dropped arrowheads, icons, and matrix glyphs from the finished SVGs.
- [x] Identified the main failure modes: file-path `@font-face` rules, internal `<symbol>` and `<use>` reuse, and linked `<image href="...">` embeds.
- [x] Added `scripts/svg_illustrator_sanitize.py` to strip external font links, expand internal symbol reuse into literal geometry, and flag remaining portability hazards.
- [x] Sanitized `diagrams/2.output/svg/attention-qkv-onbrand.svg`, `diagrams/2.output/svg/inference-snaps-onbrand.svg`, `diagrams/2.output/svg/logic-data-vram-onbrand.svg`, `diagrams/2.output/svg/memory-wall-onbrand.svg`, and `diagrams/0.reference/onbrand-svg-starter.svg` to remove symbol-based reuse.
- [x] Replaced the one remaining marker-based annotation arrow in `memory-wall-onbrand.svg` with literal line and path geometry.
- [x] Removed the linked `library-compare-canvas.svg` from the canonical workflow because it depended on external SVG image references and would always trigger relink behavior.
- [x] Tightened the text portability pass so the sanitizer now writes explicit `font-family`, `font-size`, `font-weight`, and `fill` onto each text node, and normalized bold text to `700`.
- [x] Brought `attention-qkv-onbrand.svg` fully back to the `9px` text system and increased `inference-snaps-onbrand.svg` in-box icons to the heavier `24px` default from the local `48x48` source icons.

### 2026-04-01 — Reference block refresh

- [x] Inspected the user-provided Illustrator export `diagrams/0.reference/sample.svg` and confirmed it is structurally clean on our side: no `<use>`, no `<symbol>`, no linked images, and no marker-based arrows.
- [x] Confirmed the sample arrow treatment comes through as literal line-plus-triangle geometry and is suitable as the new single-box building block reference.
- [x] Added the higher-resolution companion image `diagrams/0.reference/sample.png` as the clearer `3x` visual reference for that same block.

## Long-term