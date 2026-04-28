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

### Stage 6 — Grid engine and inside-out box model (layers 1–4 done)

Replace the current ad-hoc absolute-positioning approach with an output-agnostic grid-aware computation layer in `diagram_shared.py`. This layer sits above both renderers (SVG and draw.io) and produces abstract layout geometry — positions, dimensions, grid arrays — that each renderer consumes. It is not a CSS layout engine; it is a set of helpers that make it structurally impossible to place things off-grid.

Layers 1–4 are implemented. Layer 5 (rollout) is superseded by Stage 6a.

### Stage 6a — Declarative diagram model (active)

Replace per-diagram imperative functions (~200 lines each, ×2 renderers) with a declarative tree model. A diagram becomes a data structure of typed components (`Box`, `Panel`, `Bar`, `Terminal`, `Arrow`, `Helper`, `Matrix`). A shared layout engine walks the tree using the Stage 6 grid helpers to compute positions. Separate SVG and draw.io renderers consume the computed layout.

**Why:** The imperative approach does not scale to hundreds of diagrams or PM self-serve. Every new diagram currently requires writing a new Python function from scratch. The declarative model means a new diagram is a compact data definition, not a code change.

**When complex diagrams require new component types** (e.g. subnet columns, VPC tile grids, legend entries with icons), capture the need and add it to the model rather than working around it with ad-hoc positioning.

**Grid design per diagram:** Layout grids are designed for each diagram's specific content, following the Müller-Brockmann approach. The upstream spacing specs dictate a power-of-2 grid; how whitespace is distributed within that grid is at the model's discretion.

**Target architecture:**
- `diagram_model.py` — pure data: `@dataclass` component types, no rendering
- `diagram_layout.py` — walks the tree, computes geometry, enforces uniform row heights and containment
- `diagram_render_svg.py` — consumes layout, emits SVG
- `diagram_render_drawio.py` — consumes layout, emits draw.io XML

**Future direction:** Once the declarative model works, diagram definitions can move from Python to YAML or JSON, enabling a PM to define a diagram without writing code. A mermaid-to-tree parser or sketch-to-tree AI step could feed the same pipeline.

### Stage 7 — Batch redesign throughput

Process the incoming diagram queue against `DIAGRAM.md`, keeping outputs stylistically consistent and easy to compare.

### Stage 8 — Selective merge and reapply automation

Once the generated/manual boundaries are explicit, selectively patch generator-owned portions of polished diagrams with rollback support instead of forcing all-or-nothing regeneration.

### Stage 9 — Optional automation

Add lightweight checks or generation helpers only if they reduce repetition without making the outputs less editable.

### Stage 10 — Interactive preview and visual editing

The preview server (`scripts/preview_server.py`) provides hot-reload, click-to-select, drag-to-move, resize, undo/redo, and override persistence. This stage extends it toward a Figma-like editing experience layered over the declarative diagram model.

**Near-term (implemented or in progress):**
- Component selection, move, resize with per-component override persistence
- Undo/redo stack, explicit save, keyboard shortcuts
- 8-direction resize handles
- Arrow and annotation selection and repositioning

**Medium-term:**
- Nested grid controls: set panel grid dimensions (rows, cols), gutters, and padding interactively
- Auto-fill children: add/remove boxes in a panel and have the grid re-flow like Figma auto-layout
- Resize a panel and have children redistribute proportionally
- Snap-to-grid visual guides during drag
- Multi-select and group move
- Property panel for editing text, fill, border style on selected component

**Longer-term:**
- Visual arrow routing: drag arrow waypoints, add/remove bends
- Create new components from the UI (add box, add panel, add arrow)
- Export edited layout back to the Python definition or a YAML/JSON format
- Collaborative editing or at least conflict-free override merging
- Theming controls: switch colour palette, typography tier, spacing scale

## Long-term direction

- Keep the repo minimal and task-focused.
- Prefer one shared documented style system over per-diagram improvisation.
- Keep `DIAGRAM.md` aligned with the broader design language so typography, spacing, and grid changes can flow into the renderers without re-deriving the rules.
- Prefer reusable library components plus scripted style sync over repeated hand restyling of individual cells.
- Never treat generated draw.io files and manually polished working copies as the same lifecycle stage.
- Use completed diagrams as exemplars for future cold starts.
- Mirror future workflow-file refinements from `repo-workflow-boilerplate` when the centralized standard changes.