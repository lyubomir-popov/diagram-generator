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
6. Canonical project state lives only in `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md`.

## Architecture

### Diagram language contract

- `DIAGRAM.md` is the canonical plain-text diagram language spec. It owns tokens, rules, output constraints, and all visual-language decisions.
- `.github/copilot-instructions.md` owns workflow discipline and the anti-patch protocol.
- Workflow skills under `.github/skills/` hold repeatable procedures that reference `DIAGRAM.md` for rules.
- Do not duplicate visual rules across files. If the same rule appears in two places, delete one.

## Active TODO

### Autolayout corpus audit (PRIORITY – 2026-05-29)

Formal feature package: `specs/005-autolayout-hardening/` (`spec.md`, `plan.md`, `tasks.md`)

The level/style simplification (depth-based `_compute_level`, uniform gap=24, padding=8/0, body-wrapper no longer inheriting wrap/fill_weight/justify) changed defaults that affect layout output across the diagram corpus. Tests pass but visual correctness needs a per-diagram audit.

**What changed:**
- Default gap: was INSET (8) for panels, GRID_GUTTER (24) for wrappers → now uniform 24 for all containers
- Default padding: was INSET (8) for bordered + headed nodes, 0 for wrappers → now 8 unless borderless + headingless container
- `__body` wrapper: no longer copies `wrap`, `fill_weight`, `justify` from parent
- Grid col/row gap: was GRID_GUTTER fallback → now requires explicit YAML
- Level classification: was bottom-up 4-level (0/1/2/3) → now depth-based 3-level (0/1/2) with panel non-nesting

**Audit checklist** (user to report visual regressions per diagram):

| Diagram | Status | Issues |
|---------|--------|--------|
| android-container-vs-vm | ✅ | |
| android-custom-to-cloud | ✅ | overrides baked, border fixed |
| android-graphics-stack | ✅ | |
| android-security-comparison | ✅ | hdr_vm annotation fix, sizing reverted |
| aws-hld | ✅ | |
| complex-routing-usecase | ✅ | levels corrected |
| complex-testcase | ✅ | levels corrected |
| diagram-intake-workflow | ✅ | overrides baked |
| diagram-language-workflow | ✅ | levels corrected |
| example-deployment-pipeline | ✅ | |
| example-platform-architecture | ✅ | |
| example-stacked-blocks | ✅ | |
| gpu-waiting-scheduler | ✅ | inline styles converted |
| lightning-talk-engine | ✅ | |
| lt-a4-generator | ✅ | |
| lt-diagram-generator | ✅ | |
| maas-architecture | ✅ | inline styles converted |
| maas-machine-lifecycle | ✅ | inline styles converted |
| maas-vendor-support | ✅ | levels corrected |
| request-to-hardware-stack | ✅ | overrides baked, levels corrected |
| rise-of-inference-economy | ✅ | inline styles converted |
| simple-testcase | ✅ | levels corrected |
| support-engineering-flow | ✅ | overrides baked, inline styles converted |

### Highlight text contrast bug (from INBOX)

- [ ] `[M]` **Highlight children have black text on black fill.** In `android-security-comparison`, the "Virtualized Android" panel uses highlight style (black fill), but its child boxes render black text instead of white. The highlight variant should propagate white text/icon colour to children. Screenshot: `image-3.png`. Likely a resolved-style propagation gap – the parent's highlight semantics aren't reaching nested leaves through the style resolver.

### Variant overlays and col_span

Spec coverage: `specs/001-box-style-contract/` captures variants and tier contract foundations.

- [x] `[M]` **Variant overlays.** `variant: highlight` (black fill, white text/icon) and `variant: annotation` (borderless leaf). Explicit YAML keys override variants. Engine auto-detects leaf vs parent — no type presets needed.
- [x] `[S]` **Highlight heading propagation.** When a highlighted parent has a heading, the synthetic heading child inherits `fill: black` and white icon.
- [x] `[S]` **`col_span` field.** `Frame.col_span: int | None` added to `frame_model.py`. Parsed in `frame_loader.py`. Resolved to `width = N * col_w + (N-1) * col_gap` with `sizing_w = FIXED` in `layout_v3.py` via `_resolve_col_spans()`.
- [x] `[S]` **Tests.** 7 tests in `test_frame_loader.py` covering highlight, annotation, explicit override, backward compatibility, col_span parsing/resolution, and heading propagation.

### Overlays (cross-cutting visual groups)

- [x] `[M]` **Overlay model and rendering.** `Overlay` dataclass in `frame_model.py`, parsed from `overlays:` YAML key. Rendered as dashed bounding rect + label around member nodes. Named "overlay" (not "span") to avoid collision with `col_span`.
- [x] `[S]` **Mermaid structured testcase ports.** `simple-testcase.yaml` and `complex-testcase.yaml` recreated from canonical/mermaid examples. Complex testcase demonstrates the overlay feature.
- [x] `[S]` **Tests.** 3 tests covering overlay parsing, bounding-rect rendering, and absent-overlay backward compatibility.
- [ ] `[M]` **Mermaid structured import/export adapter.** Parse/emit the `structured-beta` DSL format for interchange with canonical/mermaid.
- [ ] `[S]` **Overlay SVG rendering.** Verify dashed rect renders correctly in SVG output (currently uses existing `Rect` primitive which supports `dashed: true`).

### Forward ontology – build pipeline integration

- [x] `[S]` **Wire `svg_meta()` into the build pipeline.** `build_v2.py` and `build_outputs.py` should pass `diagram.svg_meta()` to `render_svg()` / `write_svg()` so generated SVGs carry metadata automatically. DONE 2026-05-27.
- [x] `[S]` **Add meta validation in `frame_loader.py`.** Warn on unknown `diagram_type` or `abstraction_level` values. Allowed values should come from the JSON schema enum in `docs/diagram-schema.json`. DONE 2026-05-27.
- [ ] `[M]` **After ontology-to-layout mapping lands, use `diagram_type` + `layout_engine` to auto-select the engine.** Depends on the mapping layer from `diagram-generator-planning`.

### Interactive/editor follow-ups

- [ ] `[S]` **`preview_server.py` decomposition (post-port).** Extract file watcher, layout cache, override manager, and SSE broadcaster into focused modules. Server role shrinks to static files + save/export API.
- [ ] `[L]` **Security hardening before Stage 17.** Add schema validation for incoming JSON (`setattr` on Frame objects, override loading). Add CSRF when server becomes network-accessible. Not urgent while server is local-only.
- [ ] `[S]` **`EditorState` container.** Introduce structured state container with pure update functions and event emitter. Replace 40+ globals and overlapping override representations.

### Arrow routing redesign — port-based connection system

Full plan: `docs/architecture/arrow-routing-redesign.md`
Formal feature package: `specs/006-arrow-routing-redesign/` (`spec.md`, `plan.md`, `tasks.md`)

The current A* router has structural issues: no port model, wrong obstacle handling for nested arrows, L-only wedge fix, no crossing minimization. The redesign adds:

- **Phase 1** `[M]` Port model + `/` path syntax for nested references (e.g. `core/logging.bottom`)
- **Phase 2** `[S]` Multi-factor side inference replacing binary edge-gap heuristic
- **Phase 3** `[M]` Per-arrow obstacle set with ancestor exclusion for nested routing
- **Phase 4** `[S]` Grid channel midpoints + generalized wedge rule + direction-aware bend penalties
- **Phase 5** `[S]` Pre-compute arrow geometry in layout pass (fix renderer layer violation)
- **Phase 6** `[L]` Crossing minimization (stretch goal)

### Client-side TS rendering – spec 009 (ACTIVE)

Feature package: `specs/009-client-side-ts-rendering/`

Phases 1–3 complete (T001–T012). The preview editor renders SVG from the TS pipeline on first load. Python SVG fetch eliminated from the interactive path.

**Remaining:**
- [ ] `[S]` T013: Browser-verify remaining ~20 diagrams (3/23 done: maas-architecture, complex-routing-usecase, aws-hld)
- [ ] `[S]` T014–T015: Batch/export validation – confirm Python renderer and `/svg/` endpoint unchanged
- [ ] `[S]` T016: Grid overlay verification with TS-rendered SVG
- [ ] `[S]` T017–T019: Error handling (HarfBuzz load failure, icon fetch failure, empty diagram)
- [ ] `[X]` T020–T021: Full test suite re-run
- [ ] `[S]` T022: Final browser verification of all diagrams with edge cases

### Repo coherence and migration cleanup

Active coordination package: `specs/008-repo-coherence-rewrite/`

Current interactive state is settled: TypeScript local relayout only, YAML as authored authority, no secondary interactive executor, no v3 JSON sidecar authority, and no deprecated legacy style alias in the editor vocabulary.

- [x] `[M]` Phase 3-4 complete: doc drift collapsed across the canonical repo docs, and `docs/frame-classes.md` is the single authored source for frame-class semantics.
- [ ] `[M]` Phase 5 deferred for now: finish resolved-style snapshot cleanup and batch/export parity validation so renderers consume the same semantic contract the interactive path does.
- [x] `[M]` Phase 6 complete: interactive state cleanup verified one executor and one authority; no fallback, no `localStorage`, no JSON sidecar, and no `accent` in `docs/diagram-schema.json`.
- [x] `[M]` Phase 7 complete: Python surface classified and labeled intentionally, with orphaned `grid_helpers.py` deleted.

### Code quality — adversarial audit (2026-05-27)

Full audit: `docs/architecture/adversarial-audit-2026-05-27.md`. Two independent reviews (Opus, GPT 5.4) converged on these items.

**HIGH — structural:**
- [ ] `[H]` **H1. Layout mutates Frame tree.** `col_span` rewrites `width`/`sizing_w`; FILL/HUG coercion rewrites parent sizing; root width save/mutate/restore is fragile. Fix: layout-only derived fields, stop mutating semantic Frame fields.
- [x] `[H]` **H2. Style resolution duplicated (loader vs renderer).** FIXED — `resolveStyles()` ported to TS (`resolve-styles.ts`), `_frameBoxRenderState()` rewritten to consume resolved values. Remaining migration closure in spec 007 Phases 5–7.
- [ ] `[H]` **H3. Heading synthetic child incomplete.** `__body` no longer copies `wrap`, `fill_weight`, `justify` from parent (deliberately removed in the depth-based simplification). If any diagram relied on these being inherited, it will regress. Needs corpus audit to determine whether explicit YAML fields are needed on affected diagrams.
- [x] `[H]` **H4. Overlay geometry contradicts model.** Full-width band vs member bounds. FIXED — now uses member bounds.
- [ ] `[M]` **H5. Leaf measure vs render padding mismatch.** Measurement uses INSET, rendering uses per-side padding + 1px hack. Fix: use `frame.padding_*` in measurement.

**MEDIUM — code quality:**
- [x] `[M]` **M1. `_lines_to_dicts()` duplicated.** Two copies in `layout_v3.py` and `diagram_layout.py`. FIXED — v3 copy deleted, imports from `diagram_layout.py`.
- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [x] `[S]` **M3. `padding: 0` truthiness bug.** `or` chain treats explicit 0 as false. FIXED.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`. (Overlays now serialised via T002.)
- [ ] `[S]` **M6. `estimate_line_width` duplicated.** `diagram_shared.py` vs `text_metrics.py`.

**Mermaid testcase accuracy:**
- [x] `[M]` **T1. complex-testcase.yaml was hybrid.** FIXED — split into faithful reproductions of source drawio files.

**Test gaps:**
- [ ] `[M]` Arrow routing tests
- [ ] `[S]` Constrained re-measurement tests
- [ ] `[S]` Layout idempotency test
- [ ] `[S]` Negative parser tests for invalid enums
- [x] `[S]` Overlay geometry test (now checks coordinates)

### Force ↔ grid editor unification

Goal: the force and grid editors share one editor shell; swapping the layout engine should not duplicate interaction code. Items ordered by user-facing impact. Unified shell + stage interaction parity + persistence/undo done — see HISTORY.md.

**Open items:**

- [ ] `[S]` **Swappable engine interface — Phase 3+.** Create concrete `GridEngine` / `ForceEngine` adapter subclasses implementing `EngineAdapter`. Wire shared interaction code through the adapter contract. *(Phase 1 interface + Phase 2a shared primitives + Phase 2b shared snap are done.)*
- [ ] `[S]` **Constraint enforcement.** Run the same fill/stroke/highlight-limit/containment checks on force nodes and display violations in the sidebar.
- [ ] `[S]` **Arrow waypoint editing.** Allow dragging force-link control points interactively, with double-click to add/remove.
- [ ] `[S]` **Arrow endpoint attachment.** Force links should follow node moves via side-aware offset instead of recalculating from scratch.
- [ ] `[S]` **Consistent stroke/outline weight.** Normalize force preview SVG viewBox so 1px strokes match the grid editor's visual weight.
- [ ] `[S]` **Force → frame YAML round-trip.** Decide how force-preview exports feed back into `scripts/diagrams/frames/*.yaml`.
- [ ] `[L]` **Grid overlay toggle (W).** Decide whether force preview needs a baseline-grid overlay.
- [ ] `[L]` **Double-click depth cycling.** Decide whether force nodes need a depth-drill concept (probably N/A for flat graphs).

### Ongoing maintenance

- [ ] `[S]` Manual draw.io desktop smoke test for `diagrams/2.output/draw.io/*-onbrand.drawio` and `assets/drawio/diagram-generator-primitives.mxlibrary` when draw.io is available locally.
- [ ] `[S]` Manual Illustrator desktop smoke test for the SVG batch when Illustrator is available locally.
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear.
- [ ] `[S]` Re-audit generator helpers when the starter block changes, to prevent drift back into mixed inset or line-height rules.
- [ ] `[S]` Keep preview-shell experiments on the vendored BF application shell unless there is an explicit repo-wide reason to introduce new preview CSS.

### fill_weight vs grid-column alignment

- [x] `[M]` **~~fill_weight panels snap to grid columns.~~** DONE 2026-05-27 — When a diagram has explicit `grid.cols` + `grid.col_gap`, FILL children with fill_weights snap to integer column spans using largest-remainder allocation. 3 unit tests. Browser-verified on example-stacked-blocks and aws-hld.

### Interactive element creation

- [ ] `[L]` **Add box/arrow UI with reparenting.** Research Figma's interactive canvas approach to adding elements and moving them into/out of parent containers. Plan proper architecture for add/delete of boxes and arrows, including reparenting (drag into a parent). No quickie implementation – full architectural planning and feature integration. Requires: element creation panel or drag-to-create, hit-testing for drop targets, parent/child relationship editing, undo support.

### Undo history

- [x] `[M]` **~~Ctrl+Z undo/redo (20 levels).~~** Already implemented — 50-level stack with Ctrl+Z/Ctrl+Y keybindings, full state serialization (overrides + grid overrides), override-patch commands, and UI buttons.

### Component model – uniform treatment of all node types (PRIORITY – Roadmap Stage 10a)

**Audit:** `docs/architecture/component-model-audit.md` – 61 type-branching points classified. 16 capability exclusions, 3 missing abstractions.

**Principle:** Every Frame participates equally in layout, selection, and inspection regardless of its `role`. Adding a new component type requires a role value, natural-size defaults, and a render dispatch case – zero changes to selection, inspector, drag, override, or serialisation code.

Phase 1 (type-agnostic selection) complete — see HISTORY.md 2026-05-25.

- [x] `[H]` **Phase 2 – Heading as a child, not a field.** Convert `heading` from a magic Frame field to an auto-generated first child with `role: "heading"`. ~~Remove `_heading_height()` from `measure()`. Breaking YAML schema change – needs migration of all 24 frame YAMLs.~~ DONE 2026-05-26 — Loader transformation injects synthetic `__heading` child (and `__body` wrapper for horizontal parents). `min_height` constraints applied during both measure passes. All 191 Python tests pass. Browser-verified on test-nested-containers, aws-hld, android-container-vs-vm. Old heading functions (`_heading_height`, `_heading_text_max_w`, `_leaf_all_lines`) are now dead code (frame.heading is always None) — cleanup deferred to Phase 2b.
- [x] `[S]` **Phase 2b – Dead heading code cleanup.** DONE 2026-05-27 — Removed `_heading_height()`, `_heading_text_max_w()`, heading references from `_leaf_all_lines()`, and all `heading_h`/`heading_gap` calculations from measure/propagate/place/render in both Python and TS engines. Added `clampToConstraints` to TS leaf measure for min_height parity. Updated all tests and parity fixtures. 191 Python + 175 TS tests pass.

- [ ] `[M]` **Phase 3 – Box interior as component layout.** Icon and text become internal layout children, not coordinate-positioned. Eliminates the bold-text-overflow bug class.

### Box icon/text layout (PRIORITY)

**Problem:** Icon and text positioning inside leaf boxes is done with coordinate arithmetic, not component-level layout. The icon is placed at top-right (`x + w - pad_r - ICON_SIZE`) and text at top-left (`x + pad_l`), with `text_max_width = w - pad_l - pad_r - icon_col` to prevent overlap. But:
- The text `max_width` constraint only controls wrapping – SVG `<text>` elements don't clip, so if the font-metric estimate underestimates a word's width, text visually overflows into the icon zone
- Heading text (bold, `weight: 700`) at the same font size is physically wider per character than regular text, but the width estimator doesn't account for bold weight, causing heading words to extend under the icon
- The icon column reservation is correct in `_leaf_natural_size()` and `_render_frame()`, but the underlying issue is that text width estimation is approximate while SVG rendering is exact

**Clean fix (component-level):** Treat the box interior as a two-column horizontal layout at the component level:
1. Icon column: FIXED width (`ICON_SIZE` = 48px), right-aligned
2. Text column: FILL (takes remaining width)
3. Text wrapping uses the resolved FILL width, not an estimated max

This matches the user's intent: icon is fixed width and height, text fills the remainder – done at component level, not with coordinate arithmetic.

- [x] `[H]` **Fix text width estimation for bold text.** ~~The `_estimate_text_width()` function uses a single `CHAR_WIDTH_ESTIMATE` regardless of font weight.~~ DONE 2026-05-26 — weight-aware `measure_text_width()` using fontTools `getGlyphSet(location={"wght": weight})` in both Python (`text_metrics.py`, `diagram_shared.py`) and TypeScript (`text-measure.ts`, `canvas-text-adapter.ts`). Arrow labels in `diagram_layout.py` also updated.
- [ ] `[M]` **Refactor box interior as component layout.** Replace the coordinate-arithmetic approach with a proper two-column internal layout: icon column (FIXED, 48px) + text column (FILL, remainder). Text wrapping should use the resolved fill width. This eliminates the class of bugs where estimated width ≠ rendered width.

### Grid overlay width bug ~~(recurring)~~ — FIXED 2026-05-26

~~**Problem:** The grid overlay columns sometimes cover only a fraction of the diagram width.~~

**Root cause (confirmed):** `_build_grid_info()` snapped each column width down to `BASELINE_UNIT` (8px), accumulating rounding loss. With 4 columns and gaps, up to 28px of slack was absorbed by `resolved_right_margin`, making the grid overlay visually narrower than the diagram.

**Fix:** The last column now absorbs the rounding remainder so `resolved_right_margin` always equals `outer_margin`. Verified across all 20+ frame YAMLs.

- [x] `[M]` **~~Debug grid overlay width mismatch.~~** DONE 2026-05-26.

### Arrow routing overhaul (Roadmap Stage 10b – separate milestone)

This is an algorithm problem (obstacle avoidance, port assignment), not a structural/model problem. Independent of the component model work in Stage 10a. Full research plan and implementation details are in `ROADMAP.md` → Stage 10b.

- [x] `[H]` **R1: Study draw.io's orthogonal router** — DONE 2026-05-26. See findings below.
- [x] `[H]` **R2: Study ELK** — DONE 2026-05-26. See findings below.
- [ ] `[M]` **R3: Survey other approaches** (dagre, Graphviz, reactflow, JointJS, visibility graph) — lower priority now that R5 MVP is done
- [ ] `[M]` **R4: Write design doc** (algorithm selection, nesting, integration, performance) — lower priority now that R5 MVP is done
- [x] `[H]` **R5: Implement MVP obstacle-aware router** — DONE 2026-05-26. A*-based on sparse orthogonal grid. 12px clearance, bend penalty, path simplification. 6 unit tests. All 16 arrow diagrams route successfully.

**R1 findings (draw.io `mxEdgeStyle.OrthConnector`):**
- ~500 lines. Pattern-based router using precomputed `routePatterns` lookup table indexed by source/target direction and quadrant.
- Side inference: determines exit/entry directions from port constraints and relative positioning (quadrant-based).
- Jetty/buffer: configurable `orthBuffer` (default 10px) creates clearance around terminals.
- Falls back to `SegmentConnector` (simpler segment-following router) when source/target are too close or have user-defined control points.
- **No general obstacle avoidance.** The algorithm only considers the source and target terminals — intermediate boxes are ignored. draw.io relies on user-placed waypoints for manual obstacle routing.
- **Port constraints:** supports directional masks (NSEW) per terminal. Good model for our `component_id.side` syntax.
- **Takeaway:** The pattern-based approach is clever for pairwise routing but insufficient for our needs (nested containers, many arrows). We need obstacle-aware routing.

**R2 findings (ELK Layered):**
- Full Sugiyama-style layered layout with 5 phases: cycle breaking → layering → crossing minimization → node placement → edge routing.
- **Compound graph support:** native handling of nested containers with cross-hierarchy edges — directly relevant to our Frame tree.
- **Orthogonal edge routing:** separate phase after node placement. Uses channel routing between layers with edge spacing.
- **Port constraints:** rich model (FREE, FIXED_SIDE, FIXED_ORDER, FIXED_POS) — maps well to our side-hint syntax.
- **Overkill for our use case:** ELK wants to own node placement. We already have a layout engine. We only need the edge routing phase, not the full Sugiyama pipeline.
- **elkjs:** WebAssembly/JS port exists, ~400KB. Could use it for edge routing only, but API assumes it owns the whole layout.
- **Takeaway:** ELK's edge routing phase is the gold standard for layered diagrams, but extracting just the routing from ELK is impractical. Better to implement a simpler obstacle-aware router inspired by ELK's channel-based approach.

**Current router:** A*-based obstacle-aware orthogonal router (~200 lines). Builds sparse grid from inflated box edges, runs A* with bend penalty, simplifies collinear points. Source/target boxes excluded from obstacle set per arrow. 12px clearance margin. Replaces the naive midpoint router.

### Legacy size overrides (dw/dh)

**What `dw`/`dh` are:** delta-width and delta-height — pixel adjustments stored in override JSON files. When a user drag-resizes a box in the editor, the override records the difference from the engine-computed size. `dw=4` means "4 pixels wider than the layout engine computed." These are applied at render time: `effective_width = engine_width + dw`.

- [x] `[S]` **~~Audit and clear stale dw/dh overrides.~~** DONE 2026-05-26 — Audited all override JSON files. No dw/dh entries found; all overrides are position-only (dx/dy) or style overrides.

