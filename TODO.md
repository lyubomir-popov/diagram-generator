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

#### Milestone 1: Stabilize ✅

- [x] Stash unverified UI code (alignment dropdowns, relayout API, editor CSS)
- [x] Verify original 8 tests pass (`python scripts/test_layout_v3.py`)
- [x] Verify preview server starts without crashing
- [x] Verify v3 page renders at `/view/v3:android-container-vs-vm`

**QA:** Server stable, tests green, v3 diagram visible in browser. ✅

---

#### Milestone 2: Directional layout tests ✅

Test the `measure()` → `place()` pipeline across both directions and nesting.

- [x] `[S]` **Vertical direction** (5 tests): single child positioning, gap spacing, heading reservation, nested containers, zero-gap edge case
- [x] `[S]` **Horizontal direction** (4 tests): single child, three side-by-side, cross-axis stretch, FILL width distribution
- [x] `[S]` **Mixed directions** (3 tests): V→H nesting, H→V nesting, three-level V→H→V hierarchy

**QA:** All 12 tests pass. ✅

---

#### Milestone 3: 9-point alignment grid tests ✅

Test that `Align` enum values correctly position content on both axes.

- [x] `[S]` **`_align_offset()` unit tests** (8 tests): x-axis LEFT/CENTER/RIGHT, y-axis TOP/CENTER/BOTTOM, no-slack case, content-larger-than-available case
- [x] `[S]` **Main-axis alignment integration** (7 tests): TOP_LEFT default, BOTTOM_LEFT push-down, CENTER centering, horizontal CENTER/RIGHT, FILL ignores alignment, multiple children centered
- [x] `[S]` **Grid-snap under alignment** (2 tests): all positions stay on 8px grid after alignment offset

**QA:** All alignment tests pass. ✅

---

#### Milestone 4: Sizing model tests ✅

Exhaustive testing of HUG/FILL/FIXED interactions.

- [x] `[S]` **HUG** (2 tests): container shrinks to content, nested HUG
- [x] `[S]` **FILL** (5 tests): equal shares, unequal measured sizes, HUG+FILL siblings, FILL accepts parent-assigned size (can shrink below measured), rounds down to grid
- [x] `[S]` **FIXED** (3 tests): explicit container size, explicit leaf size, FILL children in FIXED container
- [x] `[S]` **Edge cases** (4 tests): empty container, single FILL child, all HUG in FIXED, grid-snap invariant

**QA:** All sizing tests pass. Zero-slack FILL distribution verified in browser (gap=0, padding=0 → edge-to-edge). ✅

---

#### Milestone 4a: Research-informed gap fixes ✅

Three-subagent research (code review + Penpot/Yoga + Figma behavioral spec) identified gaps ranked by impact. All three addressed.

**Findings summary (2026-05-19):**
- Architecture is sound: two-pass measure→place matches Figma, Yoga (React Native), and Penpot.
- 8px grid snapping is tighter than Figma's pixel snap — a feature, not a limitation.
- HUG/FILL/FIXED trio maps directly to Figma's mental model.
- Features we do NOT need for diagrams: wrap mode, aspect-ratio, scrolling, text truncation, per-child alignment override, fractional units (fr).

**Fixes (commit `4eeeceb`):**

- [x] `[H]` **FILL-in-HUG invariant enforcement.** FILL children in HUG parents are coerced to HUG (keep measured size). This prevents the contradiction where equal-split gives less than content needs. 3 tests added.
- [x] `[S]` **FILL distribution fairness.** Extra grid units now go to last N children instead of first N, reducing visual bias. 2 tests added.
- [x] `[S]` **Heading overflow guard.** `max(0, ...)` guard on cross_size and available_for_children prevents negative child dimensions. 1 test added.

---

#### Milestone 5: Cross-axis alignment fix ✅

`_is_cross_stretch()` determines stretch vs position. TOP_*/LEFT_* stretch (backward compat), CENTER/END keep measured size + offset. Competitive review (Opus 4.6 + GPT-5.4) found the vertical `cross_size` negative guard bug — fixed. 10 tests added covering FILL+cross-center, heading+cross, nested container, vertical compat, overflow.

