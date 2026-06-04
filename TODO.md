# TODO

## Purpose

Active execution queue for `diagram-generator`. All new work targets TypeScript first. Python receives matching changes only for batch/export correctness.

**Jira:** This repo is Stream E (constrained editor) under [DE-941](https://warthogs.atlassian.net/browse/DE-941). Milestone-level issues tracked on Jira; detailed execution stays here and in `specs/`. See `diagram-generator-planning` for the broader project (corpus, taxonomy, Coda pages).

## Active TODO

### Priority 1 — Bugs

#### Highlight text contrast bug

- [x] `[M]` **Highlight children have black text on black fill.** Children inside `variant: highlight` panels now inherit white text/icon contrast while keeping their own box styling.

#### Fixed height input loses value on blur

- [x] `[M]` **Inspector height input clears on focus-out instead of applying the value.** `setFrameSize` now clears runtime coercion keys before relayout so explicit FIXED heights persist.

### Priority 2 — Spec-kit tracked work

#### TS SVG renderer — retire Python runtime path (spec 012) — IN PROGRESS

Feature package: `specs/012-ts-svg-renderer-retire-python/`

- [x] `[H]` **T060a.** Preview server: remove Python SVG fallback; TS failure → 404 + log.
- [x] `[H]` **T020.** Icons in batch SVG via `icon-embed.ts` (`createFsIconLoader`, `preloadIconMarkup`).
- [ ] `[H]` **T030–T040.** Arrow heads, overlays to `svg-render.ts` (export parity with `layout-bridge.js`).
- [ ] `[M]` **T050.** Golden SVG tests for corpus subset.
- [ ] `[M]` **T060b.** Retire or archive `diagram_render_svg.py` for batch paths.
- [ ] `[S]` **T070.** Agent docs + `docs/specs.md` (stakeholder guide + STATUS refresh 2026-06-04; finish when 012 closes).

#### Autolayout hardening — semantic mutation removal (spec 005) — IN PROGRESS

Feature package: `specs/005-autolayout-hardening/` — WS1 largely complete in TS; WS2–WS5 remain.

- [x] `[H]` **H1. Layout mutates Frame tree.** Coercion, col_span, root-width expansion, and grid equalization are runtime-only; semantic fields restore after layout in TS and Python.
- [ ] `[H]` **H3. Heading synthetic child incomplete.** `__body` no longer copies `wrap`, `fill_weight`, `justify` from parent. Document as settled.
- [ ] `[M]` **H5. Leaf measure vs render padding mismatch.** Measurement uses INSET, rendering uses per-side padding + 1px hack. Fix: use `frame.padding_*` in measurement.

#### Repo coherence — resolved-style snapshot (spec 008 Phase 5)

Feature package: `specs/008-repo-coherence-rewrite/` — Phases 1–4 and 6–8 complete. Phase 5 (T040–T047, 8 tasks) is the remaining work.

- [ ] `[S]` T040–T044: Define resolved-style snapshot fields, populate in resolvers, replace raw contrast branches.
- [ ] `[S]` T045–T047: Resolved-style regression tests and full suites.

### Priority 3 — Standalone items

#### Top-level containers should default to FILL sizing

- [ ] `[M]` **Annotations and other top-level containers still default to HUG** instead of FILL, so they don't land on the grid.

#### Root element editable width/height

- [ ] `[S]` **Make root element width/height editable in the inspector.** Options: explicit value | HUG.

#### Code quality — adversarial audit items

#### Root direction change should reset children sizing to hug

- [ ] `[M]` **Switching root `direction` vertical→horizontal leaves top-level children as FILL on the old axis.** They should reset to HUG so authors re-opt in. Fix in the preview inspector direction handler (`editor.js`) and optionally in `frame_yaml_persistence.py` when `direction` is saved on `page`. Reported during `android-custom-to-cloud` editor pass 2026-06-04.

Full audit: `docs/architecture/adversarial-audit-2026-05-27.md`.

- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`.
- [ ] `[S]` **M6. `estimate_line_width` duplicated.** `diagram_shared.py` vs `text_metrics.py`.

### Priority 4 — Future specs

#### Arrow routing redesign (spec 006)

Feature package: `specs/006-arrow-routing-redesign/` — 0/25 tasks done. TS-only. Not blocking.

### Lower priority

- [ ] `[M]` Arrow routing tests
- [ ] `[S]` Constrained re-measurement tests
- [ ] `[S]` Layout idempotency test
- [ ] `[S]` Negative parser tests for invalid enums
- [ ] `[M]` Forward ontology — auto-select engine from `diagram_type` + `layout_engine`
- [ ] `[S]` `preview_server.py` decomposition (post-port)
- [ ] `[L]` Security hardening before Stage 17
- [ ] `[S]` `EditorState` container — replace 40+ globals
- [ ] `[S]` Swappable engine interface — Phase 3+
- [ ] `[S]` Constraint enforcement on force nodes
- [ ] `[S]` Arrow waypoint editing / endpoint attachment
- [ ] `[S]` Consistent stroke/outline weight
- [ ] `[S]` Force → frame YAML round-trip
- [ ] `[L]` Grid overlay toggle (W) for force preview
- [ ] `[L]` Double-click depth cycling for force nodes
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear
