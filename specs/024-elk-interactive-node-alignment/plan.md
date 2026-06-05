# Implementation plan: ELK interactive node alignment

## Goal

Let authors nudge ELK-layered nodes using native ELK interactive constraints, persist those constraints in YAML, and rerun the same TS-owned ELK pipeline used by preview and export.

## Chosen boundary

- TS owns graph building, layout, and engine metadata.
- Python may remain a thin save or transport layer only.
- Interactive preview wiring lands through the extracted ELK controller boundary from spec 026, not through new `editor.js` branches.
- Engine capability exposure lands through the spec 025 preview-engine contract.

## Phase 0 - Feasibility spike

1. Build a minimal layered fixture in package-level tests.
2. Apply graph-level interactive strategies plus per-node constraints from `meta.elk_nodes`.
3. Prove that `elkjs` output changes in an asserted way.
4. If the proof fails, mark the spec blocked and stop implementation.

## Phase 1 - Data contract

1. Preserve `meta.elk_nodes` through the frame model, YAML loader, serializer, and save path.
2. Define the derived runtime DTO without creating a second authority.
3. Ensure save responses return canonical persisted state, not speculative shell mutations.

## Phase 2 - Engine integration

1. Thread `meta.elk_nodes` into the ELK graph builder.
2. Expose interactive alignment capability through the preview-engine manifest.
3. Keep preview relayout and export on the same ELK pipeline.

## Phase 3 - Shell and interaction slice

1. Implement single-node nudge and clear actions through the dedicated ELK controller module.
2. Debounce relayout and surface unsupported-state errors clearly.
3. Do not add new ELK-specific orchestration branches to `editor.js`.

## Phase 4 - Validation

1. Unit-test graph-option lowering and YAML round-trip behavior.
2. Add preview save and reload regression coverage.
3. Browser-check the Juju ELK corpus diagram.
4. Run an adversarial review focused on hidden second-authority risks.

## Deliverables

- `research.md` spike outcome
- `data-model.md` canonical persistence contract
- implementation tasks in `tasks.md`
- focused tests for spike, persistence, relayout, and reload