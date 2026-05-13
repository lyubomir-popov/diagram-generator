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
5. **Lock the alignment model before touching coordinates.** For grouped layouts, think in parent-scoped equal splits, consistent gutters, and consistent wrapper outdents. Rows with 2, 3, or 5 children can all align cleanly if they derive from the same parent width logic. Do not mix that with ad hoc top-level-grid forcing.
6. **Compute box heights from content (inside-out).**
   - Text-only box: `INSET + (lines × line_step) + INSET`, snapped to the `8px` baseline. A 1-line box at `18px/24px` is `40px`, not `64px`.
   - Box with icon: `max(text_height, INSET + ICON_SIZE + INSET)`.
   - Do not hardcode heights that leave dead space below text.
7. **Define the panel grid using named variables.**
   - Column x-positions: `col_xs = [inset, inset + col_width + gap, ...]`
   - Row y-positions: `row_ys = [heading_end + gap, heading_end + gap + row_height + gap, ...]`
   - Panel dimensions: computed from grid (`inset + cols × width + gaps + inset`), never guessed.
   - Every position and dimension must be an exact multiple of the `8px` baseline. No ad-hoc values.
   - When sibling panels have parallel content, synchronize their row heights.
8. **Apply typography hierarchy.**
   - Panel headings and frame titles: bold (`600–700`).
   - All other box labels: regular weight (`400`). Bold at the same size is a higher hierarchical level — do not make every label bold.
   - Annotation text: regular weight, `#666666` fill. Hierarchy by color only.
9. **Verify text containment.**
   - For every text element inside a container: `text_y + (lines × line_step) ≤ container_bottom - inset`.
   - If it doesn't fit, re-derive the container height from the inside-out model.
10. **Apply the correct group style.** Default grouped panels should use the grey no-stroke style (`fill=Fill.GREY`, `border=Border.FILL`). Dashed group wrappers are debug-only unless a diagram explicitly calls for them.
11. Add or update the generator logic in `scripts/export_drawio_batch.py` and `scripts/generate_remaining_diagrams.py`.
12. Add the compare entry in `scripts/build_compare_pages.py` and create or refresh the rough input asset under `diagrams/1.input/` when the review lane should include a before state.
13. Run the build and validation workflow from the `diagram-build-validate` skill.
14. **Post-generation layout audit.** Check:
   - Every dimension is a multiple of the `8px` baseline (grep for non-grid values).
      - Every position and dimension must be an exact multiple of the `8px` baseline. No ad-hoc values.
      -   - Every dimension is a multiple of the `8px` baseline (grep for non-grid values).
   - **Gutter consistency.** Only two gap scales: `compact-gap` (8px) for tight in-panel packing, `grid-gutter` (24px) for all structural gaps. Do not use 16 or 32 — they break gutter continuity across nesting levels.
    - No text crosses a container border.
    - Boxes in the same row share the same y. Boxes in the same column share the same x.
    - Box heights are tight to content — no dead space below text.
    - Only structural headings are bold; content labels are regular weight.
    - Arrows route cleanly between grid-aligned boxes.
    - Every arrow's last segment ≥ `24px` and first segment ≥ `8px` (check `validate_arrows()` output).
   - **Group alignment.** Child rows inside groups should split the parent content width cleanly, preserve the configured gutter token, and keep wrapper outdents consistent.
   - **Arrow smell.** If a connector develops a needless dogleg, inspect layout geometry and anchor choice before adding route offsets.
   - **Arrow labels.** Arrow labels should sit `GRID_GUTTER` away from the routed segment and avoid overlaps; do not fake them with a nearby grid cell.
   - **Separators.** Dashed separators should remain thin divider rows, not fake box-height rows.
   If any check fails, fix the grid parameters, hierarchy level, or anchor model — not individual coordinates.
15. Open the changed diagram in the browser and take a Playwright screenshot before treating the task as done.
16. If the change adds a reusable rule, record it in `DIAGRAM.md` rather than expanding `TODO.md`.

## Guardrails

- Treat `DIAGRAM.md` as the canonical design-language contract.
- Keep text-bearing draw.io shapes native and editable.
- Use local icons only.
- Attach direct draw.io edges with `source`, `target`, and explicit anchors.
- Sanitize changed deliverable SVGs before treating them as final.
- **No ad-hoc coordinates.** Every position and dimension must derive from named grid variables and baseline-unit math. No magic numbers, no eyeballing, no "tweaking until it looks right."
- **Inside-out box model.** Box height is the sum of its content plus padding. Panel height is the sum of its rows plus gaps plus padding. Never size a container first and fit content inside.
- **Parent-scoped equal splits.** In grouped layouts, derive each row from the parent content width with consistent gutters and wrapper outdents. Clean alignment across 2-, 3-, and 5-column rows matters more than forcing every row to reuse one global column width.
- **Gutter consistency.** Only two gap scales: `compact-gap` (8px) for tight in-panel packing, `grid-gutter` (24px) for all structural gaps. Do not use 16 or 32 — they break gutter continuity across nesting levels.
- **Group style.** Default grouped panels are grey `Border.FILL` wrappers. Dashed wrappers are for debug or explicit semantic requirements only.
- **No text across borders.** Every text element must fit entirely within its parent container, or be positioned entirely outside it.
- **Typography hierarchy.** Bold at same size = higher level. Only structural headings use bold. Content labels use regular weight.
- **Tight boxes.** A 1-line text-only box at `18px/24px` is `40px`, not `64px`. No empty space below the last line of text. The `64px` minimum applies only when an icon is present.
- **Arrow clearance.** Any `row_gap` or `col_gap` through which arrows route must be ≥ `ARROW_GAP` (`24px`). The last arrow segment must be ≥ `MIN_ARROW_SEGMENT` (`24px`) so the shaft is visibly longer than the arrowhead. See "Arrow clearance" in `DIAGRAM.md`.
- **Arrow doglegs are smells.** If a route bends only to recover alignment that should already exist in the geometry, fix bounds or anchors instead of adding another waypoint.
- **Arrow labels are free-positioned.** Use `Arrow.label` / `label_gap` for connector copy. Do not burn a grid cell or helper row just to label an edge.
- **Separators are thin primitives.** Use `Separator` when you need a dashed divider without allocating a full content row.
- **Fan-in merge.** When multiple sources feed one destination, merge the shafts into a shared trunk that arrives at the destination at 90°. Only the trunk carries the arrowhead. See "Fan-in merge" in `DIAGRAM.md`.
- **Annotations for text notes.** Use `Annotation` for free-standing text that needs arrow connections or grid-height participation. `Annotation` renders text with standard `INSET` padding and supports `Border.NONE` (default, invisible), `Border.SOLID`, or `Border.DASHED`. Use `IconCluster` for icon groups, `JaggedPanel` for jagged-edge semantic exceptions. The deprecated `Helper`, `IconComponent`, `RequestCluster`, and `MemoryWall` types are still importable but should not be used in new definitions.
- **Equal-height equalization.** Panels in the same grid row automatically stretch to the tallest peer. Side-by-side sub-panels inside a parent also equalize. Bars at the same index in sibling sub-panels are equalized to the tallest bar at that index, so rows align horizontally. All automatic — no flag needed.
- **Sibling sub-panel alignment.** When defining side-by-side sub-panels, ensure they have the same internal structure: same number of bars, same heading style, same row gaps. The engine equalizes bar heights and total frame heights, but different internal row counts or heading sizes will cause horizontal drift between siblings.