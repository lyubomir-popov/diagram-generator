# Diagram Redesign Plan

## Goal

Provide a cold-start-safe workflow and a consistent on-brand SVG system for redesigning batches of diagrams quickly, without re-deriving the style language from chat history every time.

## Scope

**In:** source-image intake, reference inspection, SVG redraws, icon selection from local assets, typography/layout normalization, reference-scaled proportions, workflow documentation, completed-work archiving.

**Out:** ad hoc extra markdown status files, new visual systems invented per diagram, non-local icon sourcing unless explicitly requested, rasterized final deliverables by default.

## Principles

1. Cold starts must be reliable: the next agent should not need prior chat context to continue.
2. Reference first: `diagrams/0.reference/sample.svg`, `diagrams/0.reference/sample.png`, and the user-updated `diagrams/0.reference/onbrand-svg-starter.svg` now define the canonical new-work block, arrow proportion, and overall visual weight; `diagrams/0.reference/_BRND-3284.drawio.svg` remains a secondary connector/layout reference.
3. For new diagrams, build from the sample block system: literal geometry, live text, natural-size local icons, and no hidden SVG reuse constructs.
4. Reuse exact style snippets: `diagrams/0.reference/onbrand-svg-starter.svg` is now the copy source for the canonical block proportions, inset rhythm, and literal orange arrow geometry.
5. Editable SVG over screenshots or embedded raster exports.
6. Typography for new diagrams follows the scaled-up sample system by default: `16px` regular live text is the body size, and the next size step is `24pt`; do not reintroduce the old `14px` size into new work.
7. Orange is reserved for arrows and arrowheads; boxes do not get orange fills.
8. Geometry stays tight and reference-scaled; do not casually upscale diagrams.
9. Use local icons only, and omit the icon entirely when no suitable icon exists in `assets/icons/`.
10. The current canonical output exemplar is `diagrams/2.output/memory-wall-onbrand.svg`; inspect it before treating any other output as precedent.
11. Canonical status lives only in the five workflow files.

## Architecture

### Current diagram style playbook

- Font source: `assets/UbuntuSans[wdth,wght].ttf`
- Illustrator-safe font rule: final editable SVGs should use `font-family: 'Ubuntu Sans'` by name only; do not ship a file-path `@font-face` rule in deliverables
- Canonical new-work block: `192px` wide and at least `64px` tall, with a `1px` outer border and a centered vertical orange arrow built from a literal line plus triangle
- `diagrams/0.reference/sample.png` is the clearer 3x raster preview of that same block, at `576x345`
- Block text alignment: always top-left aligned, even when the label is only one line
- Block text inset: `x=8`, `y=8` from the visible top of the text, not from the raw baseline; place live text by ascent so the ascenders sit `8px` below the box top
- Block text size: `16px`, weight `400`, sentence case by default
- Typography economy rule: prefer hierarchy by weight before hierarchy by size; go from `16px` regular to `16px` bold, then `16px` small-caps with `0.05em` tracking before introducing another size; if a larger step is genuinely needed use `24pt`, then `24pt` bold, then `24pt` small-caps with the same tracking
- Explanatory/helper copy stays at the body size rather than shrinking; use `16px` regular with `#666666`
- Local icons are embedded at their natural `48x48` size with no SVG scaling tricks
- Icon placement: align the icon artboard top-right with an `8px` inset from the box interior; do not center icons vertically within the box
- Box height rule: use the natural icon height plus `2 * 8px` padding, so the current `48px` icons require a `64px`-tall box; three-line boxes are `72px` tall, and longer boxes should keep rounding up in `8px` steps rather than shrinking text or tightening inset
- If a diagram uses a side icon cluster rather than a single in-box icon, keep those icons at the same natural-size treatment as the rest of the system; do not miniaturize them into a separate visual scale
- `14px` belongs to the older pre-scale-up system and should be treated as legacy-only rather than introduced into new diagrams
- If hierarchy needs a larger step than `16px`, use `24pt`; for semantic tiles or primary labels, first try `16px` with line breaks, bold/regular contrast, or small-caps before changing size
- Black box outlines: `1px`, `stroke-miterlimit: 10`, no rounded corners by default
- Default box fill: white
- Accent box fill: `#F3F3F3`
- Optional high-emphasis box: black fill with white text, used sparingly and at most once in a diagram when clearly justified
- Orange usage: arrows and arrowheads only, color `#E95420`
- Arrow construction: literal `1px` shaft + filled triangle head, matching the Illustrator-exported treatment from `diagrams/0.reference/sample.svg`
- Reuse the canonical arrow geometry from `diagrams/0.reference/onbrand-svg-starter.svg` or `diagrams/0.reference/sample.svg`; do not freehand alternate head sizes per diagram
- Arrow layer order: draw orange connectors behind the boxes they connect to, so the box edge stays visually intact
- Arrow routing: prefer straight or orthogonal connectors; avoid crossed connectors
- Connectors should run cleanly from source box edge midpoint to destination box edge midpoint; do not terminate arrows into loose helper copy
- Keep connected box gaps and arrow spans consistent inside a diagram; do not let one stack or row drift to a different arrow gap without a clear reason
- Borderless grouping pads still need `8px` internal padding on every side; do not let the grey substrate or dashed frame end flush with the boxes it contains
- Arrowheads should be visibly sized at export scale, with enough shaft length before the head that the connector still reads clearly
- Illustrator-safe structure: do not use `<symbol>`, `<use>`, external `<image href="...">`, or marker refs such as `marker-start="url(#...)"` in deliverable SVGs
- Embed every arrowhead, icon, and mini-grid directly as literal paths/groups in the document so Illustrator sees real geometry instead of internal references
- For now, treat the older `144x26` / `128x26` / `9px` system as legacy maintenance guidance for already-finished diagrams, not the default for new redraws
- Right-side icons: use only local icons, embedded directly, in the established natural-size lane
- If no local icon is semantically appropriate, omit the icon rather than inventing or sourcing a new one
- Run an explicit icon-coverage pass before calling a diagram done: check every major node and repeated semantic tile against `assets/icons/`, and prefer adding a reasonable local icon rather than leaving the diagram icon-sparse by accident
- For cold starts, do not stop after placing one or two obvious icons; audit the whole composition so icon density feels intentional and library-driven, not incidental
- Transfer all source text, including small labels in the sketch; icons may be omitted when the library lacks a match, but text should not be silently dropped
- Avoid truncation by widening boxes or panels when needed; do not squeeze copy to preserve a too-narrow layout
- Preserve a grid feeling: if one box sits over two or more aligned boxes, size the upper box or enclosing panel so their outer edges line up cleanly instead of reading as a centered stack of unrelated widths
- When a legend is needed, use an evenly spaced marker-and-label row
- Explanatory notes should default to plain helper text rather than an extra bordered box unless the note is itself a semantic node
- Separator lines: literal requested pattern, not approximate substitutions
- If a separator sits between two stacked boxes, keep it centered in the gap and match it to the box width unless the source clearly asks for a wider span
- `Memory wall` is the current canonical semantic exception: it keeps jagged top and bottom edges rather than a plain rectangle
- `diagrams/2.output/memory-wall-onbrand.svg` is the current canonical implementation checkpoint for alignment, palette, icon placement, and scale
- Run `scripts/svg_illustrator_sanitize.py` before treating a deliverable as done; it expands internal symbol reuse, strips external font URLs, and flags linked-image hazards
- Draw.io XML export is anchored to the local sample set: use raw `<mxfile>` / `<mxGraphModel>` output, native `mxCell` rectangles, text labels, groups, and edges for every text-bearing box, panel, or notation widget so the result stays editable in draw.io
- Inline `data:image/svg+xml,...` image cells are still allowed for icons and genuinely special non-text shapes such as the jagged memory-wall panel or request-icon cluster, but never as a shortcut for a full text-bearing box, panel, or labeled notation widget
- `scripts/export_drawio_batch.py` is the current canonical draw.io exporter, `scripts/export_memory_wall_drawio.py` now delegates to it, and `draw.io/*-onbrand.drawio` is the current import-test batch
- For draw.io outputs, direct box-to-box connectors should be real attached edges with `source` and `target` cell ids plus explicit `entry` / `exit` anchors, not loose point-only lines
- If a diagram section is too branched for a perfect one-cell reconstruction, keep the visible boxes and text native and editable first; only the non-text ornament around them may fall back to an image cell
- For draw.io outputs, force light rendering by writing `adaptiveColors="none"` on the `mxGraphModel` and explicit `fontColor` / `fillColor` values on text-bearing cells

