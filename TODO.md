# TODO

## Purpose

Active execution queue for `diagram-generator`. All new work targets TypeScript first. Python remains only in the retained draw.io lane.

**Jira:** This repo is Stream E (constrained editor) under [DE-941](https://warthogs.atlassian.net/browse/DE-941). Milestone-level issues tracked on Jira; detailed execution stays here and in `specs/`. See `diagram-generator-planning` for the broader project (corpus, taxonomy, Coda pages).

## Active TODO

### Priority 1 — Spec-kit tracked work

#### Compatible engine switcher (spec 035)

Feature package: `specs/035-compatible-engine-switcher/`.

- [ ] `[H]` **ELK layered drops headings and icons on parent containers.** Headed panels (e.g. Planning / Implementation / Delivery in `complex-routing-usecase`) lose title + icon treatment under `elk-layered`; headers should remain in the container chrome ELK lays out. Investigate, draft spec-kit fix package, add tier-2 flow map. Reported via inbox 2026-06-12.
- [ ] `[H]` **ELK layered ignores authored sizing semantics (`FILL` / `HUG` / `FIXED`) on switched frame diagrams.** Switching a valid frame diagram from `v3` to `elk-layered` can collapse equal-width stacks into uneven measured widths because `layoutElkFrameDiagram()` currently measures nodes and hands ELK concrete box sizes instead of preserving authored sizing behavior end-to-end. Investigate on the support-escalation example and `tiered-network-architecture`; decide the TS-owned contract for how ELK should honor or coerce sizing per axis. Reported via inbox 2026-06-13.

#### Diagram typography token cleanup (spec 039)

Feature package: `specs/039-diagram-typography-token-cleanup/`.

- [ ] `[H]` **Review, tighten, and execute spec 039.** Draft was written by a lower-tier model — audit against live TS engine + `DIAGRAM.md`, update spec/tasks for accuracy, then shrink dead typography tokens to `diagram-body` + `diagram-heading-1` and remove unused constants. Reported via inbox 2026-06-12.

#### ELK interactive node alignment (spec 024)

Feature package: `specs/024-elk-interactive-node-alignment/`.

- [ ] `[H]` **Keep spec 024 fail-closed on `main`.** The plain-`elkjs` interactive route did not survive the live Juju graph check. Preserve the spec summary on `main`; keep any deeper exploration on a separate branch; if revisited, test upstream Java ELK before more shell/controller work.

#### ELK force core port (branch-only additive lane)

- [ ] `[H]` **Port the ontology's second-highest-demand ELK engine as an additional core package path.** The planning ontology ranks `elk-force` behind `elk-layered`; the first bounded core slice is now in `packages/graph-layout-elk` with `layoutForceForFamily()`. Next: expose it as an additive `elk-force` preview engine alongside the existing D3/quadtree `force` lane, not as a replacement for that engine.

#### Proposed next layout spec-kit packages

- [ ] `[H]` **`specs/031-state-machine-layout/` — branded state/lifecycle layout.** Target Mermaid `stateDiagram-v2` parity with Canonical typography, left-aligned labels, clear transition routing, and compound-state handling. Ontology: `state_and_lifecycle` is a confident keep.
- [ ] `[H]` **`specs/032-tree-mindmap-layout/` — tidy tree and mindmap layout.** Cover Mermaid `mindmap`-style and tree-form concept maps with branded node treatment, left-aligned text, and controllable branch spacing. Ontology: `concept_and_relationship_mapping` explicitly wants tree-form alternatives.
- [ ] `[H]` **`specs/033-swimlane-workflow-layout/` — lane-based workflow layout.** Bring a branded lane layout to process diagrams that currently stretch box layout. Target Mermaid-heavy engineering usage around flowcharts, subgraphs, and journey-like procedural flows. Ontology: `process_and_workflow` is high-volume and currently defers swimlanes.
- [ ] `[H]` **`specs/034-er-class-orthogonal-layout/` — branded ER/class relationship layout.** Support Mermaid-adjacent `erDiagram` / `classDiagram` usage with left-aligned entity text, orthogonal connectors, cardinality labels, and schema-friendly grouping. Ontology: `data_model_and_relationships` is smaller but structurally distinct and currently underserved.

#### Folder-backed editor app + nav unification (new spec needed)

- [ ] `[H]` **Draft a spec-kit package for a folder-backed editor app shell.** The preview should open a user-chosen diagram folder, populate the left nav from that folder instead of the fixed test list, and remove the duplicate diagram picker UI in favor of one coherent sidenav-driven navigation model.

#### Shared preview-shell chrome consistency (new spec needed)

- [ ] `[M]` **Draft a spec-kit package for shell-chrome consistency across Input / Output / Both.** Shared preview UI chrome should not disappear per engine or per missing reference image; unavailable content should degrade with placeholders, not by trimming shell affordances. Preserve the existing editor demo structure and replace ad hoc preview-app CSS with Baseline Foundry-owned styling rather than inventing new UI.

#### Cross-engine multi-select align/distribute + bulk pin actions (new spec needed)

- [ ] `[H]` **Draft a new spec-kit package for multi-select align/distribute and bulk pin/unpin.** Investigate force first, then whether ELK can support the same UX through native constraints. Keep this separate from spec 024 unless the investigation proves the same data contract and controller shape can serve both.

#### PNG export (spec 018)

Feature package: `specs/018-png-export/`.

- [ ] `[H]` **Build the TS-SVG-to-PNG export path.** Add the CLI/server raster path, preview Save PNG action, and validation for Windows/WSL behavior.

#### Arrow routing redesign (spec 006)

Feature package: `specs/006-arrow-routing-redesign/`.

- [ ] `[H]` **Close the remaining spec 006 review follow-ups on this branch.** Browser router convergence is done; remaining major gaps are the full route-aware gap classifier (T080/T081), arrow dependency ordering + cycle diagnostics (T094), and moving final arrow geometry ownership out of the renderer path (T050-T052 / FR-005).
- [ ] `[H]` **Arrow routing breaks when container direction flips vertical ↔ horizontal.** v3 router convergence works in one orientation; inspector direction changes leave stale or wrong arrow geometry. Owner: spec 006 (`arrow-routing.ts`, `layout-bridge.js` patchArrowsSvg). Reported via inbox 2026-06-12.

### Priority 2 — Standalone items

#### Top-level containers should default to FILL sizing

- [ ] `[M]` **Annotations and other top-level containers still default to HUG** instead of FILL, so they don't land on the grid.

#### Root element editable width/height

- [ ] `[S]` **Make root element width/height editable in the inspector.** Options: explicit value | HUG.

#### Code quality — adversarial audit items

#### Root direction change should reset children sizing to hug

- [ ] `[M]` **Switching root `direction` vertical→horizontal leaves top-level children as FILL on the old axis.** They should reset to HUG so authors re-opt in. Fix in the preview inspector direction handler (`editor.js`) and optionally in `apps/preview/src/persistence/frame-diagram.ts` when `direction` is saved on `page`. Reported during a preview editor pass on 2026-06-04.
- [ ] `[H]` **Add drag-and-drop reordering in the layers palette.** Needed to repair cases like `complex-routing-usecase` where an absolute-positioned overlay (`dev team`) should be a separate protruding layer rather than living inside the wrong container.
- [ ] `[M]` **Absolute-positioned items resize incorrectly from the left edge.** Left-edge resize currently expands the right side instead of moving the left boundary.
- [ ] `[M]` **Wrapped text in the parent variant loses consistent heading styling across lines.** A parent-frame line that wraps to two visual lines currently renders the first line bold and the second line non-bold; both lines should carry the same resolved style.

- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`.

### Lower priority

- [ ] `[M]` Arrow routing tests
- [ ] `[S]` Constrained re-measurement tests
- [ ] `[S]` Layout idempotency test
- [ ] `[S]` Negative parser tests for invalid enums
- [ ] `[M]` Forward ontology — auto-select engine from `diagram_type` + `layout_engine`
- [ ] `[L]` Security hardening before Stage 17
- [ ] `[S]` Swappable engine interface — Phase 3+
- [ ] `[S]` Constraint enforcement on force nodes
- [ ] `[S]` Arrow waypoint editing / endpoint attachment
- [ ] `[S]` Consistent stroke/outline weight
- [ ] `[S]` Force → frame YAML round-trip
- [ ] `[L]` Grid overlay toggle (W) for force preview
- [ ] `[L]` Double-click depth cycling for force nodes
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear
