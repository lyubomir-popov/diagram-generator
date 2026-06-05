# Research: force runtime boundary

## Decision

Use a browser-owned TypeScript runtime for force simulation and state authority.

## Why this is the shortest correct path

- `scripts/preview/force.js` already owns stage rendering, selection, drag, resize, undo/redo wiring, export assembly, and the BF-shell interaction model.
- The missing piece is the state and simulation authority behind the `/api/force/*` endpoints.
- The repo does not currently expose an existing TypeScript force runtime or `d3-force` dependency to slot into preview-server immediately.
- Replacing the deleted Python backend with another server-held session layer would deepen the wrong abstraction. The preview server should serve canonical YAML-backed data through derived JSON DTOs plus reference images, not own force graph state or a second authored spec format.

## Consequences

- The next implementation step should move force-spec loading, simulation ticking, pin/unpin, parameter updates, and save/export state into a TS/browser module consumed by the force preview.
- `preview_server.py` should shrink to static serving for YAML-backed force DTOs, reference images, and any thin save endpoint that remains necessary during migration.
- `benchmark_force.py` becomes legacy and should be removed or replaced once the TS runtime exists.

## Rejected alternative

### Thin TS-backed preview-server wrappers

Rejected for now because it preserves the old server-session architecture and adds more plumbing before the actual runtime exists. The browser already owns the live interaction loop, so keeping simulation local is the simpler and more faithful replacement.