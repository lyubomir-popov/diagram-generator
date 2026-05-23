*# TODO

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
6. The imported dense application and documentation mapping from `canonical-specs` remains the reference tier, and the current diagram tier now uses `18px` body copy with `24px` line height to keep live text proportionate to the standard `48px` icon treatment inside the `192px` block system.
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

- `DIAGRAM.md` is the canonical plain-text diagram language spec. It owns tokens, rules, output constraints, and all visual-language decisions.
- `.github/copilot-instructions.md` owns workflow discipline and the anti-patch protocol.
- Workflow skills under `.github/skills/` hold repeatable procedures that reference `DIAGRAM.md` for rules.
- Do not duplicate visual rules across files. If the same rule appears in two places, delete one.

## Active TODO

### Client-side layout engine — TypeScript port (COMPLETE)

**Why now:** Week 0 of a 6-month project. The layout algorithm is correct (174 tests, FILL distribution fix landed). The remaining autolayout bugs are caused by the Python server round-trip, not the algorithm. Fixing them in the current architecture means writing throwaway code. Porting first means every subsequent feature lands in the right architecture.

**What to port:** ~800 lines of pure functions from Python → TypeScript.

| Python source | TypeScript target | Notes |
|---|---|---|
| `frame_model.py` (~200 lines) | `packages/layout-engine/src/frame-model.ts` | Frame, Direction, Sizing, Align, Border enums + Frame tree |
| `layout_v3.py` measure/coerce/place (~600 lines) | `packages/layout-engine/src/layout.ts` | Pure functions, no DOM. `_distribute_fill_space`, `_enforce_fill_hug_invariant`, `measure`, `place` |
| `diagram_shared.py` tokens | `packages/layout-engine/src/tokens.ts` | `BASELINE_UNIT`, `BLOCK_WIDTH`, `BODY_LINE_STEP`, etc. |
| Text measurement (fontTools) | Browser `Canvas.measureText()` | Accept browser as truth for interactive; fontTools for batch |

**What stays in Python:** YAML loading, SVG rendering, draw.io export, batch builds, override file I/O.

**What changes in editor.js:** Replace `requestV3Relayout()` HTTP POST → local `import { layout } from './layout.ts'` call. Server becomes save/load/export only.

**Port plan:**

- [x] `[H]` **M1: Frame model in TypeScript.** Port `Frame`, `Direction`, `Sizing`, `Align`, `Border` to TypeScript. Include `enforceFillHugInvariant` (coercion logic). 21 unit tests passing (construction, validation, coercion). Package: `packages/layout-engine/`.
- [x] `[H]` **M2: Layout algorithm in TypeScript.** Port `measure()`, `distributeFillSpace()`, `place()`, `alignOffset()`, `headingHeight()`, constrained re-measurement pass. Text measurement via adapter interface (`TextMeasureAdapter`). Design tokens in `tokens.ts`. 46 new tests (24 layout + 22 tokens). Package: `packages/layout-engine/src/layout.ts`, `tokens.ts`, `text-measure.ts`.
- [x] `[S]` **M3: Real text measurement adapter.** Canvas text adapter (`canvas-text-adapter.ts`) with Ubuntu Sans Variable. 6 tests. IIFE browser bundle (33KB).
- [x] `[S]` **M4: Wire into editor.** Layout bridge (`layout-bridge.js`) replaces server round-trip with local layout. Server serializes Frame tree JSON via `/api/frame-tree/<slug>`. Editor falls back to server path on failure. Browser-verified on two diagrams.
- [x] `[S]` **M5: Shared test fixtures.** 6 parity fixtures (vertical-stack, fill-distribution, mixed-sizing, nested-containers, deep-nesting, alignment-grid) with JSON input + expected coordinates. Python test (`test_parity.py`, 6 tests + 33 subtests) and TS test (`parity.test.ts`, 39 tests) verify both engines produce identical coordinates using mock text adapter (text.length × fontSize × 0.6). Discovered `_refresh_coerced_heights` bug: overwrites explicitly-set FIXED heights on roots with FILL children — same behavior in both engines, noted for post-parity fix.
- [x] `[S]` **M6: Server API cleanup.** Removed `/api/relayout-v3/<slug>` endpoint, `_relayout_v3()` function, `_serve_relayout_v3()` handler, and `test_relayout_v3.py`. Removed server fallback from `requestV3Relayout()` in `editor.js` — now client-side-only via `performLocalRelayout()`. Server keeps: load diagram, save overrides, export SVG/draw.io, batch build, frame-tree JSON API. Browser-verified: 0 console errors, grid column/gap changes work via client-side layout.

**Anti-patch rule for the port:** This is a **faithful port**, not a redesign. The TS layout engine must produce identical coordinates to the Python engine for the same input. Do not add features, change the algorithm, or "improve" the model during the port. Feature work resumes after M5 confirms parity.

**Architecture audit peer review (2026-05-22):** An Opus 4.6 audit (`diagram-generator-planning/docs/architecture-audit-2026-05.md`) proposed 4 prerequisites before the TS port. Peer review found **none of them actually gate the port**:

| Audit proposal | Verdict | Why |
|---|---|---|
| Move rendering decisions into layout pass | **Not needed** — `layout_v3.py` already owns all layout for v3 Frame YAML. Text is pre-wrapped, grid positions pre-computed, arrow routing resolved. Renderers are already pure markup emitters. |
| SVG renderer snapshot tests | **Nice-to-have** — the TS port doesn't touch renderers (they stay in Python). Add when refactoring renderers, not before porting layout. |
| Deprecate v2 before porting | **Parallel track** — we're porting `layout_v3.py` only. v2 stays in Python. Deprecation is cleanup, not a gate. |
| Split `diagram_shared.py` | **During port** — the TS port only needs tokens and text measurement interface. Split as modules are ported, not upfront. |

**Valid findings to address (non-blocking, parallel or post-port):**

- [ ] `[S]` **v2→v3 migration audit.** Audited: 10 v3 Frame YAML diagrams, ~24 v2 diagrams (Python modules + YAML). 19+ can migrate immediately (Boxes, Panels, Arrows only). 3 diagrams are blocked: `attention_qkv` (MatrixWidget, Legend), `logic_data_vram` (Bar/BarSegment), `inference_snaps` (Terminal). These need new v3 Frame primitives (BarFrame, MatrixFrame, TerminalFrame) before they can migrate. Move to ROADMAP when ready to add specialized primitives.
- [x] `[L]` **SVG renderer snapshot tests.** 3 golden-file snapshot tests (two_box_vertical, panel_with_children, horizontal_arrow) with `--update-golden` flag for intentional changes.
- [x] `[S]` **`diagram_shared.py` cleanup during port.** Extracted `design_tokens.py`, `text_metrics.py`, `grid_helpers.py` alongside unchanged `diagram_shared.py` for backwards compatibility.
- [ ] `[S]` **`preview_server.py` decomposition (post-port).** After M4 (layout client-side), extract file watcher, layout cache, override manager, and SSE broadcaster into focused modules. Server role shrinks to static files + save/export API.
- [x] `[S]` **`_refresh_coerced_heights` bug (post-parity).** Fixed: threaded `coerced_ids` set from `_enforce_fill_hug_invariant()` through `_remeasure_with_width_constraints()` → `_refresh_coerced_heights()`. Now only frames that were actually coerced from HUG→FIXED get refreshed; explicitly-set FIXED heights are preserved. Fixed in both Python (`layout_v3.py`) and TS (`layout.ts`). Parity fixtures updated — test-fill-distribution root now correctly keeps height=480.
- [ ] `[L]` **Security hardening before Stage 17.** Add schema validation for incoming JSON (`setattr` on Frame objects, override loading). Add CSRF when server becomes network-accessible. Not urgent while server is local-only.
- [ ] `[S]` **`EditorState` container (during M4).** When wiring client-side layout, introduce structured state container with pure update functions and event emitter. Replace 40+ globals and overlapping override representations. Natural time to fix — relayout flow changes fundamentally.

### Autolayout architecture — Figma-grade sizing model (PRIORITY 1)

**Execution order (revised 2026-05-22):** The layout algorithm is correct (174 tests, FILL distribution fix landed). The remaining bugs (race conditions, stale coercion, undo lifecycle) are caused by the Python server round-trip architecture, not the algorithm. At week 0 of a 6-month project, fixing these in the current architecture means writing throwaway request-sequencing and cross-process state-sync code that gets deleted when the TS port lands. **Pivot: port layout engine to TypeScript first (ROADMAP Stage 15.5), then tackle coercion visibility and remaining UI work in the new architecture.** See `diagram-generator-planning/docs/performance-analysis-and-recommendations.md` for the full analysis.

**Sequence:**
1. ✅ Fix FILL distribution contract (done — algorithm-correct regardless of where layout runs)
2. ✅ Port layout engine to TypeScript (Stage 15.5 — M1–M6 complete, 112 TS tests + 151 Python tests)
3. Wire coercion visibility into inspector (post-port — trivial with synchronous layout)
4. Constraint UI, edge cases, advanced parity (Tiers 2–4 — build in the new architecture)

**Anti-patch classification:** Every item in this section is a **contract change** (new primitive behavior in the engine) or a **bug** (existing contract violated). None are one-offs or patches. After the TS port, the ownership map shifts: `layout.ts` owns spatial truth (replacing `layout_v3.py` for interactive editing). `layout_v3.py` stays for batch builds. `editor.js` remains UI-only — it must not invent layout facts.

**Non-negotiable invariant:** When any child is set to FILL on a parent's primary axis, that parent MUST switch to FIXED on that axis. This is Figma's rule, and it is the foundation of a working autolayout. The engine already computes this correctly via `_enforce_fill_hug_invariant()` — but the UI doesn't show it, and the coerced state isn't persisted.

