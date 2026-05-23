# History

Completed work belongs here so `TODO.md` stays lean.

## Short-term

### 2026-05-24 – Autonomous session: force editor features + module split (branch frame-layout-engine)

- **v2 corpus blockers fixed.** Widened col_gap/row_gap from 24→32 on 5 diagrams to fix 6 arrow clearance violations (arrows need 24px minimum after baseline snap). 0 clearance violations remaining.
- **SVG renderer snapshot tests.** 3 golden-file tests (two_box_vertical, panel_with_children, horizontal_arrow) with `--update-golden` flag.
- **Security hardening for override save endpoint.** 1MB payload limit, structure validation, type checks, component ID validation via `_is_safe_slug`.
- **Force keyboard nudge.** Arrow keys move selected pinned node (8px default, 24px with Shift). Multi-select moves all selected pinned nodes.
- **Force override highlight in tree.** Tree items with pinned position or style override get italic + accent color.
- **`diagram_shared.py` module split.** Extracted `design_tokens.py`, `text_metrics.py`, `grid_helpers.py` alongside unchanged monolith for backwards compatibility.
- **Force hover highlighting.** Reuses existing `dg-hover` CSS class via mouseover/mouseout on node groups.
- **Force double-click text editing.** Full inline label editing with Enter to commit, Escape to cancel, Shift+Enter for newlines. Server API extended with `label` param on node update. Label overrides persisted/serialized/loaded through existing override system. Undo support.
- **Force multi-select.** Shift/Ctrl+click toggles selection in stage and tree. `selectedId` (string) replaced with `selectedIds` (Set). Inspector shows "N nodes selected" for multi. Resize handles single-only.
- **Stale-definition detection.** Tracks `definition_hash` from saved overrides. Shows warning banner when source JSON changed since last save. Saving clears warning.

### 2026-05-23 – Per-side padding UI, stale overrides cleanup, heading height fix (branch frame-layout-engine)

- **Per-side padding UI in inspector.** Replaced single "Padding" input with a Figma-style 4-field layout (T/R/B/L) with a link/unlink toggle button (🔗/🔓). When linked: single input sets all sides via `padding` override. When unlinked: 4 inputs set `padding_top/right/bottom/left` overrides individually. Link state detects explicit per-side overrides (not just value equality). Re-linking uses top value as uniform. Added `togglePaddingLink()`, `toggleMultiPaddingLink()` functions. Layout bridge handles per-side overrides (applied after uniform, so they win). `setFrameProp`/`setMultiFrameProp` clear conflicting overrides when switching modes. Both single-select and multi-select inspectors support the new UI. Browser-verified: link/unlink toggle, per-side editing, re-linking.
- **Stale coerced overrides cleaned.** Removed 3 redundant `sizing_w: FILL` overrides from `android-container-vs-vm.json` (matched YAML base defaults). All other override files contain intentional user adjustments. Runtime coerced-key cleanup already handles stale coercion values.

### 2026-05-23 – Triage and cleanup pass

- **Golden-value assertions** marked superseded by M5 parity fixture system (6 fixtures, 78 cross-engine assertions). Real diagrams use different text measurement backends so exact coordinate matching isn't feasible.
- **Secondary audit findings triaged:** removed dead `_layout_helper` function (never called), fixed stale server line count in STATUS.md (485→~1380), documented preview text-width mismatch as known limitation (resolves with TS port), documented stale-v2 comparison risk as tracking note (reference rasters intentionally frozen).
- **v2 corpus blockers retagged** from `[S]` to `[L]`: 6 arrow clearance violations (mechanical gap fixes) + 59 baseline-grid warnings (cosmetic).
- **Padding defaults audit.** Verified: bordered nodes get `padding=8`, borderless containers get `padding=0`. No borderless containers with headings exist — default 0 is correct.
- **Heading height consistency fix.** (Carried from previous session.) Width-constrained heading height at all pipeline stages prevents child overflow.

### 2026-05-23 – Three features: row-height fix, PNG export, dirty flag

- **`_uniform_row_height` includes Annotations/Helpers/MatrixWidgets.** Fixed the v2 layout bug where annotation-only rows always got `BOX_MIN_HEIGHT` regardless of content. Function now accepts all grid-placed item types with per-type height computation. Removed redundant post-hoc helper expansion loop (was computing same heights as the primary pass). Annotation docstring contract ("participates in row-height equalization") now implemented.
- **PNG export at 1x, 2x, 3x** (`scripts/export_png.py`). Playwright-based PNG exporter using per-scale `device_scale_factor` browser contexts for crisp vector rendering. Supports `--all` (all SVGs in output dir), `--scale 1,2,3`, `--output-dir`. Proper resource cleanup (try/finally on contexts and temp HTML). Validated: error handling for invalid/out-of-range scales.
- **Force editor dirty flag and save-button state.** Added `_savedIndex`, `markSaved()`, `isDirty()`, and optional `saveBtnId` to shared `UndoRedoManager`. Force editor Save button now disabled when clean, enabled on any edit. Handles edge cases: branch divergence (undo + new push invalidates the saved point), maxSize stack overflow (decrements or invalidates saved index), and reset (clear sets saved index to 0). Button state initialized on construction. Backwards-compatible — grid editor's own `setDirty()`/`lastSavedState` mechanism unaffected.
- **draw.io renderer semantic parenting wired in.** The previously-dead `_find_children` function was replaced with inline `component_id` matching at the actual call site. Texts and icons are now claimed by `component_id` match first, falling back to spatial containment only for legacy primitives without `component_id`.

### 2026-05-23 – Stale coercion override cleanup + constraint UI (branch frame-layout-engine)

- **Fixed stale coercion override values.** GPT-5.4 review identified that when coercion cleared (e.g., FILL child reverted to HUG), `_coercedKeys` was cleaned but the injected override values (`sizing_h: 'FIXED'`, `height: 288`) persisted. The parent stayed FIXED with no "Fixed (auto)" indicator. Fix: when cleaning stale coerced keys, also delete the corresponding override values. If any stale values were cleaned, re-run layout so the model is never stale. Also extracted the camelCase→snake_case key mapping to a `_COERCED_KEY_MAP` lookup table per Opus 4.6 recommendation.
- **Min/max constraint fields in inspector.** Added `min_width`, `max_width`, `min_height`, `max_height` input fields below each axis's sizing dropdown. Visible when sizing is FILL or FIXED, hidden for HUG. Empty value clears the constraint. Model data extended in layout-bridge.js (`frameToTreeData`) to expose frame constraint values. Both single-select and multi-select inspectors support constraints. Browser-verified: min_height=120 on a FILL child increased it from 64→160; multi-select constraint applies to all selected items. Constraint violation prevention: auto-adjusts opposite bound when min > max (Figma-style) in both single-select and multi-select. Browser-verified: setting min above max raises max, setting max below min lowers min.

### 2026-05-23 – Coercion visibility in inspector (branch frame-layout-engine)

- **Wired coercion into inspector UI.** When the engine coerces a HUG parent to FIXED (because it has FILL children), the sizing dropdown now shows "Fixed (auto)" in gold italic text with `.dg-coerced` CSS class. Root cause of initial non-display: TS engine returns camelCase keys (`sizingH`, `sizingW`) in its `CoercedOverride` map, but the override/inspector system uses snake_case (`sizing_h`, `sizing_w`). Fixed by translating keys during coercion merge. Also fixed stale `_coercedKeys` cleanup — after each relayout, keys no longer in the engine's coerced output are removed. Multi-select coercion indicators also supported via `_getMultiSizingValues()`. Coercion merge condition fixed: sizing properties always accept engine coercion (was silently dropping coercion when user had just set HUG).
- **Coercion lifecycle test coverage.** 7 new TS unit tests in `layout.test.ts`: single FILL child → coerced parent → revert; partial FILL removal (one removed, coercion persists; all removed, reverts); override value correctness (sizingH/height present, sizingW/width absent); horizontal axis lifecycle; nested independent coercion/revert; cross-axis FILL non-coercion; mixed FILL/HUG children distribution. Total: 119 TS tests passing. Covers Tier 1 test coverage, plus all 4 Tier 3 edge case items.

