# Roadmap

## Purpose

Turn this repo into Canonical's shared diagram production system and a validation harness for the design language: constrained generation from structured input, fallback guardrails for manual tools, and a live regression surface for the canonical spacing, typography, and grid specs.

## Stages

### Stage 1 — Workflow alignment ✅

Centralized workflow boilerplate adopted: root status, plan, history, inbox split, and specs files now govern cold starts instead of the older docs-only layout.

### Stage 2 — Style-system baseline ✅

Local font, local icon set, draw.io scale reference, connector behavior, and compact SVG conventions documented from the first exemplar.

### Stage 3 — Safe manual draw.io workflow ✅

Review-copy / checkpoint / promote workflow for manually polished draw.io files is built and piloted. Generator re-entry does not overwrite local polish blindly.

### Stage 4 — Library-backed reusable primitives ✅

Canonical building blocks captured in a repo-owned draw.io library (`assets/drawio/diagram-generator-primitives.mxlibrary`), auto-generated from the corpus via `scripts/export_drawio_library.py`.

### Stage 5 — Tokenized style sync and migration tools ✅

Style-token layer over generated draw.io cells with provenance markers. `scripts/drawio_style_sync.py` batch-rewrites tokenized properties (spacing, connector styles, dash patterns) across existing diagrams.

### Stage 6 — Grid engine and inside-out box model ✅

Output-agnostic grid-aware computation layer in `diagram_shared.py`. Layers 1–4 implemented. Layer 5 superseded by Stage 6a.

### Stage 6a — Declarative diagram model ✅

Declarative tree model replaces per-diagram imperative functions. A diagram is a compact data definition of typed components (`Box`, `Panel`, `Bar`, `Terminal`, `Arrow`, `Annotation`, `JaggedPanel`, `IconCluster`, `Matrix`). Shared layout engine walks the tree; separate SVG and draw.io renderers consume computed layout. 16+ diagrams converted. Build-time validators enforce baseline grid, arrow crossings, and arrow clearance.

### Stage 7 — Batch redesign throughput (largely done)

16+ production diagrams processed through the pipeline. Remaining work is intake of new diagram requests as they come in.

### Stage 8 — Selective merge and reapply automation

Selectively patch generator-owned portions of polished diagrams with rollback support instead of all-or-nothing regeneration. Generator cells carry stable identity and provenance metadata to support this.

### Stage 9 — Optional automation ✅

Lightweight build-time checks added: arrow crossing validation, arrow clearance enforcement, baseline grid validation. Illustrator-safety sanitizer available.

### Stage 10 — Interactive preview and visual editing (active)

The preview server provides hot-reload, click-to-select, drag-to-move, resize, undo/redo, and override persistence. Extending toward a Figma-like editing experience layered over the declarative diagram model.

**Implemented:**
- Component selection, move, resize with per-component override persistence
- Undo/redo with explicit per-action command records
- 8-direction resize handles with parent-bounds clamping
- Arrow and annotation selection and repositioning
- Arrow attachment: endpoints track source/target box movement and resize
- Grid overlay toggle (composition grid + baseline grid, mutually exclusive)
- Editable grid controls with live relayout
- Interactive waypoint editing: drag, add, remove, collinear auto-pruning
- Inline text editing with text-icon gutter enforcement
- Auto-layout: parent resize relayouts children; child resize redistributes to siblings
- Distribute and align actions with multi-select
- Snap guides during drag
- Component swap (style picker in inspector)
- Client-side brand constraint enforcement
- Baseline Foundry-backed shell with DG compatibility layer

### Stage 11 — Viewer extraction ✅

JS/CSS/HTML extracted from Python f-string template into static files. Preview server is 485 lines (was 2672). IDE support, linting, and browser source mapping enabled.

### Stage 12 — Client-side model and interaction manager ✅

`ComponentModel` with indexed tree and `InteractionManager` state machine replace scattered interaction state variables. Parent-child constraint propagation, auto-layout, nested selection, and clean interaction modes all working.

### Stage 13 — Brand constraint enforcement (active)

`ConstraintRegistry` with 6 built-in brand constraints running client-side. The editor enforces brand rules at the model level — only approved fills, arrow styles, icon sources, and typography are available.

**Remaining:**
- Nested grid controls: set panel grid dimensions interactively
- Auto-fill children: add/remove boxes and have the grid re-flow
- Property panel for editing fill, border style, text on selected component
- Component swap from shape library (like Figma component swap)
- Create new components from the UI (add box, add panel, add arrow)
- Export edited layout back to Python definition or YAML/JSON format
- Keep shrinking the preview/editor compatibility layer as Baseline Foundry stabilizes

### Stage 14 — Design-language harness

The system already consumes canonical spec tokens and enforces them at the model level. Complete the harness by adding:

- Automated visual regression (snapshot-compare after token changes)
- Token change → rebuild → diff pipeline
- Spec compliance scoring per diagram
- Cross-format consistency check (SVG vs draw.io structural comparison)
- Upstream spec watch (flag affected diagrams when specs change)

### Stage 15 — Cross-team adoption

Productionise for Canonical-wide use. See `docs/project-proposal.md` for the full phased rollout plan:

- Phase 0: validate and package for first adopters
- Phase 1: pilot with tech authors (YAML/JSON definitions, draw.io library)
- Phase 2: expand to field engineering (templates, Penpot library, visual guidelines)
- Phase 3: self-serve and scale (web editor, docs pipeline integration, AI intake)

### Stage 16 — Fallback guardrails for manual tools

Deliver brand guardrails for the 20% of diagrams that can't go through the automated system:

- draw.io component library + style defaults
- Penpot component library
- Visual guidelines document
- Brand review checklist
- Design token exports (CSS custom properties, JSON tokens)

### Stage 17 — Force-directed layout engine

Port D3's force-simulation layout algorithm (`d3-force`) into the Python layout engine — ideally a literal translation of the velocity Verlet integrator and the core force types, not a reimplementation from scratch. This unlocks automatic layout for diagrams where the author specifies relationships but not positions.

**Core forces to port:**
- `forceLink` — edge-length spring constraints between connected components
- `forceManyBody` — charge repulsion to prevent overlap
- `forceCenter` — gravity toward canvas center
- `forceCollide` — rectangle collision (adapted from D3's circle collision to handle box dimensions)

**Integration with existing system:**
- The force simulation produces initial positions; the existing grid engine then snaps results to the 8px baseline grid and enforces box/panel containment rules
- Force layout becomes an optional `layout_mode` on `Diagram` — explicit grid placement (current default) remains available for hand-tuned diagrams
- Arrows route through the existing orthogonal auto-router after force layout settles

**Why a literal port:** D3-force is ~400 lines of well-tested physics. Porting the exact algorithm preserves its convergence properties and makes upstream improvements easy to pull in. A from-scratch simulation would need extensive tuning to match.

**Stretch:** Interactive force layout in the preview editor — drag a box and watch connected components respond in real time, then commit the settled positions as overrides.

## Long-term direction

- Keep the repo minimal and task-focused.
- Prefer one shared documented style system over per-diagram improvisation.
- Keep `DIAGRAM.md` aligned with the broader design language so typography, spacing, and grid changes can flow into the renderers without re-deriving the rules.
- Prefer reusable library components plus scripted style sync over repeated hand restyling of individual cells.
- Never treat generated draw.io files and manually polished working copies as the same lifecycle stage.
- Use completed diagrams as exemplars for future cold starts.
- Treat every diagram in the corpus as a regression test for the design language specs.
- The diagram system is both a production tool and a validation harness — investment in one pays off in the other.