**Research basis:** Parallel research of Figma, Penpot, and CSS Flexbox sizing models (2026-05-22). All three agree on the core constraint: a content-sized (Hug) container cannot contain space-filling (Fill) children on its primary axis — the parent must freeze at a definite size first.

| System | HUG parent + FILL child on primary axis | Behavior |
|---|---|---|
| **Figma** | Parent auto-converts to FIXED; visible in inspector | Non-negotiable, automatic |
| **Penpot** | Allowed; resolves to min-content; no warning | Permissive, mathematically sound |
| **CSS Flex** | Indefinite container + `flex-grow` → items get `0` growth | Children get content size only |
| **Our engine** | Engine coerces correctly; **UI doesn't show it; not persisted** | Half-implemented |

#### Tier 1 — Make coercion visible and persistent `[H]`

This is the critical gap. The engine does the right thing; the UI lies about it.

**Deferred to post-TS-port (round-trip artifacts):**

The following blockers are caused by the server round-trip architecture. Instead of adding request-sequencing and cross-process state-sync complexity that would be deleted after the TS port, we defer them. They resolve naturally when layout runs client-side.

**Resolved by TS port (round-trip artifacts no longer exist):**

- [x] ~~`[H]` **Stale coerced overrides not cleaned up.**~~ Resolved — client-side layout means coercion state is local.
- [x] ~~`[H]` **Race condition — old relayout responses overwrite newer user actions.**~~ Resolved — synchronous client-side layout has no races.
- [x] ~~`[H]` **Undo doesn't preserve coercion reversibility.**~~ Resolved — local state manipulation, no cross-process tracking needed.

**Still relevant (fix during or after TS port):**

- [x] `[H]` **Stale coerced overrides in persisted JSON.** Cleaned: `android-container-vs-vm.json` contained 3 redundant `sizing_w: FILL` overrides matching the YAML base default. Removed them. All other override files contain intentional user adjustments (dx/dy/dh/grid config). Runtime stale-cleanup for coerced overrides already handled by the `_coercedKeys` cleanup in the relayout path (values AND keys deleted when coercion clears). Future: consider a general "prune redundant overrides on save" mechanism if the problem recurs.
- [x] `[H]` **Wire coerced_overrides into the inspector.** Done: "Fixed (auto)" with gold italic styling appears when engine coerces HUG→FIXED. Key mapping fix: TS engine returns camelCase (`sizingH`), overrides use snake_case (`sizing_h`). Stale coerced keys AND override values cleaned up after each relayout (re-run layout on cleanup so model is never stale). Key map extracted to `_COERCED_KEY_MAP` lookup table. Multi-select support included.
- [x] `[S]` **Immediate feedback on child→FILL.** Works: changing a child to FILL immediately triggers parent coercion visibility via debounced relayout (300ms). Browser-verified.
- [x] `[S]` **Test coverage for coercion lifecycle.** 7 TS tests added: single FILL→revert, partial FILL removal, override value correctness, horizontal axis lifecycle, nested independent coercion/revert, cross-axis non-coercion, mixed FILL/HUG distribution. All 119 tests pass.

#### Tier 2 — Constraint UI `[S]`

The engine already supports `min_width`/`max_width`/`min_height`/`max_height` (10 tests passing). The inspector has no fields for them.

- [x] `[S]` **Min/max constraint fields in single-select inspector.** Added input fields for min_width, max_width, min_height, max_height below the sizing dropdowns. Visible when sizing is FILL or FIXED, hidden for HUG. Empty value clears the constraint. Model data extended in layout-bridge.js to expose frame min/max values. Browser-verified: constraints affect layout (min_height=120 on a FILL child increased it from 64→160).
- [x] `[S]` **Min/max in multi-select inspector.** Added constraint rows to multi-select inspector, visible when common sizing is FILL or FIXED. Empty value clears constraints for all selected items. Browser-verified: setting min_height=80 on 2 selected items applies to both.
- [x] `[S]` **Constraint violation feedback.** Auto-adjusts opposite bound when min > max (Figma-style): setting min above max raises max to match; setting max below min lowers min to match. Browser-verified: max_width=100, then min_width=200 → max auto-raised to 200; then max_width=50 → min auto-lowered to 50. Works in both single-select and multi-select.

#### Tier 3 — Edge case robustness `[S]`

- [x] `[S]` **Nested coercion cascade test.** Covered by "nested coercion: inner and outer both coerce and revert independently" in layout.test.ts.
- [x] `[S]` **Cross-axis FILL behavior audit.** Covered by "cross-axis FILL does not coerce parent" test — FILL-width children in VERTICAL container don't coerce parent's width. 
- [x] `[S]` **Coercion undo.** Covered by "coerces HUG parent when child becomes FILL, reverts when child set back to HUG" test + browser-verified "Immediate feedback on child→FILL" scenario.
- [x] `[S]` **Hug parent with mixed FILL/HUG children.** Covered by "mixed FILL/HUG children" test — HUG children take natural size, FILL children split remainder equally (±4px for grid snapping).