### 2026-05-23 – `_refresh_coerced_heights` bug fix (branch frame-layout-engine)

- **Bug fix: `_refresh_coerced_heights` no longer overwrites explicit FIXED heights.** Root cause: the function checked `frame.sizing_h == FIXED` to decide whether to refresh, but this matched both user-set FIXED (should preserve) and engine-coerced FIXED (should refresh). Fix: threaded `coerced_ids` set from `_enforce_fill_hug_invariant()` through `_remeasure_with_width_constraints()` → `_refresh_coerced_heights()`. Only frames whose IDs appear in the coerced set get refreshed. Fixed identically in Python (`layout_v3.py`) and TS (`layout.ts`). Parity fixtures regenerated — test-fill-distribution root correctly keeps height=480 (was 288). test-mixed-sizing root correctly keeps height=480 (was 368). 112 TS tests + 151 Python tests pass.

### 2026-05-23 – TypeScript layout engine M5 + M6 (branch frame-layout-engine)

- **M5: Shared parity test fixtures.** Created 6 parity test fixtures (test-vertical-stack, test-fill-distribution, test-mixed-sizing, test-nested-containers, test-deep-nesting, test-alignment-grid) as JSON with serialized Frame tree input + expected placed coordinates generated by the Python engine using mock text adapter (`text.length * fontSize * 0.6`). TS test (`parity.test.ts`, 39 tests) reconstructs Frame trees from JSON, runs `layoutFrameTree()` with `MockTextAdapter`, asserts identical coordinates. Python test (`test_parity.py`, 6 tests + 33 subtests) does the same with scoped monkey-patched `measure_text_width`. Both pass. Total: 112 TS tests + 180 Python tests passing.
- **Bug discovered: `_refresh_coerced_heights` overwrites explicit FIXED heights.** The function cannot distinguish user-set FIXED from engine-coerced FIXED. When a FIXED root has FILL children, `_refresh_coerced_heights` recomputes and overwrites `root.height` from children's measured heights (e.g., 480→288 in test-fill-distribution). Same behavior in both Python and TS — parity is correct, but both are wrong. Tracked in TODO.md for post-parity fix.
- **M6: Server API cleanup.** Removed `/api/relayout-v3/<slug>` endpoint (~200 lines), `_relayout_v3()` function, `_serve_relayout_v3()` handler from `preview_server.py`, and `test_relayout_v3.py` (29 tests). Removed server fallback from `requestV3Relayout()` in `editor.js` — now client-side-only via `performLocalRelayout()`. Server keeps: load diagram, save overrides, export SVG/draw.io, batch build, frame-tree JSON API. Browser-verified: 0 console errors on v3 diagrams. Validation command updated to exclude removed test file.

### 2026-05-23 – TypeScript layout engine M3 + M4 (branch frame-layout-engine)

- **M3: Canvas text adapter.** `packages/layout-engine/src/canvas-text-adapter.ts` — browser Canvas text measurement implementing `TextMeasureAdapter`. Constructor accepts optional `{ fontFamily, weight, ctx }`, defaults to `'Ubuntu Sans', sans-serif` weight 400. `ensureFontsReady()` awaits `document.fonts.ready`. 6 tests using mock CanvasRenderingContext2D. IIFE browser bundle builds at 33KB via esbuild (`npm run build:browser`).
- **M4: Wire into editor.** `scripts/preview/layout-bridge.js` (~400 lines) bridges server-serialized Frame tree JSON and the LayoutEngine IIFE global. Server serves frame tree via `GET /api/frame-tree/<slug>` and the IIFE bundle via `GET /preview/layout-engine.js`. `performLocalRelayout()` clones the frame tree, applies overrides, runs the TS layout engine, patches SVG positions/sizes, updates component model, and routes arrows — all client-side. Falls back to server round-trip on failure (returns null). Browser-verified on `android-container-vs-vm` (gap, direction, padding changes; SVG patching correct; 0 console errors) and `attention-qkv` (bridge runs but text measurement differences between Canvas and fontTools cause visual variance — expected limitation until TS engine owns full rendering). Total: 73 TS tests + 174 Python tests passing.

### 2026-05-22 – TypeScript layout engine M1 + M2 (branch frame-layout-engine)

- **M1: Frame model in TypeScript.** Ported `Frame`, `Direction`, `Sizing`, `Align`, `Border`, `Line`, `Arrow`, `FrameDiagram`, and `enforceFillHugInvariant` to `packages/layout-engine/src/frame-model.ts`. 21 unit tests covering construction, validation, and coercion. Package uses vitest + TypeScript 5.8.
- **M2: Layout algorithm in TypeScript.** Ported `measure()`, `distributeFillSpace()`, `place()`, `alignOffset()`, `headingHeight()`, and the constrained re-measurement pass (resolve child widths → propagate width → propagate height → refresh coerced heights) to `packages/layout-engine/src/layout.ts`. Design tokens (`BASELINE_UNIT`, `BLOCK_WIDTH`, etc.) in `tokens.ts`. Text measurement via adapter interface (`TextMeasureAdapter`) in `text-measure.ts` — `MockTextAdapter` for tests, real adapter (Canvas.measureText) deferred to M3. 46 additional tests (24 layout + 22 tokens). Total: 67 TS tests passing.
- **Architecture audit peer-reviewed.** An Opus 4.6 audit (`diagram-generator-planning/docs/architecture-audit-2026-05.md`) proposed 4 prerequisites before the TS port. Peer review via Explore subagent verified none actually gate the port: `layout_v3.py` already owns all layout for v3 Frame YAML; renderers are already pure markup emitters; v2 deprecation and `diagram_shared.py` split are parallel cleanup, not prerequisites. Valid non-blocking findings integrated into TODO.md.
- **FILL distribution contract fix.** Fixed `_distribute_fill_space()` in Python `layout_v3.py` — FILL children now divide available space equally regardless of measured content size, matching Figma's model. 174 Python tests pass. Browser-verified on `android-container-vs-vm`.

### 2026-05-22 – Swappable engine interface Phase 2a + 2b (branch frame-layout-engine)

- **Phase 2a: Shared UndoRedoManager and resize handles.** Extracted shared `UndoRedoManager` class into `undo-manager.js` (configurable button IDs, max stack size, async restore callback). Extracted shared resize handle rendering (`renderResizeHandles()`, `clearHandlesByClass()`) and shared constants (`SHARED_HANDLE_SIZE=8`, `SHARED_MIN_NODE_SIZE=48`) into `editor-base.js`. Refactored `force.js` to use `UndoRedoManager` and shared resize handles. Refactored `editor.js` 8-handle resize to use shared `renderResizeHandles`. Removed dead `HANDLE_SIZE`/`MIN_NODE_SIZE` local constants from both editors. Updated `viewer-unified.html` script load order.
- **Phase 2b: Shared snap algorithm.** Extracted shared `snapRectToTargets()` into `editor-base.js` — dual-axis snap with guide line generation. Refactored `force.js` `snapForcePosition()` and `editor.js` `findSnaps()` to delegate. Fixed guide line accuracy: editor.js now regenerates guide lines at the 8px-rounded final position. Removed unused `SNAP_THRESHOLD` alias.

### 2026-05-22 – Equal-split unification + force resize + force undo/redo (branch frame-layout-engine)

- **Equal-split unification.** Extracted `equal_split_cell()` and `span_size()` into `diagram_shared.py` (Python) and `editor-base.js` (JS). Wired `component-model.js` (4 inline formulas replaced) and `diagram_layout.py` (`span_w` via `span_size()`). v2 `sp_outer_w` intentionally keeps ceil rounding (documented). Fixed `BASELINE_STEP` redeclaration error (now owned by `editor-base.js` only). 7 cross-language contract tests added.
- **Force resize handles.** 8-handle resize (corners + midpoints) on selected force nodes. Dragging snaps width/height to 8px grid, adjusts center position per handle direction, commits to server via `updateForceNode()` with width/height params, restarts solver. Backend: `force_preview.py` and `preview_server.py` accept width/height in node update API and override serialization. Minimum node size: 48px.
- **Force undo/redo.** Command-based undo stack (max 50) covering move/pin, style change, resize, and pin toggle. Each command captures affected node state (position, pinned, width, height, style) before and after. Undo/redo buttons in force toolbar, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard shortcuts. Reset clears the stack. Also fixed `btn-force-save` wiring (was targeting wrong element ID).

