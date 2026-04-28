---
version: alpha
name: Diagram Generator diagram language
description: Diagram-specific design language contract for editable, on-brand SVG and draw.io outputs. Structured to align with DESIGN.md-style tokens and prose, and now mapped to the dense application and documentation tiers from canonical-spacing-spec so diagram geometry can inherit the same type, spacing, and grid logic.
sourceSpecs:
  typography: ../canonical-spacing-spec/specs/type scale/draft.md
  spacing: ../canonical-spacing-spec/specs/spacing/draft.md
  grid: ../canonical-spacing-spec/specs/grid/draft.md
  importedTier: applications
  adoptedTier: diagram
  rolloutStatus: pilot
  notes: The imported dense application-doc tier remains the reference layer, but the current diagram-tier pilot uses `18px` body text with `24px` line height to preserve the proportion between live text and `48px` icons inside `192px`-wide boxes.
colors:
  ink: "#000000"
  surface-default: "#FFFFFF"
  surface-accent: "#F3F3F3"
  text-primary: "#000000"
  text-helper: "#666666"
  connector: "#E95420"
  emphasis-surface: "#000000"
  emphasis-text: "#FFFFFF"
typography:
  root:
    fontFamily: Ubuntu Sans
    fontSize: 14px
    fontSizeRem: 0.875rem
    baselineUnit: 4px
    nudge: 0px
  body:
    fontFamily: Ubuntu Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  diagram-body:
    fontFamily: Ubuntu Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 24px
  diagram-body-strong:
    fontFamily: Ubuntu Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
  body-strong:
    fontFamily: Ubuntu Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  body-smallcaps:
    fontFamily: Ubuntu Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0.05em
    fontFeature: '"smcp" 1'
  heading:
    fontFamily: Ubuntu Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
  heading-regular:
    fontFamily: Ubuntu Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 24px
  title:
    fontFamily: Ubuntu Sans
    fontSize: 24px
    fontWeight: 500
    lineHeight: 32px
  title-strong:
    fontFamily: Ubuntu Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
  helper:
    fontFamily: Ubuntu Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  mono-body:
    fontFamily: Ubuntu Sans Mono, Ubuntu Mono, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
spacing:
  baseline-unit: 4px
  unit: 4px
  rhythm-step: 8px
  inset: 8px
  panel-padding: 8px
  icon-inset: 8px
  compact-gap: 8px
  grid-gutter: 32px
  outer-margin: 32px
  body-line-step: 24px
  heading-line-step: 24px
  title-line-step: 32px
grid:
  baseline-unit: 4px
  unit: 4px
  rhythm-step: 8px
  column-counts: [4, 8, 16]
  span-rule: power-of-2 fractions only
  application-gutter: 24px
  application-outer-margin: 32px
  default-box-width: 192px
  default-box-min-height: 64px
  default-box-growth-step: 4px
  icon-size: 48px
