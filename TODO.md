*# TODO

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
6. The imported dense application and documentation mapping from `canonical-specs` remains the reference tier, and the current diagram tier now uses `18px` body copy with `24px` line height to keep live text proportionate to the standard `48px` icon treatment inside the `192px` block system.
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
- The repo now carries the main input, output, compare, and reference lanes needed for internal cold starts without relying on a separate broader brand-language raster reference.
- The tracked corpus now includes the main reference, input, output, compare, and draw.io working lanes, so a fresh internal clone has enough material to inspect the end-to-end workflow without reconstructing missing assets.
- Compare pages resolve `diagrams/1.input/`, so the tracked HTML review lane stays self-contained for the current internal corpus.
- Conclusion: the repo is now cold-start-safe for internal sharing. The remaining PM-shareability work is curation and guided onboarding, not recovering missing tracked files.

### Diagram language contract

- `DIAGRAM.md` is the canonical plain-text diagram language spec. It owns tokens, rules, output constraints, and all visual-language decisions.
- `.github/copilot-instructions.md` owns workflow discipline and the anti-patch protocol.
- Workflow skills under `.github/skills/` hold repeatable procedures that reference `DIAGRAM.md` for rules.
- Do not duplicate visual rules across files. If the same rule appears in two places, delete one.

## Active TODO

### Doc freshness (post-session audit, 2026-05-22)

- [x] `[L]` **README.md** — updated agent prompt, exemplar path, and "Creating your own diagram" to show native Frame YAML as the primary path.
- [x] `[L]` **STATUS.md** — condensed Pipeline 3 section, removed stale "Uncommitted v3 editor work", moved Windows smoke pass to HISTORY.
- [x] `[L]` **TODO.md** — archived completed milestones 1–12; open work now visible without scrolling past completed items.

### v3 auto-layout engine — test-first redesign (branch `frame-layout-engine`)

The v3 frame engine has the right Figma-like model (`Direction`, `Sizing`, `Align`) but was developed directly against real diagrams. The previous session stacked features without browser verification (alignment dropdowns, relayout API, editor CSS), resulting in 6 server crashes and zero confirmed features. That code is now stashed (`git stash list` → "unverified-v3-ui-work").

This plan rebuilds the engine's test coverage from scratch, fixes the cross-axis alignment gap, and only then re-integrates the UI work.

**Rules:**
1. One milestone at a time. Do not start the next until the current one passes QA.
2. QA = user reviews test output and confirms direction before proceeding.
3. No feature is "done" without a passing test and (where applicable) browser verification.
4. No patch-on-patch. If something is wrong, fix the root cause.

**Key files:**
- `scripts/frame_model.py` — `Frame`, `Direction`, `Sizing`, `Align`
- `scripts/layout_v3.py` — `measure()`, `place()`, `_align_offset()`
- `scripts/test_autolayout.py` — comprehensive test suite (this plan)
- `scripts/test_layout_v3.py` — original 8 tests (kept for regression)
- `scripts/frame_adapter.py` — v2 → v3 diagram adapter
- `scripts/diagram_shared.py` — tokens (`BASELINE_UNIT=8`, `BLOCK_WIDTH=192`, etc.)

---

#### Milestones 1–12: Complete ✅

All 12 milestones completed. 165 tests passing. See `HISTORY.md` for dated entries covering each milestone's work.

**Summary:** Stabilize (M1) → directional layout tests (M2) → 9-point alignment (M3) → sizing model (M4) → research-informed fixes (M4a) → cross-axis alignment (M5) → real diagram integration (M6) → stashed UI superseded (M7) → nested stress testing (M8) → editor integration (M9) → native Frame YAML (M10) → per-axis sizing redesign (M11) → interaction parity (M12).

**Deferred items carried forward:**
- [ ] `[S]` **Golden-value assertions** for representative diagrams (from M6)
- [ ] `[S]` **API test** for `/api/relayout-v3/<slug>` (from M7)
- [ ] `[S]` **Autolayout toggle on parent** — requires `Direction.NONE` and absolute positioning (from M12)

### Editor UX

- [x] `[S]` **Domain-specific undo/redo.** All undo actions now use targeted override-patch commands instead of full-state snapshots. Fixed bug where v3 style changes had no undo. Added undo to `setFrameProp`, `setFrameAlign`, `setMultiFrameProp`, `setMultiFrameAlign`, `applyMultiStyleOverride`. Only grid-adjust and clear-all-overrides still use full snapshots (legitimately need full state).

### Brockman grid — column/row snapping and sizing

The editor now has a proper Brockman composition grid (baseline-snapped rows, equal columns, bottom-margin absorption). Next steps to make it a real InDesign-like layout tool:

