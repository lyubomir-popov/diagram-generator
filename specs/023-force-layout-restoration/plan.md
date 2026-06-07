# Implementation Plan: Force-layout restoration

## Goal

Restore the broken force-layout lane as a TypeScript-owned preview/editor surface, using the existing force UI shell, the archived example behavior, and the three retained reference images.

## Approach

### Phase 1 - Lock the contract and source format (P1)

1. Define the canonical force-spec format under `scripts/diagrams/force/` as YAML-authored source.
   - Include nodes, links, pinned/manual state, style state, and exportable positions.
2. Reconstruct the three canonical examples:
   - `force-stakeholders`
   - `force-juju-landing-pages`
   - `force-support-case-lifecycle`
3. Update preview-server example discovery and root-index surfacing to list the restored examples again.

### Phase 2 - Replace the missing backend with TS-owned runtime (P1)

Chosen boundary: browser-owned TypeScript runtime, documented in `research.md`.

1. Implement the browser-owned force runtime behind the existing preview shell.
   - `force.js` keeps interaction/render orchestration.
   - TS owns simulation state, ticking, and exportable graph state.
2. Port the force solver behavior into TypeScript.
   - center, collide, link, many-body, pinned nodes, boundary clamping
3. Remove reliance on the deleted Python force backend while preserving the existing preview routes or replacing them with TS-backed equivalents.

### Phase 3 - Restore interactive editing parity (P1)

1. Re-enable drag-to-pin and pin/unpin state.
2. Re-enable play/step/reset/save semantics.
3. Reconnect shared resize handles and 8px snapping / 48px minimum constraints.
4. Ensure BF-shell picker, prev/next navigation, and inspector empty state behave like the archived force lane.

### Phase 4 - Export and validation (P2)

1. Restore JSON export from canonical force state.
2. Restore SVG export for the live graph state.
3. Add focused tests for:
   - example discovery
   - force route availability
   - save/reset persistence
   - export success
4. Browser-check at least the three canonical examples, with full interaction on one representative example.

## Current landing state

- The TS runtime boundary is implemented in `packages/layout-engine/src/force-runtime.ts` with the historical solver port in `force-solver.ts` and `force-quadtree.ts`.
- The live preview uses the TS local runtime path, keeps runtime-backed snapshots separate from temporary preview clones, and reheats correctly after unpinning a manually moved node.
- The three canonical demos load in the live preview shell on the TS runtime.
- Save/reset/export coverage and the TS-backed benchmark path are landed.
- This restoration spec is complete; future force preview architecture changes should route through spec 025 and spec 026 rather than reopening the restoration scope.

## Architecture constraints

- TS-only for simulation and layout authority.
- Reuse `scripts/preview/force.js`, `scripts/preview/force-viewer.html`, and shared preview-shell utilities where practical.
- Do not deepen Python preview or solver ownership.
- Keep this slice bounded to the three restored examples and the minimum runtime needed to support them.

## Validation gates

1. Force examples appear again in preview navigation.
2. `/force/view/<slug>` loads working live graphs for all three examples.
3. Drag, pin, save, reset, and resize work on at least one canonical example.
4. JSON and SVG export both succeed.
5. No new Python solver/backend is introduced.

## Risks

| Risk | Mitigation |
|------|------------|
| `force.js` is tightly coupled to deleted Python API shapes | Start by defining the force-spec contract explicitly, then adapt the route/client boundary once. |
| Example reconstruction is incomplete | Use archive history + surviving reference images; keep the examples bounded and canonical. |
| Preview-server force routes encourage accidental Python resurrection | Replace or wrap them with TS-backed logic and delete dead Python references as the slice lands. |
| Large runtime scope balloons beyond one slice | Keep the goal to parity with the historical demo lane, not a generalized graph product. |

## Deliverables

- `specs/023-force-layout-restoration/spec.md`
- `specs/023-force-layout-restoration/tasks.md`
- `specs/023-force-layout-restoration/research.md`
- Restored canonical force example sources under `scripts/diagrams/force/`
- TS-owned force runtime and preview integration
- Focused tests and browser validation evidence
