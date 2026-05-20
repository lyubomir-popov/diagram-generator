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
    ComponentInfo,
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
    size_to_px,
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


def _estimate_text_width(lines: list[Line]) -> float:
    """Estimate the pixel width of the widest text line."""
    max_w = 0.0
    for ln in lines:
        text = str(ln.content)
        sz = size_to_px(ln.size)
        weight = str(ln.weight)
        factor = 0.62 if weight in ("600", "700") else 0.58
        w = len(text) * sz * factor
        if getattr(ln, "small_caps", False):
            w *= 1.05
        max_w = max(max_w, w)
    return max_w


def _leaf_natural_size(frame: Frame) -> tuple[float, float]:
    """Natural size of a leaf Frame (box with text/icon)."""
    has_icon = frame.icon is not None
    if frame.label:
        h = tight_box_height(_lines_to_dicts(frame.label), has_icon=has_icon)
    else:
        h = BOX_MIN_HEIGHT if frame.height is None else frame.height
    # Explicit height overrides computed height if larger
    if frame.height is not None:
        h = max(h, frame.height)
    # Width: use explicit value, or fit text+icon, falling back to BLOCK_WIDTH
    if frame.width is not None:
        w = frame.width
    elif frame.label:
        text_w = _estimate_text_width(frame.label)
        icon_col = (ICON_SIZE + INSET) if has_icon else 0
        content_w = INSET + text_w + INSET + icon_col
        w = max(round_up_to_grid(content_w), BLOCK_WIDTH)
    else:
        w = BLOCK_WIDTH
    return (w, h)


# ---------------------------------------------------------------------------
# Pass 1: Measure (bottom-up)
# ---------------------------------------------------------------------------

def measure(frame: Frame) -> None:
    """Compute natural size of frame and all descendants.

    Sets frame._measured_w and frame._measured_h.

    Per-axis sizing:
      - FIXED: use explicit width/height
      - HUG: shrink to content
      - FILL: measured at content size (parent will assign final size in place())
    """
    if frame.is_leaf:
        w, h = _leaf_natural_size(frame)
        # FIXED leaf: honor explicit dimensions per-axis
        if frame.sizing_w == Sizing.FIXED and frame.width is not None:
            w = frame.width
        if frame.sizing_h == Sizing.FIXED and frame.height is not None:
            h = frame.height
        frame._measured_w = round_up_to_grid(w)
        frame._measured_h = round_up_to_grid(h)
        return

    # Measure all children first
    for child in frame.children:
        measure(child)

    pad_h = frame.padding_left + frame.padding_right
    pad_v = frame.padding_top + frame.padding_bottom
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

    content_based_w = round_up_to_grid(content_w + pad_h)
    content_based_h = round_up_to_grid(content_h + pad_v + heading_h + heading_gap)

    # Per-axis sizing for containers
    if frame.sizing_w == Sizing.FIXED:
        frame._measured_w = round_up_to_grid(frame.width) if frame.width is not None else content_based_w
    else:
        frame._measured_w = content_based_w

    if frame.sizing_h == Sizing.FIXED:
        frame._measured_h = round_up_to_grid(frame.height) if frame.height is not None else content_based_h
    else:
        frame._measured_h = content_based_h


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