- [x] `[S]` **Baseline-snap column widths.** Column widths are currently raw `contentW / cols` — not snapped to `BASELINE_STEP`. Snap column widths down to 8px multiples; absorb leftover into a resolved right margin (matching the row→bottom pattern). Update both `_computeBrockmanGrid()` in editor.js and `_build_grid_info()` in layout_v3.py. Prerequisite for column-span input and grid-aware snapping.
- [x] `[H]` **Snap to grid.** Drag and resize should snap to column edges, row tops, and baseline grid lines — not just the 8px graph-paper grid. The current snap stops short of or overshoots grid lines. Depends on baseline-snapped columns.
- [x] `[S]` **Force-mode alignment guides.** Force diagrams need the same alignment guides (column edges, row tops, baseline grid) as grid diagrams. Also consider a grid-field visualisation so key nodes can be placed at exact grid intersections while the rest self-organise.
- [x] `[H]` **Column-span width input.** Add a units dropdown (`px` / `cols` / `rows`) next to the sizing mode in the inspector. When unit = `cols`, width = `colW * span + colGap * (span - 1)`. When unit = `rows`, height = `rowH * span + rowGap * (span - 1)`. Apply to both single-select and multi-select inspectors. `gridInfo` is already globally accessible. Depends on baseline-snapped columns.
- [x] `[S]` **Grid-aware resize.** When dragging a resize handle, show snap indicators at column/row edges and snap to them with priority over the baseline grid.
- [ ] `[L]` **Persist grid config.** Save the Brockman grid settings (cols, col gutter, row gutter, margin) per diagram so they survive page reload.

### Export

- [x] `[S]` **Save SVG button.** The preview sidebar now exposes `Save SVG`, which downloads the current stage DOM as an `.svg` file using the active engine suffix (`*-onbrand-v3.svg` for native frame diagrams).
- [ ] `[S]` **PNG export at 1x, 2x, 3x.** Add a Playwright-based PNG exporter that renders generated SVGs at 1x, 2x, and 3x scale (e.g. `scripts/export_png.py --scale 1,2,3`). Wire into the preview Export button as an option alongside the existing override JSON export.

