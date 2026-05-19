---
version: alpha
name: Diagram Generator diagram language
description: Diagram-specific design language contract for editable, on-brand SVG and draw.io outputs. Structured to align with DESIGN.md-style tokens and prose, and now mapped to the dense application and documentation tiers from canonical-specs so diagram geometry can inherit the same type, spacing, and grid logic.
sourceSpecs:
  typography: ../canonical-specs/specs/type scale/draft.md
  spacing: ../canonical-specs/specs/spacing/draft.md
  grid: ../canonical-specs/specs/grid/draft.md
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
    baselineUnit: 8px
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
  baseline-unit: 8px
  unit: 8px
  rhythm-step: 8px
  inset: 8px
  panel-padding: 8px
  icon-inset: 8px
  compact-gap: 8px
  grid-gutter: 24px
  outer-margin: 24px
  body-line-step: 24px
  heading-line-step: 24px
  title-line-step: 32px
grid:
  baseline-unit: 8px
  unit: 8px
  rhythm-step: 8px
  column-counts: [4, 8, 16]
  span-rule: power-of-2 fractions only
  application-gutter: 24px
  application-outer-margin: 24px
  default-box-width: 192px
  default-box-min-height: 64px
  default-box-growth-step: 8px
  icon-size: 48px
components:
  box-default:
    width: 192px
    minHeight: 64px
    growthStep: 8px
    paddingX: 8px
    paddingY: 8px
    fill: "{colors.surface-default}"
    stroke: "{colors.ink}"
    strokeWidth: 1px
  box-accent:
    width: 192px
    minHeight: 64px
    growthStep: 8px
    paddingX: 8px
    paddingY: 8px
    fill: "{colors.surface-accent}"
    stroke: "{colors.ink}"
    strokeWidth: 1px
  box-emphasis:
    width: 192px
    minHeight: 64px
    growthStep: 8px
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
    arrowClearance: 8px
    minArrowSegment: 16px
    arrowExitClearance: 8px
    arrowGap: 24px
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
    fill: "no stroke, filled background with INSET padding"
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

### Casing

All diagram text uses **sentence case**: capitalize the first word and proper nouns only. Do not use Title Case for headings, labels, or annotations.

- ✅ "Android graphics runtime", "Host-side tools", "System composition and display policy"
- ❌ "Android Graphics Runtime", "Host-Side Tools", "System Composition And Display Policy"

Exceptions: product names ("Anbox Cloud", "SurfaceFlinger"), acronyms ("GPU", "API", "SELinux"), and text that the source explicitly styles differently. When in doubt, use sentence case.

### Scale

- Body copy: `18px` Ubuntu Sans regular with `24px` line height (modular-scale step up from editorial-tier `16px`, sized to fill `192px` boxes alongside `48px` icons).
- First hierarchy step is weight: `400` → `600`.
- Second step is small-caps: `600` weight with `0.05em` tracking.
- When size must change, stay on the modular scale: `24px/32px` for major titles.
- No heading or body label should fall below `16px` without an explicit accessibility reason.
- Terminal-style command bars use Ubuntu Sans Mono or a compatible mono fallback at the same body size.

### Text positioning

Text is positioned by ascent, not by raw baseline guessing. The visible top of the text sits `INSET` (`8px`) below the top edge of the box.

### Box anatomy – non-negotiable spatial contract

Every text-bearing box follows exactly one layout: **text top-left, icon top-right**. There are no alternative arrangements, no "icon-primary" variants, and no centred layouts.

```
┌─────────────────────────────────┐
│ 8px                        8px  │
│   Label text         [48×48]    │
│   (top-left,          icon      │
│    regular weight)   (top-right)│
│                            8px  │
│ 8px                             │
└─────────────────────────────────┘
```

