# Feature Specification: Client-side TypeScript rendering

**Feature Branch**: `feat/009-client-side-ts-rendering`

**Created**: 2026-06-01

**Status**: Draft

**Input**: Replace Python SVG generation with client-side TypeScript rendering in the diagram preview editor

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Correct rendering on first load (Priority: P1)

A developer opens a diagram in the preview editor and sees the definitive TS-rendered output immediately – including small caps, OpenType features, and resolved frame-class styles – with no flash of lower-fidelity Python SVG.

**Why this priority**: This is the core problem. Today's first load shows Python SVG without small caps or OpenType features, and only replaces it with TS output if a relayout is triggered. On a clean first load, the user sees the wrong output permanently.

**Independent Test**: Open any diagram with section headings (which use small caps) in the preview editor. Confirm that the first paint already shows small-caps headings and that no SVG content flickers or reflows after initial render.

**Acceptance Scenarios**:

1. **Given** a diagram YAML with section headings, **When** the developer opens it in the preview editor, **Then** the rendered SVG uses `font-variant-caps: small-caps` on headings from the first visible paint
2. **Given** any of the 23 existing frame YAML diagrams, **When** the developer opens it in the preview editor, **Then** the visual output matches or exceeds the quality of today's Python+TS-patched result
3. **Given** a diagram with icons, **When** the developer opens it, **Then** all icons render correctly in their expected positions without requiring a relayout trigger

---

### User Story 2 – Live editing retains full TS fidelity (Priority: P1)

A developer edits frame overrides (drag, resize, text edit) in the preview editor and sees immediate re-rendering through the TS pipeline, with no fallback to Python SVG at any point.

**Why this priority**: This is the second half of the interactive experience. If editing falls back to Python rendering, the same flash-of-wrong-content problem recurs on every interaction.

**Independent Test**: Open a diagram, drag a frame to a new position, and confirm the re-rendered SVG retains OpenType features and frame-class styles without any visible flash or degradation.

**Acceptance Scenarios**:

1. **Given** a diagram open in the preview editor, **When** the developer drags a frame, **Then** the re-rendered output uses the TS pipeline and retains all style features
2. **Given** a diagram open in the preview editor, **When** the developer resizes a frame, **Then** text re-wraps using HarfBuzz measurement and the layout updates without Python involvement
3. **Given** a diagram with overrides saved, **When** the developer reloads the page, **Then** the overrides apply through the TS pipeline on first load (no conditional relayout branch)

---

### User Story 3 – Loading state during initialisation (Priority: P2)

While HarfBuzz WASM and font files load, the developer sees a brief, non-disruptive loading indicator instead of a blank stage or a stale Python SVG placeholder.

**Why this priority**: Without the Python SVG as a placeholder, there's a gap between page load and TS rendering readiness. This needs a graceful loading state, but it's secondary to correctness.

**Independent Test**: Throttle network to Slow 3G in DevTools, open a diagram, and confirm a loading indicator appears and is replaced by the rendered SVG once HarfBuzz + fonts are ready.

**Acceptance Scenarios**:

1. **Given** HarfBuzz WASM and fonts have not yet loaded, **When** the developer opens a diagram, **Then** a loading indicator is visible in the stage area
2. **Given** HarfBuzz WASM and fonts finish loading, **When** the TS pipeline completes rendering, **Then** the loading indicator is replaced by the SVG with no intermediate blank state

---

### User Story 4 – Batch/export SVG via Python path unchanged (Priority: P2)

A developer runs `build_outputs.py` or CLI export commands and gets SVG output from the Python renderer exactly as before. The client-side rendering change does not affect any non-interactive workflow.

**Why this priority**: Preserving the batch/export path is a hard constraint, but no code changes are needed – it just needs to keep working.

**Independent Test**: Run `python build_outputs.py` for all 23 diagrams and diff the output SVGs against the current baseline. Confirm no regressions.

**Acceptance Scenarios**:

1. **Given** a diagram YAML, **When** the developer runs the batch export script, **Then** the output SVG is produced by the Python renderer and matches the current output
2. **Given** the preview server is running, **When** a client requests `/svg/<slug>`, **Then** the Python-rendered SVG is still served (endpoint preserved for batch/external use)

---

### User Story 5 – Grid overlay renders client-side (Priority: P3)

The grid overlay in the preview editor renders via the existing client-side `renderGridOverlay()` rather than relying on Python's `_grid_overlay()` / `_layout_grid_overlay()`.

**Why this priority**: Grid overlay already has a client-side implementation. This story ensures it's wired into the new rendering flow rather than lost.

**Independent Test**: Open a diagram with grid overlay enabled and confirm grid lines appear correctly aligned to the layout grid.

**Acceptance Scenarios**:

1. **Given** a diagram with grid overlay enabled, **When** the developer opens it in the preview editor, **Then** grid lines render correctly via the client-side grid overlay
2. **Given** grid overlay is toggled on/off, **When** the developer toggles, **Then** the overlay updates without re-fetching from the server

---

### Edge Cases

- **HarfBuzz load failure**: If WASM or font loading fails (network error, corrupt file), the editor should show a clear error state rather than a blank stage or infinite spinner
- **Missing icons**: If an icon SVG cannot be fetched from `/preview/icons/`, the frame should render without the icon and log a warning, not crash the render pipeline
- **Empty diagram**: A YAML with zero frames should produce a valid empty SVG with just the grid background (if enabled)
- **Very large diagrams**: Diagrams with 50+ frames should render within acceptable time; HarfBuzz measurement per-frame is the bottleneck to watch
- **Concurrent edits**: If the developer triggers a save while a relayout is in progress, the pipeline should not produce a corrupted SVG
- **Overlay groups**: Overlays (cross-cutting visual groups from `_render_overlays()`) need a client-side equivalent or the feature degrades for diagrams that use them

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The preview editor MUST render SVG entirely from the TS pipeline (`resolveStyles()` → `layoutFrameTree()` → `renderFrameTreeToSvg()`) without fetching Python-generated SVG
- **FR-002**: `renderFrameTreeToSvg()` MUST produce a complete SVG document including: background rect, frame groups (rect + text + icon), arrow paths, and optional grid overlay
- **FR-003**: The editor MUST fetch frame tree JSON, grid info, and component tree from the preview server's existing API endpoints
- **FR-004**: Icon SVG content MUST be fetched client-side and embedded into the rendered SVG groups
- **FR-005**: Arrow rendering MUST use the existing `routeArrows()` + `patchArrowsSvg()` TS functions
- **FR-006**: The preview server's `/svg/` endpoint MUST remain functional for batch/export use cases
- **FR-007**: The editor MUST show a loading indicator while HarfBuzz WASM and fonts are loading
- **FR-008**: `loadSVG()` in editor.js MUST be refactored to use the TS rendering pipeline instead of fetching `/svg/`
- **FR-009**: Overlay rendering (cross-cutting visual groups) MUST have a client-side implementation equivalent to Python's `_render_overlays()`
- **FR-010**: All 23 existing frame YAML diagrams MUST render correctly through the new pipeline
- **FR-011**: The rendering pipeline MUST handle frames with and without icons, with and without text, and with nested children

### Key Entities

- **Frame tree**: The hierarchical structure of frames parsed from YAML, served as JSON by the preview server. The TS pipeline's input.
- **Placed frame**: A frame with resolved x, y, width, height coordinates after layout. The output of `layoutFrameTree()`.
- **Render state**: Per-frame visual properties (fill, stroke, padding, text specs) resolved by `_frameBoxRenderState()`. Bridges layout output to SVG generation.
- **Grid info**: Grid dimensions and spacing served by the preview server. Used for grid overlay rendering.
- **Component tree**: The inspector/interaction model for the editor. Unchanged by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 23 frame YAML diagrams render in the preview editor with visual output matching or exceeding the current Python+TS-patched result
- **SC-002**: No test regressions across the existing TS test suite (198 tests) and Python test suite (271 tests)
- **SC-003**: Time from page load to first visible SVG is under 2 seconds on a typical development machine (including HarfBuzz + font loading)
- **SC-004**: Editor interactions (select, drag, resize, text edit, save) work identically to the current behavior
- **SC-005**: The "flash of wrong content" (Python SVG followed by TS patch) is completely eliminated – users see exactly one rendering per load
- **SC-006**: Batch export via `build_outputs.py` produces identical output to the current baseline
- **SC-007**: Arrow rendering in the preview editor matches the current routed arrow output
- **SC-008**: Icon rendering matches the current output for all diagrams that use icons

## Assumptions

- HarfBuzz WASM and the Ubuntu Sans Variable font file are cacheable and load reliably after the first visit, making the loading indicator a first-visit concern primarily
- The preview server's existing JSON API endpoints (`/api/frame-tree/`, `/api/grid-info/`, etc.) serve all data the TS pipeline needs – no new server endpoints are required
- The existing `patchFrameGroup()` logic in layout-bridge.js can be adapted for fresh SVG construction (not just patching existing DOM) with moderate effort
- Icon SVGs are already served by the preview server at a known path and can be fetched by the client
- The overlay rendering (`_render_overlays()`) is used by a small subset of diagrams and can be implemented client-side incrementally
- Python parity tests remain valuable even after this change, because the Python renderer is still used for batch export and the layout engines should agree on frame placement
- The editor's component model, inspector, and save/persist flows are fully decoupled from SVG generation and require no changes

## Superseded Work

- **Spec 008 Phase 5 (T040–T047)**: Resolved-style-snapshot work for the Python renderer becomes lower priority. The Python renderer still exists for batch export, but fixing its style interpretation is deprioritized since users no longer see its output interactively.
- **Small-caps TS-only divergence**: The deliberate divergence where Python uses `small_caps=False` and TS uses `smallCaps=true` stops being a user-visible issue because the interactive path is TS-only.
