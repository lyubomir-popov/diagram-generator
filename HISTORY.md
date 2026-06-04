# History

Completed work belongs here so `TODO.md` stays lean.

## Short-term

### 2026-06-05 – Preview arrow selection + identity parity

- **Root cause:** `/api/tree` indexes frames only; arrows were not in `ComponentModel`, so clicks fell through to `page` bbox picking. `layout-bridge` used `source->target` ids while `svg-render.ts` prefers authored `arrow.id`.
- **Fix:** `model.loadArrows` + `syncArrowsInModel` from frame-tree JSON; `arrowComponentId()` shared with TS renderer; transparent stroke hit areas on arrow segments; `findArrowAtPoint` runs before frame depth pick. Waypoints included in `serializeArrow` wire DTO.

### 2026-06-05 – Spec 012 T050/T060b + spec 019 inspector

- **T050:** `tests/svg-golden.test.ts` + 6 golden fixtures under `tests/fixtures/svg/`; HarfBuzz batch export parity lock.
- **T060b:** Removed `scripts/diagram_render_svg.py` (zero import references; batch/preview SVG is TS-only).
- **Spec 019:** `updateInspector` drops duplicate read-only rows; `Auto-layout · {cid}` heading.

### 2026-06-05 – Spec 012 T030/T040 – arrows + overlays in svg-render.ts

- **tokens.ts:** Added `GRID_GUTTER`, `ARROW_HEAD_LENGTH`, `ARROW_HEAD_HALF_WIDTH`, `ARROW_COLOR` as exported constants.
- **frame-model.ts:** Added `DiagramOverlay` interface; `overlays: DiagramOverlay[]` field on `FrameDiagram`.
- **frame-yaml-loader.ts:** Parses `color`, `waypoints`, `id` on arrows; parses `overlays:` list.
- **svg-render.ts:** Full orthogonal arrow routing (infers sides from bounding boxes, elbow waypoints, collinear simplification); orange `<line>` shaft segments + filled `<polygon>` arrowhead; optional label `<text>` above midpoint. `renderOverlays()` emits dashed `<rect>` + label per overlay. Old `<polyline>` with black stroke replaced.
- **index.ts:** Exports `DiagramOverlay`, `GRID_GUTTER`, arrow tokens.
- Commit `edcf6ca` on `main`.

### 2026-06-04 – Stakeholder docs refresh

- Added [`docs/stakeholder-guide.md`](docs/stakeholder-guide.md): YAML → preview → save → batch SVG for non-engineering users.
- Refreshed `STATUS.md`, `README.md`, `docs/specs.md`, `docs/architecture-status.md`, spec 011/012 status lines for TS-only preview SVG and spec 012 T020 icons.
- Drained `AGENT-INBOX.md` to template; active handoff lives in `STATUS.md` + `TODO.md`.

### 2026-06-03 – Main reset audit, dirty nav, spec 012 T060a

- **Git audit:** Verified no work lost when local `main` was reset to `origin/main` and FF-merged `feat/010` + `feat/005` (`31bce6e` ⊆ `6790df0`). Verdict **SAFE**; details archived from `AGENT-INBOX.md`.
- **Dirty diagram navigation:** Confirm before prev/next or browse-link when unsaved; on cancel, sync picker/browse UI to current URL (`6c712cc`).
- **Spec 012 T060a:** Preview server live v3 SVG is TS export only; failure logs and returns 404 (no `layout_v3` + `diagram_render_svg` fallback). Tests in `test_preview_server_reload.py` (`00887f8`).
- **Spec 012 T020:** Batch export embeds real icons from `assets/icons/` (`icon-embed.ts`, `svg-render.ts`, `export-frame-svg.mjs`); placeholder only when file missing.

### 2026-06-03 – P1 bug fixes and spec 005 WS1 completion

- **Highlight contrast:** Children inside `variant: highlight` panels inherit white text/icon fill while keeping their own box styling.
- **Height input blur:** `setFrameSize` clears runtime coercion keys so explicit FIXED heights survive relayout.
- **WS1 semantic mutation removal (TS):** Layout captures/restores semantic fields; `col_span` and grid equalization are runtime-only.
- **Validation:** 201 TS + 246 Python tests passing.

### 2026-06-02 – Preview coercion persistence fix

