# Tasks: heading + body layout region

**Input**: Design documents from `specs/002-heading-body-layout/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/heading-body-synthesis.md ✅, quickstart.md ✅

**Tests**: Included – spec.md defines acceptance scenarios and the constitution (Principle IV) requires running all diagrams after changes.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 but US2 depends on US1 (body zone starts where heading zone ends). US3 is P2 and can run after US1/US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3 (maps to spec.md user stories)
- Exact file paths included

---

## Phase 1: Setup

**Purpose**: Branch creation and baseline verification

- [ ] T001 Check out feature branch `feat/002-heading-body-layout` from the branch where feat/001-box-style-contract is merged
- [ ] T002 Run full regression baseline: `cd scripts && python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 31 diagrams must pass before any changes
- [ ] T003 Record current heading rendering for the 8 affected diagrams (visual baseline via preview server at `http://127.0.0.1:8100/view/v3:<slug>`)

**Checkpoint**: Clean branch, green test suite, visual baseline captured.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Core contract fix in `frame_loader.py` that all user stories depend on

**⚠️ CRITICAL**: US1, US2, US3 all depend on the `__body` synthesis fix landing first.

### Tests for foundational phase

- [ ] T004 [P] Add test in `scripts/test_frame_loader.py`: verify `__body` inherits `wrap` from parent – given parent `wrap: true`, assert `__body.wrap is True`
- [ ] T005 [P] Add test in `scripts/test_frame_loader.py`: verify `__body` inherits `fill_weight` from parent – given parent `fill_weight: 2`, assert `__body.fill_weight == 2`
- [ ] T006 [P] Add test in `scripts/test_frame_loader.py`: verify `__body` inherits `justify` in vertical parent branch – given vertical parent with `justify: SPACE_BETWEEN`, assert `__body.justify == Justify.SPACE_BETWEEN`
- [ ] T007 Run T004–T006 tests and confirm they FAIL (fields not yet copied)

### Implementation

- [ ] T008 Fix `_parse_frame()` in `scripts/frame_loader.py`: add `wrap=frame.wrap` to `__body` Frame constructor in both horizontal and vertical branches
- [ ] T009 Fix `_parse_frame()` in `scripts/frame_loader.py`: add `fill_weight=frame.fill_weight` to `__body` Frame constructor in both horizontal and vertical branches
- [ ] T010 Fix `_parse_frame()` in `scripts/frame_loader.py`: add `justify=frame.justify` to `__body` Frame constructor in the vertical branch (already present in horizontal branch)
- [ ] T011 Run T004–T006 tests and confirm they PASS
- [ ] T012 Run full regression: `cd scripts && python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 31 diagrams must still pass

**Checkpoint**: `__body` synthesis contract is correct. All 3 missing fields (`wrap`, `fill_weight`, `justify`) now copied. No regressions.

---

## Phase 3: User Story 1 – Heading always top-left with icon top-right (Priority: P1) 🎯 MVP

**Goal**: Containers with `heading:` and optional `icon:` render heading text at top-left and icon at top-right, inside padding.

**Independent test**: Create a container with `heading: "Test"`, `icon: Cloud.svg`, and two leaf children. Verify heading is at top-left, icon at top-right.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add test in `scripts/test_layout_v3.py`: given a container with `heading: "Title"` and `icon: Cloud.svg`, after layout the `__heading` child's placed position is at parent's `(padding_left, padding_top)` – heading text baseline starts at top-left
- [ ] T014 [P] [US1] Add test in `scripts/test_layout_v3.py`: given a container with `heading:` and `icon:`, the icon's x-position is `parent_x + parent_width - padding_right - ICON_SIZE` – icon is at top-right
- [ ] T015 [P] [US1] Add test in `scripts/test_layout_v3.py`: given a container with `heading:` but no `icon:`, heading text spans the full width minus padding (no icon reservation)
- [ ] T016 [US1] Run T013–T015 and confirm they FAIL before implementation

### Implementation for User Story 1

- [ ] T017 [US1] Verify `__heading` synthetic child in `scripts/frame_loader.py` uses `sizing_w=Sizing.FILL` and `min_height=ICON_SIZE` per contract – fix if divergent
- [ ] T018 [US1] Verify heading text placement in `scripts/diagram_render_svg.py` uses `prim.padding_left` / `prim.padding_top` for text baseline and `prim.padding_right` for icon – no renderer changes expected per research R4
- [ ] T019 [US1] Run T013–T015 and confirm they PASS
- [ ] T020 [US1] Browser-verify `http://127.0.0.1:8100/view/v3:android-security-comparison` – "Containerized Android" and "Virtualized Android" headings are top-left
- [ ] T021 [US1] Browser-verify `http://127.0.0.1:8100/view/v3:request-to-hardware-stack` – all panel headings are top-left with icons top-right

