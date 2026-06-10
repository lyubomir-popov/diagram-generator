# Status

**Last updated:** 2026-06-10 (updated for spec 006 review follow-up + inbox drain)
**Branch:** `feat/006-arrow-routing-redesign` (spec 006 review follow-up in progress)

## Stakeholder path

Making a diagram for a review or deck: **[`docs/stakeholder-guide.md`](docs/stakeholder-guide.md)** — copy a frame YAML, run `npm run preview`, open `/view/v3:<slug>`, save and optionally export SVG.

**Hard rule:** no Python in the diagram product path. Preview, layout, render, export, and save belong on the Node / TypeScript path; remaining Python is temporary parity-oracle, draw.io, and token-bridge debt under spec 038.

## What this repo is

`diagram-generator` is a constrained interactive diagram editor that turns frame YAML into on-brand SVG and draw.io outputs. It owns the single autolayout codebase in the workspace (`packages/layout-engine/`, TypeScript), eventually porting to `design-foundry` as `@design-foundry/operator-autolayout`. See `../design-foundry/PIVOT.md`.

**TypeScript is the implementation language** for layout, measure, and SVG export. Existing Python product-path files are migration debt being removed by spec 038, not a valid place for new work.

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
| **Interactive preview** | Node preview app + TS `layout-bridge.js` + HarfBuzz; save → YAML now has a TS path under `apps/preview/src/persistence/` |
| **Preview APIs** | Node/TS-only: frame-tree, grid, component tree, preview document, icons, and save routes via `apps/preview/src/server.ts` |
| **Live preview SVG** | TS-only Node export via `apps/preview/src/server.ts`; no Python SVG renderer (spec 012) |
| **Batch SVG** | `export-frame-svg.mjs` — TS-only (`svg-render.ts`); golden harness `tests/svg-golden.test.ts` (3 canonical slugs after the first pruning pass) |
| **Tests** | `npm --prefix packages/layout-engine test` green (`341/341`); `npm --prefix apps/preview test` green (`14/14`); full `python -m pytest scripts -q` last known green (`334 passed`, `65` subtests); focused Node-preview browser/Playwright lanes green for v3, force, and sequence; `node scripts/check_no_new_python.mjs` green |

### Current delta — spec 006 adversarial-review follow-up (2026-06-10)

- The prior high-severity review items are resolved in the current branch state: browser routing delegates to the shared TS `routeArrows` implementation, the browser bundle was rebuilt, and the `example-platform-architecture` golden fixture now matches the intended trident output.
- Focused follow-up fixes now cover the author-tooling fallout from `arrow:<id>` refs: compile orphan warnings resolve incident leaves through referenced host arrows, and Mermaid/D2 exporters skip arrow-to-arrow refs with explicit unsupported-anchor warnings instead of misleading missing-frame diagnostics.
- Gap promotion remains an **interim dense-leaf-stack heuristic**, not the full route-lane classifier described in spec 006 FR-007 to FR-009. The spec addendum now says that explicitly; the full classifier remains open in T080/T081.
- Routing geometry is still owned by the shared `routeArrows` helper called from the render surfaces rather than precomputed in `layout.ts`; Phase 6 (`T050`-`T052`, FR-005) remains open and should be treated as a deliberate next slice, not implied complete.

### Current delta — spec 035 compatible engine switcher complete (2026-06-10)

- Native v3 autolayout is now a first-class preview-engine manifest (`id/layoutEngineKey: v3`) alongside ELK layered, force, and sequence.
- Blank frame-diagram docs now resolve to the first compatible manifest in registry order, so existing authored YAML with no `meta.layout_engine` defaults to native v3 while still offering `elk-layered` as an alternative.
- The grid preview server now injects the resolved active engine key plus the compatible engine list into `__DG_CONFIG`, so the switcher appears on authored frame diagrams and selects `v3` by default instead of rendering an empty current value.
- ELK layered compatibility is no longer document-kind-only: arrowless frame diagrams now offer only `v3`, and the live `/api/overrides/{slug}` HTTP path rejects persisted `elk-layered` picks unless the authored frame diagram includes at least one arrow.
- Focused validation for the closeout slice is green: `npm --prefix packages/layout-engine test -- tests/preview-engine-registry.test.ts`, `python -m pytest scripts/test_preview_engine_manifest.py -q`, and browser verification on a fresh preview-app instance confirmed the switcher is visible on `preview-smoke` with `v3` + `elk-layered`.

