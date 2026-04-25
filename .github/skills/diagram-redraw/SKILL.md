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

1. Read `STATUS.md`, `DIAGRAM.md` (especially Layout & spacing and Typography), and `docs/specs.md` before making any layout decisions.
2. Inspect the source sketch plus the governing local references in `diagrams/0.reference/`.
3. Audit `assets/icons/` early and decide which nodes get icons and which intentionally stay text-only.
4. **Identify the content tree.** Before writing any coordinates, list every panel, its heading, and its child boxes. Note which boxes have icons and how many text lines each has. This determines the box model math.
5. **Compute box heights from content (inside-out).**
   - Text-only box: `INSET + (lines × line_step) + INSET`, snapped to `4px` grid. A 1-line box is `36px`, not `64px`.
   - Box with icon: `max(text_height, INSET + ICON_SIZE + INSET)`.
   - Do not hardcode heights that leave dead space below text.
6. **Define the panel grid using named variables.**
   - Column x-positions: `col_xs = [inset, inset + col_width + gap, ...]`
   - Row y-positions: `row_ys = [heading_end + gap, heading_end + gap + row_height + gap, ...]`
   - Panel dimensions: computed from grid (`inset + cols × width + gaps + inset`), never guessed.
   - Every position and dimension must be an exact multiple of `4px`. No ad-hoc values.
   - When sibling panels have parallel content, synchronize their row heights.
7. **Apply typography hierarchy.**
   - Panel headings and frame titles: bold (`600–700`).
   - All other box labels: regular weight (`400`). Bold at the same size is a higher hierarchical level — do not make every label bold.
   - Helper text: regular weight, `#666666` fill. Hierarchy by color only.
8. **Verify text containment.**
   - For every text element inside a container: `text_y + (lines × line_step) ≤ container_bottom - inset`.
   - If it doesn't fit, re-derive the container height from the inside-out model.
9. Add or update the generator logic in `scripts/export_drawio_batch.py` and `scripts/generate_remaining_diagrams.py`.
10. Add the compare entry in `scripts/build_compare_pages.py` and create or refresh the rough input asset under `diagrams/1.input/` when the review lane should include a before state.
11. Run the build and validation workflow from the `diagram-build-validate` skill.
12. **Post-generation layout audit.** Check:
    - Every dimension is a multiple of `4px` (grep for non-grid values).
    - No text crosses a container border.
    - Boxes in the same row share the same y. Boxes in the same column share the same x.
    - Box heights are tight to content — no dead space below text.
    - Only structural headings are bold; content labels are regular weight.
    - Arrows route cleanly between grid-aligned boxes.
    If any check fails, fix the grid parameters, not individual coordinates.
13. If the change adds a reusable rule, record it in `DIAGRAM.md` rather than expanding `TODO.md`.

## Guardrails

- Treat `DIAGRAM.md` as the canonical design-language contract.
- Keep text-bearing draw.io shapes native and editable.
- Use local icons only.
- Attach direct draw.io edges with `source`, `target`, and explicit anchors.
- Sanitize changed deliverable SVGs before treating them as final.
- **No ad-hoc coordinates.** Every position and dimension must derive from named grid variables and baseline-unit math. No magic numbers, no eyeballing, no "tweaking until it looks right."
- **Inside-out box model.** Box height is the sum of its content plus padding. Panel height is the sum of its rows plus gaps plus padding. Never size a container first and fit content inside.
- **No text across borders.** Every text element must fit entirely within its parent container, or be positioned entirely outside it.
- **Typography hierarchy.** Bold at same size = higher level. Only structural headings use bold. Content labels use regular weight.
- **Tight boxes.** A 1-line text-only box is `36px`, not `64px`. No empty space below the last line of text. The `64px` minimum applies only when an icon is present.