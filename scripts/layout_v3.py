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
    DashedLinePrimitive,
    GridInfo,
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
    estimate_line_width,
    round_up_to_grid,
    size_to_px,
    stepped_lines_height,
    tight_box_height,
    wrap_text_lines,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp_to_constraints(value: float, min_val: int | None, max_val: int | None) -> float:
    """Clamp value to [min_val, max_val], grid-aligning the result."""
    if min_val is not None and value < min_val:
        value = round_up_to_grid(min_val)
    if max_val is not None and value > max_val:
        value = (max_val // BASELINE_UNIT) * BASELINE_UNIT
    return value

def _distribute_fill_space(
    available: float, fill_measured: list[float],
    fill_mins: list[float | None] | None = None,
    fill_maxes: list[float | None] | None = None,
) -> list[float]:
    """Distribute available space among FILL children.

    FILL means "accept whatever space the parent gives me."  The algorithm:

    1. Try equal split among all FILL children.
    2. If any child has a min constraint (or max constraint) that prevents
       the equal share, clamp it and redistribute among the rest.
    3. Repeat until stable.

    The measured content size is NOT a floor — FILL children shrink below
    their content when the parent is too small.  Only explicit min_width /
    min_height constraints act as a floor (defaulting to 0).  This matches
    Figma's model: content overflows the child, not the parent's padding.

    Returns a list of final sizes (one per FILL child).
    This is the single source of truth for FILL distribution, used by
    both _resolve_child_widths() (pass 1.5) and place() (pass 2).

    Unconstrained shares stay continuous rather than snapping each child
    independently to the baseline grid. That keeps explicit FILL siblings
    visually equal even when the parent span is not divisible by 8.
    """
    n = len(fill_measured)
    if n == 0:
        return []
    sizes = [0.0] * n
    remaining = max(0, available)
    unclamped = list(range(n))

    # Resolve effective min/max for each child
    eff_mins = [0.0] * n
    eff_maxes = [float('inf')] * n
    if fill_mins:
        for i in range(min(n, len(fill_mins))):
            if fill_mins[i] is not None:
                eff_mins[i] = fill_mins[i]
    if fill_maxes:
        for i in range(min(n, len(fill_maxes))):
            if fill_maxes[i] is not None:
                eff_maxes[i] = fill_maxes[i]

    # Iterative clamping: clamp children at min or max when the equal
    # share violates their constraints, then redistribute.
    while unclamped:
        share = remaining / len(unclamped) if unclamped else 0
        clamped_any = False
        for idx in list(unclamped):
            if share < eff_mins[idx]:
                # Child needs more than its share — give it the minimum
                sizes[idx] = round_up_to_grid(eff_mins[idx])
                remaining -= sizes[idx]
                unclamped.remove(idx)
                clamped_any = True
                break
            if share > eff_maxes[idx]:
                # Child can't take its full share — cap at maximum
                sizes[idx] = (eff_maxes[idx] // BASELINE_UNIT) * BASELINE_UNIT
                remaining -= sizes[idx]
                unclamped.remove(idx)
                clamped_any = True
                break
        if not clamped_any:
            n_unc = len(unclamped)
            share = remaining / n_unc if n_unc else 0
            for idx in unclamped:
                sizes[idx] = share
            break
    return sizes


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


def _heading_height(heading: Line | None, max_width: float | None = None) -> int:
    """Height reserved for a heading, including icon clearance.

    When *max_width* is provided, estimate how many lines the heading will
    wrap to at that width and reserve enough vertical space.
    """
    if not heading:
        return 0
    lines = _lines_to_dicts([heading])
    if max_width and max_width > 0:
        lines = wrap_text_lines(lines, max_width)
    h = stepped_lines_height(lines, top_pad=INSET, bottom_pad=INSET, min_height=0)
    # Always reserve icon-height clearance so panels with/without icons align
    return max(h, ICON_SIZE + INSET)


def _heading_text_max_w(frame: Frame) -> float | None:
    """Compute the text max_width for heading wrapping from the frame's width.

    Prefers _placed_w (set during place()), then _resolved_w (set during
    constrained remeasure pass). Returns None if neither is available.
    """
    rw = getattr(frame, '_placed_w', None) or getattr(frame, '_resolved_w', None)
    if rw is None:
        return None
    pad_l = frame.padding_left if frame.border != Border.NONE else 0
    pad_r = frame.padding_right if frame.border != Border.NONE else 0
    icon_col = (ICON_SIZE + INSET) if frame.icon else 0
    return rw - pad_l - pad_r - icon_col


def _estimate_text_width(lines: list[Line]) -> float:
    """Estimate the pixel width of the widest text line."""
    max_w = 0.0
    for ln in lines:
        max_w = max(max_w, estimate_line_width(_lines_to_dicts([ln])[0]))
    return max_w


def _leaf_all_lines(frame: Frame) -> list[dict]:
    """Combine heading + label into a single line list for a leaf node."""
    result = []
    if frame.heading:
        result.extend(_lines_to_dicts([frame.heading]))
    if frame.label:
        result.extend(_lines_to_dicts(frame.label))
    return result


def _leaf_natural_size(frame: Frame, constrained_w: float | None = None) -> tuple[float, float]:
    """Natural size of a leaf Frame (box with text/icon).

    When *constrained_w* is provided, text wraps at that width instead of
    the default BLOCK_WIDTH.  This lets the engine re-measure height after
    the parent has resolved the actual width this leaf will receive.
    """
    has_icon = frame.icon is not None
    all_lines = _leaf_all_lines(frame)
    if all_lines:
        # Estimate available text width for wrapping calculation
        icon_col = (ICON_SIZE + INSET) if has_icon else 0
        if constrained_w is not None:
            text_max_w = constrained_w - 2 * INSET - icon_col
        elif frame.width is not None:
            text_max_w = frame.width - 2 * INSET - icon_col
        else:
            text_max_w = BLOCK_WIDTH - 2 * INSET - icon_col
        wrapped_lines = wrap_text_lines(all_lines, text_max_w)
        text_h = stepped_lines_height(wrapped_lines, top_pad=INSET, bottom_pad=INSET, min_height=0)
        # All bordered boxes use the icon-height minimum (64px) for
        # consistent row heights whether an icon is present or not.
        if frame.border != Border.NONE:
            icon_h = INSET + ICON_SIZE + INSET  # 64
            h = max(text_h, icon_h)
        else:
            h = text_h
    else:
        h = BOX_MIN_HEIGHT if frame.height is None else frame.height
    # Explicit height overrides computed height if larger
    if frame.height is not None:
        h = max(h, frame.height)
    # Width: use explicit value, or fit text+icon, falling back to BLOCK_WIDTH
    if frame.width is not None:
        w = frame.width
    elif all_lines:
        text_lines = ([frame.heading] if frame.heading else []) + list(frame.label)
        text_w = _estimate_text_width(text_lines)
        # Cap at wrap width: if text wraps, the box width is determined by the
        # wrap boundary, not the raw unwrapped text width.
        text_w = min(text_w, text_max_w)
        icon_col = (ICON_SIZE + INSET) if has_icon else 0
        content_w = INSET + text_w + INSET + icon_col
        w = max(round_up_to_grid(content_w), BLOCK_WIDTH)
    else:
        w = BLOCK_WIDTH
    return (w, h)


def _build_grid_info(diagram: FrameDiagram, root: Frame) -> GridInfo:
    """Resolve Brockman-style overlay metadata for the laid-out frame diagram."""
    cols = max(1, int(diagram.grid_cols or 2))
    col_gap = int(diagram.grid_col_gap if diagram.grid_col_gap is not None else root.gap)
    row_gap = int(diagram.grid_row_gap if diagram.grid_row_gap is not None else root.gap)
    outer_margin = int(
        diagram.grid_outer_margin
        if diagram.grid_outer_margin is not None
        else (root.padding_top or root.padding or 0)
    )

    svg_w = int(root._placed_w)
    svg_h = int(root._placed_h)
    content_w = max(0, svg_w - 2 * outer_margin)
    content_h = max(0, svg_h - 2 * outer_margin)

    col_w_raw = ((content_w - (cols - 1) * col_gap) / cols) if cols > 1 else content_w
    col_w = int((col_w_raw // BASELINE_UNIT) * BASELINE_UNIT) if col_w_raw >= BASELINE_UNIT else max(BASELINE_UNIT, int(col_w_raw))
    col_xs = [outer_margin + c * (col_w + col_gap) for c in range(cols)]
    col_widths = [col_w for _ in range(cols)]
    resolved_right_margin = svg_w - outer_margin - (col_xs[-1] + col_w) if col_xs else outer_margin

    row_gap_snapped = int((max(0, row_gap) // BASELINE_UNIT) * BASELINE_UNIT)
    row_count = 1
    row_h = int((content_h // BASELINE_UNIT) * BASELINE_UNIT) if content_h > 0 else 0
    if row_h > 0:
        target_row_h = max(BASELINE_UNIT * 10, 80)
        row_count = max(1, int((content_h + row_gap_snapped) // (target_row_h + row_gap_snapped)))
        available = max(0, content_h - row_gap_snapped * max(0, row_count - 1))
        max_row_h = int((available // row_count // BASELINE_UNIT) * BASELINE_UNIT) if row_count > 0 else 0
        row_h = max(BASELINE_UNIT, max_row_h)

    row_ys = [outer_margin + r * (row_h + row_gap_snapped) for r in range(row_count)]
    row_heights = [row_h for _ in range(row_count)]
    resolved_bottom_margin = (
        svg_h - outer_margin - (row_ys[-1] + row_h)
        if row_ys
        else svg_h - outer_margin
    )

    return GridInfo(
        col_xs=col_xs,
        col_widths=col_widths,
        row_ys=row_ys,
        row_heights=row_heights,
        col_gap=col_gap,
        row_gap=row_gap_snapped,
        outer_margin=outer_margin,
        resolved_bottom_margin=int(max(0, round(resolved_bottom_margin))),
        resolved_right_margin=int(max(0, round(resolved_right_margin))),
        baseline_step=BASELINE_UNIT,
    )


# ---------------------------------------------------------------------------
# Pass 1: Measure (bottom-up)
# ---------------------------------------------------------------------------

def measure(frame: Frame, *, _is_root: bool = False) -> None:
    """Compute natural size of frame and all descendants.

    Sets frame._measured_w and frame._measured_h.

    Per-axis sizing:
      - FIXED: use explicit width/height
      - HUG: shrink to content
      - FILL: measured at content size (parent will assign final size in place())

    Non-root containers with FILL children on the primary axis use
    ``max(fill_measured) * fill_count`` so the parent reserves enough
    space for equal distribution.  The root container uses plain sum to
    avoid inflating the canvas.
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

    # Measure all children first (never as root)
    for child in frame.children:
        measure(child)

    pad_h = frame.padding_left + frame.padding_right
    pad_v = frame.padding_top + frame.padding_bottom
    heading_h = _heading_height(frame.heading)
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        # Primary axis (W): inflate for FILL equalization in non-root
        if not _is_root:
            fill_w = [c._measured_w for c in frame.children if c.sizing_w == Sizing.FILL]
            non_fill_w = sum(c._measured_w for c in frame.children if c.sizing_w != Sizing.FILL)
            if fill_w:
                content_w = max(fill_w) * len(fill_w) + non_fill_w + total_gap
            else:
                content_w = sum(c._measured_w for c in frame.children) + total_gap
        else:
            content_w = sum(c._measured_w for c in frame.children) + total_gap
        # Cross axis (H): always use max
        content_h = max(c._measured_h for c in frame.children) if frame.children else 0
    else:  # VERTICAL
        # Cross axis (W): always use max
        content_w = max(c._measured_w for c in frame.children) if frame.children else 0
        # Primary axis (H): inflate for FILL equalization in non-root
        if not _is_root:
            fill_h = [c._measured_h for c in frame.children if c.sizing_h == Sizing.FILL]
            non_fill_h = sum(c._measured_h for c in frame.children if c.sizing_h != Sizing.FILL)
            if fill_h:
                content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
            else:
                content_h = sum(c._measured_h for c in frame.children) + total_gap
        else:
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


# ---------------------------------------------------------------------------
# Pass 1.5: Constrained re-measurement (width-aware height correction)
# ---------------------------------------------------------------------------

def _resolve_child_widths(frame: Frame, frame_w: float) -> list[float]:
    """Compute the resolved width each child will receive during place().

    Mirrors the FILL distribution logic in place() without assigning
    positions, so the constrained re-measurement pass can know each
    child's actual width before heights are finalized.
    """
    if frame.is_leaf:
        return []

    pad_l = frame.padding_left
    pad_r = frame.padding_right
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        available = max(0, frame_w - pad_l - pad_r - total_gap)
        hug_total = 0
        fill_indices = []
        fill_measured = []
        fill_mins = []
        fill_maxes = []
        for i, child in enumerate(frame.children):
            if child.sizing_w == Sizing.FILL:
                fill_indices.append(i)
                fill_measured.append(child._measured_w)
                fill_mins.append(child.min_width)
                fill_maxes.append(child.max_width)
            else:
                # Use constrained size for space accounting
                w = child._measured_w
                w = _clamp_to_constraints(w, child.min_width, child.max_width)
                hug_total += w

        fill_sizes = _distribute_fill_space(available - hug_total, fill_measured, fill_mins, fill_maxes)

        # Build per-child width list
        widths = []
        fill_idx = 0
        for child in frame.children:
            if child.sizing_w == Sizing.FILL:
                w = round_up_to_grid(fill_sizes[fill_idx])
                fill_idx += 1
            elif child.sizing_w == Sizing.FIXED and child.width is not None:
                w = round_up_to_grid(child.width)
            else:
                w = round_up_to_grid(child._measured_w)
            w = _clamp_to_constraints(w, child.min_width, child.max_width)
            widths.append(w)
        return widths
    else:
        # Vertical: cross-axis is W — all children get the same cross width
        cross_w = max(0, frame_w - pad_l - pad_r)
        widths = []
        for child in frame.children:
            if child.sizing_w == Sizing.FILL:
                w = round_up_to_grid(cross_w)
            elif child.sizing_w == Sizing.FIXED and child.width is not None:
                w = round_up_to_grid(child.width)
            else:
                w = round_up_to_grid(child._measured_w)
            w = _clamp_to_constraints(w, child.min_width, child.max_width)
            widths.append(w)
        return widths


def _remeasure_with_width_constraints(root: Frame, root_w: float,
                                       coerced_ids: set | None = None) -> None:
    """Constrained re-measurement pass (runs between coercion and place).

    After measure() and _enforce_fill_hug_invariant(), all container widths
    are resolvable.  This pass:
    1. Walks the tree top-down, computing each node's resolved width.
    2. For leaves whose resolved width differs from the initial measurement
       width, re-wraps text and updates _measured_h.
    3. Walks bottom-up through HUG containers to propagate height changes.
    4. Refreshes any coerced parent heights that may have gone stale.

    This keeps the engine two-pass in spirit (measure → place) while
    ensuring text height is computed at the actual placed width.
    """
    _propagate_width_and_remeasure(root, root_w)
    _propagate_height_changes(root)
    _refresh_coerced_heights(root, coerced_ids or set())


def _propagate_width_and_remeasure(frame: Frame, resolved_w: float) -> None:
    """Top-down: resolve widths and re-measure leaves that need it.

    Re-measures ALL leaves whose resolved width differs from the initial
    measurement width, regardless of sizing_h.  Even FILL-height leaves
    need correct _measured_h because their HUG parents use it to compute
    their own height.  FIXED-height leaves are skipped (explicit height).
    """
    if frame.is_leaf:
        # FIXED height: determined by explicit value, not content
        if frame.sizing_h == Sizing.FIXED and frame.height is not None:
            return
        all_lines = _leaf_all_lines(frame)
        if not all_lines:
            return
        # Re-measure at the resolved width
        _, new_h = _leaf_natural_size(frame, constrained_w=resolved_w)
        new_h = round_up_to_grid(new_h)
        if new_h != frame._measured_h:
            frame._measured_h = new_h
        return

    # Container: resolve child widths and recurse
    frame._resolved_w = resolved_w
    child_widths = _resolve_child_widths(frame, resolved_w)
    for child, cw in zip(frame.children, child_widths):
        _propagate_width_and_remeasure(child, cw)


def _propagate_height_changes(frame: Frame) -> None:
    """Bottom-up: update container _measured_h for HUG-height containers
    whose children may have changed height during constrained re-measurement.
    """
    if frame.is_leaf:
        return

    for child in frame.children:
        _propagate_height_changes(child)

    # Only HUG-height containers need updating (FIXED/FILL heights are
    # determined by explicit value or parent assignment)
    if frame.sizing_h != Sizing.HUG:
        return

    pad_v = frame.padding_top + frame.padding_bottom
    heading_h = _heading_height(frame.heading, max_width=_heading_text_max_w(frame))
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        # Cross axis (H): max of children
        content_h = max(c._measured_h for c in frame.children) if frame.children else 0
    else:
        # Primary axis (H): sum (or inflate for FILL equalization)
        fill_h = [c._measured_h for c in frame.children if c.sizing_h == Sizing.FILL]
        non_fill_h = sum(c._measured_h for c in frame.children if c.sizing_h != Sizing.FILL)
        if fill_h:
            content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
        else:
            content_h = sum(c._measured_h for c in frame.children) + total_gap

    new_h = round_up_to_grid(content_h + pad_v + heading_h + heading_gap)
    frame._measured_h = new_h


def _refresh_coerced_heights(frame: Frame, coerced_ids: set) -> None:
    """Update coerced parents whose frozen heights may be stale after remeasure.

    _enforce_fill_hug_invariant() freezes HUG parents to FIXED by copying
    _measured_h into frame.height.  If child heights changed during the
    constrained re-measurement pass, those frozen values may be wrong.
    Re-derive the correct height from children and update both
    frame.height and frame._measured_h.

    Only frames whose IDs are in coerced_ids are refreshed.  Frames that
    were originally FIXED (user-set height) are preserved.
    """
    if frame.is_leaf:
        return
    for child in frame.children:
        _refresh_coerced_heights(child, coerced_ids)

    # Only refresh containers that were actually coerced by
    # _enforce_fill_hug_invariant (originally HUG, now FIXED).
    # Skip containers that were originally FIXED (user-set height/width).
    if not frame.id or frame.id not in coerced_ids:
        return

    # Recompute height using the same logic as measure() / _propagate_height_changes()
    pad_v = frame.padding_top + frame.padding_bottom
    heading_h = _heading_height(frame.heading, max_width=_heading_text_max_w(frame))
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        content_h = max(c._measured_h for c in frame.children) if frame.children else 0
        new_h = round_up_to_grid(content_h + pad_v + heading_h + heading_gap)
        frame._measured_h = new_h
        frame.height = new_h
    else:
        fill_h = [c._measured_h for c in frame.children if c.sizing_h == Sizing.FILL]
        non_fill_h = sum(c._measured_h for c in frame.children if c.sizing_h != Sizing.FILL)
        if fill_h:
            content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
        else:
            content_h = sum(c._measured_h for c in frame.children) + total_gap
        new_h = round_up_to_grid(content_h + pad_v + heading_h + heading_gap)
        frame._measured_h = new_h
        frame.height = new_h


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
        frame._placed_w = available_w
    elif frame.sizing_w == Sizing.FIXED and frame.width is not None:
        frame._placed_w = round_up_to_grid(frame.width)
    else:  # HUG, or FIXED without explicit width
        frame._placed_w = round_up_to_grid(frame._measured_w)
    frame._placed_w = _clamp_to_constraints(frame._placed_w, frame.min_width, frame.max_width)
    # Height
    if frame.sizing_h == Sizing.FILL:
        frame._placed_h = available_h
    elif frame.sizing_h == Sizing.FIXED and frame.height is not None:
        frame._placed_h = round_up_to_grid(frame.height)
    else:  # HUG, or FIXED without explicit height
        frame._placed_h = round_up_to_grid(frame._measured_h)
    frame._placed_h = _clamp_to_constraints(frame._placed_h, frame.min_height, frame.max_height)

    frame._placed_x = x
    frame._placed_y = y

    if frame.is_leaf:
        return

    # Distribute space to children
    pad_l = frame.padding_left
    pad_r = frame.padding_right
    pad_t = frame.padding_top
    pad_b = frame.padding_bottom
    # Heading height with placed width to account for text wrapping
    text_max_w = _heading_text_max_w(frame)
    if text_max_w is None:
        # Fallback for place() when _resolved_w wasn't set (shouldn't happen)
        effective_pad_l = pad_l if frame.border != Border.NONE else 0
        effective_pad_r = pad_r if frame.border != Border.NONE else 0
        icon_col = (ICON_SIZE + INSET) if frame.icon else 0
        text_max_w = frame._placed_w - effective_pad_l - effective_pad_r - icon_col
    heading_h = _heading_height(frame.heading, max_width=text_max_w)
    heading_gap = frame.gap if heading_h > 0 else 0
    n = len(frame.children)
    total_gap = frame.gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        available_for_children = max(0, frame._placed_w - pad_l - pad_r - total_gap)
        cross_size = max(0, frame._placed_h - pad_t - pad_b - heading_h - heading_gap)
    else:
        available_for_children = max(0, frame._placed_h - pad_t - pad_b - heading_h - heading_gap - total_gap)
        cross_size = max(0, frame._placed_w - pad_l - pad_r)

    # Primary-axis FILL distribution using iterative clamping:
    # 1. Try equal split among all FILL children.
    # 2. If any FILL child's measured size > equal share, clamp it at
    #    measured and redistribute remaining space among unclamped children.
    # 3. Repeat until stable.
    # This gives equal sizes when the parent has room, and never shrinks
    # a child below its content minimum.
    hug_total = 0
    fill_indices = []
    fill_measured = []
    fill_mins = []
    fill_maxes = []
    for i, child in enumerate(frame.children):
        primary_sizing = _child_primary_sizing(child, frame.direction)
        if primary_sizing == Sizing.FILL:
            fill_indices.append(i)
            m = child._measured_w if frame.direction == Direction.HORIZONTAL else child._measured_h
            fill_measured.append(m)
            if frame.direction == Direction.HORIZONTAL:
                fill_mins.append(child.min_width)
                fill_maxes.append(child.max_width)
            else:
                fill_mins.append(child.min_height)
                fill_maxes.append(child.max_height)
        else:
            main_size = child._measured_w if frame.direction == Direction.HORIZONTAL else child._measured_h
            # Use constrained size for space accounting
            if frame.direction == Direction.HORIZONTAL:
                main_size = _clamp_to_constraints(main_size, child.min_width, child.max_width)
            else:
                main_size = _clamp_to_constraints(main_size, child.min_height, child.max_height)
            hug_total += main_size

    fill_sizes = _distribute_fill_space(available_for_children - hug_total, fill_measured, fill_mins, fill_maxes)

    total_fill_placed = sum(fill_sizes)
    content_main = hug_total + total_fill_placed + total_gap

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
                child_w = fill_sizes[fill_idx]
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
                child_h = fill_sizes[fill_idx]
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

    # Separator role: dashed line at top (acts as the "border"),
    # text below with same INSET as bordered boxes for visual consistency.
    if frame.role == "separator":
        fg.append(DashedLinePrimitive(x, y, x + w, y, component_id=cid))
        if frame.label:
            fg.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(frame.label),
                                component_id=cid, max_width=w - 2 * INSET))
        return

    # Frame rect
    if frame.border != Border.NONE:
        stroke = "none" if frame.border == Border.FILL else "#000000"
        fg.append(Rect(x, y, w, h, fill=frame.fill.value, stroke=stroke,
                       dashed=(frame.border == Border.DASHED), component_id=cid))

    # Heading
    pad_l = frame.padding_left
    pad_t = frame.padding_top
    pad_r = frame.padding_right
    # Annotation style: border=NONE frames still get padding so their
    # text baselines align with bordered siblings.  Account for the 1px
    # border that bordered boxes have by adding 1px to annotation padding.
    if frame.border == Border.NONE:
        effective_pad_l = pad_l + 1
        effective_pad_t = pad_t + 1
        effective_pad_r = pad_r + 1
    else:
        effective_pad_l = pad_l
        effective_pad_t = pad_t
        effective_pad_r = pad_r
    # Available text width (inside padding, minus icon column if present)
    icon_col = (ICON_SIZE + INSET) if frame.icon else 0
    text_max_w = w - effective_pad_l - effective_pad_r - icon_col
    if frame.heading and not frame.is_leaf:
        fg.append(TextBlock(x + effective_pad_l, y + effective_pad_t, _lines_to_dicts([frame.heading]),
                            component_id=cid, max_width=text_max_w))

    # Heading icon
    if frame.icon and frame.is_container:
        icon_f = frame.icon_fill or "#000000"
        if frame.fill == Fill.BLACK and icon_f == "#000000":
            icon_f = "#FFFFFF"
        fg.append(Icon(x + w - effective_pad_r - ICON_SIZE, y + effective_pad_t, frame.icon,
                       fill=icon_f, component_id=cid))

    if frame.is_leaf:
        # Leaf content: heading + label as a single text block, plus icon
        all_lines = _leaf_all_lines(frame)
        if all_lines:
            text_fill = "#FFFFFF" if frame.fill == Fill.BLACK else "#000000"
            if frame.fill == Fill.BLACK:
                all_lines = [{**ln, "fill": text_fill} for ln in all_lines]
            fg.append(TextBlock(x + effective_pad_l, y + effective_pad_t, all_lines,
                                component_id=cid, max_width=text_max_w))
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

def _infer_sides(
    sx: float, sy: float, sw: float, sh: float,
    tx: float, ty: float, tw: float, th: float,
) -> tuple[str, str]:
    """Infer the best source and target sides from relative box positions."""
    dx = (tx + tw / 2) - (sx + sw / 2)
    dy = (ty + th / 2) - (sy + sh / 2)
    if abs(dy) >= abs(dx):
        # Primarily vertical relationship
        if dy >= 0:
            return "bottom", "top"
        else:
            return "top", "bottom"
    else:
        # Primarily horizontal relationship
        if dx >= 0:
            return "right", "left"
        else:
            return "left", "right"


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
        # Auto-infer sides when not explicitly specified
        if src_side is None or tgt_side is None:
            inferred_src, inferred_tgt = _infer_sides(sx, sy, sw, sh, tx, ty, tw, th)
            if src_side is None:
                src_side = inferred_src
            if tgt_side is None:
                tgt_side = inferred_tgt
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


def _parse_ref(ref: str) -> tuple[str, str | None]:
    """Parse 'component_id.side' into (id, side).

    If no explicit side is given, returns None so the router can
    infer the best side from relative box positions.
    """
    if "." in ref:
        parts = ref.rsplit(".", 1)
        if parts[1] in ("top", "bottom", "left", "right"):
            return parts[0], parts[1]
    return ref, None


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

    # Pass 1: measure (root uses sum-based sizing to avoid canvas inflation)
    measure(root, _is_root=True)

    # Figma invariant: HUG parent + FILL child on primary axis → parent freezes to FIXED
    coerced = _enforce_fill_hug_invariant(root)

    # Root gets its measured size (or fixed if set)
    root_w = root.width if root.width is not None else root._measured_w

    # Pass 1.5: constrained re-measurement — re-wrap text at resolved
    # widths so HUG heights reflect actual placed widths, not the default
    # BLOCK_WIDTH used during initial measurement.
    _remeasure_with_width_constraints(root, root_w, coerced_ids=set(coerced.keys()))

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
    grid_info = _build_grid_info(diagram, root)

    return LayoutResult(
        width=int(root._placed_w),
        height=int(root._placed_h),
        foreground=fg,
        background=bg,
        grid_info=grid_info,
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
            heading_text=frame.heading.content if frame.heading else "",
            label_text=[line.content for line in frame.label],
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