def _enforce_fill_hug_invariant(frame: Frame, coerced: dict | None = None) -> dict:
    """Figma rule (per-axis): if a HUG parent has ANY child that is FILL on
    the primary layout axis, the *parent* is coerced to FIXED on that axis,
    freezing at its measured size.  Children remain FILL and will divide the
    frozen space equally during place().

    Cross-axis FILL is NOT coerced: even when the parent is HUG on the
    cross axis, the cross size equals the tallest child's measured extent,
    and shorter FILL children should stretch to match.

    Recurse through the tree bottom-up so inner containers are resolved
    before their parents.

    Returns a dict of coerced frame IDs → {sizing_w, sizing_h, width, height}
    so the caller can persist the coercion.
    """
    if coerced is None:
        coerced = {}

    for child in frame.children:
        _enforce_fill_hug_invariant(child, coerced)

    if frame.is_leaf:
        return coerced

    if frame.direction == Direction.HORIZONTAL:
        # Primary axis is W — freeze parent HUG→FIXED if any child is FILL
        if frame.sizing_w == Sizing.HUG:
            if any(c.sizing_w == Sizing.FILL for c in frame.children):
                frame.sizing_w = Sizing.FIXED
                frame.width = frame._measured_w
                if frame.id:
                    coerced.setdefault(frame.id, {})
                    coerced[frame.id]["sizing_w"] = "FIXED"
                    coerced[frame.id]["width"] = int(frame._measured_w)
        # Cross axis (H): do NOT coerce — FILL children stretch to cross size
    else:  # VERTICAL
        # Primary axis is H — freeze parent HUG→FIXED if any child is FILL
        if frame.sizing_h == Sizing.HUG:
            if any(c.sizing_h == Sizing.FILL for c in frame.children):
                frame.sizing_h = Sizing.FIXED
                frame.height = frame._measured_h
                if frame.id:
                    coerced.setdefault(frame.id, {})
                    coerced[frame.id]["sizing_h"] = "FIXED"
                    coerced[frame.id]["height"] = int(frame._measured_h)
        # Cross axis (W): do NOT coerce — FILL children stretch to cross size

    return coerced


def _child_primary_sizing(child: Frame, direction: Direction) -> Sizing:
    """Get the child's sizing on the parent's primary axis."""
    return child.sizing_w if direction == Direction.HORIZONTAL else child.sizing_h


def _child_counter_sizing(child: Frame, direction: Direction) -> Sizing:
    """Get the child's sizing on the parent's counter (cross) axis."""
    return child.sizing_h if direction == Direction.HORIZONTAL else child.sizing_w


def place(frame: Frame, x: float, y: float, available_w: float, available_h: float) -> None:
    """Assign position and final size to frame and all descendants.

    Sets frame._placed_x, _placed_y, _placed_w, _placed_h.

    Per-axis sizing determines final size:
      - FILL: accept whatever the parent assigns (available_w/h)
      - FIXED: use explicit width/height
      - HUG: use measured (content) size
    """
    # Determine this frame's final size per-axis
    # Width
    if frame.sizing_w == Sizing.FILL:
        frame._placed_w = round_up_to_grid(available_w)
    elif frame.sizing_w == Sizing.FIXED and frame.width is not None:
        frame._placed_w = round_up_to_grid(frame.width)
    else:  # HUG, or FIXED without explicit width
        frame._placed_w = round_up_to_grid(frame._measured_w)
    # Height
    if frame.sizing_h == Sizing.FILL:
        frame._placed_h = round_up_to_grid(available_h)
    elif frame.sizing_h == Sizing.FIXED and frame.height:
        frame._placed_h = round_up_to_grid(frame.height)
    else:  # HUG, or FIXED without explicit height
        frame._placed_h = round_up_to_grid(frame._measured_h)

    frame._placed_x = x
    frame._placed_y = y

    if frame.is_leaf:
        return

    # Distribute space to children
    pad_l = frame.padding_left
    pad_r = frame.padding_right
    pad_t = frame.padding_top
    pad_b = frame.padding_bottom
    heading_h = _heading_height(frame.heading)
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        available_for_children = max(0, frame._placed_w - pad_l - pad_r - total_gap)
        cross_size = max(0, frame._placed_h - pad_t - pad_b - heading_h - heading_gap)
    else:
        available_for_children = max(0, frame._placed_h - pad_t - pad_b - heading_h - heading_gap - total_gap)
        cross_size = max(0, frame._placed_w - pad_l - pad_r)

    # Primary-axis FILL distribution: children whose primary-axis sizing
    # is FILL share remaining space equally after HUG/FIXED children.
    hug_total = 0
    fill_count = 0
    for child in frame.children:
        primary_sizing = _child_primary_sizing(child, frame.direction)
        if primary_sizing == Sizing.FILL:
            fill_count += 1
        else:
            main_size = child._measured_w if frame.direction == Direction.HORIZONTAL else child._measured_h
            hug_total += main_size

    if fill_count > 0:
        remaining = max(0, available_for_children - hug_total)
        grid_remaining = (remaining // BASELINE_UNIT) * BASELINE_UNIT
        base_fill = (grid_remaining // fill_count // BASELINE_UNIT) * BASELINE_UNIT
        leftover = grid_remaining - base_fill * fill_count
        extra_fills = int(leftover // BASELINE_UNIT)
    else:
        base_fill = 0
        extra_fills = 0

    if fill_count > 0:
        content_main = hug_total + (base_fill * fill_count + leftover if fill_count else 0) + total_gap
    else:
        content_main = hug_total + total_gap

    # Main-axis alignment offset
    inner_w = frame._placed_w - pad_l - pad_r
    inner_h = frame._placed_h - pad_t - pad_b - heading_h - heading_gap

    if frame.direction == Direction.HORIZONTAL:
        main_offset = _align_offset(frame.align, inner_w, content_main, "x")
    else:
        main_offset = _align_offset(frame.align, inner_h, content_main, "y")

    # Place children sequentially.
    # Cross-axis: FILL children stretch to fill; HUG/FIXED children keep
    # their measured size and are positioned by parent alignment offset.
    # This is the Figma-correct model: alignment never changes sizing.

    if frame.direction == Direction.HORIZONTAL:
        cursor_x = x + pad_l + main_offset
        fill_idx = 0
        for child in frame.children:
            primary_sizing = _child_primary_sizing(child, frame.direction)
            counter_sizing = _child_counter_sizing(child, frame.direction)
            # Primary (W) size
            if primary_sizing == Sizing.FILL:
                child_w = base_fill + (BASELINE_UNIT if fill_idx >= fill_count - extra_fills else 0)
                fill_idx += 1
            else:
                child_w = child._measured_w
            # Counter (H) size — per-child, based on child's own sizing_h
            if counter_sizing == Sizing.FILL:
                child_h = cross_size
                child_y = y + pad_t + heading_h + heading_gap
            else:
                child_h = child._measured_h
                cross_offset = _align_offset(frame.align, cross_size, child._measured_h, "y")
                child_y = y + pad_t + heading_h + heading_gap + cross_offset
            place(child, cursor_x, child_y, child_w, child_h)
            cursor_x += child._placed_w + frame.gap
    else:  # VERTICAL
        cursor_y = y + pad_t + heading_h + heading_gap + main_offset
        fill_idx = 0
        for child in frame.children:
            primary_sizing = _child_primary_sizing(child, frame.direction)
            counter_sizing = _child_counter_sizing(child, frame.direction)
            # Primary (H) size
            if primary_sizing == Sizing.FILL:
                child_h = base_fill + (BASELINE_UNIT if fill_idx >= fill_count - extra_fills else 0)
                fill_idx += 1
            else:
                child_h = child._measured_h
            # Counter (W) size — per-child, based on child's own sizing_w
            if counter_sizing == Sizing.FILL:
                child_w = cross_size
                child_x = x + pad_l
            else:
                child_w = child._measured_w
                cross_offset = _align_offset(frame.align, cross_size, child._measured_w, "x")
                child_x = x + pad_l + cross_offset
            place(child, child_x, cursor_y, child_w, child_h)
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
    pad_l = frame.padding_left
    pad_t = frame.padding_top
    pad_r = frame.padding_right
    effective_pad_l = pad_l if frame.border != Border.NONE else 0
    effective_pad_t = pad_t if frame.border != Border.NONE else 0
    effective_pad_r = pad_r if frame.border != Border.NONE else 0
    if frame.heading:
        fg.append(TextBlock(x + effective_pad_l, y + effective_pad_t, _lines_to_dicts([frame.heading]),
                            component_id=cid))

    # Heading icon
    if frame.icon and frame.is_container:
        icon_f = frame.icon_fill or "#000000"
        if frame.fill == Fill.BLACK and icon_f == "#000000":
            icon_f = "#FFFFFF"
        fg.append(Icon(x + w - effective_pad_r - ICON_SIZE, y + effective_pad_t, frame.icon,
                       fill=icon_f, component_id=cid))

    if frame.is_leaf:
        # Leaf content: text + icon
        if frame.label:
            text_fill = "#FFFFFF" if frame.fill == Fill.BLACK else "#000000"
            lines = _lines_to_dicts(frame.label)
            # Override fill on lines for highlight boxes
            if frame.fill == Fill.BLACK:
                lines = [{**ln, "fill": text_fill} for ln in lines]
            fg.append(TextBlock(x + effective_pad_l, y + effective_pad_t, lines, component_id=cid))
        if frame.icon:
            icon_fill = frame.icon_fill or "#000000"
            if frame.fill == Fill.BLACK and icon_fill == "#000000":
                icon_fill = "#FFFFFF"
            fg.append(Icon(x + w - effective_pad_r - ICON_SIZE, y + effective_pad_t, frame.icon,
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

    # Figma invariant: HUG parent + FILL child on primary axis → parent freezes to FIXED
    coerced = _enforce_fill_hug_invariant(root)

    # Root gets its measured size (or fixed if set)
    root_w = root.width if root.width is not None else root._measured_w
    root_h = root.height if root.height is not None else root._measured_h

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

    # Build component tree for editor interactivity
    component_tree = _build_component_tree(root)

    return LayoutResult(
        width=int(root._placed_w),
        height=int(root._placed_h),
        foreground=fg,
        background=bg,
        component_tree=component_tree,
        coerced_overrides=coerced,
    )


def _build_component_tree(root: Frame) -> list[ComponentInfo]:
    """Build ComponentInfo tree from placed Frame tree for editor support."""

    def _frame_to_ci(frame: Frame) -> ComponentInfo | None:
        cid = frame.id
        if not cid or cid.startswith("__"):
            return None
        children_ci = []
        if not frame.is_leaf:
            for child in frame.children:
                ci = _frame_to_ci(child)
                if ci:
                    children_ci.append(ci)
        layout = ""
        layout_gap = 0
        if not frame.is_leaf:
            layout = "vertical" if frame.direction == Direction.VERTICAL else "horizontal"
            layout_gap = frame.gap
        pad = frame.padding_top if frame.border != Border.NONE else 0
        return ComponentInfo(
            id=cid,
            type="panel" if not frame.is_leaf else "box",
            x=frame._placed_x,
            y=frame._placed_y,
            width=frame._placed_w,
            height=frame._placed_h,
            children=children_ci,
            layout=layout,
            layout_gap=layout_gap,
            layout_col_gap=layout_gap,
            layout_row_gap=layout_gap,
            pad=pad,
            sizing_w=frame.sizing_w.name,
            sizing_h=frame.sizing_h.name,
            align=frame.align.name,
            padding_top=frame.padding_top,
            padding_right=frame.padding_right,
            padding_bottom=frame.padding_bottom,
            padding_left=frame.padding_left,
        )

    # Root frame wraps the diagram; emit its children as top-level nodes
    if root.id and not root.id.startswith("__"):
        ci = _frame_to_ci(root)
        return [ci] if ci else []
    # If root is anonymous, emit its children
    result = []
    for child in root.children:
        ci = _frame_to_ci(child)
        if ci:
            result.append(ci)
    return result
