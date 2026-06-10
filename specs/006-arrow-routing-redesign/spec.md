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

---

## Addendum 2026-06-10 — Arrow-aware gaps, fork/merge routing, and explicit manual overrides (beta blocker)

This addendum extends spec 006 with the concrete requirements that block the autolayout
beta for technical-author users. It is written against the **native TS router** in
`packages/layout-engine/src/render-adapter/display-list.ts` and `svg-render.ts`
(`routeArrows` / `_inferSides` / `_orthogonalWaypoints` / `_edgePoint`), which is the
default render path for diagrams without an authored `layoutPath`. Reference diagram:
`scripts/diagrams/frames/ssdlc-lifecycle.yaml` (`/view/v3:ssdlc-lifecycle`), source
`diagrams/1.input/ssdlc.png`.

### Diagnosis of the current failure

**Failure 1 — side inference defeats the fan/trident.** `_inferSides` is a pure
center-to-center angle test: it picks `bottom→top` only when `|dy| >= |dx|`, otherwise it
picks a horizontal `left/right` pair. For a header that fans out to columns below it
(`ssdlc → phase_a | phase_b | phase_c`), the centre column satisfies `|dy| >= |dx|`
(routes straight down, correct), but the side columns have a large horizontal offset
(`|dx| > |dy|`), so the router emits them from the header's **left/right edges** into the
**side edges** of `phase_a` / `phase_c`. This is the wrapped L-route seen in the render.
The author's mental model ("once one arrow takes the bottom port the rest get pushed to
the sides") describes the same symptom; the underlying cause is per-arrow angle inference
with no awareness of the sibling fan.

**Failure 2 — no shared stem / fork primitive.** Every arrow is routed independently in a
`for` loop. `_edgePoint('bottom')` always returns the box's bottom-centre, and
`_orthogonalWaypoints` computes an independent `midY` per arrow. There is no concept of a
shared trunk that multiple arrows merge into, and no concept of one arrow attaching to
another arrow's segment. A "merge into one vertical stem, then fork like a trident" shape
is therefore unrepresentable, even though forcing all three to `bottom→top` would already
produce a near-correct trident.

**Failure 3 — child gaps are too tight for arrow lanes.** Child gap is derived by
`deriveContentGap` (`heading-synthesis.ts`): leaf-panel stacks (e.g. `phase_a` +
`purpose_a` inside `col_a`) get `INSET` (8px), container-of-container stacks get
`GRID_GUTTER` (24px). The `phase_a → purpose_a` arrow must pass through the 8px gap, which
is visually too tight. There is no mechanism to widen only the gaps that arrows traverse,
and no mechanism to keep that widening visually consistent across sibling stacks.

### New User Scenarios

#### User Story 5 — Header-to-column fans route as a clean trident (Priority: P1)

As a technical author, when one block points at several sibling blocks arranged on the
same side, I want a single merged stem that forks to each target, matching the source art,
without hand-routing every arrow.

**Independent Test**: `ssdlc-lifecycle` renders three arrows leaving `ssdlc` bottom-centre,
merging to one vertical stem, then forking horizontally to the top-centre of each phase
box — no arrow enters a phase box from its left/right edge.

#### User Story 6 — Arrow lanes get consistent breathing room automatically (Priority: P1)

As a technical author, I want the gap between stacked children to open up when an arrow
runs between them, and I want that widening applied consistently to every equivalent gap
so the diagram stays visually even.

**Independent Test**: With `phase_a → purpose_a` (and the b/c equivalents) present, every
leaf-stack child gap in the diagram resolves to 24px; with no inter-child arrows, it stays
at 8px. No single column is wider-spaced than its siblings.

#### User Story 7 — Authors can nudge gaps without persisting defaults (Priority: P2)

As a technical author, I want to manually increase a specific gap when the automatic lane
is still too tight, and have only my **delta from the automatic default** saved to YAML —
never the default itself.

**Independent Test**: Saving a manual bump on a stack writes a single override field whose
value is the difference from the promoted automatic gap; clearing it removes the field and
the YAML returns to carrying no gap value.

#### User Story 8 — Authors can correct and merge arrows explicitly (Priority: P2)

As a technical author, when the automatic first guess is still wrong, I want to add
waypoints, force endpoint sides, and attach an arrow's start/end to the middle of another
arrow's segment (a real junction), expressed cleanly in YAML.

**Independent Test**: An arrow with `waypoints` follows them exactly; an arrow whose
endpoint references another arrow segment terminates on that segment with a junction dot,
and moving the host arrow moves the junction.

### Additional Functional Requirements

#### Automatic gap promotion (arrow-aware spacing)

- **FR-007**: The engine MUST classify each auto-derived child gap into a **gap class**
  (initially: `leaf-stack` → `INSET`/8px, `container-stack` → `GRID_GUTTER`/24px) using the
  existing `deriveContentGap` categories. Promotion operates per class, not per container.