- **Editor coercion is runtime-only now.** `scripts/preview/editor.js` no longer merges engine-reported auto-coercion back into persistent overrides during local relayout, so an explicit `HUG` choice is no longer rewritten to saved `FIXED` state.
- **Inspector still shows the runtime reality.** `Fixed (auto)` display now derives from runtime coercion tracking instead of persisted override mutation, including the multi-select sizing inspector.
- **Focused browser regression added.** `scripts/test_preview_support_engineering_flow.py::test_v3_runtime_width_coercion_does_not_overwrite_hug_save` covers the explicit `HUG` -> local relayout -> save path.

### 2026-06-03 – Preview save/reload hardening and undo relayout

- **Fresh TS renders now preserve authored root padding.** `scripts/preview/layout-bridge.js` no longer treats an empty grid-override object as `link_to_root=true`, so clean preview renders stop overwriting authored root padding and gap from YAML.
- **Reload fetches are cache-busted.** The preview now refetches `/api/tree`, `/api/grid`, and `/api/frame-tree` with `no-store` semantics during reloads, avoiding stale browser responses after save.
- **Common grid saves no longer fail on transient fields.** `scripts/preview/component-model.js` strips editor-only grid fields such as `rows` and `slack_absorption` from the save payload before posting to YAML persistence.
- **Undo and redo now relayout v3-managed frame state.** `scripts/preview/editor.js` restores overrides before relayout and reruns local relayout whenever restored state adds or removes v3-managed frame overrides or grid changes.
- **Browser coverage expanded.** `scripts/test_preview_support_engineering_flow.py` now covers grid-save sanitization, root-padding save/reload, runtime coercion persistence, and undo/redo relayout for a v3-managed padding override.

### 2026-06-02 – Documentation consolidation and workflow streamlining

- **Token savings:** copilot-instructions.md 3,930→2,861 tokens (-27%), STATUS.md 3,748→558 tokens (-85%), HISTORY.md 30,836→4,885 tokens (-84%).
- **Deleted ROADMAP.md** — fully redundant with spec-kit specs/ and copilot-instructions.md standing decisions.
- **Trimmed copilot-instructions.md** — removed 6 generic sections duplicated from agent-workflow-kit workspace instructions (doc-structure table, instruction-file-scope, planning threshold, history rules, inbox pattern, session workflow).
- **Rewrote STATUS.md** from 81→29 lines. Architecture detail moved to `docs/architecture-status.md`. Added project-context section with Jira/Coda/spec-kit three-layer model.
- **Archived 480 lines of HISTORY** (2026-05-19 to 2026-05-27) to `docs/archive/history-2026-05.md`.
- **Updated cross-references:** Removed ROADMAP.md from agent.md, INBOX.md, AGENT-INBOX.md, README.md, docs/specs.md. Updated diagram-generator-planning entry in specs.md with Stream E context.
- **Added Jira context** to TODO.md and STATUS.md for cold-start agents (DE-941 → Stream E mapping).

### 2026-06-02 – Annotation heading bold bug fix

- **Bug:** Annotation-variant frames with `heading:` rendered bold (weight 700) because the parser hardcodes `weight="700"` for string headings and the annotation class had no `headingText` override.
- **Fix:** Added `heading_text` and `leaf_lead_text` with `weight="400"` to the annotation `FrameClassDefinition` in both Python and TypeScript engines.
- **Validation:** 243 Python + 198 TS tests green. Confirmed `hdr_container` and `hdr_vm` in `android-security-comparison` now resolve to weight 400.

### 2026-06-02 – DIAGRAM.md token audit and HUG sizing fix (spec 010)

- **All 46 tasks done across 6 phases.** Token audit, HUG sizing fix, and column-span conditional display complete.
- **Part 1 – Token audit.** Every DIAGRAM.md frontmatter value annotated with role classification: invariant (grid/spacing/sizing fundamentals), default (overridable starting points like `BLOCK_WIDTH`), or frozen-sample (measured from initial artwork, e.g. arrowhead geometry). Legend added to frontmatter.
- **Part 2 – HUG sizing fix.** Removed the `BLOCK_WIDTH` (192px) floor from HUG leaf measurement in both Python and TypeScript engines. HUG boxes now shrink to `round_up_to_grid(content_w)`. Empty-box fallback and text wrapping default preserved. Parity fixtures regenerated. All 24 production diagrams pass.
- **Part 3 – Column-span display.** Width inspector "cols" unit option now guarded behind `gridInfo.col_widths` availability. Unit resets to "px" when grid columns unavailable.

