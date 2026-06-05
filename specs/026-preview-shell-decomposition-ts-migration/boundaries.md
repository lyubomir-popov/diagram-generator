# Preview shell boundaries (spec 026)

Audit date: 2026-06-06

This document freezes ownership after the first shell extraction slices (T010–T030). It covers the Phase 1 audits (T001–T003) and the post-slice layout-bridge reassessment (T031).

## Layer model

```text
viewer-unified.html
  ├─ save-client.js          persistence orchestration (shell)
  ├─ editor-state.js         undo/dirty adapter (shell → TS store)
  └─ MODE_SCRIPTS
       ├─ layout-engine.js  TS runtime bundle (authority)
       ├─ elk-layout-controls.js / elk-controller.js / force.js  engine lanes
       ├─ layout-bridge.js   JSON ↔ LayoutEngine ↔ SVG (runtime bridge)
       ├─ component-model.js / constraints.js
       └─ editor.js          coordinator + inspector + interaction (shell)
```

| Layer | Owner | Owns |
| --- | --- | --- |
| **Shell coordinator** | `editor.js` | Bootstrap, selection/inspector UI, pointer/keyboard interaction, grid control DOM, `loadSVG()` orchestration |
| **Save client** | `save-client.js` | Dirty tracking, override POST, post-save reload, Save SVG export |
| **Editor state** | `editor-state.js` + `packages/layout-engine/src/preview-shell/` | Undo/redo stacks, dirty snapshot serialization, pending grid action |
| **Engine controllers** | `elk-controller.js`, `force.js` | Engine-specific panel wiring, relayout requests, manifest discovery |
| **Runtime bridge** | `layout-bridge.js` | Frame-tree JSON cache, override application into `FrameDiagram`, local/ELK relayout, SVG render/patch pipeline, text-adapter init |
| **TS authority** | `packages/layout-engine/` | Layout, measure, SVG export primitives, preview-engine manifest, editor snapshot/undo store |

## `editor.js` extraction map (T001)

| Responsibility | Status | Module |
| --- | --- | --- |
| Save/reload orchestration | Extracted | `save-client.js` |
| ELK sidebar wiring | Extracted | `elk-controller.js` |
| Undo/redo + dirty snapshots | Extracted | `editor-state.js` + TS `preview-shell/` |
| Inline state wrappers | Removed (T030) | Direct `EditorState` / `PreviewSaveClient` calls |
| Inspector rendering | **Stays** in `editor.js` | Future slice if needed |
| Selection + drag/resize | **Stays** in `editor.js` | Uses `InteractionManager` + `ComponentModel` |
| Grid control DOM | **Stays** in `editor.js` | Reads/writes `model.gridOverrides` |
| `loadSVG()` pipeline | **Stays** as coordinator | Delegates render to `layout-bridge.js`, save to `save-client.js` |

`editor.js` is no longer the home for new engine-specific branches or persistence/state logic.

## `layout-bridge.js` reassessment (T002 / T031)

`layout-bridge.js` (~2.2k lines) is the **client runtime bridge**, not part of the preview shell. It must not import or reference shell modules (`PreviewSaveClient`, `EditorState`, `ElkPreviewController`).

### Keep in `layout-bridge.js`

1. **Deserialization** — `deserializeFrame`, `deserializeFrameDiagram` (server JSON → `LayoutEngine.FrameDiagram`)
2. **Override application** — `applyOverridesToFrameTree`, linked-root grid spacing helpers
3. **Relayout** — `performLocalRelayout`, `performElkRelayout`, readiness/status helpers
4. **Fresh render** — `renderFreshSvg`, `renderFrameTreeToSvg`, icon fetch/build
5. **Incremental SVG patch** — `patchSvgFromLayout`, `patchFrameGroup`, arrow routing/patch
6. **Model sync** — `updateComponentModelFromLayout`, `syncArrowsInModel`, frame-tree removal helpers
7. **Bridge state** — `_frameTreeJson` cache, HarfBuzz text adapter, ELK debug/raw view overlays

### Does not belong in `layout-bridge.js`

| Concern | Owner |
| --- | --- |
| Dirty tracking / save POST | `save-client.js` |
| Undo/redo | `editor-state.js` + TS store |
| ELK panel DOM | `elk-controller.js` + `elk-layout-controls.js` |
| Engine manifest discovery | TS `preview-engine/` |
| Inspector / selection UI | `editor.js` |

### Deferred follow-ups (not in spec 026 scope)

These are reasonable future slices but **out of scope** for the current shell decomposition milestone:

- Port `applyOverridesToFrameTree` and deserialization to TS (share with batch export path)
- Split SVG DOM assembly from layout orchestration (`svg-render-bridge.js` candidate)
- Move ELK debug/raw overlay rendering closer to the ELK controller lane
- Collapse duplicate override-key lists shared by `renderFreshSvg` and `performLocalRelayout`

No layout-bridge rewrite was performed in spec 026; boundaries are documented so later work does not re-tangle shell and runtime concerns.

## Target module map (T003)

| Module | Role |
| --- | --- |
| `editor.js` | Thin shell coordinator |
| `save-client.js` | Persistence client |
| `editor-state.js` | Shell adapter for TS editor state store |
| `elk-controller.js` | ELK engine controller host |
| `elk-layout-controls.js` | ELK panel DOM (manifest-driven) |
| `force.js` | Force engine controller + simulation UI |
| `layout-bridge.js` | Runtime bridge (unchanged ownership) |
| `component-model.js` | In-memory component tree + overrides |
| `constraints.js` | Validation registry |
| `packages/layout-engine/src/preview-shell/` | TS snapshot + undo store |
| `packages/layout-engine/src/preview-engine/` | TS engine manifest |

## Validation

Boundary regressions: `scripts/test_preview_layout_bridge_boundaries.py`, plus the spec 026 shell suite documented in `tasks.md`.