components:
  box-default:
    width: 192px
    minHeight: 64px
    growthStep: 4px
    paddingX: 8px
    paddingY: 8px
    fill: "{colors.surface-default}"
    stroke: "{colors.ink}"
    strokeWidth: 1px
  box-accent:
    width: 192px
    minHeight: 64px
    growthStep: 4px
    paddingX: 8px
    paddingY: 8px
    fill: "{colors.surface-accent}"
    stroke: "{colors.ink}"
    strokeWidth: 1px
  box-emphasis:
    width: 192px
    minHeight: 64px
    growthStep: 4px
    fill: "{colors.emphasis-surface}"
    textColor: "{colors.emphasis-text}"
  icon-default:
    size: 48px
    placement: top-right
    inset: 8px
  connector-default:
    stroke: "{colors.connector}"
    strokeWidth: 1px
    arrowHeadLength: 10.8408px
    arrowHeadHalfWidth: 2.9053px
    arrowClearance: 12px
    minArrowSegment: 24px
    arrowExitClearance: 8px
    arrowGap: 32px
  terminal-bar:
    height: 64px
    chromeHeight: 20px
  matrix-widget:
    size: 48px
    headerHeight: 20px
  jagged-panel:
    fill: "{colors.surface-accent}"
    edgeTreatment: jagged-top-bottom
    notes: Replaces legacy `memory-wall-panel`. Alias `MemoryWall` kept for backward compatibility.
  annotation:
    fill: "{colors.surface-default}"
    border: none
    paddingX: 8px
    paddingY: 8px
    notes: Anchored annotation text. Participates in grid sizing and arrow anchoring. Replaces legacy `Helper`.
  icon-cluster:
    iconSize: 48px
    gap: 4px
    notes: Inline cluster of one or more icons. Replaces legacy `IconComponent` and `RequestCluster`.
  border-modes:
    solid: "1px #000000"
    dashed: "1px #000000 dashed"
    none: no visible border
    notes: Applies to Box and Panel via `border` field. Replaces legacy `borderless`, `frameless`, `dashed` booleans.
---

# Diagram Generator diagram language

This file is the canonical diagram-language contract for this repo.

It is intentionally modeled after the plain-text, token-plus-prose shape of `DESIGN.md`, but focused on technical diagrams rather than app UI. The YAML frontmatter is the future ingest target for broader typography, spacing, and grid specs from the design language. The markdown body explains how those tokens should be applied in this repo's SVG and draw.io outputs.

## Overview

The visual system should feel precise, editorial, and infrastructure-aware rather than decorative. Diagrams should read as deliberate artifacts: clean geometry, live text, stable spacing, and clear connector logic. The goal is not novelty per diagram. The goal is a reusable system that makes rough sources legible, on-brand, and editable.

The default posture is conservative:

- Prefer consistent rhythm over per-diagram improvisation.
- Prefer editability over visual tricks.
- Prefer explicit geometry over hidden SVG reuse or opaque image payloads.
- Prefer local references and local assets over inferred styling.

## Colors

The palette is intentionally narrow.

- Boxes default to white or the standard accent grey `#F3F3F3`.
- Black is reserved for outlines, text, and occasional emphasis boxes with white text.
- Orange `#E95420` is reserved for connectors and arrowheads only.
- Helper or explanatory copy shifts only in color, to `#666666`, not to a smaller type scale.

When in doubt, reduce color usage rather than expanding it.

## Typography

Typography is live text first. The diagram system inherits the editorial tier's paired-heading model from the upstream type spec, where **weight at the same font size creates a distinct hierarchical level**.

### Hierarchy model

The hierarchy ladder, from highest to lowest visual weight at any given size:

1. **Heading / structural label** — `weight 600–700`. Used for panel titles ("Logic + data conflict"), section labels ("VRAM fragmentation"), and frame headings ("Inference snaps"). These are structural signposts.
2. **Body label** — `weight 400` (regular). Used for box content labels ("CPU", "Logic", "Memory", "Data"). These are the default for every box that is not itself a heading.
3. **Helper / annotation** — `weight 400`, `fill #666666`. Used for explanatory notes. Hierarchy is expressed only by color shift, never by shrinking the size.

Bold at the same font size is a hierarchical level above regular. Do not make every box label bold — that flattens the hierarchy and makes real headings invisible. Only panel headings and frame titles use bold; individual box labels use regular weight.

### Scale

- Body copy: `18px` Ubuntu Sans regular with `24px` line height (modular-scale step up from editorial-tier `16px`, sized to fill `192px` boxes alongside `48px` icons).
- First hierarchy step is weight: `400` → `600`.
- Second step is small-caps: `600` weight with `0.05em` tracking.
- When size must change, stay on the modular scale: `24px/32px` for major titles.
- No heading or body label should fall below `16px` without an explicit accessibility reason.
- Terminal-style command bars use Ubuntu Sans Mono or a compatible mono fallback at the same body size.