### Current delta — spec 038 complete (2026-06-08)

- `apps/preview/` is now the live preview front door: shell HTML, GET preview APIs, POST save routes, icon/reference assets, and watcher-driven SSE reload all run through the Node app.
- `scripts/preview_server.py`, `scripts/preview_ts_layout.py`, `scripts/preview_ts_export.py`, and `scripts/frame_yaml_persistence.py` are deleted; the retained Python loader/layout modules are explicitly dated parity oracles only.
- Preview/browser coverage is now routed through the Node app harness, and the focused Playwright lanes for v3, force, and sequence all render cleanly from the Node server.
- `packages/layout-engine/` now exposes the design-foundry-aligned internal seams needed for the later package relocation: `document-model/schema`, `operator-autolayout/facade`, `render-adapter/display-list` + `svg`, `render-ir`, and a text-shape-compatible adapter surface.
- Validation for the closeout slice is green: `npm --prefix packages/layout-engine test`, `npm --prefix packages/layout-engine run build`, `npm --prefix packages/layout-engine run build:browser`, `npm --prefix apps/preview test`, `python -m pytest scripts -q`, `node scripts/check_no_new_python.mjs`, plus focused Node-preview Playwright route checks for v3 / force / sequence.

### Current delta — spec 022 diagram authoring AST closed (2026-06-06)

- TypeScript diagram compiler in `packages/layout-engine/src/diagram-author/`: frame-tree AST, arrow shorthand, `defaults` / `use:` expansion, validation warnings, lowering through `loadFrameYaml`, Mermaid export, and D2 export.
- Docs and tooling: [`docs/diagram-authoring.md`](docs/diagram-authoring.md), `migrate-diagram-yaml.mjs`, `export-mermaid.mjs`, `export-d2.mjs`, reference fixture `tiered-network-architecture.author-v1.yaml`, and the spec 028 interchange package.
- Root canvas endpoints are now rejected at compile time; Mermaid and D2 exporters skip invalid arrows defensively with warnings. Preview save format remains canonical `root` + `arrows`.

### Current delta — ELK force core port started (2026-06-06)

- The planning ontology still ranks `elk-layered` as the highest-demand graph engine and `elk-force` as the next ELK engine after it.
- `graph-layout-elk` now has a first bounded `elk-force` port: shared ELK graph-builder path, `layoutForceForFamily()`, planning-aligned family mapping for force-directed families, and focused package coverage.
- This slice is deliberately core-only. The preview registry and shell still point `force` at the existing D3/quadtree force lane, which remains a first-class engine in this repo; no preview-side ELK force onboarding has been claimed yet.

### Current delta — spec 030 sequence layout complete (2026-06-06)

- Spec 030 is now complete as a bounded v1 slice.
- Sequence support is landed as a first-party TypeScript lane with compiler-owned `sequence:` YAML, preview-engine registration, TS-owned preview documents, and browser-bundle exports for live preview rendering.
- The validated live fixture is now corpus-backed: the active sequence demo redraws Landscape package reporting and loads the tracked source image in Input and Both for direct fidelity checks.
- Unsupported sequence affordances visible in the corpus source, notably activation bars and the sleep bracket, remain explicit follow-up work rather than shell-side patches or fake frame-tree edits.

### Current delta — spec 029 force preview shell convergence complete (2026-06-07)

- Force Save-button state now follows the same direction as the shared preview shell: dirty is derived from the authored payload that will persist to YAML, not from undo-stack position or live solver tick metadata.
- The force lane still posts through the canonical YAML save path only, but the browser now sends the same authored-spec-shaped payload that the server persists, so live alpha/tick churn no longer marks a freshly loaded or freshly saved graph dirty.
- Focused coverage now locks the boundary: `scripts/test_preview_force_api.py` proves a force param can dirty and clean without saving, a persisted node move enables Save, and canonical save/reload returns the button to a clean disabled state.

### Current delta — spec 027 preview browser test API complete (2026-06-07)

- `editor.js` no longer publishes the legacy `saveOverrides` / `performUndo` / `performRedo` / `canUndo` / `canRedo` globals.
- In-repo browser automation now uses the explicit `window.__DG_TEST_preview` facade, which stays a thin delegate over `PreviewSaveClient` and `EditorState` rather than reintroducing save or undo logic in the shell.
- Boundary coverage now locks both sides: `scripts/test_preview_support_engineering_flow.py` uses the named facade, and `scripts/test_preview_browser_test_api.py` plus `scripts/test_preview_editor_shell_shrink.py` fail if the old globals return.

### Current delta — spec 036 headingless wrapper contract complete (2026-06-07)

- Mainline now enforces the intended default: implicit headingless containers behave like structural wrappers, do not expose visible style-picker controls, and do not pick up panel padding/chrome through save/reload drift.
- The explicit supported path is now bounded and tested: non-headed containers remain visible only when the authored document already opts in through visible container fields (`level` / `fill` / `border` or equivalent persisted style semantics), rather than through accidental wrapper promotion.
- Focused coverage now spans persistence plus browser save/reload behavior: implicit wrapper style attempts stay no-op and reload cleanly, while explicitly visible non-headed groups remain editable and round-trip as deliberate container styles.

### Current delta — spec 037 preview engine drift closeout complete (2026-06-07)

- The preview-engine manifest is now the hostability authority for frame-backed runtime lanes: hostable preview keys are normalized from the TS manifest, stale non-hostable metadata such as `elk-force` no longer hijacks the runtime lane, and older diagrams can still open for repair instead of failing closed on load.
- Force save now returns canonical persisted state and the force preview rehydrates from that canonical authored payload after save instead of treating the pre-save local snapshot as authoritative.
- Live preview no longer writes ELK debug/raw-view shell state into `localStorage`, and the preview-engine model now carries typed compatibility metadata for `frame-diagram`, `sequence`, and `force-spec` as groundwork for spec 035.
- Focused validation for the closeout slice is green: `tests/preview-engine-registry.test.ts` plus targeted pytest coverage for manifest discovery, frame-loader hostability, layout-bridge persistence boundaries, and force save persistence.

### Current delta — spec 024 summary recorded on main (2026-06-06)

- Mainline conclusion: do not ship interactive ELK nudging on the current plain-`elkjs` path.
- The explored pseudo-position route can affect simple fixtures but failed the live Juju graph shippability test with catastrophic non-local relayout.
- Any further technical work for spec 024 should stay off `main` until there is a stronger result, with upstream Java ELK parity as the next meaningful check.

### Current delta — spec 026 preview shell decomposition closed (2026-06-06)

- Spec 026 is complete: save client, ELK controller, TS editor state store, `editor.js` shell shrink, and boundary documentation in `specs/026-preview-shell-decomposition-ts-migration/boundaries.md`.
- Post-closeout follow-up initially kept the existing browser-facing preview API stable as thin shims over the extracted modules; those temporary globals are now retired by spec 027, and the dead `viewer.html` / `force-viewer.html` template leftovers were removed.
- T031 reassessment: `layout-bridge.js` remains the runtime bridge (frame-tree JSON ↔ LayoutEngine ↔ SVG); it does not own shell concerns and was not rewritten in this milestone. Deferred follow-ups (TS override application, SVG bridge split) are documented in `boundaries.md`.
- Focused coverage: full spec 026 validation slice (39 pytest + 24 vitest) including `scripts/test_preview_layout_bridge_boundaries.py`.

### Current delta — spec 026 T030 editor.js shell shrink (2026-06-06)

- Removed obsolete inline wrappers for dirty snapshot, undo/redo, and override patch helpers from `scripts/preview/editor.js`; call sites now use `EditorState` and `PreviewSaveClient` directly.
- Undo restore path uses `LayoutEngine.parseEditorSnapshot` for typed snapshot parsing.
- Focused coverage: `scripts/test_preview_editor_shell_shrink.py`; validation slice green (35 pytest + 24 vitest).

### Current delta — spec 026 T020–T022 TS-first editor state migration (2026-06-06)

- Moved undo/redo stack and dirty-state orchestration into TS: `packages/layout-engine/src/preview-shell/editor-undo-stack.ts` and `editor-state-store.ts`, exported via `LayoutEngine.createEditorStateStore`.
- `scripts/preview/editor-state.js` is now a thin DOM adapter (button wiring + undo apply callback); snapshot shaping and undo history no longer live in JS.
- Focused coverage: `packages/layout-engine/tests/editor-undo-stack.test.ts`, `packages/layout-engine/tests/editor-state-store.test.ts`, expanded `scripts/test_preview_editor_state.py`; validation slice green (33 pytest + 24 vitest).

### Current delta — spec 026 T012 editor state extraction (2026-06-06)

- Extracted undo/redo stacks, pending grid action, and dirty snapshot serialization from `editor.js` into `scripts/preview/editor-state.js` (`EditorState` container).
- TS-owned snapshot helpers live in `packages/layout-engine/src/preview-shell/editor-snapshot.ts` and export through `LayoutEngine` for browser consumption.
- `viewer-unified.html` loads `editor-state.js` before mode scripts; `editor.js` delegates via `EditorState.init()` and no longer owns local undo/redo stack variables.
- Focused coverage: `scripts/test_preview_editor_state.py`, `packages/layout-engine/tests/editor-snapshot.test.ts`; full preview regression suite green (31 pytest + 16 vitest in the validation slice).

### Current delta — spec 026 T011 ELK controller extraction (2026-06-05)

- Extracted ELK shell wiring from `editor.js` into `scripts/preview/elk-controller.js` (`ElkPreviewController`: engine detection via preview-engine registry, sidebar init, override state, relayout requests).
- `elk-layout-controls.js` delegates detection and input handling to the controller; preview server loads `elk-controller.js` after `elk-layout-controls.js`.
- Focused coverage: `scripts/test_preview_elk_controller.py`; ELK save round-trip still green.

### Current delta — spec 026 T010 save-client extraction (2026-06-05)

- Extracted save/reload orchestration from `editor.js` into `scripts/preview/save-client.js`: dirty tracking, override POST, post-save `loadSVG()` rehydration, Save SVG export, and save-button wiring.
- `viewer-unified.html` loads `save-client.js` before mode scripts; `editor.js` delegates via `PreviewSaveClient.init()`.
- Focused coverage: `scripts/test_preview_save_client.py`; ELK save round-trip still green.

### Current delta — spec 025 multi-engine preview architecture closed (2026-06-06)

- Added `packages/layout-engine/src/preview-engine/` with typed manifest/capability interfaces, ELK and force registrations, and `resolvePreviewEngine()` for shell discovery.
- TS build now emits `dist/preview-engine-manifest.json`; Python serves it at `/api/preview-engines` with no Python-side engine metadata mirror.
- ELK and force preview lanes consume the registry: manifest-owned scripts bootstrap the preview lanes, `force.js` reads manifest routes/param metadata, and `editor.js` stays on shared bootstrap wiring instead of growing new engine branches.
- `/api/overrides/<slug>` now returns canonical persisted state (`frameTree`, `componentTree`, `gridInfo`) and `PreviewSaveClient` threads that canonical payload into the post-save reload path before the usual local render pipeline runs.
- Future engine onboarding is documented in `specs/025-multi-engine-preview-architecture/plan.md` so new engines register through TypeScript manifests instead of adding hardcoded preview shell branches.
- Focused coverage: `packages/layout-engine/tests/preview-engine-registry.test.ts`, `scripts/test_preview_engine_manifest.py`, `scripts/test_preview_save_client.py`, `scripts/test_preview_elk_layout_save.py`, and `scripts/test_frame_yaml_persistence.py`.

