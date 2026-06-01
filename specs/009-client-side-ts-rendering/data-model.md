# Data Model: Client-side TypeScript rendering

**Feature**: 009-client-side-ts-rendering | **Date**: 2026-06-01

## Entities

### FrameDiagram (existing – extended)

The root data structure served by `/api/frame-tree/<slug>`. Extended with `overlays`.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `title` | `string` | YAML | Diagram title |
| `root` | `Frame` | YAML → parser | Root frame of the tree |
| `arrows` | `Arrow[]` | YAML → parser | Connector definitions |
| `gridCols` | `number` | YAML | Grid column count |
| `gridColGap` | `number \| null` | YAML | Column gutter override |
| `gridRowGap` | `number \| null` | YAML | Row gutter override |
| `gridOuterMargin` | `number \| null` | YAML | Outer margin override |
| `overlays` | `Overlay[]` | YAML → parser | **NEW** – cross-cutting visual groups |

### Overlay (new in JSON API)

Serialised from Python `Overlay` dataclass. Already exists in `frame_model.py` – now exposed to the client.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique overlay identifier |
| `label` | `string` | Display label (rendered above the bounding rect) |
| `members` | `string[]` | Frame IDs included in this overlay group |

### Frame (existing – unchanged)

Recursive tree node. All fields already serialised by `_serialize_frame()`.

### PlacedFrame (runtime – existing)

A Frame after `layoutFrameTree()` runs. Has `_layout.placedX/Y/W/H` set by the engine. Not persisted – exists only in memory during rendering.

### RenderState (runtime – existing)

Per-frame visual properties resolved by `_frameBoxRenderState(frame)`. Bridges layout output to SVG element attributes.

| Field | Type | Description |
|-------|------|-------------|
| `fill` | `string` | CSS fill colour |
| `stroke` | `string` | CSS stroke colour |
| `dashed` | `boolean` | Whether stroke is dashed |
| `specs` | `TextSpec[]` | Text line specifications (content, size, weight, fill, etc.) |
| `padTop/Right/Bottom/Left` | `number` | Resolved padding values |

### RoutedArrow (runtime – existing)

Output of `routeArrows()`. Contains the points for SVG line/polygon rendering.

| Field | Type | Description |
|-------|------|-------------|
| `start` | `[number, number]` | Start point |
| `end` | `[number, number]` | End point (arrowhead tip) |
| `waypoints` | `[number, number][]` | Intermediate orthogonal waypoints |
| `direction` | `string` | Target side (`"top"`, `"bottom"`, `"left"`, `"right"`) |
| `componentId` | `string` | `"source->target"` for DOM identity |
| `sourceRef` | `string` | Source frame reference |
| `targetRef` | `string` | Target frame reference |
| `color` | `string` | Stroke colour (default `#E95420`) |

### IconCache (new – runtime only)

Client-side cache for fetched icon SVGs.

| Field | Type | Description |
|-------|------|-------------|
| (key) | `string` | Icon filename (e.g. `"Document.svg"`) |
| (value) | `string` | Raw SVG content string (inner content of `<svg>` root) |

Implemented as a module-level `Map<string, string>` in `layout-bridge.js`. Cache lifetime = page session. No persistence.

## State transitions

### Rendering pipeline (new flow)

```
Page load
  → Show loading indicator
  → Fetch frame-tree JSON (/api/frame-tree/<slug>)
  → Load HarfBuzz WASM + font (parallel)
  → Deserialise FrameDiagram
  → resolveStyles(root)
  → layoutFrameTree(root, textAdapter)
  → Fetch icons for frames that have icons (parallel, cached)
  → renderFrameTreeToSvg(diagram, result)
  → stage.replaceChildren(svgElement)
  → Remove loading indicator
  → Load tree + grid info
  → bindInteraction()
  → renderGridOverlay()
```

### Relayout pipeline (unchanged)

```
User edits (drag/resize/text/grid)
  → performLocalRelayout(model, overrides, gridOverrides)
    → resolveStyles + layoutFrameTree
    → patchSvgFromLayout (patches existing DOM in-place)
    → routeArrows + patchArrowsSvg
  → Update component model
  → renderGridOverlay()
```

## Validation rules

- All 23 frame YAML diagrams must render correctly through the new pipeline
- Icon fetch failures must not crash the pipeline (graceful degradation)
- Overlays with member IDs not present in the placed tree must be skipped silently
- Empty diagrams (zero frames) must produce a valid SVG with just the background rect