### Text positioning

Text is positioned by ascent, not by raw baseline guessing. The visible top of the text sits `INSET` (`8px`) below the top edge of the box.

## Layout & spacing

### Baseline grid

Every dimension in a diagram — positions, sizes, padding, gaps — must be an exact multiple of the `4px` baseline unit. No exceptions. No "close enough." If a value does not land on the grid, snap it up to the nearest multiple.

This is a non-negotiable constraint. It replaces all previous guidance about "preserving a grid feeling" or "stepping in rhythm increments." The grid is not a suggestion — it is the coordinate system.

### No ad-hoc positioning

Ad-hoc pixel values are banned. Every coordinate must be derived from:

- Named grid variables (`col_xs`, `row_ys`, `panel_inset`, `row_gap`)
- Computed container dimensions (see inside-out box model below)
- Explicit token values from the spacing section of the YAML frontmatter

A cold-start agent should never eyeball a position or tweak a number to "look right." If the position is wrong, the grid parameters are wrong — fix the parameters, not the output.

### Inside-out box model

Containers are the sum of their contents. Size from the inside out, never from the outside in.

### Sizing constraints

The Diagram model supports optional sizing constraints that make output dimensions predictable and uniform across a batch of diagrams.

| Field | Effect |
|-------|--------|
| `canvas_width` | Fixed output width in pixels. Column widths are derived from: `col_width = (canvas_width − 2 × margin − (cols − 1) × gutter) / cols`. Content-driven column growth is suppressed. |
| `canvas_height` | Fixed output height in pixels. Optional — when omitted, height is content-driven. |
| `uniform_rows` | When `True`, all grid rows are equalized to the tallest row's height. Useful for creating a regular Müller-Brockmann grid where all modules are the same size. |
| `col_width` | Explicit column width. When both `canvas_width` and `col_width` are set, `canvas_width` takes precedence. |

**When to use `canvas_width`:** when multiple diagrams must share the same output width, or when you want a true proportional grid with equal columns.

**When to use `uniform_rows`:** when rows should form a regular grid of equal-height modules, regardless of content. Note that content must still fit — uniform rows enlarge smaller rows but never shrink larger ones.

### Auto-fill

Sub-panels inside a parent panel no longer need manual `col_width` derivation. The layout engine auto-derives child widths from the parent's available content span:

```
parent_content  = parent_cell − 2 × INSET
child_count     = N
child_outer     = (parent_content − (N − 1) × inner_gap) / N
child_col_width = child_outer − 2 × child_INSET
```

This eliminates the nesting tax calculations that previously had to be done by hand. If a sub-panel has an explicit `col_width`, it is respected; otherwise the engine auto-fills.

Auto-fill triggers when the parent cell is wider than `BLOCK_WIDTH` (192px) — i.e. when the grid has been explicitly sized via `col_width` or `canvas_width`. Panels in default-sized cells use `BLOCK_WIDTH` to avoid inflating diagrams that rely on content-driven width.

### Grid participants vs wrappers

Not every visible rectangle is a grid participant. Distinguish two roles:

| Role | Examples | Alignment rule |
|------|----------|----------------|
| **Grid participant** | Standalone boxes, panels that own a grid cell | Outer edges define the grid column/row boundaries. Peer participants share column edges. |
| **Wrapper** | Dashed grouping frames, frameless layout containers | Outer edges are **derived** from children + inset. A wrapper does not impose its own width on the grid – it wraps around content that is already grid-aligned. |

**The key invariant:** when a wrapper and standalone boxes sit in the same outer column, the wrapper's **outer** width must equal the standalone box width so edges stay flush. Derive the wrapper's child widths from the outer constraint, not the other way around.

### Nesting and alignment rules

