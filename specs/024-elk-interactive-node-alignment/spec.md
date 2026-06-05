# Feature Specification: ELK interactive node alignment (native constraints)

**Feature Branch**: `feat/024-elk-interactive-node-alignment`

**Spec Package**: `024-elk-interactive-node-alignment`

**Created**: 2026-06-05

**Status**: Draft — blocked on elkjs feasibility spike and must land through the spec 025 engine contract plus the spec 026 ELK controller slice

**Input**: Authors need to nudge slightly misaligned boxes on ELK-layered diagrams (e.g. Juju process corpus), persist those hints, and re-run the layered algorithm so routes, spacing, and label boxes stay coherent. Must use **native ELK interactive constraints**, not post-layout SVG patching.

## Problem Statement

ELK layered preview today is batch-only: sidebar spacing/strategy knobs and `meta.elk` graph options persist, but there is no way to correct small alignment drift (same-layer boxes visually off, one node sitting high/low relative to peers) while keeping ELK responsible for edge routing and label placement.

A fragile approach — translating node `<g>` elements in the preview DOM without re-invoking ELK — would desync geometry from routes, break export, and fight compound bounds. This spec requires **ELK-native** interactive layout: author nudge → constraint payload → re-layout with interactive layered strategies. It must also fit the preview architecture direction from spec 025 and spec 026: no new ELK-specific branches piled into `editor.js`, and no second persistence or engine-metadata authority outside the TS runtime.

## ELK-native vs hack (decision record)

| Approach | Verdict |
| --- | --- |
| Drag node in preview → write `elk.layered.layering.layerChoiceConstraint` / `elk.layered.crossingMinimization.positionChoiceConstraint` (and/or documented interactive position hints) → re-run `elkjs` with `layering.strategy: INTERACTIVE`, `crossingMinimization.strategy: INTERACTIVE`, `cycleBreaking.strategy: INTERACTIVE` | **In scope** — this is how Eclipse ELK documents interactive layered layout ([layer choice](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-layering-layerChoiceConstraint.html), [position choice](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-positionChoiceConstraint.html), [constraining the model](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html)). |
| Toggle sidebar `INTERACTIVE` strategies alone with no per-node constraints | **Out of scope** — strategies reuse *prior* layout output; they do not enable drag-to-move by themselves (already documented in `elk-param-registry.ts`). |
| Preview-only SVG `transform` / manual `x,y` overrides without ELK rerun | **Explicit non-goal** — fragile, non-exportable, breaks arrow sync. |
| Replace layered with force / box autolayout for ELK diagrams | **Non-goal** — different engine contract. |

**Feasibility gate (P0 spike):** Confirm `elkjs` evaluates interactive constraints the same way as Eclipse ELK’s `InteractiveLayeredGraphVisitor` / `DiagramLayoutEngine` path. If elkjs cannot honor `layerChoiceConstraint` / `positionChoiceConstraint` under interactive strategies, **stop implementation** and report upstream gap — do not ship a SVG hack workaround.

## Mission

```
author nudge (layer/order or ELK-documented position hint)
  → derive / update per-node ELK constraints
  → persist under canonical frame YAML `meta.elk_nodes`
  → rebuild ELK graph input with constraints + interactive strategies
  → elkjs layered re-layout
  → existing BF styling + ELK routes/labels
```

**Primary user goal:** Align slightly misaligned boxes (same-layer horizontal alignment, minor vertical layer tweaks) while preserving algorithm-owned routing.

## Dependencies

- Stable ELK layered preview pipeline (`layoutElkFrameDiagram`, HarfBuzz measure, `meta.elk` sidebar, save/load round-trip).
- Spec **025** phase 1 engine contract is the integration path for ELK preview behavior; this feature must not add bespoke ELK orchestration branches to `editor.js`.
- Spec **026** initial ELK controller extraction is the shell landing point for interactive controls and event wiring.
- Spec **005** autolayout hardening complete for box autolayout; ELK lane is separate but must not regress.
- This spec **does not** start implementation until ELK preview save/load is stable on the Juju corpus diagram and the current spec 025 / spec 026 prerequisite slices exist.

## User Scenarios & Testing

### User Story 1 — Nudge a node and see coherent relayout (Priority: P1)

As a diagram author on an ELK-layered frame, I want to drag a node slightly so misaligned peers line up, then see edges and labels re-route through ELK rather than floating offsets.

**Independent test:** On `juju-bootstrap-machines-process`, nudge one leaf box horizontally within its layer; diagram re-layouts; orthogonal routes and ELK label boxes remain attached; no orphan SVG transforms on node groups.

**Acceptance scenarios:**

1. **Given** an ELK-layered diagram with batch layout applied, **When** I drag a node a small distance and release, **Then** the preview runs ELK again (not box autolayout) and updates routes/labels from the new layout result.
2. **Given** a completed nudge, **When** I inspect the ELK debug overlay, **Then** node bounds match ELK output (no extra preview-only translation).
3. **Given** a nudge that would cross layer boundaries, **When** released, **Then** behavior follows ELK constraint rules (layer index updates per `layerChoiceConstraint` semantics) and the UI shows a clear result (snap or reject — specified in `plan.md`).

