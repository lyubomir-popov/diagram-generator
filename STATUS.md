# Status

## Before you start generating diagrams

**Read the playbook first.** Do not skip this step:

1. Read `DIAGRAM.md`
2. Review "Non-negotiable diagram rules" in `.github/copilot-instructions.md`

Critical rules:

- **Fills:** white, `#F3F3F3` grey, or one black emphasis box — no other colors
- **Orange `#E95420`:** arrows only — never boxes
- **Icons:** use `assets/icons/` only — do not source new ones
- **After adding diagrams:** update `scripts/build_compare_pages.py` PAIRS list, then run `python scripts/build_compare_pages.py`

## What this repo is

`diagram-generator` is the active workspace for rebuilding rough sketches and inconsistent diagrams into on-brand, editable draw.io and SVG outputs. It owns the current diagram rules, the batch renderers, and the review artifacts for the refreshed starter-block system.

## Current state

Several paths below refer to locally generated or team-internal assets that are gitignored. Run the build to create them.

There are now **two diagram generation pipelines**. On a cold start, ask the user which pipeline to work on.

### Pipeline 1: imperative (stable)

- Builder: `scripts/generate_remaining_diagrams.py`
- Entry point: `python scripts/build_outputs.py`
- Outputs: `*-onbrand.svg`, `*-onbrand.drawio`
- All 9 diagrams are content-complete against their input sketches.

### Pipeline 2: declarative grid (experimental)

- Definitions: `scripts/diagrams/*.py`
- Model: `scripts/diagram_model.py` — component types (`Box`, `Panel`, `Arrow`, `Annotation`, `JaggedPanel`, `IconCluster`, etc.) with `Border` enum and `GridSpec`.
- Layout engine: `scripts/diagram_layout.py`
- Entry point: `python scripts/build_v2.py`
- Outputs: `*-onbrand-v2.svg`, `*-onbrand-v2.drawio`
- **Component library refactored:** all 9 definitions use the new canonical types. Deprecated types (`Helper`, `IconComponent`, `RequestCluster`, `MemoryWall`) are still importable but no longer used in definitions.

### Validation tools

- `python scripts/_compare_3way.py` — Playwright 3-way comparison: input sketch → v1 → v2
- `python scripts/_audit_v2.py` — SVG element count audit (orange elements, texts, rects, icons)
- `python scripts/_compare_all.py` — v1 vs v2 side-by-side comparisons

### v2 defect summary (April 2026)

| Diagram | Status |
|---|---|
| attention-qkv | OK – matrix tiles + fan-out arrows rendering |
| gpu-waiting-scheduler | MINOR – 1 orange element short |
| inference-snaps | OK |
| logic-data-vram | MINOR – missing "GPU" label |
| memory-wall | OK |
| request-to-hardware-stack | OK |
| rise-of-inference-economy | OK |

## Architecture status

The project has evolved from a batch diagram generator into a **constrained interactive diagram editor** – a lean Figma/draw.io that enforces brand rules while allowing targeted polish. The 4-phase architectural refactor is complete:

- **Phase A (done, commit 2eff23d):** `BoxStyle` enum, YAML/JSON diagram loader, JSON schema for agent-generated definitions.
- **Phase B (done, commit 6b7ba57):** Viewer JS/CSS/HTML extracted from the Python f-string monolith into `scripts/preview/`. Server is now 485 lines (was 2672). Static files served at `/preview/*`.
- **Phase C (done, commit d763e3a):** `ComponentModel` class with indexed tree, parent/child navigation, override management. `InteractionManager` state machine skeleton. Old globals backed by model/manager.
- **Phase D (done, commit 35cfb85):** Constraint enforcement system with 6 built-in brand constraints (grid alignment, approved fills, highlight limit, orange reservation, containment). Violations shown in sidebar and per-component inspector.

**Current frontend architecture:**
- `scripts/preview/component-model.js` – `ComponentModel` + `ComponentNode` tree with indexed lookup, `InteractionManager` state machine
- `scripts/preview/constraints.js` – `ConstraintRegistry` with pluggable constraint functions
- `scripts/preview/editor.js` – interaction handlers, DOM sync, sidebar UI
- `scripts/preview/editor.css` – all viewer styles
- `scripts/preview/viewer.html` – HTML template with `%TITLE%`, `%NAV_LINKS%`, `%CONFIG_SCRIPT%` placeholders
- `scripts/preview_server.py` – pure API server (485 lines), no embedded JS

**Remaining interactive editor work** (post-refactor):
- Parent-child constraint propagation (resize parent → resize children)
- Auto-layout fill (resize one child → redistribute siblings)
- Baseline alignment guide (visual snap targets during drag)
- Command pattern for granular undo/redo (deferred; snapshot approach works)

**Current TODO categorisation:** All Category 1 (defects) and Category 2 (safe features) items are now complete. Remaining open items are Category 3 – features that require the JS extraction (Stage 11) before they can be implemented cleanly.

- **The repo now uses the centralized root workflow.** `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md` are the canonical workflow files.
- **A design.md-inspired diagram language spec now exists.** `DIAGRAM.md` holds the canonical tokens, prose rules, output constraints, and redraw workflow for diagram work instead of keeping that material in `TODO.md`.
- **Optional workflow skills now have a clear home.** `.github/skills/` is the repo location for on-demand workflow skills such as redraw, build-and-validate, and protected draw.io review procedures.
- **Draw.io is the primary editable output target.** `scripts/build_outputs.py` generates draw.io first into `diagrams/2.output/draw.io/`, then regenerates the matching SVG batch in `diagrams/2.output/svg/`.
- **Both renderers now share one primitive layer.** `scripts/diagram_shared.py` carries the shared tokens, icon loading, text metrics, terminal chrome helpers, and matrix helpers used by both renderers.
- **The current output batch is already rebuilt on the refreshed starter-block system.** `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `attention-qkv-onbrand.svg`, `logic-data-vram-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, and `gpu-waiting-scheduler-onbrand.svg` all live under `diagrams/2.output/svg/`, with matching editable draw.io exports under `diagrams/2.output/draw.io/`.
- **A workflow explainer diagram now documents the intake lane.** `diagram-intake-workflow-onbrand.svg` and `diagram-intake-workflow-onbrand.drawio` show the current ChatGPT input, the open PM intake-question lane, the repo workflow, compare mode, the manual draw.io polish step, and final SVG output; the review lane also includes `diagrams/1.input/diagram-intake-workflow-rough.svg` and `diagrams/3.compare/html/diagram-intake-workflow.html`.
- **A second workflow explainer now documents the spec-led lane.** `diagram-language-workflow-onbrand.svg` and `diagram-language-workflow-onbrand.drawio` show rough sources, local references, `DIAGRAM.md`, the new workflow skills, the generators, the compare and review lane, and clean outputs ready for design-language token ingestion; the review lane also includes `diagrams/1.input/diagram-language-workflow-rough.svg` and `diagrams/3.compare/html/diagram-language-workflow.html`.
- **A forked comparison variant now carries the first diagram-tier pilot.** `inference-snaps-dense-onbrand.svg` and `inference-snaps-dense-onbrand.drawio` reuse the same source as `inference-snaps`, widen the side-by-side tiles, switch the major inter-column and inter-row gaps to the `24px` application gutter, derive row placement from actual box heights, and now pilot `16px` / `20px` main copy so text stays proportionate to the standard `48px` icons.
- **Generated draw.io cells now carry provenance and style tokens.** Exported `mxCell` nodes now include `data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, and matching `tags` metadata so generator-owned cells can be distinguished from manual additions and batch-targeted by future tools.
- **A tracked reusable draw.io library now exists.** `scripts/export_drawio_library.py` writes `assets/drawio/diagram-generator-primitives.mxlibrary` with the canonical default box, accent box, highlight box, helper note, connector, terminal bar, matrix widget, memory-wall panel, and grouped panel primitives.
- **Token-aware style sync is now available.** `scripts/drawio_style_sync.py` can batch rewrite tokenized draw.io style fields such as `spacingTop`, connector properties, and dash patterns across generated diagrams.
- **The manually polished draw.io lane already drifts from generator structure.** Files in `diagrams/2.output/draw.io/manually-edited/` and `memory-wall-onbrand-edited-in-drawio.drawio` flatten some generated parent/child structures, adjust text spacing directly on cells, and introduce one-off local edits that cannot be safely regenerated over today.
- **Protected manual draw.io edits now use review copies.** `scripts/drawio_review_workflow.py` prepares mirrored review copies under `diagrams/2.output/draw.io/review/` and promotes them back only after checkpointing the original into `diagrams/2.output/draw.io/checkpoints/`.
- **Declarative diagram architecture is complete (Stage 6a, all steps done).** `scripts/diagram_model.py` defines typed component trees (Box, Panel, Bar, Terminal, Arrow, Helper, MatrixWidget, MemoryWall, RequestCluster, Legend, IconComponent). `scripts/diagram_layout.py` uses Müller-Brockmann explicit grid placement: every component carries `(col, row, col_span, row_span)` and the GRID arrangement computes column widths and row heights from content, then positions each component in its grid cell. VERTICAL and HORIZONTAL arrangements also supported. All 9 diagrams converted to declarative definitions under `scripts/diagrams/`, each producing both SVG and draw.io output with 0 baseline grid violations.
- **Canvas constraints and auto-fill now available.** `Diagram` supports `canvas_width`, `canvas_height`, and `uniform_rows`. Canvas width auto-derives equal column widths. Auto-fill propagates sizing to sub-panels, eliminating manual nesting tax math. See "Sizing constraints" and "Auto-fill" sections in `DIAGRAM.md`.
- **Playwright visual validation is now part of the build.** `scripts/visual_compare.py` renders generated SVGs and manual reference rasters side by side, produces combined comparison PNGs, pixel diff heatmaps, and diff percentages. Wired into `build_outputs.py` as the final step (skip with `--no-visual`).
- **Body text is now 18px/24px.** `diagram_shared.py` and `DIAGRAM.md` are updated. All outputs rebuilt at the new size.
- **Bars auto-size from content.** Layout engine computes minimum bar height from `INSET + text_height + INSET` so text has balanced top/bottom padding; the model's `height` field is now a floor, not a fixed value.
- **Baseline grid validator is live.** `validate_grid(result)` in `diagram_layout.py` checks all Rect, Icon, TextBlock, Arrow, and Canvas coordinates against the 4px grid. Bar segment `width_px` values must be multiples of 4.
- **Review remains the main open lane.** The remaining work is Illustrator and draw.io import validation, plus finishing the propagation of the newly imported typography, spacing, and grid tokens into draw.io style sync and any remaining renderer defaults.

## Current execution plan

- Ingest typography, spacing, and grid specs from the broader design language into `DIAGRAM.md`, then map them into `scripts/diagram_shared.py` and draw.io style sync.
- Current sync slice: keep the imported dense application/doc baseline for grid and spacing, but evaluate whether the new diagram-tier pilot should replace the `14px` reference body size with `16px` / `20px` main copy for diagram labels that sit beside `48px` icons.
- Current sync slice: replace the hard-coded `8px` grid assumptions in the shared helpers with spec-derived tokens and derived box-height math so text, icons, and borders land on whole baseline units.
- Import-test the current `diagrams/2.output/draw.io/*-onbrand.drawio` batch and the tracked `assets/drawio/diagram-generator-primitives.mxlibrary` in draw.io, and note any renderer mismatches versus the SVG canonicals.
- Pilot the protected review-copy workflow on one or two manually edited draw.io files.
- Re-audit the refreshed starter-block SVG batch in Illustrator.
- Keep refining `DIAGRAM.md` as more diagram types appear.
- Re-audit the shared generator helpers whenever the starter block changes so the outputs do not drift.

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
| Shared tokens and helpers | `scripts/diagram_shared.py` |
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
| Shared primitive source | `scripts/diagram_shared.py` |
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
- For new work, keep the `192px` / `64px` / `8px` / `48x48` block system and the imported dense spacing baseline, but treat `14px` / `20px` as the current reference tier and `16px` / `20px` as the active pilot tier for grouped layouts where text-to-icon proportion needs retuning.
- Prefer hierarchy by weight before hierarchy by size; move from `14px` regular to `14px` strong and small-caps, then `18px/24px`, then `24px/32px` only when the smaller ladder is not enough.
- Orange is reserved for connectors and arrowheads only; boxes stay white or `#F3F3F3`, with at most one black emphasis box when clearly justified.
- Orange connectors should run edge-to-edge, midpoint-to-midpoint, behind the destination box, using literal line-plus-triangle geometry.
- `diagrams/2.output/svg/memory-wall-onbrand.svg` is the canonical implementation checkpoint for palette, icon placement, side-icon clusters, and overall scale.
- The `Memory wall` node remains the one semantic exception that keeps jagged top and bottom edges.
- Use a `4px` baseline unit for snapping heights and line steps; most visible block geometry still moves in `8px` rhythm increments.

## Next session should

- Start by reading this file.
- Read `DIAGRAM.md` before changing diagram behavior.
- Drain `INBOX.md`.
- Drain `AGENT-INBOX.md`.
- Continue from `TODO.md`.
- Read `docs/specs.md` before changing spec-governed behavior.