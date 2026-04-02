# LLM Handoff Context

## Repo orientation

| Role | Path |
|------|------|
| Primary workspace | `diagram-generation` (this repo) |
| Local icon library | `assets/icons/` |
| Font source | `assets/UbuntuSans[wdth,wght].ttf` |
| Draw.io style reference | `diagrams/0.reference/_BRND-3284.drawio.svg` |
| General on-brand visual reference | `diagrams/0.reference/onbrand-reference.png` |
| Single-box block reference | `diagrams/0.reference/sample.svg` |
| 3x block preview | `diagrams/0.reference/sample.png` |
| Reusable SVG starter | `diagrams/0.reference/onbrand-svg-starter.svg` |
| Illustrator-safe sanitizer | `scripts/svg_illustrator_sanitize.py` |
| Canonical draw.io exporter | `scripts/export_drawio_batch.py` |
| Memory-wall draw.io wrapper | `scripts/export_memory_wall_drawio.py` |
| Draw.io import-test batch | `draw.io/*-onbrand.drawio` |
| Initial source diagram | `diagrams/1. input/redo-this-image-onbrand.png` |
| Completed output set | `diagrams/2.output/` |
| Workflow reference repo | sibling `baseline-foundry` (read-only unless user says otherwise) |

## Quick start

1. Read `docs/TODO.md`.
2. Read `docs/AGENT-INBOX.md` and triage it.
3. Inspect `diagrams/0.reference/sample.svg`, `diagrams/0.reference/sample.png`, `diagrams/0.reference/onbrand-svg-starter.svg`, and `diagrams/2.output/memory-wall-onbrand.svg` first, then `diagrams/0.reference/_BRND-3284.drawio.svg`, before making visual changes.
4. Treat newer outputs as helpful only if they still match the canonical palette, alignment, and scale rules in `docs/TODO.md`.
5. Validate edited SVGs for syntax errors after each significant pass.

## Current state

This repo is now structured for bulk on-brand diagram redesign work around the user-updated starter block. `diagrams/0.reference/sample.svg` remains the clean single-block Illustrator export that establishes the preferred block-and-arrow feel, and `diagrams/0.reference/sample.png` remains the clearer 3x preview of the same block. The stricter working geometry now comes from `diagrams/0.reference/onbrand-svg-starter.svg`: text is top-left aligned with an `8px` inset on both axes, but the live SVG placement now respects the Ubuntu Sans ascent so the visible top of the text sits `8px` below the box top rather than drifting with raw SVG baseline defaults. Icon artboards sit top-right with the same `8px` inset, the baseline box is still `192px` wide and at least `64px` tall, three-line boxes grow to `72px`, and longer boxes continue in `8px` height steps rather than shrinking the copy. The current type ladder is explicit: `16px` regular, then `16px` bold, then `16px` small-caps with `0.05em` tracking, then `24pt` regular, `24pt` bold, and `24pt` small-caps; explanatory/helper copy stays at the body size and shifts only in color to `#666666`. Orange connectors remain literal line-plus-triangle geometry, drawn behind the boxes they connect to, and direct box-to-box arrows are now expected to land midpoint-to-midpoint on the relevant box sides. The main output set has been refreshed to this system: `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `attention-qkv-onbrand.svg`, `logic-data-vram-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, and `gpu-waiting-scheduler-onbrand.svg` now all follow the updated inset, height, helper-text, and icon-placement rules. `diagrams/2.output/memory-wall-onbrand.svg` is still the canonical exemplar for icon placement, palette, the side-icon-cluster treatment for compound inputs, and literal embedded geometry. `scripts/generate_remaining_diagrams.py` is the main shared SVG generator for the refreshed batch, `scripts/svg_illustrator_sanitize.py` remains part of the required path for deliverables because it strips external `@font-face` links, expands internal `<symbol>/<use>` reuse into real geometry, and flags linked-image hazards, and `scripts/export_drawio_batch.py` is now the current draw.io batch exporter. The current draw.io batch is `draw.io/memory-wall-onbrand.drawio`, `draw.io/request-to-hardware-stack-onbrand.drawio`, `draw.io/inference-snaps-onbrand.drawio`, `draw.io/rise-of-inference-economy-onbrand.drawio`, `draw.io/gpu-waiting-scheduler-onbrand.drawio`, `draw.io/logic-data-vram-onbrand.drawio`, and `draw.io/attention-qkv-onbrand.drawio`. The important draw.io finding from this session is now explicit: editable exports must keep every text-bearing box and panel as native `mxCell` geometry with native draw.io text, and reserve inline `data:image/svg+xml,...` cells for icons or genuinely special non-text shapes only. The remaining work is visual review and draw.io import validation rather than a pending redesign queue.

