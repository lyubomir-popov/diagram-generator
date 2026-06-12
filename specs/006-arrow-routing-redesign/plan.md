# Implementation Plan: Arrow routing redesign with explicit ports and obstacle model

**Branch**: `feat/006-arrow-routing-redesign` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-arrow-routing-redesign/spec.md`

## Summary

Implement phased routing redesign from architecture plan: explicit ports and nested path selectors, hierarchy-aware per-arrow obstacles, deterministic side inference, improved channel/wedge behavior, and layout-owned geometry emission.

## Technical Context

**Language/Version**: TypeScript (primary, in `packages/layout-engine/`). Python routing receives equivalent changes only for batch SVG export parity.

**Primary Dependencies**: `packages/layout-engine/src/layout.ts` (routing logic), `scripts/preview/layout-bridge.js` (client-side arrow patching); `scripts/layout_v3.py` (Python parity only)

**Testing**:
```bash
npm --prefix packages/layout-engine test          # TS tests (primary)
python -m pytest test_autolayout.py test_layout_v3.py test_parity.py -q  # Python parity
```

**Target Platform**: Client-side TS layout engine + preview bridge; Python batch SVG export

**Constraints**: no renderer-owned routing decisions; no diagram-specific exception rules

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Anti-patch protocol | PASS | redesign is subsystem-level, not one-off patching |
| Layer ownership | PASS | routing decisions move/remain in layout layer |
| Semantic model first | PASS | explicit endpoints and path syntax are semantic |
| Test rigor | PASS | routing fixtures and deterministic assertions required |

## Phase Mapping (from TODO)

1. Port model + `/` path syntax
2. Multi-factor side inference
3. Per-arrow obstacle sets with ancestor exclusion
4. Grid channels + generalized wedge + bend penalties
5. Pre-compute arrow geometry in layout pass
6. Optional crossing minimization (stretch)

## Workstreams

### WS1 - Endpoint model and parser updates (P1)

- extend endpoint grammar for side-qualified and nested selectors
- validate path resolution and error reporting
- add parser tests for valid/invalid selectors

### WS2 - Deterministic side inference (P2)

- replace binary edge-gap logic with weighted scoring model
- define tie-break order and test it
- expose debug trace hooks where practical

### WS3 - Hierarchy-aware obstacle modeling (P1)

- compute obstacles per arrow
- apply ancestor/descendant exclusion rules
- add nested-fixture tests that previously failed

### WS4 - Route shape quality (P2)

- introduce channel midpoint preferences
- generalize wedge handling beyond L-only special case
- tune bend penalties with deterministic outputs

### WS5 - Layer ownership cleanup (P1)

- move/keep geometry finalization in layout stage
- ensure renderer only serializes provided points
- add contract tests for renderer purity

### WS6 - Optional crossing minimization (P3)

- evaluate lightweight crossing penalties or ordering heuristics
- keep behind explicit phase gate

### WS7 - Hierarchical bus routing for fan-out / fan-in across nested containers (P1)

This is the follow-up required for diagrams like `tiered-network-architecture` and the
spec addendum's `ssdlc-lifecycle`: a source box connects to multiple targets arranged in
one row/column, sometimes across different nesting depths. The current router can emit a
simple sibling fan, but it still reasons arrow-by-arrow and does not own a general
"shared trunk + branch bus" model across hierarchy boundaries.

Scope of this work:

- keep the primary authority in the native TS router
- do **not** hand-route per diagram
- do **not** bolt ELK on as a partial edge-only helper while keeping current box layout
- treat this as a larger routing architecture slice, not a bug patch

Execution shape:

1. Introduce an explicit intermediate routing plan for grouped arrows
   - identify fan-out / fan-in cohorts before final polyline emission
   - record shared source side, shared target side, branch axis, and owning corridor
   - make the plan deterministic and independent of authored arrow order
2. Make grouping hierarchy-aware
   - compute cohorts relative to the lowest common routing context, not only raw source/target centres
   - support targets that live in sibling containers, cousin containers, or parent/child levels
   - reject ambiguous groups cleanly and fall back to per-arrow routing
3. Add corridor ownership
   - attach each bus plan to a concrete routing corridor between containers
   - define when a trunk may run inside a container body, between siblings, or outside a shared ancestor
   - keep corridor choice stable when root/container direction flips
4. Emit bus geometry
   - route `source -> trunk -> branch bus -> target`
   - support both one-to-many fan-out and many-to-one fan-in as first-class shapes
   - keep existing explicit sides, layout paths, and manual waypoints as higher-priority escapes
5. Reserve space for buses
   - integrate route-aware lane reservation with the gap-promotion work from the addendum
   - ensure equivalent stacks widen consistently when the bus crosses them
   - avoid per-diagram special cases
6. Add diagnostics and fixtures
   - representative fixtures for same-level fans, mixed-depth fans, and direction flips
   - explicit diagnostics for unsupported cycles or ambiguous corridor ownership
   - browser verification on live preview relayout, not only pure router tests

Decision record:

- **Chosen path**: own a repo-native hierarchical bus router in `packages/layout-engine`
- **Not chosen**: use ELK only for edge routing while preserving current box-autolayout
- Rationale: ELK is viable when ELK owns the whole graph layout lane, but this feature needs
  route semantics that stay aligned with authored frame containers, preview relayout, and
  box-layout spacing rules already owned by the TS engine

## Validation Gates

1. parser tests for selector grammar and path resolution pass
2. routing fixtures pass for nested and obstacle-heavy diagrams
3. renderer path emission tests confirm no reroute logic
4. corpus spot-check on known problematic diagrams passes
5. hierarchical fan fixtures survive root/container direction flips in preview

## Deliverables

- endpoint/port model updates
- routing algorithm refactor with obstacle and channel improvements
- test fixtures and deterministic assertions
- TODO/status updates once implementation lands

## Risks and Mitigations

- Risk: route quality improves in one corpus slice but regresses others
- Mitigation: add representative fixtures from multiple diagram families and run corpus spot-checks

- Risk: algorithm complexity growth hurts performance
- Mitigation: benchmark representative large diagrams before/after each phase
