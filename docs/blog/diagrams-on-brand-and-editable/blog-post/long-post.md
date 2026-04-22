---
title: Diagrams, on brand and editable
audience: ubuntu.com/blog — brand section
voice: first person, conversational, design-craft tone
target length: ~1500 words
status: draft
---

# Diagrams, on brand and editable

A lot of the diagrams I get sent are not really diagrams yet. They are a phone photo of a whiteboard, a rough sketch in someone's notebook, a slide that has been edited so many times the alignment has given up, or — more and more often — a confident-looking thing an LLM produced that falls apart the moment you look at it. My job is to turn those into something that is on brand, accessible, and easy to keep editing later.

For a long time I did that the way most designers do: open Illustrator, redraw it from scratch, fight with text alignment, hand-place the icons, copy the brand orange in from a swatch, and hope I remembered all the same rules I used last time. It worked. It just did not scale. Every diagram was a fresh negotiation with the same design system, and every change request meant doing a lot of that work again.

So I built a small pipeline to stop redoing it.

## The problem, said plainly

The same problems kept showing up across diagrams from product, engineering, marketing, and partners.

- Type sizes drifted. One diagram had four sizes; the next had two and a different body size.
- Box heights were chosen by feel, not by content. Multi-line labels collided with icons.
- Arrows were redrawn each time, with a slightly different head, a slightly different shaft, sometimes orange and sometimes black.
- Icons came from wherever was nearest — sometimes the local set, sometimes a one-off SVG, sometimes nothing at all where a real concept needed one.
- Files were either editable but ugly (a draw.io export with default styling), or pretty but locked (an Illustrator file no one else could touch).

None of those are exotic problems. They are what you get when the design system lives in someone's head and the production tool does not enforce it.

## What I wanted

One pipeline, any input, two outputs:

1. An editable `.drawio` file that respects the brand rules without me restating them every time.
2. An Illustrator-safe `.svg` that matches the draw.io file pixel-for-pixel and ships as a final asset.

Both should come out of the same source of truth. Both should be safe to regenerate. And the brand rules — type, spacing, color, arrow geometry, icon placement — should live in code, not in muscle memory.

## How the pipeline is shaped

There are three layers, and they are all small.

**A shared primitives module.** One Python module owns the constants: `192px` block width, `8px` inset, the body type at `16px`, the orange hex, the `48px` icon size, the line metrics, the arrow geometry. Both renderers read from it. If I change the inset to `12px`, every output moves together.

**Two renderers reading the same primitives.** One emits raw `mxfile` / `mxGraphModel` XML with native editable `mxCell` boxes, labels, edges, and groups — exactly what draw.io expects, no `shape=image` shortcuts for text-bearing boxes. The other emits Illustrator-safe SVG: no `<symbol>`, no `<use>`, no external font URLs, no marker references, just literal geometry that survives a round trip through Illustrator without losing arrowheads.

**A sanitizer pass on the SVG side.** Draw.io will happily produce SVG that uses internal references to keep file size down. Illustrator will happily drop those on import. The sanitizer expands them into literal paths so what you open is what I drew.

The result is a single command — `python scripts/build_outputs.py` — that regenerates the whole batch. Editable draw.io files for the people who want to keep iterating, and final SVGs for the assets that ship.

## Tokens and provenance, so I can change my mind later

The interesting part isn't the renderer. It's that every cell the generator writes carries a small provenance and style-token marker. A default box gets tagged as `box-default`. An accent box gets tagged as `box-accent`. The orange connector gets `edge-orange,edge-arrow`. The terminal command bar gets `terminal-bar`. None of this affects how the diagram looks — but it gives me a way to ask the file questions later.

That matters because draw.io shape libraries are copy-based, not live-linked. If I change a library item next week, every diagram I already shipped keeps the old version. So I added a small batch tool that reads those tokens and rewrites style properties across every generated diagram in the repo. "Make every orange connector's arrowhead one step larger." "Tighten the top text padding on every default box." One command, dry-run by default, and the change lands consistently across the set instead of being chased one cell at a time.

