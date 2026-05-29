# Plan: Arrow–arrowhead gap fix

**Spec**: [spec.md](spec.md)
**Branch**: `feat/003-arrow-gap-fix`

## Root cause

The gap is introduced by the **client-side layout bridge** (`scripts/preview/layout-bridge.js`), not by the Python engine. The Python SVG rendering in `diagram_render_svg.py` correctly computes the shaft–head junction (shaft endpoint equals arrowhead base point).

### Detailed mechanism

1. The bridge's `_orthogonalWaypoints()` generates intermediate waypoints for all arrow directions (e.g. `bottom→top` creates two midpoint waypoints at `midY = (sy + ey) / 2`).
2. For straight vertical/horizontal arrows where source and target share the same axis coordinate, this produces 4 collinear points: `[start, (x, midY), (x, midY), end]`.
3. The Python renderer emits a single `<line>` element per arrow shaft segment.
4. The bridge's `patchArrowsSvg()` iterates over existing `<line>` elements and path points. With 1 line element and 4 points, it only patches segment 0 (start→midpoint).
5. The `isLastSegment` check (`i === points.length - 2`) evaluates to `i === 2`, but `i` only reaches 0, so the shaft endpoint is never replaced with `basePoint`.
6. Result: shaft ends at the midpoint (y=92), arrowhead base starts at `tip - ARROW_HEAD_LENGTH` (y=93.2) → 1.2px gap.

## Fix

Add `_simplifyPath()` to the bridge (mirrors Python's `_simplify_path()`) and call it in `routeArrows()` before returning. This collapses collinear points so the segment count matches the SVG `<line>` count, and `isLastSegment` correctly identifies the final segment for `basePoint` replacement.

## Tasks

- [x] Add `_simplifyPath()` function to `layout-bridge.js`
- [x] Apply simplification in `routeArrows()` after building the full path
- [x] Verify zero gap on vertical arrows (request-to-hardware-stack: 5 arrows)
- [x] Verify zero gap on horizontal arrows (example-deployment-pipeline: 5 arrows)
- [x] Verify zero gap on multi-segment arrows (complex-routing-usecase: 3-seg + 5-seg)
- [x] Verify zero gap on lifecycle arrows (maas-machine-lifecycle: 5 arrows)
- [x] Run full v3 test suite (235 tests + 51 subtests)
- [ ] Commit fix on `feat/003-arrow-gap-fix`

## Verification summary

| Diagram | Arrows | Segments | Gap before | Gap after |
|---------|--------|----------|------------|-----------|
| request-to-hardware-stack | 5 | 1 each | 1.2px | 0.0px |
| maas-machine-lifecycle | 5 | 1 each | 1.2px | 0.0px |
| example-deployment-pipeline | 5 | 1 each | 1.2px | 0.0px |
| complex-routing-usecase | 2 | 3 + 5 | 1.2px | 0.0px |
