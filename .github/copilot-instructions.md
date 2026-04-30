# Workspace Instructions

## Documentation structure

| File | Role | Who writes |
|------|------|-----------|
| `.github/copilot-instructions.md` | Rules. Workflow rules, source precedence, diagram invariants. | Agent maintains |
| `.github/agents/agent.md` | Optional resume-agent prompt for repo-specific continuation. | Agent maintains |
| `.github/skills/` | Optional workflow skills. Repeatable on-demand procedures. | Agent maintains |
| `README.md` | Overview. Repo summary and workflow map. | User + agent maintain |
| `DIAGRAM.md` | Diagram language. Canonical tokens, rules, and output constraints. | Agent maintains |
| `ROADMAP.md` | Long-term. Product direction, stages, future ideas. | Agent updates rarely |
| `TODO.md` | Active plan. Current execution queue, principles, architecture notes. | Agent updates every session |
| `INBOX.md` | User inbox. Async user notes that should stay easy to scan. | User writes, agent drains |
| `AGENT-INBOX.md` | Agent inbox. Long machine-generated handoffs, cross-repo notes, and diagnostics awaiting triage. | Agents and automation write, agent drains |
| `STATUS.md` | Cold start. Repo orientation, current state, key files, invariants. | Agent updates when state changes |
| `HISTORY.md` | Archive. Completed work log. | Agent appends when tasks complete |
| `docs/specs.md` | Specs. Governing references, local source assets, sibling repos. | Agent updates when source paths change |

No other files should carry duplicate TODO lists, handoff notes, or parallel status tracking.

## Instruction file scope

Use the two `.github` files for different layers of guidance:

- `.github/copilot-instructions.md` is the stable repo-wide contract. Put workflow rules, planning thresholds, validation expectations, precedence rules, repo boundaries, and instructions that should apply to every future session here.
- `.github/agents/agent.md` is optional and should stay short. Put only repo-specific resume guidance here: what to read first, which code or docs matter most, and any narrow continuation hints that help a fresh agent start quickly.
- If a detail stops being a short resume hint and becomes durable project state, move it into the canonical workflow files instead of expanding `.github/agents/agent.md`.

When deciding where extra detail belongs, use this map:

- Diagram design language and tokens: `DIAGRAM.md`
- Current state or cold-start notes: `STATUS.md`
- Active tasks or architecture notes: `TODO.md`
- Long-term direction: `ROADMAP.md`
- Completed work: `HISTORY.md`
- Source-of-truth references: `docs/specs.md`
- Human-readable overview: `README.md`
- Async user notes: `INBOX.md`
- Agent-to-agent handoffs or long diagnostics: `AGENT-INBOX.md`

## Source-of-truth precedence

When sources disagree, use this order unless a higher-priority source explicitly narrows it further:

1. Source sketches, reference assets, or explicitly referenced source material listed in `docs/specs.md`
2. `DIAGRAM.md`
3. `ROADMAP.md`
4. `.github/copilot-instructions.md`
5. `STATUS.md` and `HISTORY.md`
6. `README.md` and `docs/specs.md`
7. `INBOX.md`
8. `AGENT-INBOX.md`
9. Local implementation details that are not clearly intentional or documented

Do not rewrite higher-priority docs to match lower-priority implementation drift.

## Planning threshold

- Small task: act directly.
- Medium task: write a short plan in `STATUS.md` before execution.
- Large, architectural, or cross-repo task: create or update a dedicated plan section before broad changes.

## History rules

- Record completed short-term items under a short-term section.
- Record completed long-term items under a long-term section.
- Move items to history only when actually complete.
- Do not use history as a backlog or scratchpad.
- When `HISTORY.md` exceeds roughly 200 lines, archive older entries under `docs/archive/` and keep the root file focused on recent work.

### The inbox pattern

`INBOX.md` is the user write-only channel. `AGENT-INBOX.md` is the machine-generated handoff channel for long agent notes, automation diagnostics, and cross-repo follow-ups. At session start, the agent must:

