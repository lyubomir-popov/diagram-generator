# History

Completed work belongs here so `TODO.md` stays lean.

## Short-term

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