#### Tier 4 — Advanced Figma parity `[H]`

These are longer-term. Do not start until Tiers 1–3 are solid.

- [ ] `[H]` **Space-between / space-around / space-evenly.** Justify modes for distributing extra space. Figma supports these; our engine doesn't.
- [ ] `[H]` **Absolute positioning within autolayout.** Figma's "Ignore auto layout" flag. Lets a child opt out of the flow and position freely within the parent.
- [ ] `[S]` **Wrap mode for horizontal flows.** When horizontal children exceed parent width, wrap to the next row.
- [ ] `[S]` **Proportional FILL weights.** CSS `flex-grow: 2` gives twice the space. Figma doesn't expose this, but it's natural for technical diagrams. Consider adding `fill_weight` to the frame model.
- [ ] `[L]` **Percentage sizing.** Figma supports %; Penpot doesn't. Evaluate whether this adds value for diagram use cases.

#### Padding & border architecture (complements sizing model above) `[H]`

**Anti-patch classification:** The FILL distribution fix is a **contract change** — it changes the fundamental behavior of `_distribute_fill_space()` in `layout_v3.py` (the layer that owns "measure + place — spatial truth"). Do NOT fix this by adding special-case padding adjustments in `editor.js`, `preview_server.py`, or the SVG renderer. The fix must land in `layout_v3.py` and be verified by running ALL diagrams through the engine, not just the triggering one.

**The visible symptom:** Children flush against parent borders (0px clearance at bottom or right edge) even when `padding: 8` is set. The user sees the parent's border touching the child's border.

**Root cause found (2026-05-22):** `_distribute_fill_space()` never shrinks FILL children below their measured content size (line 83: `if fill_measured[idx] > share: sizes[idx] = fill_measured[idx]`). When multiple FILL children's measured sizes sum to MORE than the available space (parent_size − padding − heading − gaps), the children overflow and eat the padding.

**Example:** `host_container` in `android-container-vs-vm`:
- Parent height: 216px, padding_top=8, padding_bottom=8, heading=64px, heading_gap=8, child_gap=8
- Available for children: 216 − 8 − 8 − 64 − 8 − 8 = 120px
- Two FILL children, each measured at 64px → sum=128 > 120
- Clamping prevents shrink: both get 64px → total 128px → bottom padding consumed

**How Figma/CSS handle this:**
- **Figma:** FILL children divide available space equally regardless of content. Content overflows the child if too large, not the parent's padding.
- **CSS Flex:** `flex-shrink: 1` (default) allows items to shrink below their basis. Items shrink proportionally.
- **Penpot:** FILL children start at min_size and grow into available space.

**Our model's flaw:** The iterative clamping algorithm treats measured content size as a hard floor. This is wrong for FILL — FILL means "I accept whatever space the parent gives me." Only HUG/FIXED children should have a content-based floor.

**Research findings — the box model:**

| System | Available space formula | Border in layout? |
|---|---|---|
| **Figma** (border-box) | `available = parent_w − stroke − padding_l − padding_r` | Yes (inside stroke reduces content space) |
| **Penpot** | `available = parent_w − padding_l − padding_r` | No (strokes are purely visual) |
| **CSS border-box** | `available = parent_w − border_l − border_r − padding_l − padding_r` | Yes |
| **Our engine** | `available = parent_w − padding_l − padding_r` | **No — border thickness not accounted for** |

**Items:**

- [x] `[H]` **BLOCKER: Fix FILL distribution to shrink below measured size.** File: `scripts/layout_v3.py`, function `_distribute_fill_space()` (line ~83). FILL children now divide available space equally regardless of measured content size. Min/max constraints are the only floor/ceiling. Verified: 174 tests pass, all 10 frame YAML diagrams pass, browser-confirmed padding preserved on `android-container-vs-vm`.
- [x] `[S]` **Test: padding preserved with FILL children.** Added `test_fill_children_preserve_padding` and `test_fill_children_preserve_padding_with_heading` in `test_autolayout.py`.
- [x] `[H]` **Per-side padding UI in inspector.** Added 4-field padding input (T/R/B/L) with a link toggle button (🔗/🔓) for uniform/per-side mode. Single-select: togglePaddingLink() switches between uniform `padding` override and per-side `padding_top/right/bottom/left` overrides. Multi-select: toggleMultiPaddingLink() applies to all selected containers. Layout bridge handles per-side padding overrides (applied after uniform, so they win). setFrameProp/setMultiFrameProp clear conflicting overrides when switching modes. Browser-verified: link/unlink toggle, per-side value editing, re-linking uses top value.
- [ ] `[S]` **Border thickness in layout math.** Currently border is purely visual (1px, not subtracted from available space). Evaluate whether to adopt Figma's model: inside stroke reduces content space by `stroke_width` per side. This would change `available = parent_w - pad_l - pad_r - 2*stroke_w`. Low priority since our borders are 1px, but architecturally correct for future border-weight support.
- [x] `[S]` **Heading height consistency.** Fixed: heading height is now computed with width-constrained text wrapping at all stages (remeasure, propagate height changes, refresh coerced heights, place). Added `_heading_text_max_w()` helper that uses `_placed_w` (if available) or `_resolved_w`. Both Python and TS engines fixed in parallel. Test added to both.
- [x] `[S]` **Test: padding preserved with FILL children.** Covered by the two new tests above.
- [x] `[L]` **Padding defaults audit.** Verified: bordered nodes get `padding=8` (inset from border), borderless containers get `padding=0` (pure layout groups). Rationale documented in `frame_loader.py`. No borderless containers with headings exist in current diagrams — default 0 is correct. No change needed.