Every container introduces an INSET offset. Nesting levels compound: a box inside a sub-panel inside a wrapper panel has 3 levels of INSET between its content and the diagram edge. When child panels sit inside a multi-span wrapper, their outer edges are offset from the outer grid by the wrapper's INSET, and this offset is **expected and intentional** – the children are visually contained.

**Single-column wrapper** (wrapper occupies exactly one grid column):

```
wrapper_outer_width  = peer_box_width          (e.g. 608)
wrapper_content_span = wrapper_outer_width − 2 × INSET   (e.g. 592)
child_col_width      = (wrapper_content_span − (cols − 1) × col_gap) / cols
```

**Multi-span wrapper** (wrapper spans N grid columns):

When a wrapper spans N outer grid columns, its children will be inset from the outer grid. To align child panels with the outer grid columns, **the child panels must absorb the wrapper's INSET**. The formula:

```
wrapper_outer     = N × outer_col_width + (N − 1) × outer_col_gap
wrapper_content   = wrapper_outer − 2 × INSET
child_count       = N  (one child per outer column)
child_outer_width = (wrapper_content − (child_count − 1) × inner_col_gap) / child_count
```

The child outer width will always be less than the outer column width by `(2 × INSET + (child_count − 1) × (inner_col_gap − outer_col_gap)) / child_count`. **This is the nesting tax.** Accept it as the cost of the frame, or use `border=Border.NONE` (frameless, pad=0) to eliminate it.

**Example: logic-data-vram VRAM section**

```
outer_col_width  = 408
outer_col_gap    = 32
wrapper_outer    = 2 × 408 + 32 = 848
wrapper_content  = 848 − 16 = 832
inner_col_gap    = 32  (for arrow routing)
child_outer      = (832 − 32) / 2 = 400

Nesting tax = 408 − 400 = 8px per child
```

The sub-panels are 8px narrower than the top panels. The left sub-panel starts 8px to the right of the top-left panel (wrapper INSET), and the right sub-panel ends 8px to the left of the top-right panel.

**Practical checklist for wrappers:**

1. Decide the wrapper's outer width from the outer grid (match peer boxes or the diagram column).
2. Subtract `2 × INSET` to get the content span.
3. Divide the content span among child columns and gaps.
4. Size children inside-out for height, but use the derived column width for width.
5. **Do not hardcode `col_width` on sub-panels independently.** The layout engine auto-derives sub-panel widths from the wrapper's content span when `canvas_width` or an explicit `col_width` is set on the diagram. Manual derivation is only needed if auto-fill is disabled or for documentation.
6. Verify the wrapper's computed outer width equals the peer boxes' width.
7. Accept the nesting INSET offset, or use `border=Border.NONE` to eliminate it.

**For a text box (no icon):**

```
box_height = INSET + (line_count × line_step) + INSET
           → snap to baseline unit
```

A 1-line box at `18px/24px`: `8 + 24 + 8 = 40px` → `40px` (already on grid).
A 2-line box: `8 + 48 + 8 = 64px` → `64px`.

There must be no dead space below the last text line. If the text only needs `36px`, the box is `36px`, not `64px`.

**For a text box with icon:**

```
box_height = max(text_box_height, INSET + ICON_SIZE + INSET)
           → snap to baseline unit
```

With a `48px` icon: `8 + 48 + 8 = 64px`. A 1-line-with-icon box is `64px`. A 3-line-with-icon box: `max(8 + 72 + 8, 64) = 88px`.

**For a panel containing child boxes:**

```
panel_height = INSET
             + heading_row_height
             + heading_gap
             + (n_rows × row_height) + ((n_rows - 1) × row_gap)
             + INSET
           → snap to baseline unit
```

The panel width follows the same logic from columns. Never hardcode a panel size and then try to fit children inside it.

**For a panel heading row (bold title, optional icon):**

```
heading_row_height = tight_box_height(title_lines, has_icon)
```

The heading is just another box — its height comes from its content, not from an arbitrary constant.

**For a bar (horizontal segmented strip):**

