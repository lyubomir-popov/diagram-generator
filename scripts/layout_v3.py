"""Frame-based two-pass layout engine.

Pass 1 — measure(): bottom-up, computes natural size of each Frame.
Pass 2 — place(): top-down, assigns positions and distributes fill space.

Output: a LayoutResult compatible with the existing renderer pipeline.
The engine emits the same Primitive types as diagram_layout so existing
SVG and draw.io renderers work unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from frame_model import Frame, FrameDiagram, Direction, Overlay, Sizing, Align, Justify
from diagram_model import Arrow, Line, Fill, Border
from diagram_layout import (
    ArrowPrimitive,
    ComponentInfo,
    DashedLinePrimitive,
    FrameBox,
    GridInfo,
    Icon,
    LayoutResult,
    Rect,
    TextBlock,
    _lines_to_dicts,
)
from diagram_shared import (
    BASELINE_UNIT,
    BLOCK_WIDTH,
    BOX_MIN_HEIGHT,
    INSET,
    ICON_SIZE,
    BODY_LINE_STEP,
    estimate_line_width,
    make_line,
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
    fill_weights: list[float] | None = None,
) -> list[float]:
    """Distribute available space among FILL children.

    FILL means "accept whatever space the parent gives me."  The algorithm:

    1. Split proportionally by weight (default weight = 1 = equal split).
    2. If any child has a min constraint (or max constraint) that prevents
       its proportional share, clamp it and redistribute among the rest.
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

    # Resolve effective min/max and weights for each child
    eff_mins = [0.0] * n
    eff_maxes = [float('inf')] * n
    weights = [1.0] * n
    if fill_mins:
        for i in range(min(n, len(fill_mins))):
            if fill_mins[i] is not None:
                eff_mins[i] = fill_mins[i]
    if fill_maxes:
        for i in range(min(n, len(fill_maxes))):
            if fill_maxes[i] is not None:
                eff_maxes[i] = fill_maxes[i]
    if fill_weights:
        for i in range(min(n, len(fill_weights))):
            weights[i] = max(0, fill_weights[i])

    # Iterative clamping: clamp children at min or max when the proportional
    # share violates their constraints, then redistribute.
    while unclamped:
        total_weight = sum(weights[i] for i in unclamped)
        clamped_any = False
        for idx in list(unclamped):
            share = (remaining * weights[idx] / total_weight) if total_weight > 0 else (remaining / len(unclamped))
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
            tw = sum(weights[i] for i in unclamped)
            for idx in unclamped:
                sizes[idx] = (remaining * weights[idx] / tw) if tw > 0 else (remaining / len(unclamped))
            break
    return sizes


def _snap_fills_to_grid_columns(
    fill_sizes: list[float],
    fill_weights: list[float],
    col_w: float,
    col_gap: float,
    total_cols: int,
) -> list[float]:
    """Snap FILL sizes to grid column spans based on weights.

    Each FILL child is assigned an integer number of columns proportional
    to its fill_weight.  The width is then ``n * col_w + (n-1) * col_gap``.

    Column assignment uses largest-remainder allocation so the total always
    equals ``total_cols`` when the fill children own all columns.
    """
    n = len(fill_sizes)
    if n == 0 or col_w <= 0 or total_cols <= 0:
        return fill_sizes

    total_weight = sum(fill_weights)
    if total_weight <= 0:
        return fill_sizes

    # Allocate columns proportionally with largest-remainder rounding
    raw_cols = [(w / total_weight) * total_cols for w in fill_weights]
    floor_cols = [int(c) for c in raw_cols]
    remainders = [(raw_cols[i] - floor_cols[i], i) for i in range(n)]
    # Ensure at least 1 column per child
    for i in range(n):
        if floor_cols[i] < 1:
            floor_cols[i] = 1
    allocated = sum(floor_cols)
    # Distribute remaining columns by largest remainder
    remainders.sort(key=lambda r: r[0], reverse=True)
    for _, idx in remainders:
        if allocated >= total_cols:
            break
        floor_cols[idx] += 1
        allocated += 1

    # Convert column counts to pixel widths
    result = []
    for i in range(n):
        nc = floor_cols[i]
        w = nc * col_w + max(0, nc - 1) * col_gap
        result.append(w)
    return result


def _stroke_inset_per_side(frame: Frame) -> int:
    """Return the inside-stroke inset applied on each side of stroked frames."""
    return 1 if frame.border in (Border.SOLID, Border.DASHED) else 0


def _stroke_space_total(frame: Frame) -> int:
    """Return the total inner span consumed by a visible border."""
    return _stroke_inset_per_side(frame) * 2


def _estimate_text_width(lines: list[Line]) -> float:
    """Estimate the pixel width of the widest text line."""
    max_w = 0.0
    for ln in lines:
        max_w = max(max_w, estimate_line_width(_lines_to_dicts([ln])[0]))
    return max_w