---

### User Story 2 — Persist nudges in YAML (Priority: P1)

As an author, I want nudge constraints saved with the frame so reload and export reproduce the same alignment.

**Independent test:** Nudge → Save → hard refresh → same relative alignment and ELK routes (within deterministic layout tolerance).

**Acceptance scenarios:**

1. **Given** a nudged node, **When** I Save in preview, **Then** `meta.elk_nodes.<nodeId>` contains the persisted constraint entries for that node using full ELK option ids as keys.
2. **Given** saved YAML, **When** frame-tree JSON is emitted, **Then** constraints round-trip into the ELK graph builder input.
3. **Given** saved constraints, **When** TS SVG export runs, **Then** export uses the same ELK path (no preview-only overrides).

---

### User Story 3 — Clear / reset alignment hints (Priority: P2)

As an author, I want to reset interactive constraints to return to pure batch layered layout.

**Acceptance scenarios:**

1. **Given** persisted node constraints, **When** I clear ELK alignment overrides (sidebar or per-node action), **Then** the next layout run uses batch strategies and removes stale constraint keys from YAML on save.

---

### User Story 4 — Maintainer verification against elkjs (Priority: P1 — spike)

As a maintainer, I need automated proof that interactive constraints change layout through ELK, not through preview hacks.

**Acceptance scenarios:**

1. **Given** a minimal 3-node layered fixture, **When** a `positionChoiceConstraint` is set and interactive strategies enabled, **Then** elkjs output order/layer differs from batch baseline in a asserted way.
2. **Given** the spike fails (no observable effect), **When** documented, **Then** implementation tasks remain blocked and the spec status moves to **Blocked (elkjs)**.

## Edge Cases

- Compound / section nodes: constraints apply to ELK compound nodes only where hierarchy handling exposes them; leaf nudge is the MVP.
- Multi-select nudge: out of scope for MVP unless trivial.
- Constraints conflicting with DAG layering (would reverse edges): ELK may reject or adjust — surface warning, do not silently corrupt.
- Diagrams with `layout_engine` ≠ `elk-layered`: no alignment mode.
- Undo/redo: nudge should integrate with editor undo stack (stretch P2).

## Requirements

### Functional Requirements

- **FR-001**: Node nudge MUST produce ELK per-node layout options (`layerChoiceConstraint`, `positionChoiceConstraint`, and/or other documented interactive hints validated in spike), not SVG transforms.
- **FR-002**: Re-layout after nudge MUST call the existing ELK TS pipeline (`layoutElkFrameDiagram` / `elkjs`) with interactive layered strategies enabled for the constraint pass.
- **FR-003**: Persisted constraints MUST live in frame YAML under `meta.elk_nodes.<nodeId>`, using full ELK option ids as keys, and load through `frame-yaml-loader.ts`.
- **FR-004**: Save/load MUST round-trip constraints through `/api/overrides` and frame-tree emit identically to sidebar `meta.elk` options.
- **FR-005**: Clearing constraints MUST restore batch-default strategies unless the author explicitly set interactive strategies in sidebar.
- **FR-006**: Export and PNG/SVG paths MUST use constrained ELK input; preview-only state is forbidden.

### Non-Functional Requirements

- **NFR-001**: Nudge → relayout feedback ≤ 500 ms on Juju corpus on dev hardware (debounced like sidebar relayout).
- **NFR-002**: No new Python layout authority; TS owns ELK graph build and layout.
- **NFR-003**: If elkjs interactive support is incomplete, fail closed — do not ship partial SVG alignment.

### Non-Goals

- Full free-form graph editor (arbitrary x/y for all nodes).
- Dragging edge waypoints on ELK diagrams (separate arrow spec).
- Automatic constraint inference from pixel drag without ELK constraint mapping.
- Replacing ELK layered with manual grid autolayout for alignment fixes.

## Persistence sketch (normative direction)

```yaml
meta:
  layout_engine: elk-layered
  elk:
    elk.layered.layering.strategy: INTERACTIVE
    elk.layered.crossingMinimization.strategy: INTERACTIVE
    # ... graph-level ELK options ...
  elk_nodes:
    some_leaf_id:
      elk.layered.layering.layerChoiceConstraint: "2"
      elk.layered.crossingMinimization.positionChoiceConstraint: "1"
```

`meta.elk` remains the graph-level ELK option map. `meta.elk_nodes` is the single canonical per-node constraint map. Exact key names must match ELK option ids; no secondary shorthand key vocabulary is allowed.

## Success Criteria

1. Author can fix a visibly misaligned same-layer box on Juju corpus via nudge + relayout.
2. Save → refresh reproduces alignment without preview-only state.
3. Automated test proves constraint affects elkjs output OR spec is formally blocked with elkjs gap documented.

## Related Work

- ELK sidebar + `meta.elk` persistence (current preview work).
- Spec **006** arrow routing — orthogonal routes remain ELK-owned after alignment.
- Spec **022** authoring AST — compiler must preserve `meta.elk` and `meta.elk_nodes` passthrough when introduced.