---

### Doc freshness (post-session audit, 2026-05-22)

- [x] `[L]` **README.md** — updated agent prompt, exemplar path, and "Creating your own diagram" to show native Frame YAML as the primary path.
- [x] `[L]` **STATUS.md** — condensed Pipeline 3 section, removed stale "Uncommitted v3 editor work", moved Windows smoke pass to HISTORY.
- [x] `[L]` **TODO.md** — archived completed milestones 1–12; open work now visible without scrolling past completed items.

### v3 auto-layout engine — test-first redesign (branch `frame-layout-engine`)

The v3 frame engine has the right Figma-like model (`Direction`, `Sizing`, `Align`) but was developed directly against real diagrams. The previous session stacked features without browser verification (alignment dropdowns, relayout API, editor CSS), resulting in 6 server crashes and zero confirmed features. That code is now stashed (`git stash list` → "unverified-v3-ui-work").

This plan rebuilds the engine's test coverage from scratch, fixes the cross-axis alignment gap, and only then re-integrates the UI work.

**Rules:**
1. One milestone at a time. Do not start the next until the current one passes QA.
2. QA = user reviews test output and confirms direction before proceeding.
3. No feature is "done" without a passing test and (where applicable) browser verification.
4. No patch-on-patch. If something is wrong, fix the root cause.

**Key files:**
- `scripts/frame_model.py` — `Frame`, `Direction`, `Sizing`, `Align`
- `scripts/layout_v3.py` — `measure()`, `place()`, `_align_offset()`
- `scripts/test_autolayout.py` — comprehensive test suite (this plan)
- `scripts/test_layout_v3.py` — original 8 tests (kept for regression)
- `scripts/frame_adapter.py` — v2 → v3 diagram adapter
- `scripts/diagram_shared.py` — tokens (`BASELINE_UNIT=8`, `BLOCK_WIDTH=192`, etc.)

---

#### Milestones 1–12: Complete ✅

All 12 milestones completed. 165 tests passing. See `HISTORY.md` for dated entries covering each milestone's work.

**Summary:** Stabilize (M1) → directional layout tests (M2) → 9-point alignment (M3) → sizing model (M4) → research-informed fixes (M4a) → cross-axis alignment (M5) → real diagram integration (M6) → stashed UI superseded (M7) → nested stress testing (M8) → editor integration (M9) → native Frame YAML (M10) → per-axis sizing redesign (M11) → interaction parity (M12).

**Deferred items carried forward:**
- [x] `[S]` **Golden-value assertions** for representative diagrams (from M6) — superseded by M5 parity fixture system (6 fixtures, 39 TS + 39 Python assertions). Real diagrams use different text measurement backends (fontTools vs Canvas.measureText), so exact coordinate matching isn't feasible cross-engine. Within each engine, parity fixtures catch algorithm regressions. Additional per-diagram invariant tests (no child overflow, bounds containment) would add value but are lower priority than feature work.
- [x] ~~`[S]` **API test** for `/api/relayout-v3/<slug>` (from M7)~~ — N/A, endpoint removed in M6.
- [ ] `[S]` **Autolayout toggle on parent** — requires `Direction.NONE` and absolute positioning (from M12)

### Editor UX

- [x] `[S]` **Domain-specific undo/redo.** All undo actions now use targeted override-patch commands instead of full-state snapshots. Fixed bug where v3 style changes had no undo. Added undo to `setFrameProp`, `setFrameAlign`, `setMultiFrameProp`, `setMultiFrameAlign`, `applyMultiStyleOverride`. Only grid-adjust and clear-all-overrides still use full snapshots (legitimately need full state).

### Brockman grid — column/row snapping and sizing

The editor now has a proper Brockman composition grid (baseline-snapped rows, equal columns, bottom-margin absorption). Next steps to make it a real InDesign-like layout tool:

