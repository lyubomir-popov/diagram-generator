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

#### Arrow labels use annotation variant (spec 021) — DRAFTED

Feature package: `specs/021-arrow-labels-use-annotation-variant/` — arrow labels are semantic annotation text, not a free-floating style path.

- [x] `[H]` **P1. Route arrow labels through annotation semantics.** TS export now ignores authored arrow-label style fields and renders annotation typography instead. No separate live preview arrow-label renderer currently exists.

#### Lean variant-only style authority and fixture pruning (spec 020) — DRAFTED

Feature package: `specs/020-lean-variant-style-authority/` — new north-star simplification slice. Diagrams are disposable test fixtures; compatibility is explicitly subordinate to a lean, rigorous, TS-first model.

- [x] `[H]` **P1. Remove line-level styling authority from frame-owned text.** YAML parsing, preview wire transport, preview relayout, the Python legacy mirror, and the dist-backed Node runtime now keep frame-owned lines semantic and derive typography from resolved snapshots instead.
- [x] `[H]` **P1. Prune the diagram corpus to a minimal invariant pack.** 11 canonical slugs remain; 8 redundant domain fixtures deleted (android-*, lt-*, rise-of-inference-economy).
- [x] `[H]` **P1. Rewrite YAML toward semantic inputs only.** Kept corpus has no line-level style escape hatches; redundant root `padding: 24` / `border: none` stripped.
- [x] `[H]` **P1. Derive spacing from composition and shrink the authored gap surface.** `stack_gap` absent; explicit grid exceptions kept only where they prove an invariant (`support-engineering-flow` `row_gap: 48`, `request-to-hardware-stack` `col_gap: 16`).

#### Force layout restoration (spec 023) — DRAFTED

Feature package: `specs/023-force-layout-restoration/` — restore the broken force demo lane as a TS-owned surface, rebuild the three tracked examples, and keep the BF-shell interaction model without reviving Python solver/backend authority. Recovered JSON from history is migration input only; do not treat it as final authority.

- [ ] `[H]` **P1. Close the remaining force-lane follow-up after the TS restoration.** All three canonical force demos now load on the TS runtime, drag/pin/unpin/export behavior is back, and the unpin path reheats correctly; next land local save persistence, finish the benchmark cleanup, and add stronger automated coverage for save/export/browser checks.

#### Repo coherence — resolved-style snapshot (spec 008 Phase 5)

Feature package: `specs/008-repo-coherence-rewrite/` — Phases 1–4 and 6–8 complete. Phase 5 (T040–T047, 8 tasks) is the remaining work.

- [x] `[S]` T040–T042 **[TS/JS]:** `resolvedTextFill` / `resolvedIconFill` / heading snapshot on `Frame`; populated in `frame-classes.ts`; `layout-bridge.js` reads snapshot.
- [x] `[H]` **Re-scope Phase 5 away from new Python authority.** Phase 5 is now explicitly TS-only: remaining live render/export consumers audited, preview raw `iconFill` fallback removed, and docs/tasks no longer point at `scripts/layout_v3.py`.
- [x] `[S]` T043–T045 **[TS]:** Added resolved-style render regressions, including highlight contrast from snapshot rather than raw fields.
- [x] `[S]` T046–T047: Full TS suite green; focused resolved-style tests and one TS export smoke check completed.

### Priority 3 — Standalone items

#### Top-level containers should default to FILL sizing

- [ ] `[M]` **Annotations and other top-level containers still default to HUG** instead of FILL, so they don't land on the grid.

#### Root element editable width/height

- [ ] `[S]` **Make root element width/height editable in the inspector.** Options: explicit value | HUG.

#### Code quality — adversarial audit items

#### Root direction change should reset children sizing to hug

- [ ] `[M]` **Switching root `direction` vertical→horizontal leaves top-level children as FILL on the old axis.** They should reset to HUG so authors re-opt in. Fix in the preview inspector direction handler (`editor.js`) and optionally in `frame_yaml_persistence.py` when `direction` is saved on `page`. Reported during a preview editor pass on 2026-06-04.
- [ ] `[H]` **Add drag-and-drop reordering in the layers palette.** Needed to repair cases like `complex-routing-usecase` where an absolute-positioned overlay (`dev team`) should be a separate protruding layer rather than living inside the wrong container.
- [ ] `[M]` **Absolute-positioned items resize incorrectly from the left edge.** Left-edge resize currently expands the right side instead of moving the left boundary.
- [ ] `[M]` **Wrapped text in the parent variant loses consistent heading styling across lines.** A parent-frame line that wraps to two visual lines currently renders the first line bold and the second line non-bold; both lines should carry the same resolved style.

Full audit: `docs/architecture/adversarial-audit-2026-05-27.md`.

- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`.
- [ ] `[S]` **M6. `estimate_line_width` duplicated.** `diagram_shared.py` vs `text_metrics.py`.
- [ ] `[L]` **Legacy Python parity harness drift.** `scripts/test_parity.py` still reconstructs the pre-WS3 heading/body model, so full `pytest scripts -q` has 5 stale failures. Either realign it with the current loader contract or retire it as a non-gating legacy oracle; do not block TS work on it.

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
