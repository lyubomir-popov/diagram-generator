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

### Pipeline 1: imperative (original v1 batch)

- Builder: `scripts/generate_remaining_diagrams.py`
- Entry point: `python scripts/build_outputs.py`
- Outputs: `*-onbrand.svg`, `*-onbrand.drawio`
- Maintained for the existing v1 output batch in the canonical corpus; useful for parity checks and legacy exports, but no longer the main development surface.

### Pipeline 2: declarative grid (current active surface)

- Definitions: `scripts/diagrams/*.py`
- Model: `scripts/diagram_model.py` — component types (`Box`, `Panel`, `Arrow`, `Annotation`, `JaggedPanel`, `IconCluster`, etc.) with `Border` enum and `GridSpec`.
- Layout engine: `scripts/diagram_layout.py`
- Entry point: `python scripts/build_v2.py`
- Outputs: `*-onbrand-v2.svg`, `*-onbrand-v2.drawio`
- **Component library refactored:** the current declarative corpus uses the new canonical types. Deprecated types (`Helper`, `IconComponent`, `RequestCluster`, `MemoryWall`) are still importable but no longer used in active definitions.
- **Active surface:** this is where the declarative model, build-time validators, interactive editor, and Baseline Foundry preview integration now evolve.

### Validation tools

- `python scripts/_compare_3way.py` — Playwright 3-way comparison: input sketch → v1 → v2
- `python scripts/_audit_v2.py` — SVG element count audit (orange elements, texts, rects, icons)
- `python scripts/_compare_all.py` — v1 vs v2 side-by-side comparisons
- `python scripts/svg_illustrator_sanitize.py` — Illustrator-safety sanitizer for deliverable SVGs

### v2 defect summary (April–May 2026)

| Diagram | Status |
|---|---|
| attention-qkv | OK – matrix tiles + fan-out arrows rendering |
| gpu-waiting-scheduler | OK |
| inference-snaps | OK – content-width alignment verified |
| logic-data-vram | OK |
| memory-wall | OK |
| request-to-hardware-stack | OK – content-width alignment verified |
| rise-of-inference-economy | OK |
| lt-diagram-generator | OK – lightning talk pipeline diagram |
| lt-a4-generator | OK – lightning talk pipeline diagram |
| lt-summit-identity | OK – lightning talk pipeline diagram |

### Output validation checkpoint (May 2026)