def _leaf_all_lines(frame: Frame) -> list[dict]:
    """Convert a leaf node's label lines to dicts for measurement/rendering."""
    if frame.label:
        return _lines_to_dicts(frame.label)
    return []


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
        text_w = _estimate_text_width(list(frame.label))
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
        else (root.padding_top if root.padding_top is not None else (root.padding or 0))
    )

    svg_w = int(root._placed_w)
    svg_h = int(root._placed_h)
    content_w = max(0, svg_w - 2 * outer_margin)
    content_h = max(0, svg_h - 2 * outer_margin)

    col_w_raw = ((content_w - (cols - 1) * col_gap) / cols) if cols > 1 else content_w
    col_w = int((col_w_raw // BASELINE_UNIT) * BASELINE_UNIT) if col_w_raw >= BASELINE_UNIT else max(BASELINE_UNIT, int(col_w_raw))
    col_xs = [outer_margin + c * (col_w + col_gap) for c in range(cols)]
    # Give the last column any remaining pixels so columns span the full content area
    last_col_w = max(col_w, content_w - (cols - 1) * (col_w + col_gap)) if cols > 1 else content_w
    col_widths = [col_w for _ in range(cols - 1)] + [last_col_w] if cols > 1 else [content_w]
    resolved_right_margin = svg_w - (col_xs[-1] + col_widths[-1]) if col_xs else outer_margin

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
        svg_h - (row_ys[-1] + row_h)
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


def _expand_root_width_for_snapped_fill_columns(root: Frame, requested_w: float) -> float:
    """Treat the requested root width as a minimum when fill columns would be fractional."""
    if requested_w <= 0 or root.is_leaf or root.direction != Direction.HORIZONTAL:
        return requested_w
    if root.justify != Justify.PACKED:
        return requested_w

    fill_children = [
        child for child in root.children
        if _child_primary_sizing(child, root.direction) == Sizing.FILL
    ]
    if not fill_children:
        return requested_w

    pad_l = root.padding_left
    pad_r = root.padding_right
    stroke_space = _stroke_space_total(root)
    total_gap = root.gap * max(0, len(root.children) - 1)

    non_fill_total = 0.0
    for child in root.children:
        if _child_primary_sizing(child, root.direction) == Sizing.FILL:
            continue
        child_w = (
            round_up_to_grid(child.width)
            if child.sizing_w == Sizing.FIXED and child.width is not None
            else round_up_to_grid(child._measured_w)
        )
        non_fill_total += _clamp_to_constraints(child_w, child.min_width, child.max_width)

    fill_count = len(fill_children)
    available_for_fill = max(0.0, requested_w - pad_l - pad_r - stroke_space - total_gap - non_fill_total)
    snapped_share = round_up_to_grid(available_for_fill / fill_count) if fill_count > 0 else 0
    min_fill_share = max(
        (round_up_to_grid(child.min_width) if child.min_width is not None else 0)
        for child in fill_children
    )
    snapped_share = max(snapped_share, min_fill_share)

    compatible_w = pad_l + pad_r + stroke_space + total_gap + non_fill_total + fill_count * snapped_share
    return max(requested_w, compatible_w)


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
        w = _clamp_to_constraints(w, frame.min_width, frame.max_width)
        h = _clamp_to_constraints(h, frame.min_height, frame.max_height)
        frame._measured_w = round_up_to_grid(w)
        frame._measured_h = round_up_to_grid(h)
        return

    # Measure all children first (never as root)
    for child in frame.children:
        measure(child)

    # Only auto (in-flow) children contribute to parent's content size
    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]

    pad_h = frame.padding_left + frame.padding_right
    pad_v = frame.padding_top + frame.padding_bottom
    n = len(auto_children)
    total_gap = frame.gap * max(0, n - 1)

    if (frame.direction == Direction.HORIZONTAL and frame.wrap
            and frame.sizing_w == Sizing.FIXED and frame.width is not None):
        # Wrap mode with known width: break children into rows.
        avail_w = max(0, round_up_to_grid(frame.width) - pad_h - _stroke_space_total(frame))
        rows = _break_into_rows(auto_children, avail_w, frame.gap)
        content_w = avail_w
        content_h = sum(r["height"] for r in rows) + frame.gap * max(0, len(rows) - 1)
    elif frame.direction == Direction.HORIZONTAL:
        # Primary axis (W): inflate for FILL equalization in non-root
        if not _is_root:
            fill_w = [c._measured_w for c in auto_children if c.sizing_w == Sizing.FILL]
            non_fill_w = sum(c._measured_w for c in auto_children if c.sizing_w != Sizing.FILL)
            if fill_w:
                content_w = max(fill_w) * len(fill_w) + non_fill_w + total_gap
            else:
                content_w = sum(c._measured_w for c in auto_children) + total_gap
        else:
            content_w = sum(c._measured_w for c in auto_children) + total_gap
        # Cross axis (H): always use max
        content_h = max(c._measured_h for c in auto_children) if auto_children else 0
    else:  # VERTICAL
        # Cross axis (W): always use max
        content_w = max(c._measured_w for c in auto_children) if auto_children else 0
        # Primary axis (H): inflate for FILL equalization in non-root
        if not _is_root:
            fill_h = [c._measured_h for c in auto_children if c.sizing_h == Sizing.FILL]
            non_fill_h = sum(c._measured_h for c in auto_children if c.sizing_h != Sizing.FILL)
            if fill_h:
                content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
            else:
                content_h = sum(c._measured_h for c in auto_children) + total_gap
        else:
            content_h = sum(c._measured_h for c in auto_children) + total_gap

    content_based_w = round_up_to_grid(content_w + pad_h)
    content_based_h = round_up_to_grid(content_h + pad_v)

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
# Wrap helper: break children into rows by available width
# ---------------------------------------------------------------------------

def _break_into_rows(children, avail_w, gap):
    """Break children into rows that fit within *avail_w*.

    Each child's ``_measured_w`` is used for row-breaking decisions.
    A single child that exceeds *avail_w* gets its own row (never split).
    Returns a list of dicts with keys ``children``, ``width``, ``height``.
    """
    if not children:
        return []

    rows = []
    current_row = []
    current_row_w = 0

    for child in children:
        child_w = child._measured_w
        would_be_w = child_w if not current_row else current_row_w + gap + child_w

        if current_row and would_be_w > avail_w:
            rows.append({
                "children": current_row,
                "width": current_row_w,
                "height": max(c._measured_h for c in current_row),
            })
            current_row = [child]
            current_row_w = child_w
        else:
            current_row.append(child)
            current_row_w = would_be_w

    if current_row:
        rows.append({
            "children": current_row,
            "width": current_row_w,
            "height": max(c._measured_h for c in current_row),
        })

    return rows


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

def _resolve_col_spans(frame: Frame, col_w: int, col_gap: int) -> None:
    """Walk the tree and convert col_span to explicit width + FIXED sizing.

    ``col_span: N`` means the frame should span exactly N grid columns:
    ``width = N * col_w + (N - 1) * col_gap``.  This sets ``sizing_w``
    to FIXED and assigns the computed ``width``, making the frame a
    first-class autolayout citizen with a grid-derived fixed dimension.
    """
    if frame.col_span is not None and frame.col_span >= 1:
        n = frame.col_span
        frame.width = n * col_w + max(0, n - 1) * col_gap
        frame.sizing_w = Sizing.FIXED
    for child in frame.children:
        _resolve_col_spans(child, col_w, col_gap)

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

    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]

    if frame.direction == Direction.HORIZONTAL:
        # Primary axis is W — freeze parent HUG→FIXED if any auto child is FILL
        if frame.sizing_w == Sizing.HUG:
            if any(c.sizing_w == Sizing.FILL for c in auto_children):
                frame.sizing_w = Sizing.FIXED
                frame.width = frame._measured_w
                if frame.id:
                    coerced.setdefault(frame.id, {})
                    coerced[frame.id]["sizing_w"] = "FIXED"
                    coerced[frame.id]["width"] = int(frame._measured_w)
        # Cross axis (H): do NOT coerce — FILL children stretch to cross size
    else:  # VERTICAL
        # Primary axis is H — freeze parent HUG→FIXED if any auto child is FILL
        if frame.sizing_h == Sizing.HUG:
            if any(c.sizing_h == Sizing.FILL for c in auto_children):
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
    stroke_space = _stroke_space_total(frame)
    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]
    n = len(auto_children)
    total_gap = frame.gap * max(0, n - 1)

    # Pre-compute absolute children's widths (they don't participate in flow)
    content_w_for_abs = max(0, frame_w - pad_l - pad_r - stroke_space)
    abs_width_map = {}
    for child in frame.children:
        if child.position_type == "ABSOLUTE":
            if child.sizing_w == Sizing.FILL:
                w = round_up_to_grid(content_w_for_abs)
            elif child.sizing_w == Sizing.FIXED and child.width is not None:
                w = round_up_to_grid(child.width)
            else:
                w = round_up_to_grid(child._measured_w)
            abs_width_map[id(child)] = _clamp_to_constraints(w, child.min_width, child.max_width)

    if frame.direction == Direction.HORIZONTAL:
        available = max(0, frame_w - pad_l - pad_r - stroke_space - total_gap)
        hug_total = 0
        fill_indices = []
        fill_measured = []
        fill_mins = []
        fill_maxes = []
        fill_weights = []
        for i, child in enumerate(auto_children):
            if child.sizing_w == Sizing.FILL:
                fill_indices.append(i)
                fill_measured.append(child._measured_w)
                fill_mins.append(child.min_width)
                fill_maxes.append(child.max_width)
                fill_weights.append(child.fill_weight)
            else:
                # Use constrained size for space accounting
                w = child._measured_w
                w = _clamp_to_constraints(w, child.min_width, child.max_width)
                hug_total += w

        fill_sizes = _distribute_fill_space(available - hug_total, fill_measured, fill_mins, fill_maxes, fill_weights)

        # Build per-child width list
        widths = []
        fill_idx = 0
        for child in frame.children:
            if child.position_type == "ABSOLUTE":
                widths.append(abs_width_map[id(child)])
                continue
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
        cross_w = max(0, frame_w - pad_l - pad_r - stroke_space)
        widths = []
        for child in frame.children:
            if child.position_type == "ABSOLUTE":
                widths.append(abs_width_map[id(child)])
                continue
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
        new_h = _clamp_to_constraints(new_h, frame.min_height, frame.max_height)
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

    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]
    pad_v = frame.padding_top + frame.padding_bottom
    n = len(auto_children)
    total_gap = frame.gap * max(0, n - 1)

    if (frame.direction == Direction.HORIZONTAL and frame.wrap
            and frame.sizing_w == Sizing.FIXED and frame.width is not None):
        avail_w = max(0, round_up_to_grid(frame.width) - frame.padding_left
                       - frame.padding_right - _stroke_space_total(frame))
        rows = _break_into_rows(auto_children, avail_w, frame.gap)
        content_h = sum(r["height"] for r in rows) + frame.gap * max(0, len(rows) - 1)
    elif frame.direction == Direction.HORIZONTAL:
        # Cross axis (H): max of children
        content_h = max(c._measured_h for c in auto_children) if auto_children else 0
    else:
        # Primary axis (H): sum (or inflate for FILL equalization)
        fill_h = [c._measured_h for c in auto_children if c.sizing_h == Sizing.FILL]
        non_fill_h = sum(c._measured_h for c in auto_children if c.sizing_h != Sizing.FILL)
        if fill_h:
            content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
        else:
            content_h = sum(c._measured_h for c in auto_children) + total_gap

    new_h = round_up_to_grid(content_h + pad_v)
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
    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]
    pad_v = frame.padding_top + frame.padding_bottom
    n = len(auto_children)
    total_gap = frame.gap * max(0, n - 1)

    if (frame.direction == Direction.HORIZONTAL and frame.wrap
            and frame.sizing_w == Sizing.FIXED and frame.width is not None):
        avail_w = max(0, round_up_to_grid(frame.width) - frame.padding_left
                       - frame.padding_right - _stroke_space_total(frame))
        rows = _break_into_rows(auto_children, avail_w, frame.gap)
        content_h = sum(r["height"] for r in rows) + frame.gap * max(0, len(rows) - 1)
        new_h = round_up_to_grid(content_h + pad_v)
        frame._measured_h = new_h
        frame.height = new_h
    elif frame.direction == Direction.HORIZONTAL:
        content_h = max(c._measured_h for c in auto_children) if auto_children else 0
        new_h = round_up_to_grid(content_h + pad_v)
        frame._measured_h = new_h
        frame.height = new_h
    else:
        fill_h = [c._measured_h for c in auto_children if c.sizing_h == Sizing.FILL]
        non_fill_h = sum(c._measured_h for c in auto_children if c.sizing_h != Sizing.FILL)
        if fill_h:
            content_h = max(fill_h) * len(fill_h) + non_fill_h + total_gap
        else:
            content_h = sum(c._measured_h for c in auto_children) + total_gap
        new_h = round_up_to_grid(content_h + pad_v)
        frame._measured_h = new_h
        frame.height = new_h


