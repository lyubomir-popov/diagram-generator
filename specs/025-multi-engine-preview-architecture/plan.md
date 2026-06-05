# Implementation Plan: Multi-engine preview architecture

## Goal

Introduce a typed engine-integration contract so the preview shell can host multiple engine-backed packages without accumulating per-engine logic in `editor.js`.

## Approach

### Phase 1 - Define the engine contract (P1)

1. Define the preview-engine manifest/capability interface.
   - engine id
   - supported preview modes
   - control schema source
   - relayout/save hooks
   - optional debug / raw-view capabilities
2. Decide how the preview server obtains TS-owned engine metadata.
   - preferred direction: Node helper or generated JSON from TS authority
   - avoid Python-authored mirrors

### Phase 2 - Canonical state and runtime identity (P1)

1. Standardize save responses for engine-backed diagrams.
   - POST returns canonical persisted engine state or canonical frame-tree payload
2. Add preview runtime identity surface for repo root / branch / frames dir / PID / port.

### Phase 3 - Migrate existing engines onto the contract (P1)

1. Move ELK control metadata to the single TS-owned authority path.
2. Register ELK preview behavior through the new engine contract.
3. Register force preview behavior through the same contract shape where possible.

### Phase 4 - Prove extensibility (P2)

1. Add a documented example path for onboarding a future engine package.
2. Confirm that no new engine-specific shell logic lands outside the registry/bootstrap boundary.

## Architecture constraints

- YAML remains the authored source of truth.
- TypeScript owns engine metadata and runtime behavior.
- Python stays a thin preview-server and persistence layer.
- No big-bang preview rewrite in this spec.

## Validation gates

1. ELK preview controls are sourced from one TS authority.
2. Save flows rehydrate from canonical persisted server state.
3. Runtime identity endpoint or equivalent is available.
4. Existing ELK and force preview paths remain green.

## Risks

| Risk | Mitigation |
| --- | --- |
| Preview shell contract grows too abstract before two engines truly share it | Start from ELK + force only; generalize only where both need it |
| Python regains authority through convenience mirrors | Make TS manifest export the only approved source for engine metadata |
| Save response changes ripple through preview tests | Introduce the contract behind focused regression coverage first |
