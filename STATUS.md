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

- **The repo now uses the centralized root workflow.** `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md` are the canonical workflow files.
- **A design.md-inspired diagram language spec now exists.** `DIAGRAM.md` holds the canonical tokens, prose rules, output constraints, and redraw workflow for diagram work instead of keeping that material in `TODO.md`.
- **Optional workflow skills now have a clear home.** `.github/skills/` is the repo location for on-demand workflow skills such as redraw, build-and-validate, and protected draw.io review procedures.
- **Draw.io is the primary editable output target.** `scripts/build_outputs.py` generates draw.io first into `diagrams/2.output/draw.io/`, then regenerates the matching SVG batch in `diagrams/2.output/svg/`.
- **Both renderers now share one primitive layer.** `scripts/diagram_shared.py` carries the shared tokens, icon loading, text metrics, terminal chrome helpers, and matrix helpers used by both renderers.
- **The current output batch is already rebuilt on the refreshed starter-block system.** `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `attention-qkv-onbrand.svg`, `logic-data-vram-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, and `gpu-waiting-scheduler-onbrand.svg` all live under `diagrams/2.output/svg/`, with matching editable draw.io exports under `diagrams/2.output/draw.io/`.
- **A workflow explainer diagram now documents the intake lane.** `diagram-intake-workflow-onbrand.svg` and `diagram-intake-workflow-onbrand.drawio` show the current ChatGPT input, the open PM intake-question lane, the repo workflow, compare mode, the manual draw.io polish step, and final SVG output; the review lane also includes `diagrams/1.input/diagram-intake-workflow-rough.svg` and `diagrams/3.compare/html/diagram-intake-workflow.html`.
- **A second workflow explainer now documents the spec-led lane.** `diagram-language-workflow-onbrand.svg` and `diagram-language-workflow-onbrand.drawio` show rough sources, local references, `DIAGRAM.md`, the new workflow skills, the generators, the compare and review lane, and clean outputs ready for design-language token ingestion; the review lane also includes `diagrams/1.input/diagram-language-workflow-rough.svg` and `diagrams/3.compare/html/diagram-language-workflow.html`.
- **A forked dense comparison variant now exists for a glitch-prone grouped layout.** `inference-snaps-dense-onbrand.svg` and `inference-snaps-dense-onbrand.drawio` reuse the same source as `inference-snaps` but widen the side-by-side tiles, switch the major inter-column and inter-row gaps to the `24px` application gutter, and derive row placement from actual box heights so the current dense token layer is visible in practice.
- **Generated draw.io cells now carry provenance and style tokens.** Exported `mxCell` nodes now include `data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, and matching `tags` metadata so generator-owned cells can be distinguished from manual additions and batch-targeted by future tools.
- **A tracked reusable draw.io library now exists.** `scripts/export_drawio_library.py` writes `assets/drawio/diagram-generator-primitives.mxlibrary` with the canonical default box, accent box, highlight box, helper note, connector, terminal bar, matrix widget, memory-wall panel, and grouped panel primitives.
- **Token-aware style sync is now available.** `scripts/drawio_style_sync.py` can batch rewrite tokenized draw.io style fields such as `spacingTop`, connector properties, and dash patterns across generated diagrams.
- **The manually polished draw.io lane already drifts from generator structure.** Files in `diagrams/2.output/draw.io/manually-edited/` and `memory-wall-onbrand-edited-in-drawio.drawio` flatten some generated parent/child structures, adjust text spacing directly on cells, and introduce one-off local edits that cannot be safely regenerated over today.
- **Protected manual draw.io edits now use review copies.** `scripts/drawio_review_workflow.py` prepares mirrored review copies under `diagrams/2.output/draw.io/review/` and promotes them back only after checkpointing the original into `diagrams/2.output/draw.io/checkpoints/`.
- **Review remains the main open lane.** The remaining work is Illustrator and draw.io import validation, plus finishing the propagation of the newly imported typography, spacing, and grid tokens into draw.io style sync and any remaining renderer defaults.

## Current execution plan

- Ingest typography, spacing, and grid specs from the broader design language into `DIAGRAM.md`, then map them into `scripts/diagram_shared.py` and draw.io style sync.
- Current sync slice: move the diagram system onto the dense application/doc baseline from `canonical-spacing-spec` – `4px` baseline unit, `14px` root body size, `20/24/32px` baseline-snapped line heights, and container-owned horizontal spacing keyed off the `24px` application gutter.
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
- For new work, default to the current dense block system: `192px` width, at least `64px` height, `14px` body text with `20px` line height, `8px` insets, and natural-size `48x48` icons aligned top-right.
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