"""Frame-based two-pass layout engine.

Pass 1 — measure(): bottom-up, computes natural size of each Frame.
Pass 2 — place(): top-down, assigns positions and distributes fill space.

Output: a LayoutResult compatible with the existing renderer pipeline.
The engine emits the same Primitive types as diagram_layout so existing
SVG and draw.io renderers work unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from frame_model import Frame, FrameDiagram, Direction, Sizing, Align
from diagram_model import Arrow, Line, Fill, Border
from diagram_layout import (
    ArrowPrimitive,
    Icon,
    LayoutResult,
    Rect,
    TextBlock,
)
from diagram_shared import (
    BASELINE_UNIT,
    BLOCK_WIDTH,
    BOX_MIN_HEIGHT,
    INSET,
    ICON_SIZE,
    BODY_LINE_STEP,
    round_up_to_grid,
    tight_box_height,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lines_to_dicts(lines: list[Line]) -> list[dict]:
    """Convert Line objects to the dict format renderers expect."""
    result = []
    for ln in lines:
        result.append({
            "content": ln.content,
            "size": ln.size,
            "weight": ln.weight,
            "fill": ln.fill,
            "small_caps": ln.small_caps if hasattr(ln, "small_caps") else False,
            "line_step": str(ln.line_step) if ln.line_step else str(BODY_LINE_STEP),
            "font_family": ln.font_family if hasattr(ln, "font_family") else None,
        })
    return result


def _heading_height(heading: Line | None) -> int:
    """Height reserved for a heading, including icon clearance."""
    if not heading:
        return 0
    h = tight_box_height(_lines_to_dicts([heading]))
    # Always reserve icon-height clearance so panels with/without icons align
    return max(h, ICON_SIZE + INSET)


def _leaf_natural_size(frame: Frame) -> tuple[float, float]:
    """Natural size of a leaf Frame (box with text/icon)."""
    has_icon = frame.icon is not None
    if frame.label:
        h = tight_box_height(_lines_to_dicts(frame.label), has_icon=has_icon)
    else:
        h = BOX_MIN_HEIGHT
    w = frame.width or BLOCK_WIDTH
    return (w, h)


# ---------------------------------------------------------------------------
# Pass 1: Measure (bottom-up)
# ---------------------------------------------------------------------------

def measure(frame: Frame) -> None:
    """Compute natural size of frame and all descendants.

    Sets frame._measured_w and frame._measured_h.
    """
    if frame.is_leaf:
        w, h = _leaf_natural_size(frame)
        frame._measured_w = round_up_to_grid(w)
        frame._measured_h = round_up_to_grid(h)
        return

    # Measure all children first
    for child in frame.children:
        measure(child)

    pad = frame.padding if frame.border != Border.NONE else 0
    heading_h = _heading_height(frame.heading)
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        content_w = sum(c._measured_w for c in frame.children) + total_gap
        content_h = max(c._measured_h for c in frame.children) if frame.children else 0
    else:  # VERTICAL
        content_w = max(c._measured_w for c in frame.children) if frame.children else 0
        content_h = sum(c._measured_h for c in frame.children) + total_gap

    frame._measured_w = round_up_to_grid(content_w + 2 * pad)
    frame._measured_h = round_up_to_grid(content_h + 2 * pad + heading_h + heading_gap)


# ---------------------------------------------------------------------------
# Alignment helpers
# ---------------------------------------------------------------------------

def _align_offset(align: Align, available: float, content: float, axis: str) -> float:
    """Compute offset for alignment on a given axis ('x' or 'y').

    The 9-point grid maps to:
      x-axis: LEFT=0, CENTER=mid, RIGHT=end
      y-axis: TOP=0, CENTER=mid, BOTTOM=end
    """
    slack = max(0, available - content)
    if axis == "x":
        if align in (Align.TOP_LEFT, Align.CENTER_LEFT, Align.BOTTOM_LEFT):
            return 0
        elif align in (Align.TOP_CENTER, Align.CENTER, Align.BOTTOM_CENTER):
            return slack / 2
        else:  # RIGHT
            return slack
    else:  # y
        if align in (Align.TOP_LEFT, Align.TOP_CENTER, Align.TOP_RIGHT):
            return 0
        elif align in (Align.CENTER_LEFT, Align.CENTER, Align.CENTER_RIGHT):
            return slack / 2
        else:  # BOTTOM
            return slack


# ---------------------------------------------------------------------------
# Pass 2: Place (top-down)
# ---------------------------------------------------------------------------

def place(frame: Frame, x: float, y: float, available_w: float, available_h: float) -> None:
    """Assign position and final size to frame and all descendants.

    Sets frame._placed_x, _placed_y, _placed_w, _placed_h.
    """
    # Determine this frame's final size
    if frame.sizing == Sizing.FIXED and frame.width and frame.height:
        frame._placed_w = round_up_to_grid(frame.width)
        frame._placed_h = round_up_to_grid(frame.height)
    else:
        frame._placed_w = round_up_to_grid(max(frame._measured_w, available_w))
        frame._placed_h = round_up_to_grid(max(frame._measured_h, available_h))

    frame._placed_x = x
    frame._placed_y = y

    if frame.is_leaf:
        return

    # Distribute space to children
    pad = frame.padding if frame.border != Border.NONE else 0
    heading_h = _heading_height(frame.heading)
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        available_for_children = frame._placed_w - 2 * pad - total_gap
        cross_size = frame._placed_h - 2 * pad - heading_h - heading_gap
    else:
        available_for_children = frame._placed_h - 2 * pad - heading_h - heading_gap - total_gap
        cross_size = frame._placed_w - 2 * pad

    # Separate HUG and FILL children
    hug_total = 0
    fill_count = 0
    for child in frame.children:
        if child.child_sizing == Sizing.FILL:
            fill_count += 1
        else:
            if frame.direction == Direction.HORIZONTAL:
                hug_total += child._measured_w
            else:
                hug_total += child._measured_h

    # Compute fill size
    remaining = available_for_children - hug_total
    fill_size = round_up_to_grid(remaining // fill_count) if fill_count > 0 else 0

    # Compute total content extent for alignment
    if frame.direction == Direction.HORIZONTAL:
        content_main = hug_total + fill_count * fill_size + total_gap
        content_cross = max((c._measured_h for c in frame.children), default=0)
    else:
        content_main = hug_total + fill_count * fill_size + total_gap
        content_cross = max((c._measured_w for c in frame.children), default=0)

    # Apply alignment offsets
    inner_w = frame._placed_w - 2 * pad
    inner_h = frame._placed_h - 2 * pad - heading_h - heading_gap

    if frame.direction == Direction.HORIZONTAL:
        main_offset = _align_offset(frame.align, inner_w, content_main, "x")
        cross_offset = _align_offset(frame.align, inner_h, content_cross, "y")
    else:
        main_offset = _align_offset(frame.align, inner_h, content_main, "y")
        cross_offset = _align_offset(frame.align, inner_w, content_cross, "x")

    # Place children sequentially
    if frame.direction == Direction.HORIZONTAL:
        cursor_x = x + pad + main_offset
        base_y = y + pad + heading_h + heading_gap + cross_offset
        for child in frame.children:
            if child.child_sizing == Sizing.FILL:
                child_w = fill_size
            else:
                child_w = child._measured_w
            child_h = cross_size if child.child_sizing == Sizing.FILL else child._measured_h
            # Cross-axis alignment for each child
            child_cross_offset = _align_offset(frame.align, cross_size, child._measured_h, "y")
            place(child, cursor_x, y + pad + heading_h + heading_gap + child_cross_offset, child_w, child_h)
            cursor_x += child._placed_w + frame.gap
    else:  # VERTICAL
        base_x = x + pad + cross_offset
        cursor_y = y + pad + heading_h + heading_gap + main_offset
        for child in frame.children:
            if child.child_sizing == Sizing.FILL:
                child_h = fill_size
            else:
                child_h = child._measured_h
            child_w = cross_size if child.child_sizing == Sizing.FILL else child._measured_w
            # Cross-axis alignment for each child
            child_cross_offset = _align_offset(frame.align, cross_size, child._measured_w, "x")
            place(child, x + pad + child_cross_offset, cursor_y, child_w, child_h)
            cursor_y += child._placed_h + frame.gap


# ---------------------------------------------------------------------------
# Render: convert placed Frame tree to primitives
# ---------------------------------------------------------------------------

def _render_frame(frame: Frame, fg: list, bg: list, bounds_map: dict) -> None:
    """Emit rendering primitives for a placed Frame."""
    x = frame._placed_x
    y = frame._placed_y
    w = frame._placed_w
    h = frame._placed_h
    cid = frame.id or None

    # Store bounds for arrow routing (skip internal IDs)
    if cid and not cid.startswith("__"):
        bounds_map[cid] = (x, y, w, h)

    # Frame rect
    if frame.border != Border.NONE:
        stroke = "none" if frame.border == Border.FILL else "#000000"
        fg.append(Rect(x, y, w, h, fill=frame.fill.value, stroke=stroke,
                       dashed=(frame.border == Border.DASHED), component_id=cid))

    # Heading
    pad = frame.padding if frame.border != Border.NONE else 0
    if frame.heading:
        fg.append(TextBlock(x + pad, y + pad, _lines_to_dicts([frame.heading]),
                            component_id=cid))

    # Heading icon
    if frame.icon and frame.is_container:
        icon_f = frame.icon_fill or "#000000"
        if frame.fill == Fill.BLACK and icon_f == "#000000":
            icon_f = "#FFFFFF"
        fg.append(Icon(x + w - pad - ICON_SIZE, y + pad, frame.icon,
                       fill=icon_f, component_id=cid))

    if frame.is_leaf:
        # Leaf content: text + icon
        if frame.label:
            text_fill = "#FFFFFF" if frame.fill == Fill.BLACK else "#000000"
            lines = _lines_to_dicts(frame.label)
            # Override fill on lines for highlight boxes
            if frame.fill == Fill.BLACK:
                lines = [{**ln, "fill": text_fill} for ln in lines]
            fg.append(TextBlock(x + pad, y + pad, lines, component_id=cid))
        if frame.icon:
            icon_fill = frame.icon_fill or "#000000"
            if frame.fill == Fill.BLACK and icon_fill == "#000000":
                icon_fill = "#FFFFFF"
            fg.append(Icon(x + w - pad - ICON_SIZE, y + pad, frame.icon,
                           fill=icon_fill, component_id=cid))
    else:
        # Container: render children recursively
        for child in frame.children:
            _render_frame(child, fg, bg, bounds_map)


# ---------------------------------------------------------------------------
# Arrow routing (reuses existing orthogonal router logic)
# ---------------------------------------------------------------------------

def _route_arrows(arrows: list[Arrow], bounds_map: dict) -> list[ArrowPrimitive]:
    """Route arrows using component bounds."""
    result = []
    for arrow in arrows:
        src_id, src_side = _parse_ref(arrow.source)
        tgt_id, tgt_side = _parse_ref(arrow.target)
        if src_id not in bounds_map or tgt_id not in bounds_map:
            continue
        sx, sy, sw, sh = bounds_map[src_id]
        tx, ty, tw, th = bounds_map[tgt_id]
        start = _edge_point(sx, sy, sw, sh, src_side)
        end = _edge_point(tx, ty, tw, th, tgt_side)
        # Simple direct routing for now - orthogonal with midpoint
        waypoints = _orthogonal_waypoints(start, end, src_side, tgt_side)
        prim = ArrowPrimitive(
            start=start,
            end=end,
            waypoints=waypoints,
            direction=tgt_side,
            component_id=f"{arrow.source}->{arrow.target}",
            source_ref=arrow.source,
            target_ref=arrow.target,
        )
        result.append(prim)
    return result


def _parse_ref(ref: str) -> tuple[str, str]:
    """Parse 'component_id.side' into (id, side)."""
    if "." in ref:
        parts = ref.rsplit(".", 1)
        return parts[0], parts[1]
    return ref, "right"


def _edge_point(x: float, y: float, w: float, h: float, side: str) -> tuple[float, float]:
    """Get midpoint of a box edge."""
    if side == "left":
        return (x, y + h / 2)
    elif side == "right":
        return (x + w, y + h / 2)
    elif side == "top":
        return (x + w / 2, y)
    elif side == "bottom":
        return (x + w / 2, y + h)
    return (x + w, y + h / 2)


def _orthogonal_waypoints(
    start: tuple[float, float],
    end: tuple[float, float],
    src_side: str,
    tgt_side: str,
) -> list[tuple[float, float]]:
    """Compute orthogonal waypoints between two edge points."""
    sx, sy = start
    ex, ey = end
    # Simple midpoint routing for horizontal connections
    if src_side == "right" and tgt_side == "left":
        mid_x = (sx + ex) / 2
        return [(mid_x, sy), (mid_x, ey)]
    elif src_side == "bottom" and tgt_side == "top":
        mid_y = (sy + ey) / 2
        return [(sx, mid_y), (ex, mid_y)]
    elif src_side == "left" and tgt_side == "right":
        mid_x = (sx + ex) / 2
        return [(mid_x, sy), (mid_x, ey)]
    elif src_side == "top" and tgt_side == "bottom":
        mid_y = (sy + ey) / 2
        return [(sx, mid_y), (ex, mid_y)]
    # Default: L-shaped
    return [(ex, sy)]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def layout_frame_diagram(diagram: FrameDiagram) -> LayoutResult:
    """Full layout pipeline: measure → place → render → return LayoutResult."""
    root = diagram.root

    # Pass 1: measure
    measure(root)

    # Root gets its measured size (or fixed if set)
    root_w = root.width or root._measured_w
    root_h = root.height or root._measured_h

    # Pass 2: place
    place(root, 0, 0, root_w, root_h)

    # Render frame tree to primitives
    fg: list = []
    bg: list = []
    bounds_map: dict[str, tuple[float, float, float, float]] = {}
    _render_frame(root, fg, bg, bounds_map)

    # Route arrows
    arrow_prims = _route_arrows(diagram.arrows, bounds_map)
    fg.extend(arrow_prims)

    return LayoutResult(
        width=int(root._placed_w),
        height=int(root._placed_h),
        foreground=fg,
        background=bg,
    )
