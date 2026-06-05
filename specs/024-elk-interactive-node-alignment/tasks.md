# Tasks: ELK interactive node alignment

**Prerequisites**: `spec.md`, `research.md`, `data-model.md`, `plan.md`

**Guardrail**: Stop after Phase 0 if `elkjs` does not show an observable response to the documented interactive constraints. Do not implement a preview-side SVG fallback.

## Phase 0 - Feasibility spike

- [ ] T001 Add a minimal layered fixture under the ELK package tests for interactive-constraint experiments.
- [ ] T002 Thread graph-level interactive strategies plus `meta.elk_nodes` constraints into the fixture's ELK input.
- [ ] T003 Assert that `elkjs` output changes in a deterministic, observable way because of the constraints.
- [ ] T004 If T003 fails, update `research.md` and mark the spec blocked instead of continuing.

## Phase 1 - Data contract

- [ ] T010 Add `meta.elk_nodes` passthrough to the TS frame model and YAML loader.
- [ ] T011 Add serializer and save-path support for canonical `meta.elk_nodes` round-trip behavior.
- [ ] T012 Ensure partial saves merge per-node constraints without dropping unrelated entries.
- [ ] T013 Expose a derived runtime DTO for `meta.elk_nodes` without creating a second authority.

## Phase 2 - Engine integration

- [ ] T020 Thread `meta.elk_nodes` into the ELK graph builder as per-node ELK layout options.
- [ ] T021 Add or extend focused tests proving graph-level and per-node options both reach `elkjs`.
- [ ] T022 Register interactive alignment capability through the preview-engine manifest from spec 025.
- [ ] T023 Keep export and preview relayout on the same constrained ELK pipeline.

## Phase 3 - Shell/controller slice

- [ ] T030 Implement single-node nudge handling through the extracted ELK controller boundary from spec 026.
- [ ] T031 Implement clear or reset handling for a node's interactive constraints.
- [ ] T032 Debounce relayout and surface unsupported or rejected nudges clearly.
- [ ] T033 Prove no new ELK-specific orchestration branch was added to `editor.js`.

## Phase 4 - Validation and close-out

- [ ] T040 Add preview save and reload regression coverage for `meta.elk_nodes`.
- [ ] T041 Browser-check `juju-bootstrap-machines-process` for nudge, save, reload, and export parity.
- [ ] T042 Run adversarial review focused on persistence authority, shell drift, and export parity.
- [ ] T043 Update `docs/specs.md`, `TODO.md`, `STATUS.md`, and `HISTORY.md` when the feature lands.