**Checkpoint**: Heading position is correct in all headed containers. SC-002 satisfied.

---

## Phase 4: User Story 2 – Body zone starts below heading (Priority: P1)

**Goal**: Children of a headed container are laid out in a body region that starts below the heading zone. No heading/child overlap.

**Independent test**: Render `request-to-hardware-stack`. Verify no child box overlaps a panel heading.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add test in `scripts/test_layout_v3.py`: given a container with heading and children, the first child's top edge (`_placed_y`) is at or below `heading._placed_y + heading._placed_h + gap`
- [ ] T023 [P] [US2] Add test in `scripts/test_layout_v3.py`: given a container with heading, icon (ICON_SIZE=40), and children, when icon is taller than text, body zone still starts below the icon
- [ ] T024 [US2] Run T022–T023 and confirm they FAIL before implementation

### Implementation for User Story 2

- [ ] T025 [US2] Review heading zone height calculation in `scripts/layout_v3.py` `_measure()` / `_place()` – per research R2, `__heading` has `min_height=ICON_SIZE` which `_clamp_to_constraints()` already respects. Verify the measured heading height is `max(text_height, ICON_SIZE)`
- [ ] T026 [US2] Verify body zone placement in `scripts/layout_v3.py`: `__body._placed_y` should equal `__heading._placed_y + __heading._placed_h + parent.gap`. Fix if body zone overlaps heading
- [ ] T027 [US2] Run T022–T023 and confirm they PASS
- [ ] T028 [US2] Run full regression: `cd scripts && python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q`
- [ ] T029 [US2] Browser-verify `http://127.0.0.1:8100/view/v3:request-to-hardware-stack` – no heading/child overlap in any panel
- [ ] T030 [US2] Browser-verify `http://127.0.0.1:8100/view/v3:maas-architecture` – all panel headings with children below

**Checkpoint**: Body zone correctly positioned below heading zone. SC-001 and SC-003 satisfied.

---

## Phase 5: User Story 3 – Synthetic __body copies all layout fields (Priority: P2)

**Goal**: Verify the foundational fix (Phase 2) works end-to-end with actual diagrams that use `wrap`, `fill_weight`, or non-default `justify`.

**Independent test**: Create a container with `wrap: true`, `sizing_w: fill`, `fill_weight: 2`, and `heading:`. Verify `__body` inherits all three fields and children lay out correctly.

### Tests for User Story 3

- [ ] T031 [P] [US3] Add integration test in `scripts/test_layout_v3.py`: given a container with `wrap: true` and `heading:`, children inside `__body` actually wrap to the next row when they exceed parent width
- [ ] T032 [P] [US3] Add integration test in `scripts/test_layout_v3.py`: given a container with `fill_weight: 2` and `heading:`, the container receives proportionally more space than a sibling with `fill_weight: 1`
- [ ] T033 [US3] Run T031–T032 and confirm they PASS (foundational fix already applied in Phase 2)

### Implementation for User Story 3

- [ ] T034 [US3] If T031 or T032 fail, trace through `scripts/layout_v3.py` `_measure()` and `_place()` to find where the inherited field is not being read from `__body` – fix at the layout layer
- [ ] T035 [US3] Run full regression: `cd scripts && python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q`

**Checkpoint**: Field inheritance is verified end-to-end. All layout-affecting fields flow through synthesis correctly.

---

## Phase 6: Edge cases

**Purpose**: Handle boundary conditions from spec.md edge-case list