**Fixes (commit `477e511`):**

- [x] `[H]` **Cross-axis alignment in `place()`**: `_is_cross_stretch()` + per-child offset when not stretching
- [x] `[S]` **10 cross-axis tests**: 5 core + 5 reviewer-identified gaps (FILL+cross, heading, nested, vertical compat, overflow)
- [x] `[S]` **Backward compatibility**: 70/70 tests pass (62 comprehensive + 8 original)
- [x] `[S]` **Bug fix**: vertical `cross_size` clamped with `max(0, ...)` to prevent negative child dimensions

**Reviewer findings deferred to Milestone 9:**
- Destructive `_enforce_fill_hug_invariant()` mutation breaks interactive relayout — needs save/restore for editor
- Alignment conflated with stretch (no way to have TOP_LEFT + non-stretch) — acceptable for diagram use case, document as known limitation

---

#### Milestone 6: Integration with real diagrams ✅

- [x] `[S]` **Build verification**: `python scripts/build_v2.py` completes for all diagrams (exit code 1 from pre-existing clearance violations only, no build failures)
- [x] `[S]` **Browser verification**: all 3 representative diagrams render correctly in v3 engine:
  - `android-container-vs-vm` (18 components, container/VM comparison, vertical nesting)
  - `example-platform-architecture` (11 components, multi-column layout)
  - `example-arrow-label-separator` (3 components, arrow with labels)
- [x] `[S]` Inspector works on real v2→v3 adapted diagrams: auto-layout controls visible, per-axis sizing dropdowns present
- [ ] `[S]` **Golden-value assertions** for 3 representative diagrams — deferred (diagrams render correctly but golden-value tests need a test harness)

---

#### Milestone 7: Recover stashed UI work — SUPERSEDED

Stash `unverified-v3-ui-work` contains old alignment dropdowns and relayout API code. All of this was rebuilt from scratch in Milestones 9 and 11 (per-axis sizing, alignment widget, relayout API, buildAutolayoutPanel). The stash can be dropped.

- [x] ~~`[S]` **Unstash** alignment dropdowns + relayout API~~ — superseded by Milestone 9
- [x] ~~`[S]` **Diagnose and fix server crashes**~~ — moot (code rebuilt)
- [x] ~~`[S]` **Browser-verify alignment dropdowns**~~ — done in Milestone 9
- [x] ~~`[S]` **Browser-verify relayout API**~~ — done in Milestone 9
- [ ] `[S]` **Add API test** for `/api/relayout-v3/<slug>` — still valid, deferred

---

#### Milestone 8: Nested autolayout stress testing ✅

Competitive review (Opus + GPT-5.4) found 2 bugs and 6 test gaps. All fixed.

**Bug fixes (commit `b353c53`):**

- [x] `[H]` **FIXED container measured as HUG.** `measure()` now honors `sizing=FIXED` for containers, using explicit width/height instead of content-derived size. This prevents HUG parents from under-allocating FIXED children.
- [x] `[S]` **Horizontal `available_for_children` negative guard.** Clamped with `max(0, ...)` to match vertical path — prevents negative cursor start in tight horizontal layouts.

**Tests (15 new, 85 total):**

- [x] `[H]` **2-level nesting** (4 tests): V→V, V→H, H→V, H→H — all pass containment check
- [x] `[H]` **3-level nesting** (5 tests): V→H→V, H→V→H, V→V→V+FILL, FILL cascade 3-level, FIXED-in-HUG parent
- [x] `[S]` **Text overflow resilience** (4 tests): wide/tall/many children in tight containers, FILL shrink below measured
- [x] `[S]` **Container-too-small** (2 tests): overflow behavior, zero-FILL remainder
- [ ] `[S]` **Demo extension** — deferred to Milestone 9 (editor integration supersedes standalone demo)

**Reviewer findings deferred to Milestone 9:**
- Destructive `_enforce_fill_hug_invariant()` mutation — save/restore needed for relayout
- Grid-snap on alignment offsets (cross-axis CENTER) — known gap
- `child_sizing` conflates main/cross-axis FILL — acceptable for diagram use case

---

#### Milestone 9: Editor integration — autolayout in the official UI

The autolayout engine is now accessible from the main diagram editor. Controls in the inspector + live relayout.

- [x] `[H]` **Autolayout controls in editor inspector.** `buildAutolayoutPanel()` renders direction, gap, padding, sizing controls using BF `.bf-input` classes. Shown for container components only.
- [x] `[S]` **Relayout on property change.** `setFrameProp()` → debounced `requestV3Relayout()` → `POST /api/relayout-v3/{slug}` → server patches frame properties and re-runs `layout_frame_diagram()` → SVG replaced in DOM. Browser-verified: direction change updates diagram in real time.
- [x] `[S]` **Alignment triggers live relayout.** `setFrameAlign()` now calls `requestV3Relayout()` instead of deferring to build.

**Remaining (Milestone 9b) — SUPERSEDED by Milestone 11:**
- Depth navigation, Shift+Enter, nested selection highlighting, non-destructive FILL-in-HUG — folded into the per-axis sizing redesign below.

---

#### Milestone 11: Per-axis sizing redesign (Figma-correct model)

**Problem:** Three reported bugs + stress test reveal two fundamental design flaws:
1. Single-axis sizing (`sizing` + `child_sizing`) can't express per-axis Fill/Hug/Fixed.
2. `_is_cross_stretch()` derives stretch from parent alignment instead of child's own sizing — alignment changes mutate child fit.

Secondary flaws: `child_sizing` never round-trips through editor/server, component tree strips logical properties (editor fabricates defaults), `_enforce_fill_hug_invariant` silently mutates on every relayout.

**Figma model (researched):** Every node has independent `sizing_w`/`sizing_h`. Fill on primary axis = share remaining space. Fill on counter axis = stretch to cross space. Alignment only positions within slack — never mutates sizing. Resize on one axis → only that axis becomes FIXED.

**Phase 1: Data model + engine** (no UI changes yet) ✅
- [x] `[H]` Replace `sizing`/`child_sizing` with `sizing_w` + `sizing_h` in `Frame`
- [x] `[H]` Add per-side padding: `padding_top/right/bottom/left` (accept uniform `padding` in YAML as sugar)
- [x] `[S]` Update `frame_loader.py` to map YAML `sizing: fill` → both axes, or per-axis `sizing_w`/`sizing_h`
- [x] `[H]` Rewrite `measure()` to use `sizing_w`/`sizing_h` — FIXED leaf uses explicit dimensions per-axis
- [x] `[H]` Rewrite `place()` — per-child counter-axis check replaces `_is_cross_stretch()`:
  - Child's counter-axis is FILL → stretch to available cross space
  - Child's counter-axis is HUG/FIXED → keep measured size, offset by parent alignment
- [x] `[H]` Delete `_is_cross_stretch()` entirely
- [x] `[H]` Rewrite `_enforce_fill_hug_invariant` per-axis: HUG parent on primary axis coerces only children's primary-axis sizing; cross-axis FILL NOT coerced (children stretch to cross size)
- [x] `[S]` Update ALL tests in `test_autolayout.py` and `test_layout_v3.py` — 85/85 pass
- [x] `[S]` Update `frame_adapter.py` — `child_sizing` → `sizing_h` (vertical columns)
- [x] `[S]` Update `preview_server.py` — override whitelist handles `sizing_w`/`sizing_h`
- [x] `[S]` Update `demo_autolayout.py` — per-axis sizing badges and constructor

**Phase 2: Component tree round-trip** ✅
- [x] `[S]` Add `sizing_w`, `sizing_h`, `align`, `padding_top/right/bottom/left` to `ComponentInfo`
- [x] `[S]` Update `_frame_to_ci()` to include all logical properties (no more fabricated defaults)
- [x] `[S]` Editor reads real values from tree data, not guessed defaults
- [x] `[S]` Add `sizing_w`, `sizing_h`, `align`, `padding_*` to `ComponentNode` constructor

