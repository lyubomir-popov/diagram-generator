# Tasks: Force preview shell convergence

**Input**: Design documents from `/specs/029-force-preview-shell-convergence/`

**Prerequisites**: spec.md, plan.md

**Depends on**: specs 023, 025, and 026 complete

## Phase 1 - Boundary freeze

- [ ] T001 Inventory current force save / dirty-state ownership and confirm the canonical save path remains YAML-only
- [ ] T002 Record the composer-safe boundary in the implementation notes or boundary docs
- [ ] T003 Confirm no new force-specific work is required in `editor.js`

## Phase 2 - Shell convergence

- [ ] T010 Replace remaining force-only dirty bookkeeping with shared preview-shell semantics or a documented serialized-state comparison
- [ ] T011 Ensure Save-button state derives from current unsaved state, not manual toggles
- [ ] T012 Keep Save posting canonical exported force runtime state only

## Phase 3 - Regression coverage

- [ ] T020 Add or extend focused regression coverage for force Save-button enable / disable behavior
- [ ] T021 Re-run existing force preview API coverage green
- [ ] T022 Re-run focused TS force runtime coverage green

## Phase 4 - Closeout

- [ ] T030 Update `specs/026-preview-shell-decomposition-ts-migration/boundaries.md` or equivalent notes with the force-lane boundary status
- [ ] T031 Update `TODO.md`, `STATUS.md`, and `docs/specs.md` when the feature lands
- [ ] T032 Mark this spec Complete only after the narrow convergence slice is validated