- **Text anchor:** top-left corner, `INSET` (`8px`) from both the top and left edges. Text is always left-aligned. Never centre, never right-align.
- **Icon anchor:** top-right corner, `INSET` (`8px`) from both the top and right edges. Icons sit at their natural `48×48` size. Never centre an icon horizontally or vertically within the box.
- **No icon-above-text layouts.** The `StackedBlock` component type was removed because it violated this rule. Do not reintroduce centred icon arrangements under any name.
- **No centring of any kind.** Do not vertically centre single-line labels. Do not horizontally centre text. Do not centre icons. The top-left / top-right anchor is the only permitted placement.
- **Multi-line labels** stay top-left aligned. Extra box height grows downward; the text anchor does not move.

When a box has no icon, the text still anchors top-left — the right side of the box is simply empty.

## Layout & spacing

### Baseline grid

Every dimension in a diagram — positions, sizes, padding, gaps — must be an exact multiple of the `8px` baseline unit. No exceptions. No "close enough." If a value does not land on the grid, snap it up to the nearest multiple.

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

### Project purpose

This repo owns a diagram generator with grid-based layout, nested groups, boxes, gutters, and connector arrows.

The generator must produce clean, repeatable diagrams from structured input. It is not meant to rely on hand-positioned approximations, one-off offsets, or visual guesswork that only happens to look correct in one export.

### Nested group alignment model

For nested or grouped diagrams, use exactly one alignment model:

- The top-level grid is a staging aid, not a master law that every row must literally inherit.
- Child boxes inside a grouped row should usually be derived from an equal split of the parent content width.
- The outer group container is a wrapper or outset around that row-level split.
- Group padding absorbs the difference between the child row and the wrapper edge.
- Horizontal and vertical structural gutters must stay on the configured gutter tokens.
- Rows with 2, 3, or 5 columns can still align cleanly if they share the same parent width logic, gutter tokens, and wrapper outdents.

Do not mix alignment models. Do not sometimes align the wrapper to the grid and sometimes align the children. That inconsistency is the root cause of the recurring nested-gutter bug.

Treat grouped layout math this way:

```
parent_content_width = parent_outer_width - group_pad_left - group_pad_right
child_col_width      = (parent_content_width - ((child_count - 1) × child_col_gap)) / child_count
group_outer_width    = (child_count × child_col_width)
                     + ((child_count - 1) × child_col_gap)
                     + group_pad_left + group_pad_right
```

If a parent row changes from 2 children to 3 or 5, the child widths should be recomputed from the same parent content span and the same gutter token. The visual alignment comes from consistent splitting and consistent outdents, not from forcing every row onto a single global column count.

Current implementation note: the engine now supports parent-scoped equal splitting, but the implementation is still mixed between the Python renderer and the preview relayout path. The main fragility is inconsistent inheritance of resolved gutters and outdents, not the existence of wrapper-based equal splitting itself.

### Group styling invariant

The default grouped-panel style is the repo's borderless grey group treatment:

- grey background
- no dashed border
- no heavy visible stroke
- readable title and text
- normal child boxes inside the group

Use this in definitions as `Panel(fill=Fill.GREY, border=Border.FILL)` or the YAML equivalent.

Where the style lives:

- `scripts/diagram_model.py`: `Border.FILL` is the semantic switch for a filled, no-stroke group wrapper.
- `scripts/diagram_layout.py`: `_layout_panel()` and `_render_component()` convert `Border.FILL` into a padded grey wrapper with `stroke="none"`.
- `scripts/diagram_render_svg.py` and `scripts/diagram_render_drawio.py`: render the resulting no-stroke filled rects.

`Border.DASHED` is not the default grouped style. Use it only when a dashed frame is explicitly requested for debugging or for a legacy diagram whose semantics genuinely require a dashed frame. Do not treat old dashed examples as the preferred nested-group pattern.

### Gutters and grid rules

These values matter because grouped layouts fail when they are eyeballed instead of measured.

Token values:

- `baseline-unit` = `8px`
- horizontal structural gutter token = `grid-gutter` = `24px`
- vertical structural gutter token = `grid-gutter` = `24px` unless a diagram explicitly sets another `row_gap`
- outer margin token = `24px`
- compact internal gap token = `8px`, only for tightly packed non-structural content
- default standalone box width token = `192px`

