---
name: diagram-redraw
description: "Redraw rough sketches or inconsistent diagrams into on-brand SVG and draw.io outputs. Use when adding a new diagram slug, translating a rough source into generator code, picking local icons, wiring compare pages, or producing editable outputs."
argument-hint: "Describe the source asset, target slug, and any special constraints"
---

# Diagram redraw

## When to use

- A rough source image, sketch, or prior diagram needs an on-brand redraw.
- A new diagram slug is being added to the generator batch.
- A diagram needs both draw.io and SVG outputs.
- Compare pages need a new before and after pair.

## Procedure

1. Read `STATUS.md`, `DIAGRAM.md`, and `docs/specs.md` before making layout decisions.
2. Inspect the source sketch plus the governing local references in `diagrams/0.reference/`.
3. Audit `assets/icons/` early and decide which nodes get icons and which intentionally stay text-only.
4. Add or update the generator logic in `scripts/export_drawio_batch.py` and `scripts/generate_remaining_diagrams.py`.
5. Add the compare entry in `scripts/build_compare_pages.py` and create or refresh the rough input asset under `diagrams/1.input/` when the review lane should include a before state.
6. Run the build and validation workflow from the `diagram-build-validate` skill.
7. If the change adds a reusable rule, record it in `DIAGRAM.md` rather than expanding `TODO.md`.

## Guardrails

- Treat `DIAGRAM.md` as the canonical design-language contract.
- Keep text-bearing draw.io shapes native and editable.
- Use local icons only.
- Attach direct draw.io edges with `source`, `target`, and explicit anchors.
- Sanitize changed deliverable SVGs before treating them as final.