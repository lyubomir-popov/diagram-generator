# Workspace Instructions

## Documentation structure — 5 files, strict roles

| File | Role | Who writes |
|------|------|-----------|
| `docs/AGENT-INBOX.md` | **Inbox.** User drops notes to avoid interrupting agent. | User writes, agent drains |
| `llm-handoff-context.md` | **Cold start.** Repo orientation, current state, key files, critical invariants. | Agent updates when state changes |
| `docs/TODO.md` | **Active plan.** Principles, architecture, short-term tasks. | Agent updates every session |
| `docs/product-roadmap.md` | **Long-term.** Stages, backlog shape, future directions. | Agent updates rarely |
| `docs/history.md` | **Archive.** Completed work log. | Agent appends when tasks complete |

**No other files should carry TODO lists or duplicated status.** Session-scoped scratch in Copilot memory is fine, but it must not become a parallel tracking system.

### The inbox pattern

`docs/AGENT-INBOX.md` is the user's write-only channel. At session start, the agent must:

1. Read the inbox.
2. Triage each item into `docs/TODO.md` (near-term) or `docs/product-roadmap.md` (longer-term).
3. Empty the file back to its header template.

### What goes where

| Information | Goes in |
|-------------|---------|
| "What should the next chat do?" | `docs/TODO.md` → Active TODO |
| "Why did we make this stylistic decision?" | `docs/TODO.md` → Principles or Architecture |
| "What does the repo become long-term?" | `docs/product-roadmap.md` |
| "What's been done?" | `docs/history.md` |
| "Quick scratch notes for this session only" | `/memories/session/` |
| "Key file paths and resume pointers" | `/memories/repo/` |

## Agent workflow

### Session start

1. Read `llm-handoff-context.md` for orientation.
2. Check `docs/AGENT-INBOX.md` and triage items into plan or roadmap, then empty it.
3. Read `docs/TODO.md` for current tasks.

### During work

- Mark tasks done in `docs/TODO.md` as you complete them.
- Move completed items to `docs/history.md`.

### Session end

1. Update `llm-handoff-context.md` if the current-state paragraph is stale.
2. Update `docs/TODO.md` with any new tasks that emerged.
3. Ensure `docs/AGENT-INBOX.md` is empty.
4. **Do not** create extra markdown files to document changes unless explicitly requested.

## Repo boundary

- Work in this repo unless the user explicitly redirects elsewhere.
- `baseline-foundry` is an allowed read-only workflow/style reference when the user asks to mirror its conventions.
- The local reference assets in this repo are the primary source of truth for redesign work.

## Commit message discipline

Prefix with the area touched: `svg:`, `icons:`, `docs:`, `workflow:`, `assets:`. First line under 72 chars.

## Autonomous continuation rule

If the user explicitly says to proceed autonomously, treat that as standing approval to keep executing the plan without stopping for small confirmations.

In that mode:

1. Work through the current plan until you hit a real blocker, not a minor ambiguity.
2. Make small validated checkpoint commits after substantive chunks.
3. Re-read `docs/TODO.md` after major chunks and periodically re-audit alignment.
4. Update the canonical docs as work lands so the next chat can continue cold.
5. Do not stop just to ask whether to continue unless the next best move is genuinely unclear or risky.

## Non-negotiable diagram rules

