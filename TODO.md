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
10. The current canonical output exemplar is `diagrams/2.output/svg/memory-wall-onbrand.svg`; inspect it before treating any other output as precedent.
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

### Grid engine and inside-out box model (Roadmap Stage 6)

This is the next major architectural piece. The grid engine is output-agnostic — it computes abstract layout geometry (positions, dimensions, grid arrays) in `diagram_shared.py` that both renderers (SVG and draw.io) consume. Implementation order:

- [ ] **Layer 1 – tight box height.** Add `tight_box_height(lines, has_icon)` to `diagram_shared.py`. Returns `INSET + (lines × line_step) + INSET` snapped to baseline unit. `64px` minimum only when `has_icon=True`.
- [ ] **Layer 2 – panel grid helper.** Add `panel_grid(cols, rows, col_width, row_height, col_gap, row_gap, heading_height, inset)` to `diagram_shared.py`. Returns `{"width", "height", "col_xs", "row_ys"}`. All dimensions snapped to baseline unit. Output-agnostic: no SVG or draw.io concepts.
- [ ] **Layer 3 – containment check.** Add `assert_text_fits(text_y, line_count, line_step, container_y, container_height, inset)` that raises during build if text overflows.
- [ ] **Layer 4 – refactor `build_logic_data_vram()`** as the reference implementation in both renderers: grid variables, inside-out panel sizing, tight box heights, correct typography weight hierarchy (regular for content labels, bold only for panel headings).
- [ ] **Layer 5 – roll out** grid-variable pattern to all remaining diagram functions in both renderers.
- [ ] **Typography weight audit.** Change every `make_line("Label", weight="700")` in content boxes to `make_line("Label")` (regular). Keep `weight="700"` only on panel headings and frame titles.

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
- [ ] Reconcile `README.md`, `STATUS.md`, `docs/specs.md`, and `.github/copilot-instructions.md` with the actually tracked corpus so cold-start instructions do not point at ignored files.