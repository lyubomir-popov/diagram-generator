# Quickstart: Client-side TypeScript rendering

**Feature**: 009-client-side-ts-rendering

## Implementation order

Work in this sequence – each step is independently testable.

### Step 1: Server-side changes (preview_server.py)

1. **Add overlays to frame-tree JSON**. In `_serialize_frame_diagram()`, add:
   ```python
   "overlays": [{"id": o.id, "label": o.label, "members": o.members} for o in diagram.overlays],
   ```

2. **Add `/api/icon/<name>` endpoint**. In `do_GET()`, add a route that:
   - Validates `name` (no `/`, `\`, `..`)
   - Reads `assets/icons/<name>`
   - Serves with `Content-Type: image/svg+xml`

**Test**: `curl http://127.0.0.1:8100/api/frame-tree/<slug>` – confirm `overlays` array present. `curl http://127.0.0.1:8100/api/icon/Document.svg` – confirm SVG returned.

### Step 2: Icon fetching (layout-bridge.js)

1. Add `_iconCache = new Map()` at module level
2. Add `async function fetchIconSvg(name)` – fetches `/api/icon/<name>`, caches, returns string
3. Add `function buildIconElement(name, svgContent, fill)` – creates `<g class="dg-icon">` with recoloured paths

**Test**: In browser console, call `fetchIconSvg("Document.svg")` – confirm SVG string returned.

### Step 3: Adapt patchFrameGroup (layout-bridge.js)

1. Add optional third parameter `iconElement` to `patchFrameGroup(g, frame, iconElement)`
2. When `iconElement` provided, use it instead of `existingIcon`
3. Existing callers (`patchSvgFromLayout`) pass no third argument – behaviour unchanged

**Test**: Existing relayout still works. Open a diagram with icons, trigger relayout, confirm icons render.

### Step 4: createArrowsSvg (layout-bridge.js)

1. Extract arrowhead point calculation from `patchArrowsSvg()` into `_arrowheadPoints(tip, prev, headLen, headHalf)`
2. Add `function createArrowsSvg(routedArrows)` – creates `<g>` with `<line>` + `<polygon>` for each arrow

**Test**: Not directly testable until wired into renderFrameTreeToSvg. Unit-verify by calling in console.

### Step 5: renderOverlaysSvg (layout-bridge.js)

1. Add `function renderOverlaysSvg(overlays, boundsMap)` – port of Python `_render_overlays()`
2. Constants: `OVERLAY_PADDING = 8`, label at `(rx + pad, ry - 16)`, font size 14

**Test**: Not directly testable until wired into renderFrameTreeToSvg.

### Step 6: renderFrameTreeToSvg (layout-bridge.js)

1. Add `function renderFrameTreeToSvg(diagram, result, options)`:
   - Create `<svg>` with viewBox
   - Create white background `<rect>`
   - Walk frame tree depth-first, create `<g data-component-id="...">` for each frame
   - Call `patchFrameGroup(g, frame, iconElement)` for each
   - Call `routeArrows()` + `createArrowsSvg()` for arrows
   - Call `renderOverlaysSvg()` for overlays
   - Return the SVG element

**Test**: Call from console with a deserialized + laid-out diagram. Inspect returned SVG element.

### Step 7: Rewrite loadSVG (editor.js)

1. Add loading indicator logic (simple "Loading…" text in `#stage`)
2. Rewrite `loadSVG()` to:
   - Call `initLayoutBridge(SLUG)` first
   - Deserialise, apply overrides, resolve styles, layout
   - Collect icon names from frame tree, fetch all icons in parallel
   - Call `renderFrameTreeToSvg()`
   - Replace stage content
   - Load tree + grid, bind interaction, render grid overlay
3. Remove the old `/svg/` fetch path
4. Remove the conditional relayout branch (all renders now go through TS)

**Test**: Open every diagram at `http://127.0.0.1:8100/view/v3:<slug>`. Confirm correct rendering. Compare visually against current output.

### Step 8: Error handling

1. HarfBuzz load failure → show error message in stage, do not proceed to render
2. Icon fetch failure → log warning, render frame without icon
3. Empty diagram → produce SVG with just background rect

**Test**: Simulate by disconnecting from network after page load starts. Confirm error state.

## Validation

After all steps:

```bash
# TS tests (unchanged – packages/layout-engine is not modified)
npm --prefix packages/layout-engine test

# Python tests (unchanged – Python renderer is not modified)
python -m pytest scripts/test_frame_loader.py scripts/test_autolayout.py scripts/test_layout_v3.py scripts/test_parity.py scripts/test_frame_classes.py scripts/test_style_parity.py scripts/test_frame_yaml_persistence.py -q

# Browser verify all 23 diagrams
# Open each at http://127.0.0.1:8100/view/v3:<slug>
# Confirm: correct rendering, no console errors, icons present, arrows correct, overlays (if any) correct
```

## Files changed summary

| File | Nature of change |
|------|-----------------|
| `scripts/preview_server.py` | +overlays in frame-tree JSON, +icon endpoint |
| `scripts/preview/layout-bridge.js` | +fetchIconSvg, +buildIconElement, +createArrowsSvg, +renderOverlaysSvg, +renderFrameTreeToSvg, patchFrameGroup adapted |
| `scripts/preview/editor.js` | loadSVG() rewritten, +loading indicator |
