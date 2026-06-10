# Tasks: Arrow routing redesign with explicit ports and obstacle model

**Input**: Design documents from `/specs/006-arrow-routing-redesign/`

**Prerequisites**: spec.md, plan.md

## Phase 1: Baseline and fixture prep

- [ ] T001 Capture baseline behavior on known routing-problem diagrams
- [ ] T002 Add/refresh routing fixtures for nested, parallel, and obstacle-heavy cases
- [ ] T003 Document current side-inference and obstacle rules as baseline notes

## Phase 2: Port model + nested selector syntax (TODO phase 1)

- [ ] T010 Extend endpoint model to support side-qualified references
- [ ] T011 Implement nested selector parsing with `/` path support
- [ ] T012 Add parser tests for valid selectors
- [ ] T013 Add parser tests for invalid selectors and error clarity

## Phase 3: Multi-factor side inference (TODO phase 2)

- [ ] T020 Define weighted side-scoring model and deterministic tie-break
- [ ] T021 Implement side scorer in routing path
- [ ] T022 Add tests for previous unstable side-selection cases

## Phase 4: Per-arrow obstacles with hierarchy rules (TODO phase 3)

- [ ] T030 Implement per-arrow obstacle computation
- [ ] T031 Add ancestor/descendant exclusion logic for nested routing
- [ ] T032 Add tests for nested arrows and shared-ancestor corridors

## Phase 5: Channel/wedge and bend penalties (TODO phase 4)

- [ ] T040 Introduce channel midpoint preferences
- [ ] T041 Generalize wedge handling beyond current special-case behavior
- [ ] T042 Apply direction-aware bend penalties
- [ ] T043 Add route-shape regression tests

## Phase 6: Layout-owned geometry emission (TODO phase 5)

- [ ] T050 Precompute final arrow geometry in layout pass
- [ ] T051 Remove remaining renderer route-decision branches
- [ ] T052 Add contract tests ensuring renderer serializes only provided geometry

## Phase 7: Stretch - crossing minimization (TODO phase 6)

- [ ] T060 Prototype crossing-cost heuristic
- [ ] T061 Evaluate on representative diagrams and decide keep/drop

## Phase 8: Validation and closeout

- [ ] T070 Run focused test suite and new routing fixtures
- [ ] T071 Browser-check representative diagrams for route quality
- [ ] T072 Update TODO arrow-routing section status and phase completion notes

## Phase 9: Arrow-aware gaps + fork/merge + manual overrides (addendum 2026-06-10, beta blocker)

Maps to spec.md addendum FR-007–FR-020 and SC-004–SC-006.

### 9a. Arrow-aware gap promotion (FR-007–FR-010)

- [ ] T080 Add a layout-time route-lane classifier: detect which inter-child lanes arrow paths cross, keyed by the gap class of the owning stack
- [ ] T081 Promote a whole gap class to the arrow-lane minimum (24px) when any lane in that class is crossed; keep promotion out of YAML
- [ ] T082 Name arrow-lane-min (24px) and default-child-gap (8px) as tokens; remove any per-diagram literals
- [x] T083 Fixture: `ssdlc-lifecycle` leaf-stack gaps resolve to 24px globally; no gap value written to YAML (SC-004)

### 9b. Delta-only manual gap overrides (FR-011–FR-014)

- [ ] T084 Parse `gap_delta` on containers; effective gap = automatic default (post-promotion) + gap_delta
- [ ] T085 Serializer: write `gap_delta` only when non-zero; never write absolute resolved gaps; absent/zero → no field
- [ ] T086 Inspector control for manual gap bump that round-trips as `gap_delta` only (SC-005)
- [ ] T087 Clamp effective gap to arrow-lane minimum when a lane is still crossed; warn

### 9c. Improved first-guess routing — sibling fan / shared stem (FR-015–FR-017)

- [x] T088 Detect sibling-fan: single source, multiple targets sharing a dominant side; assign all the shared source side
- [x] T089 Emit shared stem + fork geometry (deterministic trident) instead of independent per-arrow polylines
- [ ] T090 Deterministic, order-independent detection; graceful fallback to per-arrow routing when no fan
- [x] T091 Fixture: `ssdlc-lifecycle` renders merged trident with no side-edge box entries

### 9d. Manual arrow overrides — waypoints + arrow-to-arrow attachment (FR-018–FR-020)

- [ ] T092 Implement anchored (relayout-stable) waypoints (`{ lane / between / *_frac, offset }`), recomputed from anchors each layout pass (FR-018a)
- [ ] T092b Demote absolute pixel waypoints to a marked escape hatch (`pinned: true` + `waypoints_abs`); migrate the existing `waypoints: [[x,y]]` field and make the drag UI persist the nearest anchored form by default (FR-018b/c)
- [x] T093 Extend endpoint selector grammar with `arrow:<id>` / `@<id>` attachment to another arrow's segment
- [ ] T094 Topologically order arrow dependencies; reject attachment cycles with explicit diagnostics
- [ ] T095 Emit tracked junction geometry + renderer junction dot; junction follows host reroute (SC-006)
- [ ] T096 Contract test: renderer re-infers none of sides/waypoints/attachment (consistent with T052)

## Parallelization Notes

- Parser work (T010-T013) can proceed in parallel with baseline fixture curation after T001.
- Geometry ownership cleanup (T050-T052) depends on phases 2-5 completion.
