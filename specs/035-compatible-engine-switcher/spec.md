# Feature Specification: Compatible engine switcher

**Feature Branch**: `feat/035-compatible-engine-switcher`

**Spec Package**: `035-compatible-engine-switcher`

**Created**: 2026-06-06

**Status**: Phase 1 in progress (contract + persistence complete; Phase 2 switcher UI pending)

**Depends on**: spec 022 (complete), spec 025 (complete), spec 026 (complete)

**Phases**:
- **Phase 1** (COMPLETE): Typed compatibility contract and persistence guard
  - `PreviewEngineManifest` type with `compatibility` field
  - `evaluatePreviewEngineCompatibility()` and `listCompatiblePreviewEngines()` API
  - `meta.layout_engine` persistence with write-boundary guard
  - Tests for contract and persistence (12 tests passing)
- **Phase 2** (IN PROGRESS): Switcher UI and rerender path
  - Build `buildPreviewEngineSwitcherModel()` and wire into `buildGridViewerHtml`
  - Implement rerender through `resolvePreviewEngine()`
  - Add UI tests for incompatible-engine hiding and round-trip validation
- **Phase 3** (NOT STARTED): Docs, docs, closeout

**Input**: Authors should be able to take one canonical YAML/AST-backed diagram and try multiple compatible layout engines from a dropdown, then settle on the engine whose output works best. The switcher must only show engines that can validly render the authored document in question.

## Problem Statement

This repo is evolving toward multiple first-party layout lanes, but the current preview experience still assumes one engine choice is effectively fixed up front.

That creates two problems:

- authors cannot quickly compare algorithms against the same authored content
- maintainers risk coupling engine choice to file format drift or preview-only state rather than to the canonical authored AST

The repo already has the right architectural ingredients to solve this cleanly:

- a canonical TypeScript authoring compiler and AST
- a preview-engine registry with capabilities
- a thin preview shell boundary from specs 025 and 026

What is missing is a compatibility-aware engine switcher that sits above those contracts.

## Mission

Allow a user to open one canonical authored diagram, choose from the engines that are actually compatible with that authored shape, preview the alternatives, and then persist the chosen engine without introducing a second source of truth.

## User Scenarios & Testing

### User Story 1 - Try multiple compatible engines against one authored diagram (Priority: P1)

As an author, I want to switch between compatible engines for the same diagram YAML so I can compare layouts without duplicating the document.

**Independent test**: a diagram whose authored AST is compatible with more than one engine exposes only those engines in the switcher and rerenders when one is chosen.

### User Story 2 - Incompatible engines are hidden or disabled (Priority: P1)

As an author, I do not want to see engines that cannot validly render the current authored diagram shape.

**Independent test**: a sequence-authored document does not offer graph-layout engines that only accept graph-oriented ASTs, and vice versa.

### User Story 3 - Switching engines does not create shadow state (Priority: P2)

As a maintainer, I want engine switching to operate on canonical authored state plus preview-engine contracts, so the shell does not accumulate engine-specific hidden document models.

**Independent test**: the chosen engine persists as a canonical document field or equivalent typed override, while the authored AST remains the only structural source of truth.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST treat one canonical YAML/AST-backed document as the source of truth while allowing multiple layout engines to render it.
- **FR-002**: Each engine MUST declare compatibility in a typed way that can be evaluated against the authored document or compiled AST.
- **FR-003**: The preview switcher MUST show only engines that are compatible with the current document, or clearly disable incompatible choices with a reason.
- **FR-004**: Switching engines MUST rerender through the repo-owned preview-engine contract rather than bespoke shell branches.
- **FR-005**: Persisting an engine choice MUST not introduce a second authored structure or engine-owned shadow document format.
- **FR-006**: The compatibility contract MUST support future direct-port lanes such as sequence, state, tree, swimlane, and ER/class layouts in addition to existing graph lanes.

### Non-Functional Requirements

- **NFR-001**: Compatibility checks should be fast enough to evaluate during preview init and after relevant document edits.
- **NFR-002**: The switcher should remain thin shell UI; engine routing logic belongs in TypeScript contracts, not `editor.js` conditionals.
- **NFR-003**: Engine-specific parameters remain namespaced and optional; the existence of the switcher must not force every engine to share one flattened control surface.

## Non-Goals

- Claiming that every diagram shape can be rendered by every engine.
- Allowing engines to mutate the canonical authored AST into different structural formats just to become "compatible".
- Replacing engine-specific controls with one lowest-common-denominator parameter sheet.
- Solving layout-quality ranking or auto-picking the "best" engine in the first slice.
- Switching between incompatible shell modes (`grid` ↔ `force`) — authored frame diagrams live in the grid shell and can only switch between grid-mode engines; force-spec documents live in the force shell. Cross-shell comparison is out of scope; each shell has its own compatible engine set.

## Success Criteria

1. A single authored document can be previewed through multiple compatible engines without duplication.
2. The switcher filters choices based on typed compatibility rather than manual per-diagram allowlists.
3. The chosen engine persists cleanly without introducing shadow state or format drift.
4. The shell integration stays thin and manifest-driven, consistent with specs 025 and 026.