- Prefer hand-authored, editable SVG. Do not generate new Illustrator-style base64 image payloads for final outputs.
- Use `assets/UbuntuSans[wdth,wght].ttf` from this repo as the source font, but final deliverable SVGs should reference the family by name only, typically `font-family: 'Ubuntu Sans', sans-serif`, rather than a file-path `@font-face`.
- Final deliverable SVGs must be Illustrator-safe: no `<symbol>`, no `<use>`, no external `<image href="...">`, and no marker refs such as `marker-start="url(#...)"`.
- Use icons from the local `assets/icons/` directory only unless the user explicitly asks for a new source.
- If no suitable local icon exists for a box, omit the icon rather than inventing or sourcing one.
- Treat `diagrams/0.reference/_BRND-3284.drawio.svg` as the scale/layout reference and `diagrams/0.reference/onbrand-reference.png` as the broader brand-language reference.
- Treat `diagrams/0.reference/sample.svg` and `diagrams/0.reference/sample.png` as the current canonical single-box building block for box width, live-text proportion, arrow treatment, and overall proportion.
- Treat `diagrams/0.reference/onbrand-svg-starter.svg` as the reusable copy source for the canonical block proportions, inset rhythm, and literal orange arrow geometry.
- Run `scripts/svg_illustrator_sanitize.py --write <svg>` before finalizing a deliverable so Illustrator sees inline geometry rather than internal SVG references.
- Treat `diagrams/2.output/memory-wall-onbrand.svg` as the canonical current implementation checkpoint for palette, alignment, icon placement, and scale.
- Box and arrow outlines are `1px`, square corners, `stroke-miterlimit: 10` unless a reference explicitly contradicts that.
- Default non-highlight fill is white; standard accent fill is `#F3F3F3`; at most one black-filled box with white text is allowed when a true highlight is needed.
- Do not use orange-filled boxes. Orange is reserved for arrows and arrowheads.
- For new work, the canonical block is `192px` wide and at least `64px` tall with top-left-aligned live text and a natural-size local `48x48` icon embedded with `8px` padding on all sides.
- Use `16px` regular text for the main block copy unless the user explicitly asks for another scale.
- Prefer hierarchy by weight before hierarchy by size: move from `16px` regular to `16px` bold, then `16px` small-caps with `0.05em` tracking before introducing another size, and when a larger size is truly needed use `24pt` before repeating that bold/small-caps progression.
- Keep text top-left aligned whether the label is one line or multiple lines; use an `8px` inset on both X and Y, and do not vertically center single-line labels just because there is extra box height.
- That `8px` top inset is from the visible top of the text, not the raw SVG baseline; place live text by ascent so the ascenders sit `8px` below the box top.
- Treat `14px` as a legacy pre-scale-up size; do not introduce it into current new work.
- If a semantic tile feels crowded, first try `16px` with line breaks, bold/regular contrast, small-caps, wider boxes, or icon omission before changing size.
- The older `144px` / `128px` / `9px` system should now be treated as legacy-maintenance guidance for previously completed compact diagrams, not the default for new redraws.
- Right-side in-box icons should be embedded directly from `assets/icons/` at their natural `48x48` size rather than visually thinned down through scaling.
- Align those icons by their artboard to the top-right corner with an `8px` inset rather than centering them vertically.
- If a diagram uses a side icon cluster rather than a single in-box icon, keep those icons on the same natural-size treatment instead of shrinking them to a secondary scale.
- The current box-height rule is icon height plus `2 * 8px` internal padding, with the border on the outside; for the current icon set that means `64px`-tall boxes, and three-line boxes should expand to `72px` rather than shrinking the text.
- Keep growing taller boxes in `8px` steps when copy runs longer than three lines; do not trade away inset, helper-text size, or icon size to force a box to stay short.
- Orange connectors use `#E95420` and should behave like draw.io `blockThin` arrows: explicit `1px` shaft + filled head, tip touching the destination edge, no shaft visibly protruding through the arrowhead, and no overlap that breaks black box outlines.
- Reuse the exact arrow proportions from `diagrams/0.reference/sample.svg`, `diagrams/0.reference/onbrand-svg-starter.svg`, or `diagrams/2.output/memory-wall-onbrand.svg`; do not freehand a larger or smaller variant for a one-off diagram.
- Draw orange connectors behind the boxes they connect to so the destination box edge remains visually continuous.
- Embed arrowheads directly as paths in the document rather than through reusable SVG symbols or markers.
- Orange connectors should resolve from box edge to box edge; do not aim them into loose helper text.
- Anchor direct connectors from the midpoint of the source side to the midpoint of the destination side so the geometry stays organized in both SVG and draw.io.
- Keep box gaps, arrow spans, and pad padding consistent inside a diagram; a grey substrate or dashed grouping frame still needs `8px` padding beyond the boxes it contains.
- Keep arrowheads large enough to read at export scale, with enough visible shaft before the head that the connector does not collapse into a stub.
- Prefer straight or orthogonal connectors with `90` degree turns, and reroute them to avoid crossings.
- When a legend is necessary, build it as an evenly spaced marker-and-label row, typically along the bottom of the relevant panel and aligned to the panel's left box edge.
- Explanatory notes should default to plain helper text rather than extra bordered note boxes unless the note itself is a semantic node.
- Explanatory notes should stay at the body size and shift only in color: `16px`, regular, `#666666`.
- Before finalizing a diagram, run an explicit icon-coverage pass across every major node and repeated semantic tile; do not stop after placing only one or two obvious icons if the local library has reasonable additional matches.
- Transfer all source text from the sketch, including small labels; missing icons are acceptable when the local library has no good match, but dropped text is not.
- Preserve a grid feel in grouped layouts by aligning enclosing widths and stacked boxes rather than centering unrelated widths arbitrarily.
- Draw.io XML export is now an active secondary target: anchor it to the local `draw.io/*.drawio` samples and emit raw `mxfile` / `mxGraphModel` XML with native editable `mxCell` boxes, labels, groups, and edges for every text-bearing box or panel.
- Inline `data:image/svg+xml,...` image cells are still allowed for icons and genuinely special non-text shapes, but never as a shortcut for a visible box or text panel.
- In draw.io exports, connect arrows to their owning cells with `source` / `target` ids and explicit `entry` / `exit` anchors instead of relying only on absolute source/target points.
- In draw.io exports, explicitly disable theme adaptation with `adaptiveColors="none"` and write explicit `fontColor` / `fillColor` values so dark mode does not flip the diagram to black.
- For draw.io exports, use image cells only for icons or special non-text ornaments such as the jagged memory-wall panel; keep text-bearing layout, labels, and notation widgets editable.
- Horizontal separators should match the reference treatment exactly; if dotted, use the literal requested dot/gap pattern.
- If a separator divides two stacked boxes, keep it centered in the gap and match it to the box width unless the source clearly wants another span.
- The `Memory wall` node is the current canonical semantic exception and should keep jagged top and bottom edges.
- Keep outputs sentence-case and concise unless the source/reference clearly establishes another casing system.

## First checks

There is no repo-wide automated test suite yet. First checks for diagram work are:

1. Inspect `llm-handoff-context.md`.
2. Compare the current target SVG against `diagrams/2.output/memory-wall-onbrand.svg`, `diagrams/0.reference/_BRND-3284.drawio.svg`, `diagrams/0.reference/onbrand-reference.png`, and the local icon set in `assets/icons/`.
3. Validate edited SVGs for syntax errors.

## How to port this convention to another project

1. Copy this file as `.github/copilot-instructions.md` in the new repo.
2. Create `llm-handoff-context.md` at root with: orientation, current state, key files, invariants.
3. Create `docs/TODO.md` with: principles, architecture, active TODO.
4. Create `docs/product-roadmap.md` with: stages and longer-term backlog shape.
5. Create `docs/history.md` with a completed-work log.
6. Create `docs/AGENT-INBOX.md` as an empty inbox.
7. Add `.github/agents/agent.md` for the resume agent.

The key insight: every piece of status information lives in exactly one place.
