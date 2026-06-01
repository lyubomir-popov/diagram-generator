# Research: Client-side TypeScript rendering

**Feature**: 009-client-side-ts-rendering | **Date**: 2026-06-01

## Research task 1: Icon serving and client-side embedding

### Question

How to serve individual icon SVG files from `assets/icons/` via the preview server, and how to fetch + embed them client-side as `<g class="dg-icon">` elements.

### Findings

**Current Python path** (`diagram_shared.py:193`):
- `load_icon(name, fill)` reads `assets/icons/<name>`, parses with `xml.etree`, sets `fill` attribute on all child elements, serialises back to string
- Returns SVG inner content (children of `<svg>` root), not the full `<svg>` wrapper
- Used by `diagram_render_svg.py:_icon_group()` which wraps in `<g class="dg-icon" transform="translate(x y)">`

**Current client-side path** (`layout-bridge.js:470`):
- `patchFrameGroup()` does `const existingIcon = g.querySelector(":scope > .dg-icon")` – reuses the icon element from the Python-rendered SVG DOM
- If `frame.icon && existingIcon`, repositions the icon group via `transform` attribute
- If no `existingIcon`, the icon is silently omitted during relayout

**Gap**: For fresh render, there is no `existingIcon` in the DOM. Icons must be fetched.

### Decision

**Add `/api/icon/<name>` endpoint** to `preview_server.py`:
- Reads `assets/icons/<name>` (e.g. `Document.svg`)
- Returns raw SVG content with `Content-Type: image/svg+xml`
- Does NOT recolour – client handles fill via CSS or attribute patching (simpler, avoids server-side XML parsing per request)

**Add `fetchIconSvg(name)` to `layout-bridge.js`**:
- Fetches `/api/icon/<name>`, caches result in a `Map<string, string>`
- Returns SVG inner content as string
- Caller creates `<g class="dg-icon">`, sets `innerHTML` to the fetched content, applies fill via `querySelectorAll("path, circle, rect, polygon")` → `setAttribute("fill", iconFill)`

**Modify `patchFrameGroup(g, frame, iconElement)`**:
- Accept optional third parameter `iconElement` (a pre-built `<g class="dg-icon">` DOM element)
- When `iconElement` is provided, use it instead of `existingIcon`
- When neither `iconElement` nor `existingIcon` exists and `frame.icon` is set, the icon is omitted (graceful degradation, matching FR edge case spec)

### Alternatives considered

1. **Embed all icons in HTML template**: Rejected – there are 20+ icon SVGs, would bloat every page load even for diagrams with no icons
2. **Prefetch all icons used by a diagram**: Could work but over-engineering – most diagrams use 0–3 distinct icons, fetch-on-demand with caching is sufficient
3. **Server-side recolouring**: Rejected for the API endpoint – simpler to do client-side. Server doesn't know what fill each frame needs until layout runs.

---

## Research task 2: Fresh SVG construction vs patching

### Question

Whether `patchFrameGroup()` can create SVG groups from scratch without an existing DOM parent, or whether it needs adaptation.

### Findings

**Audit of `patchFrameGroup(g, frame)` (layout-bridge.js:403–480)**:
1. Takes a `<g>` element and a placed frame
2. Clears all children via `g.replaceChildren(...children)`
3. Creates rect, text (via `_buildFrameTextElement`), separator line from scratch
4. Only dependency on existing DOM is `existingIcon = g.querySelector(":scope > .dg-icon")`
5. All position/size data comes from `frame._layout.placedX/Y/W/H`

**Conclusion**: The function already rebuilds from scratch. A freshly created `<g>` element works – it just has no existing icon. With the icon parameter adaptation from Research Task 1, `patchFrameGroup` is fully usable for fresh SVG construction.

### Decision

No separate `createFrameGroup()` function needed. `patchFrameGroup()` with the icon parameter adaptation handles both patching and fresh creation.

---

## Research task 3: Overlay data exposure

### Question

The `_serialize_frame_diagram()` function does not include `overlays`. How to serialise and expose them.

### Findings

**Overlay model** (`frame_model.py:193`):
```python
@dataclass
class Overlay:
    id: str = ""
    label: str = ""
    members: list[str] = field(default_factory=list)
```

**Currently serialised**: `_serialize_frame_diagram()` returns `title`, `root`, `arrows`, `gridCols`, `gridColGap`, `gridRowGap`, `gridOuterMargin`. Overlays are omitted.

**Python overlay rendering** (`layout_v3.py:1815`):
- `_render_overlays(overlays, bounds_map)` computes bounding box of member nodes
- Emits `Rect` (dashed, transparent fill, `#000` stroke, `stroke-dasharray: "2 4"`) + `TextBlock` label at `(rx + pad, ry - 16)`
- Uses `OVERLAY_PADDING` constant

### Decision

**Add `overlays` to `_serialize_frame_diagram()`**:
```python
"overlays": [{"id": o.id, "label": o.label, "members": o.members} for o in diagram.overlays],
```

**Add `renderOverlaysSvg(overlays, boundsMap)` to `layout-bridge.js`**:
- Port of `_render_overlays()` – computes union bounding box of member frames
- Creates `<g>` with `<rect>` (dashed, transparent) + `<text>` label
- Returns array of `<g>` elements to append to SVG

---

## Research task 4: Arrow SVG creation from scratch

### Question

`patchArrowsSvg()` updates existing DOM elements by `data-component-id`. For fresh render, arrow groups must be created.

### Findings

**Current `patchArrowsSvg(svgEl, routedArrows)` (layout-bridge.js:733)**:
- Queries `[data-component-id="..."]` for each arrow
- Updates `<line>` x1/y1/x2/y2 and `<polygon>` points
- Assumes groups already exist (from Python SVG)

**Arrow structure in Python SVG**:
- Each arrow is a `<g data-component-id="source->target">` containing:
  - One or more `<line>` elements (shaft segments)
  - One `<polygon>` element (arrowhead)
  - Each line has `stroke`, `stroke-width`, `stroke-miterlimit` attributes

**Routed arrow data** from `routeArrows()`:
- `{ start, end, waypoints, direction, componentId, sourceRef, targetRef, color }`
- `start`/`end` are `[x, y]` tuples
- `waypoints` are intermediate `[x, y]` points
- `color` defaults to `#E95420` (Ubuntu orange)

### Decision

**Add `createArrowsSvg(routedArrows)` to `layout-bridge.js`**:
- For each routed arrow, creates `<g data-component-id="...">` with:
  - `<line>` elements for each segment (shaft, shortened by arrowhead length on last segment)
  - `<polygon>` for arrowhead
  - Stroke colour from `arrow.color`
- Returns array of `<g>` elements

The arrowhead geometry is already computed in `patchArrowsSvg()` – extract the point calculation into a shared helper.

---

## All research tasks resolved – no NEEDS CLARIFICATION remaining.