```
bar_height = max(explicit_height, INSET + text_height + INSET)
           → snap to baseline unit
```

A bar with `18px` text: `max(32, 8 + 21.6 + 8) = max(32, 40) = 40px`. The model's `height` field is a minimum floor, not a fixed value — if the text needs more space, the bar grows. This ensures balanced top and bottom padding in every bar segment.

### Grid validation

After layout, run `validate_grid(result)` to verify every coordinate and dimension is a multiple of the `4px` baseline unit. The validator checks:

- All `Rect` positions and sizes (boxes, bars, panel frames)
- All `TextBlock` anchor positions (but not font-metric-derived baselines)
- All `Icon` positions
- All `Arrow` start/end points
- Canvas width and height

Bar segment `width_px` values in diagram definitions must be multiples of 4. Non-aligned values will be flagged as violations.

### Grid variables per panel

When a panel contains multiple boxes, define its internal grid before placing anything:

1. **Columns.** Decide count and width. Write as `col_xs = [inset, inset + col_width + col_gap, ...]`.
2. **Rows.** First content row starts after heading. Subsequent rows step by `row_height + row_gap`. Write as `row_ys = [first_row_y, first_row_y + step, ...]`.
3. **All boxes** use these arrays for position. `box(panel_x + col_xs[c], panel_y + row_ys[r], col_width, ...)`.
4. **Parent dimensions** are computed from the grid, not the other way around.

When sibling panels contain semantically parallel content, synchronize their row heights so rows read across.

### Equal-height equalization

The layout engine automatically equalizes heights at three levels:

1. **Grid-row equalization.** In a GRID arrangement, each row height is the maximum of all single-row-span components in that row. Panels and boxes stretch their frames to fill the full cell height, so peer panels in the same row are always the same height.
2. **Sub-panel equalization.** When a parent panel contains side-by-side child panels (the `sub_panels` path), the engine measures all sub-panels first, then stretches shorter ones to match the tallest. This keeps paired containers (e.g. "Fragmented layout" / "Packed layout") visually balanced.
3. **Bar equalization across siblings.** Bars at the same index in sibling sub-panels are equalized to the tallest bar at that index before layout. Empty bar segments get the same height as text-bearing ones at the same position, so rows align horizontally across side-by-side panels.

All three mechanisms are automatic — no opt-in flag is needed. Content stays top-aligned; the extra height appears as whitespace at the bottom of the shorter component's frame.

### Spacing tokens

The system uses exactly two gap scales. There is no middle ground — 16px and 24px gaps have been eliminated.

| Token | Value | Use |
|-------|-------|-----|
| `baseline-unit` | `4px` | Atomic grid step; all dimensions must be multiples |
| `inset` | `8px` | Padding inside boxes, panels, and all containers |
| `compact-gap` | `8px` | Gap between tightly grouped peer boxes within a panel (no arrows) |
| `grid-gutter` | `32px` | Structural gap between columns/rows at any nesting level; equals `arrow-gap` so arrows can route through any structural gutter |
| `outer-margin` | `32px` | Margin from diagram edge to first content |
| `default-box-width` | `192px` | Standard box width |
| `icon-size` | `48px` | Standard icon artboard |
| `body-line-step` | `24px` | Line height for `18px` body text |

**Gutter consistency rule:** the same `grid-gutter` value (32px) must be used at every nesting level for structural column and row gaps. A nested wrapper's internal `col_gap` between sub-panels must match the outer grid's `col_gap`. This keeps the vertical gutter lane continuous through the entire diagram. Only use `compact-gap` (8px) for tightly packed boxes within a single panel where no arrows route.

### Text containment

Every text element — labels, helper notes, headings — must fit entirely within its parent container, or be positioned entirely outside it. No text may cross or overlap a container border.

