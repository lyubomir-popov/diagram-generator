# Tasks: Force-layout restoration

**Input**: Design documents from `/specs/023-force-layout-restoration/`

**Prerequisites**: spec.md, plan.md

**Engine rule**: All new simulation and runtime work is TypeScript-first. Do not recreate a Python force backend.

## Phase 1: Contract and example restoration

- [x] T001 Recover the deleted force example data from archive history for migration planning
- [x] T001a Define the YAML-authored canonical force source format and migrate the recovered examples into it
- [x] T002 Reconstruct `force-stakeholders` from `diagrams/1.input/force/IMG_3229.jpg` and archive history
- [x] T003 Reconstruct `force-juju-landing-pages` from `diagrams/1.input/force/IMG_3231.jpg` and archive history
- [x] T004 Reconstruct `force-support-case-lifecycle` from `diagrams/1.input/force/IMG_3232.jpg` and archive history
- [x] T005 Restore and validate force example discovery in the live preview index, picker, and browse surfaces

## Phase 2: TypeScript runtime ownership

- [x] T010 Decide and document the TS runtime boundary (browser-owned vs thin TS-backed routes)
- [x] T011 Implement the TS force solver/runtime entrypoint
- [x] T012 Replace deleted-Python dependencies in the force preview path without reintroducing Python force authority
- [x] T013 Remove or rewrite the orphaned force benchmark path against the TS runtime

## Phase 3: Interactive editor parity

- [x] T020 Restore drag-to-pin behavior
- [x] T021 Restore play/step/reset behavior around current pinned state
- [x] T022 Restore save persistence for force examples
- [x] T023 Restore shared resize-handle behavior (8px snap, 48px minimum)
- [x] T024 Reconfirm BF-shell preview parity: picker, prev/next, inspector empty state

## Phase 4: Export and validation

- [x] T030 Restore JSON export from canonical force state
- [x] T031 Restore SVG export for the live graph state
- [x] T032 Add focused automated tests for force example discovery and route availability
- [x] T033 Add focused automated tests for save/reset/export behavior
- [x] T034 Browser-check `force-stakeholders`, `force-juju-landing-pages`, and `force-support-case-lifecycle`
- [x] T035 Update `TODO.md`, `STATUS.md`, and `docs/specs.md` after the feature lands

## Parallelization Notes

- T002-T004 can run in parallel once T001 fixes the force-spec contract.
- T030-T031 depend on the runtime boundary in T010-T012.
- T034 is final and sequential.
