# Feature Specification: Preview shell decomposition and TypeScript migration

**Feature Branch**: `feat/026-preview-shell-decomposition-ts-migration`

**Spec Package**: `026-preview-shell-decomposition-ts-migration`

**Created**: 2026-06-05

**Status**: Draft

**Input**: `scripts/preview/editor.js` has grown to ~6k lines and now mixes bootstrap, selection state, inspector rendering, interaction controllers, undo/redo, save orchestration, grid UI, ELK wiring, and force-mode behavior. This file is now too large to remain the home of preview architecture.

## Problem Statement

The preview shell is currently coherent only because one file still "knows everything". That breaks down as the system grows:

- too many responsibilities in one file
- difficult reasoning about save / relayout / selection interactions
- engine-specific code tangled with shared shell behavior
- complex runtime logic still living in legacy browser JS instead of typed TS modules

The repo north star is not "delete browser code." The north star is:

- YAML-authored source of truth
- TypeScript-owned runtime logic where logic is non-trivial
- thin legacy glue only where still necessary

That means the correct direction is an incremental TS-first decomposition, not a one-shot rewrite and not indefinite growth of `editor.js`.

## Mission

Reduce `editor.js` to a thin bootstrap/coordinator by extracting substantial logic into coherent modules, with new non-trivial preview logic written in TypeScript and compiled for the browser.

## User Scenarios & Testing

### User Story 1 - Change a preview feature without touching a 6k-line file (Priority: P1)

As a maintainer, I want save logic, inspector logic, and interaction logic to live in separate modules so I can change one subsystem without re-reading the entire shell.

**Independent test**: A save-flow change can be implemented in a dedicated module without editing unrelated selection or interaction code.

### User Story 2 - Add engine-specific behavior outside the shell core (Priority: P1)

As a maintainer integrating more preview engines, I want engine-specific controllers to live outside the shared preview shell.

**Independent test**: ELK-specific and future-engine-specific logic lives outside the core shell coordinator.

### User Story 3 - Move real runtime logic to TS incrementally (Priority: P1)

As a maintainer, I want non-DOM logic to migrate to TS in bounded slices so stronger types and tests constrain the preview behavior.

**Independent test**: At least one substantial preview subsystem runs from TS-owned modules while the legacy JS entrypoint remains thin.

## Requirements

### Functional Requirements

- **FR-001**: `editor.js` MUST be decomposed into coherent responsibilities instead of continuing to grow as the default integration file.
- **FR-002**: New non-trivial preview logic MUST be written in TypeScript unless it is truly trivial DOM glue.
- **FR-003**: Shared shell concerns and engine-specific concerns MUST be separated.
- **FR-004**: Save/reload/orchestration logic MUST live in a dedicated client module rather than inline inside the monolithic shell.
- **FR-005**: Preview state and interaction controllers MUST have explicit ownership boundaries.

### Non-Functional Requirements

- **NFR-001**: This is an incremental migration, not a big-bang rewrite.
- **NFR-002**: Existing preview behavior MUST remain verifiable after each extracted slice.
- **NFR-003**: The end state SHOULD leave `editor.js` as a thin coordinator/bootstrap file rather than the main behavioral surface.

## Recommended module targets

- preview app bootstrap / shell coordinator
- save client / persistence orchestration
- engine registry / engine controller host
- inspector renderer
- grid controls controller
- ELK controls controller
- force controls controller
- selection + undo/redo state container
- pointer / keyboard interaction controllers

## TypeScript migration guidance

### What should move to TS

- state containers
- DTO shaping
- save / relayout orchestration
- engine controller logic
- inspector view-model logic
- non-trivial interaction state machines

### What may remain as JS temporarily

- tiny bootstrap file that wires compiled modules into the current preview page
- minimal DOM query / event hookup code during the transition

## Non-Goals

- Rewriting the entire preview shell in one session.
- Porting `preview_server.py` to TypeScript in this spec.
- Reworking unrelated layout-engine internals.

## Success Criteria

1. `editor.js` stops being the default place for new feature work.
2. At least one substantial shell subsystem is owned by TS modules.
3. Engine-specific logic is no longer coupled to the core shell file.