- [ ] T036 [P] Add test in `scripts/test_layout_v3.py`: container with `heading:` but zero children – heading zone renders, body zone is empty (zero height), no crash
- [ ] T037 [P] Add test in `scripts/test_layout_v3.py`: container with no `heading:` but has children – no heading zone, children start at top with padding (existing behaviour preserved)
- [ ] T038 [P] Add test in `scripts/test_layout_v3.py`: container with `heading:` and `direction: horizontal` children – body zone uses horizontal layout below the heading
- [ ] T039 Run T036–T038 and confirm they PASS (should be covered by existing logic)
- [ ] T040 If any edge-case test fails, fix at the owning layer (`frame_loader.py` for synthesis, `layout_v3.py` for placement) – do NOT patch at the renderer layer

**Checkpoint**: All edge cases verified.

---

## Phase 7: Polish and full regression

**Purpose**: Final verification across all 31 diagrams and the 8 directly affected ones

- [ ] T041 Run full test suite: `cd scripts && python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q`
- [ ] T042 [P] Browser-verify all 8 heading-bearing diagrams via preview server – confirm headings top-left, icons top-right, children below, no overlap:
  - `android-security-comparison`
  - `request-to-hardware-stack`
  - `maas-architecture`
  - `maas-machine-lifecycle`
  - `android-container-vs-vm`
  - `android-graphics-stack`
  - `example-platform-architecture`
  - Any test YAMLs with heading panels
- [ ] T043 [P] Render all 31 diagrams via engine to confirm no regressions beyond the test suite
- [ ] T044 Run quickstart.md validation steps (targeted tests, full regression, visual verification)
- [ ] T045 Update `HISTORY.md` with completed feature summary
- [ ] T046 Update `STATUS.md` if heading/body layout is no longer a known issue

**Checkpoint**: Feature complete, all regressions checked, docs updated.

---

## Dependencies and execution order

### Phase dependencies

```
Phase 1 (Setup) ──► Phase 2 (Foundational: __body fix)
                         │
                         ├──► Phase 3 (US1: heading position) ──► Phase 4 (US2: body zone)
                         │
                         └──► Phase 5 (US3: field inheritance e2e)
                                    │
Phase 6 (Edge cases) ◄─────────────┘
         │
         ▼
Phase 7 (Polish & full regression)
```

### Key constraints

- **Phase 2 blocks everything**: The `__body` field-copy fix is the prerequisite for all user stories
- **US1 before US2**: US2 (body zone below heading) validates placement that depends on US1 (heading position) being correct
- **US3 can parallel US1/US2**: US3 verifies the Phase 2 fix end-to-end and is independent of heading/body position work
- **Edge cases after US1+US2+US3**: edge-case tests exercise the full synthesis and layout pipeline

### Within each user story

1. Write tests → confirm they FAIL
2. Implement fix at the owning layer
3. Confirm tests PASS
4. Run full regression
5. Browser-verify affected diagrams

### Parallel opportunities

- T004, T005, T006 (foundational tests) – different test functions, same file
- T013, T014, T015 (US1 tests) – different test functions, same file
- T022, T023 (US2 tests) – different test functions, same file
- T031, T032 (US3 tests) – different test functions, same file
- T036, T037, T038 (edge-case tests) – different test functions, same file
- T042, T043 (final visual + render verification) – independent checks

---

## Parallel example: User Story 1

```
                T013 ──┐
                T014 ──┤ (parallel: different test functions)
                T015 ──┘
                   │
                  T016 (run tests, confirm FAIL)
                   │
              ┌── T017 (verify __heading)
              └── T018 (verify renderer – read-only)
                   │
                  T019 (run tests, confirm PASS)
                   │
              ┌── T020 (browser-verify android-security-comparison)
              └── T021 (browser-verify request-to-hardware-stack)
```

---

## Implementation strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1). This gives you the most visible fix (headings top-left) with the foundational field-copy bug resolved. The remaining phases build on top.

**Incremental delivery**:
1. Phase 2 alone is a safe, testable unit – 3 field copies, 3 new tests, full regression
2. Phase 3 (US1) adds heading position verification – mostly confirming existing behaviour
3. Phase 4 (US2) adds body zone placement verification – the key overlap fix
4. Phase 5 (US3) adds end-to-end field inheritance proof
5. Phase 6–7 are polish and final verification
