# Tasks: DIAGRAM.md token audit and sizing model correction

**Input**: Design documents from `/specs/010-diagram-token-audit/`

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Parity tests and full production-diagram regression are required by the spec. No new test files are created – existing `test_parity.py` and TS test suite cover the contracts.

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1 priority but US2 depends on US1 completing the token reclassification first. US3 is independent and can run in parallel with US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Branch creation and baseline verification

- [x] T001 Create and checkout branch `feat/010-diagram-token-audit`
- [x] T002 Run `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` from `scripts/` to establish green baseline
- [x] T003 Run TypeScript parity tests with `npm test` from `packages/layout-engine/` to establish green baseline

**Checkpoint**: Both test suites green; baseline confirmed before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Understand current token usage across the codebase before reclassifying

- [x] T004 Read `DIAGRAM.md` YAML frontmatter and catalogue every hardcoded value with its current location
- [x] T005 [P] Read `scripts/diagram_shared.py` and list every token constant (`BLOCK_WIDTH`, `BOX_MIN_HEIGHT`, `ICON_SIZE`, `INSET`, etc.) with their values and where each is consumed
- [x] T006 [P] Read `scripts/design_tokens.py` and list every arrow token constant (`ARROW_HEAD_LENGTH`, `ARROW_HEAD_HALF_WIDTH`, `ARROW_CLEARANCE`, etc.) with their values
- [x] T007 [P] Read `packages/layout-engine/src/tokens.ts` and confirm it mirrors the Python token values exactly

**Checkpoint**: Full inventory of all token values, their locations, and cross-references complete

---

## Phase 3: User Story 1 – Token audit and DIAGRAM.md reclassification (Priority: P1) 🎯 MVP

**Goal**: Classify every DIAGRAM.md frontmatter value as invariant / default / frozen-sample and update DIAGRAM.md to reflect the distinction.

**Independent Test**: DIAGRAM.md frontmatter has role annotations for every value; no engine behaviour changes yet; both test suites still green.

### Implementation for User Story 1

- [x] T008 [US1] Update `DIAGRAM.md` frontmatter: annotate `baseline-unit: 8px` as invariant
- [x] T009 [US1] Update `DIAGRAM.md` frontmatter: annotate `grid-gutter: 24px` as invariant
- [x] T010 [US1] Update `DIAGRAM.md` frontmatter: annotate `outer-margin: 24px` as invariant
- [x] T011 [US1] Update `DIAGRAM.md` frontmatter: annotate `icon-size: 48px` as invariant
- [x] T012 [US1] Update `DIAGRAM.md` frontmatter: annotate `inset: 8px` as invariant
- [x] T013 [US1] Update `DIAGRAM.md` frontmatter: reclassify `default-box-width: 192px` from implicit invariant to **default** – add annotation explaining it is a starting-point width, not a HUG floor
- [x] T014 [US1] Update `DIAGRAM.md` frontmatter: annotate `default-box-min-height: 64px` as invariant with rationale (`ICON_SIZE + 2*INSET`)
- [x] T015 [US1] Update `DIAGRAM.md` frontmatter: annotate `growthStep: 8px` as invariant and document it as an alias of `baseline-unit`
- [x] T016 [US1] Update `DIAGRAM.md` frontmatter: annotate `arrowHeadLength: 10.8408px` as **frozen-sample** with provenance note (measured from initial SVG arrowhead)
- [x] T017 [US1] Update `DIAGRAM.md` frontmatter: annotate `arrowHeadHalfWidth: 2.9053px` as **frozen-sample** with provenance note
- [x] T018 [US1] Update `DIAGRAM.md` frontmatter: annotate `arrowClearance: 8px` as invariant
- [x] T019 [US1] Update `DIAGRAM.md` frontmatter: annotate `minArrowSegment: 16px` as invariant with derivation (`arrowClearance + ceil(arrowHeadLength)` snapped to 8px grid)
- [x] T020 [US1] Update `DIAGRAM.md` frontmatter: annotate `terminal-bar.height: 64px` as **frozen-sample** – document as component dimension, NOT linked to `BOX_MIN_HEIGHT`
- [x] T021 [US1] Update `DIAGRAM.md` frontmatter: annotate `chromeHeight: 20px` as **frozen-sample** – document as component dimension from original terminal-bar SVG
- [x] T022 [US1] Update `DIAGRAM.md` frontmatter: annotate `matrix-widget.size: 48px` as invariant with note documenting intentional coupling to `icon-size`
- [x] T023 [US1] Update `DIAGRAM.md` frontmatter: annotate `box-default.width`, `box-accent.width`, `box-emphasis.width` (all 192px) as **default** – same as `default-box-width`
- [x] T024 [US1] Add a legend/key to `DIAGRAM.md` explaining the three token roles: invariant, default, frozen-sample
- [x] T025 [US1] Run Python test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – confirm no regressions (DIAGRAM.md changes are documentation-only at this point)
- [x] T026 [US1] Run TypeScript test suite: `npm test` from `packages/layout-engine/` – confirm no regressions

**Checkpoint**: DIAGRAM.md fully annotated with token roles; both test suites green; no engine changes yet

---

## Phase 4: User Story 2 – Fix HUG sizing model (Priority: P1)

**Goal**: Remove the `BLOCK_WIDTH` floor from HUG-sized leaf measurement so boxes shrink to `round_up_to_grid(content_w)` without a 192px minimum.

**Independent Test**: A HUG-sized box with content narrower than 192px renders at `round_up_to_grid(content_w)`, not 192px. All 24 production diagrams pass visual regression. Parity tests pass.

### Implementation for User Story 2

- [x] T027 [US2] Update Python layout engine: in `scripts/layout_v3.py` around line 291, remove the `max(..., BLOCK_WIDTH)` floor from the HUG leaf width calculation – width becomes `round_up_to_grid(content_w)` only
- [x] T028 [US2] Verify Python layout engine: confirm the empty-box fallback to `BLOCK_WIDTH` (line ~295) is preserved – only the HUG-with-content path changes
- [x] T029 [US2] Verify Python layout engine: confirm the text wrapping default `text_max_w` using `BLOCK_WIDTH` (line ~268) is preserved unchanged
- [x] T030 [US2] Update TypeScript layout engine: in `packages/layout-engine/src/layout.ts` around line 150, apply the same change – remove `Math.max(..., BLOCK_WIDTH)` floor from HUG leaf width
- [x] T031 [US2] Verify TypeScript layout engine: confirm the empty-box fallback and text wrapping default using `BLOCK_WIDTH` are preserved
- [x] T032 [US2] Update or regenerate parity fixtures in `packages/layout-engine/tests/fixtures/parity-fixtures.json` if any fixture includes a HUG-sized box that was previously clamped to 192px
- [x] T033 [US2] Run Python test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all tests pass
- [x] T034 [US2] Run TypeScript test suite: `npm test` from `packages/layout-engine/` – all tests pass
- [x] T035 [US2] Start preview server (`python scripts/preview_server.py --port 8100`) and browser-verify all 24 production diagrams at `http://127.0.0.1:8100/view/v3:<slug>` – no regressions
- [x] T036 [US2] Specifically verify a HUG-sized annotation box (e.g. "Android owns / everything above" in `android-graphics-stack`) now renders narrower than 192px

**Checkpoint**: HUG sizing fix complete; both engines in lockstep; all production diagrams verified; parity tests green

---

## Phase 5: User Story 3 – Column-span conditional display (Priority: P2)

**Goal**: The width inspector's "cols" unit option appears only when the diagram has explicit grid columns, not unconditionally.

**Independent Test**: Open a diagram without explicit grid columns – only "px" appears in the width unit selector. Open a diagram with explicit grid columns – both "px" and "cols" appear.

### Implementation for User Story 3

- [x] T037 [US3] In `scripts/preview/editor.js`, locate the width unit selector rendering (the `<option>` for "cols")
- [x] T038 [US3] Add a guard: only emit the "cols" `<option>` element when `gridInfo` is available and `gridInfo.col_widths` has entries
- [x] T039 [US3] Add a state reset: if `_inspectorWidthUnit` is `'cols'` and `gridInfo?.col_widths` becomes falsy (e.g. switching to a different diagram), reset `_inspectorWidthUnit` to `'px'`
- [x] T040 [US3] Browser-verify: open a diagram without explicit grid columns (e.g. `simple-testcase`) – confirm only "px" appears in the width unit selector
- [x] T041 [US3] Browser-verify: open a diagram with explicit grid columns (e.g. `example-platform-architecture` or any diagram using `col_widths` in its YAML) – confirm both "px" and "cols" appear
- [x] T042 [US3] Browser-verify: select a frame in a grid diagram, switch unit to "cols", then navigate to a non-grid diagram – confirm unit resets to "px"

**Checkpoint**: Column-span UI conditionally displayed; no regressions in inspector behaviour

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T043 [P] Update `scripts/diagram_shared.py`: add a comment above `BLOCK_WIDTH` clarifying it is a default, not a HUG floor
- [x] T044 [P] Update `packages/layout-engine/src/tokens.ts`: add matching comment above `BLOCK_WIDTH`
- [x] T045 Run full regression: all 24 production diagrams browser-verified one final time
- [x] T046 Update `HISTORY.md` in `diagram-generator` with completed spec 010 summary

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 – establishes token inventory
- **US1 – Token audit (Phase 3)**: Depends on Phase 2 – needs the token inventory; DIAGRAM.md-only changes, no engine changes
- **US2 – HUG fix (Phase 4)**: Depends on Phase 3 – token reclassification must be done first so `BLOCK_WIDTH`'s role as "default" is documented before the engine change
- **US3 – Column-span UI (Phase 5)**: Depends on Phase 2 only – independent of US1/US2; can run in parallel with Phase 4
- **Polish (Phase 6)**: Depends on Phase 4 and Phase 5 completion

### Within Each User Story

```
US1: T008–T023 (all [P] within DIAGRAM.md) → T024 → T025, T026 (validation)
US2: T027 → T028, T029 (verify) → T030 → T031 (verify) → T032 → T033, T034 → T035, T036
US3: T037 → T038 → T039 → T040, T041, T042 (browser checks)
```

### Parallel Opportunities

- **Phase 2**: T005, T006, T007 can all run in parallel (reading different files)
- **Phase 3**: T008–T023 are all edits to `DIAGRAM.md` – logically parallel but target the same file, so best done sequentially in one editing pass
- **Phase 4 + Phase 5**: US2 and US3 touch completely different files (`layout_v3.py`/`layout.ts` vs `editor.js`) – can run in parallel if staffed
- **Phase 6**: T043 and T044 can run in parallel (different files)

---

## Parallel Example: US2 + US3

```
         ┌──── Phase 4: US2 (HUG fix) ─────────────────────┐
Phase 3 ─┤                                                   ├─ Phase 6
         └──── Phase 5: US3 (Column-span UI) ───────────────┘
```

US2 and US3 have no file overlap and no logical dependency. With two agents or team members, they can execute simultaneously after Phase 3 completes.

---

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2). The token audit and HUG fix are the core deliverables. The column-span UI (US3) is a small P2 enhancement that can ship later.

**Incremental delivery**:
1. Ship US1 alone as a documentation improvement (no risk, no engine changes)
2. Ship US2 as the functional fix (requires careful regression testing)
3. Ship US3 as an independent UI polish