Derived values:

- child widths inside groups
- row heights from content
- group padding / wrapper outset
- wrapper outer width from child grid + derived padding

Column calculation rules:

1. Top-level grid columns come from `Diagram.cols` plus either `col_width` or `canvas_width`.
2. Child boxes inside a grouped row should usually be computed from the parent content width by equal splitting, not by forcing them to match a separate global grid column.
3. If a group contains fewer or more children than a neighboring row, preserve the same parent width logic and gutter tokens so the rows still align cleanly through their outer edges and consistent outdents.
4. Nested groups inherit or reference the parent row's structural gutter tokens. They do not invent a new structural gutter lane unless the diagram explicitly declares one.

Row calculation rules:

1. Row heights come from content and are snapped to the `8px` baseline.
2. Vertical gutters between structural rows must stay on the configured `row_gap` token.
3. Equal-height behavior is a derived convenience, not a license to move rows off token spacing.

Measure gutters numerically and verify them with screenshots. Do not accept a layout because it "looks about right".

### Arrow-routing diagnostic rule

If an arrow starts, turns unnecessarily, then continues down or across to reach a midpoint, treat that as a layout or anchor-calculation smell.

Before patching the arrow route, inspect:

- source bounds
- target bounds
- source anchor
- target anchor
- group wrapper bounds
- child bounds
- whether the arrow is anchoring to the wrong hierarchy level
- whether the router is compensating for misaligned geometry

The preferred fix is almost always to correct the layout geometry or anchor selection. Do not add arbitrary routing offsets first.

### Arrow label primitive

Arrow labels are not grid cells.

- Use the `Arrow.label` field when a connector needs explanatory copy.
- Arrow labels are free-positioned primitives offset from the routed arrow by `GRID_GUTTER` unless `label_gap` overrides it.
- The label should avoid overlaps with boxes, panels, and other blocking geometry.
- When the existing route leaves no room for the label, reroute the arrow to create room instead of shoving the text into the nearest grid slot.

Current implementation status:

- `scripts/diagram_model.py` exposes `Arrow.label` and `Arrow.label_gap`.
- `scripts/diagram_layout.py` places an `ArrowLabelPrimitive` off the routed segment and can add a small fallback detour when the current path has nowhere clean to place the text.
- Arrow labels are intentionally exempt from baseline-grid validation because they are geometry-aware annotations, not grid-snapped box content.

Use arrow labels for connector copy such as flow names or edge semantics. Do not fake them with helper rows or by burning an entire grid field next to an arrow.

### Dashed separator primitive

Use `Separator` for a thin dashed divider that should not consume a full box-height row.

- `Separator` is a lightweight dashed line primitive, not a content box.
- Its row should size to the separator itself rather than defaulting to `BOX_MIN_HEIGHT`.
- It should not be treated as a blocking box for arrow-label placement.

Current implementation status:

- Top-level grid rows now size from actual content first, so separator-only rows stay thin.
- The SVG and draw.io renderers both emit dashed separator geometry without requiring a fake bordered box.

### Verification workflow

Playwright is required for visual verification.

For any grouped-layout or arrow-routing change:

1. Generate the diagram.
2. Open it in the browser, preferably through `python scripts/preview_server.py --slug <slug> --grid`.
3. Take a screenshot with Playwright.
4. Inspect the screenshot for:
  - equal horizontal gutters
  - equal vertical gutters
  - child boxes split cleanly within the intended parent width
  - group wrappers correctly outset around children
  - borderless grey group styling
  - clean arrow routing
  - no unnecessary arrow bends or doglegs
  - arrow labels offset from the connector rather than jammed into a grid slot
  - thin separators that do not create fake box-height gaps
5. Iterate until the screenshot is correct.

Do not mark the task complete without a screenshot-based check.

Useful commands:

- `python scripts/build_v2.py`
- `python scripts/_audit_v2.py`
- `python scripts/_compare_3way.py`
- `python scripts/preview_server.py --slug <slug> --grid`

### Known failure modes

Record these as real regressions, not stylistic nits:

- dashed group wrappers aligned to the same grid as standalone boxes, causing nested children to become too narrow
- inconsistent gutters between child boxes
- group padding unequal on left and right
- mixed parent-width splitting rules between adjacent rows or between build and preview
- arrow routes with unnecessary doglegs
- arrows anchoring to group wrappers when they should anchor to child boxes, or vice versa
- arrow labels overlapping boxes or riding directly on the arrow shaft
- separator rows consuming full box-height gaps
- visual fixes made with arbitrary offsets instead of fixing the layout model

### Regression cases

Any layout rewrite or grouped-layout fix should be checked against at least these cases:

- one group with two children
- one group with three children
- mixed grouped and standalone boxes on the same row
- vertical stacking between grouped and standalone rows
- arrows from standalone to grouped items
- arrows between children inside groups
- arrows from grouped children to items outside the group
- different horizontal and vertical gutter settings

### Current implementation status

What currently works:

- top-level declarative grid placement is stable and baseline-snapped
- the preview server and compare pages are usable review surfaces
- renderer/exporter integration for SVG and draw.io remains intact
- recent Python changes restored borderless grey grouped panels for `example-platform-architecture`
- separator-only rows now stay thin instead of inflating to default box height
- arrow labels now exist as free-positioned connector annotations rather than grid-snapped text hacks
- component-tree metadata now captures measured child gutters, so preview relayout preserves inherited horizontal gaps better

What was recently fixed:

- `scripts/diagram_layout.py` now outsets top-level panels against the parent grid cell instead of leaving the wrapper flush on the same bounds as standalone boxes
- `scripts/diagrams/example_platform_architecture.py` was moved from dashed wrappers to the grey `Border.FILL` group style
- top-level grid rows now derive height from actual content, which fixes separator-only rows
- `Arrow.label` / `Arrow.label_gap` plus `ArrowLabelPrimitive` now provide an initial non-grid arrow-label path with overlap-aware placement
- component-tree layout metadata now measures rendered child gaps so preview relayout keeps inherited `24px` gutters instead of defaulting grouped rows to `0px`

What remains fragile:

- `scripts/preview/component-model.js` still reconstructs layouts from current child geometry rather than a fully shared declarative parent-split model, so nested interactive relayout can still drift from the Python renderer
- parent-scoped equal splitting, consistent outdents, and declared spans still need a cleaner single-source implementation across build and preview
- some legacy diagrams and library surfaces still expose dashed-group patterns that should not be copied into new grouped layouts

Relevant code:

- `scripts/diagram_model.py`
- `scripts/diagram_layout.py`
- `scripts/preview/component-model.js`
- `scripts/preview/editor.js`
- `scripts/diagrams/example_platform_architecture.py`

How to run the main checks:

- preview: `python scripts/preview_server.py --slug example-platform-architecture --grid`
- build: `python scripts/build_v2.py`
- audit: `python scripts/_audit_v2.py`
- Playwright screenshot review: use the preview server or compare page in the browser and capture screenshots there

### Cold-start instructions for future agents

Read this file before changing layout code.

- Do not assume dashed group boxes are correct.
- Use parent-scoped equal splitting with consistent gutters and wrapper outdents for nested groups.
- Preserve the configured gutter tokens.
- Verify with Playwright screenshots.
- Treat arrow doglegs as layout smells.
- Treat arrow labels as free-positioned primitives, not grid cells.
- Avoid arbitrary offsets.
- Document any new invariant discovered during debugging.

Recommended read order for a cold start on layout work:

1. `DIAGRAM.md` — this section plus the arrow-clearance and equal-height sections below.
2. `README.md` — preview and validation commands.
3. `.github/skills/diagram-redraw/SKILL.md` — the operational redraw checklist.