### 2026-05-22 – v3 autolayout engine milestones 1–12 complete (branch frame-layout-engine)

Full test-first redesign of the v3 frame layout engine, from scratch test coverage through Figma-correct per-axis sizing and interaction parity. 165 tests passing at completion.

- **M1 Stabilize:** Stashed unverified UI, confirmed server + 8 original tests stable.
- **M2 Directional layout:** 12 tests for V/H/mixed measure→place pipeline.
- **M3 Alignment grid:** 17 tests for 9-point `_align_offset()` + grid-snap.
- **M4 Sizing model:** 14 tests for HUG/FILL/FIXED interactions and edge cases.
- **M4a Research fixes:** FILL-in-HUG invariant, distribution fairness, heading overflow guard. Informed by 3-subagent Figma/Yoga/Penpot research.
- **M5 Cross-axis alignment:** `_is_cross_stretch()`, 10 tests, backward-compat verified (70/70).
- **M6 Real diagram integration:** Build verification, browser verification on 3 representative diagrams.
- **M7 Stashed UI — superseded:** Old alignment/relayout code rebuilt from scratch in M9/M11.
- **M8 Nested stress testing:** Competitive review found 2 bugs + 6 gaps, all fixed. 15 new tests.
- **M9 Editor integration:** `buildAutolayoutPanel`, live relayout API, alignment triggers relayout.
- **M10 Native Frame YAML:** `frame_loader.py`, `engine: v3` discriminator, 5 test-case YAMLs, omission/default rules frozen by tests.
- **M11 Per-axis sizing redesign:** `sizing_w`/`sizing_h`, per-side padding, deleted `_is_cross_stretch()`, per-axis resize, component tree round-trip. 4-phase rollout.
- **M12 Interaction parity:** Drag-to-reorder, multi-select bulk editing, Shift+Enter parent nav, Enter select-all-children, autolayout drag suppression.

### 2026-05-22 – Unified editor shell (branch frame-layout-engine)

- **editor-base.js**: Shared utility module with `byId`, `escapeHtml`, `fetchJson`, `downloadFile`, `getThemeToken`, `setViewMode`, `initViewTabs`, `initDiagramPicker`, `bindShellResize`, `getStageSvg`, `pointerToSvgPoint`, `setStatus`, `initPreviewShell`. Both grid and force editors load this before their mode-specific script.
- **viewer-unified.html**: Single HTML template replacing `viewer.html` and `force-viewer.html`. Uses `data-dg-mode="grid"|"force"` attribute with CSS `.dg-grid-only`/`.dg-force-only` visibility rules. Shared: nav, stage, sidebar header (picker + prev/next + status), inspector section. Grid-only: Browse/Layers tabs, grid controls, overrides, constraints. Force-only: Nodes heading, solver controls, simulation params, guidance.
- **force.js**: Removed duplicated `byId`, `escapeHtml`, `fetchJson`, `setStatus`, `setViewMode`, `getStageSvg`, `pointerToStagePoint`, `stepPicker` functions. Updated element IDs to unified: `force-picker`→`diagram-picker`, `force-selection`→`inspector`, `tree`→`tree-force`. Shell init delegated to `initPreviewShell()` from editor-base.js.
- **preview_server.py**: Both `_build_viewer_html` and `_build_force_viewer_html` now use `_get_unified_template()`. Mode-specific substitutions: `%MODE%`, `%BROWSE_NAV%`, `%INSPECTOR_EMPTY%`, `%MODE_SCRIPTS%`.
- **editor.css**: Added `[data-dg-mode="grid"] .dg-force-only` and `[data-dg-mode="force"] .dg-grid-only` display rules.
- Browser-verified: grid editor shows all grid-only sections (Browse/Layers, Grid, Overrides, Constraints), hides force sections. Force editor shows force-only sections (Nodes, Solver, Simulation, Guidance), hides grid sections. Both render diagrams and run simulations correctly.

### 2026-05-22 – Baseline-snap column widths + column-span width input (branch frame-layout-engine)

- **Feature A: Baseline-snap columns.** Column widths now snap down to 8px multiples in both `_computeBrockmanGrid()` (editor.js) and `_build_grid_info()` (layout_v3.py). Leftover absorbed into `resolved_right_margin`. Grid overlay shows right-margin zone when it exceeds configured margin.
- **Feature B: Column-span width input.** Inspector sizing section now shows numeric input + unit dropdown (`px`/`cols` for width, `px`/`rows` for height) when sizing mode is FIXED. Conversion helpers: `colSpanToPx`, `rowSpanToPx`, `pxToColSpan`, `pxToRowSpan`. Works in both single-select and multi-select inspectors.

### 2026-05-22 – Force engine UI sliders

- Added "Simulation" section to force-viewer sidebar with 8 live parameter controls: link_distance, link_strength, charge_strength, collision_padding, velocity_decay, alpha_min, alpha_decay, curve_handle_ratio.
- Backend: `_get_simulation_params()` and `update_simulation_params()` in `force_preview.py`, `POST /api/force-params/{slug}` endpoint in `preview_server.py`.
- Render overrides: `render_overrides` dict on `ForcePreviewState` for client-side render config (curve_handle_ratio).
- Fixed `_get_simulation_params` bug: `ForceLinkForce._distance_fn` and `_strength_fn` need 3 args, not 2.
- Fixed preview port-kill on Windows: now logs target PID, skips own PID, kills per-PID instead of blanket `ForEach-Object`.
- Fixed `_relayout` gap comparison bug: capture `orig_col_gap`/`orig_row_gap` before `importlib.reload()`, not after.

### 2026-05-22 – Separator role test coverage

- Added `test_separator_role_renders_dashed_line` verifying that `role: separator` frames render as `DashedLinePrimitive` + `TextBlock` rather than `Rect`.

### 2026-05-22 – Min/max size constraints (branch frame-layout-engine)

- **Frame model.** Added `min_width`, `max_width`, `min_height`, `max_height` optional int fields to `Frame` dataclass with validation (non-negative, min ≤ max).
- **Layout engine.** `_clamp_to_constraints()` utility; `_distribute_fill_space()` extended with per-child min/max lists; `place()` clamps `_placed_w`/`_placed_h` after sizing; `_resolve_child_widths()` clamps per-child widths. HUG/FIXED children with min constraints correctly reduce FILL distribution space.
- **YAML parsing.** `frame_loader.py` reads the 4 new fields from frame YAML.
- **API.** `preview_server.py` forwards min/max overrides with input validation (non-negative, type-safe).
- **Editor.** `FRAME_KEYS` in `editor.js` updated to include the 4 new keys.
- **Tests.** 10 new tests covering: min_width on FILL, max_width on FILL, min on HUG, max on FIXED, min/max heights, YAML parsing, constraint inversion rejection, negative rejection, HUG+min_width FILL distribution accounting. 164 total passing.
- **Review.** Adversarial code review caught: hug_total accounting bug (fixed), missing validation (added), API input safety (hardened).

### 2026-05-22 – Multi-select bulk property editing (branch frame-layout-engine)

- **Bulk property inspector.** Extended `renderMultiSelectionInspector()` with bulk editing controls for alignment (9-point grid), container props (direction/gap/padding), sizing mode (Hug/Fill/Fixed), and style picker — all with "Mixed" support when values differ across selected items.
- **Helper functions.** `_getMultiSizingValues()`, `_getMultiContainerValues()`, `_getMultiAlignValues()`, `_getMultiStyleValues()` read shared values across selection.
- **Action functions.** `setMultiFrameAlign()`, `applyMultiStyleOverride()`, `setMultiFrameProp()` apply changes to all selected items with a single debounced relayout.
- **Review fixes.** Added `node.data` null-safety in FIXED-capture path, empty-ids guard before relayout dispatch.

### 2026-05-22 – Domain-specific undo/redo (branch frame-layout-engine)

- **Override-patch undo.** Converted 12 undo actions from full-state snapshots to targeted override-patch commands: `applySelectionTargets`, `onWpDragUp`, `addWaypoint`, `removeWaypoint`, `applyStyleOverride`, `applyV3Style`, edit text, `clearOverride`, nudge, `setFrameProp`, `setFrameAlign`, plus all multi-select actions.
- **v3 style undo bug fix.** `applyV3Style` previously had no undo support; now uses patch-based undo.
- **Timer cleanup.** `_restoreOverridePatch` now clears `_v3RelayoutTimer` to prevent stale relayout after undo.

### 2026-05-22 – Frame-layout-engine interaction features batch (branch frame-layout-engine)

Five features implemented with competitive code reviews (Opus 4.6 vs GPT-5.4) after each:

- **Feature 1: Snap to grid.** Drag and resize now snap to column edges, row tops, and baseline grid lines. Guide lines render during snap. `findSnaps()` delegates to shared `snapEdgeToTarget()` and `collectGridSnapTargets()`. Resize handler snaps each edge independently with grid-priority. DRY fix: unified snap-target collection.
- **Feature 2: Swappable engine interface (Phase 1).** Abstract `EngineAdapter` class in `engine-interface.js` defines the common interaction contract. Shared snap primitives extracted to `editor-base.js`: `snapEdgeToTarget`, `collectGridSnapTargets`, `collectPeerSnapTargets`, `renderGuideLines`, `clearGuideLines`. Both editors delegate to shared primitives.
- **Feature 3: Force alignment guides.** Force drag now snaps to peer node edges with guide lines. `collectForceSnapTargets()` converts center-positioned force nodes to top-left rects, then uses `collectPeerSnapTargets()`. Snap applied during drag preview and on final commit.
- **Feature 4: Simplify force inspector.** Selection panel reduced from 8 fields to 3 (Node, Style dropdown, Pin/Unpin). Removed: Label, Position, Size, Pinned, Effective style, and help text.
- **Feature 5: Grid-aware resize.** Implemented as part of Feature 1 — resize handles snap to column/row edges with snap indicators.

### 2026-05-22 – Live text reflow during resize (branch frame-layout-engine)

- **Bidirectional text reflow.** Fixed `reflowTextInGroup()` in editor.js to handle both narrowing AND widening. Previously the function only split tspans that were too wide; it never joined tspans that could be merged when the box grew. Root cause: each existing tspan already fit at the new (wider) available width, so the split-only logic kept them unchanged.
- **Join-then-wrap approach.** Added a Phase 1 that merges consecutive same-style tspans (same font-size, font-weight, fill, letter-spacing, font-variant-caps, font-family) back into single text strings, then Phase 2 re-wraps each merged string at the new available width. This mirrors the Python engine's approach of starting from semantic text and wrapping fresh.
- **Content-aware rebuild trigger.** Changed the tspan rebuild condition from count-only (`specs.length !== tspans.length`) to content-aware (also checks if any tspan text differs), so wrapping changes are applied even when the line count stays the same.
- Empty separator tspans and heading/body style boundaries are preserved correctly — the join phase only merges non-empty consecutive same-style tspans.
- Verified: widening (10→6 tspans), narrowing (10→14 tspans), neutral (10→10), restore (10→10 exact match). Height auto-expansion works correctly in all directions.
- 154 Python tests pass (no regressions).

### 2026-05-22 – Text editing deferred composition (branch frame-layout-engine)

- **Text editing overflow fix.** `commitTextEdit()` was directly patching SVG `<tspan>` elements without triggering re-wrapping or relayout, causing text to overflow the box when deleting line breaks. Root cause: the old flow bypassed the engine entirely.
- **Deferred composition (InDesign model).** Rewrote the text editing flow as semantic-in, engine-out:
  - Added `heading_text`/`label_text` fields to `ComponentInfo` (diagram_layout.py) carrying semantic (unwrapped) text from Frame to client.
  - Updated `_frame_to_ci()` (layout_v3.py) to populate semantic text fields.
  - `startTextEdit()` now shows unwrapped semantic text in the textarea instead of visual tspan content.
  - `commitTextEdit()` builds a structured `{heading, label}` text override and triggers `requestV3Relayout()` instead of patching tspans.
  - Added `'text'` to `FRAME_KEYS` in the relayout request so text overrides reach the server.
  - Server `_relayout_v3()` processes text overrides, preserving original line styles (weight, size, fill).
  - Added initial-load relayout trigger for saved text overrides.
- Browser-verified: deleting line breaks re-wraps text within box, no overflow, box resizes correctly.

### 2026-05-22 – Border.DASHED gating + font metrics (branch frame-layout-engine)

- **Border.DASHED gated out of YAML.** Removed `"dashed"` from `frame_loader._BORDER` map and editor.js `borderMap` so the v3 YAML pipeline can't produce dashed borders. `Border.DASHED` remains in the Python enum for programmatic v2 pipeline / draw.io export use. Updated 4 test YAMLs from `border: dashed` to `border: solid`. Style dropdown now shows exactly 3 presets.
- **box-styles.js border properties.** Added explicit `border` property to all 3 presets (default→"solid", accent→"none", highlight→"solid") so `applyV3Style` sets the correct border when applying styles.
- **Font metrics via fonttools.** Replaced character-width estimation with real `hmtx` table lookups via `measure_text_width()` in `diagram_shared.py`. Updated `estimate_line_width()` and `wrap_text_lines()` to use real font metrics.
- **FILL-width + HUG-height re-measurement.** Added `_distribute_fill_space()` shared helper and `_refresh_coerced_heights()` for stale coerced parent heights. Refactored `_resolve_child_widths()` and `place()` to use the shared helper.
- **11 new tests.** `_distribute_fill_space` (3), font metrics (3), `wrap_text_lines` (2), re-measure (3). Total: 154 tests passing.
- Deleted bug screenshots (image-1.png, image-2.png, image-3.png) after both INBOX bugs verified fixed.

### 2026-05-21 – v3 Brockman contract + SVG export (branch frame-layout-engine)

- Added a dedicated `Save SVG` button to the preview sidebar. It downloads the current stage DOM as `*-onbrand-v3.svg` for native frame diagrams instead of forcing the user through the old clipboard-only export path.
- Moved Brockman grid ownership into the v3 engine contract: `FrameDiagram` now carries grid settings, `layout_v3.py` returns authoritative `grid_info`, and `/api/relayout-v3/<slug>` now round-trips `grid_overrides` + `grid_info`.
- Updated the preview to consume server-owned v3 grid metadata instead of reconstructing Brockman grid state locally in the common path.
- Unified wrapped text measurement with rendering through shared helpers in `diagram_shared.py`, and added a regression test for mixed heading/body line-step measurement.
- Added `scripts/test_frame_loader.py` to freeze the native frame-YAML omission semantics, width/height → FIXED inference, padding defaults, and `grid:` parsing.
- Validation: focused v3 test suite now passes at 114 tests; browser-verified separate `col_gap` / `row_gap` persistence and working `Save SVG` download for `v3:support-engineering-flow`.

### 2026-05-20 – INBOX bug fixes (branch frame-layout-engine)

- Fixed text editing stuck: `onSvgMouseDown` now calls `commitTextEdit()` before handling new interaction, so clicking elsewhere properly exits text editing mode.
- Fixed HUG text width overlap: `_leaf_natural_size` now estimates text width using per-character measurement and sizes the box to fit text + icon. Uses `max(content_width, BLOCK_WIDTH)` so boxes never shrink below 192px. Added `_estimate_text_width()` helper to `layout_v3.py`.

### 2026-05-20 – Autolayout interaction parity (Milestone 12) (branch frame-layout-engine)

- Disabled free drag for autolayout children: when a component's parent has `layout` set (vertical/horizontal), `onDragMove` suppresses `dx`/`dy` override writes.
- Implemented drag-to-reorder: during drag in autolayout parent, orange dashed insertion indicator shows between siblings. On drop, emits `children_order` override that reorders children.
- Server handles `children_order` override: reorders `target.children` list before relayout.
- Fixed `selectComponent` to sync `selectionDepth` with component ancestry so SVG mousedown targets the correct depth after tree-panel selection.
- Added `_isAutolayoutChild()`, `_getReorderTargets()`, `_showReorderIndicator()`, `_clearReorderIndicator()`, `_applyReorder()` helpers in editor.js.
- Added `children_order` to `FRAME_KEYS` in `requestV3Relayout()`.
- Added Shift+Enter keyboard shortcut to navigate from child to parent.
- Added Enter key to select all children of the selected parent frame.
- Modified double-click behavior: when double-clicking a container that's already selected, selects all children instead of drilling into one.
- Suppressed arrow-key nudging for autolayout children (position is engine-controlled).
- Updated inspector help text: autolayout children see "Drag to reorder · Shift+Enter to select parent" instead of "Drag to move".
- Browser-verified: reorder indicator appears during drag, child order changes after drop, Shift+Enter navigates to parent, Enter selects all children.

### 2026-05-20 – Parent coercion model + coercion persistence (branch frame-layout-engine)

- Redesigned FILL-in-HUG invariant: parent is now coerced HUG→FIXED (freezing at measured size) instead of coercing children FILL→HUG. Children stay FILL and divide the frozen space equally. Cross-axis FILL is not coerced. Matches Figma behavior.
- Fixed HUG sizing latent bug: `place()` was using `max(measured, available)` for HUG; now always uses measured only.
- Added coercion persistence: `_enforce_fill_hug_invariant()` returns a `coerced` dict of frame IDs and their frozen dimensions. Server includes `coerced_overrides` in the relayout response. Editor merges them into overrides with `_coercedKeys` tracking so the frozen size survives subsequent padding/gap changes.
- Added FIXED-switch size capture in `setFrameProp()`: switching to FIXED captures current placed width/height; switching away clears captured size.
- Added inspector coercion reconciliation: if user sets HUG but engine coerces to FIXED, the override is updated to reflect the effective state.
- Fixed `width=0` truthiness bug: 4 locations in `layout_v3.py` used truthiness checks (`frame.width:`) that silently ignored `width=0`; changed to `frame.width is not None:`.
- Fixed root width/height fallback: `root_w = root.width or root._measured_w` → `root.width if root.width is not None else root._measured_w`.
- Added `coerced_overrides` field to `LayoutResult` dataclass.
- Added `TestParentCoercion` class with 19 tests: per-axis coercion, cross-axis preservation, 3-level cascades, coerced_overrides return value, nested coercion reporting.
- Added `test_fixed_width_zero_honored` for the truthiness fix.
- Total test count: 96 autolayout + 8 integration = 104 tests, all passing.
- Browser-verified full round-trip: FILL → coerce → padding change → gap change → child revert → parent revert. Height stays locked at 288 through property changes, reverts correctly when user explicitly sets HUG.

### 2026-05-19 – v3 autolayout test suite + FILL distribution fix (branch frame-layout-engine)

- Built comprehensive test suite (`test_autolayout.py`): 47 tests across 11 test classes covering directional layout (V/H/mixed), 9-point alignment grid, HUG/FILL/FIXED sizing model, edge cases, and invariants. All pass.
- Built interactive standalone demo (`demo_autolayout.py`): HTTP server on port 8200 with direction, alignment (3×3 grid), child count, per-child HUG/FILL toggles, gap/padding/container-size sliders. Returns SVG with 8px grid dots and depth-colored fills.
- Fixed 4 FILL distribution bugs: (a) FILL children now get equal share of remaining space (not measured-based), (b) FILL frames accept parent-assigned size even below measured (allows shrinking), (c) parent labels hidden on non-leaf frames, (d) zero-slack distribution via `base_fill + extra_fills` pattern eliminates rounding gap.
- All fixes browser-verified with interactive demo screenshots: zero gap edge-to-edge, alignment has zero effect when all FILL, mixed HUG/FILL keeps parent padding constant.
- Ran 3-subagent research (code review + Penpot/Yoga + Figma behavioral spec): confirmed two-pass architecture matches industry standard. Identified 3 actionable gaps: FILL-in-HUG invariant, FILL distribution fairness, cross-axis alignment. Triaged into TODO Milestone 4a.

### 2026-05-19 – v3 frame layout engine fixes (commit 9d49ed1, branch frame-layout-engine)

- Fixed three autolayout overflow bugs in `layout_v3.py`: separators now respect explicit `frame.height` instead of defaulting to `BOX_MIN_HEIGHT`; padding always applied on borderless frames (fixes root `outer_margin` being ignored); FILL distribution uses measured-first approach where every child gets at least its measured size.
- Added `test_layout_v3.py` with 8 unit tests covering vertical containment, FILL sharing, mixed HUG+FILL, unequal FILL sizes, explicit height, borderless padding, nested containers, and cross-axis stretch. All pass.
- Verified all 21 v3 diagrams have zero overflow via full `build_v2.py --engine v3` run.

### 2026-05-19 – v3 arrow attachment fix (commit d62a99c, branch frame-layout-engine)

- Fixed arrow attachment in v3 output: arrows now connect to correct box edges using `bounds_map` lookup.
- Fixed arrow centering on source/target box sides.
- Added initial 9-point alignment widget to the inspector (later replaced — see uncommitted work below).

### 2026-05-19 – Uncommitted v3 editor work (NOT browser-verified)

The following changes exist in the working tree but were NOT verified in a browser. They may or may not work:

- Replaced 3×3 dot grid alignment widget with 2 dropdown menus (vertical + horizontal) in `editor.js`
- Removed the `ENGINE === "v3"` gate so alignment dropdowns appear for all engines
- Added `/api/relayout-v3/<slug>` endpoint in `preview_server.py` with `_relayout_v3()` function that accepts per-frame alignment overrides
- Added `requestFrameRelayout()` in `editor.js` that calls the v3 relayout API on dropdown change
- Updated `editor.css` to replace the 3×3 grid styles with dropdown styles

**Warning:** The preview server crashed repeatedly during this session (6 instances, all exit code 1). None of the uncommitted features were verified in a browser. The next agent must verify each feature individually before building on top of them.

### 2026-05-19 – Android diagram batch + sentence case rule

- Created 4 android diagram definitions: `android-graphics-stack`, `android-custom-to-cloud`, `android-security-comparison`, `android-container-vs-vm`.
- Registered all 4 in `build_v2.py` registry, `preview_server.py` reference map, and `build_compare_pages.py` pairs.
- Added "Adding a new diagram (checklist)" section to `STATUS.md` documenting the 3 required registration steps.
- Added sentence case casing rule to `DIAGRAM.md` (new "Casing" section) and redraw skill guardrails.
- Converted all android diagram text from Title Case to sentence case.

### 2026-05-19 – Editor UX fixes

- Fixed literal `\n` in text editing (textarea join/split used escaped `\\n` instead of real newlines).
- Fixed arrow keys moving box during text edit (keydown handler lacked `TEXT_EDITING` mode guard).
- Fixed textarea line-height mismatch (CSS had `1.43` vs SVG `1.333`).
- Added text reflow on box resize: `reflowTextInGroup()` wraps tspans at word boundaries against available width; box height auto-expands (snapped to 8px grid) to fit wrapped text.
- Added grid-row vertical cascade: all components in rows below an expanded box shift down uniformly; arrows track the shifts via updated `sideShift`.
- Fixed click selection hitting wrong box: `findComponentAtDepth` used model data from the Python layout engine which diverges from SVG rect positions; now reads actual SVG DOM `<rect>` attributes + CSS transforms. Same fix applied to `showResizeHandles`, `updateInspector`, and `autoFitArtboard`.
- Completed code quality items: `GridSpec` dead code fix, diagonal arrowhead fix, Python/YAML definition drift fix, spec-provenance path normalization.
- Resizable/auto-fit artboard, annotation autolayout.