def _child_primary_sizing(child: Frame, direction: Direction) -> Sizing:
    """Get the child's sizing on the parent's primary axis."""
    return child.sizing_w if direction == Direction.HORIZONTAL else child.sizing_h


def _child_counter_sizing(child: Frame, direction: Direction) -> Sizing:
    """Get the child's sizing on the parent's counter (cross) axis."""
    return child.sizing_h if direction == Direction.HORIZONTAL else child.sizing_w


def place(frame: Frame, x: float, y: float, available_w: float, available_h: float,
          *, grid_snap: tuple[float, float, int] | None = None) -> None:
    """Assign position and final size to frame and all descendants.

    Sets frame._placed_x, _placed_y, _placed_w, _placed_h.

    Per-axis sizing determines final size:
      - FILL: accept whatever the parent assigns (available_w/h)
      - FIXED: use explicit width/height
      - HUG: use measured (content) size

    ``grid_snap``: optional ``(col_w, col_gap, total_cols)`` tuple.  When
    provided, horizontal FILL children with ``fill_weight`` have their widths
    snapped to integer grid-column spans.  Passed down to child ``place()``
    calls so nested containers also benefit.
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
    stroke_space = _stroke_space_total(frame)
    auto_children = [c for c in frame.children if c.position_type != "ABSOLUTE"]
    n = len(auto_children)

    # For justify modes other than PACKED, gap is replaced by computed
    # spacing — all inner space is available for children + distribution.
    use_justify = frame.justify != Justify.PACKED and n > 0
    effective_gap = 0 if use_justify else frame.gap
    total_gap = effective_gap * max(0, n - 1)

    if frame.direction == Direction.HORIZONTAL:
        available_for_children = max(0, frame._placed_w - pad_l - pad_r - stroke_space - total_gap)
        cross_size = max(0, frame._placed_h - pad_t - pad_b - stroke_space)
    else:
        available_for_children = max(0, frame._placed_h - pad_t - pad_b - stroke_space - total_gap)
        cross_size = max(0, frame._placed_w - pad_l - pad_r - stroke_space)

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
    fill_weights = []
    for i, child in enumerate(auto_children):
        primary_sizing = _child_primary_sizing(child, frame.direction)
        if primary_sizing == Sizing.FILL:
            fill_indices.append(i)
            m = child._measured_w if frame.direction == Direction.HORIZONTAL else child._measured_h
            fill_measured.append(m)
            fill_weights.append(child.fill_weight)
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

    fill_sizes = _distribute_fill_space(available_for_children - hug_total, fill_measured, fill_mins, fill_maxes, fill_weights)

    # Grid-column snapping: when grid info is available and we're distributing
    # horizontally, snap FILL widths to integer column spans.
    # Only snap when the container's own gap matches the grid col_gap — nested
    # containers with different gaps (e.g. services__body with gap=8 inside a
    # grid with col_gap=32) should use normal fill distribution, not grid snap.
    # When snap IS applied, stop propagating grid_snap to children: they occupy
    # a subset of the root grid and would get wrong column allocations.
    snapped_here = False
    if grid_snap and frame.direction == Direction.HORIZONTAL and fill_sizes:
        col_w, col_gap_g, total_cols = grid_snap
        gap_matches_grid = (frame.gap == col_gap_g)
        # Only snap when ALL auto children are FILL — mixed HUG+FILL rows
        # can't map cleanly to grid columns because HUG siblings eat space
        # that isn't accounted for in the column allocation.
        all_fill = (len(fill_sizes) == len(auto_children))
        if gap_matches_grid and all_fill:
            has_explicit_weights = any(w != 1.0 for w in fill_weights)
            if has_explicit_weights or len(fill_sizes) > 1:
                fill_sizes = _snap_fills_to_grid_columns(
                    fill_sizes, fill_weights, col_w, col_gap_g, total_cols,
                )
                snapped_here = True
    child_grid_snap = None if snapped_here else grid_snap

    total_fill_placed = sum(fill_sizes)
    content_main = hug_total + total_fill_placed + total_gap

    # Compute main-axis positioning: offset before first child and gap
    # between children.  For PACKED, use alignment + fixed gap.
    # For justify modes, use computed spacing from remaining space.
    inner_w = frame._placed_w - pad_l - pad_r - stroke_space
    inner_h = frame._placed_h - pad_t - pad_b - stroke_space
    inner_main = inner_w if frame.direction == Direction.HORIZONTAL else inner_h

    if not use_justify:
        # PACKED: alignment positions the content group, fixed gap between children
        if frame.direction == Direction.HORIZONTAL:
            main_offset = _align_offset(frame.align, inner_w, content_main, "x")
        else:
            main_offset = _align_offset(frame.align, inner_h, content_main, "y")
        child_gap = frame.gap
    else:
        remaining = max(0, inner_main - content_main)
        if frame.justify == Justify.SPACE_BETWEEN:
            main_offset = 0
            child_gap = remaining / (n - 1) if n > 1 else 0
        elif frame.justify == Justify.SPACE_AROUND:
            child_gap = remaining / n if n > 0 else 0
            main_offset = child_gap / 2
        elif frame.justify == Justify.SPACE_EVENLY:
            child_gap = remaining / (n + 1)
            main_offset = child_gap
        else:
            main_offset = 0
            child_gap = frame.gap

    # Place children sequentially.
    # Cross-axis: FILL children stretch to fill; HUG/FIXED children keep
    # their measured size and are positioned by parent alignment offset.
    # This is the Figma-correct model: alignment never changes sizing.

    if frame.wrap and frame.direction == Direction.HORIZONTAL:
        # Wrap mode: break children into rows, place each row
        inner_w = frame._placed_w - pad_l - pad_r - stroke_space
        rows = _break_into_rows(auto_children, inner_w, frame.gap)
        cursor_y = y + pad_t

        for row in rows:
            cursor_x = x + pad_l
            for child in row["children"]:
                child_w = child._measured_w

                if child.sizing_h == Sizing.FILL:
                    child_h = row["height"]
                    child_y = cursor_y
                else:
                    child_h = child._measured_h
                    cross_offset = _align_offset(frame.align, row["height"], child._measured_h, "y")
                    child_y = cursor_y + cross_offset

                place(child, cursor_x, child_y, child_w, child_h, grid_snap=child_grid_snap)
                cursor_x += child._placed_w + frame.gap
            cursor_y += row["height"] + frame.gap
    elif frame.direction == Direction.HORIZONTAL:
        cursor_x = x + pad_l + main_offset
        fill_idx = 0
        for child in auto_children:
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
                child_y = y + pad_t
            else:
                child_h = child._measured_h
                cross_offset = _align_offset(frame.align, cross_size, child._measured_h, "y")
                child_y = y + pad_t + cross_offset
            place(child, cursor_x, child_y, child_w, child_h, grid_snap=child_grid_snap)
            cursor_x += child._placed_w + child_gap
    else:  # VERTICAL
        cursor_y = y + pad_t + main_offset
        fill_idx = 0
        for child in auto_children:
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
            place(child, child_x, cursor_y, child_w, child_h, grid_snap=child_grid_snap)
            cursor_y += child._placed_h + child_gap

    # Place absolute children at their explicit x/y offsets relative to parent content area
    content_x = x + pad_l
    content_y = y + pad_t
    abs_content_w = max(0, frame._placed_w - pad_l - pad_r - stroke_space)
    abs_content_h = max(0, frame._placed_h - pad_t - pad_b - stroke_space)
    for child in frame.children:
        if child.position_type != "ABSOLUTE":
            continue
        abs_w = abs_content_w if child.sizing_w == Sizing.FILL else (
            round_up_to_grid(child.width) if child.sizing_w == Sizing.FIXED and child.width is not None
            else child._measured_w)
        abs_h = abs_content_h if child.sizing_h == Sizing.FILL else (
            round_up_to_grid(child.height) if child.sizing_h == Sizing.FIXED and child.height is not None
            else child._measured_h)
        place(child, content_x + child.x, content_y + child.y, abs_w, abs_h, grid_snap=child_grid_snap)


# ---------------------------------------------------------------------------
# Render: convert placed Frame tree to primitives
# ---------------------------------------------------------------------------

def _render_frame(frame: Frame, fg: list, bg: list, bounds_map: dict,
                  *, _parent_id: str | None = None) -> None:
    """Emit rendering primitives for a placed Frame."""
    x = frame._placed_x
    y = frame._placed_y
    w = frame._placed_w
    h = frame._placed_h
    cid = frame.id or None

    # Store bounds for arrow routing (skip internal IDs).
    # Format: (x, y, w, h, is_leaf, parent_id)
    if cid and not cid.startswith("__"):
        bounds_map[cid] = (x, y, w, h, frame.is_leaf, _parent_id)

    # Separator role: emit a visual dashed line at the top of bounds.
    # The FrameBox below provides the hit-testing rect and label text.
    if frame.role == "separator":
        fg.append(DashedLinePrimitive(x, y, x + w, y, component_id=cid))

    # ── Resolve style fields ──
    if frame.fill == Fill.BLACK:
        box_fill = Fill.BLACK.value
        box_stroke = "none"
    elif frame.border == Border.FILL:
        box_fill = frame.fill.value
        box_stroke = "none"
    elif frame.border == Border.NONE:
        box_fill = frame.fill.value if frame.fill != Fill.WHITE else "transparent"
        box_stroke = "none"
    elif frame.is_container and frame.border != Border.DASHED:
        box_fill = Fill.GREY.value
        box_stroke = "none"
    else:
        box_fill = "transparent"
        box_stroke = "#000000"

    # Effective padding: border=NONE frames compensate for the missing 1px
    # border stroke so text baselines align with bordered siblings.
    pad_l = frame.padding_left
    pad_t = frame.padding_top
    pad_r = frame.padding_right
    pad_b = frame.padding_bottom
    if frame.border == Border.NONE:
        pad_l += 1
        pad_t += 1
        pad_r += 1

    icon_col = (ICON_SIZE + INSET) if frame.icon else 0
    text_max_w = w - pad_l - pad_r - icon_col

    # ── Build text content ──
    heading_lines: list[dict] = []
    label_lines: list[dict] = []
    icon_name = frame.icon
    icon_fill_color = frame.icon_fill or "#000000"
    if frame.fill == Fill.BLACK and icon_fill_color == "#000000":
        icon_fill_color = "#FFFFFF"

    if frame.is_leaf:
        all_lines = _leaf_all_lines(frame)
        if all_lines:
            if frame.fill == Fill.BLACK:
                all_lines = [{**ln, "fill": "#FFFFFF"} for ln in all_lines]
            label_lines = all_lines
    # Container icon only (leaf icon goes via label_lines path)
    # — icon_name is already set above

    fg.append(FrameBox(
        x=x, y=y, width=w, height=h,
        fill=box_fill, stroke=box_stroke,
        dashed=(frame.border == Border.DASHED),
        padding_top=pad_t, padding_right=pad_r,
        padding_bottom=pad_b, padding_left=pad_l,
        heading_lines=heading_lines,
        label_lines=label_lines,
        text_max_width=text_max_w,
        icon_name=icon_name if icon_name else None,
        icon_fill=icon_fill_color,
        component_id=cid,
    ))

    # Container: render children recursively
    effective_parent = cid if (cid and not cid.startswith("__")) else _parent_id
    if frame.is_container:
        for child in frame.children:
            _render_frame(child, fg, bg, bounds_map, _parent_id=effective_parent)


# ---------------------------------------------------------------------------
# Arrow routing — obstacle-aware orthogonal router
# ---------------------------------------------------------------------------
#
# Strategy: grid-based A* on orthogonal channels between boxes.
#
# 1. Collect obstacle rectangles from bounds_map (inflated by ARROW_CLEARANCE).
# 2. Build a sparse set of candidate X and Y coordinates from obstacle edges,
#    the start point, and the end point.
# 3. A* search on the resulting grid graph, where each cell transition is
#    blocked if the segment crosses an inflated obstacle.
# 4. Simplify the resulting path (remove redundant collinear points).
#
# This replaces the naive midpoint router with ~200 lines of real routing.

import heapq
from typing import NamedTuple

ARROW_CLEARANCE = 12  # px buffer around boxes for arrow paths


class _Pt(NamedTuple):
    x: float
    y: float


def _inflated_rect(x: float, y: float, w: float, h: float, margin: float):
    """Return (x0, y0, x1, y1) inflated by margin."""
    return (x - margin, y - margin, x + w + margin, y + h + margin)


def _segment_crosses_obstacle(
    ax: float, ay: float, bx: float, by: float,
    obstacles: list[tuple[float, float, float, float]],
) -> bool:
    """Check if an axis-aligned segment (ax,ay)→(bx,by) crosses any obstacle interior."""
    # Segment must be axis-aligned
    if ax == bx:
        # Vertical segment
        x = ax
        lo_y, hi_y = (min(ay, by), max(ay, by))
        for ox0, oy0, ox1, oy1 in obstacles:
            if ox0 < x < ox1 and oy0 < hi_y and oy1 > lo_y:
                return True
    elif ay == by:
        # Horizontal segment
        y = ay
        lo_x, hi_x = (min(ax, bx), max(ax, bx))
        for ox0, oy0, ox1, oy1 in obstacles:
            if oy0 < y < oy1 and ox0 < hi_x and ox1 > lo_x:
                return True
    return False


def _build_routing_grid(
    start: _Pt, end: _Pt,
    obstacles: list[tuple[float, float, float, float]],
) -> tuple[list[float], list[float]]:
    """Build sorted lists of candidate X and Y coordinates for routing grid.

    Adds channel midpoints between adjacent grid lines so the router has
    more options for routing through gaps between obstacles.
    """
    xs: set[float] = {start.x, end.x}
    ys: set[float] = {start.y, end.y}
    for x0, y0, x1, y1 in obstacles:
        xs.update([x0, x1])
        ys.update([y0, y1])
    # Add channel midpoints between adjacent coordinates
    sorted_xs = sorted(xs)
    sorted_ys = sorted(ys)
    for i in range(len(sorted_xs) - 1):
        xs.add((sorted_xs[i] + sorted_xs[i + 1]) / 2)
    for i in range(len(sorted_ys) - 1):
        ys.add((sorted_ys[i] + sorted_ys[i + 1]) / 2)
    return sorted(xs), sorted(ys)


def _astar_orthogonal(
    start: _Pt, end: _Pt,
    obstacles: list[tuple[float, float, float, float]],
    src_side: str, tgt_side: str,
) -> list[_Pt]:
    """A* search on sparse orthogonal grid, returning waypoint list."""
    xs, ys = _build_routing_grid(start, end, obstacles)

    # Map coordinates to grid indices for fast lookup
    xi = {x: i for i, x in enumerate(xs)}
    yi = {y: i for i, y in enumerate(ys)}

    if start.x not in xi or start.y not in yi or end.x not in xi or end.y not in yi:
        # Fallback if start/end not on grid (shouldn't happen)
        return [end]

    start_node = (xi[start.x], yi[start.y])
    end_node = (xi[end.x], yi[end.y])

    # Direction vectors: right, left, down, up
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]

    # Priority queue: (f_score, counter, node, came_from_dir)
    counter = 0
    open_set: list[tuple[float, int, tuple[int, int], int | None]] = []
    heapq.heappush(open_set, (0.0, counter, start_node, None))
    counter += 1

    g_score: dict[tuple[int, int], float] = {start_node: 0.0}
    came_from: dict[tuple[int, int], tuple[int, int] | None] = {start_node: None}
    came_dir: dict[tuple[int, int], int | None] = {start_node: None}

    nx_max = len(xs) - 1
    ny_max = len(ys) - 1

    while open_set:
        f, _, current, c_dir = heapq.heappop(open_set)

        if current == end_node:
            # Reconstruct path
            path: list[_Pt] = []
            node: tuple[int, int] | None = current
            while node is not None:
                path.append(_Pt(xs[node[0]], ys[node[1]]))
                node = came_from.get(node)
            path.reverse()
            return path

        cur_g = g_score[current]
        cx, cy = current

        for di, (ddx, ddy) in enumerate(dirs):
            nx_i = cx + ddx
            ny_i = cy + ddy
            if nx_i < 0 or nx_i > nx_max or ny_i < 0 or ny_i > ny_max:
                continue
            neighbor = (nx_i, ny_i)

            # Check segment for obstacle crossing
            seg_ax, seg_ay = xs[cx], ys[cy]
            seg_bx, seg_by = xs[nx_i], ys[ny_i]
            if _segment_crosses_obstacle(seg_ax, seg_ay, seg_bx, seg_by, obstacles):
                continue

            seg_len = abs(seg_bx - seg_ax) + abs(seg_by - seg_ay)
            # Bend penalty: changing direction costs extra to prefer fewer turns
            bend_penalty = 0.0
            if c_dir is not None and di != c_dir:
                bend_penalty = 8.0

            tentative_g = cur_g + seg_len + bend_penalty

            if tentative_g < g_score.get(neighbor, float("inf")):
                g_score[neighbor] = tentative_g
                came_from[neighbor] = current
                came_dir[neighbor] = di
                h = abs(xs[nx_i] - end.x) + abs(ys[ny_i] - end.y)
                heapq.heappush(open_set, (tentative_g + h, counter, neighbor, di))
                counter += 1

    # No path found — fall back to direct L-shape
    return [start, _Pt(end.x, start.y), end]


def _simplify_path(path: list[_Pt]) -> list[_Pt]:
    """Remove collinear intermediate points from an orthogonal path."""
    if len(path) <= 2:
        return path
    result = [path[0]]
    for i in range(1, len(path) - 1):
        prev, cur, nxt = path[i - 1], path[i], path[i + 1]
        # Keep point if direction changes
        if not ((prev.x == cur.x == nxt.x) or (prev.y == cur.y == nxt.y)):
            result.append(cur)
    result.append(path[-1])
    return result
# ---------------------------------------------------------------------------

def _infer_sides(
    sx: float, sy: float, sw: float, sh: float,
    tx: float, ty: float, tw: float, th: float,
) -> tuple[str, str]:
    """Infer the best source and target sides from relative box positions.

    Uses edge-gap separation rather than center-to-center distance so that
    wide containers connecting to narrow boxes below still pick bottom/top
    instead of left/right.
    """
    # Edge gaps: positive = clear separation on that axis
    gap_below = ty - (sy + sh)       # target below source
    gap_above = sy - (ty + th)       # target above source
    gap_right = tx - (sx + sw)       # target right of source
    gap_left  = sx - (tx + tw)       # target left of source

    v_gap = max(gap_below, gap_above)   # best vertical separation
    h_gap = max(gap_right, gap_left)    # best horizontal separation

    if v_gap > 0 and h_gap <= 0:
        # Clear vertical separation, horizontal overlap → connect vertically
        if gap_below >= gap_above:
            return "bottom", "top"
        else:
            return "top", "bottom"
    elif h_gap > 0 and v_gap <= 0:
        # Clear horizontal separation, vertical overlap → connect horizontally
        if gap_right >= gap_left:
            return "right", "left"
        else:
            return "left", "right"
    elif v_gap > 0 and h_gap > 0:
        # Both axes separated → pick the axis with the SMALLER edge gap
        # (shortest connection distance), unless the gap is tiny relative
        # to the box dimensions — which signals structural adjacency (e.g.
        # column gap) rather than an intentional routing direction.
        #
        # Threshold: if one gap is < 5% of the smaller box dimension on
        # that axis, treat it as structural and prefer the other axis.
        min_h_dim = min(sw, tw)   # smallest width of the two boxes
        min_v_dim = min(sh, th)   # smallest height of the two boxes
        v_structural = (v_gap < 0.05 * min_v_dim) if min_v_dim > 0 else False
        h_structural = (h_gap < 0.05 * min_h_dim) if min_h_dim > 0 else False

        if v_structural and not h_structural:
            # Vertical gap is structural → prefer horizontal
            if gap_right >= gap_left:
                return "right", "left"
            else:
                return "left", "right"
        elif h_structural and not v_structural:
            # Horizontal gap is structural → prefer vertical
            if gap_below >= gap_above:
                return "bottom", "top"
            else:
                return "top", "bottom"
        elif v_gap <= h_gap:
            if gap_below >= gap_above:
                return "bottom", "top"
            else:
                return "top", "bottom"
        else:
            if gap_right >= gap_left:
                return "right", "left"
            else:
                return "left", "right"
    else:
        # Both overlapping → fall back to center-to-center
        dx = (tx + tw / 2) - (sx + sw / 2)
        dy = (ty + th / 2) - (sy + sh / 2)
        if abs(dy) >= abs(dx):
            if dy >= 0:
                return "bottom", "top"
            else:
                return "top", "bottom"
        else:
            if dx >= 0:
                return "right", "left"
            else:
                return "left", "right"


def _ancestors_of(frame_id: str, bounds_map: dict) -> set[str]:
    """Return the set of all ancestor IDs for a frame (parent, grandparent, …)."""
    ancestors: set[str] = set()
    cur = frame_id
    while True:
        entry = bounds_map.get(cur)
        if entry is None:
            break
        parent_id = entry[5]  # 6th element is parent_id
        if parent_id is None:
            break
        ancestors.add(parent_id)
        cur = parent_id
    return ancestors


def _fix_edge_hugging(path: list[_Pt], src_side: str, tgt_side: str,
                      sx: float, sy: float, sw: float, sh: float,
                      tx: float, ty: float, tw: float, th: float,
                      ) -> list[_Pt]:
    """Push segments that hug source/target edges to the gap midpoint.

    Generalised wedge rule: applies to any path length, not just 3-point
    L-shapes.  Checks the first segment (exit from source) and the last
    segment (entry to target) and fixes them if they run parallel to the
    box edge they just left or are about to enter.
    """
    if len(path) < 3:
        return path

    path = list(path)  # make mutable copy

    # --- Fix exit stub (first bend) ---
    s, p1 = path[0], path[1]
    if src_side in ("bottom", "top"):
        # Source exits vertically; first segment should be vertical.
        # If p1 has the same Y as s (horizontal immediately), it's hugging.
        if p1.y == s.y and p1.x != s.x and len(path) >= 3:
            # Push to midpoint between source edge and next Y
            next_y = path[2].y if len(path) > 2 else path[-1].y
            mid_y = (s.y + next_y) / 2
            path[1] = _Pt(p1.x, mid_y)
            path.insert(1, _Pt(s.x, mid_y))
    elif src_side in ("left", "right"):
        # Source exits horizontally; first segment should be horizontal.
        if p1.x == s.x and p1.y != s.y and len(path) >= 3:
            next_x = path[2].x if len(path) > 2 else path[-1].x
            mid_x = (s.x + next_x) / 2
            path[1] = _Pt(mid_x, p1.y)
            path.insert(1, _Pt(mid_x, s.y))

    # --- Fix entry stub (last bend) ---
    e, pm1 = path[-1], path[-2]
    if tgt_side in ("bottom", "top"):
        # Target enters vertically; last segment should be vertical.
        if pm1.y == e.y and pm1.x != e.x:
            prev_y = path[-3].y if len(path) > 2 else path[0].y
            mid_y = (e.y + prev_y) / 2
            path[-2] = _Pt(pm1.x, mid_y)
            path.insert(-1, _Pt(e.x, mid_y))
    elif tgt_side in ("left", "right"):
        if pm1.x == e.x and pm1.y != e.y:
            prev_x = path[-3].x if len(path) > 2 else path[0].x
            mid_x = (e.x + prev_x) / 2
            path[-2] = _Pt(mid_x, pm1.y)
            path.insert(-1, _Pt(mid_x, e.y))

    return path


MIN_ARROW_STUB = 2 * BASELINE_UNIT   # 16px: arrowhead (~11px) + visible shaft (~5px)


def _enforce_min_stub(path: list[_Pt], src_side: str, tgt_side: str) -> list[_Pt]:
    """Ensure exit and entry stubs are at least MIN_ARROW_STUB long.

    For Z-shaped paths (4 points with exit+horizontal+entry), adjust the
    connector position so both stubs get at least MIN_ARROW_STUB, clamped
    by the available gap.  For longer paths, only adjust the last or first
    segment where there is room without disturbing the rest of the path.
    """
    if len(path) < 3:
        return path  # straight line — no bend to adjust
    path = list(path)
    ms = MIN_ARROW_STUB

    # --- Z-path special case: 4 points, both stubs on the same axis ---
    if len(path) == 4:
        p0, p1, p2, p3 = path
        if src_side in ("top", "bottom") and tgt_side in ("top", "bottom"):
            # Both stubs are vertical; connector is horizontal
            total = abs(p3.y - p0.y)
            exit_stub = abs(p1.y - p0.y)
            entry_stub = abs(p3.y - p2.y)
            if exit_stub < ms or entry_stub < ms:
                sign = 1 if p3.y > p0.y else -1
                if total >= 2 * ms:
                    # Room for both — give ms to each
                    con_y = p0.y + sign * ms
                    path[1] = _Pt(p1.x, con_y)
                    path[2] = _Pt(p2.x, con_y)
                elif total >= ms:
                    # Room for entry stub only — prioritize arrowhead side
                    con_y = p3.y - sign * ms
                    path[1] = _Pt(p1.x, con_y)
                    path[2] = _Pt(p2.x, con_y)
                # else: gap too small for any meaningful stub — leave as-is
            return path
        elif src_side in ("left", "right") and tgt_side in ("left", "right"):
            total = abs(p3.x - p0.x)
            exit_stub = abs(p1.x - p0.x)
            entry_stub = abs(p3.x - p2.x)
            if exit_stub < ms or entry_stub < ms:
                sign = 1 if p3.x > p0.x else -1
                if total >= 2 * ms:
                    con_x = p0.x + sign * ms
                    path[1] = _Pt(con_x, p1.y)
                    path[2] = _Pt(con_x, p2.y)
                elif total >= ms:
                    con_x = p3.x - sign * ms
                    path[1] = _Pt(con_x, p1.y)
                    path[2] = _Pt(con_x, p2.y)
            return path

    # --- General case: adjust last segment (entry stub) ---
    p_end, p_prev = path[-1], path[-2]
    if tgt_side in ("top", "bottom"):
        seg = abs(p_end.y - p_prev.y)
        if 0 < seg < ms and p_end.x == p_prev.x:
            sign = 1 if p_end.y > p_prev.y else -1
            new_y = p_end.y - sign * ms
            will_move_connector = len(path) >= 3 and path[-3].y == p_prev.y
            check_idx = -4 if will_move_connector and len(path) > 3 else -3
            if abs(check_idx) <= len(path):
                limit = path[check_idx].y
                safe = (sign > 0 and new_y >= limit) or (sign < 0 and new_y <= limit)
            else:
                safe = True
            if safe:
                path[-2] = _Pt(p_prev.x, new_y)
                if will_move_connector:
                    path[-3] = _Pt(path[-3].x, new_y)
    elif tgt_side in ("left", "right"):
        seg = abs(p_end.x - p_prev.x)
        if 0 < seg < ms and p_end.y == p_prev.y:
            sign = 1 if p_end.x > p_prev.x else -1
            new_x = p_end.x - sign * ms
            will_move_connector = len(path) >= 3 and path[-3].x == p_prev.x
            check_idx = -4 if will_move_connector and len(path) > 3 else -3
            if abs(check_idx) <= len(path):
                limit = path[check_idx].x
                safe = (sign > 0 and new_x >= limit) or (sign < 0 and new_x <= limit)
            else:
                safe = True
            if safe:
                path[-2] = _Pt(new_x, p_prev.y)
                if will_move_connector:
                    path[-3] = _Pt(new_x, path[-3].y)

    # --- General case: adjust first segment (exit stub) ---
    p_start, p_next = path[0], path[1]
    if src_side in ("top", "bottom"):
        seg = abs(p_next.y - p_start.y)
        if 0 < seg < ms and p_start.x == p_next.x:
            sign = 1 if p_next.y > p_start.y else -1
            new_y = p_start.y + sign * ms
            will_move_connector = len(path) >= 3 and path[2].y == p_next.y
            # Safety: check against the point AFTER the connector
            check_idx = 3 if will_move_connector and len(path) > 3 else 2
            if check_idx < len(path):
                limit = path[check_idx].y
                safe = (sign > 0 and new_y <= limit) or (sign < 0 and new_y >= limit)
            else:
                safe = True
            if safe:
                path[1] = _Pt(p_next.x, new_y)
                if will_move_connector:
                    path[2] = _Pt(path[2].x, new_y)
    elif src_side in ("left", "right"):
        seg = abs(p_next.x - p_start.x)
        if 0 < seg < ms and p_start.y == p_next.y:
            sign = 1 if p_next.x > p_start.x else -1
            new_x = p_start.x + sign * ms
            will_move_connector = len(path) >= 3 and path[2].x == p_next.x
            check_idx = 3 if will_move_connector and len(path) > 3 else 2
            if check_idx < len(path):
                limit = path[check_idx].x
                safe = (sign > 0 and new_x <= limit) or (sign < 0 and new_x >= limit)
            else:
                safe = True
            if safe:
                path[1] = _Pt(new_x, p_next.y)
                if will_move_connector:
                    path[2] = _Pt(new_x, path[2].y)

    return path


def _route_arrows(arrows: list[Arrow], bounds_map: dict) -> list[ArrowPrimitive]:
    """Route arrows using obstacle-aware orthogonal A* router.

    Improvements over the original:
    - Per-arrow obstacle sets that exclude ancestors of source/target
      (allows arrows to route through parent container boundaries).
    - Channel midpoints in the routing grid for better path options.
    - Generalised wedge rule for all path lengths.
    """
    # Build obstacle list from LEAF boxes only.  Container bounds cover
    # their entire child area and would block all routing.  Arrows need
    # to route through gaps between leaf children inside containers.
    leaf_obstacles: dict[str, tuple[float, float, float, float]] = {}
    for bid, entry in bounds_map.items():
        bx, by, bw, bh, is_leaf = entry[:5]
        if is_leaf:
            leaf_obstacles[bid] = _inflated_rect(bx, by, bw, bh, ARROW_CLEARANCE)

    result = []
    for arrow in arrows:
        src_id, src_side = _parse_ref(arrow.source, bounds_map)
        tgt_id, tgt_side = _parse_ref(arrow.target, bounds_map)
        if src_id not in bounds_map or tgt_id not in bounds_map:
            continue
        sx, sy, sw, sh = bounds_map[src_id][:4]
        tx, ty, tw, th = bounds_map[tgt_id][:4]
        # Auto-infer sides when not explicitly specified
        if src_side is None or tgt_side is None:
            inferred_src, inferred_tgt = _infer_sides(sx, sy, sw, sh, tx, ty, tw, th)
            if src_side is None:
                src_side = inferred_src
            if tgt_side is None:
                tgt_side = inferred_tgt
        start = _Pt(*_edge_point(sx, sy, sw, sh, src_side))
        end = _Pt(*_edge_point(tx, ty, tw, th, tgt_side))

        # Per-arrow obstacle set: exclude source, target, and all their
        # ancestors.  Ancestor exclusion lets arrows from a nested child
        # route through parent container boundaries.
        excluded = {src_id, tgt_id}
        excluded |= _ancestors_of(src_id, bounds_map)
        excluded |= _ancestors_of(tgt_id, bounds_map)
        arrow_obstacles = [
            obs for bid, obs in leaf_obstacles.items()
            if bid not in excluded
        ]

        path = _astar_orthogonal(start, end, arrow_obstacles, src_side, tgt_side)
        path = _simplify_path(path)

        # Generalised wedge rule: push edge-hugging segments to gap midpoints
        path = _fix_edge_hugging(
            path, src_side, tgt_side,
            sx, sy, sw, sh, tx, ty, tw, th,
        )
        path = _simplify_path(path)  # clean up any collinear points added

        # Ensure minimum stub length for visible shaft before arrowhead
        path = _enforce_min_stub(path, src_side, tgt_side)
        path = _simplify_path(path)

        # Extract waypoints (everything between start and end)
        waypoints = [(p.x, p.y) for p in path[1:-1]] if len(path) > 2 else []

        prim = ArrowPrimitive(
            start=(start.x, start.y),
            end=(end.x, end.y),
            waypoints=waypoints,
            direction=tgt_side,
            component_id=f"{arrow.source}->{arrow.target}",
            source_ref=arrow.source,
            target_ref=arrow.target,
        )
        result.append(prim)
    return result


def _parse_ref(ref: str, bounds_map: dict | None = None) -> tuple[str, str | None]:
    """Parse arrow endpoint reference into (frame_id, side).

    Supported syntaxes:
      "box_id"                → ("box_id", None)   auto-infer side
      "box_id.bottom"         → ("box_id", "bottom")
      "parent/child"          → ("child", None)    hierarchy path
      "parent/child.right"    → ("child", "right")

    The '/' separator is a hierarchy hint for readability; the router
    resolves to the last path segment since bounds_map keys are flat IDs.
    If the full path isn't found but the last segment is, use that.
    """
    side: str | None = None
    # Strip explicit side suffix first
    if "." in ref:
        parts = ref.rsplit(".", 1)
        if parts[1] in ("top", "bottom", "left", "right"):
            ref = parts[0]
            side = parts[1]
    # Handle hierarchy path: use the last segment as the frame ID
    if "/" in ref:
        ref = ref.rsplit("/", 1)[1]
    return ref, side


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


# ---------------------------------------------------------------------------
# Overlay rendering
# ---------------------------------------------------------------------------

OVERLAY_PADDING = 6  # px outset around member bounding box


def _render_overlays(
    overlays: list[Overlay],
    bounds_map: dict[str, tuple],
) -> list:
    """Render overlays as dotted bounding rects with labels.

    Each overlay computes the bounding box of its member nodes (looked up
    in ``bounds_map``) and emits a dotted Rect plus a TextBlock label
    positioned at the top-left, outside the rect.
    """
    prims: list = []
    pad = OVERLAY_PADDING
    for ov in overlays:
        # Collect bounds of all resolved members
        member_bounds = [bounds_map[m] for m in ov.members if m in bounds_map]
        if not member_bounds:
            continue

        min_x = min(b[0] for b in member_bounds)
        min_y = min(b[1] for b in member_bounds)
        max_x = max(b[0] + b[2] for b in member_bounds)
        max_y = max(b[1] + b[3] for b in member_bounds)

        rx = min_x - pad
        ry = min_y - pad
        rw = (max_x - min_x) + 2 * pad
        rh = (max_y - min_y) + 2 * pad

        prims.append(Rect(
            x=rx, y=ry, width=rw, height=rh,
            fill="transparent", stroke="#000000",
            stroke_dasharray="2 4",
            component_id=ov.id,
        ))

        if ov.label:
            prims.append(TextBlock(
                x=rx + pad,
                y=ry - 16,
                lines=[make_line(ov.label, size="14")],
                component_id=ov.id,
            ))

    return prims


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
    requested_root_w = root.width if root.width is not None else root._measured_w
    root_w = _expand_root_width_for_snapped_fill_columns(root, requested_root_w)
    original_root_width = root.width
    if original_root_width is not None and root_w != original_root_width:
        root.width = root_w

    # Pass 1.5: constrained re-measurement — re-wrap text at resolved
    # widths so HUG heights reflect actual placed widths, not the default
    # BLOCK_WIDTH used during initial measurement.
    _remeasure_with_width_constraints(root, root_w, coerced_ids=set(coerced.keys()))

    root_h = root.height if root.height is not None else root._measured_h

    # Compute grid-snap info for fill_weight column alignment.
    # Only activate when grid was explicitly configured (grid_col_gap is set,
    # which is the signal that the YAML had a grid: section).
    grid_snap = None
    col_w = 0
    col_gap_g = 0
    grid_cols = int(diagram.grid_cols or 0)
    if grid_cols > 1 and diagram.grid_col_gap is not None:
        outer_margin = int(
            diagram.grid_outer_margin
            if diagram.grid_outer_margin is not None
            else (root.padding_top if root.padding_top is not None else (root.padding or 0))
        )
        col_gap_g = int(diagram.grid_col_gap)
        content_w = max(0, root_w - 2 * outer_margin)
        col_w_raw = (content_w - (grid_cols - 1) * col_gap_g) / grid_cols
        col_w = int((col_w_raw // BASELINE_UNIT) * BASELINE_UNIT)
        if col_w > 0:
            grid_snap = (float(col_w), float(col_gap_g), grid_cols)

    # Resolve col_span → explicit width before layout.
    if col_w > 0:
        _resolve_col_spans(root, col_w, col_gap_g)

    # Pass 2: place
    place(root, 0, 0, root_w, root_h, grid_snap=grid_snap)

    if original_root_width is not None and root.width != original_root_width:
        root.width = original_root_width

    # Render frame tree to primitives
    fg: list = []
    bg: list = []
    bounds_map: dict[str, tuple[float, float, float, float, bool]] = {}
    _render_frame(root, fg, bg, bounds_map)

    # Route arrows
    arrow_prims = _route_arrows(diagram.arrows, bounds_map)
    fg.extend(arrow_prims)

    # Render overlays (cross-cutting visual groups)
    overlay_prims = _render_overlays(diagram.overlays, bounds_map)
    fg.extend(overlay_prims)

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
            fill_weight=frame.fill_weight,
            align=frame.align.name,
            wrap=frame.wrap,
            padding_top=frame.padding_top,
            padding_right=frame.padding_right,
            padding_bottom=frame.padding_bottom,
            padding_left=frame.padding_left,
            heading_text="",
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
