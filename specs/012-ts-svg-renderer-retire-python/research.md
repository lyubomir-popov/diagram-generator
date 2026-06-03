# Spec 012 — SVG renderer gap inventory (T010)

**Date:** 2026-06-03  
**Sources:** `scripts/diagram_render_svg.py`, `packages/layout-engine/src/svg-render.ts`, `scripts/preview/layout-bridge.js`

## Render paths today

| Path | Used by | Fidelity |
|------|---------|----------|
| Python `diagram_render_svg.render_svg` | Preview fallback (`_render_svg_python_fallback`) | Full primitives |
| `layout-bridge.js` `renderFrameTreeToSvg` | Preview editor (`renderFreshSvg`) | Icons, overlays, routed arrows, separators |
| `svg-render.ts` `renderFrameDiagramToSvg` | `export-frame-svg.mjs` batch CLI | Boxes, text, icon placeholder, elbow arrows |

**Problem:** Batch export and preview use different TS renderers; preview fallback still hits Python.

## Primitive / feature matrix

| Feature | Python | layout-bridge (preview) | svg-render.ts (batch) |
|---------|--------|-------------------------|------------------------|
| Frame rect + stroke/dash | Yes | Yes | Yes |
| HarfBuzz text / wrap | Yes | Yes | Yes (tspan) |
| Real icon SVG embed | Yes (`_icon_group`) | Yes (`fetchIconSvg`) | Placeholder rect only |
| Arrow routing (obstacles, waypoints) | Yes | Yes (`routeArrows`) | Simple elbow only |
| Arrow heads | Yes | Yes | No |
| Arrow labels | Yes | Partial | No |
| Overlays (group boxes) | Yes | Yes | No |
| Separators | Yes | Yes | Line only (role=separator) |
| JaggedRect / MatrixTile / TerminalBar / RequestCluster | Yes | No | No |
| Grid overlay (debug) | Yes | Yes (editor toggle) | No |
| Ontology meta block in SVG | Yes | No | No |
| `data-component-id` on groups | Yes | Yes | Yes (non-`__` ids) |
| Resolved fill/stroke from styles | Yes | Yes | Yes (`resolvedFill`) |

## Recommended port order (T020–T040)

1. **Unify on one TS module** — lift `renderFrameTreeToSvg` logic from `layout-bridge.js` into `packages/layout-engine/src/svg-render/` (or expand `svg-render.ts`) so batch and browser share code.
2. **Icons** — Node reads `assets/icons/` (mirror `fetchIconSvg` / preview server `/api/icon/`).
3. **Arrows** — share `routeArrows` with layout-bridge; arrow heads + labels from Python parity.
4. **Overlays** — port overlay emission from Python primitives.
5. **Legacy primitives** — JaggedRect, MatrixTile, etc. only if still present in corpus YAML (grep frames).

## Deletion criteria (T060)

- `grep diagram_render_svg` zero in `preview_server.py` and scripts
- `_render_svg_python_fallback` removed; `DG_DISABLE_TS_EXPORT` only disables TS, does not imply Python SVG
- Golden SVG subset in CI (5–10 corpus slugs)

## Out of scope (unchanged)

- draw.io export
- New visual styles
- Python layout removal (separate; preview layout already TS)