### 2026-06-01 – Client-side TS rendering complete (spec 009)

- **All 6 phases (T001–T022) done.** TS pipeline renders SVG on first load in the preview editor. Python SVG fetch eliminated from the interactive path; Python renderer remains for batch/export.
- **Error handling added.** HarfBuzz load failure, icon fetch 404, and empty diagram (missing/null root) all surface visible error banners before falling back gracefully. Server fetch failure also handled with distinct messaging.
- **23 diagrams browser-verified** with TS rendering, grid overlay, and constraint checks. No alignment issues, no regressions.
- **Autolayout stress test passed.** Grid overlay verification across production diagrams (4-column, 5-column wrapped, vertical stacks, nested containers, mixed HUG/FILL/FIXED sizing) – all boxes align to column guides. "No violations" on all tested diagrams.
- **Validation:** 198 TS + 271 Python tests passing. Commits: `fe7592c` (phases 1–3), `914c084` (phases 4–6).

### 2026-06-01 – Autolayout corpus visual audit complete (spec 005 prerequisite)

- **All 23 production diagrams visually audited** and confirmed correct after the level/style simplification. Inline styles converted, overrides baked into YAML, levels corrected where needed.
- **Variant overlays and col_span landed.** `variant: highlight` (black fill, white text), `variant: annotation` (borderless), `col_span` field for grid-column spanning. 7 tests covering all combinations.
- **Overlay model landed.** Dashed bounding-rect overlays parsed from YAML `overlays:` key. Mermaid testcase ports (simple + complex) with overlay demonstration. 3 tests.

### 2026-06-01 – Repo coherence rewrite: doc convergence and code cleanup (spec 008)

- **Document convergence.** Stripped dead-pipeline references from README.md, agent.md, two skills, ROADMAP.md, STATUS.md, and TODO.md. Marked 3 audit docs as historical. Fixed copilot-instructions.md Spec Kit pointer. ROADMAP collapsed from 300 to 38 lines (future-only). README from 480 to 240 lines. STATUS from 200 to 78 lines.
- **Interactive state verified clean.** Phase 6 audit confirmed: no server fallback, no localStorage, no JSON sidecar authority, YAML-only persistence. Accent style removed from diagram-schema.json.
- **Python surface contracted.** Phase 7: 15 modules classified (parser/defaults, batch/export, parity oracle, style resolution, text metrics, preview server, legacy with active callers). Orphaned grid_helpers.py deleted. Role labels added to ambiguous modules.
- **Browser and build verification passed.** Phase 8: TS build, browser bundle, and preview server all clean. support-engineering-flow and android-custom-to-cloud verified rendering correctly.
- **Phase 5 deferred.** Resolved style snapshot end-to-end (resolvedTextColor/resolvedIconColor fields) deferred to a future focused pass.
- **Validation:** 198 TS + 271 Python tests passing. No regressions.

### 2026-05-31 – Repo coherence rewrite: frame-class authority cleanup

- **Deleted the hand-authored JSON frame-class contract.** `packages/layout-engine/src/frame-classes.contract.json` is gone, and generated output was rebuilt so `dist/` no longer advertises it as a source of truth.
- **`docs/frame-classes.md` is now the authored authority.** The doc now states explicitly that machine-readable derivatives, if any, are generated only and must not become an independent truth source.
- **Highlight and annotation now behave as semantic overlays instead of replacement classes.** TS and Python both resolve base class typography first, then apply highlight/annotation color semantics, which preserves section/panel/leaf heading weight while still enforcing white highlight text and grey annotation text.
- **Renderers now consume resolved text/icon color semantics without raw black-fill heuristics.** Preview and Python SVG paths rely on resolved frame/line state instead of `fill === black` contrast branches.
- **Validation passed after the cleanup.** `npm --prefix packages/layout-engine test`, `python -m pytest scripts/test_frame_classes.py scripts/test_style_parity.py -q`, `npm --prefix packages/layout-engine run build`, `npm --prefix packages/layout-engine run build:browser`, and `python -m pytest scripts/test_preview_support_engineering_flow.py -q` all passed.

### 2026-05-31 – HarfBuzz-backed browser measurement cutover (spec 007 Phase 7)