- **FR-008**: When any arrow's routed path crosses the inter-child lane of a stack whose
  gap belongs to gap class `C`, the engine MUST promote the **entire gap class `C`** to the
  arrow-lane minimum (default 24px) for the whole diagram, so all equivalent child gaps
  remain visually identical.
- **FR-009**: Gap promotion MUST be a layout-time computation derived from routing. It MUST
  NOT be written into YAML and MUST NOT appear as a saved value.
- **FR-010**: The arrow-lane minimum (24px) and the default child gap (8px) MUST be named
  tokens, not per-diagram literals (no per-diagram exception rules; see NFR-002).

#### Manual gap overrides (delta-only persistence)

- **FR-011**: Authors MUST be able to manually increase a stack's child gap above the
  automatic (post-promotion) value.
- **FR-012**: Persistence MUST be **delta-only**: YAML stores the difference between the
  author's chosen gap and the automatic default in effect for that gap class
  (`gap_delta`), never the absolute resolved gap. Effective gap = automatic default
  (after promotion) + `gap_delta`.
- **FR-013**: A zero or absent `gap_delta` MUST serialize to **no field** — saving a
  diagram that uses only automatic defaults MUST NOT introduce gap noise into YAML.
- **FR-014**: Manual overrides MUST be explicit and scoped to a single stack
  (`gap_delta` on a container). Broad low-level absolute gap settings (`gap:` as the normal
  authoring model) MUST NOT be the default surface; absolute `gap:` remains a deliberate,
  documented escape hatch only.

#### Improved automatic routing (better first guess)

- **FR-015**: Side inference MUST detect the **sibling-fan case**: when a single source has
  multiple targets that share a dominant side (all below / all above / all left / all
  right), all those arrows MUST be assigned the same source side (the shared side) rather
  than independent per-arrow angle results.
- **FR-016**: For a detected fan, the engine MUST emit a **shared stem + fork**: arrows
  leave the source from distributed points along the shared edge (or a single merge point),
  share one trunk lane, and branch to each target's facing edge — producing a deterministic
  trident, not overlapping independent polylines.
- **FR-017**: Fan/merge detection MUST be deterministic and order-independent, and MUST
  degrade gracefully to per-arrow routing when no fan is present.

#### Manual arrow overrides (waypoints + arrow-to-arrow attachment)

- **FR-018**: Arrows MUST honour author-supplied manual routing as an exact orthogonal
  override of the automatic path between the anchored endpoints. Manual waypoints MUST be
  expressed as **relayout-stable intent**, not raw canvas pixels, so they survive box
  resize, label reflow, and page-width changes:
  - **FR-018a**: The canonical persisted form is an **anchored waypoint** — a point defined
    relative to a stable reference (a node side/edge, a channel between two nodes, or a
    fraction along an axis), e.g. `{ lane: ssdlc.bottom, offset: 24 }` or
    `{ between: [phase_a, phase_b], x_frac: 0.5 }`. Anchored waypoints are recomputed from
    their anchors every layout pass.
  - **FR-018b**: Absolute pixel waypoints (`waypoints: [[x, y], ...]`, the current model)
    are a **marked, last-resort escape hatch only**. They MUST be flagged as fragile
    (`pinned: true` on the arrow, or a distinct `waypoints_abs` key) and MUST NOT be the
    form the UI emits by default. The drag interaction MUST persist the nearest stable
    anchored form, falling back to a pinned absolute point only when no sensible anchor
    exists.
  - **FR-018c**: When a box moves or resizes, anchored waypoints MUST follow their anchor;
    pinned absolute waypoints stay put and MUST surface a "pinned / may be stale" hint in
    the inspector.
- **FR-019**: An arrow endpoint (`source` or `target`) MUST be able to attach to **another
  arrow's segment** via an explicit reference (e.g. `arrow:<id>` or `@<id>`), producing a
  geometric junction on that segment rather than a box port. The junction point MUST track
  the host arrow when the host reroutes.
- **FR-020**: Explicit endpoint sides, `waypoints`, and arrow-to-arrow attachment MUST all
  be resolvable in the layout pass and emitted as final geometry; the renderer MUST NOT
  re-infer any of them (consistent with FR-005).

### Minimal YAML shape

Automatic behaviour (FR-007–FR-010, FR-015–FR-017) requires **no YAML** — promoted gaps
and the trident are computed at layout time and never serialized.

Manual overrides use a small, explicit surface:

```yaml
# Delta-only manual gap bump on a stack (FR-011–FR-014).
# Effective gap = automatic default (after promotion) + gap_delta.
# Absent/zero gap_delta serializes to nothing.
- id: col_a
  direction: vertical
  gap_delta: 8          # author wants 32px where automatic promotion gave 24px
  children: [...]

arrows:
  # Preferred: forced sides only — relayout-safe, zero coordinates (FR-015–FR-017, FR-020).
  - id: a_fork_left
    source: ssdlc.bottom
    target: phase_a.top

  # When a detour is genuinely needed: anchored (relative) waypoints (FR-018a).
  # Recomputed from anchors every layout — survives resize/reflow.
  - id: a_detour
    source: ssdlc.bottom
    target: phase_a.top
    waypoints:
      - { lane: ssdlc.bottom, offset: 24 }          # run 24px below ssdlc
      - { between: [phase_a, phase_b], x_frac: 0.5 } # midway between the two boxes

  # Last resort only: pinned absolute pixels (FR-018b) — flagged fragile, not UI default.
  - id: a_pinned
    source: ssdlc.bottom
    target: phase_a.top
    pinned: true
    waypoints_abs: [[720, 196], [240, 196]]

  # Arrow-to-arrow attachment / merged stem (FR-019).
  # This arrow starts on the middle of arrow `a_stem`, not on a box port.
  - id: a_stem
    source: ssdlc.bottom
    target: phase_b.top
  - id: a_fork_b
    source: arrow:a_stem        # or "@a_stem"
    target: phase_a.top
```

Rules for the shape:

- `gap_delta` (integer px) is the **only** new container field; absolute `gap:` stays an
  escape hatch, not the recommended model.
- `arrow:<id>` / `@<id>` endpoint selectors extend the existing `<node>.<side>` selector
  grammar (FR-001/FR-002) without overloading node-path syntax.
- Manual waypoints are **anchored by default** (`{ lane / between / *_frac, offset }`),
  recomputed from anchors each layout. The legacy absolute `waypoints: [[x, y]]` form is
  migrated to the marked, fragile `pinned: true` + `waypoints_abs` escape hatch and is
  never what the UI writes by default.

### Current implementation note (2026-06-10)

The current branch implements a narrower interim gap-promotion heuristic than FR-007 to
FR-009 describe: any arrow between siblings in a dense leaf stack promotes the dense
leaf-stack class globally for the current layout pass. This is enough to satisfy SC-004 on
`ssdlc-lifecycle`, but it is **not** the full route-lane classifier in T080/T081 yet.

### Additional Edge Cases

- Mixed fans (some targets above, some below the same source) — fan grouped per dominant
  side; ungrouped arrows fall back to per-arrow routing.
- Promotion feedback loop: widening a gap changes geometry, which could change which lanes
  arrows cross. Promotion MUST be computed from a stable pre-promotion route classification
  (single pass; no oscillation).
- Arrow-to-arrow attachment cycles (A attaches to B, B attaches to A) — MUST be rejected
  with an explicit diagnostic.
- A `gap_delta` that would drop the effective gap below the arrow-lane minimum while an
  arrow still crosses the lane — clamp to the minimum and warn.

### Additional Success Criteria

- **SC-004**: `ssdlc-lifecycle` renders a clean merged trident (no side-edge entries) and
  all leaf-stack gaps render at the promoted 24px, with no gap values written to its YAML.
- **SC-005**: A manual gap bump round-trips as `gap_delta` only; clearing it returns the
  YAML to zero gap fields.
- **SC-006**: An arrow-to-arrow attachment renders a tracked junction and survives a host
  reroute without renderer-side inference.

### Additional Out of Scope

- General N-to-N bus/merge routing beyond single-source fans and explicit arrow-to-arrow
  attachment.
- Curved/spline junctions — junctions are orthogonal only for now.
- Per-side independent gap classes beyond the two existing `deriveContentGap` categories
  (revisit only if a real diagram needs it).

### Risks, edge cases, and implementation cost

- **Promotion consistency vs. locality (medium).** Promoting a whole gap class keeps the
  diagram even but can widen gaps in stacks that no arrow actually crosses. Mitigation:
  class is coarse (leaf-stack/container-stack) and matches the existing visual-consistency
  invariant; accept the trade-off rather than per-container divergence.
- **Single-pass stability (medium).** Gap promotion changes geometry; naive recomputation
  could oscillate. Mitigation: classify lanes-crossed from the pre-promotion route, promote
  once, re-place once — no iteration.
- **Fan detection false positives (low–medium).** Aggressive grouping could merge arrows
  that should stay separate. Mitigation: require shared source AND shared dominant side AND
  non-overlapping target spans; otherwise fall back to per-arrow routing.
- **Arrow-to-arrow attachment ordering (medium).** Host arrow must be routed before its
  dependents; cycles must be rejected. Mitigation: topological ordering of arrow
  dependencies with explicit cycle diagnostics.
- **Cost estimate.** Gap-class promotion: small, localized in `deriveContentGap` +
  layout gap resolution + a route-lane classifier. `gap_delta` persistence: small (parser
  field + serializer delta logic + inspector control). Fan/stem routing: medium (new
  grouping + shared-stem geometry in `routeArrows`). Arrow-to-arrow attachment: medium
  (selector grammar + dependency ordering + junction geometry + renderer junction dot).
  All changes stay inside the layout layer; renderer stays inference-free.