Before placing text inside a container, verify: `text_y + (line_count × line_step) ≤ container_y + container_height - inset`. If it does not fit, enlarge the container (re-derive from inside-out model), reposition the text, or move the text outside as a standalone helper note.

## Shapes

The shape language is square and explicit.

- Boxes use `1px` black outlines with `stroke-miterlimit: 10`.
- Rounded corners are not the default.
- Dashed grouping frames may be used to communicate intake or review boundaries.
- The `Memory wall` node is the semantic exception that keeps jagged top and bottom edges.

Special shapes should stay rare. If a plain rectangle can carry the meaning cleanly, use the plain rectangle.

## Connectors & flow

Connectors are part of the language, not decoration.

- Orange connectors are literal `1px` shafts plus filled triangle heads.
- Reuse the canonical arrow geometry from `diagrams/0.reference/sample.svg` or `diagrams/0.reference/onbrand-svg-starter.svg`.
- Connectors should run from midpoint to midpoint, edge to edge.
- Prefer straight or orthogonal routing.
- Draw connectors behind the boxes they terminate into so the destination edge remains visually continuous.
- Do not terminate arrows into floating helper text. When an annotation needs an arrow connection, use a borderless `Box` (`borderless=True`) instead of a `Helper` so the box participates in grid sizing and provides proper edge anchors.

### Arrow clearance

Every arrow's **last segment** (the one carrying the arrowhead) must be at least `MIN_ARROW_SEGMENT` (`24px`) long. This guarantees a visible shaft at least as long as the arrowhead before the arrow reaches the target box. Without this clearance the arrowhead overlaps the destination box edge and the diagram looks broken.

The **first segment** (exiting the source box) must be at least `ARROW_EXIT_CLEARANCE` (`8px`) so the shaft is visibly departing the source edge.

| Token | Value | Purpose |
|-------|-------|---------|
| `ARROW_CLEARANCE` | `12px` | Minimum visible shaft on approach (box edge → arrowhead base) |
| `MIN_ARROW_SEGMENT` | `24px` | Minimum last-segment length (`ARROW_CLEARANCE` + head) |
| `ARROW_EXIT_CLEARANCE` | `8px` | Minimum first segment leaving the source |
| `ARROW_GAP` | `32px` | Minimum gap between rows/columns where arrows route (`MIN_ARROW_SEGMENT` + `ARROW_EXIT_CLEARANCE`) |

**Practical rule:** any `row_gap` or `col_gap` through which an arrow routes must be ≥ `ARROW_GAP` (`32px`). For panels that only have straight (same-column) arrows, `24px` is sufficient. For fan-out or Z-bend arrows (different source and target columns), use `32px`.

The layout engine auto-routes Z-bends with the bend biased toward the source so the approach segment gets the full `MIN_ARROW_SEGMENT`. The `validate_arrows()` post-layout check catches any segment that is still too short.

The primary question for connector quality is whether the routing still reads clearly if the user inspects the raw XML or moves the boxes in draw.io.

## Components

The reusable component set is intentionally small. Every component follows the inside-out box model — height is computed from content, never hardcoded with dead space.

### Core types

- **Box**: the fundamental building block. White fill, black 1px stroke, regular-weight live text. Height = `INSET + (lines × line_step) + INSET`, snapped to baseline unit. Supports `fill` (WHITE, GREY, BLACK), `icon`, and `border` (SOLID, DASHED, NONE).
- **Panel**: structural container with optional heading, icon, and child components. Supports `border` (SOLID, DASHED, NONE) and `fill`. Panels with `border=Border.NONE` are frameless layout containers.
- **Arrow**: orange connector between components, referenced by `source` and `target` anchor strings.
- **Annotation**: anchored annotation text that participates in grid sizing and arrow anchoring. Default `fill=WHITE`, `border=NONE`. Use when the annotation needs an arrow connection or must match a peer box's height.
- **JaggedPanel**: semantic exception with jagged top and bottom edges (e.g. memory wall). Alias `MemoryWall` kept for backward compatibility.
- **IconCluster**: inline cluster of one or more icons at natural `48px` size, spaced by `4px` gap.
- **Terminal**: command bar with chrome strip, separator, and mono text.
- **MatrixWidget**: labeled grid tile with a top header band.
- **Bar / BarSegment**: horizontal segmented strip for memory or capacity visualisations.
- **Legend / LegendEntry**: marker-and-label row for color keys.
- **Separator**: horizontal divider between grid rows.

### Border modes

The `Border` enum replaces the legacy `borderless`, `frameless`, and `dashed` boolean flags:

| Border | Appearance | Use case |
|--------|-----------|----------|
| `SOLID` | 1px black stroke (default) | Standard boxes and panels |
| `DASHED` | 1px black dashed stroke | Grouping frames, optional boundaries |
| `NONE` | No visible stroke | Frameless layout containers, annotations |

### Deprecated types (backward compatible)

These types are still importable but should not be used in new definitions:

- **Helper** → use `Annotation`
- **IconComponent** → use `IconCluster(icons=["name.svg"])`
- **RequestCluster** → use `IconCluster(icons=[...])`
- **MemoryWall** → use `JaggedPanel`
- `Box(borderless=True)` → use `Box(border=Border.NONE)` or `Annotation`
- `Panel(frameless=True)` → use `Panel(border=Border.NONE)`
- `Panel(dashed=True)` → use `Panel(border=Border.DASHED)`

Use icons from `assets/icons/` only. If no local icon matches the concept, omit the icon rather than sourcing or inventing a new one.

### Internal spacing consistency

Every text-bearing component – boxes, terminal bars, grouped panels, and stacked tiles – must use the same `8px` inset from the nearest visible edge. Do not introduce component-specific inset overrides unless the visual structure genuinely requires it. When a component has a non-text header band (such as the terminal chrome strip), the text area begins at the bottom of that band, and the `8px` inset is measured from there.

## Editability & outputs

Both output lanes must remain editable.

For SVG:

- Final deliverables must be Illustrator-safe.
- Do not ship `<symbol>`, `<use>`, external `<image href="...">`, or marker references.
- Final deliverables should reference `font-family: 'Ubuntu Sans', sans-serif` by family name only.

For draw.io:

- Text-bearing boxes, panels, and notation widgets stay native editable `mxCell` geometry.
- Image-backed cells are allowed for icons and genuinely special non-text ornaments only.
- Direct connectors should use attached edges with `source` and `target` ids plus explicit `entry` and `exit` anchors.
- Exports should force light rendering with `adaptiveColors="none"` and explicit fill and font colors.

## Workflow application

Apply the system in this order:

1. Read this file, then inspect the governing references in `docs/specs.md`.
2. Inspect the source sketch plus the local reference assets before making layout decisions.
3. Check `assets/icons/` early so icon intent is planned rather than added opportunistically at the end.
4. Build the draw.io and SVG outputs from the shared primitives and canonical geometry.
5. Audit typography, icon coverage, and source-text completeness before calling the diagram done.
6. Sanitize changed deliverable SVGs with `scripts/svg_illustrator_sanitize.py --write <svg>`.
7. Rebuild compare pages when a new diagram or review lane changes.
8. Record generalized rule changes here rather than expanding `TODO.md` with permanent style prose.

## Do's and don'ts

Do:

- Use the local icon library only.
- Keep text live and editable.
- Use the `4px` baseline unit consistently, with `8px` rhythm steps for most block geometry.
- Prefer hierarchy by weight before size.
- Keep box and arrow geometry explicit and inspectable.

Don't:

- Introduce orange box fills.
- Shrink helper text to solve spacing problems.
- Center single-line labels vertically just because there is spare height.
- Add hidden SVG reuse constructs to final deliverables.
- Treat `TODO.md` as the home for permanent design-language rules.