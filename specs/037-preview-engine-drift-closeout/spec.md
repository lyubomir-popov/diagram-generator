# Feature Specification: Preview engine drift closeout

**Feature Branch**: `feat/037-preview-engine-drift-closeout`

**Spec Package**: `037-preview-engine-drift-closeout`

**Created**: 2026-06-06

**Status**: Complete

**Depends on**: spec 025 (complete), spec 029 (draft), spec 035 (draft)

**Input**: 2026-06-06 architectural review calling out preview/runtime drift: accepted engine ids that are not actually hostable (`elk-force`), force save behavior that still diverges from the shared canonical-save contract, forbidden `localStorage` usage in live preview, and the missing typed compatibility surface needed before spec 035 can safely cycle compatible engines against one authored document.

## Problem Statement

The repo has one strong architecture for "canonical YAML -> one TS-owned preview lane," but its engine surface is starting to drift:

- some engine ids are accepted in schema/loader space without matching runtime hosting
- force preview still follows its own save/reload contract instead of the shared canonical-state path
- shell state still leaks into `localStorage` in the live editing path
- the preview-engine manifest exposes capabilities, but not typed document compatibility

That drift is manageable now, but it will become expensive once compatible-engine switching starts landing. The repo needs one bounded cleanup slice that closes these gaps before more engines spread across schema, runtime, and shell surfaces.

## Mission

Bring the preview-engine surface back into one coherent contract: supported engine ids are hostable, save flows converge on canonical persisted state, shell state does not leak into forbidden browser persistence, and the preview-engine model gains the typed compatibility foundation required by spec 035.

## User Scenarios & Testing

### User Story 1 - Supported engine ids are real runtime options (Priority: P1)

As a maintainer, I want every accepted engine id to be either fully hostable or explicitly rejected, so YAML/schema acceptance does not drift ahead of runtime support.

**Independent test**: any engine id accepted by loader/schema is registered in the runtime manifest and routed correctly, or it is rejected before preview rendering.

### User Story 2 - Force save matches the shared shell contract (Priority: P1)

As an author, I want force preview save/reload to behave like the rest of the preview shell, so YAML remains the persisted authority and the shell rehydrates from canonical saved state.

**Independent test**: force save returns canonical persisted state and the preview reload path uses that canonical payload instead of treating a local snapshot as authoritative.

### User Story 3 - Compatibility is typed before engine cycling expands (Priority: P1)

As a maintainer, I want preview engines to declare typed compatibility against authored documents, so spec 035 filters valid engines through one contract instead of ad hoc shell branching.

**Independent test**: the preview-engine model exposes typed compatibility metadata that can be evaluated against the current document shape.

### User Story 4 - The live preview path obeys the no-localStorage rule (Priority: P2)

As a maintainer, I want engine/shell UI state to avoid forbidden browser persistence, so the repo does not reintroduce state drift through hidden client storage.

**Independent test**: no live preview engine path writes editor/runtime state to `localStorage`.

## Requirements

### Functional Requirements

- **FR-001**: The repo MUST have one authoritative supported-engine surface across schema, loader, preview-engine manifest, and runtime routes.
- **FR-002**: `elk-force` MUST NOT be accepted as a normal frame-YAML engine unless the preview/runtime path can actually host it; otherwise acceptance must be removed or fail fast with an explicit error.
- **FR-003**: Force preview save MUST return canonical persisted state in the same spirit as the shared preview-shell save contract.
- **FR-004**: Force save/reload convergence MUST stay bounded to shell/save authority work; this spec MUST NOT become a broad force-controller rewrite.
- **FR-005**: The preview-engine model MUST expose typed compatibility data or hooks sufficient for spec 035 to evaluate whether a document can be rendered by a given engine.
- **FR-006**: The live preview path MUST NOT persist engine/shell state via `localStorage`.
- **FR-007**: Focused validation MUST cover engine-id hostability, manifest serialization, force save/reload contract behavior, and compatibility-surface expectations.

### Non-Functional Requirements

- **NFR-001**: Engine-surface rules should be explainable simply: "if YAML can name it, the runtime can host it."
- **NFR-002**: The cleanup should preserve the TS-first architecture from specs 025 and 026 rather than reintroducing Python mirrors.
- **NFR-003**: The compatibility surface should stay thin and typed, leaving full switcher UX work to spec 035.

## Non-Goals

- Building the full compatible-engine switcher UI.
- Replacing the existing D3/quadtree `force` lane with `elk-force`.
- Rewriting the full force runtime or controller stack beyond save-contract convergence.
- Solving layout-quality ranking or auto-engine selection.

## Success Criteria

1. Engine ids accepted by authored inputs no longer drift ahead of runtime hosting.
2. Force preview save/reload follows the same canonical-state authority model as the shared shell.
3. No forbidden `localStorage` persistence remains in the live preview engine path.
4. The preview-engine model has the typed compatibility groundwork required for spec 035.
5. Focused preview-engine validation is green on a clean branch after the bounded cleanup lands.
