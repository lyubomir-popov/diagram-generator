# Tasks: Preview shell decomposition and TypeScript migration

**Input**: Design documents from `/specs/026-preview-shell-decomposition-ts-migration/`

**Prerequisites**: spec.md, plan.md

## Phase 1 - Boundary audit

- [ ] T001 Audit `scripts/preview/editor.js` by responsibility and document extraction boundaries
- [ ] T002 Audit `scripts/preview/layout-bridge.js` ownership overlap and document what belongs in shell vs runtime bridge
- [ ] T003 Define the target module map for shell, state, inspector, save, and engine controllers

## Phase 2 - Initial extraction slices

- [x] T010 Extract save/reload orchestration into a dedicated client module
- [x] T011 Extract ELK controller wiring into a dedicated module
- [ ] T012 Extract shared editor state helpers into a dedicated state container

## Phase 3 - TypeScript-first migration

- [ ] T020 Introduce TS-owned modules for extracted non-DOM logic
- [ ] T021 Keep only thin bootstrap/event hookup code in legacy JS where necessary
- [ ] T022 Add focused regression coverage for the extracted shell slices

## Phase 4 - Shell shrink and follow-up

- [ ] T030 Remove obsolete inline helpers from `editor.js`
- [ ] T031 Reassess `layout-bridge.js` for additional decomposition after the first shell slices land
- [ ] T032 Update `TODO.md`, `STATUS.md`, and `docs/specs.md` after the feature lands
