# TODO

## Purpose

This is the active execution queue for `diagram-generator`.

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
6. The imported dense application and documentation mapping from `canonical-spacing-spec` remains the reference tier, and the current diagram tier now uses `18px` body copy with `24px` line height to keep live text proportionate to the standard `48px` icon treatment inside the `192px` block system.
7. Orange is reserved for arrows and arrowheads; boxes do not get orange fills.
8. Geometry stays tight and reference-scaled; do not casually upscale diagrams.
9. Use local icons only, and omit the icon entirely when no suitable icon exists in `assets/icons/`.
10. The current canonical output exemplar is `diagrams/2.output/svg/memory-wall-onbrand.svg` (generated locally by `build_v2.py`); inspect it before treating any other output as precedent.
11. Canonical project state lives only in `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md`.

## Architecture

### Safe draw.io evolution lane

- draw.io shape libraries and the scratchpad are copy-based insertion tools: they improve reuse for future additions, but changing a library item later does not retroactively update shapes already placed in diagrams.
- draw.io default shape and connector styles are editor-scoped convenience settings, useful during a manual edit session but not a durable repo-wide source of truth.
- For repo-wide style changes such as reducing top padding on text-bearing boxes, the real solution is a tokenized batch-update path over the diagram XML, not relying on manual paste-style passes.
- draw.io custom stencils are still useful for reusable special shapes because they can define geometry, connection points, and local style overrides while inheriting fill and stroke from the applied style when appropriate.
- Direct XML editing through draw.io and git-versioned `.drawio` files makes a deterministic merge and revert workflow feasible, provided generator-owned cells carry stable identity and provenance metadata.
- `assets/drawio/diagram-generator-primitives.mxlibrary` is the tracked reusable library export for the current canonical primitives, and `scripts/export_drawio_library.py` regenerates it during the canonical batch build.
- Generated draw.io cells now carry `data-dg-source`, `data-dg-role`, `data-dg-style-tokens`, and matching `tags`, so generator-owned cells can be filtered safely before any batch rewrite or merge logic touches them.
- `scripts/drawio_style_sync.py` is the batch rewrite entrypoint for tokenized style changes such as `spacingTop`, text spacing, connector styles, and dash patterns.
- Protected manual-edit workflow: when a manually polished draw.io file needs changes, create a mirrored review copy under `diagrams/2.output/draw.io/review/`, edit only that copy first, let the user review it, and promote it back only after checkpointing the original under `diagrams/2.output/draw.io/checkpoints/`.
- Use `scripts/drawio_review_workflow.py` for the routine copy-review-promote steps so the original manually edited file is never the first place changes land.

### Cold-start shareability findings

- The repo is runnable from the tracked workflow docs, starter-block references, icon library, draw.io primitive library, and generator scripts, so a fresh clone still preserves the core on-brand style system.
- The repo now carries the main input, output, compare, and reference lanes needed for internal cold starts without relying on a separate broader brand-language raster reference.
- The tracked corpus now includes the main reference, input, output, compare, and draw.io working lanes, so a fresh internal clone has enough material to inspect the end-to-end workflow without reconstructing missing assets.
- Compare pages resolve `diagrams/1.input/`, so the tracked HTML review lane stays self-contained for the current internal corpus.
- Conclusion: the repo is now cold-start-safe for internal sharing. The remaining PM-shareability work is curation and guided onboarding, not recovering missing tracked files.

### Diagram language contract

- `DIAGRAM.md` is the canonical plain-text diagram language spec. It owns tokens, rules, output constraints, and the default redraw workflow.
- `.github/copilot-instructions.md` keeps the short always-on guardrails.
- Workflow skills under `.github/skills/` hold repeatable procedures that should not bloat the permanent docs.

## Active TODO

### Editor UX

- [ ] `[H]` **Resizable / auto-fit artboard.** Resizing a box can push content off-canvas. Either make the SVG artboard resizable in the editor, or auto-size the canvas from children + declared margin so it grows to fit content.