- **Interactive text measurement now hard-requires HarfBuzz in the browser.** The preview bridge no longer instantiates `CanvasTextAdapter`; it dynamically loads a dedicated browser ESM bundle for `HarfBuzzTextAdapter`, fetches the canonical Ubuntu Sans variable font, and fails explicitly if the resulting adapter backend is anything other than `harfbuzz`.
- **The text-measurement contract now carries typography features, not just string width.** `TextMeasureAdapter` now measures a full `TextMeasureRequest` (`text`, `fontSize`, `weight`, `smallCaps`, `letterSpacing`), which lets the TypeScript path shape `smcp` / `c2sc` and treat explicit letter-spacing as a first-class layout input instead of bolting width tweaks on afterward.
- **Browser bundle split cleaned up the packaging model.** `packages/layout-engine/build-browser.mjs` now emits the existing global engine bundle separately from a HarfBuzz-specific browser module plus `harfbuzz.wasm`, and `preview_server.py` serves the adapter bundle, wasm asset, and canonical font explicitly.
- **Faux small caps removed from the active section-heading path.** `DIAGRAM.md` and `docs/frame-classes.md` now forbid simulated small caps, the section class uses the sanctioned fallback token (bold sentence case), and both SVG renderers now emit measured text content directly instead of uppercasing and shrinking it.
- **Frame-class semantics converged across runtimes.** TS and Python now apply the same shared semantics, with authored authority later settled in `docs/frame-classes.md` and the brief JSON contract experiment removed.
- **Legacy fake small-caps multipliers removed.** The old `* 1.05` width heuristics were removed from `scripts/text_metrics.py`, `scripts/diagram_layout.py`, and non-authoritative TS adapters.
- **Phase 7 validation advanced.** `npm test`, `npm run build`, `npm run build:browser`, `python -m pytest scripts\\test_preview_support_engineering_flow.py -q`, `python -m pytest scripts\\test_layout_v3.py -q`, `python -m pytest scripts\\test_frame_loader.py -q`, `python -m pytest scripts\\test_parity.py -q`, and `python -m pytest scripts\\test_autolayout.py -q` all passed. `specs/007-style-foundation-unification/tasks.md` now records T061–T063 complete.
- **Audit findings reduced, not hidden.** Remaining debt is now mostly cleanup/governance: legacy metrics modules still exist as non-authoritative drift bait and final adversarial closure checkpoints are still pending.

### 2026-05-31 – YAML-backed override persistence (spec 007 Phase 6)

- **Canonical frame YAML is the only persisted v3 edit authority.** `/api/overrides/<slug>` writes supported frame/grid/text overrides back into `scripts/diagrams/frames/<slug>.yaml` and invalidates the preview layout cache. Legacy JSON sidecar handling has been removed from the v3 editor path, and the remaining override JSON artifact under `diagrams/2.output/overrides/` was deleted.
- **Style alias shim removed.** The v3 editor no longer accepts `accent` as a synonym for `parent`; the style vocabulary is now the explicit set the renderer actually owns: `default`, `parent`, `section`, `annotation`, `highlight`.
- **Editor reload semantics now follow YAML baseline, not fake override state.** Component tree metadata now carries `level` / `fill` / `border`, and the inspector style picker falls back to node semantics when no transient override exists, so saved styles still show correctly after reload without rehydrating a shadow override layer.
- **Phase 6 coverage added.** `scripts/test_frame_yaml_persistence.py` verifies canonical YAML mutation and no-op save behavior, and `scripts/test_preview_support_engineering_flow.py` covers save/reload roundtrips from YAML baseline. The full preview regression file passes under `python -m pytest scripts\\test_preview_support_engineering_flow.py -q`.

### 2026-05-31 – Single interactive path cutover (spec 007 Phase 5)

- **Interactive server fallback removed from the v3 editor path.** `requestV3Relayout()` now uses the TypeScript local relayout path only. When the bridge is unready or a local rerun fails, the editor records `lastMode: local-error`, keeps the current SVG intact, and surfaces a visible status error instead of routing back through Python.
- **Dead server relayout path deleted.** `editor.js` now hard-fails if loaded outside the v3 renderer contract, the old client `requestRelayout()` branch is gone, and `/api/relayout` has been removed from `preview_server.py`.
- **v3 style mapping hardened to the shared resolver contract.** `_applyV3StyleFields()` no longer derives semantic fields from the generic `BOX_STYLES` preset table. It now applies an explicit v3 semantic map, including `parent -> { level: 2, fill: GREY, border: SOLID }`, which preserves the grey panel treatment on leaf nodes under the single local renderer.
- **Focused browser coverage rewritten for local-only behavior.** The support-engineering Playwright tests now assert that style changes execute through `interactiveExecutor: local-only`, and that forced-unready / synthetic local-failure states surface explicit `local-error` status with no fallback dependency. The targeted slice passes under `python -m pytest scripts\\test_preview_support_engineering_flow.py -q -k "single_local_executor or unready_or_failed_state"`.
- **Closure gate + repo-state docs synced.** Spec 007 `plan.md`, `tasks.md`, and `style-contract.md` now document the WS4 closure gate, and `STATUS.md` / `TODO.md` now describe the v3 editor as a single interactive TS execution path.

