# Implementation Plan: Preview shell decomposition and TypeScript migration

## Goal

Turn the preview shell from a monolithic legacy JS surface into a thin coordinator over typed modules, without destabilizing the live editor through a big-bang rewrite.

## Approach

### Phase 1 - Define target boundaries (P1)

1. Audit `editor.js`, `layout-bridge.js`, and neighboring preview files by responsibility.
2. Freeze the target module boundaries for:
   - save/persistence client
   - engine controller host
   - inspector renderer
   - selection/undo state container
   - interaction controllers

### Phase 2 - Extract low-risk shell slices (P1)

1. Move save/reload orchestration into its own module.
2. Move ELK controller wiring behind a dedicated controller module.
3. Move shared shell state helpers into a dedicated state container.

### Phase 3 - TS-first migration of non-DOM logic (P1)

1. Introduce TS-owned browser modules for extracted logic.
2. Keep a thin JS bootstrap only where required during the transition.
3. Ensure tests cover the new boundaries.

### Phase 4 - Shrink the legacy shell (P2)

1. Remove now-obsolete inline helpers from `editor.js`.
2. Re-assess whether `layout-bridge.js` should share the same module boundary work.
3. Update docs/TODO once the shell boundary is stable enough for subsequent engine integrations.

## Architecture constraints

- No big-bang preview rewrite.
- TypeScript first for substantial logic.
- Preserve existing preview routes and pages while the migration is underway.

## Validation gates

1. Extracted subsystems keep current preview regressions green.
2. Engine-specific logic is visibly reduced in `editor.js`.
3. New preview logic lands in TS-owned modules, not back in the monolith.

## Risks

| Risk | Mitigation |
| --- | --- |
| Migration pauses halfway, leaving worse indirection | Extract complete bounded slices with tests, one at a time |
| DOM-heavy code resists TS porting | Move view-model/state/controller logic first; leave thin event hookup in JS temporarily |
| Layout-bridge/editor ownership gets muddier | Define boundaries explicitly before extraction |