**Phase 3: Override system** ✅
- [x] `[S]` Add `sizing_w`, `sizing_h` to override whitelist (server + editor)
- [x] `[S]` Per-axis resize: drag-right → `sizing_w: FIXED, width: newW` only (height unchanged)
- [x] `[S]` Alignment click ONLY sets `parent.align` — never touches child sizing

**Phase 4: Editor UI** ✅
- [x] `[S]` Show sizing W/H dropdowns for ALL nodes (not just containers)
- [x] `[S]` Replace single "Sizing" dropdown on containers with `sizing_w` + `sizing_h`
- [x] `[S]` Verify alignment changes don't affect child sizing
- [x] `[S]` Alignment widget reads from tree data (`node.align`) with override fallback

**QA:** Browser-verified. Leaf nodes show per-axis Width/Height dropdowns. Containers show auto-layout panel + per-axis sizing. Changing Height from Fill→Hug shrinks component (432×160 → 432×40). Per-axis resize only sets the resized axis to FIXED.

---

#### Milestone 10: Native Frame YAML — clean v3 architecture

**Problem:** v3 diagrams are currently defined as v2 Diagram objects (Python modules or old-format YAML), then converted to Frame trees via `diagram_to_frame()`. This conversion loses information (no way to specify sizing, align, direction in YAML), adds indirection, and makes it impossible to create simple test-case diagrams that exercise autolayout features directly.

**Architecture:** Introduce native Frame YAML definitions that map 1:1 to the Frame model. No v2 intermediary, no conversion step.

**Format:**
```yaml
engine: v3                    # discriminator: native frame, not v2 diagram
title: Vertical stack test
root:
  id: page
  direction: vertical
  gap: 24
  padding: 24
  border: none
  children:
    - id: box_a
      label: [Box A]
      icon: Server.svg
    - id: box_b
      label: [Box B]
      sizing: fill
    - id: nested
      direction: horizontal
      gap: 8
      padding: 8
      border: dashed
      fill: grey
      heading: Nested group
      children:
        - id: child_1
          label: [Child 1]
        - id: child_2
          label: [Child 2]
          sizing: fill
```

**Key rules:**
- `engine: v3` at top level is the discriminator. If present, load as FrameDiagram directly. If absent, load as v2 Diagram and convert.
- Frame fields map directly to Frame dataclass: `direction`, `gap`, `padding`, `sizing`, `align`, `width`, `height`, `fill`, `border`, `heading`, `icon`, `icon_fill`, `label`, `children`.
- Enums use lowercase strings: `vertical`/`horizontal`, `hug`/`fill`/`fixed`, `top-left`/`center`/`bottom-right`, `white`/`grey`/`black`, `solid`/`dashed`/`none`.
- `label` is a list of strings or `{text, weight, size, fill, small_caps}` objects — same as existing Line format.
- `children` is recursive.
- `arrows` is optional, same format as v2 (source/target/label).
- `grid:` is optional. Declares Brockman overlay metadata: `cols`, `col_gap`, `row_gap`, `outer_margin`. When omitted, `cols` defaults to 2, and gap/margin fall back to root frame's `gap` and `padding`.

**Omission/default rules (frozen by `test_frame_loader.py`):**

These rules are now part of the frame-YAML contract. Changing any of them requires updating the corresponding test.

| Omission | Default | Rationale |
|---|---|---|
| `sizing` omitted | Both axes default to `fill` | Children stretch to parent space by default (Figma convention) |
| `sizing_w` or `sizing_h` present | Per-axis key overrides the uniform `sizing` key | Allows `sizing: fill` + `sizing_h: hug` |
| `width` set, no `sizing`/`sizing_w` | `sizing_w` inferred as `fixed` | Explicit dimension implies fixed intent |
| `height` set, no `sizing`/`sizing_h` | `sizing_h` inferred as `fixed` | Same as width |
| `sizing` set explicitly + `width` set | `sizing_w` uses the explicit `sizing`, NOT inferred as fixed | Explicit sizing takes priority over dimension inference |
| Leaf `border` omitted | `solid` | Boxes are bordered by default |
| Container `border` omitted | `none` | Layout groups are invisible wrappers by default |
| Leaf `padding` omitted | `8` | Standard INSET for bordered boxes |
| Borderless container `padding` omitted | `0` | Pure layout groups don't add padding (prevents child misalignment) |
| Bordered container `padding` omitted | `8` | Visible containers get standard inset |
| Container `gap` omitted | `24` | Standard GRID_GUTTER |
| Leaf `gap` omitted | `0` | Leaves have no children to space |