### 2026-05-30 – Readiness + fallback hardening (spec 007 Phase 4)

- **Centralized the v3 readiness contract.** `layout-bridge.js` now exposes `getLocalRelayoutStatus()` with explicit reason codes (`ready`, `missing-frame-tree`, `missing-text-adapter`, `forced-fallback`). `editor.js` consumes that through `getV3RelayoutStatus()` so frame-managed DOM gating and relayout execution share one predicate.
- **Fallback behavior hardened.** `requestV3Relayout()` now falls back cleanly for both unready bridge states and local rerun failures after coercion cleanup. Live resize preview also checks the shared readiness predicate before attempting TS-only preview relayout.
- **Browser regression coverage added.** New Playwright tests cover forced fallback style changes and a ready -> fallback -> ready transition with continuity checks, including a synthetic one-shot local relayout failure. The new cases pass under `.venv\\Scripts\\python.exe`.

### 2026-05-30 – Style resolution ported to TypeScript (spec 007 Phase 3)

- **`resolve_styles()` ported to TS.** New `resolve-styles.ts` in `packages/layout-engine/` — full port of Python's depth-aware 4-class style resolution (section/panel/leaf/annotation), nesting constraints (grey-on-grey demotion, section-in-section cap), heading weight and small-caps mutations. 15 tests covering all style classes.
- **`_frameBoxRenderState()` rewritten.** No longer uses flat `fill`/`border` heuristics. Consumes `resolvedFill`/`resolvedStroke` set by `resolveStyles()` after layout in `performLocalRelayout()`.
- **Frame model extended.** `level`, `resolvedFill`, `resolvedStroke` fields added to TS `Frame` and `FrameInit`. Python serializer includes `level` in frame tree JSON.
- **Bug fixed: changing one frame's style no longer corrupts all other frames.** Root cause was `_frameBoxRenderState()` re-deriving style from raw `fill`/`border` for every frame during relayout. Now uses resolved values from the single-source-of-truth `resolveStyles()`.
- **INBOX bug drained.** Style dropdown and section variant confirmed working in browser.
- **diagram_type enum expansion (cross-repo).** 8→11 values in `docs/diagram-schema.json` and `frame_loader.py` (committed by previous agent).

### 2026-05-30 – Class-based styling: eliminate inline styles, heading on non-containers, delete overrides

- **Inline style ban enforced.** All `weight:`, `fill:`, `size:` removed from YAML label lines across 12 production diagrams. `_parse_line()` rewritten to accept only `text`, `style` (named styles like `muted`), and `small_caps`. The `_LINE_STYLES` dict maps named styles to Line kwargs.
- **`heading:` on non-containers.** `frame_loader.py` now passes `heading_line` through to `frame.heading` for non-containers (was hardcoded `None`). `_leaf_all_lines()` in `layout_v3.py` prepends `frame.heading` to label lines for measurement and rendering.
- **Leaf heading weight demotion.** `resolve_styles()` now demotes `label[0]` weight from bold to regular on non-container leaves, matching the existing demotion for synthetic `__heading` children and direct `heading` fields.
- **Editor overrides deleted.** All 12 override JSON files under `diagrams/2.output/overrides/` deleted. Structural overrides (sizing, gap, width, grid) baked into YAML for android-custom-to-cloud, android-security-comparison, diagram-intake-workflow, support-engineering-flow, request-to-hardware-stack.
- **Layout-bridge JS crash fixed.** `const` reassignment in `_buildFrameTextElement` small-caps block caused `TypeError: Assignment to constant variable`. Changed to `let size` and extracted `content` variable.
- **Level-assignment skill created.** `.github/skills/level-assignment/SKILL.md` – covers sibling-consistency algorithm, inline style ban, heading field usage, exemptions for annotations/separators/highlights, runtime downgrade documentation. Adversarial-reviewed by Explore subagent.
- **`frame-classes.md` updated.** Added "Choosing the right level" section with the sibling-consistency rule (3 numbered steps + example). Added "Non-container sections" rendering note. Updated YAML mapping section.
- **android-security-comparison fix.** `hdr_vm` was missing `variant: annotation`, rendering as bordered leaf instead of matching `hdr_container`. Fixed; reverted stale `sizing_h: fill` on `lxd_headline` and `vm_headline`.

