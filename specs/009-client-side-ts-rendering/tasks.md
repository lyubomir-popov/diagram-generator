# Tasks: Client-side TypeScript rendering

**Input**: Design documents from `/specs/009-client-side-ts-rendering/`

**Prerequisites**: plan.md, spec.md, quickstart.md, data-model.md, contracts/

**Organization**: Tasks follow the quickstart.md 8-step implementation order. Steps 1–3 are foundational (non-breaking incremental changes), Steps 4–7 deliver US1 (correct first-load rendering, which also delivers US2 and US3), and Step 8 is error-handling polish. US4 and US5 are validation-only phases with no new code.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent functions, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US4, US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Confirm green baseline before any changes

- [x] T001 Verify existing test suites pass: `npm --prefix packages/layout-engine test` (198 tests) and `python -m pytest scripts/test_frame_loader.py scripts/test_autolayout.py scripts/test_layout_v3.py scripts/test_parity.py scripts/test_frame_classes.py scripts/test_style_parity.py scripts/test_frame_yaml_persistence.py -q` (271 tests)

---

## Phase 2: Foundational – Server and client prep (Steps 1–3)

**Purpose**: Safe, incremental additions that do not break existing behaviour. All existing diagrams continue rendering via the old path until Step 7.

**⚠️ CRITICAL**: Steps 4–7 depend on these being complete.

### Step 1: Server-side changes

- [x] T002 [P] Add `overlays` array to `_serialize_frame_diagram()` in scripts/preview_server.py – serialise as `[{"id": o.id, "label": o.label, "members": o.members} for o in diagram.overlays]`
- [x] T003 [P] Add `GET /api/icon/<name>` endpoint in scripts/preview_server.py – validate name has no `/`, `\`, `..`; read from `assets/icons/<name>`; serve with `Content-Type: image/svg+xml`; return 404 if missing

### Step 2: Icon fetching

- [x] T004 [P] Add module-level `_iconCache = new Map()` and `async function fetchIconSvg(name)` in scripts/preview/layout-bridge.js – fetch `/api/icon/<name>`, cache result, return SVG string
- [x] T005 [P] Add `function buildIconElement(name, svgContent, fill)` in scripts/preview/layout-bridge.js – create `<g class="dg-icon">`, set innerHTML to svgContent, recolour paths/circles/rects/polygons with fill attribute

### Step 3: Adapt patchFrameGroup

- [x] T006 Add optional third parameter `iconElement` to `patchFrameGroup(g, frame, iconElement)` in scripts/preview/layout-bridge.js – when provided and `frame.icon` is set, use it instead of `existingIcon`; existing callers pass no third argument so behaviour is unchanged

**Checkpoint**: Steps 1–3 complete. Verify: `curl http://127.0.0.1:8100/api/frame-tree/<slug>` shows `overlays` array; `curl http://127.0.0.1:8100/api/icon/Document.svg` returns SVG; existing relayout still works with icons.

---

## Phase 3: US1 – Correct rendering on first load (Steps 4–7) 🎯 MVP

**Goal**: The preview editor renders SVG entirely from the TS pipeline on first load – no Python SVG fetch, no flash of wrong content. Also delivers US2 (relayout stays TS) and US3 (loading indicator).

**Independent Test**: Open any diagram with section headings at `http://127.0.0.1:8100/view/v3:<slug>`. Confirm first paint shows small-caps headings. No SVG flicker or reflow.

### Step 4: Arrow SVG creation

- [x] T007 [P] [US1] Extract `_arrowheadPoints(tip, prev, headLen, headHalf)` helper from `patchArrowsSvg()` in scripts/preview/layout-bridge.js – returns polygon point coordinates for arrowhead geometry
- [x] T008 [US1] Add `function createArrowsSvg(routedArrows)` in scripts/preview/layout-bridge.js – create `<g data-component-id="...">` per arrow with `<line>` segments and `<polygon>` arrowhead using `_arrowheadPoints()`; stroke colour from `arrow.color`

### Step 5: Overlay SVG creation

- [x] T009 [P] [US1] Add `function renderOverlaysSvg(overlays, boundsMap)` in scripts/preview/layout-bridge.js – port of Python `_render_overlays()`: compute union bounding box of member frames, create `<g>` with dashed `<rect>` (stroke `#000`, `stroke-dasharray: "2 4"`, transparent fill, `OVERLAY_PADDING = 8`) and `<text>` label at `(rx + pad, ry - 16)` font size 14; skip overlays whose members have no placed bounds

### Step 6: Core rendering function