### Code quality — from audits

- [ ] `[H]` **`GridSpec` is dead code.** `Panel.grid` and `Diagram.grid` are declared, and `Panel` has `effective_*` properties, but the layout engine reads raw `panel.cols`, `panel.col_gap`, etc. directly — never the `effective_*` path. Any diagram using `Panel(grid=GridSpec(...))` silently uses field defaults. Fix: use `effective_*` in `_layout_panel` and add matching properties to `Diagram`.
- [ ] `[M]` **Diagonal arrows produce invisible arrowheads.** `_polyline_arrow` in `diagram_render_svg.py`: the `else` branch (non-orthogonal last segment) sets `head = [(tx, ty)]` — a single-point polygon. Currently mitigated by the orthogonal auto-router, but any explicit diagonal waypoint will have no arrowhead. Fix: compute proper diagonal arrowhead geometry from the unit vector.
- [ ] `[M]` Resolve Python/YAML definition drift. `build_v2.py` currently loads colliding slugs from both Python and YAML examples, while the preview server hashes, watches, and imports Python-only definitions. Either dedupe / namespace YAML examples or teach the preview surfaces to understand non-Python definitions consistently.
- [ ] `[M]` Align interactive relayout with build-time layout rules. Preview relayout currently propagates diagram-level gaps into nested panels more aggressively than the build path, and drag clamping still uses raw `INSET` instead of the richer `pad` / `headingHeight` metadata already present in the component model.
- [ ] `[S]` **draw.io renderer uses spatial containment for parenting.** `_find_children` in `diagram_render_drawio.py` uses bounding-box overlap instead of `component_id`, which can mis-parent elements at shared edges. Fix: match by `component_id`.
- [ ] `[S]` **`_uniform_row_height` ignores Annotations/Helpers.** Rows containing only annotations get `BOX_MIN_HEIGHT` regardless of content. The post-hoc helper expansion partially compensates but runs after uniform equalization.
- [ ] `[S]` Fix upstream spec-provenance drift. `DIAGRAM.md` and related docs still point at `canonical-spacing-spec`, while the documented sibling repo is `canonical-specs`; normalize the paths and claims so the advertised spec → token → tool chain is actually resolvable on a cold start.
- [ ] `[S]` Triage the secondary audit findings: stale-v2 comparison risk in `build_outputs.py`, preview text-width mismatch vs renderer text width, dead helper layout code, stale architectural line-count notes in `STATUS.md`.
- [ ] `[L]` **Preview port-kill on Windows.** `preview_server.py` runs `Stop-Process -Force` on any PID holding the port, even if it's an unrelated service. Fix: log the target PID or require `--force`.
- [ ] `[L]` **`_relayout` gap comparison uses reloaded module.** After `importlib.reload(mod)`, `orig_col_gap` reads from the new module state, not the pre-reload snapshot. Fix: capture originals before reload.

### Ongoing maintenance

- [ ] `[S]` Manual draw.io desktop smoke test for `diagrams/2.output/draw.io/*-onbrand.drawio` and `assets/drawio/diagram-generator-primitives.mxlibrary` when draw.io is available locally.
- [ ] `[S]` Manual Illustrator desktop smoke test for the SVG batch when Illustrator is available locally.
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear.
- [ ] `[S]` Re-audit generator helpers when the starter block changes, to prevent drift back into mixed inset or line-height rules.

### v2 declarative pipeline — defect registry

All audited diagrams pass. Use `python scripts/_compare_3way.py` for visual comparison and `python scripts/_audit_v2.py` for element counts. Arrow clearance and crossing enforced at build time.

| Diagram | Status |
|---|---|
| attention-qkv | OK |
| gpu-waiting-scheduler | OK |
| inference-snaps | OK |
| logic-data-vram | OK |
| memory-wall | OK |
| request-to-hardware-stack | OK |
| rise-of-inference-economy | OK |