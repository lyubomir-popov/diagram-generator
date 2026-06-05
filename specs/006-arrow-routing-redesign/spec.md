# Feature Specification: Arrow routing redesign with explicit ports and obstacle model

**Feature Branch**: `feat/006-arrow-routing-redesign`

**Created**: 2026-05-30

**Status**: Draft

**Input**: Convert arrow routing from heuristic patchwork to a contract-driven subsystem using explicit ports, nested references, per-arrow obstacle sets, and deterministic geometry generation.

## Problem Statement

The current arrow routing pipeline has known structural issues:

- no explicit port model; endpoint side choice is heuristic-heavy
- nested structures are routed with incorrect obstacle inclusion/exclusion
- wedge and bend rules are partial and shape-specific
- geometry generation is split across layers, violating ownership boundaries
- crossing minimization is not formalized

This feature defines a phased redesign so routing quality improves without layering violations.

## Implementation boundary

This redesign is **TypeScript-first**. The canonical routing implementation must move toward the TS runtime and renderer contract used by the active preview and export paths. Python fixtures and legacy routing code may be used as reference material or temporary parity oracles, but they are not the forward implementation surface.

## User Scenarios & Testing

### User Story 1 - Authors can target explicit ports (Priority: P1)

As a diagram author, I need to connect arrows to stable semantic ports (`top/right/bottom/left`) including nested nodes, so route intent survives layout changes.

**Independent Test**: Parse arrows using nested references like `core/logging.bottom` and confirm endpoint anchors resolve correctly.

**Acceptance Scenarios**:

1. **Given** an arrow from `frontend.right` to `backend.left`, **When** layout runs, **Then** endpoint anchors are attached to those exact sides.
2. **Given** an arrow referencing nested nodes (`a/b/c.top`), **When** parsed, **Then** path resolution is deterministic and errors are explicit for missing nodes.

---

### User Story 2 - Routing respects hierarchy-aware obstacles (Priority: P1)

As a layout engine, I need each arrow to evaluate an obstacle set that excludes legal ancestors/descendants appropriately, so nested arrows can route through intended channels.

**Independent Test**: Routing fixture with nested containers and cross-container edges; verify routes avoid disallowed nodes and permit expected ancestor corridors.

**Acceptance Scenarios**:

1. **Given** parent-child nested frames, **When** routing child-local arrows, **Then** ancestor corridor rules apply and routes do not collide with forbidden siblings.
2. **Given** two arrows with different endpoints, **When** routed, **Then** each arrow uses its own obstacle model and does not inherit stale state.

---

### User Story 3 - Direction/side inference is stable and explainable (Priority: P2)

As a maintainer, I need side-inference to use a documented multi-factor scoring model instead of binary edge-gap checks, so outputs are predictable.

**Independent Test**: Golden fixtures where previous heuristic flipped sides unexpectedly; assert new scoring picks stable sides.

**Acceptance Scenarios**:

1. **Given** multiple candidate sides, **When** scoring runs, **Then** chosen side is reproducible and traceable.
2. **Given** near-tie geometry, **When** tie-break applies, **Then** deterministic fallback order is used.

---

### User Story 4 - Geometry is precomputed in layout layer (Priority: P1)

As an architecture reviewer, I need final arrow path points decided in layout pass, so renderer does not invent routing facts.

**Independent Test**: Renderer receives finalized point sequences and emits SVG path data with no routing logic branches.

**Acceptance Scenarios**:

1. **Given** routed geometry from layout, **When** SVG render runs, **Then** output path equals provided geometry exactly.
2. **Given** unchanged layout inputs, **When** rendering repeats, **Then** path data is unchanged.

## Edge Cases

- arrows between nested nodes sharing common ancestors
- many parallel edges requiring channel separation
- short-distance arrows where direct routes compete with wedge rules
- malformed endpoint selectors and unresolved paths

## Requirements

### Functional Requirements

- **FR-001**: Arrow endpoints MUST support explicit side-qualified references.
- **FR-002**: Nested path syntax MUST resolve deterministically with clear errors for invalid references.
- **FR-003**: Obstacle selection MUST be per-arrow and hierarchy-aware.
- **FR-004**: Side inference MUST use documented multi-factor scoring with deterministic tie-breaks.
- **FR-005**: Layout pass MUST output final arrow geometry; renderer MUST not reroute.
- **FR-006**: Routing tests MUST cover nested, parallel, and constrained channel cases.

### Non-Functional Requirements

- **NFR-001**: Route output should be stable across repeated runs for same layout state.
- **NFR-002**: Changes must not introduce per-diagram hardcoded routing exceptions.
- **NFR-003**: Routing runtime must remain practical for current corpus scale.

## Success Criteria

- **SC-001**: All phase-1 to phase-5 objectives in TODO are implemented with tests.
- **SC-002**: Existing high-risk diagrams render with cleaner routes and no regressions in endpoint semantics.
- **SC-003**: Renderer layer contains no route-decision logic.

## Out of Scope

- global optimal crossing minimization as mandatory default (kept as stretch phase)
- resurrecting Python as the primary routing implementation surface

## Dependencies

- `docs/architecture/arrow-routing-redesign.md`
- `TODO.md` arrow routing redesign section
- existing routing tests and layout fixtures in Python engine (reference and parity material only)