### Current process for each diagram

1. Inspect the source asset, `diagrams/0.reference/sample.svg`, `diagrams/0.reference/sample.png`, `diagrams/0.reference/onbrand-svg-starter.svg`, and `diagrams/2.output/memory-wall-onbrand.svg` first; use `diagrams/0.reference/_BRND-3284.drawio.svg` as a secondary reference.
2. Identify whether a suitable local icon exists in `assets/icons/`; if not, plan for no icon.
3. Build or adapt an SVG at the established reference scale.
4. Match text alignment, box fills, strokes, icon placement, and arrow behavior to the documented style playbook, including the exact `8px` text/icon inset and the rule that connectors sit behind the boxes.
5. Do a final typography audit: if more than one main text size appears, verify that weight contrast or small-caps at `16px` was considered first and that any size change uses the current `24pt` step rather than the legacy `14px` one.
6. Do a final content audit against the source sketch so small labels or technology names were not dropped during cleanup.
7. Do a final icon audit against `assets/icons/` so major nodes and repeated semantic tiles are not left icon-light without a conscious reason.
8. Run `scripts/svg_illustrator_sanitize.py --write <svg>` so the file is symbol-free and free of external font URLs.
9. Validate the SVG for syntax issues.
10. If the user wants a draw.io output, emit raw mxGraph XML with native editable `mxCell` boxes/text first, use embedded `data:` image cells only for icons or special non-text shapes, then XML-parse the result locally before handing it off.
11. Record meaningful new conventions in the canonical docs if they generalize.

## Active TODO

- [ ] Re-audit the refreshed starter-block batch in Illustrator: `diagrams/2.output/memory-wall-onbrand.svg`, `diagrams/2.output/request-to-hardware-stack-onbrand.svg`, `diagrams/2.output/inference-snaps-onbrand.svg`, `diagrams/2.output/attention-qkv-onbrand.svg`, `diagrams/2.output/logic-data-vram-onbrand.svg`, `diagrams/2.output/rise-of-inference-economy-onbrand.svg`, and `diagrams/2.output/gpu-waiting-scheduler-onbrand.svg`.
- [ ] Import-test the current `draw.io/*-onbrand.drawio` batch in draw.io and note any renderer mismatches versus the SVG canonicals.
- [ ] Keep refining the reusable style playbook as more diagram types appear.
- [ ] Re-audit the generator helpers whenever the user adjusts the starter block so the output set does not drift back into mixed inset or line-height rules.
