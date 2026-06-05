# Tasks: Multi-engine preview architecture

**Input**: Design documents from `/specs/025-multi-engine-preview-architecture/`

**Prerequisites**: spec.md, plan.md

## Phase 1 - Engine contract

- [ ] T001 Define the preview-engine manifest/capability interface and where it lives in the TS runtime surface
- [ ] T002 Decide and document how preview-server consumes TS-owned engine metadata without Python mirrors
- [ ] T003 Add focused regression coverage for engine manifest loading / capability discovery

## Phase 2 - Canonical save and runtime identity

- [ ] T010 Standardize engine-backed save responses around canonical persisted state
- [ ] T011 Add focused regression coverage proving save rehydrates from canonical server state
- [x] T012 Add a preview runtime identity surface reporting repo root, branch, frames dir, PID, and port

## Phase 3 - Existing engine migration

- [x] T020 Move ELK control definitions onto the single TS-owned metadata path
- [x] T021 Remove duplicated ELK control mirrors from browser JS and Python once the new source is live
- [ ] T022 Register ELK preview behavior through the engine contract
- [ ] T023 Register force preview behavior through the engine contract where applicable

## Phase 4 - Extensibility proof

- [ ] T030 Document the onboarding path for future engine packages
- [ ] T031 Verify no new engine-specific preview logic lands in `editor.js` outside bootstrap/registry wiring
- [ ] T032 Update `TODO.md`, `STATUS.md`, and `docs/specs.md` when the feature lands