## Where to look

| What | Where |
|------|-------|
| Active tasks + principles + architecture | `docs/TODO.md` |
| Longer-term stages + throughput direction | `docs/product-roadmap.md` |
| Completed work log | `docs/history.md` |
| User inbox | `docs/AGENT-INBOX.md` |

## Key files

| Purpose | File |
|---------|------|
| Canonical exemplar for current rules | `diagrams/2.output/memory-wall-onbrand.svg` |
| Current vertical stack output on the scaled-up system | `diagrams/2.output/request-to-hardware-stack-onbrand.svg` |
| Wide infographic exemplar on the scaled-up system | `diagrams/2.output/rise-of-inference-economy-onbrand.svg` |
| Sparse request-flow exemplar on the scaled-up system | `diagrams/2.output/gpu-waiting-scheduler-onbrand.svg` |
| Current four-panel attention exemplar | `diagrams/2.output/attention-qkv-onbrand.svg` |
| Grouped package/layout exemplar | `diagrams/2.output/inference-snaps-onbrand.svg` |
| Output set | `diagrams/2.output/` |
| Wider redraw on the refreshed starter system | `diagrams/2.output/logic-data-vram-onbrand.svg` |
| Style reference export | `diagrams/0.reference/_BRND-3284.drawio.svg` |
| Draw.io export prototype | `draw.io/memory-wall-onbrand.drawio` |
| Broader visual reference | `diagrams/0.reference/onbrand-reference.png` |
| Reusable style/arrow defs starter | `diagrams/0.reference/onbrand-svg-starter.svg` |
| Source sketch/image | `diagrams/1. input/redo-this-image-onbrand.png` |
| Font file | `assets/UbuntuSans[wdth,wght].ttf` |
| Icon source library | `assets/icons/` |

## Critical invariants (do not regress)