### Current delta — ELK save cleanup + preview architecture specs (2026-06-05)

- ELK save no longer mutates in-memory frame-tree ELK state speculatively after a successful POST; the preview now rehydrates from canonical persisted server state on reload instead of pretending the save already landed locally.
- `frame_yaml_persistence.py` preserves unrelated authored `meta.elk` keys during ELK save merges instead of replacing the entire ELK map.
- ELK control metadata no longer has Python or browser-JS mirrors: `scripts/preview/elk_sidebar_html.py` is gone, and `scripts/preview/elk-layout-controls.js` now renders only from the TS registry exported through `LayoutEngine`.
- Added `/api/runtime-identity`, which reports repo root, branch, frames dir, PID, and port so multi-worktree/server confusion is diagnosable without guessing.
- The composer ELK worktree was reconciled selectively: current `main` already superseded the older preview/runtime overlap, so the retained value moved over as QA/contract coverage (`test_elk_preview_qa.py`, `test_preview_shell_bf_contract.py`, `preview_html_allowlist.txt`) instead of merging stale preview code backwards.
- Current focused checks are green on `main`: ELK save/persistence, ELK preview QA, Baseline Foundry shell contract, force preview API, TS force runtime tests, and the TS-backed force benchmark.
- The immediate ELK duplicate-source cleanup is done; spec 025 is complete.
- Added two new spec-kit packages to stage the larger preview refactor without overloading one session:
	- `specs/025-multi-engine-preview-architecture/` for typed engine manifests/capabilities and TS-owned engine metadata
	- `specs/026-preview-shell-decomposition-ts-migration/` for shrinking `scripts/preview/editor.js` through incremental TS-first extraction
- Architectural direction is now explicit: more engine packages (ELK, Mermaid, Penrose, others) must integrate through a preview-engine contract, not by adding more engine-specific branches to `editor.js`.

### Current delta — runtime dist freshness fix (2026-06-05)

- `export-frame-svg.mjs`, `emit-frame-diagram-json.mjs`, and sibling Node CLIs now auto-rebuild `packages/layout-engine/dist/` when TS source is newer than the requested dist artifact, so the active runtime no longer drifts behind source edits.
- Added runtime regressions in `scripts/test_preview_frames_dir.py` proving the live DTO/export scripts strip retired line-level style fields rather than only the source-level unit tests doing so.
- Force preview is now TS-only end to end: the preview server no longer carries the deleted Python force backend path, and the force benchmark lives directly under `packages/layout-engine/scripts/benchmark-force.mjs`.

### Current delta — spec 005 WS5 closeout (2026-06-05)

- Spec 005 is now fully validated and closed: full TS suite green (`246/246`), retained 11-slug export sweep green, and the three high-risk browser spot-check diagrams render with zero errors.
- Browser warning context is now explicit rather than implicit: `support-engineering-flow` has no violations; `test-deep-nesting` shows 10 warnings; `request-to-hardware-stack` shows 34 `grid-align` warnings, consistent with its intentional `col_gap: 16` invariant exception.
- Active tracking no longer treats spec 005 as an open implementation slice; the next high-value TS feature should land on a fresh branch after this closeout commit.

### Current delta — spec 023 force closeout completed (2026-06-05)

