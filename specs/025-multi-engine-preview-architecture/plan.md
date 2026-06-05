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

## Future engine onboarding path

When adding a new preview engine package, use this sequence:

1. Add a `PreviewEngineManifest` entry under `packages/layout-engine/src/preview-engine/registry.ts`.
   - Declare `id`, `shellMode`, optional `layoutEngineKey`, capability flags, `controlSpecs`, `scripts`, and any `apiRoutes`.
2. Export any engine-owned control schema from TypeScript.
   - Browser shell code should read those control specs through `LayoutEngine.getPreviewEngine()` or the generated manifest, not from duplicated JS/Python tables.
3. Ensure `npm --prefix packages/layout-engine run build:browser` emits the new engine in `dist/preview-engine-manifest.json`.
4. If the engine has preview scripts, load them through the manifest-owned `scripts` list.
   - Do not hardcode new engine script tags in `viewer-unified.html`.
   - Do not hardcode new engine script branches in `preview_server.py` beyond shared bootstrap wiring.
5. If the engine participates in save, route the client through manifest-owned `apiRoutes` and keep `/api/overrides` or the engine save route authoritative for canonical persisted state.
6. Add focused coverage.
   - TS: registry/control-schema tests.
   - Python: manifest export / preview HTML injection / route contract tests.
7. Verify `editor.js` stays thin.
   - New engine behavior belongs in manifest metadata, engine-owned browser modules, or typed runtime surfaces — not in new engine-specific business logic branches inside `editor.js`.

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
