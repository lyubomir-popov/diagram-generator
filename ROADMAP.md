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

### Stage 6 — Batch redesign throughput

Process the incoming diagram queue against `DIAGRAM.md`, keeping outputs stylistically consistent and easy to compare.

### Stage 7 — Selective merge and reapply automation

Once the generated/manual boundaries are explicit, selectively patch generator-owned portions of polished diagrams with rollback support instead of forcing all-or-nothing regeneration.

### Stage 8 — Optional automation

Add lightweight checks or generation helpers only if they reduce repetition without making the outputs less editable.

## Long-term direction

- Keep the repo minimal and task-focused.
- Prefer one shared documented style system over per-diagram improvisation.
- Keep `DIAGRAM.md` aligned with the broader design language so typography, spacing, and grid changes can flow into the renderers without re-deriving the rules.
- Prefer reusable library components plus scripted style sync over repeated hand restyling of individual cells.
- Never treat generated draw.io files and manually polished working copies as the same lifecycle stage.
- Use completed diagrams as exemplars for future cold starts.
- Mirror future workflow-file refinements from `repo-workflow-boilerplate` when the centralized standard changes.