- Leaf frames (no children) get defaults appropriate for boxes: `border: solid`, `fill: white`, `padding: 8`.
- Container frames get defaults appropriate for layout: `border: none`, `fill: white`, `gap: 24`, `padding: 0` (borderless) or `8` (bordered).

**Files:**
| File | Role |
|------|------|
| `scripts/frame_loader.py` | Parse YAML → FrameDiagram. ~80 lines. |
| `scripts/diagrams/frames/*.yaml` | Native frame definitions. Test cases live here. |
| `scripts/preview_server.py` | Detect `engine: v3` in YAML, route to `frame_loader`. Discover frame YAMLs for slug list. |

**Steps:**
- [x] `[S]` **Write `frame_loader.py`** — `load_frame_yaml(path) → FrameDiagram`. Recursive `_parse_frame(data) → Frame` with enum mapping. Validate required fields.
- [x] `[S]` **Wire into `preview_server.py`** — In `_get_layout_result()`, check for frame YAML before falling through to v2 YAML. In `_list_v3_diagrams()`, also scan `diagrams/frames/`. In `_relayout_v3()`, load from frame YAML when available.
- [x] `[S]` **Create test-case frame YAMLs:**
  - `test-vertical-stack` — 3 boxes in a vertical column. QA: change direction to horizontal, verify reflow. ✅
  - `test-fill-distribution` — 1 HUG + 2 FILL children. QA: see FILL children share remaining space. ✅
  - `test-nested-containers` — V→H nesting with 2 levels. QA: drill in, change inner direction. ✅
  - `test-alignment-grid` — FIXED container with small centered child. QA: change alignment, see child move. ✅
  - `test-mixed-sizing` — HUG + FILL + FIXED siblings. QA: verify proportions. ✅
- [x] `[S]` **Browser-verify** each test case loads, renders correctly, and autolayout controls work.

**QA:** All 5 diagrams load and render correctly. Direction change reflows layout (vertical→horizontal verified). Alignment change moves children (Center→Bottom Right verified, child moved from (144,200) to (256,304)). Sizing dropdowns show correct per-axis values. Fill distribution shares space equally. Mixed sizing proportions correct (HUG=64, FILL=200, FIXED=120 in 480px container).

---

#### Milestone 12: Autolayout interaction parity (Figma behavior)

**Problem:** The editor allows free absolute positioning (drag to move) of children inside autolayout frames. In Figma/Penpot, autolayout children cannot be freely positioned — dragging reorders siblings within the stack. The current editor also lacks multi-select bulk editing, depth navigation, and the autolayout/non-autolayout mode distinction.

**Reference behavior (Figma/Penpot):**
- Autolayout is a toggle on the parent frame. When enabled, children are laid out by the engine and cannot be freely positioned.
- Dragging a child in an autolayout frame reorders it among siblings (insert at the nearest gap).
- Double-clicking a parent selects all children inside it.
- Shift+Enter navigates back to the parent from a selected child.
- Multiple selection keeps inspector fields visible; bulk property changes (e.g. sizing) apply to all selected nodes.

**Steps:**

