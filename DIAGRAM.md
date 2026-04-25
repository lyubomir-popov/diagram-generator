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
  notes: The imported dense application-doc tier remains the reference layer, but the current diagram-tier pilot restores `16px` body text with `20px` line height to preserve the proportion between live text and `48px` icons.
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
    fontSize: 16px
    fontWeight: 400
    lineHeight: 20px
  diagram-body-strong:
    fontFamily: Ubuntu Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 20px
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
  group-gap: 16px
  row-gap: 24px
  connected-gap: 24px
  grid-gutter: 24px
  outer-margin: 32px
  body-line-step: 20px
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
  terminal-bar:
    height: 64px
    chromeHeight: 20px
  matrix-widget:
    size: 48px
    headerHeight: 20px
  memory-wall-panel:
    fill: "{colors.surface-accent}"
    edgeTreatment: jagged-top-bottom
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

Typography is live text first. The current working system is intentionally small:

- The imported dense application and documentation reference tier remains `14px` Ubuntu Sans regular with a `20px` baseline-snapped line height.
- The current diagram-tier pilot restores main diagram copy to `16px` with a `20px` line height so text keeps the right proportion against the standard `48px` icon treatment.
- The first hierarchy step is still weight, not size: `400`, then `600`, then small-caps with `0.05em` tracking.
- When size must change, stay on the modular scale: `18px/24px` for section labels, then `24px/32px` for major titles.
- No heading or body label in a diagram should fall below `14px` without an explicit accessibility reason.
- Terminal-style command bars use Ubuntu Sans Mono or a compatible mono fallback at the same body size.
- Because diagrams currently align most naturally with dense application surfaces, nudge tokens remain `0` and alignment is enforced at the block level first.
- The `diagram-tier` treatment is currently a pilot used to retune glitch-prone grouped layouts before wider rollout.

Text is positioned by ascent rather than by raw baseline guessing. The visible top of the text sits `8px` below the top edge of the box.

## Layout & spacing

The layout model uses a `4px` baseline unit, with most block geometry stepping in `8px` rhythm increments and grid-level separation using the application gutter.

- Default new-work box width is `192px`.
- Default box height is at least `64px`, matching the `48px` icon plus `8px` padding above and below.
- Taller boxes should be derived from the text stack and then snapped to whole `4px` baseline units rather than hard-coded per diagram.
- Text is always top-left aligned.
- Text and icons both use an `8px` inset.
- Right-side icons align to the top-right by artboard, not vertical center.
- Use `24px` as the default grid-level gap between peer boxes or rows; reserve `8px` and `16px` for tighter in-panel grouping.
- Grouping pads and borderless substrates still keep `8px` internal padding.

Preserve a grid feeling. If a parent box or panel sits above aligned children, size it so the outer edges align rather than reading as a centered stack of unrelated widths.

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
- Do not terminate arrows into floating helper text.

The primary question for connector quality is whether the routing still reads clearly if the user inspects the raw XML or moves the boxes in draw.io.

## Components

The reusable component set is intentionally small.

- Default box: white fill, black stroke, live text.
- Accent box: `#F3F3F3` fill, black stroke, live text.
- Emphasis box: black fill, white text, used only when a true highlight is needed.
- Diagram-tier box copy: `16px/20px` live text, used when the denser imported tier makes labels feel too small relative to icons.
- Helper note: unboxed `14px` helper text.
- Terminal command bar: grey body with `20px` chrome strip, separator line, and mono text.
- Matrix widget: explicit top label band above the grid.
- Memory wall panel: jagged semantic exception.

Use icons from `assets/icons/` only. If no local icon matches the concept, omit the icon rather than sourcing or inventing a new one.

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