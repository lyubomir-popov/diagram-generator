# Outline — Diagrams, on brand and editable

Target: ~1500 words. Audience: wider organisation / design + product stakeholders. Tone: plain, confident, evidence-led.

## Working title options

- Diagrams, on brand and editable
- From sketch to system: a diagram pipeline
- One pipeline for every diagram

## Key claims (must stay verifiable)

- Tokenized generator emits both editable draw.io and Illustrator-safe SVG from one shared design system
  - `scripts/diagram_shared.py`, `scripts/build_outputs.py`, `scripts/export_drawio_batch.py`, `scripts/generate_remaining_diagrams.py`, `scripts/svg_illustrator_sanitize.py`
- Reusable draw.io shape library at `assets/drawio/diagram-generator-primitives.mxlibrary` (10 primitives)
- Token + provenance metadata on every generated cell (`data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, `tags`)
- Batch style-sync tool at `scripts/drawio_style_sync.py` — token-aware rewrites across the whole set
- Protected manual-edit workflow via `scripts/drawio_review_workflow.py` (review copy → checkpoint → promote)
- Current canonical exemplar: `diagrams/2.output/svg/memory-wall-onbrand.svg`

## Suggested structure (~1500 words)

1. **Hook (~120 w)** — the recurring problem: rough sketches, off-brand mockups, LLM-generated diagrams; hours of manual cleanup, inconsistent results.
2. **Why this matters (~150 w)** — design culture angle: cohesion, systematic thinking, rigour, cross-product consistency.
3. **Goal (~120 w)** — one pipeline, any input, on-brand editable output, no per-diagram improvisation.
4. **How it works (~400 w)** — shared tokens → two renderers (draw.io + SVG) → sanitizer → tracked shape library → style-sync tool → protected manual lane.
5. **A walkthrough (~250 w)** — pick one diagram (memory wall) and trace it from input to draw.io + SVG, with a before/after image.
6. **Design-system payoffs (~250 w)** — typography hierarchy by weight first, 8px rhythm, single arrow geometry, accessible color use, rationale for icon omission over invention.
7. **What stakeholders get (~150 w)** — faster turnaround, editable handoff, consistent visuals, batch restyling instead of one-off fixes.
8. **What's next (~60 w)** — Illustrator + draw.io import audits, piloting the review-copy workflow on existing manually-edited files.

## Assets to gather

- Before/after pair for the hero image (likely memory wall)
- Screenshot of the draw.io shape library panel with primitives loaded
- One example of a tokenized `mxCell` (short XML snippet)
- One example of a `drawio_style_sync.py` dry-run output showing matched/changed counts

## Style guide for the draft

- Plain language, short sentences (Hemingway-friendly).
- Lead with the user benefit, then the mechanism.
- Name real files and scripts where it strengthens credibility, not as decoration.
- No emoji. No marketing puffery. Keep the cross-product claim scoped to "across the diagram set" until cross-product use is real.