### Code quality — open
- [ ] `[H]` Unify the parent-scoped equal-split/outdent math across `scripts/diagram_layout.py` and `scripts/preview/component-model.js`. Preview now consumes declared slots/spans and measured gutters, but the equal-split/outdent math itself is still duplicated between Python and JS.
- [ ] `[S]` **draw.io renderer uses spatial containment for parenting.** `_find_children` in `diagram_render_drawio.py` uses bounding-box overlap instead of `component_id`, which can mis-parent elements at shared edges. Fix: match by `component_id`.
- [ ] `[S]` **`_uniform_row_height` ignores Annotations/Helpers.** Rows containing only annotations get `BOX_MIN_HEIGHT` regardless of content. The post-hoc helper expansion partially compensates but runs after uniform equalization.
- [ ] `[S]` Triage the secondary audit findings: stale-v2 comparison risk in `build_outputs.py`, preview text-width mismatch vs renderer text width, dead helper layout code, stale architectural line-count notes in `STATUS.md`.
- [ ] `[S]` Triage the current `build_v2.py` corpus blockers separately from the 2026-05-13 autolayout slice: clearance violations on `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, and `lt-summit-identity`, plus warning-only baseline-grid drift on several older diagrams.

### Force ↔ grid editor unification

Goal: the force and grid editors share one editor shell; swapping the layout engine should not duplicate interaction code. The audit below lists every grid-editor capability and its force-editor status. Items are ordered by user-facing impact.

**Architecture prerequisite**

- [x] `[H]` **Unified editor shell.** Created `editor-base.js` (shared utilities: `byId`, `escapeHtml`, `fetchJson`, `setStatus`, `getStageSvg`, `pointerToSvgPoint`, `setViewMode`, `initPreviewShell`) and `viewer-unified.html` (single HTML template with `data-dg-mode="grid"|"force"`, CSS mode visibility via `.dg-grid-only`/`.dg-force-only`). Both grid and force editors now use the same shell, sidebar header, picker, and view tabs. Force.js deduped to use shared base functions. Server serves unified template for both modes.
- [ ] `[H]` **Swappable engine interface.** Refactor so `editor.js` and `force.js` share one interaction layer (select, drag, resize, text-edit, style, undo, keyboard, inspector, constraints). The layout back-end (grid relayout vs force tick) plugs in behind a common `LayoutEngine` interface. No duplicated DOM wiring. *(Phase 1 — abstract `EngineAdapter` class and shared snap primitives — landed in `engine-interface.js` and `editor-base.js`. Full unification is Phase 2+.)*

**Stage interaction parity**

- [ ] `[H]` **Resize handles.** Force nodes need the same 8-handle resize affordance as grid components. Resize should update node `width`/`height` in the force session and restart the solver.
- [ ] `[S]` **Text editing.** Double-click a force node to edit its label in-place, same as the grid editor's `tspan` editing path.
- [ ] `[S]` **Multi-select.** Shift+click to select multiple force nodes; enable distribute/align controls on the multi-selection.
- [ ] `[S]` **Hover highlighting.** Show visual hover class on force nodes.
- [ ] `[L]` **Snap guides.** Show alignment snap guides during force-node drag (peer edge/center, 6px threshold).

**Inspector parity**

- [ ] `[S]` **Dirty flag and save-button state.** Track whether force session state differs from last save; disable Save when clean.
- [ ] `[S]` **Constraint enforcement.** Run the same fill/stroke/highlight-limit/containment checks on force nodes and display violations in the sidebar.
- [ ] `[L]` **Override highlight in tree.** Accent-color tree items that have overrides, matching the grid editor's convention.

**Persistence and undo**

- [ ] `[H]` **Undo/redo for force.** Add an undo stack (max 50 commands) covering move/pin, style change, text edit, and resize, using the same command-record pattern as the grid editor.
- [ ] `[S]` **Stale-definition detection.** Warn if the force spec JSON changes on disk while a session is live.

**Connectors and arrows**

- [ ] `[S]` **Arrow waypoint editing.** Allow dragging force-link control points (curve handles) interactively, with double-click to add/remove, matching the grid editor's waypoint path.
- [ ] `[S]` **Arrow endpoint attachment.** Force links should follow node moves via side-aware offset instead of recalculating from scratch.

**Keyboard shortcuts**

- [ ] `[L]` **Grid overlay toggle (W).** Decide whether force preview needs a baseline-grid overlay or if that concept doesn't apply.
- [ ] `[L]` **Keyboard nudge.** Arrow-key nudge (8px default, 24px with Shift) for pinned force nodes.
- [ ] `[L]` **Double-click depth cycling.** Decide whether force nodes need a depth-drill concept (probably N/A for flat graphs).

**Visual scale consistency**

- [ ] `[S]` **Consistent stroke/outline weight.** Force preview currently renders at a larger apparent scale, making outlines look thinner relative to text. Normalize the SVG viewBox / coordinate system so 1px strokes match the grid editor's visual weight.

**Export round-trip**

- [ ] `[S]` **Force → declarative pipeline.** Decide how force-preview exports feed back into `scripts/diagrams/*.py` or `build_v2.py`. Currently exports snapped JSON/SVG but does not round-trip.

### v3 engine — near-term

- [x] `[H]` **Work through the current architecture audit.** See [docs/architecture/v3-engine-audit.md](docs/architecture/v3-engine-audit.md). All three priority items completed:
  - [x] Added explicit `grid:` blocks to all 4 active frame YAMLs (support-engineering-flow, android-container-vs-vm, android-security-comparison, android-graphics-stack).
  - [x] Added 29 automated tests for `/api/relayout-v3` in `scripts/test_relayout_v3.py` covering grid_overrides, frame property overrides, style overrides, coercion, and children reorder.
  - [x] Documented frame-YAML omission/default rules in TODO.md Milestone 10 section (frozen by `test_frame_loader.py`).
- [x] `[S]` **Add `min_width`/`max_width`/`min_height`/`max_height` to Frame.** Figma-style min/max constraints. Added 4 fields to Frame dataclass, clamping in `_distribute_fill_space`, `_resolve_child_widths`, and `place()`, API override forwarding, FRAME_KEYS in editor.js, YAML parsing in frame_loader. Validated: input validation (min≤max, non-negative), constrained hug_total accounting for FILL distribution, API input safety. 10 new tests, 164 total passing.
- [x] `[S]` **Separator role semantics.** Already documented in `DIAGRAM.md` § "Dashed separator primitive". Added `test_separator_role_renders_dashed_line` verifying that `role: separator` frames produce `DashedLinePrimitive` + `TextBlock` (not `Rect`).

### v3 engine — INBOX-triaged bugs

Three bugs reported by the user on `support-engineering-flow` (screenshots `image-1.png`, `image-2.png`, `image-3.png` — inspect before deleting).

- [x] `[H]` **FILL-width + HUG-height text re-measurement.** `measure()` wraps text at `BLOCK_WIDTH` (192px) but `place()` assigns a wider FILL width. HUG height is computed from the narrow wrap, so boxes are taller than their text needs at the placed width. Fix: add a re-measure pass after `place()` assigns final widths, re-wrapping text at the actual width and recomputing HUG heights. This is the root cause of both "different heights on HUG boxes" and "text wraps way before reaching parent padding."
- [x] `[S]` **Style vocabulary should be exactly 3 presets.** The intentional styles are: default (black border, white fill), accent/parent (grey fill, bold text, no border), highlight (black fill, white text). The dashed border (`Border.DASHED`) leaks through the "— original —" dropdown as a 4th unintentional style. Fixed: gated `Border.DASHED` out of the YAML parser (`frame_loader._BORDER`) and the editor `borderMap`, updated 4 test YAMLs from `border: dashed` to `border: solid`. `Border.DASHED` remains in the enum for programmatic v2 pipeline use.
- [x] `[H]` **Text editing overflow — deferred composition.** `commitTextEdit()` directly patched SVG `<tspan>` elements without re-wrapping or relayout, causing text to overflow the box on any line-break deletion. Fix: InDesign-like deferred composition — textarea shows semantic (unwrapped) text via new `heading_text`/`label_text` fields on `ComponentInfo`, commit builds a structured `{heading, label}` text override and triggers `requestV3Relayout()`, server processes text overrides in `_relayout_v3()` (preserving original line styles), engine re-wraps at frame width. Changed files: `diagram_layout.py` (ComponentInfo fields), `layout_v3.py` (_build_component_tree), `preview_server.py` (text override processing), `editor.js` (startTextEdit, commitTextEdit, FRAME_KEYS, initial-load relayout).
- [ ] `[H]` **Native text frames.** SVG text wraps word-by-word at export time and doesn't support in-place editing of multi-line content. The engine should model text as bounded frames (position + width + height) and only convert to SVG `<tspan>` chains on export. This would make text editing work like Illustrator/InDesign/draw.io text areas. (Longer-term; partially addressed by correct re-measurement and deferred composition above.)

### Force-specific UI controls

These controls only make sense for the force engine and don't need grid-editor parity.

- [x] `[S]` **Simplify force inspector.** The SELECTION panel shows too much detail (NODE, LABEL, POSITION, SIZE, PINNED, EFFECTIVE STYLE, Style dropdown, Pin/Unpin). Strip it down to the essentials — most of this chrome is unnecessary for the force use case.

- [x] `[S]` **Link distance slider.** Expose `link_distance` (currently JSON-only) as a live inspector control; restart solver on change.
- [x] `[S]` **Link strength slider.** Expose `link_strength` as a live inspector control.
- [x] `[S]` **Charge strength slider.** Expose `charge_strength` as a live inspector control.
- [x] `[S]` **Collision padding slider.** Expose `collision_padding` as a live inspector control.
- [x] `[S]` **Velocity decay slider.** Expose `velocity_decay` as a live inspector control.
- [x] `[S]` **Curve handle factor.** Expose the Bézier `handle_factor` (or `curve_offset`) as a live inspector control so the user can tune connector curvature interactively.
- [x] `[L]` **Alpha min / alpha decay.** Expose convergence thresholds if users need to tune settle behavior.
- [x] `[L]` **Preview port-kill on Windows.** `preview_server.py` runs `Stop-Process -Force` on any PID holding the port, even if it's an unrelated service. Fix: log the target PID or require `--force`.
- [x] `[L]` **`_relayout` gap comparison uses reloaded module.** After `importlib.reload(mod)`, `orig_col_gap` reads from the new module state, not the pre-reload snapshot. Fix: capture originals before reload.

### Ongoing maintenance

- [ ] `[S]` Manual draw.io desktop smoke test for `diagrams/2.output/draw.io/*-onbrand.drawio` and `assets/drawio/diagram-generator-primitives.mxlibrary` when draw.io is available locally.
- [ ] `[S]` Manual Illustrator desktop smoke test for the SVG batch when Illustrator is available locally.
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear.
- [ ] `[S]` Re-audit generator helpers when the starter block changes, to prevent drift back into mixed inset or line-height rules.
- [ ] `[S]` Keep preview-shell experiments on the vendored BF application shell unless there is an explicit repo-wide reason to introduce new preview CSS.

### v2 declarative pipeline — defect registry

The audited canonical diagrams pass the compare/audit checks, but full `python scripts/build_v2.py` still exits nonzero on the known clearance blockers listed above. Use `python scripts/_compare_3way.py` for visual comparison and `python scripts/_audit_v2.py` for element counts. Arrow clearance and crossing remain enforced at build time.

| Diagram | Status |
|---|---|
| attention-qkv | OK |
| gpu-waiting-scheduler | OK |
| inference-snaps | OK |
| logic-data-vram | OK |
| memory-wall | OK |
| request-to-hardware-stack | OK |
| rise-of-inference-economy | OK |