- Generated draw.io XML is structurally clean across the current batch: all audited files parse, keep `adaptiveColors="none"`, and every generated edge now carries both `source` and `target` ids.
- v2 draw.io exports now preserve semantic edge attachments for matrix widgets, terminal bars, jagged memory-wall panels, and other connectable component cells.
- The legacy `memory-wall-onbrand.drawio` separator is now emitted as a line shape instead of an unattached decorative edge.
- Build entrypoints now treat `diagrams/2.output/svg/` as the only canonical SVG lane and prune stale legacy duplicates left directly under `diagrams/2.output/`.
- `svg_illustrator_sanitize.py` dry-run checks passed across 31 generated SVG outputs.
- `_audit_v2.py` now reports the audited canonical diagrams as OK, including `attention-qkv` after the heading text was realigned to the v1 baseline.
- **Arrow crossing validation** added to the build: `validate_arrow_crossings()` checks every arrow segment against all component boxes (excluding source, target, and shared ancestor panels). Build fails on any crossing.
- **Arrow obstacle avoidance** rewritten for full-width panels: vertical arrows now route around panels that span the entire diagram width.
- `build_v2.py` currently exits nonzero on 6 existing arrow-clearance violations across `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, and `lt-summit-identity`; baseline-grid warnings also remain across several older diagrams and are warning-only.
- Native draw.io desktop import/export and Illustrator desktop smoke tests were not run in this environment.

### Layout engine (May 2026)

- **Content-width alignment:** Two-pass VERTICAL layout separates content width from outer width. Panels with borders wrap content with INSET padding; standalone boxes align to the panel's inner content corridor. All 4 vertical diagrams (request-to-hardware-stack, inference-snaps, diagram-intake-workflow, diagram-language-workflow) have flush right edges.
- **col_span/row_span:** Boxes inside panels can span multiple grid columns without explicit width overrides.
- **BOX_MIN_HEIGHT enforcement:** Single-line boxes without icons are clamped to 64px minimum.
- **Preview slot metadata:** Client-side relayout now uses server-declared `col` / `row` / span metadata plus measured gutters instead of inferring grouped slots back from child geometry.
- **BASELINE_UNIT = 8px**, **GRID_GUTTER = 24px**, **OUTER_MARGIN = 24px**, **BODY_SIZE = 18px**.
- **Autolayout review status (2026-05-13):** The durable docs now define a parent-scoped equal-split/outdent model for grouped layouts. Current implementation is improved but still mixed: separator rows now stay thin, arrow labels now have a free-positioned primitive, measured child gutters now reach the preview component tree, and preview relayout now consumes declared slots/spans instead of reconstructing them from geometry; the remaining gap is that split/outdent math is still duplicated between `scripts/diagram_layout.py` and `scripts/preview/component-model.js`.

## Architecture status

The project has evolved from a batch diagram generator into a **constrained interactive diagram editor** – a lean Figma/draw.io that enforces brand rules while allowing targeted polish. The 4-phase architectural refactor is complete:

- **Phase A (done, commit 2eff23d):** `BoxStyle` enum, YAML/JSON diagram loader, JSON schema for agent-generated definitions.
- **Phase B (done, commit 6b7ba57):** Viewer JS/CSS/HTML extracted from the Python f-string monolith into `scripts/preview/`. Server is now 485 lines (was 2672). Static files served at `/preview/*`.
- **Phase C (done, commit d763e3a):** `ComponentModel` class with indexed tree, parent/child navigation, override management. `InteractionManager` state machine skeleton. Old globals backed by model/manager.
- **Phase D (done, commit 35cfb85):** Constraint enforcement system with 6 built-in brand constraints (grid alignment, approved fills, highlight limit, orange reservation, containment). Violations shown in sidebar and per-component inspector.

**Current frontend architecture:**
- `scripts/preview/component-model.js` – `ComponentModel` + `ComponentNode` tree with indexed lookup, `InteractionManager` state machine
- `scripts/preview/constraints.js` – `ConstraintRegistry` with pluggable constraint functions
- `scripts/preview/editor.js` – interaction handlers, DOM sync, sidebar UI, BF-tabbed `Input` / `Output` / `Both` compare modes, 2-state grid overlay toggle, prev/next chevron navigation
- `scripts/preview/editor.css` – editor-specific styling, 3-column layout (left sidenav, main stage, right aside), BF-aware shell overrides, BF tabs compare-strip integration, forced single-row desktop shell pinning, preview-owned amber selection chrome, overflow scrolling on all panels
- `scripts/preview/viewer.html` – HTML template with `%TITLE%`, `%NAV_LINKS%`, `%CONFIG_SCRIPT%`, and optional `%BF_STYLES%` placeholders; left nav uses BF side-navigation for component tree
- `scripts/preview_server.py` – pure API server (serves the repo-owned vendored Baseline Foundry `os` tier CSS and font assets from `assets/baseline-foundry/`), watches HTML/CSS/JS for hot-reload, no embedded JS

**Cold-start / portability status:** the preview ships a vendored BF `os` tier stylesheet and Ubuntu Sans snapshot under `assets/baseline-foundry/`, so fresh clones do not depend on the private repo at runtime and do not vary based on a sibling checkout. The editor shell is back on the BF `navigation + main + aside` contract with local left/right resize bindings; the left navigation resize affordance is now owned locally in `scripts/preview/editor.css` because BF `os` no longer ships that selector. The desktop shell is also pinned locally to a single-row `navigation + main + aside` grid so upstream BF layout rules cannot reintroduce the broken extra top row, and the editor keeps DG-owned amber selection handles instead of depending on BF authoring-accent variables. The remaining editor work is undo/redo specialization rather than shell portability.

**Windows smoke pass complete (2026-05-11).** The BF-backed preview shell now has a post-reboot Windows check: the local server index and `/view/example-data-processing` editor page both load correctly, the desktop shell still resolves to a left-navigation / main-stage / right-inspector single-row layout, and the live stage still exposes the full resize-handle set after selecting a component.

**Preview compare mode status:** when a diagram has a tracked rough sketch under `diagrams/1.input/`, the main editor area now exposes BF tabs for `Input`, `Output`, and `Both`; `Both` is a real 2-up center-pane layout rather than the older one-above-the-other reference strip.

**Remaining interactive editor work** (post-refactor):
- Domain-specific undo/redo follow-up (deferred; undo/redo now uses explicit per-action command records, but each command still stores before/after editor state rather than bespoke do/undo handlers)

**Browser-verified (May 2026):** snap guides, layout metadata in inspector, icon re-anchor on resize, parent→child grid propagation, and multi-select distribute/align in the preview inspector. All audit bugs fixed (commits `51535bf`, `dec8160`).

- **The repo now uses the centralized root workflow.** `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md` are the canonical workflow files.
- **A design.md-inspired diagram language spec now exists.** `DIAGRAM.md` holds the canonical tokens, prose rules, output constraints, and redraw workflow for diagram work instead of keeping that material in `TODO.md`.
- **`DIAGRAM.md` now exposes a spec -> token -> tool bridge.** Its `sourceSpecs:` frontmatter links typography, spacing, and grid back to `canonical-specs`, so the diagram tier has explicit upstream provenance instead of chat-only context.
- **Optional workflow skills now have a clear home.** `.github/skills/` is the repo location for on-demand workflow skills such as redraw, build-and-validate, and protected draw.io review procedures.
- **Draw.io is the primary editable output target.** `scripts/build_outputs.py` generates draw.io first into `diagrams/2.output/draw.io/`, then regenerates the matching SVG batch in `diagrams/2.output/svg/`.
- **Both renderers now share one primitive layer.** `scripts/diagram_shared.py` carries the shared tokens, icon loading, text metrics, terminal chrome helpers, and matrix helpers used by both renderers.
- **The current output batch is already rebuilt on the refreshed starter-block system.** `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `attention-qkv-onbrand.svg`, `logic-data-vram-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, and `gpu-waiting-scheduler-onbrand.svg` all live under `diagrams/2.output/svg/`, with matching editable draw.io exports under `diagrams/2.output/draw.io/`. Legacy root-level `diagrams/2.output/*.svg` copies are stale and are now pruned by the build entrypoints.
- **A workflow explainer diagram now documents the intake lane.** `diagram-intake-workflow-onbrand.svg` and `diagram-intake-workflow-onbrand.drawio` show the current ChatGPT input, the open PM intake-question lane, the repo workflow, compare mode, the manual draw.io polish step, and final SVG output; the review lane also includes `diagrams/1.input/diagram-intake-workflow-rough.svg` and `diagrams/3.compare/html/diagram-intake-workflow.html`.
- **A second workflow explainer now documents the spec-led lane.** `diagram-language-workflow-onbrand.svg` and `diagram-language-workflow-onbrand.drawio` show rough sources, local references, `DIAGRAM.md`, the new workflow skills, the generators, the compare and review lane, and clean outputs ready for design-language token ingestion; the review lane also includes `diagrams/1.input/diagram-language-workflow-rough.svg` and `diagrams/3.compare/html/diagram-language-workflow.html`.
- **A forked comparison variant remains useful for comparison.** `inference-snaps-dense-onbrand.svg` and `inference-snaps-dense-onbrand.drawio` reuse the same source as `inference-snaps`, widen the side-by-side tiles, switch the major inter-column and inter-row gaps to the `24px` application gutter, and derive row placement from actual box heights while using the same canonical `18px` / `24px` body copy as the rest of the current batch.
- **Generated draw.io cells now carry provenance and style tokens.** Exported `mxCell` nodes now include `data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, and matching `tags` metadata so generator-owned cells can be distinguished from manual additions and batch-targeted by future tools.
- **A tracked reusable draw.io library now exists.** `scripts/export_drawio_library.py` writes `assets/drawio/diagram-generator-primitives.mxlibrary` with the canonical default box, accent box, highlight box, helper note, connector, terminal bar, matrix widget, memory-wall panel, and grouped panel primitives.
- **Token-aware style sync is now preset-driven.** `scripts/drawio_style_sync.py` can list and apply canonical token-derived presets for labels, panels, images, separators, and connectors across generator-tagged draw.io cells, while still allowing raw `--set` / `--unset` overrides when needed.
- **Protected manual draw.io edits use review-copy infrastructure, but that lane may be empty in a fresh tree.** `scripts/drawio_review_workflow.py` prepares mirrored review copies under `diagrams/2.output/draw.io/review/` and promotes them back only after checkpointing the original into `diagrams/2.output/draw.io/checkpoints/`, but those directories may not exist until the first manual session creates them. Treat the lane as infrastructure-ready rather than a guaranteed live artifact.
- **Declarative diagram architecture is complete (Stage 6a, all steps done).** `scripts/diagram_model.py` defines typed component trees (Box, Panel, Bar, Terminal, Arrow, Helper, MatrixWidget, MemoryWall, RequestCluster, Legend, IconComponent). `scripts/diagram_layout.py` uses Müller-Brockmann explicit grid placement: every component carries `(col, row, col_span, row_span)` and the GRID arrangement computes column widths and row heights from content, then positions each component in its grid cell. VERTICAL and HORIZONTAL arrangements also supported. The current shipped declarative corpus lives under `scripts/diagrams/`, produces both SVG and draw.io output, and still carries warning-only baseline-grid drift on several older diagrams.
- **Canvas constraints and auto-fill now available.** `Diagram` supports `canvas_width`, `canvas_height`, and `uniform_rows`. Canvas width auto-derives equal column widths. Auto-fill propagates sizing to sub-panels, eliminating manual nesting tax math. See "Sizing constraints" and "Auto-fill" sections in `DIAGRAM.md`.
- **Playwright visual validation is now part of the build.** `scripts/visual_compare.py` renders generated SVGs and manual reference rasters side by side, produces combined comparison PNGs, pixel diff heatmaps, and diff percentages. Wired into `build_outputs.py` as the final step (skip with `--no-visual`).
- **Body text is now 18px/24px.** `diagram_shared.py` and `DIAGRAM.md` are updated. All outputs rebuilt at the new size.
- **Bars auto-size from content.** Layout engine computes minimum bar height from `INSET + text_height + INSET` so text has balanced top/bottom padding; the model's `height` field is now a floor, not a fixed value.
- **Baseline grid validator is live.** `validate_grid(result)` in `diagram_layout.py` checks all Rect, Icon, TextBlock, Arrow, and Canvas coordinates against the `8px` grid. Bar segment `width_px` values must be multiples of `8`.
- **Manual app validation remains the main open lane.** Structural draw.io XML audits and Illustrator-safety sanitizer checks now pass, but native draw.io and Illustrator desktop smoke tests still need a workstation that has those tools installed. The token-propagation work is now wired through the preset-driven draw.io style-sync path.

## Machine-switch checkpoint (2026-05-13)

- Done: the autolayout docs now describe grouped layouts as parent-scoped equal splits plus consistent gutters and wrapper outdents.
- Done: arrow labels and thin separators are first-class primitives in the declarative pipeline, with a committed regression fixture at `scripts/diagrams/yaml/example-arrow-label-separator.json` and a tracked compare page.
- Done: preview relayout now consumes server-declared child slots/spans and measured gutters instead of rediscovering grouped layout from child geometry.
- Remaining: equal-split/outdent math is still duplicated between `scripts/diagram_layout.py` and `scripts/preview/component-model.js`.
- Remaining: `python scripts/build_v2.py` still exits nonzero on known clearance blockers in `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, and `lt-summit-identity`, with warning-only grid drift on several older diagrams.
- Remaining: native draw.io / diagrams.net and Illustrator smoke tests still need a workstation with those apps installed.

## Current execution plan

- Content-width alignment and preview distribute-and-align are complete and validated.
- The interactive preview shell now uses the vendored Baseline Foundry `os` tier assets tracked in this repo; local preview CSS is the editor-specific override and compatibility layer rather than a bespoke standalone shell, including the left-nav resize-handle shim, the forced desktop three-pane layout pin, DG-owned amber selection tokens for editor chrome, and the BF-tabbed `Input` / `Output` / `Both` compare strip in the main pane.
- Preview undo/redo now uses explicit action records and restores full editor state, including grid overrides; the hottest move/resize interactions now use narrower override-patch commands, and the remaining actions stay on the full-state path unless a real hotspot appears.
- Generated draw.io outputs are structurally clean; manual draw.io or diagrams.net smoke tests remain pending but are not the current no-input implementation lane.
- The tracked `example-data-processing` and `example-deployment-pipeline` draw.io/SVG/grid artifacts were refreshed so the checked-in examples match the current exporter output, and the follow-up Windows preview-shell smoke pass is now complete.
- Generated SVG outputs passed the Illustrator-safety sanitizer; manual Illustrator smoke tests remain pending but are not blocking the current implementation work.
- The current helper-audit lane now covers terminal bars, request clusters, draw.io icon-image sizing, memory-panel geometry, and SVG jagged-step sizing; keep future cleanup scoped to reusable helper surfaces rather than per-diagram coordinates.
- Keep the new preset-driven draw.io style-sync path aligned with exporter defaults whenever shared diagram tokens change.
- The cold-start exemplar path is now curated in `README.md`; the next no-input doc lane is refining `DIAGRAM.md` as more diagram types appear.
- Keep `example-arrow-label-separator` as the smallest tracked regression surface for thin separators + free-positioned arrow labels.
- Keep refining `DIAGRAM.md` as more diagram types appear.

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
- For new work, keep the `192px` / `64px` / `8px` / `48x48` block system and the imported dense spacing baseline, but treat `18px` / `24px` as the current body text size.
- Prefer hierarchy by weight before hierarchy by size; move from `18px` regular to `18px` strong and small-caps, then `24px/32px` only when the smaller ladder is not enough.
- Orange is reserved for connectors and arrowheads only; boxes stay white or `#F3F3F3`, with at most one black emphasis box when clearly justified.
- Orange connectors should run edge-to-edge, midpoint-to-midpoint, behind the destination box, using literal line-plus-triangle geometry.
- `diagrams/2.output/svg/memory-wall-onbrand.svg` is the canonical implementation checkpoint for palette, icon placement, side-icon clusters, and overall scale.
- The `Memory wall` node remains the one semantic exception that keeps jagged top and bottom edges.
- Use an `8px` baseline unit for snapping heights and line steps.

## Next session should

- Start by reading this file.
- Read `DIAGRAM.md` before changing diagram behavior.
- Drain `INBOX.md`.
- Drain `AGENT-INBOX.md`.
- Continue from `TODO.md`.
- Read `docs/specs.md` before changing spec-governed behavior.