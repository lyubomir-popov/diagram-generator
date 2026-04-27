"""Layout engine for declarative diagram trees.

Walks a ``Diagram`` tree, computes positions and dimensions for every
component, and returns a ``LayoutResult`` — a flat list of positioned
primitives that renderers (SVG, draw.io) consume directly.

This module knows nothing about SVG or draw.io.  It uses the grid helpers
and spacing tokens from ``diagram_shared``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from diagram_model import (
    Arrow,
    ArrowDirection,
    Bar,
    BarSegment,
    Box,
    Component,
    Diagram,
    Fill,
    Helper,
    IconComponent,
    Legend,
    LegendEntry,
    Line,
    MatrixWidget,
    MemoryWall,
    Panel,
    RequestCluster,
    Separator,
    Terminal,
)
from diagram_shared import (
    ARROW_CLEARANCE,
    ARROW_EXIT_CLEARANCE,
    BASELINE_UNIT,
    BLOCK_WIDTH,
    BODY_LINE_STEP,
    BODY_SIZE,
    BOX_MIN_HEIGHT,
    COMPACT_GAP,
    GRID_GUTTER,
    GROUP_GAP,
    HELPER as HELPER_COLOR,
    ICON_SIZE,
    INSET,
    MATRIX_SIZE,
    MIN_ARROW_SEGMENT,
    OUTER_MARGIN,
    ROW_GAP,
    TERMINAL_CHROME_HEIGHT,
    make_line as _make_line,
    round_up_to_grid,
    tight_box_height,
)


# ---------------------------------------------------------------------------
# Positioned primitives (output of layout)
# ---------------------------------------------------------------------------

@dataclass
class Rect:
    x: float
    y: float
    width: float
    height: float
    fill: str = "#FFFFFF"
    stroke: str = "#000000"
    dashed: bool = False


@dataclass
class TextBlock:
    x: float
    y: float
    lines: list[dict]          # make_line() dicts


@dataclass
class Icon:
    x: float
    y: float
    name: str
    fill: str = "#000000"


@dataclass
class ArrowPrimitive:
    """A resolved arrow with absolute coordinates."""
    start: tuple[float, float]
    end: tuple[float, float]
    color: str = "#E95420"
    waypoints: list[tuple[float, float]] = field(default_factory=list)
    direction: str = "down"    # "down", "right", "up", "left"


@dataclass
class CircleMarker:
    cx: float
    cy: float
    radius: float
    fill: str
    stroke: str = "#000000"


@dataclass
class JaggedRect:
    x: float
    y: float
    width: float
    height: float
    fill: str = "#F3F3F3"


@dataclass
class TerminalBar:
    x: float
    y: float
    width: float
    height: float
    command: str
    font_family: str | None = None


@dataclass
class MatrixTile:
    x: float
    y: float
    label: str


@dataclass
class RequestClusterPrimitive:
    x: float
    y: float


@dataclass
class DashedLinePrimitive:
    x1: float
    y1: float
    x2: float
    y2: float
    dash: str = "12 8"


Primitive = (
    Rect | TextBlock | Icon | ArrowPrimitive | CircleMarker |
    JaggedRect | TerminalBar | MatrixTile | RequestClusterPrimitive |
    DashedLinePrimitive
)


# ---------------------------------------------------------------------------
# Layout result
# ---------------------------------------------------------------------------

@dataclass
class GridInfo:
    """Captured grid metadata for overlay visualisation."""
    col_xs: list[float]
    col_widths: list[int]
    row_ys: list[float]
    row_heights: list[int]
    col_gap: int
    row_gap: int
    outer_margin: int


@dataclass
class LayoutResult:
    width: int
    height: int
    background: list[Primitive] = field(default_factory=list)
    foreground: list[Primitive] = field(default_factory=list)
    grid_info: GridInfo | None = None


# ---------------------------------------------------------------------------
# Internal: component bounds tracker
# ---------------------------------------------------------------------------

@dataclass
class _Bounds:
    x: float
    y: float
    width: float
    height: float
    component: Any = None
    children: list["_Bounds"] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _line_to_dict(line: Line) -> dict:
    """Convert a model ``Line`` to a ``make_line()``-compatible dict."""
    return _make_line(
        line.content,
        size=line.size,
        weight=line.weight,
        fill=line.fill,
        small_caps=line.small_caps,
        line_step=line.line_step,
    )


def _lines_to_dicts(lines: list[Line]) -> list[dict]:
    return [_line_to_dict(ln) for ln in lines]


def _min_bar_height(bar: Bar) -> int:
    """Compute minimum bar height from content (text inside segments).

    Uses the same inside-out model as boxes: INSET + text_height + INSET,
    snapped to the baseline grid.  Falls back to the model's explicit height
    when no labelled segment exists.
    """
    max_content_h = 0
    for seg in bar.segments:
        if seg.label:
            lines = _lines_to_dicts([seg.label])
            h = tight_box_height(lines, has_icon=False)
            max_content_h = max(max_content_h, h)
    return max(bar.height, max_content_h) if max_content_h else bar.height


def _uniform_row_height(items: list[Box], cols: int, rows: int) -> list[int]:
    """Compute per-row heights: tallest box in each row wins."""
    grid: dict[int, list[Box]] = {}
    for item in items:
        grid.setdefault(item.row, []).append(item)

    heights = []
    for r in range(rows):
        row_items = grid.get(r, [])
        max_h = 0
        for b in row_items:
            if b.height:
                max_h = max(max_h, b.height)
            else:
                has_icon = b.icon is not None
                h = tight_box_height(_lines_to_dicts(b.label), has_icon=has_icon)
                max_h = max(max_h, h)
        heights.append(max_h if max_h > 0 else BOX_MIN_HEIGHT)
    return heights


# ---------------------------------------------------------------------------
# Panel layout
# ---------------------------------------------------------------------------

def _layout_panel(
    panel: Panel,
    x: float,
    y: float,
    default_col_width: int,
    default_col_gap: int,
    default_row_gap: int,
    bounds_map: dict[str, "_Bounds"] | None = None,
    min_height: int = 0,
) -> tuple[_Bounds, list[Primitive], list[Primitive]]:
    """Lay out a panel and its children.  Returns bounds + primitives."""
    col_width = panel.col_width or default_col_width
    col_gap = panel.col_gap if panel.col_gap is not None else default_col_gap
    row_gap = panel.row_gap if panel.row_gap is not None else default_row_gap
    pad = 0 if panel.frameless else INSET

    # Separate children by type
    boxes = [c for c in panel.children if isinstance(c, Box)]
    bars = [c for c in panel.children if isinstance(c, Bar)]
    all_helpers = [c for c in panel.children if isinstance(c, Helper)]
    terminals = [c for c in panel.children if isinstance(c, Terminal)]
    sub_panels = [c for c in panel.children if isinstance(c, Panel)]
    matrices = [c for c in panel.children if isinstance(c, MatrixWidget)]

    # Helpers with col/row go into the grid; others are sequential
    grid_helpers = [h for h in all_helpers if hasattr(h, "col") and hasattr(h, "row")]
    seq_helpers = [h for h in all_helpers if h not in grid_helpers]

    # All grid-placed items for dimension computation
    grid_items = boxes + grid_helpers + matrices

    # Determine grid dimensions
    cols = panel.cols
    if panel.rows is not None:
        rows = panel.rows
    else:
        rows = max((gi.row for gi in grid_items), default=0) + 1 if grid_items else 0

    # Heading
    heading_h = 0
    heading_gap = row_gap
    if panel.heading:
        heading_lines = _lines_to_dicts([panel.heading])
        heading_h = tight_box_height(heading_lines)

    # Uniform row heights – compute from boxes, then expand for helper rows
    row_heights = _uniform_row_height(boxes, cols, rows) if rows > 0 else []
    # Expand row_heights to cover helper-only rows
    while len(row_heights) < rows:
        row_heights.append(BODY_LINE_STEP)
    # Grow helper rows to fit helper content
    for h in grid_helpers:
        hr = h.row
        if hr < len(row_heights):
            lines = _lines_to_dicts(h.lines)
            n = len(lines)
            ls = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
            needed = n * ls
            row_heights[hr] = max(row_heights[hr], needed)
    if panel.uniform_height and row_heights:
        max_h = max(row_heights)
        row_heights = [max_h] * len(row_heights)

    fg: list[Primitive] = []
    bg: list[Primitive] = []
    child_bounds: list[_Bounds] = []

    # Heading text
    if panel.heading:
        fg.append(TextBlock(x + pad, y + pad, _lines_to_dicts([panel.heading])))

    # Running content-bottom tracker
    content_y = y + pad
    if heading_h:
        content_y += heading_h + heading_gap

    # ── Boxes via panel_grid ──
    if rows > 0 and grid_items:
        from diagram_shared import panel_grid as _panel_grid
        grid = _panel_grid(
            cols=cols,
            rows=rows,
            col_width=col_width,
            row_heights=row_heights,
            col_gap=col_gap,
            row_gap=row_gap,
            heading_height=heading_h,
            heading_gap=heading_gap,
            inset=pad,
        )
        col_xs = grid["col_xs"]
        row_ys = grid["row_ys"]

        for bx in boxes:
            bx_x = x + col_xs[bx.col]
            bx_y = y + row_ys[bx.row]
            bx_w = bx.width or col_width
            bx_h = bx.height or row_heights[bx.row]
            bx_fill = bx.fill.value

            fg.append(Rect(bx_x, bx_y, bx_w, bx_h, fill=bx_fill))
            fg.append(TextBlock(bx_x + INSET, bx_y + INSET,
                                _lines_to_dicts(bx.label)))
            if bx.icon:
                fg.append(Icon(
                    bx_x + bx_w - INSET - ICON_SIZE,
                    bx_y + INSET,
                    bx.icon,
                    fill=bx.icon_fill or "#000000",
                ))
            child_bounds.append(_Bounds(bx_x, bx_y, bx_w, bx_h, bx))

        # Place grid-positioned helpers
        for h in grid_helpers:
            hc = h.col
            hr = h.row
            cs = getattr(h, "col_span", 1) or 1
            hx = x + col_xs[hc]
            hy = y + row_ys[hr]
            hw = sum(col_width for _ in range(cs)) + (cs - 1) * col_gap if cs > 1 else col_width
            lines = _lines_to_dicts(h.lines)
            fg.append(TextBlock(hx, hy, lines))
            n = len(lines)
            ls = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
            hh = n * ls
            child_bounds.append(_Bounds(hx, hy, hw, hh, h))

        # Place grid-positioned matrix widgets
        for mw in matrices:
            mc = mw.col
            mr = mw.row
            mx = x + col_xs[mc]
            my = y + row_ys[mr]
            fg.append(MatrixTile(mx, my, mw.label))
            child_bounds.append(_Bounds(mx, my, MATRIX_SIZE, MATRIX_SIZE, mw))

        content_y = y + row_ys[-1] + row_heights[-1] + row_gap

    # ── Sub-panels (laid out side-by-side below boxes) ──
    if sub_panels:
        sp_x = x + pad
        sp_results: list[tuple[Panel, _Bounds, list, list]] = []
        for sp in sub_panels:
            sp_bounds, sp_fg, sp_bg = _layout_panel(
                sp, sp_x, content_y,
                default_col_width=col_width,
                default_col_gap=col_gap,
                default_row_gap=row_gap,
                bounds_map=bounds_map,
            )
            sp_results.append((sp, sp_bounds, sp_fg, sp_bg))
            sp_x += sp_bounds.width + col_gap

        # Equalize side-by-side sub-panel heights to the tallest
        sp_max_h = max(r[1].height for r in sp_results)
        for sp, sp_bounds, sp_fg, sp_bg in sp_results:
            if sp_bounds.height < sp_max_h and not sp.frameless:
                # Stretch frame rect (first element when not frameless)
                if sp_fg and isinstance(sp_fg[0], Rect):
                    sp_fg[0].height = sp_max_h
                sp_bounds.height = sp_max_h
            fg.extend(sp_fg)
            bg.extend(sp_bg)
            child_bounds.append(sp_bounds)
            if sp.id and bounds_map is not None:
                bounds_map[sp.id] = sp_bounds
        content_y += sp_max_h + row_gap

    # ── Bars (sequential below boxes/sub-panels) ──
    for bar in bars:
        bar_h = _min_bar_height(bar)
        bar_inner_w = (sp_x - x - pad - col_gap) if sub_panels else 0
        if bar_inner_w <= 0:
            # Estimate panel width from cols
            bar_inner_w = cols * col_width + (cols - 1) * col_gap
        bx_x = x + pad
        seg_x = bx_x

        # Pre-compute segment widths so the last auto segment fills remainder
        seg_widths: list[int] = []
        used = 0
        last_auto_idx = -1
        for i, seg in enumerate(bar.segments):
            if seg.width_px is not None:
                seg_widths.append(seg.width_px)
                used += seg.width_px
            elif seg.width_fraction is not None:
                sw = round_up_to_grid(int(bar_inner_w * seg.width_fraction))
                seg_widths.append(sw)
                used += sw
            else:
                seg_widths.append(0)  # placeholder
                last_auto_idx = i
        # Fill auto-width segment(s) – if there's exactly one, give it the remainder
        if last_auto_idx >= 0:
            seg_widths[last_auto_idx] = max(0, bar_inner_w - used)

        for i, seg in enumerate(bar.segments):
            sw = seg_widths[i]
            fg.append(Rect(seg_x, content_y, sw, bar_h, fill=seg.fill.value))
            if seg.label:
                fg.append(TextBlock(seg_x + INSET, content_y + INSET,
                                    _lines_to_dicts([seg.label])))
            seg_x += sw
        content_y += bar_h + row_gap

    # ── Terminals ──
    for term in terminals:
        tw = term.width or (cols * col_width + (cols - 1) * col_gap)
        fg.append(TerminalBar(x + pad, content_y, tw,
                              BOX_MIN_HEIGHT, term.command, term.font_family))
        content_y += BOX_MIN_HEIGHT + row_gap

    # ── Compute final panel dimensions ──
    # Width: from grid if boxes exist, otherwise from sub-panel extent
    if rows > 0 and boxes:
        from diagram_shared import panel_grid as _panel_grid
        grid = _panel_grid(
            cols=cols, rows=rows, col_width=col_width,
            row_heights=row_heights, col_gap=col_gap, row_gap=row_gap,
            heading_height=heading_h, heading_gap=heading_gap,
            inset=pad,
        )
        panel_w = grid["width"]
    elif sub_panels:
        total_sp_w = sum(cb.width for cb in child_bounds if isinstance(cb.component, Panel))
        total_sp_w += (len(sub_panels) - 1) * col_gap
        panel_w = total_sp_w + 2 * pad
    else:
        panel_w = cols * col_width + (cols - 1) * col_gap + 2 * pad

    # Height: max of grid-computed height and actual content
    content_bottom = content_y - row_gap + pad  # remove trailing row_gap, add bottom inset
    panel_h = max(0, content_bottom - y)
    if rows > 0 and boxes:
        grid_h = grid["height"]
        panel_h = max(panel_h, grid_h)

    # Enforce minimum height (from parent grid cell or sub-panel equalization)
    if min_height > 0:
        panel_h = max(panel_h, min_height)

    # Heading icon (needs panel_w)
    if panel.icon:
        fg.append(Icon(
            x + panel_w - pad - ICON_SIZE,
            y + pad,
            panel.icon,
        ))

    # Panel frame (emitted last so we know final size, but insert at front for z-order)
    if not panel.frameless:
        frame = Rect(x, y, panel_w, panel_h, fill=panel.fill.value,
                     dashed=panel.dashed)
        fg.insert(0, frame)

    bounds = _Bounds(x, y, panel_w, panel_h, panel, children=child_bounds)
    return bounds, fg, bg


# ---------------------------------------------------------------------------
# Top-level box layout (not inside a panel)
# ---------------------------------------------------------------------------

def _layout_box(
    bx: Box,
    x: float,
    y: float,
    default_width: int,
) -> tuple[_Bounds, list[Primitive]]:
    w = bx.width or default_width
    has_icon = bx.icon is not None
    h = bx.height or tight_box_height(_lines_to_dicts(bx.label), has_icon=has_icon)
    fill = bx.fill.value
    prims: list[Primitive] = []
    prims.append(Rect(x, y, w, h, fill=fill))
    prims.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(bx.label)))
    if bx.icon:
        prims.append(Icon(x + w - INSET - ICON_SIZE, y + INSET, bx.icon,
                          fill=bx.icon_fill or "#000000"))
    return _Bounds(x, y, w, h, bx), prims


# ---------------------------------------------------------------------------
# Helper layout
# ---------------------------------------------------------------------------

def _layout_helper(
    helper: Helper,
    x: float,
    y: float,
) -> tuple[_Bounds, list[Primitive]]:
    lines = _lines_to_dicts(helper.lines)
    n = len(lines)
    line_step = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
    h = n * line_step
    prims = [TextBlock(x, y, lines)]
    return _Bounds(x, y, 400, h, helper), prims


# ---------------------------------------------------------------------------
# Component natural size (without position)
# ---------------------------------------------------------------------------

def _natural_size(
    comp,
    default_width: int,
    bounds_map: dict[str, _Bounds],
) -> tuple[float, float]:
    """Return (width, height) a component needs, without rendering it."""
    if isinstance(comp, Box):
        w = comp.width or default_width
        has_icon = comp.icon is not None
        h = comp.height or tight_box_height(_lines_to_dicts(comp.label), has_icon=has_icon)
        return (w, h)
    elif isinstance(comp, Panel):
        # Need to actually lay out the panel to know its size
        b, _, _ = _layout_panel(
            comp, 0, 0,
            default_col_width=BLOCK_WIDTH,
            default_col_gap=COMPACT_GAP,
            default_row_gap=COMPACT_GAP,
            bounds_map={},
        )
        return (b.width, b.height)
    elif isinstance(comp, Helper):
        lines = _lines_to_dicts(comp.lines)
        n = len(lines)
        line_step = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
        hw = comp.width if hasattr(comp, "width") and comp.width else default_width
        return (hw, n * line_step)
    elif isinstance(comp, MemoryWall):
        return (comp.width or BLOCK_WIDTH, comp.height or BOX_MIN_HEIGHT)
    elif isinstance(comp, MatrixWidget):
        return (MATRIX_SIZE, MATRIX_SIZE)
    elif isinstance(comp, RequestCluster):
        return (ICON_SIZE * 3 + COMPACT_GAP * 2, ICON_SIZE)
    elif isinstance(comp, IconComponent):
        return (ICON_SIZE, ICON_SIZE)
    elif isinstance(comp, Terminal):
        return (comp.width or default_width, BOX_MIN_HEIGHT)
    elif isinstance(comp, Legend):
        return (len(comp.entries) * 100, 24)
    elif isinstance(comp, Separator):
        return (default_width, BASELINE_UNIT)
    return (default_width, BOX_MIN_HEIGHT)


# ---------------------------------------------------------------------------
# Render a component at a given position
# ---------------------------------------------------------------------------

def _render_component(
    comp,
    x: float,
    y: float,
    w: float,
    h: float,
    default_width: int,
    bounds_map: dict[str, _Bounds],
    min_height: int = 0,
) -> tuple[_Bounds, list, list]:
    """Render *comp* at (x, y) with cell size (w, h).

    Returns (bounds, foreground_prims, background_prims).
    """
    fg: list = []
    bg: list = []

    if isinstance(comp, Panel):
        bounds, comp_fg, comp_bg = _layout_panel(
            comp, x, y,
            default_col_width=BLOCK_WIDTH,
            default_col_gap=COMPACT_GAP,
            default_row_gap=COMPACT_GAP,
            bounds_map=bounds_map,
            min_height=min_height,
        )
        fg.extend(comp_fg)
        bg.extend(comp_bg)
        return bounds, fg, bg

    elif isinstance(comp, Box):
        bw = comp.width or default_width
        # In a spanned cell the box can be wider than default_width
        if w > bw:
            bw = int(w)
        has_icon = comp.icon is not None
        bh = comp.height or tight_box_height(_lines_to_dicts(comp.label), has_icon=has_icon)
        fill = comp.fill.value
        fg.append(Rect(x, y, bw, bh, fill=fill))
        fg.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(comp.label)))
        if comp.icon:
            fg.append(Icon(x + bw - INSET - ICON_SIZE, y + INSET, comp.icon,
                           fill=comp.icon_fill or "#000000"))
        return _Bounds(x, y, bw, bh, comp), fg, bg

    elif isinstance(comp, Helper):
        lines = _lines_to_dicts(comp.lines)
        n = len(lines)
        line_step = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
        ch = n * line_step
        fg.append(TextBlock(x, y, lines))
        return _Bounds(x, y, int(w), ch, comp), fg, bg

    elif isinstance(comp, MemoryWall):
        mw = comp.width or BLOCK_WIDTH
        mh = comp.height or BOX_MIN_HEIGHT
        fg.append(JaggedRect(x, y, mw, mh))
        fg.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(comp.label)))
        return _Bounds(x, y, mw, mh, comp), fg, bg

    elif isinstance(comp, MatrixWidget):
        fg.append(MatrixTile(x, y, comp.label))
        return _Bounds(x, y, MATRIX_SIZE, MATRIX_SIZE, comp), fg, bg

    elif isinstance(comp, RequestCluster):
        cw = ICON_SIZE * 3 + COMPACT_GAP * 2
        fg.append(RequestClusterPrimitive(x, y))
        return _Bounds(x, y, cw, ICON_SIZE, comp), fg, bg

    elif isinstance(comp, IconComponent):
        fg.append(Icon(x, y, comp.icon, fill=comp.fill))
        return _Bounds(x, y, ICON_SIZE, ICON_SIZE, comp), fg, bg

    elif isinstance(comp, Terminal):
        tw = comp.width or default_width
        th = BOX_MIN_HEIGHT
        fg.append(TerminalBar(x, y, tw, th, comp.command, comp.font_family))
        return _Bounds(x, y, tw, th, comp), fg, bg

    elif isinstance(comp, Separator):
        # Renders as a centered dashed horizontal line
        sep_h = BASELINE_UNIT  # thin row
        mid_y = y + sep_h / 2
        fg.append(DashedLinePrimitive(x, mid_y, x + w, mid_y, dash=comp.dash))
        return _Bounds(x, y, int(w), sep_h, comp), fg, bg

    elif isinstance(comp, Legend):
        lx = x
        for entry in comp.entries:
            fg.append(CircleMarker(lx + 4, y + 10, 4, entry.color))
            fg.append(TextBlock(lx + 16, y, [_make_line(entry.label, fill=HELPER_COLOR)]))
            lx += 100
        return _Bounds(x, y, lx - x, 24, comp), fg, bg

    # Fallback
    return _Bounds(x, y, int(w), int(h), comp), fg, bg


# ---------------------------------------------------------------------------
# Arrow resolution
# ---------------------------------------------------------------------------

def _resolve_arrows(
    arrows: list[Arrow],
    bounds_map: dict[str, _Bounds],
) -> list[ArrowPrimitive]:
    """Resolve arrow source/target references to absolute coordinates.

    When no explicit waypoints are given and the source/target aren't
    axis-aligned, the arrow is auto-routed orthogonally:
      - vertical (top/bottom sides): Z-bend with clearance-aware placement
      - horizontal (left/right sides): L-bend favouring the longer final segment

    The Z-bend placement ensures the final approach segment is at least
    MIN_ARROW_SEGMENT long (arrowhead + visible shaft) and the exit
    segment is at least ARROW_EXIT_CLEARANCE long.
    """
    prims = []
    for arrow in arrows:
        src = _resolve_anchor(arrow.source, bounds_map)
        tgt = _resolve_anchor(arrow.target, bounds_map)
        if not (src and tgt):
            continue

        waypoints = list(arrow.waypoints)

        # Auto-route orthogonal if no explicit waypoints
        if not waypoints:
            sx, sy = src
            tx, ty = tgt
            src_side = arrow.source.split(".")[-1]
            tgt_side = arrow.target.split(".")[-1]

            vertical_src = src_side in ("top", "bottom")
            vertical_tgt = tgt_side in ("top", "bottom")

            if vertical_src and vertical_tgt and sx != tx:
                # Both sides are vertical but X differs → Z-bend.
                # Place the bend so the approach segment (with the
                # arrowhead) gets at least MIN_ARROW_SEGMENT and the
                # exit segment gets at least ARROW_EXIT_CLEARANCE.
                gap = abs(ty - sy)
                d = 1 if ty > sy else -1
                if gap >= 2 * MIN_ARROW_SEGMENT:
                    # Plenty of room → symmetric midpoint
                    bend_y = (sy + ty) / 2
                else:
                    # Tight gap → shift bend toward source so the
                    # approach segment gets MIN_ARROW_SEGMENT.
                    bend_y = ty - d * MIN_ARROW_SEGMENT
                    # Clamp so exit segment ≥ ARROW_EXIT_CLEARANCE
                    min_bend = sy + d * ARROW_EXIT_CLEARANCE
                    if d > 0:
                        bend_y = max(bend_y, min_bend)
                    else:
                        bend_y = min(bend_y, min_bend)
                bend_y = round(bend_y / BASELINE_UNIT) * BASELINE_UNIT
                waypoints = [(sx, bend_y), (tx, bend_y)]
            elif not vertical_src and not vertical_tgt and sy != ty:
                # Both sides horizontal but Y differs → L-bend.
                # Pick bend point that gives the longer final segment so
                # the arrowhead doesn't overshoot the bend corner.
                if abs(sy - ty) >= abs(sx - tx):
                    waypoints = [(tx, sy)]   # long vertical final
                else:
                    waypoints = [(sx, ty)]   # long horizontal final
            elif vertical_src and not vertical_tgt:
                # e.g. bottom→left: L-bend
                waypoints = [(sx, ty)]
            elif not vertical_src and vertical_tgt:
                # e.g. right→top: L-bend
                waypoints = [(tx, sy)]

        # Determine direction from last segment
        pts = [src] + waypoints + [tgt]
        dx = pts[-1][0] - pts[-2][0]
        dy = pts[-1][1] - pts[-2][1]
        if abs(dy) >= abs(dx):
            direction = "down" if dy > 0 else "up"
        else:
            direction = "right" if dx > 0 else "left"

        prims.append(ArrowPrimitive(
            start=src, end=tgt, color=arrow.color,
            waypoints=waypoints, direction=direction,
        ))
    return prims


def _resolve_anchor(
    ref: str,
    bounds_map: dict[str, _Bounds],
) -> tuple[float, float] | None:
    """Resolve 'id.side' or 'id.col.row.side' to (x, y)."""
    parts = ref.split(".")
    if len(parts) < 2:
        return None
    comp_id = parts[0]
    side = parts[-1]
    b = bounds_map.get(comp_id)
    if b is None:
        return None
    # For panel cell references like "panel.0.1.bottom"
    if len(parts) == 4:
        col, row = int(parts[1]), int(parts[2])
        # Find child bounds at that grid position
        for child in b.children:
            if (hasattr(child.component, "col") and hasattr(child.component, "row")
                    and child.component.col == col and child.component.row == row):
                b = child
                break
    return _side_midpoint(b, side)


def _side_midpoint(b: _Bounds, side: str) -> tuple[float, float]:
    if side == "top":
        return (b.x + b.width / 2, b.y)
    elif side == "bottom":
        return (b.x + b.width / 2, b.y + b.height)
    elif side == "left":
        return (b.x, b.y + b.height / 2)
    elif side == "right":
        return (b.x + b.width, b.y + b.height / 2)
    return (b.x + b.width / 2, b.y + b.height / 2)


def _register_child_bounds(
    bounds: "_Bounds", bounds_map: dict[str, "_Bounds"]
) -> None:
    """Recursively register all child bounds with IDs into bounds_map."""
    if bounds.children:
        for child in bounds.children:
            child_id = getattr(child.component, "id", "")
            if child_id and child_id not in bounds_map:
                bounds_map[child_id] = child
            _register_child_bounds(child, bounds_map)


# ---------------------------------------------------------------------------
# Main layout function
# ---------------------------------------------------------------------------

def layout(diagram: Diagram) -> LayoutResult:
    """Walk the diagram tree and compute all positions."""
    outer = diagram.outer_margin if diagram.outer_margin is not None else OUTER_MARGIN
    col_gap = diagram.col_gap if diagram.col_gap is not None else GRID_GUTTER
    row_gap = diagram.row_gap if diagram.row_gap is not None else GRID_GUTTER

    fg: list[Primitive] = []
    bg: list[Primitive] = []
    bounds_map: dict[str, _Bounds] = {}
    all_bounds: list[_Bounds] = []

    # Separate arrows from positionable components
    arrows = [c for c in diagram.components if isinstance(c, Arrow)]
    components = [c for c in diagram.components if not isinstance(c, Arrow)]

    if diagram.arrangement == Diagram.Arrangement.GRID:
        # ── Müller-Brockmann grid: explicit cell placement ──
        default_cw = diagram.col_width or BLOCK_WIDTH
        default_rh = diagram.row_height or BOX_MIN_HEIGHT

        # 1. Determine grid dimensions from component placements
        max_col = 0
        max_row = 0
        for comp in components:
            c = getattr(comp, "col", 0)
            r = getattr(comp, "row", 0)
            cs = getattr(comp, "col_span", 1) or 1
            rs = getattr(comp, "row_span", 1) or 1
            max_col = max(max_col, c + cs)
            max_row = max(max_row, r + rs)
        n_cols = max(max_col, diagram.cols)
        n_rows = max_row

        # 2. Compute natural sizes and build per-cell size requirements
        col_widths = [default_cw] * n_cols
        row_heights = [default_rh] * n_rows

        sizes: list[tuple[float, float]] = []
        for comp in components:
            nw, nh = _natural_size(comp, default_cw, bounds_map)
            sizes.append((nw, nh))
            c = getattr(comp, "col", 0)
            r = getattr(comp, "row", 0)
            cs = getattr(comp, "col_span", 1) or 1
            rs = getattr(comp, "row_span", 1) or 1
            # For single-span cells, widen the column if the component is wider
            if cs == 1:
                col_widths[c] = max(col_widths[c], int(nw))
            # For single-row-span cells, grow the row if the component is taller
            if rs == 1:
                row_heights[r] = max(row_heights[r], int(nh))

        # Snap to grid
        col_widths = [round_up_to_grid(w) for w in col_widths]
        row_heights = [round_up_to_grid(h) for h in row_heights]

        # 3. Compute cumulative positions
        col_xs = []
        cx = outer
        for i in range(n_cols):
            col_xs.append(cx)
            cx += col_widths[i] + col_gap
        row_ys = []
        ry = outer
        for i in range(n_rows):
            row_ys.append(ry)
            ry += row_heights[i] + row_gap

        # 4. Place each component in its grid cell
        for comp, (nw, nh) in zip(components, sizes):
            c = getattr(comp, "col", 0)
            r = getattr(comp, "row", 0)
            cs = getattr(comp, "col_span", 1) or 1
            rs = getattr(comp, "row_span", 1) or 1
            x = col_xs[c]
            y = row_ys[r]
            # Cell span width = sum of spanned columns + inter-column gaps
            cell_w = sum(col_widths[c:c + cs]) + (cs - 1) * col_gap
            cell_h = sum(row_heights[r:r + rs]) + (rs - 1) * row_gap

            bounds, comp_fg, comp_bg = _render_component(
                comp, x, y, cell_w, cell_h,
                default_width=int(cell_w),
                bounds_map=bounds_map,
                min_height=int(cell_h),
            )
            fg.extend(comp_fg)
            bg.extend(comp_bg)
            comp_id = getattr(comp, "id", "")
            if comp_id:
                bounds_map[comp_id] = bounds
            # Register all nested child bounds (boxes inside panels) so
            # top-level arrows can reference them by ID.
            _register_child_bounds(bounds, bounds_map)
            all_bounds.append(bounds)

    else:
        # ── VERTICAL / HORIZONTAL: sequential placement ──
        x = outer
        y = outer
        max_row_height = 0

        for comp in components:
            bounds, comp_fg, comp_bg = _render_component(
                comp, x, y, BLOCK_WIDTH, BOX_MIN_HEIGHT,
                default_width=BLOCK_WIDTH,
                bounds_map=bounds_map,
            )
            fg.extend(comp_fg)
            bg.extend(comp_bg)
            comp_id = getattr(comp, "id", "")
            if comp_id:
                bounds_map[comp_id] = bounds
            _register_child_bounds(bounds, bounds_map)
            all_bounds.append(bounds)

            if diagram.arrangement == Diagram.Arrangement.HORIZONTAL:
                max_row_height = max(max_row_height, bounds.height)
                x += bounds.width + col_gap
            else:  # VERTICAL
                y += bounds.height + row_gap

    # Phase 3: resolve arrows (foreground so they paint above panel frames)
    arrow_prims = _resolve_arrows(arrows, bounds_map)
    fg.extend(arrow_prims)

    # Compute canvas size from all bounds
    max_x = max((b.x + b.width for b in all_bounds), default=0)
    max_y = max((b.y + b.height for b in all_bounds), default=0)
    width = round_up_to_grid(int(max_x) + outer)
    height = round_up_to_grid(int(max_y) + outer)

    # Capture grid info for overlay visualisation
    grid_info: GridInfo | None = None
    if diagram.arrangement == Diagram.Arrangement.GRID:
        grid_info = GridInfo(
            col_xs=col_xs,
            col_widths=col_widths,
            row_ys=row_ys,
            row_heights=row_heights,
            col_gap=col_gap,
            row_gap=row_gap,
            outer_margin=outer,
        )
    else:
        # Synthesize from laid-out bounds for VERTICAL / HORIZONTAL
        if all_bounds:
            synth_col_xs = [all_bounds[0].x]
            synth_col_widths = [max(int(b.width) for b in all_bounds)]
            synth_row_ys = [int(b.y) for b in all_bounds]
            synth_row_heights = [int(b.height) for b in all_bounds]
            grid_info = GridInfo(
                col_xs=synth_col_xs,
                col_widths=synth_col_widths,
                row_ys=synth_row_ys,
                row_heights=synth_row_heights,
                col_gap=col_gap,
                row_gap=row_gap,
                outer_margin=outer,
            )

    return LayoutResult(width=width, height=height, background=bg,
                        foreground=fg, grid_info=grid_info)


# ---------------------------------------------------------------------------
# Baseline grid validator
# ---------------------------------------------------------------------------

@dataclass
class GridViolation:
    """A coordinate that does not sit on the baseline grid."""
    primitive_type: str
    field: str
    value: float
    nearest: int       # nearest grid-aligned value
    index: int         # position in the primitive list


def validate_grid(result: LayoutResult, step: int = BASELINE_UNIT) -> list[GridViolation]:
    """Check that all layout coordinates land on the baseline grid.

    Returns a list of violations.  An empty list means everything is aligned.
    Text baseline y-values are exempt because they derive from ascent ratios.
    """
    violations: list[GridViolation] = []

    def _check(prim_type: str, field: str, value: float, idx: int) -> None:
        if value % step != 0:
            nearest = round_up_to_grid(value, step)
            violations.append(GridViolation(prim_type, field, value, nearest, idx))

    all_prims = list(result.background) + list(result.foreground)
    for idx, p in enumerate(all_prims):
        ptype = type(p).__name__
        if isinstance(p, Rect):
            _check(ptype, "x", p.x, idx)
            _check(ptype, "y", p.y, idx)
            _check(ptype, "width", p.width, idx)
            _check(ptype, "height", p.height, idx)
        elif isinstance(p, TextBlock):
            _check(ptype, "x", p.x, idx)
            _check(ptype, "y", p.y, idx)
            # baseline y is font-metric derived – not checked
        elif isinstance(p, Icon):
            _check(ptype, "x", p.x, idx)
            _check(ptype, "y", p.y, idx)
        elif isinstance(p, JaggedRect):
            _check(ptype, "x", p.x, idx)
            _check(ptype, "y", p.y, idx)
            _check(ptype, "width", p.width, idx)
            _check(ptype, "height", p.height, idx)
        elif isinstance(p, TerminalBar):
            _check(ptype, "x", p.x, idx)
            _check(ptype, "y", p.y, idx)
            _check(ptype, "width", p.width, idx)
            _check(ptype, "height", p.height, idx)
        elif isinstance(p, ArrowPrimitive):
            # Arrow endpoints should be on grid
            _check(ptype, "start.x", p.start[0], idx)
            _check(ptype, "start.y", p.start[1], idx)
            _check(ptype, "end.x", p.end[0], idx)
            _check(ptype, "end.y", p.end[1], idx)

    # Canvas dimensions
    _check("Canvas", "width", result.width, -1)
    _check("Canvas", "height", result.height, -1)

    return violations


# ---------------------------------------------------------------------------
# Arrow clearance validator
# ---------------------------------------------------------------------------

@dataclass
class ArrowViolation:
    """An arrow segment that is too short for clean arrowhead rendering."""
    index: int                  # position in the primitive list
    segment: str                # "last", "first", or "mid-N"
    length: float               # actual segment length
    minimum: float              # required minimum
    start: tuple[float, float]
    end: tuple[float, float]


def validate_arrows(result: LayoutResult) -> list[ArrowViolation]:
    """Check that every arrow has adequate clearance.

    Rules enforced:
    - Last segment (carries the arrowhead) must be ≥ MIN_ARROW_SEGMENT.
    - First segment (exits the source) must be ≥ ARROW_EXIT_CLEARANCE.
    - Interior segments must be ≥ ARROW_EXIT_CLEARANCE.

    Returns a list of violations.  An empty list means all arrows are clean.
    """
    from diagram_shared import ARROW_HEAD_LENGTH

    violations: list[ArrowViolation] = []
    all_prims = list(result.background) + list(result.foreground)

    for idx, p in enumerate(all_prims):
        if not isinstance(p, ArrowPrimitive):
            continue

        pts = [p.start] + list(p.waypoints) + [p.end]
        if len(pts) < 2:
            continue

        for i in range(len(pts) - 1):
            seg_len = (
                abs(pts[i + 1][0] - pts[i][0])
                + abs(pts[i + 1][1] - pts[i][1])
            )
            # Skip zero-length collapsed segments (degenerate bends)
            if seg_len < 0.5:
                continue

            if i == len(pts) - 2:
                # Last segment — carries the arrowhead
                if seg_len < MIN_ARROW_SEGMENT:
                    violations.append(ArrowViolation(
                        idx, "last", seg_len, MIN_ARROW_SEGMENT,
                        pts[i], pts[i + 1],
                    ))
            elif i == 0:
                # First segment — exit from source
                if seg_len < ARROW_EXIT_CLEARANCE:
                    violations.append(ArrowViolation(
                        idx, "first", seg_len, ARROW_EXIT_CLEARANCE,
                        pts[i], pts[i + 1],
                    ))
            else:
                # Interior segment
                if seg_len < ARROW_EXIT_CLEARANCE:
                    violations.append(ArrowViolation(
                        idx, f"mid-{i}", seg_len, ARROW_EXIT_CLEARANCE,
                        pts[i], pts[i + 1],
                    ))

    return violations
