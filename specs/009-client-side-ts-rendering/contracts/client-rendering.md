# Client-side rendering contract

## New functions in layout-bridge.js

### `renderFrameTreeToSvg(diagram, layoutResult, options)`

Produces a complete SVG element from a placed frame tree.

**Parameters**:
- `diagram` – `FrameDiagram` (deserialized, with `resolveStyles()` + `layoutFrameTree()` already run)
- `layoutResult` – `{ width, height }` from `layoutFrameTree()`
- `options.iconElements` – `Map<string, Element>` – pre-fetched icon `<g>` elements keyed by icon name

**Returns**: `SVGSVGElement` – a complete `<svg>` element with:
1. `viewBox="0 0 {width} {height}"`, `width`, `height` attributes
2. Background `<rect>` (white, full canvas)
3. Frame `<g>` groups (one per frame, created via `patchFrameGroup()`)
4. Arrow `<g>` groups (via `createArrowsSvg()`)
5. Overlay `<g>` groups (via `renderOverlaysSvg()`)
6. All groups have `data-component-id` attributes set

**Walk order**: Depth-first pre-order (parent before children), matching the Python renderer's output order so SVG stacking is correct.

### `createArrowsSvg(routedArrows)`

Creates arrow SVG groups from scratch.

**Parameters**:
- `routedArrows` – array from `routeArrows()`

**Returns**: `Element[]` – array of `<g data-component-id="...">` elements, each containing `<line>` segments and a `<polygon>` arrowhead.

### `renderOverlaysSvg(overlays, boundsMap)`

Creates overlay SVG groups.

**Parameters**:
- `overlays` – `{ id, label, members }[]` from frame-tree JSON
- `boundsMap` – `{ [id]: { x, y, w, h } }` from `collectPlacedBounds()`

**Returns**: `Element[]` – array of `<g>` elements with dashed `<rect>` + `<text>` label.

### `fetchIconSvg(name)`

Fetches and caches an icon SVG.

**Parameters**:
- `name` – icon filename (e.g. `"Document.svg"`)

**Returns**: `Promise<string>` – SVG inner content string. Cached after first fetch.

### `buildIconElement(name, svgContent, fill)`

Builds a `<g class="dg-icon">` element from fetched SVG content.

**Parameters**:
- `name` – icon filename
- `svgContent` – string from `fetchIconSvg()`
- `fill` – colour to apply to icon paths

**Returns**: `Element` – a `<g>` element ready for insertion into a frame group.

## Modified functions

### `patchFrameGroup(g, frame, iconElement)`

**Change**: Accept optional third parameter `iconElement`.

- When `iconElement` is provided and `frame.icon` is set, use `iconElement` instead of `existingIcon`
- When `iconElement` is not provided, fall back to `existingIcon = g.querySelector(":scope > .dg-icon")` (existing behaviour)
- Position icon at `(placedX + placedW - padRight - ICON_SIZE, placedY + padTop)`

### `loadSVG()` in editor.js

**Change**: Complete rewrite of the rendering flow.

**Old flow**:
1. Fetch Python SVG from `/svg/`
2. Set `stage.innerHTML = svgText`
3. `initLayoutBridge()` (load frame-tree JSON + HarfBuzz)
4. Conditionally `requestV3Relayout()` if overrides exist

**New flow**:
1. Show loading indicator in `#stage`
2. `initLayoutBridge(SLUG)` (load frame-tree JSON + HarfBuzz)
3. Deserialise `FrameDiagram` from cached frame-tree JSON
4. Apply overrides to frame tree (always, not conditionally)
5. `resolveStyles()` + `layoutFrameTree()`
6. Fetch icons for frames that need them
7. `renderFrameTreeToSvg()` → SVG element
8. `stage.replaceChildren(svgElement)`
9. Load component tree + grid info
10. `bindInteraction()` + `renderGridOverlay()`
11. Remove loading indicator
