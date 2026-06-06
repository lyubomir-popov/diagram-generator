# Implementation Plan: Force preview shell convergence

## Goal

Converge the force preview lane with the preview-shell architecture from specs 025 and 026 without reopening a broad force controller rewrite.

## Summary

The immediate force save-button regression is already fixed locally. The follow-up now needs to capture that fix as architecture, not leave it as an isolated patch. This spec turns the next work into a bounded shell-convergence slice: unify force dirty/save semantics with the preview-shell direction, add regression coverage, and document the boundary so composer does not attempt a free-form rewrite.

## Technical Context

| Item | Detail |
| --- | --- |
| **Force controller** | `scripts/preview/force.js` |
| **Preview shell patterns** | `scripts/preview/save-client.js`, `editor-state.js`, TS `preview-shell/` |
| **Runtime authority** | `packages/layout-engine/src/force-runtime.ts`, preview-engine manifest |
| **Persistence path** | `/api/force-save/<slug>` → YAML in `scripts/diagrams/force/*.yaml` |
| **Architecture guardrails** | spec 025 complete, spec 026 complete |

## Approach

### Phase 1 - Freeze the delegation boundary (P1)

1. Audit the current force save / dirty behavior and write down the owning surfaces.
2. Record what composer may change safely:
   - shell-side dirty-state comparison
   - save-button wiring
   - focused tests
   - boundary docs
3. Record what stays local-only:
   - force runtime semantics
   - YAML schema or export rules
   - broad force controller to TS migration

### Phase 2 - Converge force save / dirty semantics (P1)

1. Replace any force-only dirty bookkeeping with shared preview-shell semantics or a documented serialized-state comparison model.
2. Keep Save wired to canonical exported runtime state only.
3. Ensure Save-button state is recomputed from current unsaved state rather than manual toggles.

This phase is safe for composer because it is local, mechanical, and bounded.

### Phase 3 - Lock regression coverage (P1)

1. Add or extend focused tests for force save-button enable / disable behavior.
2. Keep the existing force preview API tests green.
3. Prefer narrow browser or controller-level regression coverage over broad suite churn.

This phase is also safe for composer if the spec remains the only source of truth.

### Phase 4 - Document the remaining debt honestly (P2)

1. Update boundary docs to say force preview still has legacy JS controller debt.
2. Explicitly defer the larger TypeScript controller migration to a future local-orchestrated spec if it is still wanted.

## Architecture constraints

- No new persistence authority besides YAML.
- No new engine-specific `editor.js` logic.
- No broad `force.js` rewrite hidden inside a small task.
- No change to TS runtime pin/export semantics in this slice.

## Composer-safe task shape

Composer may be used only for:

1. narrow shell-side dirty/save convergence inside `scripts/preview/force.js`
2. focused regression tests for that behavior
3. boundary-document updates tied directly to those changes

Composer should not be used for:

1. refactoring the full force controller structure
2. designing a new preview-shell abstraction without local review first
3. any runtime or YAML contract change

## Validation gates

```bash
python -m pytest scripts/test_preview_force_api.py -q
npm --prefix packages/layout-engine test -- tests/force-runtime.test.ts
# add a focused force save-button regression once implemented
```

## Risks

| Risk | Mitigation |
| --- | --- |
| Small shell cleanup turns into controller rewrite | Freeze delegation boundary in tasks and spec text |
| Force lane grows a second save contract | Require canonical YAML save path and no browser storage |
| Browser-only behavior regresses silently | Add focused save-button regression coverage |

## Project Structure

```text
specs/029-force-preview-shell-convergence/
├── spec.md
├── plan.md
└── tasks.md
```