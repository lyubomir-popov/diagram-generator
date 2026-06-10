# TODO

## Purpose

Active execution queue for `diagram-generator`. All new work targets TypeScript first. Python remains only as a dated parity oracle plus non-product utilities.

**Jira:** This repo is Stream E (constrained editor) under [DE-941](https://warthogs.atlassian.net/browse/DE-941). Milestone-level issues tracked on Jira; detailed execution stays here and in `specs/`. See `diagram-generator-planning` for the broader project (corpus, taxonomy, Coda pages).

## Active TODO

### Priority 1 — Spec-kit tracked work

#### Multi-engine preview architecture (spec 025)

Feature package: `specs/025-multi-engine-preview-architecture/`.

- [x] `[H]` **Define the preview engine contract before more engines land.** Spec 025 is now closed: the preview-engine manifest owns engine bootstrap metadata, `/api/overrides` returns canonical persisted state for save rehydration, and the onboarding path for future engines is documented in `specs/025-multi-engine-preview-architecture/plan.md`.

#### Preview browser test API / shim removal (spec 027)

Feature package: `specs/027-preview-browser-test-api/`.

- [x] `[S]` **Retire spec 026 browser globals.** Closed on `feat/027-preview-browser-test-api`: Playwright now goes through the documented `__DG_TEST_preview` facade, legacy `window.*` save/undo shims are removed from `editor.js`, and static/runtime coverage locks the boundary.

#### Force preview shell convergence (spec 029)

Feature package: `specs/029-force-preview-shell-convergence/`.

- [x] `[S]` **Converge force save / dirty semantics with the preview-shell architecture.** Closed on `feat/029-force-preview-shell-convergence`: force Save now compares the authored payload that will persist to YAML, focused browser coverage locks Save-button enable/disable behavior, and the force-lane boundary is documented without broad controller rewrites.

#### Headingless wrapper contract (spec 036)

Feature package: `specs/036-headingless-wrapper-contract/`.

- [x] `[S]` **Finish spec 036 beyond the initial guard now on `main`.** Closed on `feat/036-headingless-wrapper-contract`: implicit headingless wrappers remain structural-only by default, explicitly authored visible non-headed groups are the bounded supported path, and focused save/reload coverage now locks both behaviors.

#### Preview engine drift closeout (spec 037)

Feature package: `specs/037-preview-engine-drift-closeout/`.

- [x] `[H]` **Close the engine-surface drift called out in the 2026-06-06 architectural review.** Closed on `feat/037-preview-engine-drift-closeout`: hostable frame-engine ids now come from the TS manifest/runtime surface, force save rehydrates from canonical persisted state, forbidden `localStorage` usage is removed from the live preview path, and typed compatibility metadata is in place as groundwork for spec 035.

#### TypeScript authority + Python removal (spec 038)

Feature package: `specs/038-ts-authority-python-removal/`.

- [x] `[H]` **Close the Python-preview retirement and design-foundry prep lane.** Closed on `feat/038-ts-authority-python-removal`: `apps/preview/` is the Node front door, preview/save/watch routes are TS-owned, the product-path Python preview files are deleted, the no-new-Python ratchet is active, and `packages/layout-engine/` now exposes the internal seams needed for the later `design-foundry` package move.

#### Compatible engine switcher (spec 035)

Feature package: `specs/035-compatible-engine-switcher/`.

- [x] `[H]` **Phase 1 complete: Contract + persistence.** Closed on `feat/035-compatible-engine-switcher`: `evaluatePreviewEngineCompatibility()` API implemented, `meta.layout_engine` persistence guard validates full document-kind compatibility (not just hostable-key), document kind is dynamically detected from YAML structure (`sequence:` vs `root:` key), compatible engines list wired into preview config, and 12 persistence + round-trip tests passing.
- [x] `[M]` **Phase 2: Switcher UI + rerender consumer.** Built `scripts/preview/engine-switcher.js` (reads `__DG_CONFIG.compatible_engines`, renders the `#engine-switcher-section` `<select>`, POSTs `{layout_engine}` to `/api/overrides/{slug}`, reloads to re-render via `resolvePreviewEngine`). Round-trip test now genuinely reloads via `loadFrameYaml` + resolves via the registry. Latent `getPreviewEngine`-by-id bug fixed with `getPreviewEngineByLayoutKey`. See `adversarial-review-merge.md` → "Re-review #2 — resolution". The control is now live on frame-diagram docs after the native v3 registration below.
- [x] `[H]` **Register a second grid-mode engine so the switcher becomes visible.** Native v3 autolayout is now a first-class `PreviewEngineManifest` (`id/layoutEngineKey: v3`, `shellMode: grid`, `documentKinds: ['frame-diagram']`). Blank frame-diagram docs resolve to native v3 by default precedence, and the switcher now offers `v3` + `elk-layered` on authored frame diagrams.
- [x] `[L]` **Phase 3: Docs + closeout.** The spec package now documents the live compatibility matrix and future lanes, repo tracking docs are updated, and closeout validation includes registry tests, preview-app contract tests, and browser verification of the visible switcher.

#### Preview shell decomposition + TS migration (spec 026)

Feature package: `specs/026-preview-shell-decomposition-ts-migration/`.

- [x] `[H]` **Decompose `editor.js` into bounded shell modules.** Closed in spec 026: `save-client.js`, `elk-controller.js`, `editor-state.js` + TS `preview-shell/`, shell shrink, and boundary docs in `specs/026-preview-shell-decomposition-ts-migration/boundaries.md`. `layout-bridge.js` ownership unchanged; future runtime-bridge slices are documented there, not scheduled here.

#### ELK interactive node alignment (spec 024)

Feature package: `specs/024-elk-interactive-node-alignment/`.

- [ ] `[H]` **Keep spec 024 fail-closed on `main`.** The plain-`elkjs` interactive route did not survive the live Juju graph check. Preserve the spec summary on `main`; keep any deeper exploration on a separate branch; if revisited, test upstream Java ELK before more shell/controller work.

#### ELK force core port (branch-only additive lane)

- [ ] `[H]` **Port the ontology's second-highest-demand ELK engine as an additional core package path.** The planning ontology ranks `elk-force` behind `elk-layered`; the first bounded core slice is now in `packages/graph-layout-elk` with `layoutForceForFamily()`. Next: expose it as an additive `elk-force` preview engine alongside the existing D3/quadtree `force` lane, not as a replacement for that engine.

#### Sequence layout (spec 030)

Feature package: `specs/030-sequence-layout/`.

- [x] `[H]` **Spec 030 v1 closed.** The first direct Mermaid-heavy port is live as a TS-owned sequence lane under specs 025 and 026, with the active corpus-backed reference image visible in Input and Both for fidelity checks. Unsupported activation bars remain explicit follow-up work rather than shell patches.

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

#### Diagram authoring AST (spec 022)

Feature package: `specs/022-diagram-authoring-ast/`.

- [x] `[H]` **Spec 022 v1 closed.** Compiler, validation, lowering via `loadFrameYaml`, Mermaid + D2 export, docs, and migration CLI are landed.

#### Arrow routing redesign (spec 006)

Feature package: `specs/006-arrow-routing-redesign/`.

- [ ] `[H]` **Keep spec 006 parked as the next major routing slice.** Entire routing redesign plan remains open; not blocking the current editor work.

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

Full audit: `docs/architecture/adversarial-audit-2026-05-27.md`.

- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`.
- [ ] `[S]` **M6. `estimate_line_width` duplicated.** `diagram_shared.py` vs `text_metrics.py`.

### Lower priority

- [ ] `[M]` Arrow routing tests
- [ ] `[S]` Constrained re-measurement tests
- [ ] `[S]` Layout idempotency test
- [ ] `[S]` Negative parser tests for invalid enums
- [ ] `[M]` Forward ontology — auto-select engine from `diagram_type` + `layout_engine`
- [ ] `[L]` Security hardening before Stage 17
- [ ] `[S]` Swappable engine interface — Phase 3+
- [ ] `[S]` Constraint enforcement on force nodes
- [x] `[S]` **Force preview: multi-select unpin should apply to every selected node.** Inspector shows Pin all / Unpin all for multi-select; `applyPinToNodes()` updates every selected node.
- [x] `[S]` **Force preview: unpinned nodes revert to pinned after Save/Reload.** Runtime clears authored `fx`/`fy` on unpin; Save always posts exported snapshot to YAML.
- [ ] `[S]` Arrow waypoint editing / endpoint attachment
- [ ] `[S]` Consistent stroke/outline weight
- [ ] `[S]` Force → frame YAML round-trip
- [ ] `[L]` Grid overlay toggle (W) for force preview
- [ ] `[L]` Double-click depth cycling for force nodes
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear
