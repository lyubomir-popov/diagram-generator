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

1. Read `AGENTS.md`, `DIAGRAM.md`, and `docs/specs.md` before making layout decisions (skip bulk `specs/**` unless the task is spec work).
2. Inspect the source sketch plus the governing local references in `diagrams/0.reference/`.
3. Audit `assets/icons/` early and decide which nodes get icons and which intentionally stay text-only.
4. **Identify the content tree.** List every panel, heading, and child box. Note icons and line counts — this determines box model math.
5. **Lock the alignment model before touching coordinates.** For grouped layouts, use parent-scoped equal splits with consistent gutters and wrapper outdents. Do not mix with ad hoc top-level-grid forcing.
6. **Compute box heights from content (inside-out).** Key checks: 64px minimum for bordered boxes, no dead space below text, annotation style for standalone labels.
7. **Author frame YAML** in `scripts/diagrams/frames/` — use FILL/HUG/FIXED, gap tokens, and `level:` per `docs/frame-classes.md`. Do not hand-place coordinates.
8. **Apply typography hierarchy.** Bold = structural headings only. Regular weight for content labels. Helper text uses color shift, not size change.
9. **Verify text containment.** Every text element fits entirely inside its parent or sits entirely outside.
10. **Apply frame classes.** Grey headed panel = level 2; section = level 3; borderless wrappers = layout only. See `docs/frame-classes.md`.
11. The preview server auto-discovers new YAMLs, so no manual registration is needed.
12. **Wire the source reference image** so the "Both" tab shows the original sketch beside the output:
    - Save the source image to `diagrams/1.input/` (any subfolder is fine, e.g. `diagrams/1.input/maas/`).
    - Add a slug → filename mapping to the reference map in `apps/preview/src/server.ts`.
    - The "Input" and "Both" tabs in the preview server load the image via `/reference/<slug>`.
    - If the source is an attached image that can't be saved programmatically, note the expected filename and path so the user can save it manually.
13. Run the build and validation workflow from the `diagram-build-validate` skill.
14. **Post-generation layout audit.** Check against DIAGRAM.md rules:
    - All positions and dimensions on 8px baseline
    - Only two gap scales: compact-gap (8px) and grid-gutter (24px)
    - No text crossing container borders
    - Row/column alignment consistent
    - Box heights tight to content
    - Typography hierarchy correct (bold = headings only)
    - Arrow clearance satisfied (last segment ≥ 16px, first ≥ 8px, routing gaps ≥ 24px)
    - Group alignment and wrapper outdents consistent
    - Arrow doglegs treated as layout smells
    - Arrow labels free-positioned, not grid cells
    - Separators thin, not box-height rows
    If any check fails, fix the grid parameters or anchor model — not individual coordinates.
15. **Do not capture screenshots by default.** Use tests + preview URL confirmation unless the user explicitly asks for a visual check. If they ask, prefer a **tight crop** (diagram region only, not full viewport) and describe the issue in text first.
16. If the change adds a reusable rule, record it in `DIAGRAM.md`.

## Guardrails

All visual rules are defined in `DIAGRAM.md`. Read it before using this procedure. Repo workflow and environment rules live in `AGENTS.md`.

Key constraints during redraw:

- Treat `DIAGRAM.md` as the canonical design-language contract.
- Runtime constants live in `packages/layout-engine/src/tokens.ts` and `frame-classes.ts` — not in DIAGRAM.md frontmatter.
- Keep text-bearing draw.io shapes native and editable.
- Use local icons only (`assets/icons/`).
- Attach direct draw.io edges with `source`, `target`, and explicit anchors.
- Sanitize changed deliverable SVGs before treating them as final.
- No ad-hoc coordinates. Every position must derive from the frame autolayout model.
- Inside-out box model. Never size containers first and fit content inside.
- Sentence case for all diagram text (capitalize first word and proper nouns only).
- **No Playwright/browser screenshots unless the user explicitly requests one.** Tests and `npm run preview` are the default verification path.
