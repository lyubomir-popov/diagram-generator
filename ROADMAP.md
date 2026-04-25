# Roadmap

## Purpose

Turn this repo into a reliable batch-redesign workspace for on-brand diagrams: fast intake, repeatable draw.io and SVG outputs, a safe mixed manual/programmatic editing workflow, and a stable centralized workflow for future agents.

## Stages

### Stage 1 — Workflow alignment ✅

Centralized workflow boilerplate adopted: root status, plan, history, inbox split, and specs files now govern cold starts instead of the older docs-only layout.

### Stage 2 — Style-system baseline ✅

Local font, local icon set, draw.io scale reference, connector behavior, and compact SVG conventions documented from the first exemplar.

### Stage 3 — Safe manual draw.io workflow (in progress)

Establish the operating model for taking a manually polished draw.io file and extending it without breaking previous work: generated base files stay separate from polished working files, manual checkpoints are easy to create and revert, and generator re-entry does not overwrite local polish blindly.

### Stage 4 — Library-backed reusable primitives

Capture the canonical manual building blocks in a repo-owned draw.io library, sourced from scratchpad exports and curated library XML, so common additions reuse the same boxes, connectors, grouped panels, and special shapes.

### Stage 5 — Tokenized style sync and migration tools

Introduce a style-token layer over generated draw.io cells and build tooling that can batch-update style properties such as text padding, connector defaults, and panel treatments across existing diagrams when the system changes.

### Stage 6 — Grid engine and inside-out box model

Replace the current ad-hoc absolute-positioning approach with an output-agnostic grid-aware computation layer in `diagram_shared.py`. This layer sits above both renderers (SVG and draw.io) and produces abstract layout geometry — positions, dimensions, grid arrays — that each renderer consumes. It is not a CSS layout engine; it is a set of helpers that make it structurally impossible to place things off-grid.

**Layer 1 — Tight box height computation.**
`box_height(lines, has_icon)` computes exact height from content: `INSET + (lines × line_step) + INSET`, snapped to baseline unit. A 1-line text-only box is `36px`, not `64px`. The `64px` minimum only applies when an icon is present. This replaces `lines_required_height()` and `BOX_MIN_HEIGHT` as the default box-height source.

**Layer 2 — Panel grid computation.**
`panel_grid(cols, rows, col_width, row_height, ...)` returns a dict with `width`, `height`, `col_xs[]`, `row_ys[]` — all derived from content dimensions plus spacing tokens. The panel dimensions are the output of this function, never the input. Each diagram definition calls `panel_grid()` once per panel and both renderers use the returned arrays for child positioning.

**Layer 3 — Containment validation.**
`assert_contained(text_y, line_count, line_step, container_y, container_height)` — a debug-time check that raises if text would cross a container border.

**Output-agnostic principle:**
The grid engine computes abstract layout — coordinates, widths, heights, grid arrays. It knows nothing about SVG elements or draw.io `mxCell` XML. Both `generate_remaining_diagrams.py` (SVG renderer) and `export_drawio_batch.py` (draw.io renderer) consume the same computed geometry. If a third output format appears later, it uses the same layout data.

**Scope of change:**
- `diagram_shared.py`: new output-agnostic helpers, updated box-height semantics, optional containment context.
- `generate_remaining_diagrams.py`: all `build_*()` functions refactored to use grid variables from the shared layer.
- `export_drawio_batch.py`: same refactoring for draw.io export functions.
- `DIAGRAM.md`: already updated with the rules (done ahead of implementation).

### Stage 7 — Batch redesign throughput

Process the incoming diagram queue against `DIAGRAM.md`, keeping outputs stylistically consistent and easy to compare.

### Stage 8 — Selective merge and reapply automation

Once the generated/manual boundaries are explicit, selectively patch generator-owned portions of polished diagrams with rollback support instead of forcing all-or-nothing regeneration.

### Stage 9 — Optional automation

Add lightweight checks or generation helpers only if they reduce repetition without making the outputs less editable.

## Long-term direction

- Keep the repo minimal and task-focused.
- Prefer one shared documented style system over per-diagram improvisation.
- Keep `DIAGRAM.md` aligned with the broader design language so typography, spacing, and grid changes can flow into the renderers without re-deriving the rules.
- Prefer reusable library components plus scripted style sync over repeated hand restyling of individual cells.
- Never treat generated draw.io files and manually polished working copies as the same lifecycle stage.
- Use completed diagrams as exemplars for future cold starts.
- Mirror future workflow-file refinements from `repo-workflow-boilerplate` when the centralized standard changes.