- Created `specs/023-force-layout-restoration/` to restore the broken force lane under spec-kit discipline instead of mixing force work into TODO-only prose.
- The recovered force examples are now YAML-authored source files under `scripts/diagrams/force/`; archived JSON remains migration archaeology only.
- Force preview pages now use the local TypeScript runtime path directly via `/preview/layout-engine.js` and `/api/force-spec/<slug>` instead of depending on the deleted Python solver/backend.
- Added direct TypeScript ports of the historical force engine primitives in `packages/layout-engine/src/force-quadtree.ts` and `packages/layout-engine/src/force-solver.ts`, including Barnes-Hut many-body force, rectangle collision, link force, center force, and the original `ForceSimulation` alpha/velocity model.
- Replaced the ad hoc `force-runtime.ts` tick helper with a stateful preview-state wrapper mirroring the old `ForcePreviewState` contract: persistent simulation instance, node index, base-style tracking, style overrides, clamp-to-canvas, restart/reheat semantics, and snapped export.
- `browser-entry.ts` and the package root now export the full local force runtime surface, including local param updates and snapped export helpers used by the live preview.
- `scripts/preview/force.js` now keeps a committed runtime-backed snapshot separate from temporary drag/resize preview clones, so runtime-backed actions no longer lose their simulation state.
- Real geometry edits now resume the simulation correctly, including the unpin path: releasing a moved node forces an immediate local tick and then continues the run loop so the rest of the graph can react instead of staying frozen.
- Focused regression coverage now locks the closeout: `scripts/test_preview_force_api.py` covers force demo discovery, `/force/view/<slug>` route availability, `/api/force-spec/<slug>`, and TS-local save persistence through an isolated `DG_FORCE_DEFINITIONS_DIR`; `packages/layout-engine/tests/force-runtime.test.ts` now covers snapped export plus reset-to-authored-state semantics.
- Force save now posts authored spec JSON only; the preview server no longer accepts the old runtime-snapshot compatibility payload with `simulation.params`.
- Focused validation is green: `python -m pytest scripts/test_preview_force_api.py -q`, `npm --prefix packages/layout-engine test -- tests/force-runtime.test.ts`, and `node packages/layout-engine/scripts/benchmark-force.mjs --ticks 5 --sizes 10` all pass after the closeout.
- Browser validation confirms all three restored demos load on the TS runtime: `force-stakeholders`, `force-juju-landing-pages`, and `force-support-case-lifecycle`.
- Local force save now writes the current defaults and node state back to YAML, force style variants accept the shared `parent` / `section` / `annotation` vocabulary, and live stage/inspector interactions pause the running solver early enough to keep the Selection controls usable on the Juju demo.

### Current delta — spec 022 compiler scaffold started (2026-06-05)

- Added the initial TypeScript compiler scaffold under `packages/layout-engine/src/diagram-author/` with `types.ts`, `parse-yaml.ts`, and `compile.ts`.
- `compileDiagramYaml` is now exported from `packages/layout-engine/src/index.ts`, giving later spec 022 slices a stable public entrypoint before any loader integration lands.
- Added focused coverage in `packages/layout-engine/tests/diagram-author-compile.test.ts` proving authoring YAML parses into the scaffold AST shape with empty diagnostics.

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
| Now | Continue the first Mermaid-heavy direct port under **spec 030** (`sequence layout`) through TypeScript + preview-engine registry boundaries |
| Next | Keep spec 024 fail-closed on `main`, continue additive `elk-force` core work on this branch only where useful, and draft the remaining Mermaid-aware layout specs after `030` is better defined |

## Key files

| Purpose | File |
|---------|------|
| TS layout engine | `packages/layout-engine/` |
| TS SVG export | `packages/layout-engine/src/svg-render.ts`, `src/icon-embed.ts` |
| Golden SVG tests | `packages/layout-engine/tests/svg-golden.test.ts`, `tests/svg-golden-harness.ts` |
| Browser relayout | `scripts/preview/layout-bridge.js` |
| Editor UI | `scripts/preview/editor.js` |
| Preview server | `apps/preview/src/server.ts` |
| Frame YAML | `scripts/diagrams/frames/*.yaml` |
| Visual contract | `DIAGRAM.md` |
| Stakeholder how-to | `docs/stakeholder-guide.md` |

## Critical invariants

- `DIAGRAM.md` governs tokens and output constraints.  
- Deliverable SVG: Illustrator-safe (no `<symbol>`, `<use>`, external `<image href>`, marker refs).
- Headed containers: author **one gap** per container; do not reintroduce separate header/body gap controls in the inspector.
