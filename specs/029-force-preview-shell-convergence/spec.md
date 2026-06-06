# Feature Specification: Force preview shell convergence

**Feature Branch**: `feat/029-force-preview-shell-convergence`

**Spec Package**: `029-force-preview-shell-convergence`

**Created**: 2026-06-06

**Status**: Draft

**Depends on**: spec 023 (complete), spec 025 (complete), spec 026 (complete)

**Input**: Force preview now uses the TS runtime and preview-engine manifest correctly, but `scripts/preview/force.js` still carries its own save-button dirty tracking and save orchestration instead of converging on the preview-shell patterns established in spec 026. A recent regression showed the risk: Save succeeded, but the button state stayed ambiguous because the force lane used an ad hoc dirty flag instead of a durable shared contract.

## Problem Statement

The force lane is in a mixed state:

- good: TS runtime owns simulation behavior and preview-engine metadata
- good: YAML remains the only persisted authority
- good: `editor.js` did not grow new force-specific branches
- bad: `force.js` still owns force-specific dirty/save state instead of a shared shell contract
- bad: there is no explicit boundary describing what part of force preview can be delegated safely versus what remains high-risk architecture work

That makes the next cleanup easy to mis-scope. A broad "move force preview toward TS" request invites the same kind of uncontrolled shell churn that already caused regressions. A narrow convergence slice is safer.

## Mission

Define a composer-safe follow-up that converges the force lane with the spec 025 / 026 architecture without reopening a broad rewrite.

This spec is intentionally narrow:

1. align force save / dirty behavior with the shared preview-shell contract
2. add focused regression coverage for force save-button state and canonical save rehydration
3. document the force preview boundary so future work does not treat `force.js` as an open-ended dumping ground

## Delegation decision

### Safe to delegate

- shell-side force save / dirty-state convergence
- focused regression tests around save-button enable / disable behavior
- boundary documentation updates clarifying force controller ownership

### Not safe to delegate in this spec

- broad `force.js` rewrite
- moving the full force controller into TypeScript in one pass
- changing force runtime semantics, pin behavior, or YAML schema
- introducing new preview-server authorities or persistence paths

## User Scenarios & Testing

### User Story 1 - Save button state is trustworthy in force preview (Priority: P1)

As an author editing a force diagram, I want the Save button to enable only when persisted force state differs from the last saved state and to disable immediately after a successful save, so the UI clearly reflects whether my changes landed.

**Independent test**: changing a persisted force parameter or pin/position state enables Save; clicking Save disables it again after canonical save completes.

### User Story 2 - Force lane follows spec 025 / 026 boundaries (Priority: P1)

As a maintainer, I want force preview save / dirty behavior to use the shared preview-shell direction rather than force-only shell state, so this lane does not drift away from the architecture already established for ELK and the main preview shell.

**Independent test**: force save / dirty wiring uses shared preview-shell abstractions or a documented serialized-state contract, with no new persistence logic in `editor.js` and no second source of truth.

### User Story 3 - Future delegation is bounded (Priority: P2)

As the orchestrator of downstream agent work, I want a clear statement of what composer may and may not change in this area, so follow-up work stays mechanical and does not reopen architecture decisions already made locally.

**Independent test**: the spec package and task list explicitly separate safe delegated work from high-risk local-only work.

## Requirements

### Functional Requirements

- **FR-001**: Force preview dirty-state semantics MUST be derived from a shared preview-shell contract or a documented serialized-state comparison, not a one-off boolean flag.
- **FR-002**: Force preview Save MUST continue to persist only canonical YAML-backed state; no `localStorage`, `sessionStorage`, or shadow persistence may be introduced.
- **FR-003**: Force preview follow-up work MUST NOT add new engine-specific branches to `editor.js` outside existing bootstrap wiring.
- **FR-004**: The delegated slice MUST stay limited to shell-side save / dirty orchestration, focused tests, and boundary documentation.
- **FR-005**: Focused regression coverage MUST prove Save-button enable / disable behavior for force preview after both state mutation and successful save.

### Non-Functional Requirements

- **NFR-001**: TypeScript remains the authority for force runtime behavior, engine metadata, and simulation semantics.
- **NFR-002**: Python preview-server code remains transport / persistence glue only.
- **NFR-003**: This spec MUST NOT attempt a big-bang `force.js` to TypeScript rewrite.

## Non-Goals

- Rewriting the full force preview controller.
- Porting all force preview shell code to TypeScript in one slice.
- Changing YAML schema, force runtime semantics, or pin/export rules.
- Adding new force preview features unrelated to shell convergence.

## Success Criteria

1. Force Save enables only when there is unsaved persisted state and disables immediately after successful save.
2. The force lane no longer relies on ad hoc save-button dirty state that diverges from the preview-shell direction set by spec 026.
3. Focused automated or browser-driven regression coverage exists for the force Save-button state transition.
4. The spec package makes clear which remaining force-preview cleanup work is safe for composer and which is not.