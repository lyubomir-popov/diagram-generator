---
name: diagram-build-validate
description: "Build and validate diagram-generator outputs. Use when changing renderers, shared primitives, deliverable SVGs, draw.io exports, compare pages, or any diagram slug that needs rebuild, sanitization, and focused output checks."
argument-hint: "Describe which diagram slugs or files changed"
---

# Diagram build and validate

## When to use

- Renderer code changed in `scripts/export_drawio_batch.py`, `scripts/generate_remaining_diagrams.py`, or `scripts/diagram_shared.py`.
- Layout engine or model changed in `scripts/diagram_layout.py` or `scripts/diagram_model.py`.
- A declarative diagram definition changed in `scripts/diagrams/*.py`.
- A new diagram was added.
- A deliverable SVG changed and needs sanitization.
- Compare pages need regeneration.

## Procedure

1. Rebuild the v1 canonical batch with `python scripts/build_outputs.py`.
2. Rebuild the v2 declarative batch with `python scripts/build_v2.py`.
3. Run `python scripts/_audit_v2.py` to compare element counts (orange, rects, texts) between v1 and v2.
4. Run `python scripts/_compare_3way.py` (or a single slug) for Playwright 3-way visual comparison.
5. Sanitize changed deliverable SVGs with `python scripts/svg_illustrator_sanitize.py --write <svg>`.
6. Regenerate compare pages with `python scripts/build_compare_pages.py` when compare inputs or slugs changed.
7. Check the touched Python and Markdown files for errors if the editor reports any.
8. Spot-check the changed draw.io XML for attached edges and the changed SVG for syntax or portability issues.
9. Update `STATUS.md`, `TODO.md`, and `HISTORY.md` if the change altered the repo's current state or added a reusable rule.

## Guardrails

- Do not skip the batch rebuild when renderer or exporter code changed.
- Do not skip the sanitizer for changed deliverable SVGs.
- Treat focused build and validation commands as the primary check, not `git diff`.
- Text must not overlap arrows, borders, icons, or other text. Route arrows to avoid text regions, and ensure boxes are tall enough for their content.
- Always reference the v1 source in `scripts/generate_remaining_diagrams.py` (or the original `1.input/` sketch) to verify that v2 definitions carry all content: every box, arrow, helper label, separator, and icon present in v1 must appear in v2.
- When an arrow would cross through helper text or labels, change the anchor sides or add explicit waypoints to route around the obstruction.
- **Wrapper alignment:** dashed grouping frames and panels that wrap child content must match the outer width of peer standalone boxes. Set `col_width` to `peer_width − 2 × INSET`, not the child width. See "Grid participants vs wrappers" in `DIAGRAM.md`.
- When a panel mixes MatrixWidgets, Boxes, and Helpers at different natural heights, set `uniform_height=False` to avoid inflating box rows to helper-text height.