**For a text box (no icon):**

```
box_height = INSET + (line_count × line_step) + INSET
           → snap to baseline unit
```

A 1-line box at `18px/24px`: `8 + 24 + 8 = 40px` → `40px` (already on grid).
A 2-line box: `8 + 48 + 8 = 64px` → `64px`.

The current engine still clamps text-only boxes to the canonical `BOX_MIN_HEIGHT` of `64px`, so a 1-line no-icon box stays `64px` for consistency with the rest of the current block system.

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

After layout, run `validate_grid(result)` to verify every coordinate and dimension is a multiple of the `8px` baseline unit. The validator checks:

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

The system uses exactly two gap scales.

| Token | Value | Use |
|-------|-------|-----|
| `baseline-unit` | `8px` | Atomic grid step; all dimensions must be multiples |
| `inset` | `8px` | Padding inside boxes, panels, and all containers |
| `compact-gap` | `8px` | Gap between tightly grouped peer boxes within a panel (no arrows) |
| `grid-gutter` | `24px` | Structural gap between columns/rows at any nesting level; equals `arrow-gap` so arrows can route through any structural gutter |
| `outer-margin` | `24px` | Margin from diagram edge to first content |
| `default-box-width` | `192px` | Standard box width |
| `icon-size` | `48px` | Standard icon artboard |
| `body-line-step` | `24px` | Line height for `18px` body text |

**Gutter consistency rule:** the same `grid-gutter` value (24px) must be used at every nesting level for structural column and row gaps. A nested wrapper's internal `col_gap` between sub-panels must match the outer grid's `col_gap`. This keeps the vertical gutter lane continuous through the entire diagram. Only use `compact-gap` (8px) for tightly packed boxes within a single panel where no arrows route.

### Text containment

Every text element — labels, helper notes, headings — must fit entirely within its parent container, or be positioned entirely outside it. No text may cross or overlap a container border.

Before placing text inside a container, verify: `text_y + (line_count × line_step) ≤ container_y + container_height - inset`. If it does not fit, enlarge the container (re-derive from inside-out model), reposition the text, or move the text outside as a standalone helper note.

**Width budget rule:** the layout engine does not auto-wrap text within a `Line`. Each `Line` of text must fit within the available horizontal space:

- **With icon:** `col_width − 2 × INSET − ICON_SIZE − ICON_INSET` = `col_width − 72` px.
- **Without icon:** `col_width − 2 × INSET` = `col_width − 16` px.

If a heading or body line exceeds this budget, increase `col_width`, split the line across multiple `Line` objects, or remove the icon. The default `192px` box width is only sufficient for short labels — text-heavy boxes with icons need at least `280px` column width.

### Row equalization for mixed-type rows

When a grid row contains both Panels (tall, with children) and standalone Boxes (short, content-sized), enable `uniform_rows=True` on the Diagram to equalize all row heights. Without equalization, arrows between peers at different heights route with vertical bends and arrowheads that appear parallel to the target edge rather than perpendicular.

### Panel children type ordering

The layout engine processes Box children before Panel children within a parent Panel. All Boxes are placed in the grid first; all sub-Panels are placed below the box grid. To control vertical ordering, keep all children as the same type. If a Panel needs a nested sub-group followed by a standalone item (or vice versa), flatten the sub-group into Boxes (`border=Border.FILL` for grey-background headings) so the engine respects `row` indices.

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
- Force-layout exception: when a diagram is explicitly using a force layout and straight or orthogonal routing would make the graph harder to read, spline connectors are allowed. Keep the same orange `1px` stroke, filled head, and edge-to-edge anchoring; use curvature only to clarify the graph, not as decoration.
- Draw connectors behind the boxes they terminate into so the destination edge remains visually continuous.
- Do not terminate arrows into floating helper text. When an annotation needs an arrow connection, use a borderless `Box` (`borderless=True`) instead of a `Helper` so the box participates in grid sizing and provides proper edge anchors.

### Fan-in merge

