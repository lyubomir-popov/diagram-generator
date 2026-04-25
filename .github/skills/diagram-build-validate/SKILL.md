---
name: diagram-build-validate
description: "Build and validate diagram-generator outputs. Use when changing renderers, shared primitives, deliverable SVGs, draw.io exports, compare pages, or any diagram slug that needs rebuild, sanitization, and focused output checks."
argument-hint: "Describe which diagram slugs or files changed"
---

# Diagram build and validate

## When to use

- Renderer code changed in `scripts/export_drawio_batch.py`, `scripts/generate_remaining_diagrams.py`, or `scripts/diagram_shared.py`.
- A new diagram was added.
- A deliverable SVG changed and needs sanitization.
- Compare pages need regeneration.

## Procedure

1. Rebuild the canonical batch with `python scripts/build_outputs.py`.
2. Sanitize changed deliverable SVGs with `python scripts/svg_illustrator_sanitize.py --write <svg>`.
3. Regenerate compare pages with `python scripts/build_compare_pages.py` when compare inputs or slugs changed.
4. Check the touched Python and Markdown files for errors if the editor reports any.
5. Spot-check the changed draw.io XML for attached edges and the changed SVG for syntax or portability issues.
6. Update `STATUS.md`, `TODO.md`, and `HISTORY.md` if the change altered the repo’s current state or added a reusable rule.

## Guardrails

- Do not skip the batch rebuild when renderer or exporter code changed.
- Do not skip the sanitizer for changed deliverable SVGs.
- Treat focused build and validation commands as the primary check, not `git diff`.