- [x] T010 [US1] Add `function renderFrameTreeToSvg(diagram, layoutResult, options)` in scripts/preview/layout-bridge.js – per contract: create `<svg>` with viewBox/width/height, white background `<rect>`, depth-first walk of frame tree creating `<g data-component-id="...">` per frame via `patchFrameGroup(g, frame, iconElement)`, call `routeArrows()` + `createArrowsSvg()`, call `renderOverlaysSvg()`; `options.iconElements` is `Map<string, Element>` of pre-fetched icons; return `SVGSVGElement`

### Step 7: loadSVG rewrite

- [x] T011 [US1] Add loading indicator logic in scripts/preview/editor.js – show "Loading…" text in `#stage` while HarfBuzz WASM and fonts load; remove indicator after SVG is rendered
- [x] T012 [US1] Rewrite `loadSVG()` in scripts/preview/editor.js – new flow: (1) show loading indicator, (2) `initLayoutBridge(SLUG)`, (3) deserialise FrameDiagram from cached JSON, (4) apply overrides always (not conditionally), (5) `resolveStyles()` + `layoutFrameTree()`, (6) fetch icons in parallel for frames that need them, (7) `renderFrameTreeToSvg()`, (8) `stage.replaceChildren(svgElement)`, (9) load tree + grid info, (10) `bindInteraction()` + `renderGridOverlay()`, (11) remove loading indicator. Remove old `/svg/` fetch path and conditional relayout branch entirely.
- [ ] T013 [US1] Browser-verify all 23 diagrams at `http://127.0.0.1:8100/view/v3:<slug>` – confirm correct rendering, no console errors, icons present, arrows correct, small-caps headings rendered, no flash of Python SVG (**3/23 verified:** maas-architecture, complex-routing-usecase, aws-hld)

**Checkpoint**: US1 (correct first load), US2 (relayout stays TS – `performLocalRelayout()` unchanged, no fallback branch), and US3 (loading indicator) are all delivered. Verify US2 by opening a diagram, dragging a frame, confirming TS fidelity retained. Verify US3 by throttling network to Slow 3G and confirming loading indicator appears.

---

## Phase 4: US4 – Batch/export unchanged (Priority: P2)

**Goal**: Confirm the Python renderer and batch export are completely unaffected.

**Independent Test**: Run `python build_outputs.py` for all diagrams and diff output SVGs against current baseline.

- [ ] T014 [US4] Run `python scripts/build_outputs.py` for all 23 diagrams and diff output SVGs against current baseline – confirm no regressions in batch export
- [ ] T015 [US4] Verify `/svg/<slug>` endpoint still serves Python-rendered SVG via `curl http://127.0.0.1:8100/svg/<slug>`

**Checkpoint**: Batch/export path confirmed unchanged.

---

## Phase 5: US5 – Grid overlay client-side (Priority: P3)

**Goal**: Confirm grid overlay renders via the existing client-side `renderGridOverlay()` in the new flow.

**Independent Test**: Open a diagram with grid overlay enabled and confirm grid lines appear correctly aligned.

- [ ] T016 [US5] Open a diagram with grid overlay enabled in the preview editor, toggle overlay on/off, confirm grid lines render correctly via client-side `renderGridOverlay()` without re-fetching from server

**Checkpoint**: Grid overlay works through client-side path.

---

## Phase 6: Polish – Error handling (Step 8) and final validation

**Purpose**: Graceful degradation for failure modes and full regression check.

- [ ] T017 [P] Add HarfBuzz/font load failure handling in scripts/preview/editor.js – if WASM or font loading fails, show clear error message in `#stage`, do not proceed to render
- [ ] T018 [P] Add icon fetch failure handling in scripts/preview/layout-bridge.js – if `fetchIconSvg()` rejects, log warning to console, render frame without icon (graceful degradation per FR-004 edge case)
- [ ] T019 [P] Add empty diagram handling in `renderFrameTreeToSvg()` in scripts/preview/layout-bridge.js – zero-frame diagram produces valid SVG with just background rect
- [ ] T020 Run full TS test suite: `npm --prefix packages/layout-engine test` – confirm all 198 tests pass (packages/layout-engine is unchanged)
- [ ] T021 Run full Python test suite: `python -m pytest scripts/test_frame_loader.py scripts/test_autolayout.py scripts/test_layout_v3.py scripts/test_parity.py scripts/test_frame_classes.py scripts/test_style_parity.py scripts/test_frame_yaml_persistence.py -q` – confirm all 271 tests pass
- [ ] T022 Final browser verification of all 23 diagrams with focus on edge cases: icons, arrows, overlays, small-caps headings, empty diagrams, diagrams with overrides saved

**Checkpoint**: All error paths handled. Full test suites green. All diagrams verified.

---

## Dependencies & execution order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies – run first to confirm green baseline
- **Foundational (Phase 2)**: Depends on Phase 1 – BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 – Steps 4–7 use functions from Steps 1–3
- **US4 (Phase 4)**: Can run after Phase 3 (or in parallel – it's validation only)
- **US5 (Phase 5)**: Can run after Phase 3 (or in parallel – it's verification only)
- **Polish (Phase 6)**: Depends on Phase 3 – error handling added to new functions

### Step dependencies within phases

```
Phase 2 (Steps 1–3):
  T002 ─┐
  T003 ─┤ (all parallel, different files/functions)
  T004 ─┤
  T005 ─┘
  T006 ──── depends on T004/T005 (uses buildIconElement output format)

Phase 3 (Steps 4–7):
  T007 ─┐
        ├─ T008 (depends on T007 for _arrowheadPoints)
  T009 ─┘ (parallel with T007/T008)
  T010 ──── depends on T008, T009 (uses createArrowsSvg + renderOverlaysSvg)
  T011 ──── independent (loading indicator is pure DOM)
  T012 ──── depends on T010, T011 (wires everything together)
  T013 ──── depends on T012 (browser verification)
```

### Parallel opportunities

```
Phase 2 (4 parallel tasks):
  T002 (preview_server.py – overlays) ║ T003 (preview_server.py – icon endpoint)
  T004 (layout-bridge.js – fetchIcon) ║ T005 (layout-bridge.js – buildIcon)

Phase 3 (2 parallel tasks):
  T007 (arrowhead extraction) ║ T009 (overlay rendering)

Phase 4+5 (2 parallel tasks):
  T014+T015 (batch validation) ║ T016 (grid overlay)

Phase 6 (3 parallel tasks):
  T017 (HarfBuzz error) ║ T018 (icon error) ║ T019 (empty diagram)
```

### User story delivery map

| User story | Delivered by | Tasks |
|------------|-------------|-------|
| US1 – Correct first load (P1) | Phase 3 (Steps 4–7) | T007–T013 |
| US2 – Live editing fidelity (P1) | Phase 3, T012 (removes fallback branch) | T012 (part of loadSVG rewrite) |
| US3 – Loading state (P2) | Phase 3, T011 | T011 (loading indicator) |
| US4 – Batch/export unchanged (P2) | Phase 4 (validation only) | T014–T015 |
| US5 – Grid overlay client-side (P3) | Phase 5 (verification only) | T016 |

---

## Implementation strategy

### MVP first (Phases 1–3)

1. Phase 1: Verify green baseline (1 task)
2. Phase 2: Server + client prep – Steps 1–3 (5 tasks)
3. Phase 3: Core rendering pipeline – Steps 4–7 (7 tasks)
4. **STOP and VALIDATE**: All 23 diagrams render correctly, US1+US2+US3 delivered

### Incremental delivery

1. Setup + Foundational → safe additions, nothing breaks
2. Steps 4–5 → utility functions added, nothing wired yet
3. Step 6 → renderFrameTreeToSvg exists but not called yet
4. Step 7 → the single big moment: loadSVG switches to TS pipeline
5. Phase 4–5 → confirm nothing regressed
6. Phase 6 → error handling polish

### Files changed summary

| File | Tasks | Nature of change |
|------|-------|-----------------|
| scripts/preview_server.py | T002, T003 | +overlays in frame-tree JSON, +icon endpoint |
| scripts/preview/layout-bridge.js | T004–T010, T018, T019 | +fetchIconSvg, +buildIconElement, patchFrameGroup adapted, +_arrowheadPoints, +createArrowsSvg, +renderOverlaysSvg, +renderFrameTreeToSvg, error handling |
| scripts/preview/editor.js | T011, T012, T017 | +loading indicator, loadSVG() rewritten, error handling |

### Files NOT changed (verify no regressions)

- `packages/layout-engine/*` – TS layout engine unchanged
- `scripts/frame_loader.py` – YAML parser unchanged
- `scripts/layout_v3.py` – Python layout engine unchanged
- `scripts/diagram_render_svg.py` – Python SVG renderer unchanged (still used for batch export)
- All Python test files – unchanged

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 and US3 are delivered as part of Phase 3's Step 7 – they don't need separate implementation phases
- The `/svg/` endpoint remains for batch/export (US4) – only `loadSVG()` in editor.js stops using it
- Commit after each step (Steps 1–8) for clean git history and easy revert
