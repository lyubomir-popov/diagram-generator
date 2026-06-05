# TODO

## Purpose

Active execution queue for `diagram-generator`. All new work targets TypeScript first. Python receives matching changes only for batch/export correctness.

**Jira:** This repo is Stream E (constrained editor) under [DE-941](https://warthogs.atlassian.net/browse/DE-941). Milestone-level issues tracked on Jira; detailed execution stays here and in `specs/`. See `diagram-generator-planning` for the broader project (corpus, taxonomy, Coda pages).

## Active TODO

### Priority 1 — Spec-kit tracked work

#### Multi-engine preview architecture (spec 025)

Feature package: `specs/025-multi-engine-preview-architecture/`.

- [x] `[H]` **Define the preview engine contract before more engines land.** Spec 025 is now closed: the preview-engine manifest owns engine bootstrap metadata, `/api/overrides` returns canonical persisted state for save rehydration, and the onboarding path for future engines is documented in `specs/025-multi-engine-preview-architecture/plan.md`.

#### Preview shell decomposition + TS migration (spec 026)

Feature package: `specs/026-preview-shell-decomposition-ts-migration/`.

- [ ] `[H]` **Decompose `editor.js` into bounded shell modules.** Save/reload lives in `save-client.js` (T010); ELK controller wiring lives in `elk-controller.js` (T011). Next slice: shared editor state container (T012).

#### ELK interactive node alignment (spec 024)

Feature package: `specs/024-elk-interactive-node-alignment/`.

- [ ] `[H]` **Spec drafted; implementation blocked on elkjs interactive-constraint spike and spec 025 / 026 prerequisite slices.** Native ELK only: nudge → `layerChoiceConstraint` / `positionChoiceConstraint` → persist under `meta.elk_nodes` → re-run layered with INTERACTIVE strategies. No SVG translate hacks or new `editor.js` branches.

#### PNG export (spec 018)

Feature package: `specs/018-png-export/`.

- [ ] `[H]` **Build the TS-SVG-to-PNG export path.** Add the CLI/server raster path, preview Save PNG action, and validation for Windows/WSL behavior.

#### Diagram authoring AST (spec 022)

Feature package: `specs/022-diagram-authoring-ast/`.

- [ ] `[H]` **Continue the authoring compiler after the preview-architecture slices.** The scaffolding is landed; next work is edges, layout grammar, defaults, validation, lowering, and exporters.

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

- [ ] `[M]` **Switching root `direction` vertical→horizontal leaves top-level children as FILL on the old axis.** They should reset to HUG so authors re-opt in. Fix in the preview inspector direction handler (`editor.js`) and optionally in `frame_yaml_persistence.py` when `direction` is saved on `page`. Reported during a preview editor pass on 2026-06-04.
- [ ] `[H]` **Add drag-and-drop reordering in the layers palette.** Needed to repair cases like `complex-routing-usecase` where an absolute-positioned overlay (`dev team`) should be a separate protruding layer rather than living inside the wrong container.
- [ ] `[M]` **Absolute-positioned items resize incorrectly from the left edge.** Left-edge resize currently expands the right side instead of moving the left boundary.
- [ ] `[M]` **Wrapped text in the parent variant loses consistent heading styling across lines.** A parent-frame line that wraps to two visual lines currently renders the first line bold and the second line non-bold; both lines should carry the same resolved style.

Full audit: `docs/architecture/adversarial-audit-2026-05-27.md`.

- [ ] `[M]` **M2. `ARROW_CLEARANCE` 3x defined (8/8/12).** Fix: one canonical value.
- [ ] `[M]` **M4. Silent enum fallbacks.** Bad `sizing`/`direction`/`align`/`variant` silently default. Fix: warn on unknown values.
- [ ] `[M]` **M5. Preview JSON contract stale.** Missing `justify`, `col_span`.
- [ ] `[S]` **M6. `estimate_line_width` duplicated.** `diagram_shared.py` vs `text_metrics.py`.
- [ ] `[M]` **Preview shell grows by engine branch instead of contract.** Spec 025 must land before additional engine packages are integrated into the live preview.
- [ ] `[M]` **`editor.js` monolith blocks multi-engine growth.** Spec 026 should extract save/orchestration and engine controller slices before more preview engines arrive.
- [ ] `[L]` **Legacy Python parity harness drift.** `scripts/test_parity.py` still reconstructs the pre-WS3 heading/body model, so full `pytest scripts -q` has 5 stale failures. Either realign it with the current loader contract or retire it as a non-gating legacy oracle; do not block TS work on it.

### Lower priority

- [ ] `[M]` Arrow routing tests
- [ ] `[S]` Constrained re-measurement tests
- [ ] `[S]` Layout idempotency test
- [ ] `[S]` Negative parser tests for invalid enums
- [ ] `[M]` Forward ontology — auto-select engine from `diagram_type` + `layout_engine`
- [ ] `[S]` `preview_server.py` decomposition (post-port)
- [ ] `[L]` Security hardening before Stage 17
- [ ] `[S]` `EditorState` container — replace 40+ globals
- [ ] `[S]` Swappable engine interface — Phase 3+
- [ ] `[S]` Constraint enforcement on force nodes
- [ ] `[S]` Arrow waypoint editing / endpoint attachment
- [ ] `[S]` Consistent stroke/outline weight
- [ ] `[S]` Force → frame YAML round-trip
- [ ] `[L]` Grid overlay toggle (W) for force preview
- [ ] `[L]` Double-click depth cycling for force nodes
- [ ] `[S]` Keep refining `DIAGRAM.md` as more diagram types appear
