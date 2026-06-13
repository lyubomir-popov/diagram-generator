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
2. Run `npm --prefix apps/preview test` when preview routes, save flows, or shell behavior changed.
3. Run `node scripts/check_no_new_python.mjs` (spec 038 ratchet).
4. Start the preview server and confirm changed diagrams load at `http://127.0.0.1:8100/view/v3:<slug>` (manual look or tests — **no agent screenshots unless the user asks**).
5. Sanitize changed deliverable SVGs with `python scripts/svg_illustrator_sanitize.py --write <svg>`.
6. Update `AGENTS.md` (Handover section), `TODO.md`, or `AGENT-INBOX.md` only if the change altered current state or left durable follow-up.
7. Check the touched Markdown files for errors if the editor reports any.
8. Spot-check the changed SVG for syntax or portability issues.

## Guardrails

Visual rules (gutter consistency, arrow clearance, typography hierarchy, box height floor, frame classes, separator sizing) are in `DIAGRAM.md`; runtime constants are in `packages/layout-engine/src/tokens.ts` and `frame-classes.ts`. Read both before running this procedure.

Key constraints to verify during build:

- Do not skip the focused TypeScript tests when loader, layout, render, or preview code changed.
- Do not add new Python product-path files; the ratchet must stay green.
- Do not skip the sanitizer for changed deliverable SVGs.
- Text must not overlap arrows, borders, icons, or other text.
- Browser-verify the changed diagram in the v3 preview before treating the work as done (tests or user-confirmed load — not automatic screenshots).
- When an arrow crosses helper text, change anchor sides or add waypoints — do not accept crossings.
