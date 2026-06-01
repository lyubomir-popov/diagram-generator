# Implementation Plan: Client-side TypeScript rendering

**Branch**: `feat/009-client-side-ts-rendering` | **Date**: 2026-06-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-client-side-ts-rendering/spec.md`

## Summary

Replace the Python-rendered SVG in the preview editor with a fully client-side TS rendering pipeline. Today's first load fetches Python SVG (which lacks small caps and OpenType features), then conditionally patches it with TS layout only when overrides exist. The new flow initialises HarfBuzz + the TS layout engine first, runs `resolveStyles()` → `layoutFrameTree()` → `renderFrameTreeToSvg()` entirely in the browser, and sets the resulting SVG as the first and only paint. The Python renderer stays untouched for batch/export use. The change is scoped to three files – `layout-bridge.js`, `editor.js`, and `preview_server.py` (icon + overlay API additions only).

## Technical Context

**Language/Version**: JavaScript (browser ES2020+), Python 3.11+ (server, unchanged except new API endpoints)

**Primary Dependencies**: TS layout engine (`packages/layout-engine` → IIFE bundle at `/preview/layout-engine.js`), HarfBuzz WASM (`/preview/harfbuzz.wasm`), Ubuntu Sans Variable TTF (`/preview/layout-font.ttf`)

**Storage**: N/A (frame YAML read by Python server, served as JSON)

**Testing**: `npm --prefix packages/layout-engine test` (198 TS tests), `python -m pytest scripts/test_frame_loader.py scripts/test_autolayout.py scripts/test_layout_v3.py scripts/test_parity.py scripts/test_frame_classes.py scripts/test_style_parity.py scripts/test_frame_yaml_persistence.py -q` (271 Python tests), browser verification of all 23 diagrams

**Target Platform**: Browser (Chrome/Firefox, localhost preview server)

**Project Type**: Developer tool (diagram preview editor)

**Performance Goals**: First visible SVG under 2 seconds on a typical dev machine (including HarfBuzz + font loading)

**Constraints**: Python renderer must remain fully functional for batch export. No changes to `packages/layout-engine/` TS source. No changes to editor interaction code (select, drag, resize, save, undo).

**Scale/Scope**: 23 existing frame YAML diagrams, 3 files changed, 2 new server endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Anti-patch protocol | **PASS** | Classified as **feature**: new rendering capability composing with existing primitives. Not a special case for one diagram. |
| II. Layer ownership | **PASS** | `renderFrameTreeToSvg()` lives in `layout-bridge.js` (renderer layer). It only converts engine decisions to markup – never invents layout facts. Layout stays in `layoutFrameTree()`. |
| III. DIAGRAM.md is the visual contract | **PASS** | No new visual rules introduced. Rendering reuses existing `_frameBoxRenderState()` which implements DIAGRAM.md tokens. |
| IV. Test before ship | **PASS** | All 23 diagrams must be browser-verified. All existing TS + Python test suites must pass. |
| V. Sensible defaults | **PASS** | No change to defaults or YAML contract. |
| VI. Stable public interfaces | **PASS** | `packages/layout-engine/` is unchanged. `performLocalRelayout()` in layout-bridge.js gains a sibling function, not a breaking change. |
| VII. No format lock-in | **PASS** | No new persisted format identifiers. |
| VIII. Semantic YAML | **PASS** | YAML is unchanged. |

## Project Structure

### Documentation (this feature)

```text
specs/009-client-side-ts-rendering/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
scripts/
├── preview/
│   ├── layout-bridge.js    # CHANGED: +renderFrameTreeToSvg(), +renderOverlaysSvg(),
│   │                       #          +createArrowsSvg(), +fetchIconSvg(),
│   │                       #          patchFrameGroup() adapted for icon param
│   └── editor.js           # CHANGED: loadSVG() rewritten to use TS pipeline
├── preview_server.py       # CHANGED: +/api/icon/<name>, +overlays in frame-tree JSON
├── diagram_render_svg.py   # UNCHANGED (batch export)
├── layout_v3.py            # UNCHANGED
├── frame_loader.py         # UNCHANGED
└── frame_model.py          # UNCHANGED

packages/
└── layout-engine/          # UNCHANGED
```

**Structure Decision**: No new source directories. Changes are surgical additions to 3 existing files plus 2 new server API routes.

## Complexity Tracking

No constitution violations to justify. The change is a clean feature addition that composes with existing primitives at the correct layer.
