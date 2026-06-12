---
name: diagram-build-validate
description: "Build and validate diagram-generator outputs. Use when changing renderers, shared primitives, deliverable SVGs, draw.io exports, compare pages, or any diagram slug that needs rebuild, sanitization, and focused output checks."
argument-hint: "Describe which diagram slugs or files changed"
---

# Diagram build and validate

## When to use

- Frame loader, layout engine, render, or preview code changed.
- A frame YAML in `scripts/diagrams/frames/` changed.
- A new frame YAML was added.
- A deliverable SVG changed and needs sanitization.

## Procedure

1. Run `npm --prefix packages/layout-engine test` (TS — primary).
2. Run `python -m pytest scripts/test_frame_loader.py scripts/test_autolayout.py scripts/test_layout_v3.py scripts/test_parity.py -q` (Python parity).
3. Run `node scripts/check_no_new_python.mjs` (spec 038 ratchet).
4. Start the preview server and browser-verify changed diagrams at `http://127.0.0.1:8100/view/v3:<slug>`.
5. Sanitize changed deliverable SVGs with `python scripts/svg_illustrator_sanitize.py --write <svg>`.
6. Update `STATUS.md`, `TODO.md`, and `HISTORY.md` if the change altered the repo's current state or added a reusable rule.
7. Check the touched Python and Markdown files for errors if the editor reports any.
8. Spot-check the changed SVG for syntax or portability issues.

## Guardrails

Visual rules (gutter consistency, arrow clearance, typography hierarchy, box height floor, frame classes, separator sizing) are in `DIAGRAM.md`; runtime constants are in `packages/layout-engine/src/tokens.ts` and `frame-classes.ts`. Read both before running this procedure.

Key constraints to verify during build:

- Do not skip the focused v3 Python and TypeScript tests when loader, layout, render, or preview code changed.
- Do not add new Python product-path files; the ratchet must stay green.
- Do not skip the sanitizer for changed deliverable SVGs.
- Text must not overlap arrows, borders, icons, or other text.
- Browser-verify the changed diagram in the v3 preview before treating the work as done.
- When an arrow crosses helper text, change anchor sides or add waypoints — do not accept crossings.