- Outputs should remain editable SVG, not raster wrappers.
- Use the local Ubuntu Sans Variable file at `assets/UbuntuSans[wdth,wght].ttf` and the local icon library at `assets/icons/`.
- Deliverable SVGs should use `font-family: 'Ubuntu Sans', sans-serif` without a file-path `@font-face` rule so Illustrator does not create relink dependencies.
- For new work, use the sample-based block system: `192px` wide, at least `64px` tall, `1px` box stroke, `16px` regular block text, and local icons embedded at their natural `48x48` size.
- Keep block text top-left aligned, even for single-line labels, with an `8px` inset on both X and Y, measured from the visible top of the text rather than the raw baseline.
- Keep right-side icons top-right aligned by their `48px` artboard with the same `8px` inset, and rely on direct embedded geometry rather than internal SVG reuse.
- Prefer hierarchy by weight before hierarchy by size: move from `16px` regular to `16px` bold, then `16px` small-caps with `0.05em` tracking before introducing another size.
- The current scaled-up type ladder is `16px` body text, then `24pt` as the next size step when more hierarchy is genuinely needed, followed by the same bold/small-caps progression at `24pt`.
- Use `8px` inset/padding as the shared internal spacing token for both text and icons.
- Size boxes from the icon outward: natural icon height plus `16px` total vertical padding, so the current `48px` icon set maps to `64px`-tall boxes, and add `8px` of height for each text line beyond two so three-line boxes become `72px`.
- Borderless grouping pads and dashed containers still need `8px` internal padding on every side; they should not end flush with the boxes they group.
- If a box uses a side icon cluster rather than a single in-box icon, keep those icons at the same natural-size treatment as the rest of the system.
- Use the literal Illustrator-style orange arrow treatment from `sample.svg`: one `1px` orange line plus one filled triangle head, with the tip landing on the destination edge.
- Boxes default to white with black borders; `#F3F3F3` is the standard accent fill; a single black-filled box with white text is still allowed when a true highlight is needed.
- When helper notes are necessary in the new system, keep them plain and default them to `16px` regular in `#666666` unless the user explicitly asks for another scale.
- `14px` belongs to the older pre-scale-up system and should be treated as legacy-only in current new work.
- If a separator sits between two stacked boxes, keep it centered in the gap and match it to the box width unless the source clearly asks for a wider span.
- The `Memory wall` node is the current canonical semantic exception: it keeps jagged top and bottom edges rather than using the standard rectangle.
- The older compact `144x26` / `128x26` / `9px` system still matters only when maintaining already-finished legacy outputs.
- Box and arrow strokes should both stay at `1px`.
- Text inside boxes is strictly left-aligned.
- The default type system for new work is `16px` regular block text, with `24pt` as the next size step when a larger hierarchy cue is genuinely needed.
- Box fills default to white; `#F3F3F3` is the standard accent fill; at most one black-filled box with white text is allowed when clearly justified.
- Orange is reserved for connectors and arrowheads only; do not use orange-filled boxes.
- Orange arrows are `#E95420` with explicit `1px` shafts and filled heads, matching draw.io semantics more than generic SVG marker styling.
- Reuse the canonical block and arrow geometry from `diagrams/0.reference/onbrand-svg-starter.svg` so box outlines stay `1px` and orange arrows keep the same proportions across the library.
- Draw orange connectors behind the boxes they attach to so the destination box edge is not visually interrupted.
- Embed every arrowhead, icon, and mini-grid as literal geometry in the SVG. Do not ship `<symbol>`, `<use>`, external `<image href="...">`, or marker refs in deliverable files.
- For draw.io deliverables, use raw `mxfile` / `mxGraphModel` XML with native editable `mxCell` rectangles, labels, groups, and edges for every text-bearing box, panel, or notation widget.
- Inline `data:image/svg+xml,...` image cells are allowed only for icons or genuinely special non-text shapes such as the jagged memory-wall panel or request-icon cluster; do not use `shape=image` as a shortcut for visible boxes, text panels, or labeled notation widgets.
- For draw.io deliverables, attach box-to-box connectors with real `source` / `target` references and explicit `entry` / `exit` anchors so moving a box carries its arrows with it.
- For draw.io deliverables, set `adaptiveColors="none"` on the page model and explicit light-theme `fontColor` / `fillColor` values on text-bearing cells so dark mode does not invert the diagram.
- Orange connectors should land cleanly from box edge to box edge; do not point them into free-floating helper text.
- Give arrowheads enough visual mass and enough lead-in shaft length that the connector still reads clearly in exported screenshots.
- Prefer straight or orthogonal connectors with `90` degree turns; detangle or reroute paths rather than crossing them.
- When a legend is needed, use an evenly spaced marker-and-label row.
- Explanatory notes should usually be plain helper text, not extra bordered callout boxes, unless the note itself is a semantic node.
- Icons must come only from `assets/icons/`, and they should sit flush right in the established in-box rhythm. If no suitable icon exists, omit the icon.
- Before finalizing a diagram, run an icon-coverage pass across the whole composition; do not stop after one obvious icon if additional major nodes or repeated semantic tiles have reasonable matches in `assets/icons/`.
- Before finalizing a diagram, run a full source-content audit so small handwritten labels from the input are not dropped during cleanup.
- Avoid truncation; if the copy wants more room, widen the box or panel rather than shrinking the text.
- Preserve a grid feel in grouped layouts by aligning enclosing widths and stacked boxes rather than centering unrelated widths arbitrarily.
- Run `scripts/svg_illustrator_sanitize.py --write <svg>` before considering a deliverable complete.
- Keep style decisions in the canonical docs, not in ad hoc chat-only notes.