This is the part I am proudest of. It turns the design system from a document into something I can actually evolve.

## A reusable shape library, the draw.io way

I also export a tracked `.mxlibrary` file with the canonical building blocks: default box, accent box, highlight box, helper note, orange connector, terminal command bar, the matrix widget I use for attention diagrams, the jagged memory-wall panel, and a couple of grouped panel patterns. Drag any of them into a draw.io canvas and they arrive with the right geometry, the right typography, and the right tags already on them.

For new diagrams a stakeholder wants to start themselves, this is usually enough. They get the brand for free, and anything they add is still legible to the style-sync tool later.

## A walkthrough: the memory wall diagram

The clearest example I have is a diagram about the so-called memory wall in AI inference — the gap between what GPUs can compute and what they can feed in fast enough. The original was a hand-drawn sketch with arrows pointing at each other and labels written sideways.

The redraw uses the canonical `192×64` block, `16px` body text, top-left aligned, `8px` inset measured from the visible top of the text rather than the raw baseline. Icons sit top-right at their natural `48×48` size — never miniaturized, never invented. The "memory wall" itself keeps its jagged top and bottom edges as a small semantic exception, because that shape is doing real work in the diagram.

The orange connectors run midpoint-to-midpoint, behind the boxes they touch, so the box outlines stay continuous. The arrowheads are literal triangles, not SVG markers, because Illustrator drops markers on import. Helper text stays the same `16px`, just in `#666666`, instead of shrinking to a smaller size — hierarchy through weight and color before hierarchy through size.

That single diagram exercises every rule in the system. When it generates cleanly, the rest of the batch usually does too.

## Why I keep harping on a few rules

Three rules do most of the work.

**Hierarchy by weight before hierarchy by size.** Going from `16px` regular to `16px` bold to `16px` small-caps gets you three levels of emphasis without ever changing size. Most diagrams never need a second size. The few that do step to `24pt` and stop there.

**Icons are natural-size or absent.** A `48×48` icon is `48×48`. If there is no good local icon for a concept, the box has no icon — that is much better than inventing one or shrinking an unrelated one.

**Orange is for connectors only.** Boxes are white or light grey. There is at most one black-filled box with white text per diagram, used only when the diagram genuinely has a single most-important node. Orange-filled boxes are out. This keeps the brand color doing the one job it is best at: showing flow.

These rules are unglamorous, and that is the point. They make every diagram in the set feel like it came from the same place, because it did.

## What stakeholders actually get

The audience I care about most is the next person who opens the file. For them, three things changed.

They get an editable draw.io file, not a flattened image. They can move boxes, add a step, change a label, and the whole thing still looks right. The shape library is there in the side panel if they want to add more.

They get a final SVG that matches it. The SVG opens cleanly in Illustrator, with real text and real geometry, ready to drop into a slide, a doc, or a blog post like this one.

And when the brand evolves — a new accent color, a tighter inset, a different connector head — they do not have to redo their diagram. The next regeneration carries the change through.

## What's next

A few things are still open and honest about it. I want to do an Illustrator and draw.io import audit on the full batch to catch any renderer mismatches I haven't seen yet. I want to pilot the protected review-copy workflow on the diagrams that have already been hand-polished, so manual edits and generated edits can coexist without one stomping the other. And I want to keep growing the shape library as new patterns show up — a network topology block, a request-response pair, a few more notation widgets.

But the headline is small and concrete: I no longer redraw diagrams. I describe them, and the system draws them in our voice.

That, honestly, is the design culture I have been trying to build into our tooling — one where systematic thinking and a little rigor up front buy back hours of one-off fixes later, and where the brand is something the tools enforce, not something each of us has to remember every time we open a canvas.