- [x] `[S]` **Baseline-snap column widths.** Column widths are currently raw `contentW / cols` — not snapped to `BASELINE_STEP`. Snap column widths down to 8px multiples; absorb leftover into a resolved right margin (matching the row→bottom pattern). Update both `_computeBrockmanGrid()` in editor.js and `_build_grid_info()` in layout_v3.py. Prerequisite for column-span input and grid-aware snapping.
- [x] `[H]` **Snap to grid.** Drag and resize should snap to column edges, row tops, and baseline grid lines — not just the 8px graph-paper grid. The current snap stops short of or overshoots grid lines. Depends on baseline-snapped columns.
- [x] `[S]` **Force-mode alignment guides.** Force diagrams need the same alignment guides (column edges, row tops, baseline grid) as grid diagrams. Also consider a grid-field visualisation so key nodes can be placed at exact grid intersections while the rest self-organise.
- [x] `[H]` **Column-span width input.** Add a units dropdown (`px` / `cols` / `rows`) next to the sizing mode in the inspector. When unit = `cols`, width = `colW * span + colGap * (span - 1)`. When unit = `rows`, height = `rowH * span + rowGap * (span - 1)`. Apply to both single-select and multi-select inspectors. `gridInfo` is already globally accessible. Depends on baseline-snapped columns.
- [x] `[S]` **Grid-aware resize.** When dragging a resize handle, show snap indicators at column/row edges and snap to them with priority over the baseline grid.
- [x] `[L]` **Persist grid config.** Already implemented: grid overrides (cols, col_gap, row_gap, outer_margin) are saved in the override JSON via `toOverridePayload()` and restored via `loadOverrides()`. Grid UI inputs populate from loaded values.

### Export

- [x] `[S]` **Save SVG button.** The preview sidebar now exposes `Save SVG`, which downloads the current stage DOM as an `.svg` file using the active engine suffix (`*-onbrand-v3.svg` for native frame diagrams).
- [x] `[S]` **PNG export at 1x, 2x, 3x.** Added `scripts/export_png.py` — Playwright-based PNG exporter using `device_scale_factor` for crisp rendering at each scale. Supports `--all`, `--scale 1,2,3`, `--output-dir`. Per-scale browser contexts, proper resource cleanup, validated error handling. Preview Export button integration deferred (separate UI task).