1. Read `INBOX.md` and triage each item into `TODO.md` (near-term) or `ROADMAP.md` (longer-term).
2. Read `AGENT-INBOX.md` and triage durable facts into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`.
3. Empty both files back to their header templates.

### What goes where

| Information | Goes in |
|-------------|---------|
| What is the canonical diagram design language? | `DIAGRAM.md` |
| What should the next chat do? | `TODO.md` |
| Why was a stylistic or architectural decision made? | `TODO.md` |
| What does the repo become long-term? | `ROADMAP.md` |
| What source docs or reference assets govern this repo? | `docs/specs.md` |
| What has been completed? | `HISTORY.md` |
| Cold-start orientation and resume notes | `STATUS.md` |
| Async user notes | `INBOX.md` |
| Agent-generated handoffs or diagnostics | `AGENT-INBOX.md` |

## Agent workflow

### Session start

1. Read `STATUS.md` for orientation. If it looks stale or references work that is clearly finished, update it before proceeding.
2. Check `INBOX.md`, triage user items into plan or roadmap, then empty it.
3. Check `AGENT-INBOX.md`, triage machine notes into canonical files, then empty it.
4. Read `TODO.md` for current tasks.
5. Read `DIAGRAM.md` before changing diagram behavior.
6. Read `docs/specs.md` before changing spec-governed behavior.
7. **Ask the user which pipeline to work on** before starting diagram work:
   - Pipeline 1 (stable): imperative builders, `build_outputs.py`, `*-onbrand.*` outputs
   - Pipeline 2 (experimental): declarative grid, `build_v2.py`, `*-onbrand-v2.*` outputs

### During work

- Mark tasks done in `TODO.md` as you complete them.
- Move completed items to `HISTORY.md`.

### Session end

1. Update `STATUS.md` if the current-state section is stale.
2. Update `TODO.md` with any new tasks that emerged.
3. Ensure `INBOX.md` is empty.
4. Ensure `AGENT-INBOX.md` is empty.
5. Do not create new markdown files to document status unless explicitly requested.

## Validation

There is no repo-wide automated test suite yet. Before committing, run the checks that match the files you touched:

- If you changed workflow docs, `DIAGRAM.md`, or workflow skills only, verify links, file names, command examples, and canonical ownership stay consistent.
- If you changed renderer or exporter code, rebuild the batch with `python scripts/build_outputs.py`.
- If you changed v2 declarative definitions or the layout engine, rebuild with `python scripts/build_v2.py`, then run `python scripts/_compare_3way.py` to generate 3-way visual comparisons (input → v1 → v2) and `python scripts/_audit_v2.py` for element count diffs. Do not judge v2 output as "good enough" without checking both tools.
- If you changed deliverable SVGs, run `python scripts/svg_illustrator_sanitize.py --write <svg>` and validate the edited SVGs for syntax issues.
- If you changed compare-page generation, regenerate the affected compare outputs when practical.

## Manual draw.io safety workflow

When asked to modify a manually edited draw.io file:

- Treat the current manually edited file as protected until the user approves promotion.
- Create or refresh a review copy under `diagrams/2.output/draw.io/review/`, mirroring the original relative path inside `diagrams/2.output/draw.io/`.
- Prefer using `python scripts/drawio_review_workflow.py prepare <source>` to create that review copy.
- Make edits only to the review copy on the first pass so the original remains intact for comparison and easy rollback.
- Before overwriting the original, create a timestamped checkpoint under `diagrams/2.output/draw.io/checkpoints/` and then promote the reviewed copy back to the original.
- Prefer using `python scripts/drawio_review_workflow.py promote <source>` for promotion, because it checkpoints the original before replacing it.
- If generator output is needed as input to a manual update, compare or import it into the review copy; do not regenerate directly over the protected manually edited file.
- Do not skip the review-copy step unless the user explicitly asks for a direct in-place update.

## Agent environment rules

- Use VS Code integrated terminals the user can monitor, not background shells or external terminal windows.
- Prefer reusing a small number of foreground integrated terminals the user can actually inspect.
- Keep track of the terminals you start. If one hangs, times out, or is no longer needed, close it before finishing the task.
- When using Playwright or browser automation, use Chrome, not Edge.

## Repo boundary

- Work in this repo unless the user explicitly redirects elsewhere.
- `repo-workflow-boilerplate` is an allowed read-only workflow reference when mirroring the centralized process.
- `baseline-foundry` is an allowed read-only workflow or style reference when the user asks to mirror its conventions.
- The local reference assets in this repo are the primary source of truth for redesign work.

## Commit message discipline

Prefix with the area touched: `svg:`, `drawio:`, `workflow:`, `docs:`, `scripts:`, `icons:`, or `assets:`. Keep the first line under 72 characters.

## Autonomous continuation rule

If the user explicitly says to proceed autonomously, treat that as standing approval to keep executing the best available plan without pausing for small confirmations.

In that mode:

1. Work through the current plan until you hit a real blocker, not a minor ambiguity.
2. Make small validated checkpoint commits after substantive chunks if commits are allowed.
3. Re-read `TODO.md` after major chunks and periodically re-audit alignment.
4. Update the canonical docs as work lands so the next chat can continue cold.
5. Do not stop just to ask whether to continue unless the next best move is genuinely unclear or risky.

### Maximising autonomous run length

Current LLM agents lose coherence after extended autonomous runs because context fills up. To get the longest useful runs:

- Narrow the scope per burst. "Complete all items in TODO section X" works better than an open-ended roadmap sweep.
- Checkpoint and resume. After each substantive chunk, update `STATUS.md`, `TODO.md`, and `HISTORY.md` so a fresh session can continue cold.
- Keep TODO items small enough to complete in one focused burst.
- Prefer sequential single-repo sessions over multi-repo autonomous runs.

## Cross-repo coordination

When work in this repo creates a dependency or follow-up in another repo:

1. Drop a machine-generated note in the target repo's `AGENT-INBOX.md` describing what changed and what the target repo needs to do.
2. Do not attempt the cross-repo change in the same session unless the user explicitly redirects there.
3. Use one agent per repo for feature work. Use one agent across repos only for mirroring convention changes or other small coordinated edits.
4. For larger features, prefer sequential single-repo sessions with inbox handoffs over one agent trying to hold multi-repo context.

## Non-negotiable diagram rules

<!--
Several references below point to locally generated outputs under `diagrams/2.output/` or team-internal reference assets. These are gitignored; run `python scripts/build_v2.py` to create the output batch.
-->

- Prefer hand-authored, editable SVG. Do not generate new Illustrator-style base64 image payloads for final outputs.
- Use `assets/UbuntuSans[wdth,wght].ttf` from this repo as the source font, but final deliverable SVGs should reference the family by name only, typically `font-family: 'Ubuntu Sans', sans-serif`, rather than a file-path `@font-face`.
- Final deliverable SVGs must be Illustrator-safe: no `<symbol>`, no `<use>`, no external `<image href="...">`, and no marker refs such as `marker-start="url(#...)"`.
- Use icons from the local `assets/icons/` directory only unless the user explicitly asks for a new source.
- If no suitable local icon exists for a box, omit the icon rather than inventing or sourcing one.
- Treat `diagrams/0.reference/_BRND-3284.drawio.svg` as the scale/layout reference and `diagrams/0.reference/onbrand-reference.png` as the broader brand-language reference.
- Treat `diagrams/0.reference/sample.svg` and `diagrams/0.reference/sample.png` as the current canonical single-box building block for box width, live-text proportion, arrow treatment, and overall proportion.
- Treat `diagrams/0.reference/onbrand-svg-starter.svg` as the reusable copy source for the canonical block proportions, inset rhythm, and literal orange arrow geometry.
- Run `scripts/svg_illustrator_sanitize.py --write <svg>` before finalizing a deliverable so Illustrator sees inline geometry rather than internal SVG references.
- Treat `diagrams/2.output/svg/memory-wall-onbrand.svg` as the canonical current implementation checkpoint for palette, alignment, icon placement, and scale.
- Box and arrow outlines are `1px`, square corners, `stroke-miterlimit: 10` unless a reference explicitly contradicts that.
- Default non-highlight fill is white; standard accent fill is `#F3F3F3`; at most one black-filled box with white text is allowed when a true highlight is needed.
- Do not use orange-filled boxes. Orange is reserved for arrows and arrowheads.
- For new work, the canonical block is `192px` wide and at least `64px` tall with top-left-aligned live text and a natural-size local `48x48` icon embedded with `8px` padding on all sides.
- Use `14px` regular text with `20px` line height for the main block copy unless the user explicitly asks for another scale.
- Prefer hierarchy by weight before hierarchy by size: move from `14px` regular to `14px` semi-bold, then `14px` small-caps with `0.05em` tracking before introducing another size; when a larger size is truly needed use `18px/24px`, then `24px/32px`.
- Keep text top-left aligned whether the label is one line or multiple lines; use an `8px` inset on both X and Y, and do not vertically center single-line labels just because there is extra box height.
- That `8px` top inset is from the visible top of the text, not the raw SVG baseline; place live text by ascent so the ascenders sit `8px` below the box top.
- Treat `14px` as the new dense default for current work; treat the older compact `9px` system as legacy-only unless maintaining already-finished outputs.
- If a semantic tile feels crowded, first try line breaks, `14px` weight contrast, small-caps, wider boxes, or icon omission before changing size.
- The older `144px` / `128px` / `9px` system should now be treated as legacy-maintenance guidance for previously completed compact diagrams, not the default for new redraws.
- Right-side in-box icons should be embedded directly from `assets/icons/` at their natural `48x48` size rather than visually thinned down through scaling.
- Align those icons by their artboard to the top-right corner with an `8px` inset rather than centering them vertically.
- If a diagram uses a side icon cluster rather than a single in-box icon, keep those icons on the same natural-size treatment instead of shrinking them to a secondary scale.
- The current box-height rule is icon height plus `2 * 8px` internal padding, with the border on the outside; for the current icon set that means `64px`-tall boxes, and taller boxes should be derived from the text stack and snapped to whole `4px` baseline units rather than hard-coded per diagram.
- Keep growing taller boxes in `4px` baseline steps when copy runs longer than the default height; do not trade away inset, helper-text size, or icon size to force a box to stay short.
- Orange connectors use `#E95420` and should behave like draw.io `blockThin` arrows: explicit `1px` shaft + filled head, tip touching the destination edge, no shaft visibly protruding through the arrowhead, and no overlap that breaks black box outlines.
- Reuse the exact arrow proportions from `diagrams/0.reference/sample.svg`, `diagrams/0.reference/onbrand-svg-starter.svg`, or `diagrams/2.output/svg/memory-wall-onbrand.svg`; do not freehand a larger or smaller variant for a one-off diagram.
- Draw orange connectors behind the boxes they connect to so the destination box edge remains visually continuous.
- Embed arrowheads directly as paths in the document rather than through reusable SVG symbols or markers.
- Orange connectors should resolve from box edge to box edge; do not aim them into loose helper text.
- Anchor direct connectors from the midpoint of the source side to the midpoint of the destination side so the geometry stays organized in both SVG and draw.io.
- Keep box gaps, arrow spans, and pad padding consistent inside a diagram; a grey substrate or dashed grouping frame still needs `8px` padding beyond the boxes it contains.
- Wrappers (dashed grouping frames, frameless containers) must match the outer width of peer standalone boxes in the same column. Derive child column widths from the wrapper's outer width minus `2 × INSET`, never the other way around. See "Nesting and alignment rules" in `DIAGRAM.md`.
- Keep arrowheads large enough to read at export scale, with enough visible shaft before the head that the connector does not collapse into a stub. The last segment of every arrow must be ≥ `MIN_ARROW_SEGMENT` (`16px`) and the first segment ≥ `ARROW_EXIT_CLEARANCE` (`8px`). Any `row_gap` or `col_gap` through which arrows route must be ≥ `ARROW_GAP` (`24px`). See "Arrow clearance" in `DIAGRAM.md`.
- Prefer straight or orthogonal connectors with `90` degree turns, and reroute them to avoid crossings.
- When a legend is necessary, build it as an evenly spaced marker-and-label row, typically along the bottom of the relevant panel and aligned to the panel's left box edge.
- Explanatory notes should default to plain helper text rather than extra bordered note boxes unless the note itself is a semantic node.
- Explanatory notes should stay at the body size and shift only in color: `14px`, regular, `#666666`.
- Before finalizing a diagram, run an explicit icon-coverage pass across every major node and repeated semantic tile; do not stop after placing only one or two obvious icons if the local library has reasonable additional matches.
- Transfer all source text from the sketch, including small labels; missing icons are acceptable when the local library has no good match, but dropped text is not.
- Preserve a grid feel in grouped layouts by aligning enclosing widths and stacked boxes rather than centering unrelated widths arbitrarily.
- Draw.io XML export is now the primary editable output target: anchor it to the local `diagrams/2.output/draw.io/*.drawio` samples and emit raw `mxfile` / `mxGraphModel` XML with native editable `mxCell` boxes, labels, groups, and edges for every text-bearing box or panel.
- Inline `data:image/svg+xml,...` image cells are still allowed for icons and genuinely special non-text shapes, but never as a shortcut for a visible box or text panel.
- In draw.io exports, connect arrows to their owning cells with `source` / `target` ids and explicit `entry` / `exit` anchors instead of relying only on absolute source/target points.
- In draw.io exports, explicitly disable theme adaptation with `adaptiveColors="none"` and write explicit `fontColor` / `fillColor` values so dark mode does not flip the diagram to black.
- For draw.io exports, use image cells only for icons or special non-text ornaments such as the jagged memory-wall panel; keep text-bearing layout, labels, and notation widgets editable.
- Horizontal separators should match the reference treatment exactly; if dotted, use the literal requested dot/gap pattern.
- If a separator divides two stacked boxes, keep it centered in the gap and match it to the box width unless the source clearly wants another span.
- The `Memory wall` node is the current canonical semantic exception and should keep jagged top and bottom edges.
- Keep outputs sentence-case and concise unless the source/reference clearly establishes another casing system.

## Diagram-first checks

There is no repo-wide automated test suite yet. First checks for diagram work are:

1. Inspect `STATUS.md`.
2. Compare the current target SVG against `diagrams/2.output/svg/memory-wall-onbrand.svg`, `diagrams/0.reference/_BRND-3284.drawio.svg`, `diagrams/0.reference/onbrand-reference.png`, and the local icon set in `assets/icons/`.
3. Validate edited SVGs for syntax errors.

The key rule: every piece of status information should live in exactly one place.

## Agent file roles

- `.github/copilot-instructions.md` is the single repo-wide instruction file.
- `.github/agents/agent.md` is optional and should contain only repo-specific resume or subagent guidance.
- `.github/skills/` is the repo home for optional repeatable workflow procedures that should load on demand rather than live in always-on instructions.
- `.github/agents/agent.md` should not become a second `STATUS.md`, `TODO.md`, or `README.md`; when details grow beyond a short resume prompt, move them into the canonical file for that kind of information.
- `DIAGRAM.md` is the canonical diagram-language contract; do not leave long-lived style playbooks in `TODO.md`.
- Do not duplicate the full workflow rules in both places.