- [x] `[H]` **Disable free drag in autolayout frames.** When a selected component's parent has `layout` set (vertical/horizontal), suppress `dx`/`dy` override writes during drag. Instead, show a reorder preview (insertion indicator between siblings). Arrow-key nudging also suppressed for autolayout children.
- [x] `[H]` **Drag-to-reorder siblings.** During drag in an autolayout parent, compute the nearest sibling gap from cursor position. On drop, emit a `children_order` override that changes the child order. Server applies child reorder before relayout.
- [x] `[S]` **Multi-select with bulk property edits.** Shift+click to add/remove from selection. Inspector shows shared fields for all selected nodes. Changing a property (e.g. sizing_w) applies to all selected nodes. Bulk alignment, container props (direction/gap/padding), sizing mode, and style picker all work with Mixed support.
- [x] `[S]` **Double-click parent → select all children.** Double-clicking on a container selects all its direct children. Enter key also selects all children when a parent is selected.
- [x] `[S]` **Shift+Enter → navigate to parent.** When a child is selected, Shift+Enter selects its parent.
- [ ] `[S]` **Autolayout toggle on parent.** Deferred — requires `Direction.NONE` and absolute positioning support, which the v3 engine doesn't have yet.
- [x] `[X]` **Benchmark test:** verified interaction sequences — single select, multi-select, inspector rendering (alignment/container/sizing/style), bulk property application, container-prop leaf-node filtering, dirty state, deselect. All pass.

### Editor UX

- [x] `[S]` **Domain-specific undo/redo.** All undo actions now use targeted override-patch commands instead of full-state snapshots. Fixed bug where v3 style changes had no undo. Added undo to `setFrameProp`, `setFrameAlign`, `setMultiFrameProp`, `setMultiFrameAlign`, `applyMultiStyleOverride`. Only grid-adjust and clear-all-overrides still use full snapshots (legitimately need full state).

### Brockman grid — column/row snapping and sizing

The editor now has a proper Brockman composition grid (baseline-snapped rows, equal columns, bottom-margin absorption). Next steps to make it a real InDesign-like layout tool:

- [x] `[S]` **Baseline-snap column widths.** Column widths are currently raw `contentW / cols` — not snapped to `BASELINE_STEP`. Snap column widths down to 8px multiples; absorb leftover into a resolved right margin (matching the row→bottom pattern). Update both `_computeBrockmanGrid()` in editor.js and `_build_grid_info()` in layout_v3.py. Prerequisite for column-span input and grid-aware snapping.
- [ ] `[H]` **Snap to grid.** Drag and resize should snap to column edges, row tops, and baseline grid lines — not just the 8px graph-paper grid. The current snap stops short of or overshoots grid lines. Depends on baseline-snapped columns.
- [x] `[H]` **Column-span width input.** Add a units dropdown (`px` / `cols` / `rows`) next to the sizing mode in the inspector. When unit = `cols`, width = `colW * span + colGap * (span - 1)`. When unit = `rows`, height = `rowH * span + rowGap * (span - 1)`. Apply to both single-select and multi-select inspectors. `gridInfo` is already globally accessible. Depends on baseline-snapped columns.
- [ ] `[S]` **Grid-aware resize.** When dragging a resize handle, show snap indicators at column/row edges and snap to them with priority over the baseline grid.
- [ ] `[L]` **Persist grid config.** Save the Brockman grid settings (cols, col gutter, row gutter, margin) per diagram so they survive page reload.

### Export

- [x] `[S]` **Save SVG button.** The preview sidebar now exposes `Save SVG`, which downloads the current stage DOM as an `.svg` file using the active engine suffix (`*-onbrand-v3.svg` for native frame diagrams).
- [ ] `[S]` **PNG export at 1x, 2x, 3x.** Add a Playwright-based PNG exporter that renders generated SVGs at 1x, 2x, and 3x scale (e.g. `scripts/export_png.py --scale 1,2,3`). Wire into the preview Export button as an option alongside the existing override JSON export.

### Code quality — open
- [ ] `[H]` Unify the parent-scoped equal-split/outdent math across `scripts/diagram_layout.py` and `scripts/preview/component-model.js`. Preview now consumes declared slots/spans and measured gutters, but the equal-split/outdent math itself is still duplicated between Python and JS.
- [ ] `[S]` **draw.io renderer uses spatial containment for parenting.** `_find_children` in `diagram_render_drawio.py` uses bounding-box overlap instead of `component_id`, which can mis-parent elements at shared edges. Fix: match by `component_id`.
- [ ] `[S]` **`_uniform_row_height` ignores Annotations/Helpers.** Rows containing only annotations get `BOX_MIN_HEIGHT` regardless of content. The post-hoc helper expansion partially compensates but runs after uniform equalization.
- [ ] `[S]` Triage the secondary audit findings: stale-v2 comparison risk in `build_outputs.py`, preview text-width mismatch vs renderer text width, dead helper layout code, stale architectural line-count notes in `STATUS.md`.
- [ ] `[S]` Triage the current `build_v2.py` corpus blockers separately from the 2026-05-13 autolayout slice: clearance violations on `example-platform-architecture`, `lightning-talk-engine`, `lt-diagram-generator`, `lt-a4-generator`, and `lt-summit-identity`, plus warning-only baseline-grid drift on several older diagrams.

### Force ↔ grid editor unification

Goal: the force and grid editors share one editor shell; swapping the layout engine should not duplicate interaction code. The audit below lists every grid-editor capability and its force-editor status. Items are ordered by user-facing impact.

**Architecture prerequisite**

- [x] `[H]` **Unified editor shell.** Created `editor-base.js` (shared utilities: `byId`, `escapeHtml`, `fetchJson`, `setStatus`, `getStageSvg`, `pointerToSvgPoint`, `setViewMode`, `initPreviewShell`) and `viewer-unified.html` (single HTML template with `data-dg-mode="grid"|"force"`, CSS mode visibility via `.dg-grid-only`/`.dg-force-only`). Both grid and force editors now use the same shell, sidebar header, picker, and view tabs. Force.js deduped to use shared base functions. Server serves unified template for both modes.
- [ ] `[H]` **Swappable engine interface.** Refactor so `editor.js` and `force.js` share one interaction layer (select, drag, resize, text-edit, style, undo, keyboard, inspector, constraints). The layout back-end (grid relayout vs force tick) plugs in behind a common `LayoutEngine` interface. No duplicated DOM wiring.

**Stage interaction parity**

- [ ] `[H]` **Resize handles.** Force nodes need the same 8-handle resize affordance as grid components. Resize should update node `width`/`height` in the force session and restart the solver.
- [ ] `[S]` **Text editing.** Double-click a force node to edit its label in-place, same as the grid editor's `tspan` editing path.
- [ ] `[S]` **Multi-select.** Shift+click to select multiple force nodes; enable distribute/align controls on the multi-selection.
- [ ] `[S]` **Hover highlighting.** Show visual hover class on force nodes.
- [ ] `[L]` **Snap guides.** Show alignment snap guides during force-node drag (peer edge/center, 6px threshold).

**Inspector parity**

- [ ] `[S]` **Dirty flag and save-button state.** Track whether force session state differs from last save; disable Save when clean.
- [ ] `[S]` **Constraint enforcement.** Run the same fill/stroke/highlight-limit/containment checks on force nodes and display violations in the sidebar.
- [ ] `[L]` **Override highlight in tree.** Accent-color tree items that have overrides, matching the grid editor's convention.

**Persistence and undo**

- [ ] `[H]` **Undo/redo for force.** Add an undo stack (max 50 commands) covering move/pin, style change, text edit, and resize, using the same command-record pattern as the grid editor.
- [ ] `[S]` **Stale-definition detection.** Warn if the force spec JSON changes on disk while a session is live.

**Connectors and arrows**

- [ ] `[S]` **Arrow waypoint editing.** Allow dragging force-link control points (curve handles) interactively, with double-click to add/remove, matching the grid editor's waypoint path.
- [ ] `[S]` **Arrow endpoint attachment.** Force links should follow node moves via side-aware offset instead of recalculating from scratch.

**Keyboard shortcuts**

- [ ] `[L]` **Grid overlay toggle (W).** Decide whether force preview needs a baseline-grid overlay or if that concept doesn't apply.
- [ ] `[L]` **Keyboard nudge.** Arrow-key nudge (8px default, 24px with Shift) for pinned force nodes.
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