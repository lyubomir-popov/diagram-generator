# Lightning talk — diagram pipeline mention

Short slot (~5 minutes). The pipeline isn't the whole talk; it's one slide / one beat inside a wider talk. Use it as concrete proof that "design system as code" is paying off.

## One-line pitch

I stopped redrawing diagrams. I describe them in code, and one pipeline produces both an editable draw.io file and an Illustrator-safe SVG, on brand by default.

## Talking points (pick the ones that fit the slot)

- The recurring problem: rough sketches, off-brand mockups, LLM-generated diagrams — hours of cleanup, inconsistent results.
- One source of truth in code: shared primitives, two renderers, one command (`python scripts/build_outputs.py`).
- Tokenized cells + a batch style-sync tool: I can change the design system *after* the diagrams are shipped and roll it forward across the whole set.
- A tracked draw.io shape library so non-designers can start a diagram on brand themselves.
- Hierarchy by weight before size; orange for connectors only; icons natural-size or absent.

## Suggested slide order

1. Title: "Diagrams, on brand and editable"
2. Before/after pair (use the memory-wall redraw)
3. Pipeline diagram: input → shared primitives → draw.io + SVG → sanitizer → shipped assets
4. Token + style-sync demo (one screenshot of a dry-run output: matched / changed counts)
5. Shape library screenshot
6. Closing line: "The brand is something the tools enforce, not something I have to remember."

## Cuttable beats

If the slot shrinks to 2 minutes, drop slides 3 and 4 and keep before/after, library, closing line.

## Assets to gather

- Memory-wall before/after pair
- Screenshot of the draw.io library panel
- Screenshot of `drawio_style_sync.py` dry-run output