### 2026-05-13 – BF-backed force preview prototype

- Added `scripts/force_preview.py` plus the tracked `scripts/diagrams/force/force-stakeholders.json` example so the repo now has a small force-layout state wrapper around the Python solver and a source-backed example reconstructed from `diagrams/1.input/force/IMG_3229.jpg`.
- Extended `scripts/preview_server.py` with `/force` routes and JSON tick/reset/export endpoints so the force solver can run live over time, pause, and export snapped JSON or SVG snapshots instead of only supporting a one-shot batch run.
- Reworked the force preview onto the same vendored Baseline Foundry `navigation + main + aside` shell and existing `scripts/preview/editor.css` compatibility layer as the main editor; removed the separate force-only stylesheet rather than creating a parallel preview look.
- Added `scripts/preview/box-styles.js` so the force preview and main editor now share one semantic `default` / `accent` / `highlight` style vocabulary instead of maintaining parallel preset definitions.
- Extended the force session and preview API with server-backed node mutation state, so the force inspector can pin/unpin nodes and change box style cleanly while reset/export continue to reflect the same session state.
- Added force-canvas boundary clamping plus drag-to-pin manual polish: nodes now stay inside the preview canvas across load/tick/export, and dragging a node on the stage updates its server-held position and leaves it pinned where dropped.
- Added force-preview parity controls: the picker now has the same prev/next buttons as the main editor, and a new `Save` action persists force overrides so reset/reload keep the manual-polish state instead of discarding it.
- Changed force reset semantics so drag/drop restarts the solver immediately and browser refresh/reset rebuild the graph around the current pinned session state before reflowing the remaining nodes.
- Unified the preview navigation so the default preview picker and root preview index now surface the tracked `force-*` demos alongside the normal diagram pages, and added explicit pin guidance to the force inspector empty state.
- Added the tracked `scripts/diagrams/force/force-juju-landing-pages.json` and `scripts/diagrams/force/force-support-case-lifecycle.json` examples from `diagrams/1.input/force/IMG_3231.jpg` and `diagrams/1.input/force/IMG_3232.jpg`, expanding the force lane beyond the first small prototype.
- Corrected the stage styling to obey `DIAGRAM.md`: white boxes, one black emphasis box, orange connectors, and top-left live text instead of source-photo purple pills and centred labels.
- Validation: focused Python settle checks for the tracked force examples, a 320-tick bounds check for `force-juju-landing-pages`, browser checks of `/force/view/force-stakeholders` and `/force/view/force-juju-landing-pages` confirming BF-shell rendering, shared prev/next controls, drag-to-pin manual placement, Save + Reset persistence, server-backed pin/style updates, reset/reload parity, and successful JSON + SVG export.

### 2026-05-13 – Machine-switch docs checkpoint

- Normalized the active upstream spec references from `canonical-spacing-spec` to `canonical-specs` across `DIAGRAM.md`, `README.md`, `STATUS.md`, `TODO.md`, and `docs/specs.md` so the advertised spec -> token -> tool chain resolves in this workspace.
- Refreshed the cold-start docs to state both what landed in the autolayout slice and what still remains: shared Python/JS parent-split math, the known `build_v2.py` clearance blockers, and the pending manual desktop smoke tests.

### 2026-05-13 – Autolayout docs clarification + connector/separator primitives

- Reframed the durable layout docs around a parent-scoped equal-split/outdent model instead of a strict global-grid lock, and updated `DIAGRAM.md`, `README.md`, `STATUS.md`, `TODO.md`, and the redraw skill so future agents read the same abstraction on a cold start.
- Added free-positioned arrow labels via `Arrow.label` / `label_gap` plus `ArrowLabelPrimitive`, with overlap-aware placement, fallback detour routing, SVG + draw.io rendering, schema/loader support, and canvas-size expansion so labels are not cropped.
- Fixed top-level separator rows so `Separator` stays a thin dashed divider row instead of consuming `BOX_MIN_HEIGHT`, and updated preview component metadata to measure rendered child gutters so grouped horizontal relayout preserves inherited `24px` gaps instead of falling back to zero.
- Updated preview relayout to consume server-declared child slots and spans instead of reconstructing grouped layout from child `x` / `y` positions, which restores correct equal-split behavior for resized parent groups such as `frontend`.
- Added the tracked `example-arrow-label-separator` JSON fixture, rough input, and compare-page entry so thin separators and free-positioned arrow labels have a committed regression surface instead of living only in a temp probe.
- Validation: focused Python layout probes for separator rows, arrow labels, and preview gutter metadata; browser screenshots of a generated SVG probe confirming thin separators and off-arrow label placement. A full `python scripts/build_v2.py` pass still reports unrelated pre-existing corpus clearance/grid violations outside this slice.

### 2026-05-11 â€“ Windows BF preview smoke pass

- Verified the BF-backed preview shell on Windows against the running local server: `/` loaded the diagram index, `/view/example-data-processing` loaded the editor shell, and the desktop layout stayed in the intended single-row `navigation + main + aside` arrangement.
- Confirmed the live editor path still exposes resize handles on Windows by selecting `ingest` in the component tree and checking that the stage renders the full `dg-handle` set alongside the left and right BF resize affordances.
- Validation: browser checks on `http://127.0.0.1:8100/` and `http://127.0.0.1:8100/view/example-data-processing`, including computed layout geometry and live handle visibility.

### 2026-05-11 â€“ BF tabs compare mode in preview

- Replaced the preview's hand-made reference toggle with the real Baseline Foundry tabs strip so the main editor area now switches between `Input`, `Output`, and `Both` using BF tab chrome instead of custom button styling.
- Changed the reference view from a collapsible strip into pane-based main-area modes, with `Both` rendering the rough input sketch and generated SVG side by side in the center pane.
- Validation: browser-checked `/view/memory-wall`, confirmed BF tab markup is present, and verified the `Both` mode computes two grid columns with input and output panes on the same row.

### 2026-05-11 â€“ Vendored BF preview runtime

- Removed the preview server's sibling-first Baseline Foundry asset resolution so the editor now always serves the repo-owned BF `os` tier stylesheet and Ubuntu Sans snapshot from `assets/baseline-foundry/`.
- Kept `scripts/sync_baseline_foundry_assets.py` as the explicit refresh path when a sibling `baseline-foundry` checkout is available, rather than letting runtime behavior vary by machine.
- Validation: preview smoke on `/view/memory-wall` plus direct `/preview/bf-os.css` and `/preview/bf-fonts/UbuntuSans[wdth,wght].ttf` route checks using the vendored snapshot only.

### 2026-05-11 â€“ Preview shell compatibility pass

- Forced the BF-backed desktop preview shell back to a single-row `navigation + main + aside` grid in `scripts/preview/editor.css` so upstream BF application layout changes cannot reintroduce the broken extra top row.
- Restored DG-owned amber selection tokens for selected tree items, stage outlines, resize handles, waypoint handles, and inline text editing chrome, keeping the editor's golden affordances without depending on BF authoring-accent variables.
- Refreshed the tracked `example-data-processing` and `example-deployment-pipeline` generated artifacts under `diagrams/2.output/` so the checked-in draw.io, SVG, and grid-SVG examples match the current exporter output.
- Left the repo ready for a follow-up Windows smoke pass against the BF-backed preview shell.

### 2026-05-11 â€“ Baseline Foundry `os` fallback resync

- Switched the preview-server sibling and vendored fallback path from the old BF `panel` preset to the corrected BF `os` tier stylesheet, and refreshed `assets/baseline-foundry/` from the local sibling repo.
- Renamed the preview shell stylesheet route from `/preview/bf-panel.css` to `/preview/bf-os.css` so the served HTML matches the new contract directly.
- Added a local compatibility layer for `.bf-application-navigation-resize-handle` in `scripts/preview/editor.css` because the current BF `os` stylesheet no longer ships the left navigation resize-handle selector, while DG still needs that affordance.
- Moved DG editor-only override markers, snap guides, and dirty-save chrome onto BF authoring-accent tokens so the preview shell matches the shared gold authoring contract while leaving actual diagram arrow rendering on `#E95420`.
- Smoke-tested the preview shell by serving `/view/memory-wall`, confirming the new `/preview/bf-os.css` reference, and verifying that both the BF stylesheet route and the local resize-handle selector resolve.

### 2026-05-09 â€“ Editor UX restructure

- Restructured the preview editor to a 3-column layout: left component-tree sidenav using BF side-navigation, main stage, right inspector aside.
- Simplified grid overlay to a 2-state toggle (off / all) instead of 3-state.
- Added `overflow-y: auto` to both side panels and `overflow: auto` to the main stage so tall diagrams and long inspector lists are scrollable.
- Preview server now watches HTML/CSS/JS files for hot-reload and invalidates the viewer template cache on change.

### 2026-05-09 â€“ Arrow obstacle avoidance and CI validation

- Fixed `_route_around_obstacles()` in `diagram_layout.py` for vertical arrows crossing full-width panels. The rounding direction for detour Y-coordinates now uses `math.floor`/`math.ceil` to snap away from obstacle boundaries instead of `round` which could snap into them.
- Added `ArrowCrossing` dataclass and `validate_arrow_crossings()` to `diagram_layout.py`. Checks every arrow segment against all component Rects, excluding source/target boxes and shared ancestor panels (so arrows between siblings inside a panel don't false-positive).
- Wired crossing validation into `build_v2.py` alongside existing clearance validation. Build fails on any crossing or clearance violation.
- Removed stale hardcoded waypoints from `gpu_waiting_scheduler.py` and increased gaps to 24px.
- Increased `example_data_processing.py` `row_gap` from 24â†’40 to give detour arrows enough clearance.
- All 13 diagrams pass clean: zero crossings, zero clearance violations.

### 2026-05-09 â€“ Input folder consolidation

- Merged `diagrams/1. input/` (with space) into `diagrams/1.input/` (canonical path).
- Updated `build_compare_pages.py`, `preview_server.py`, and `TODO.md` to remove the dual-folder fallback.
- Rebuilt all 12 compare HTML pages with corrected single-path references.

### 2026-05-08 â€“ Docs drift audit fixes

- Reframed `README.md` and `STATUS.md` so Pipeline 1 is described as the original maintained v1 batch and Pipeline 2 as the current active surface, matching where the declarative model, validators, preview editor, and Baseline Foundry integration now live.
- Removed the stale `all 9 diagrams` phrasing from the active docs and replaced it with neutral current-corpus wording so the repo description no longer depends on an outdated count.
- Added explicit notes that the protected draw.io review lane is infrastructure-ready but may be empty in a fresh tree, and surfaced the repo's strongest credibility hooks more prominently: `DIAGRAM.md` `sourceSpecs`, generated draw.io provenance metadata, and the Baseline Foundry preview wiring.

### 2026-05-08 â€“ Preview undo specialization for move and resize

- Added an override-patch undo command path in `scripts/preview/editor.js` so the hottest interactions, move and resize, no longer serialize the full editor state on every committed action.
- Kept the full-state undo path as the default for grid edits, text edits, style changes, waypoint edits, clear actions, and other lower-frequency commands, so the specialization stays narrow and reversible.
- Browser-validated the new path against the live preview: move and resize now record `override-patch` commands and still undo/redo correctly.

### 2026-05-08 â€“ Helper token audit: shared geometry cleanup

- Normalized terminal-bar geometry through shared tokens so the stable SVG helper, the stable draw.io helper, and the declarative draw.io renderer all use the same bar height, dot positions, and text box offsets.
- Replaced hardcoded request-cluster icon offsets with `ICON_SIZE + COMPACT_GAP` in the active SVG and draw.io helpers so cluster spacing now follows the shared icon tokens instead of duplicated literals.
- Normalized draw.io icon-image sizing and the reusable jagged memory-panel helper through shared tokens, including aligning the stable memory-panel height with the canonical `BLOCK_WIDTH` / `BOX_MIN_HEIGHT` block system.
- Switched the stable and declarative SVG jagged helpers from duplicated `8/4` literals to `BASELINE_UNIT`-derived geometry so the zig-zag treatment follows the shared baseline token without changing output.
- Validated the helper cleanup with non-mutating in-memory render checks instead of rebuilding the tracked output batch.

### 2026-05-08 â€“ Baseline Foundry preview shell integration

- Updated the interactive preview shell to use Baseline Foundry application, panel, and control primitives instead of the previous bespoke sidebar/stage shell.
- Taught `scripts/preview_server.py` to serve the sibling `baseline-foundry` CSS and Ubuntu Sans font assets under `/preview/`, including rewritten font URLs so the preview works over HTTP without manual asset copying.
- Kept `scripts/preview/editor.css` as the editor-specific override and fallback layer, so SVG selection affordances and preview-only widgets still behave correctly while the shell itself follows BF.

### 2026-05-08 â€“ Draw.io preset sync and onboarding path

- Added `scripts/drawio_style_presets.py` so the canonical draw.io field maps for labels, panels, images, separators, and connectors now live in one shared module instead of being duplicated across exporter strings and ad hoc sync commands.
- Wired `scripts/export_drawio_batch.py` and `scripts/drawio_style_sync.py` to the shared preset layer, including `--preset` and `--list-presets` support in the style-sync CLI.
- Added a curated cold-start exemplar path to `README.md` and marked the PM-onboarding corpus-shortlist task complete in `TODO.md`.

### 2026-05-08 â€“ Preview undo state coverage

- Updated the interactive preview undo/redo stack to restore full editor state instead of override deltas only, so grid gutter and outer-margin changes are now undoable alongside component overrides.
- Replaced the anonymous undo stack entries with explicit per-action command records covering move, resize, grid edits, text edits, style changes, waypoint edits, clear actions, and keyboard nudges.
- Narrowed the remaining editor undo work from â€œmake it action-basedâ€ to â€œspecialize specific hot actions only if before/after state commands prove too heavy.â€

### 2026-05-07 â€“ Preview distribute/align + output validation sweep

- Added multi-select distribute and align controls to the interactive preview inspector with configurable gutter spacing, 8px snapping, override persistence, and undo/redo-safe updates.
- Browser-validated the preview feature with Playwright against the live preview; equal-gutter distribute hits the requested spacing within normal 1px browser bounding-box rounding tolerance.
- Preserved matrix widget `component_id` through panel layout, delayed draw.io edge emission until all connectable cells register, and fixed the legacy `memory-wall-onbrand.drawio` separator export by emitting it as a non-edge line shape.
- Updated `attention-qkv` so the declarative heading text matches the v1 baseline (`QK^T`), clearing the last `_audit_v2.py` text drift for the audited canonical diagrams.
- Added build-time cleanup for stale root-level `diagrams/2.output/*.svg` artifacts so `diagrams/2.output/svg/` remains the single canonical SVG output lane; this also removed the orphaned `icon-box-48px-prototype.svg` copy from the output folder.
- Synced the diagram workflow skills back to the current spec tokens: `18px` body text, `8px` baseline, `24px` structural gutters, `24px` arrow gaps, and `40px` one-line text-only boxes.
- Rebuilt the v2 batch and the stable batch. Generated draw.io XML now parses cleanly across 23 files with `adaptiveColors="none"` and no missing `source` / `target` edge attachments.
- Ran `svg_illustrator_sanitize.py` dry-run checks across 31 generated SVG outputs; all passed.
- Reran `_audit_v2.py`; the audited canonical diagrams now report OK.

### 2026-05-01 â€“ Content-width alignment engine for vertical layouts

- Two-pass VERTICAL layout now separates content width from outer width so standalone boxes, spanning boxes, and panel children all share the same right edge.
- Panels with borders contribute `natural_w - 2*INSET` as content width; borderless panels follow the resolved width instead of driving it.
- Standalone boxes in a vertical column with padded panel siblings are inset by INSET and rendered at content width.
- Box and Terminal `_render_component` now honours parent-resolved width (can shrink stale explicit widths).
- Added `col_span` / `row_span` support in `_layout_panel` for boxes spanning multiple grid columns.
- Removed stale explicit `width=` overrides from `request_to_hardware_stack.py` in favour of engine-computed widths via `col_span=2`.
- Verified alignment across all 4 vertical diagrams (request-to-hardware-stack, inference-snaps, diagram-intake-workflow, diagram-language-workflow) with no regressions on GRID diagrams.

### 2026-05-01 â€“ Auto-layout engine rewrite

- Replaced `propagateResize()` and `redistributeAfterChildResize()` with `relayoutChildren()` and `relayoutSiblingsAfterChildResize()` in `component-model.js`.
- `relayoutChildren()` computes child positions and sizes from the parent's content area with fixed gutters â€” no more proportional delta passing.
- Added recursive relayout: when a parent resizes, nested panels relayout their children too via `_applyRelayoutRecursive()`.
- Added `pad`, `heading_height`, `layout_col_gap`, `layout_row_gap` to `ComponentInfo` (Python) and `ComponentNode` (JS) so the JS engine knows about panel padding, headings, and separate column/row gaps.
- Child resize now shifts later siblings to maintain gutter invariant (no more proportional shrinking).
- Gutter is always the Python-defined `layout_gap` value â€” never a proportional guess.

### 2026-05-01 â€“ StackedBlock removal + alignment hardening

- Removed `StackedBlock` component type â€” it centred icons above text, violating the "text top-left, icon top-right" design language rule.
- Removed `StackedBlock` from `Component` union, layout engine (`_layout_stacked_block`, `_stacked_block_height`, `_render_component`, `_natural_size`), and editor style picker.
- Rewrote `example_stacked_blocks.py` to use standard `Box` components. Fixed wrapper panel `col_gap` from 8 to 24 so the dashed frame spans its full grid cell.
- Added "Box anatomy â€“ non-negotiable spatial contract" section to `DIAGRAM.md` with explicit anti-centering rules and ASCII box diagram.
- Added explicit `StackedBlock` prohibition to `.github/copilot-instructions.md`.
- Fixed stale `4px` baseline references in `DIAGRAM.md` (should be `8px` after prior session's change).
- Updated `copilot-instructions.md` box-height growth step from `4px` to `8px`.

### 2026-05-12 — TODO and ROADMAP cleanup

- Cleaned TODO.md: removed ~150 lines of completed checklist items (declarative model steps 1–7, grid engine layers, interactive preview features, grid visualisation, architecture refactor phases, draw.io library/audit/sync, style-sync tool, review-copy workflow, compare pages, Illustrator sanitizer). Open items consolidated into three clean sections: Editor UX, Code quality, Ongoing maintenance.
- Updated ROADMAP.md: marked Stages 3–6, 6a, 9, 11, 12 as ✅ complete. Added Stages 14 (design-language harness), 15 (cross-team adoption), 16 (fallback guardrails). Updated purpose statement to reflect the broader scope: constrained generation + fallback guardrails + design-language validation harness. Updated long-term direction with harness framing.

### 2026-05-01 â€“ Baseline unit 4â†’8px

- Changed `BASELINE_UNIT` from 4 to 8 in `diagram_shared.py`. Removed redundant `RHYTHM_STEP`.
- Updated all snap rounding in `component-model.js` and `editor.js` from `/ 4) * 4` to `/ 8) * 8`.
- Updated baseline grid overlay step, nudge step (8px default, 24px with shift), and UI text.
- Updated `constraints.js` constant and comment labels.
- Updated `DIAGRAM.md` frontmatter and token table.
- Keyboard nudge now uses baseline unit (8px) as default step, gutter (24px) as shift step.
- Removed dead `RHYTHM_STEP` constant.
- All 14 diagrams rebuild clean.

### 2026-05-01 â€“ Gutter standardization + auto-layout + save fix

- Standardized all gap/margin tokens to 24px (was 32). Updated 14 diagram definitions.
- Rewrote `redistributeAfterChildResize()` for sibling-fill auto-layout.
- Fixed save flakiness (3 root causes), baseline overlay pink wash.
- INBOX drained: gutter request â†’ implemented, distribute/align â†’ TODO.

### 2026-05-01 â€“ 7-bug audit + grid propagation fix

- **7-bug audit (commit 51535bf):** Fixed icon re-anchor regex (double-escaped `\\d` â†’ `\d`), arrow points regex (same pattern), Escape key clearing guides/drag/resize, onResizeUp preserving user-set overrides via `propagatedIds` Set, guide viewport reading actual SVG dimensions, icon delta using `getOwnDelta()` not accumulated effective delta.
- **Grid layout propagation (commit dec8160):** `propagateResize()` now distributes width delta equally across columns and height delta equally across rows for grid-layout panels, snapped to 4px baseline. Previously returned no-op `{dw:0, dh:0}`.
- **Browser verification:** All 4 features confirmed working via Playwright: snap guides (4 lines appear during drag, cleared on release), layout metadata in inspector, icon re-anchor on resize, parentâ†’child resize propagation for grid panels.
- **Horizontal layout fix (commit b732988, Bug 6):** Single-row panels (cols == children count, 1 row) now classified as "horizontal" for proportional width distribution on resize; multi-row panels keep "grid" for equal per-column distribution.
- **StackedBlock component (commit 3aa0642):** Added then later removed â€” it centred icons above text, violating the design language. See removal entry above.
- **Review-copy workflow piloted:** Full prepareâ†’promoteâ†’discard cycle verified on `gpu-waiting-scheduler-onbrand.drawio` (manually-edited) and `memory-wall-onbrand-edited-in-drawio.drawio`. Checkpoints created correctly, review copies cleaned up.

### 2026-05-01 â€“ Interaction manager migration + component swap

- **Full interaction manager adoption (commit 47d0760):** Migrated all 4 legacy state variables (`dragState`, `resizeState`, `wpDragState`, `textEditState`) to `InteractionManager`. All interaction flows now use `mgr.startXxx()`/`mgr.endInteraction()` with typed `InteractionMode` enum. Hover suppression unified via `mgr.suppressHover`.
- **Bug fixes (commit c8949d1):** Gutter save-button â€“ grid overrides (col_gap, row_gap, outer_margin) now persist via override JSON and mark dirty on change. Ctrl+Z text undo â€“ text edits store overrides with `data-orig-inner` and restore via `applyAllOverrides`.
- **Component swap / style picker (commit b5d7d91):** Added `BOX_STYLES` constant (default/accent/highlight), `applyStyleOverride()` function, and style picker dropdown in inspector panel. Overrides persist in JSON, undo/redo works, constraint system validates highlight limit. Fixed case-sensitivity bug in `getComponentType()` comparison.
- **Icon filter regression fix (commit 01419ae):** `applyAllOverrides()` now resets `.dg-icon` CSS filters in the restore phase so icons don't stay white after undoing a highlight style.

### 2026-05-12 – Lightning talk diagrams, fan-in merge rule, editor chevrons

- Created `scripts/diagrams/lt_a4_generator.py` and `scripts/diagrams/lt_summit_identity.py` — two new pipeline diagrams for the lightning talk (A4/whitepaper generator and Ubuntu Summit identity generator).
- Registered both new diagrams in `build_v2.py` alongside the existing `lt_diagram_generator`.
- Removed panel icons from all 3 lightning-talk diagrams for cleaner borderless panels.
- Fixed layout engine heading-height consistency: `_layout_panel()` now always reserves `max(heading_h, ICON_SIZE + INSET)` regardless of whether a panel has an icon, so icon-less panels match icon-bearing siblings.
- Added fan-in merge rule to `DIAGRAM.md` § "Connectors & flow", `.github/copilot-instructions.md` non-negotiable rules, and `diagram-redraw` skill guardrails.
- Added prev/next chevron buttons to the editor diagram picker for quick navigation between diagrams.
- Archived April 2026 HISTORY entries to `docs/archive/2026-04.md`.

---

Earlier entries (April 2026) archived to `docs/archive/2026-04.md`.
