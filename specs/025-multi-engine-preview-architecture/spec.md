# Feature Specification: Multi-engine preview architecture

**Feature Branch**: `feat/025-multi-engine-preview-architecture`

**Spec Package**: `025-multi-engine-preview-architecture`

**Created**: 2026-06-05

**Status**: Draft

**Input**: The preview editor currently concentrates engine-specific behavior in `scripts/preview/editor.js` and related legacy JS/Python glue. Near-term roadmap includes additional engine-backed packages and preview surfaces (ELK, Penrose, Mermaid, and others). The preview shell must stop treating each engine as another hardcoded branch inside `editor.js`.

## Problem Statement

The current preview shell has grown around a small number of engines and modes:

- box autolayout / grid editing
- ELK layered preview controls and save behavior
- force-layout preview controls and runtime

This was tolerable while the preview supported only one main interactive path plus one specialist lane. It stops scaling when multiple engine packages must coexist. The current pattern hardcodes engine-specific decisions into the shell:

- engine-specific panels and control wiring in `editor.js`
- server-rendered ELK HTML in Python
- engine-specific state branches spread across shell JS
- no formal engine capability contract for save, relayout, debug view, or inspector affordances

If new engines are added by continuing this pattern, `editor.js` becomes the de facto integration layer for every preview package. That is the opposite of the repo north star: YAML-authored source of truth, TypeScript-owned runtime logic, and thin legacy glue only where still necessary.

## Mission

Define a multi-engine preview architecture in which:

- the preview shell owns shared UX only
- each engine declares capabilities and preview controls through a typed contract
- TypeScript packages remain the authority for engine metadata and behavior
- Python preview-server code stays a thin transport/orchestration layer instead of a second engine-definition surface

## User Scenarios & Testing

### User Story 1 - Add a new engine without growing editor.js (Priority: P1)

As a maintainer adding a new engine-backed package, I want to register the engine through a clear contract so I do not have to splice new mode-specific branches throughout `editor.js`.

**Independent test**: A new engine can provide a manifest, control schema, and relayout/save hooks through the registry, and the preview shell loads it without new engine-specific shell branches outside the registry wiring.

### User Story 2 - Engine controls come from TS authority (Priority: P1)

As a maintainer, I want engine-specific control schemas and defaults to come from TypeScript-owned definitions so the browser shell and preview server stop mirroring the same constants in JS and Python.

**Independent test**: ELK control metadata is sourced from a single TS authority and rendered in preview without separate hardcoded mirrors in browser JS and Python.

### User Story 3 - Save and relayout return canonical engine state (Priority: P1)

As an author, I want Save and reload to use canonical server-persisted engine state, not speculative in-memory preview state, so engine-backed diagrams round-trip reliably.

**Independent test**: An engine-backed diagram saves via `/api/overrides`, the server returns canonical persisted state, and the preview rehydrates from that response or a documented follow-up fetch.

### User Story 4 - Running preview identifies its engine/worktree/runtime (Priority: P2)

As a maintainer using several preview servers and worktrees, I want the running preview to expose enough identity information to distinguish which repo, branch, and frames dir I am actually talking to.

**Independent test**: The preview exposes a small runtime identity surface or endpoint that reports at minimum repo root, branch, frames dir, PID, and port.

## Requirements

### Functional Requirements

- **FR-001**: The preview shell MUST define a formal engine manifest / capability contract for preview integration.
- **FR-002**: Engine-specific control definitions MUST come from TypeScript-owned authority, not duplicated JS and Python constant tables.
- **FR-003**: The preview shell MUST support engine-specific control panels, relayout hooks, debug toggles, and save hooks through the engine contract.
- **FR-004**: Save flows for engine-backed diagrams MUST rehydrate from canonical persisted state returned by the server or a documented canonical fetch path.
- **FR-005**: Adding a new engine MUST NOT require new engine-specific business logic branches in `editor.js` outside registry/bootstrap wiring.
- **FR-006**: Preview runtime identity MUST be observable so simultaneous worktrees/servers are diagnosable.

### Non-Functional Requirements

- **NFR-001**: Python preview-server code remains orchestration and persistence glue only; it does not become a second authority for engine capability definitions.
- **NFR-002**: New engine integration work is TypeScript-first.
- **NFR-003**: Existing ELK and force preview behavior MUST continue working while the contract is introduced incrementally.

## Architecture direction

### Target ownership

| Concern | Owner |
| --- | --- |
| Engine manifests, capability flags, control schema | TypeScript package(s) |
| Engine runtime behavior | TypeScript package(s) |
| Shared preview UX shell | browser shell |
| Save persistence + file I/O | preview server / persistence helpers |
| YAML authored diagram state | frame YAML |

### Why Python and JS still exist today

- **Python** still exists because the preview server, hot reload, route plumbing, and YAML persistence are currently implemented there. This is acceptable only while Python remains transport/orchestration glue.
- **Browser JS** still exists because the preview shell is a live DOM application. The correct long-term direction is not "no browser code"; it is "TypeScript-owned browser logic compiled to JS, with minimal legacy JS glue left behind."

## Non-Goals

- Implementing Penrose, Mermaid, or other new engines themselves.
- Big-bang rewrite of the entire preview shell in one slice.
- Removing Python preview-server ownership in this spec.

## Success Criteria

1. ELK no longer depends on mirrored control definitions in browser JS and Python.
2. A new preview engine can be added via a registry / manifest path without inflating `editor.js` with bespoke branches.
3. Preview runtime identity makes worktree/port confusion diagnosable in seconds.
