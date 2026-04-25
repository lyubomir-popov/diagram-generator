# Specs

## Purpose

List the external sources, reference assets, and sibling repos that govern this repo.

If a sketch, reference export, or explicitly linked local asset governs a diagram, treat that source as the highest-priority visual truth and list it here. If no external product spec exists, `ROADMAP.md` carries long-term direction while this file records the concrete reference sources and sibling-repo relationships.

Use this file to answer two questions quickly:

1. What source material governs diagram behavior or workflow here?
2. Which sibling repos are references versus sources of truth?

## Source docs and reference assets

| Source | Path | Role |
|--------|------|------|
| Workflow rules | `.github/copilot-instructions.md` | Canonical workflow and diagram-rule source for this repo |
| Diagram language spec | `DIAGRAM.md` | Canonical diagram tokens, prose rules, and output constraints |
| Current state | `STATUS.md` | Cold-start orientation and resume guidance |
| Product direction | `ROADMAP.md` | Long-term direction when no separate external product spec exists |
| Starter block reference | `diagrams/0.reference/sample.svg` | Canonical single-block geometry and arrow treatment |
| Visual preview of starter block | `diagrams/0.reference/sample.png` | Clearer `3x` raster preview of the same canonical block |
| Reusable style copy source | `diagrams/0.reference/onbrand-svg-starter.svg` | Canonical inset rhythm, box proportions, and literal arrow geometry |
| Tracked draw.io library | `assets/drawio/diagram-generator-primitives.mxlibrary` | Repo-owned reusable library for canonical draw.io primitives |
| Secondary layout reference | `diagrams/0.reference/_BRND-3284.drawio.svg` | Connector and broader layout reference |
| Broader brand-language reference | `diagrams/0.reference/onbrand-reference.png` | Higher-level visual direction reference |
| Current canonical implementation | `diagrams/2.output/svg/memory-wall-onbrand.svg` | Palette, icon placement, side-icon cluster, and scale checkpoint |

## External tool references

| Source | Path | Role |
|--------|------|------|
| draw.io scratchpad and custom libraries | `https://www.drawio.com/doc/faq/scratchpad` | Governs how reusable manual components are captured, edited, and exported as library XML |
| draw.io shape styles | `https://www.drawio.com/doc/faq/shape-styles` | Governs style strings, copy and paste style, default styles, and direct style editing |
| draw.io text styles | `https://www.drawio.com/doc/faq/text-styles.html` | Governs text spacing fields such as top, left, bottom, and right padding inside shapes |
| draw.io connector styles | `https://www.drawio.com/doc/faq/connector-styles` | Governs connector defaults, manual style editing, and reusable edge behavior |
| draw.io custom shapes | `https://www.drawio.com/doc/faq/custom-shapes` | Governs custom stencils, inherited styling, and explicit connection points for reusable special shapes |
| draw.io diagram source editing | `https://www.drawio.com/doc/faq/diagram-source-edit` | Governs direct XML editing, source-level merge workflows, and safe save modes |

## Related repos

| Repo | Relationship | Notes |
|------|--------------|-------|
| `repo-workflow-boilerplate` | Workflow upstream | Centralized workflow template for the root file layout, inbox split, source precedence, and cold-start rules |
| `baseline-foundry` | Read-only reference | Allowed workflow or style reference only when the user explicitly asks to mirror conventions |
| `canonical-spacing-spec` | Read-only design language source | Upstream source for the imported spacing, grid, and dense type-scale rules now mirrored into `DIAGRAM.md` and shared renderer tokens |
| `design.md` | Read-only format reference | Used as a structure reference for the plain-text `DIAGRAM.md` spec and future design-language token ingestion |

## Notes

- Local reference assets in this repo are the primary source of truth for diagram visuals.
- `DIAGRAM.md` is the bridge point for imported typography, spacing, and grid specs from the broader design language into this repo's renderers.
- draw.io libraries improve reuse for future insertions but do not live-update shapes already placed in diagrams; repo-wide style changes still require a batch XML update strategy.
- `scripts/export_drawio_library.py` regenerates the tracked draw.io library, and `scripts/drawio_style_sync.py` is the batch rewrite path for token-targeted draw.io style changes.
- Sibling repos can inform workflow or style, but they do not outrank an explicitly referenced local sketch or reference asset.
- Keep this file focused on governing references and repo relationships, not active tasks or handoff notes.