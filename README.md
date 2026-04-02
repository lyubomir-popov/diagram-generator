# Diagram Generator

An LLM-based diagramming workflow that turns rough sketches and brand/layout rules into on-brand SVG and draw.io diagrams.

## What This Repo Does

This repo is for rebuilding rough, hand-drawn, or inconsistent diagrams into a strict reusable design system with:

- editable SVG outputs
- editable draw.io XML outputs
- consistent typography, spacing, icon placement, and arrow geometry
- cold-start-safe documentation so a new chat can continue without re-deriving the system

## Workflow

Input:

- rough sketches or screenshot references in [`diagrams/1. input/`](diagrams/1.%20input)
- brand and layout invariants documented in [`docs/TODO.md`](docs/TODO.md) and [`llm-handoff-context.md`](llm-handoff-context.md)
- local icons from [`assets/icons/`](assets/icons)

Output:

- final SVGs in [`diagrams/2.output/`](diagrams/2.output)
- draw.io exports in [`draw.io/`](draw.io)

## Canonical References

- Starter block: [`sample.svg`](diagrams/0.reference/sample.svg)
- Larger visual preview: [`sample.png`](diagrams/0.reference/sample.png)
- Reusable SVG starter: [`onbrand-svg-starter.svg`](diagrams/0.reference/onbrand-svg-starter.svg)
- Canonical exemplar: [`memory-wall-onbrand.svg`](diagrams/2.output/memory-wall-onbrand.svg)
- Canonical draw.io exporter: [`export_drawio_batch.py`](scripts/export_drawio_batch.py)

## Current Design System

- Base box width is `192px`
- Base box height is at least `64px`
- Three-line boxes grow to `72px`, then continue in `8px` steps
- Text is always top-left aligned with an `8px` inset on both axes
- Icons use the local `48x48` artboards and sit top-right with an `8px` inset
- Default body text is `16px`
- Hierarchy should prefer weight before size: `16px` regular, `16px` bold, `16px` small-caps, then `24pt`
- Helper text stays at body size and shifts only to `#666666`
- Boxes are white or `#F3F3F3` by default, with at most one black emphasis box when justified
- Orange `#E95420` is reserved for arrows only
- Box and arrow strokes are `1px`
- Arrows should connect midpoint-to-midpoint from one box edge to another

## Draw.io Export Rules

- Text-bearing boxes, panels, and notation widgets must export as native editable `mxCell` geometry
- Icons may use embedded `data:` image cells
- Truly special non-text shapes like the jagged memory wall may use image-backed cells when needed
- Direct connectors must use real `source` / `target` references plus explicit `entry` / `exit` anchors
- Exports should force light rendering with `adaptiveColors="none"` and explicit colors

## Key Files

- Rules and invariants: [`docs/TODO.md`](docs/TODO.md)
- Cold-start handoff: [`llm-handoff-context.md`](llm-handoff-context.md)
- History log: [`docs/history.md`](docs/history.md)
- Shared SVG generator: [`generate_remaining_diagrams.py`](scripts/generate_remaining_diagrams.py)
- Shared draw.io exporter: [`export_drawio_batch.py`](scripts/export_drawio_batch.py)
- Illustrator sanitizer: [`svg_illustrator_sanitize.py`](scripts/svg_illustrator_sanitize.py)

## Status

The main SVG redraw batch and the first native draw.io export batch are in place. The main remaining manual review step is import/render validation in draw.io and Illustrator against the canonical SVG outputs.