When multiple source boxes feed into a single destination box, the individual arrow shafts must merge into a shared trunk before reaching the target:

1. Each source arrow exits its box orthogonally and routes to a common **merge point** on the trunk axis.
2. From the merge point a single trunk segment extends to the destination box, arriving at a **90-degree angle** to the destination edge.
3. The trunk carries the arrowhead; the individual feeder shafts do not have their own arrowheads.
4. Place the merge point far enough from the destination that the trunk segment satisfies `MIN_ARROW_SEGMENT` (`16px`).
5. Keep feeder shafts orthogonal — use right-angle bends to reach the trunk axis, not diagonal runs.

This pattern reduces visual clutter and makes the flow direction unambiguous. It mirrors the draw.io `blockThin` multi-source merge behavior.

### Arrow clearance

Every arrow's **last segment** (the one carrying the arrowhead) must be at least `MIN_ARROW_SEGMENT` (`16px`) long. This guarantees a visible shaft at least as long as the arrowhead before the arrow reaches the target box. Without this clearance the arrowhead overlaps the destination box edge and the diagram looks broken.

The **first segment** (exiting the source box) must be at least `ARROW_EXIT_CLEARANCE` (`8px`) so the shaft is visibly departing the source edge.

| Token | Value | Purpose |
|-------|-------|---------|
| `ARROW_CLEARANCE` | `8px` | Minimum visible shaft on approach (box edge → arrowhead base) |
| `MIN_ARROW_SEGMENT` | `16px` | Minimum last-segment length (`ARROW_CLEARANCE` + head) |
| `ARROW_EXIT_CLEARANCE` | `8px` | Minimum first segment leaving the source |
| `ARROW_GAP` | `24px` | Minimum gap between rows/columns where arrows route (`MIN_ARROW_SEGMENT` + `ARROW_EXIT_CLEARANCE`) |

**Practical rule:** any `row_gap` or `col_gap` through which an arrow routes must be ≥ `ARROW_GAP` (`24px`).

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

Every text-bearing component – boxes, terminal bars, and grouped panels – must use the same `8px` inset from the nearest visible edge. Do not introduce component-specific inset overrides unless the visual structure genuinely requires it. When a component has a non-text header band (such as the terminal chrome strip), the text area begins at the bottom of that band, and the `8px` inset is measured from there.

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
- Repo-wide draw.io style changes should flow through `scripts/drawio_style_presets.py` and `scripts/drawio_style_sync.py` against generator-tagged cells, not through manual paste-style passes or library-only edits.
- The tracked draw.io library is a reuse aid for new insertions; it does not retroactively update shapes that already exist in diagrams.

## Workflow application

Apply the system in this order:

1. Read this file, then inspect the governing references in `docs/specs.md`.
2. Inspect the source sketch plus the local reference assets before making layout decisions.
3. Check `assets/icons/` early so icon intent is planned rather than added opportunistically at the end.
4. Build the draw.io and SVG outputs from the shared primitives and canonical geometry.
5. When a repo-wide draw.io style token changes, apply the matching preset through `scripts/drawio_style_sync.py` instead of restyling existing `.drawio` files by hand.
6. Audit typography, icon coverage, and source-text completeness before calling the diagram done.
7. Sanitize changed deliverable SVGs with `scripts/svg_illustrator_sanitize.py --write <svg>`.
8. Rebuild compare pages when a new diagram or review lane changes.
9. Record generalized rule changes here rather than expanding `TODO.md` with permanent style prose.

## Do's and don'ts

Do:

- Use the local icon library only.
- Keep text live and editable.
- Use the `8px` baseline unit consistently.
- Prefer hierarchy by weight before size.
- Keep box and arrow geometry explicit and inspectable.

Don't:

- Introduce orange box fills.
- Shrink helper text to solve spacing problems.
- Center single-line labels vertically just because there is spare height.
- Add hidden SVG reuse constructs to final deliverables.
- Treat `TODO.md` as the home for permanent design-language rules.