### Code quality — open
- [x] `[H]` Unify the parent-scoped equal-split/outdent math across `scripts/diagram_layout.py` and `scripts/preview/component-model.js`. Extracted `equal_split_cell()` and `span_size()` into `diagram_shared.py` and `editor-base.js`. Wired both `component-model.js` and `diagram_layout.py` to use shared versions. v2 pipeline sp_outer_w keeps intentional ceil rounding (documented). 7 cross-language contract tests added.
- [x] `[S]` **draw.io renderer uses semantic parenting.** `_find_children` in `diagram_render_drawio.py` now matches TextBlocks and Icons by `component_id` instead of bounding-box overlap. Falls back to spatial containment only for legacy primitives without `component_id`. Verified: `build_v2.py` runs clean on all diagrams (only pre-existing clearance violations).
- [x] `[S]` **`_uniform_row_height` ignores Annotations/Helpers.** Fixed: function now accepts all grid-placed items (Box, Helper, Annotation, MatrixWidget) with per-type height computation. Removed redundant post-hoc helper expansion loop. Annotation docstring contract ("participates in row-height equalization") now implemented.
- [x] `[S]` Triage the secondary audit findings: ~~stale-v2 comparison risk in `build_outputs.py`~~ (tracking note, not actionable — reference rasters are intentionally frozen), ~~preview text-width mismatch vs renderer text width~~ (known limitation: Python fontTools vs browser Canvas.measureText; resolves when TS port completes), ~~dead helper layout code~~ (removed `_layout_helper` — was never called), ~~stale architectural line-count notes in `STATUS.md`~~ (fixed: 485→~1380).
- [ ] `[L]` Triage the current `build_v2.py` corpus blockers separately from the 2026-05-13 autolayout slice: clearance violations on `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, and `lt-summit-identity` (fix: increase row_gap/col_gap to ARROW_GAP where arrows route), plus 59 warning-only baseline-grid violations across several older diagrams (cosmetic, not blocking).

### Force ↔ grid editor unification

Goal: the force and grid editors share one editor shell; swapping the layout engine should not duplicate interaction code. The audit below lists every grid-editor capability and its force-editor status. Items are ordered by user-facing impact.

**Architecture prerequisite**

- [x] `[H]` **Unified editor shell.** Created `editor-base.js` (shared utilities: `byId`, `escapeHtml`, `fetchJson`, `setStatus`, `getStageSvg`, `pointerToSvgPoint`, `setViewMode`, `initPreviewShell`) and `viewer-unified.html` (single HTML template with `data-dg-mode="grid"|"force"`, CSS mode visibility via `.dg-grid-only`/`.dg-force-only`). Both grid and force editors now use the same shell, sidebar header, picker, and view tabs. Force.js deduped to use shared base functions. Server serves unified template for both modes.
- [ ] `[S]` **Swappable engine interface — Phase 3+.** Create concrete `GridEngine` / `ForceEngine` adapter subclasses implementing `EngineAdapter`. Wire shared interaction code through the adapter contract. Incremental: start with selection, then drag/resize delegation. *(Phase 1 interface + Phase 2a shared primitives + Phase 2b shared snap are done. Remaining work follows established patterns.)*

**Stage interaction parity**

- [x] `[H]` **Resize handles.** Force nodes now show 8 resize handles (corners + midpoints) when selected. Dragging snaps to 8px grid, commits width/height to server, and restarts solver. Backend supports width/height in node update API and override serialization.
- [x] `[S]` **Text editing.** Double-click inline label editing with Enter to commit, Escape to cancel, Shift+Enter for newlines. Label overrides persisted through force override system. Undo support.
- [x] `[S]` **Multi-select.** Shift/Ctrl+click toggles selection in both stage and tree. Arrow-key nudge moves all selected pinned nodes. Inspector shows count for multi-select; resize handles single-only.
- [x] `[S]` **Hover highlighting.** Reuses existing `dg-hover` CSS class via mouseover/mouseout on node groups.
- [x] `[L]` **Snap guides.** Alignment snap guides shown during force-node drag (peer edge/center, shared `renderGuideLines` from editor-base.js).

**Inspector parity**

- [x] `[S]` **Dirty flag and save-button state.** Added `_savedIndex`, `markSaved()`, `isDirty()`, and `saveBtnId` to `UndoRedoManager`. Force editor Save button now disabled when clean. Handles: branch divergence (undo+new push invalidates saved point), maxSize overflow, reset. Initial button state set on construction.
- [ ] `[S]` **Constraint enforcement.** Run the same fill/stroke/highlight-limit/containment checks on force nodes and display violations in the sidebar.
- [x] `[L]` **Override highlight in tree.** Tree items with pinned position or style override get italic + accent color via `.overridden` class.

**Persistence and undo**

- [x] `[H]` **Undo/redo for force.** Command-based undo stack (max 50) covering move/pin, style change, text edit, and resize. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard shortcuts. Reset clears the stack.
- [x] `[S]` **Stale-definition detection.** Tracks definition_hash from saved overrides. Shows warning banner in force viewer when source JSON changed since last save. Saving clears warning.

**Connectors and arrows**

- [ ] `[S]` **Arrow waypoint editing.** Allow dragging force-link control points (curve handles) interactively, with double-click to add/remove, matching the grid editor's waypoint path.
- [ ] `[S]` **Arrow endpoint attachment.** Force links should follow node moves via side-aware offset instead of recalculating from scratch.

**Keyboard shortcuts**

- [ ] `[L]` **Grid overlay toggle (W).** Decide whether force preview needs a baseline-grid overlay or if that concept doesn't apply.
- [x] `[L]` **Keyboard nudge.** Arrow-key nudge (8px default, 24px with Shift) for pinned force nodes. Multi-select moves all selected pinned nodes.
- [ ] `[L]` **Double-click depth cycling.** Decide whether force nodes need a depth-drill concept (probably N/A for flat graphs).

**Visual scale consistency**

- [ ] `[S]` **Consistent stroke/outline weight.** Force preview currently renders at a larger apparent scale, making outlines look thinner relative to text. Normalize the SVG viewBox / coordinate system so 1px strokes match the grid editor's visual weight.

**Export round-trip**

- [ ] `[S]` **Force → declarative pipeline.** Decide how force-preview exports feed back into `scripts/diagrams/*.py` or `build_v2.py`. Currently exports snapped JSON/SVG but does not round-trip.

### v3 engine — near-term

- [x] `[H]` **Work through the current architecture audit.** See [docs/architecture/v3-engine-audit.md](docs/architecture/v3-engine-audit.md). All three priority items completed:
  - [x] Added explicit `grid:` blocks to all 4 active frame YAMLs (support-engineering-flow, android-container-vs-vm, android-security-comparison, android-graphics-stack).
  - [x] Added 29 automated tests for `/api/relayout-v3` in `scripts/test_relayout_v3.py` covering grid_overrides, frame property overrides, style overrides, coercion, and children reorder.
  - [x] Documented frame-YAML omission/default rules in TODO.md Milestone 10 section (frozen by `test_frame_loader.py`).
- [x] `[S]` **Add `min_width`/`max_width`/`min_height`/`max_height` to Frame.** Figma-style min/max constraints. Added 4 fields to Frame dataclass, clamping in `_distribute_fill_space`, `_resolve_child_widths`, and `place()`, API override forwarding, FRAME_KEYS in editor.js, YAML parsing in frame_loader. Validated: input validation (min≤max, non-negative), constrained hug_total accounting for FILL distribution, API input safety. 10 new tests, 164 total passing.
- [x] `[S]` **Separator role semantics.** Already documented in `DIAGRAM.md` § "Dashed separator primitive". Added `test_separator_role_renders_dashed_line` verifying that `role: separator` frames produce `DashedLinePrimitive` + `TextBlock` (not `Rect`).

### v3 engine — INBOX-triaged bugs

Three bugs reported by the user on `support-engineering-flow` (screenshots `image-1.png`, `image-2.png`, `image-3.png` — inspect before deleting).

- [x] `[H]` **FILL-width + HUG-height text re-measurement.** `measure()` wraps text at `BLOCK_WIDTH` (192px) but `place()` assigns a wider FILL width. HUG height is computed from the narrow wrap, so boxes are taller than their text needs at the placed width. Fix: add a re-measure pass after `place()` assigns final widths, re-wrapping text at the actual width and recomputing HUG heights. This is the root cause of both "different heights on HUG boxes" and "text wraps way before reaching parent padding."
- [x] `[S]` **Style vocabulary should be exactly 3 presets.** The intentional styles are: default (black border, white fill), accent/parent (grey fill, bold text, no border), highlight (black fill, white text). The dashed border (`Border.DASHED`) leaks through the "— original —" dropdown as a 4th unintentional style. Fixed: gated `Border.DASHED` out of the YAML parser (`frame_loader._BORDER`) and the editor `borderMap`, updated 4 test YAMLs from `border: dashed` to `border: solid`. `Border.DASHED` remains in the enum for programmatic v2 pipeline use.
- [x] `[H]` **Text editing overflow — deferred composition.** `commitTextEdit()` directly patched SVG `<tspan>` elements without re-wrapping or relayout, causing text to overflow the box on any line-break deletion. Fix: InDesign-like deferred composition — textarea shows semantic (unwrapped) text via new `heading_text`/`label_text` fields on `ComponentInfo`, commit builds a structured `{heading, label}` text override and triggers `requestV3Relayout()`, server processes text overrides in `_relayout_v3()` (preserving original line styles), engine re-wraps at frame width. Changed files: `diagram_layout.py` (ComponentInfo fields), `layout_v3.py` (_build_component_tree), `preview_server.py` (text override processing), `editor.js` (startTextEdit, commitTextEdit, FRAME_KEYS, initial-load relayout).
- [ ] `[H]` **Native text frames.** SVG text wraps word-by-word at export time and doesn't support in-place editing of multi-line content. The engine should model text as bounded frames (position + width + height) and only convert to SVG `<tspan>` chains on export. This would make text editing work like Illustrator/InDesign/draw.io text areas. (Longer-term; partially addressed by correct re-measurement and deferred composition above.)

### Force-specific UI controls

These controls only make sense for the force engine and don't need grid-editor parity.

- [x] `[S]` **Simplify force inspector.** The SELECTION panel shows too much detail (NODE, LABEL, POSITION, SIZE, PINNED, EFFECTIVE STYLE, Style dropdown, Pin/Unpin). Strip it down to the essentials — most of this chrome is unnecessary for the force use case.

- [x] `[S]` **Link distance slider.** Expose `link_distance` (currently JSON-only) as a live inspector control; restart solver on change.
- [x] `[S]` **Link strength slider.** Expose `link_strength` as a live inspector control.
- [x] `[S]` **Charge strength slider.** Expose `charge_strength` as a live inspector control.
- [x] `[S]` **Collision padding slider.** Expose `collision_padding` as a live inspector control.
- [x] `[S]` **Velocity decay slider.** Expose `velocity_decay` as a live inspector control.
- [x] `[S]` **Curve handle factor.** Expose the Bézier `handle_factor` (or `curve_offset`) as a live inspector control so the user can tune connector curvature interactively.
- [x] `[L]` **Alpha min / alpha decay.** Expose convergence thresholds if users need to tune settle behavior.
- [x] `[L]` **Preview port-kill on Windows.** `preview_server.py` runs `Stop-Process -Force` on any PID holding the port, even if it's an unrelated service. Fix: log the target PID or require `--force`.
- [x] `[L]` **`_relayout` gap comparison uses reloaded module.** After `importlib.reload(mod)`, `orig_col_gap` reads from the new module state, not the pre-reload snapshot. Fix: capture originals before reload.

### Ongoing maintenance

- [ ] `[S]` Manual draw.io desktop smoke test for `diagrams/2.output/draw.io/*-onbrand.drawio` and `assets/drawio/diagram-generator-primitives.mxlibrary` when draw.io is available locally.
- [ ] `[S]` Manual Illustrator desktop smoke test for the SVG batch when Illustrator is available locally.
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear.
- [ ] `[S]` Re-audit generator helpers when the starter block changes, to prevent drift back into mixed inset or line-height rules.
- [ ] `[S]` Keep preview-shell experiments on the vendored BF application shell unless there is an explicit repo-wide reason to introduce new preview CSS.

### v2 declarative pipeline — defect registry

The audited canonical diagrams pass the compare/audit checks, but full `python scripts/build_v2.py` still exits nonzero on the known clearance blockers listed above. Use `python scripts/_compare_3way.py` for visual comparison and `python scripts/_audit_v2.py` for element counts. Arrow clearance and crossing remain enforced at build time.

| Diagram | Status |
|---|---|
| attention-qkv | OK |
| gpu-waiting-scheduler | OK |
| inference-snaps | OK |
| logic-data-vram | OK |
| memory-wall | OK |
| request-to-hardware-stack | OK |
| rise-of-inference-economy | OK |