### 2026-05-29 – Simplify level/style system: depth-based levels, panel non-nesting

- **Replaced** bottom-up `_classify_levels()` with inline `_compute_level()` inside `resolve_styles()`. Levels now derive from nesting depth + container status: depth 0 → 0 (root), depth 1 + container → 2 (panel), depth 1 + leaf → 1 (box), depth 2+ → 1 (box).
- **Panels are no longer nestable** – a level-2 frame inside a panel is clamped to level 1 (box) with small-caps heading promotion for a third visual tier.
- **Defaults simplified**: gap → uniform 24 (was context-sensitive INSET/GRID_GUTTER), padding → 8 for bordered/headed nodes / 0 for wrappers. Heading `min_height` now includes INSET (56px). `__body` wrapper no longer copies `wrap`/`fill_weight`/`justify` from parent. Grid defaults require explicit YAML (no GRID_GUTTER fallback).
- **Fixed broken import**: removed `_classify_levels` reference from `layout_v3.py` (was causing ImportError).
- **Tests updated**: 8 tests renamed/rewritten for depth-based semantics. Removed level-3, headingless-container, and body-inheritance tests that no longer apply. 231 tests + 51 subtests pass.
- **Known regression**: autolayout rigour degraded across the diagram corpus – gap, padding, and body-wrapper defaults changed. Corpus-wide visual audit needed.

### 2026-05-28 – Spec 004: diagram audit – remove all redundant YAML overrides

- **Scope**: All 24 non-test frame YAMLs audited against the level system (spec 001).
- **Removed**: 126 redundant `border:` overrides total (94 in batch 3+4 first pass, 32 in second pass). Zero `border:` overrides remain in non-test YAMLs.
  - `border: none` on root/wrapper/separator nodes (L0 default handles this)
  - `border: solid` on headed containers (L2/L3 level system handles this)
  - `border: none` on annotation leaves → converted to `variant: annotation` (semantic)
- **Kept**: `fill: "#666666"` on inline text (intentional caption styling), `fill_weight` values (engine feature), `variant: highlight` (intentional).
- **Text hierarchy**: All 24 files use consistent `{text: ..., weight: "700"}` format. No fixes needed.
- **Tier assignments**: support-engineering-flow, android-security-comparison, lt-diagram-generator all verified correct.
- **Verified**: All 235 tests + 51 subtests pass. Browser-verified android-graphics-stack, request-to-hardware-stack, aws-hld, gpu-waiting-scheduler, support-engineering-flow, android-security-comparison, lt-diagram-generator (all pixel-identical output).
- Commits: `f92e613` (SDD artifacts), `082ae97` (batch 2), `85bec00` (batch 3+4 automated), `70d3f14` (second pass cleanup).
- Branch: `feat/004-diagram-audit`

### 2026-05-28 – Spec 003: arrow shaft–arrowhead gap fix

- **Root cause**: The client-side layout bridge (`layout-bridge.js`) introduced a 1.2px gap between arrow shafts and arrowheads. `_orthogonalWaypoints()` generated 4 collinear points for straight arrows, but the Python renderer only emits 1 `<line>` per shaft. The bridge's `patchArrowsSvg()` could only patch segment 0 (start→midpoint), making `isLastSegment` never true, so the shaft endpoint was never replaced with `basePoint`.
- **Fix**: Added `_simplifyPath()` to `layout-bridge.js` (mirrors Python's `_simplify_path`) to collapse collinear waypoints before SVG patching. Applied in `routeArrows()` after building the full path.
- **Verified**: Zero gap on 17 arrows across 4 diagrams (vertical, horizontal, and multi-segment routes). All 235 Python tests + 51 subtests pass.
- Commits: `87ca9cd` (heading override fix on the branch), `e1e041c` (arrow gap fix).


---

Older entries archived to `docs/archive/history-2026-05.md`.
