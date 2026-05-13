"""Layout engine for declarative diagram trees.

Walks a ``Diagram`` tree, computes positions and dimensions for every
component, and returns a ``LayoutResult`` — a flat list of positioned
primitives that renderers (SVG, draw.io) consume directly.

This module knows nothing about SVG or draw.io.  It uses the grid helpers
and spacing tokens from ``diagram_shared``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Union

from diagram_model import (
    Annotation,
    Arrow,
    ArrowDirection,
    Bar,
    BarSegment,
    Border,
    Box,
    Component,
    Diagram,
    Fill,
    Helper,
    IconCluster,
    IconComponent,
    JaggedPanel,
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
    ARROW_GAP,
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
    size_to_px,
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
    component_id: str | None = None


@dataclass
class TextBlock:
    x: float
    y: float
    lines: list[dict]          # make_line() dicts
    component_id: str | None = None


@dataclass
class Icon:
    x: float
    y: float
    name: str
    fill: str = "#000000"
    component_id: str | None = None


@dataclass
class ArrowPrimitive:
    """A resolved arrow with absolute coordinates."""
    start: tuple[float, float]
    end: tuple[float, float]
    color: str = "#E95420"
    waypoints: list[tuple[float, float]] = field(default_factory=list)
    direction: str = "down"    # "down", "right", "up", "left"
    component_id: str | None = None
    source_ref: str = ""   # original "id.side" reference
    target_ref: str = ""   # original "id.side" reference


@dataclass
class ArrowLabelPrimitive:
    x: float
    y: float
    width: float
    height: float
    lines: list[dict]
    component_id: str | None = None


@dataclass
class CircleMarker:
    cx: float
    cy: float
    radius: float
    fill: str
    stroke: str = "#000000"
    component_id: str | None = None


@dataclass
class JaggedRect:
    x: float
    y: float
    width: float
    height: float
    fill: str = "#F3F3F3"
    component_id: str | None = None


@dataclass
class TerminalBar:
    x: float
    y: float
    width: float
    height: float
    command: str
    font_family: str | None = None
    component_id: str | None = None


@dataclass
class MatrixTile:
    x: float
    y: float
    label: str
    component_id: str | None = None


@dataclass
class RequestClusterPrimitive:
    x: float
    y: float
    component_id: str | None = None


@dataclass
class DashedLinePrimitive:
    x1: float
    y1: float
    x2: float
    y2: float
    dash: str = "12 8"
    component_id: str | None = None


Primitive = Union[
    Rect,
    TextBlock,
    Icon,
    ArrowPrimitive,
    ArrowLabelPrimitive,
    CircleMarker,
    JaggedRect,
    TerminalBar,
    MatrixTile,
    RequestClusterPrimitive,
    DashedLinePrimitive,
]


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
class ComponentInfo:
    """Serialisable component metadata for the interactive preview."""
    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    children: list["ComponentInfo"] = field(default_factory=list)
    source: str = ""   # arrow only: "component_id.side"
    target: str = ""   # arrow only: "component_id.side"
    waypoints: list[list[float]] = field(default_factory=list)  # arrow only: [[x,y], ...]
    # Layout metadata for interactive editing
    layout: str = ""  # "vertical", "horizontal", "grid", or "" (leaf)
    layout_gap: float = 0  # gap between children (col_gap for horizontal, row_gap for vertical)
    layout_col_gap: float = 0  # column gap (for grid layouts)
    layout_row_gap: float = 0  # row gap (for grid layouts)
    layout_cols: int = 0  # declared/effective columns for parent relayout
    layout_rows: int = 0  # declared/effective rows for parent relayout
    pad: float = 0  # internal padding (INSET for bordered panels, 0 for borderless)
    heading_height: float = 0  # height of panel heading (includes heading gap)
    grid_col: int = 0  # declared/effective column slot within the parent
    grid_row: int = 0  # declared/effective row slot within the parent
    grid_col_span: int = 1
    grid_row_span: int = 1


@dataclass
class LayoutResult:
    width: int
    height: int
    background: list[Primitive] = field(default_factory=list)
    foreground: list[Primitive] = field(default_factory=list)
    grid_info: GridInfo | None = None
    component_tree: list[ComponentInfo] = field(default_factory=list)


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
        font_family=line.font_family,
    )


def _lines_to_dicts(lines: list[Line]) -> list[dict]:
    return [_line_to_dict(ln) for ln in lines]


def _auto_invert_lines(lines: list[dict], bg_fill: str) -> list[dict]:
    """If the background is dark, flip any default-black text to white."""
    if bg_fill != "#000000":
        return lines
    out = []
    for d in lines:
        if d.get("fill") == "#000000":
            d = {**d, "fill": "#FFFFFF"}
        out.append(d)
    return out


def _auto_invert_icon(icon_fill: str | None, bg_fill: str) -> str:
    """If the background is dark, flip a default-black icon to white."""
    explicit = icon_fill or "#000000"
    if bg_fill == "#000000" and explicit == "#000000":
        return "#FFFFFF"
    return explicit


def _stamp(prims: list[Primitive], cid: str | None) -> list[Primitive]:
    """Set component_id on every primitive in the list (in place)."""
    if cid:
        for p in prims:
            p.component_id = cid
    return prims


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
        heights.append(max(max_h, BOX_MIN_HEIGHT))
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
    min_width: int = 0,
) -> tuple[_Bounds, list[Primitive], list[Primitive]]:
    """Lay out a panel and its children.  Returns bounds + primitives."""
    col_width = panel.effective_col_width or default_col_width
    col_gap = panel.effective_col_gap if panel.effective_col_gap is not None else default_col_gap
    row_gap = panel.effective_row_gap if panel.effective_row_gap is not None else default_row_gap
    panel_border = panel.effective_border
    pad = 0 if panel_border == Border.NONE else INSET  # FILL keeps INSET

    # Separate children by type
    _PANEL_CHILD_TYPES = (Box, Bar, Helper, Annotation, Terminal, Panel, MatrixWidget)
    boxes = [c for c in panel.children if isinstance(c, Box)]
    bars = [c for c in panel.children if isinstance(c, Bar)]
    all_helpers = [c for c in panel.children if isinstance(c, (Helper, Annotation))]
    terminals = [c for c in panel.children if isinstance(c, Terminal)]
    sub_panels = [c for c in panel.children if isinstance(c, Panel)]
    matrices = [c for c in panel.children if isinstance(c, MatrixWidget)]
    # Warn about child types that _layout_panel does not handle
    for c in panel.children:
        if not isinstance(c, _PANEL_CHILD_TYPES):
            import warnings
            cid = getattr(c, "id", "") or type(c).__name__
            warnings.warn(
                f"Panel child '{cid}' has type {type(c).__name__} which is "
                f"not supported inside a Panel and will be silently dropped",
                stacklevel=2,
            )

    # Helpers with col/row go into the grid; others are unsupported
    grid_helpers = [h for h in all_helpers if hasattr(h, "col") and hasattr(h, "row")]

    # All grid-placed items for dimension computation
    grid_items = boxes + grid_helpers + matrices

    # Determine grid dimensions
    cols = panel.effective_cols
    if panel.effective_rows is not None:
        rows = panel.effective_rows
    else:
        rows = max((gi.row for gi in grid_items), default=0) + 1 if grid_items else 0

    # Heading
    heading_h = 0
    heading_gap = row_gap
    if panel.heading:
        heading_lines = _lines_to_dicts([panel.heading])
        heading_h = tight_box_height(heading_lines)
        # Always reserve icon-height clearance so panels with and without
        # icons produce the same heading height and children align.
        heading_h = max(heading_h, ICON_SIZE + INSET)

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
            cs = getattr(bx, "col_span", 1) or 1
            rs = getattr(bx, "row_span", 1) or 1
            span_w = cs * col_width + (cs - 1) * col_gap if cs > 1 else col_width
            span_h = sum(row_heights[bx.row:bx.row + rs]) + (rs - 1) * row_gap if rs > 1 else row_heights[bx.row]
            bx_w = bx.width or span_w
            bx_h = bx.height or span_h
            bx_fill = bx.fill.value
            bx_stroke = "none" if bx.effective_border in (Border.NONE, Border.FILL) else "#000000"
            bx_cid = bx.id or None

            fg.append(Rect(bx_x, bx_y, bx_w, bx_h, fill=bx_fill, stroke=bx_stroke,
                           component_id=bx_cid))
            fg.append(TextBlock(bx_x + INSET, bx_y + INSET,
                                _auto_invert_lines(_lines_to_dicts(bx.label), bx_fill),
                                component_id=bx_cid))
            if bx.icon:
                fg.append(Icon(
                    bx_x + bx_w - INSET - ICON_SIZE,
                    bx_y + INSET,
                    bx.icon,
                    fill=_auto_invert_icon(bx.icon_fill, bx_fill),
                    component_id=bx_cid,
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
            fg.append(MatrixTile(mx, my, mw.label, component_id=mw.id or None))
            child_bounds.append(_Bounds(mx, my, MATRIX_SIZE, MATRIX_SIZE, mw))

        content_y = y + row_ys[-1] + row_heights[-1] + row_gap

    # ── Sub-panels (laid out side-by-side below boxes) ──
    if sub_panels:
        # ── Pre-pass: equalize bar heights across sibling sub-panels ──
        # Collect bars-per-index across all siblings and set each bar's
        # height to the max at that index so rows align horizontally.
        sibling_bars: list[list[Bar]] = []
        for sp in sub_panels:
            sp_bars = [c for c in sp.children if isinstance(c, Bar)]
            sibling_bars.append(sp_bars)
        if len(sibling_bars) > 1:
            max_bar_count = max(len(bl) for bl in sibling_bars)
            for idx in range(max_bar_count):
                max_h = 0
                for bl in sibling_bars:
                    if idx < len(bl):
                        max_h = max(max_h, _min_bar_height(bl[idx]))
                for bl in sibling_bars:
                    if idx < len(bl):
                        bl[idx].height = max(bl[idx].height, max_h)

        sp_x = x + pad
        sp_results: list[tuple[Panel, _Bounds, list, list]] = []

        # Auto-fill: derive sub-panel content width from the parent's
        # available content span when the sub-panel has no explicit col_width.
        n_subs = len(sub_panels)
        parent_content_w = cols * col_width + (cols - 1) * col_gap
        sp_outer_w = (parent_content_w - (n_subs - 1) * col_gap) / n_subs
        sp_outer_w = round_up_to_grid(int(sp_outer_w))

        for sp in sub_panels:
            # If sub-panel has explicit col_width, respect it; otherwise
            # derive from the equal-share outer width minus its own padding,
            # divided by its internal column count.
            if sp.col_width is not None:
                sp_default_cw = sp.col_width
            else:
                sp_pad = 0 if sp.effective_border == Border.NONE else INSET  # FILL keeps INSET
                sp_content = sp_outer_w - 2 * sp_pad
                sp_n_cols = sp.cols if sp.cols and sp.cols > 0 else 1
                sp_inner_gap = sp.col_gap if sp.col_gap is not None else col_gap
                sp_default_cw = (sp_content - (sp_n_cols - 1) * sp_inner_gap) // sp_n_cols
                sp_default_cw = round_up_to_grid(sp_default_cw)
            sp_bounds, sp_fg, sp_bg = _layout_panel(
                sp, sp_x, content_y,
                default_col_width=sp_default_cw,
                default_col_gap=col_gap,
                default_row_gap=row_gap,
                bounds_map=bounds_map,
            )
            sp_results.append((sp, sp_bounds, sp_fg, sp_bg))
            sp_x += sp_bounds.width + col_gap

        # Equalize side-by-side sub-panel heights to the tallest
        sp_max_h = max(r[1].height for r in sp_results)
        for sp, sp_bounds, sp_fg, sp_bg in sp_results:
            if sp_bounds.height < sp_max_h and sp.effective_border != Border.NONE:
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

    # Enforce minimum width (from parent grid cell in outset mode)
    if min_width > 0:
        panel_w = max(panel_w, min_width)

    # Heading icon (needs panel_w)
    if panel.icon:
        fg.append(Icon(
            x + panel_w - pad - ICON_SIZE,
            y + pad,
            panel.icon,
            component_id=panel.id,
        ))

    # Panel frame (emitted last so we know final size, but insert at front for z-order)
    if panel_border != Border.NONE:
        stroke = "none" if panel_border == Border.FILL else "#000000"
        frame = Rect(x, y, panel_w, panel_h, fill=panel.fill.value,
                     stroke=stroke,
                     dashed=(panel_border == Border.DASHED),
                     component_id=panel.id)
        fg.insert(0, frame)

    # Stamp heading text with panel ID
    if panel.heading and panel.id:
        # The heading TextBlock is the first fg element (or second if frame inserted)
        for p in fg:
            if isinstance(p, TextBlock) and p.component_id is None:
                p.component_id = panel.id
                break

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
    stroke = "none" if bx.effective_border in (Border.NONE, Border.FILL) else "#000000"
    cid = bx.id or None
    prims: list[Primitive] = []
    prims.append(Rect(x, y, w, h, fill=fill, stroke=stroke, component_id=cid))
    prims.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(bx.label),
                           component_id=cid))
    if bx.icon:
        prims.append(Icon(x + w - INSET - ICON_SIZE, y + INSET, bx.icon,
                          fill=bx.icon_fill or "#000000", component_id=cid))
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
    *,
    parent_col_gap: int | None = None,
    parent_row_gap: int | None = None,
) -> tuple[float, float]:
    """Return (width, height) a component needs, without rendering it."""
    if isinstance(comp, Box):
        w = comp.width or default_width
        has_icon = comp.icon is not None
        h = comp.height or tight_box_height(_lines_to_dicts(comp.label), has_icon=has_icon)
        return (w, h)
    elif isinstance(comp, Panel):
        # Need to actually lay out the panel to know its size.
        # Use parent grid gaps so the estimate matches actual rendering.
        b, _, _ = _layout_panel(
            comp, 0, 0,
            default_col_width=default_width,
            default_col_gap=parent_col_gap or COMPACT_GAP,
            default_row_gap=parent_row_gap or COMPACT_GAP,
            bounds_map={},
        )
        return (b.width, b.height)
    elif isinstance(comp, Annotation):
        lines = _lines_to_dicts(comp.lines)
        h = tight_box_height(lines, has_icon=False)
        return (default_width, h)
    elif isinstance(comp, Helper):
        lines = _lines_to_dicts(comp.lines)
        n = len(lines)
        line_step = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
        hw = comp.width if hasattr(comp, "width") and comp.width else default_width
        return (hw, n * line_step)
    elif isinstance(comp, (MemoryWall, JaggedPanel)):
        return (comp.width or BLOCK_WIDTH, comp.height or BOX_MIN_HEIGHT)
    elif isinstance(comp, MatrixWidget):
        return (MATRIX_SIZE, MATRIX_SIZE)
    elif isinstance(comp, IconCluster):
        n = len(comp.icons)
        return (ICON_SIZE * n + COMPACT_GAP * max(0, n - 1), ICON_SIZE)
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
    *,
    parent_col_gap: int | None = None,
    parent_row_gap: int | None = None,
    parent_col_width: int | None = None,
) -> tuple[_Bounds, list, list]:
    """Render *comp* at (x, y) with cell size (w, h).

    Returns (bounds, foreground_prims, background_prims).
    """
    fg: list = []
    bg: list = []

    if isinstance(comp, Panel):
        # Auto-fill: derive the panel's default content col_width from the
        # cell width so panels fill their grid cells without manual math.
        # For multi-column panels, divide content among N columns + gaps.
        # Only constrain if the cell is larger than BLOCK_WIDTH (i.e. the
        # cell has been explicitly sized); otherwise let content drive width.
        panel_pad = 0 if comp.effective_border == Border.NONE else INSET  # FILL keeps pad
        if w > 0 and int(w) > BLOCK_WIDTH:
            content_w = int(w - 2 * panel_pad)
            n_internal_cols = comp.cols if comp.cols and comp.cols > 0 else 1
            internal_gap = parent_col_gap if parent_col_gap is not None else (comp.col_gap if comp.col_gap is not None else COMPACT_GAP)
            auto_cw = (content_w - (n_internal_cols - 1) * internal_gap) // n_internal_cols
            auto_cw = round_up_to_grid(auto_cw)
        else:
            auto_cw = BLOCK_WIDTH
        bounds, comp_fg, comp_bg = _layout_panel(
            comp, x, y,
            default_col_width=auto_cw,
            default_col_gap=parent_col_gap or COMPACT_GAP,
            default_row_gap=parent_row_gap or COMPACT_GAP,
            bounds_map=bounds_map,
            min_height=min_height,
            min_width=int(w) if parent_col_width is not None else 0,
        )
        fg.extend(comp_fg)
        bg.extend(comp_bg)
        return bounds, fg, bg

    elif isinstance(comp, Box):
        bw = comp.width or default_width
        # The parent layout may resolve a different width (e.g. content-
        # width alignment in VERTICAL mode).  Honour the parent when it
        # provides a concrete w, stretching *or* shrinking.
        if w > 0 and int(w) != bw:
            bw = int(w)
        has_icon = comp.icon is not None
        bh = comp.height or tight_box_height(_lines_to_dicts(comp.label), has_icon=has_icon)
        fill = comp.fill.value
        stroke = "none" if comp.effective_border in (Border.NONE, Border.FILL) else "#000000"
        cid = comp.id or None
        fg.append(Rect(x, y, bw, bh, fill=fill, stroke=stroke, component_id=cid))
        fg.append(TextBlock(x + INSET, y + INSET,
                            _auto_invert_lines(_lines_to_dicts(comp.label), fill),
                            component_id=cid))
        if comp.icon:
            fg.append(Icon(x + bw - INSET - ICON_SIZE, y + INSET, comp.icon,
                           fill=_auto_invert_icon(comp.icon_fill, fill), component_id=cid))
        return _Bounds(x, y, bw, bh, comp), fg, bg

    elif isinstance(comp, Annotation):
        # Annotation: anchored text box that participates in grid sizing.
        ann_w = int(w) if w > 0 else default_width
        lines = _lines_to_dicts(comp.lines)
        has_icon = False
        ann_h = tight_box_height(lines, has_icon=has_icon)
        ann_fill = comp.fill.value
        ann_stroke = "none" if comp.border == Border.NONE else "#000000"
        ann_dashed = comp.border == Border.DASHED
        cid = comp.id or None
        fg.append(Rect(x, y, ann_w, ann_h, fill=ann_fill, stroke=ann_stroke,
                        dashed=ann_dashed, component_id=cid))
        fg.append(TextBlock(x + INSET, y + INSET, lines, component_id=cid))
        return _Bounds(x, y, ann_w, ann_h, comp), fg, bg

    elif isinstance(comp, Helper):
        lines = _lines_to_dicts(comp.lines)
        n = len(lines)
        line_step = int(lines[0]["line_step"]) if lines else BODY_LINE_STEP
        ch = n * line_step
        cid = comp.id or None
        fg.append(TextBlock(x, y, lines, component_id=cid))
        return _Bounds(x, y, int(w), ch, comp), fg, bg

    elif isinstance(comp, (MemoryWall, JaggedPanel)):
        mw = comp.width or BLOCK_WIDTH
        mh = comp.height or BOX_MIN_HEIGHT
        cid = comp.id or None
        fg.append(JaggedRect(x, y, mw, mh, component_id=cid))
        fg.append(TextBlock(x + INSET, y + INSET, _lines_to_dicts(comp.label), component_id=cid))
        return _Bounds(x, y, mw, mh, comp), fg, bg

    elif isinstance(comp, MatrixWidget):
        cid = comp.id or None
        fg.append(MatrixTile(x, y, comp.label, component_id=cid))
        return _Bounds(x, y, MATRIX_SIZE, MATRIX_SIZE, comp), fg, bg

    elif isinstance(comp, IconCluster):
        n_icons = len(comp.icons)
        cw = ICON_SIZE * n_icons + COMPACT_GAP * max(0, n_icons - 1)
        cid = comp.id or None
        ix = x
        for icon_name in comp.icons:
            fg.append(Icon(ix, y, icon_name, fill=comp.fill, component_id=cid))
            ix += ICON_SIZE + COMPACT_GAP
        return _Bounds(x, y, cw, ICON_SIZE, comp), fg, bg

    elif isinstance(comp, RequestCluster):
        cw = ICON_SIZE * 3 + COMPACT_GAP * 2
        fg.append(RequestClusterPrimitive(x, y))
        return _Bounds(x, y, cw, ICON_SIZE, comp), fg, bg

    elif isinstance(comp, IconComponent):
        fg.append(Icon(x, y, comp.icon, fill=comp.fill))
        return _Bounds(x, y, ICON_SIZE, ICON_SIZE, comp), fg, bg

    elif isinstance(comp, Terminal):
        tw = comp.width or default_width
        # Honour parent-resolved width (same as Box)
        if w > 0 and int(w) != tw:
            tw = int(w)
        th = BOX_MIN_HEIGHT
        cid = comp.id or None
        fg.append(TerminalBar(x, y, tw, th, comp.command, comp.font_family, component_id=cid))
        return _Bounds(x, y, tw, th, comp), fg, bg

    elif isinstance(comp, Separator):
        # Renders as a centered dashed horizontal line
        sep_h = BASELINE_UNIT  # thin row
        mid_y = y + sep_h / 2
        cid = comp.id or None
        if not cid:
            # Auto-generate id so separators appear in component tree
            cid = f"sep_{int(x)}_{int(y)}"
            comp.id = cid
        fg.append(DashedLinePrimitive(x, mid_y, x + w, mid_y, dash=comp.dash, component_id=cid))
        return _Bounds(x, y, int(w), sep_h, comp), fg, bg

    elif isinstance(comp, Legend):
        cid = comp.id or None
        lx = x
        for entry in comp.entries:
            fg.append(CircleMarker(lx + 4, y + 10, 4, entry.color, component_id=cid))
            fg.append(TextBlock(lx + 16, y, [_make_line(entry.label, fill=HELPER_COLOR)], component_id=cid))
            lx += 100
        return _Bounds(x, y, lx - x, 24, comp), fg, bg

    # Fallback
    return _Bounds(x, y, int(w), int(h), comp), fg, bg


# ---------------------------------------------------------------------------
# Arrow resolution
# ---------------------------------------------------------------------------

# -- Obstacle helpers -------------------------------------------------------

def _collect_obstacles(
    bounds_map: dict[str, "_Bounds"],
    exclude_ids: set[str],
    pad: float = ARROW_GAP / 2,
) -> list[tuple[float, float, float, float]]:
    """Return a list of (x, y, x2, y2) obstacle rectangles.

    Each rectangle is the axis-aligned bounding box of a component,
    inflated by *pad* on all sides.  Components whose id is in
    *exclude_ids* (source/target of the arrow being routed) are skipped
    so the arrow can actually reach them.
    """
    def _is_arrow_obstacle(component: Any) -> bool:
        # Separators are guideline primitives, not blocking boxes.
        return not isinstance(component, Separator)

    obstacles: list[tuple[float, float, float, float]] = []
    for cid, b in bounds_map.items():
        if cid in exclude_ids:
            continue
        if not _is_arrow_obstacle(b.component):
            continue
        obstacles.append((
            b.x - pad,
            b.y - pad,
            b.x + b.width + pad,
            b.y + b.height + pad,
        ))
    return obstacles


def _seg_hits_obstacle(
    ax: float, ay: float, bx: float, by: float,
    obstacles: list[tuple[float, float, float, float]],
) -> bool:
    """Return True if the axis-aligned segment (ax,ay)→(bx,by) passes
    through any obstacle rectangle (interior intersection, not just
    touching the boundary).
    """
    for ox, oy, ox2, oy2 in obstacles:
        if ax == bx:
            # Vertical segment
            if ox < ax < ox2:
                lo, hi = (min(ay, by), max(ay, by))
                if lo < oy2 and hi > oy:
                    return True
        elif ay == by:
            # Horizontal segment
            if oy < ay < oy2:
                lo, hi = (min(ax, bx), max(ax, bx))
                if lo < ox2 and hi > ox:
                    return True
    return False


def _path_hits_obstacle(
    pts: list[tuple[float, float]],
    obstacles: list[tuple[float, float, float, float]],
) -> bool:
    """Check if any segment in a polyline hits an obstacle."""
    for i in range(len(pts) - 1):
        if _seg_hits_obstacle(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], obstacles):
            return True
    return False


def _route_around_obstacles(
    src: tuple[float, float],
    tgt: tuple[float, float],
    src_side: str,
    tgt_side: str,
    waypoints: list[tuple[float, float]],
    obstacles: list[tuple[float, float, float, float]],
) -> list[tuple[float, float]]:
    """Attempt to re-route an arrow's waypoints to avoid obstacles.

    Strategy:
    1. If the initial path (src → waypoints → tgt) is clear, keep it.
    2. Otherwise, try routing via the edges of the blocking obstacle(s),
       using a U-bend around the nearest blocking rectangle.

    Returns the (possibly modified) waypoints list.
    """
    pts = [src] + waypoints + [tgt]
    if not _path_hits_obstacle(pts, obstacles):
        return waypoints

    # Find which obstacles are hit and attempt a detour
    sx, sy = src
    tx, ty = tgt
    vertical_src = src_side in ("top", "bottom")
    vertical_tgt = tgt_side in ("top", "bottom")

    # Gather all obstacles that the current path intersects
    blocking = []
    for obs in obstacles:
        for i in range(len(pts) - 1):
            if _seg_hits_obstacle(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [obs]):
                blocking.append(obs)
                break

    if not blocking:
        return waypoints

    # Use the union bounding box of all blocking obstacles to route around
    union_x = min(o[0] for o in blocking)
    union_y = min(o[1] for o in blocking)
    union_x2 = max(o[2] for o in blocking)
    union_y2 = max(o[3] for o in blocking)

    # Determine which side to detour around based on source/target positions
    # relative to the blocking area
    clearance = ARROW_EXIT_CLEARANCE

    if vertical_src and vertical_tgt:
        # Both vertical sides — try routing around left or right
        center_x = (union_x + union_x2) / 2
        # Route via the side closer to both endpoints
        left_dist = abs(sx - union_x) + abs(tx - union_x)
        right_dist = abs(sx - union_x2) + abs(tx - union_x2)

        if left_dist <= right_dist:
            # Route left of the obstacle
            detour_x = math.floor((union_x - clearance) / BASELINE_UNIT) * BASELINE_UNIT
        else:
            # Route right of the obstacle
            detour_x = math.ceil((union_x2 + clearance) / BASELINE_UNIT) * BASELINE_UNIT

        if src_side == "bottom" and tgt_side == "top" and sy < ty:
            # Normal downward flow — U-bend: down, sideways, sideways, down.
            # exit_y must be above the obstacle union; entry_y below it.
            # Snap exit_y toward source (floor toward obstacle top).
            exit_y = round((sy + clearance) / BASELINE_UNIT) * BASELINE_UNIT
            exit_y_max = math.floor(union_y / BASELINE_UNIT) * BASELINE_UNIT
            if exit_y_max >= union_y:
                exit_y_max -= BASELINE_UNIT
            exit_y = min(exit_y, exit_y_max)
            # Snap entry_y away from obstacle bottom (ceil past obstacle).
            entry_y = round((ty - MIN_ARROW_SEGMENT) / BASELINE_UNIT) * BASELINE_UNIT
            entry_y_min = math.ceil(union_y2 / BASELINE_UNIT) * BASELINE_UNIT
            if entry_y_min <= union_y2:
                entry_y_min += BASELINE_UNIT
            entry_y = max(entry_y, entry_y_min)
            # Clamp to leave at least one baseline unit for approach
            if entry_y >= ty:
                entry_y = ty - BASELINE_UNIT
            new_wps = [
                (sx, exit_y),
                (detour_x, exit_y),
                (detour_x, entry_y),
                (tx, entry_y),
            ]
        elif src_side == "top" and tgt_side == "bottom" and sy > ty:
            exit_y = round((sy - clearance) / BASELINE_UNIT) * BASELINE_UNIT
            exit_y_min = math.ceil(union_y2 / BASELINE_UNIT) * BASELINE_UNIT
            if exit_y_min <= union_y2:
                exit_y_min += BASELINE_UNIT
            exit_y = max(exit_y, exit_y_min)
            entry_y = round((ty + MIN_ARROW_SEGMENT) / BASELINE_UNIT) * BASELINE_UNIT
            entry_y_max = math.floor(union_y / BASELINE_UNIT) * BASELINE_UNIT
            if entry_y_max >= union_y:
                entry_y_max -= BASELINE_UNIT
            entry_y = min(entry_y, entry_y_max)
            if entry_y <= ty:
                entry_y = ty + BASELINE_UNIT
            new_wps = [
                (sx, exit_y),
                (detour_x, exit_y),
                (detour_x, entry_y),
                (tx, entry_y),
            ]
        else:
            # Fallback: Z-bend around
            mid_y = round(((sy + ty) / 2) / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [
                (sx, mid_y),
                (detour_x, mid_y),
                (detour_x, round(ty / BASELINE_UNIT) * BASELINE_UNIT),
                (tx, round(ty / BASELINE_UNIT) * BASELINE_UNIT),
            ]

    elif not vertical_src and not vertical_tgt:
        # Both horizontal sides — try routing above or below
        top_dist = abs(sy - union_y) + abs(ty - union_y)
        bottom_dist = abs(sy - union_y2) + abs(ty - union_y2)

        if top_dist <= bottom_dist:
            detour_y = round((union_y - clearance) / BASELINE_UNIT) * BASELINE_UNIT
        else:
            detour_y = round((union_y2 + clearance) / BASELINE_UNIT) * BASELINE_UNIT

        if src_side == "right" and tgt_side == "left" and sx < tx:
            exit_x = round((sx + clearance) / BASELINE_UNIT) * BASELINE_UNIT
            entry_x = round((tx - MIN_ARROW_SEGMENT) / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [
                (exit_x, sy),
                (exit_x, detour_y),
                (entry_x, detour_y),
                (entry_x, ty),
            ]
        else:
            mid_x = round(((sx + tx) / 2) / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [
                (mid_x, sy),
                (mid_x, detour_y),
                (round(tx / BASELINE_UNIT) * BASELINE_UNIT, detour_y),
            ]
    else:
        # Mixed vertical/horizontal — L-bend may hit obstacles when the
        # vertical and horizontal segments cross intervening components.
        if vertical_src:
            # top/bottom → left/right: route the vertical leg outside
            # the obstacle column, then approach horizontally.
            src_goes_up = src_side == "top"
            # Pick a detour X on the side of the union box that is
            # closer to the source (or away from the target).
            left_clear = union_x - clearance
            right_clear = union_x2 + clearance
            # Prefer the side that keeps the detour between src and
            # the margin (shorter overall path).
            if abs(sx - left_clear) <= abs(sx - right_clear):
                detour_x = round(left_clear / BASELINE_UNIT) * BASELINE_UNIT
            else:
                detour_x = round(right_clear / BASELINE_UNIT) * BASELINE_UNIT

            # Exit vertically from source by ARROW_EXIT_CLEARANCE,
            # jog horizontally to detour_x, run vertically to target Y,
            # then approach target horizontally.
            exit_y = round((sy + (-1 if src_goes_up else 1) * ARROW_EXIT_CLEARANCE)
                           / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [
                (sx, exit_y),         # short exit from source
                (detour_x, exit_y),   # jog sideways into clear column
                (detour_x, ty),       # run vertically to target Y
            ]
        else:
            # left/right → top/bottom
            tgt_goes_up = tgt_side == "top"
            top_clear = union_y - clearance
            bottom_clear = union_y2 + clearance
            if abs(sy - top_clear) <= abs(sy - bottom_clear):
                detour_y = round(top_clear / BASELINE_UNIT) * BASELINE_UNIT
            else:
                detour_y = round(bottom_clear / BASELINE_UNIT) * BASELINE_UNIT

            exit_x = round((sx + (1 if src_side == "right" else -1) * ARROW_EXIT_CLEARANCE)
                           / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [
                (exit_x, sy),
                (exit_x, detour_y),
                (tx, detour_y),
            ]

    # Verify the new path is clear; if not, return original (best effort)
    new_pts = [src] + new_wps + [tgt]
    if not _path_hits_obstacle(new_pts, obstacles):
        # Simplify: remove collinear waypoints
        return _simplify_waypoints(new_wps, src, tgt)
    return waypoints


def _simplify_waypoints(
    wps: list[tuple[float, float]],
    src: tuple[float, float],
    tgt: tuple[float, float],
) -> list[tuple[float, float]]:
    """Remove redundant collinear waypoints from an orthogonal path."""
    pts = [src] + wps + [tgt]
    simplified: list[tuple[float, float]] = []
    for i in range(1, len(pts) - 1):
        prev, cur, nxt = pts[i - 1], pts[i], pts[i + 1]
        # Keep the point only if it's a real bend (direction changes)
        h_same = (prev[1] == cur[1] == nxt[1])  # all on same Y
        v_same = (prev[0] == cur[0] == nxt[0])  # all on same X
        if not h_same and not v_same:
            simplified.append(cur)
    return simplified


def _estimate_label_width(lines: list[dict]) -> float:
    max_width = 0.0
    for spec in lines:
        text = str(spec["content"])
        size_px = size_to_px(spec["size"])
        weight = str(spec.get("weight", "400"))
        width_factor = 0.62 if weight in {"600", "700"} else 0.58
        width = len(text) * size_px * width_factor
        if spec.get("small_caps"):
            width *= 1.05
        max_width = max(max_width, width)
    return max(max_width, size_to_px(BODY_SIZE) * 3)


def _estimate_label_height(lines: list[dict]) -> float:
    current_top = 0.0
    max_bottom = 0.0
    for spec in lines:
        size_px = size_to_px(spec["size"])
        max_bottom = max(max_bottom, current_top + size_px * 1.2)
        current_top += float(spec["line_step"])
    return max_bottom


def _label_overlaps_obstacles(
    label_box: tuple[float, float, float, float],
    obstacles: list[tuple[float, float, float, float]],
) -> bool:
    lx, ly, lx2, ly2 = label_box
    for ox, oy, ox2, oy2 in obstacles:
        if lx < ox2 and lx2 > ox and ly < oy2 and ly2 > oy:
            return True
    return False


def _arrow_label_candidates(
    pts: list[tuple[float, float]],
    label_w: float,
    label_h: float,
    gap: float,
) -> list[tuple[float, float]]:
    segments: list[tuple[float, tuple[float, float], tuple[float, float]]] = []
    for i in range(len(pts) - 1):
        a = pts[i]
        b = pts[i + 1]
        seg_len = abs(b[0] - a[0]) + abs(b[1] - a[1])
        if seg_len <= 0:
            continue
        segments.append((seg_len, a, b))
    segments.sort(key=lambda item: item[0], reverse=True)

    candidates: list[tuple[float, float]] = []
    for _, a, b in segments:
        if a[1] == b[1]:
            seg_left = min(a[0], b[0])
            seg_right = max(a[0], b[0])
            x_positions = [
                seg_left + max(0.0, (abs(b[0] - a[0]) - label_w) / 2),
                seg_left,
                max(seg_left, seg_right - label_w),
            ]
            for label_x in x_positions:
                candidates.append((label_x, a[1] - gap - label_h))
                candidates.append((label_x, a[1] + gap))
        elif a[0] == b[0]:
            seg_top = min(a[1], b[1])
            seg_bottom = max(a[1], b[1])
            y_positions = [
                seg_top + max(0.0, (abs(b[1] - a[1]) - label_h) / 2),
                seg_top,
                max(seg_top, seg_bottom - label_h),
            ]
            for label_y in y_positions:
                candidates.append((a[0] - gap - label_w, label_y))
                candidates.append((a[0] + gap, label_y))
    return candidates


def _route_for_label_space(
    src: tuple[float, float],
    tgt: tuple[float, float],
    waypoints: list[tuple[float, float]],
    label_w: float,
    label_h: float,
    gap: float,
    obstacles: list[tuple[float, float, float, float]],
) -> list[tuple[float, float]] | None:
    sx, sy = src
    tx, ty = tgt
    pts = [src] + waypoints + [tgt]
    dx = abs(tx - sx)
    dy = abs(ty - sy)

    if dy >= dx:
        shift = round_up_to_grid(label_w + gap * 2)
        mid_y = round(((sy + ty) / 2) / BASELINE_UNIT) * BASELINE_UNIT
        for direction in (-1, 1):
            detour_x = round((sx + direction * shift) / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [(sx, mid_y), (detour_x, mid_y), (detour_x, ty)]
            if detour_x != tx:
                new_wps.append((tx, ty))
            new_wps = _simplify_waypoints(new_wps, src, tgt)
            if not _path_hits_obstacle([src] + new_wps + [tgt], obstacles):
                return new_wps
    else:
        shift = round_up_to_grid(label_h + gap * 2)
        mid_x = round(((sx + tx) / 2) / BASELINE_UNIT) * BASELINE_UNIT
        for direction in (-1, 1):
            detour_y = round((sy + direction * shift) / BASELINE_UNIT) * BASELINE_UNIT
            new_wps = [(mid_x, sy), (mid_x, detour_y), (tx, detour_y)]
            if detour_y != ty:
                new_wps.append((tx, ty))
            new_wps = _simplify_waypoints(new_wps, src, tgt)
            if not _path_hits_obstacle([src] + new_wps + [tgt], obstacles):
                return new_wps
    return None


def _resolve_arrow_label(
    arrow: Arrow,
    arrow_id: str,
    src: tuple[float, float],
    tgt: tuple[float, float],
    waypoints: list[tuple[float, float]],
    bounds_map: dict[str, _Bounds],
) -> tuple[list[tuple[float, float]], ArrowLabelPrimitive | None]:
    if not arrow.label:
        return waypoints, None

    lines = _lines_to_dicts(arrow.label)
    gap = float(arrow.label_gap if arrow.label_gap is not None else GRID_GUTTER)
    label_w = _estimate_label_width(lines)
    label_h = _estimate_label_height(lines)
    obstacles = [
        (b.x, b.y, b.x + b.width, b.y + b.height)
        for b in bounds_map.values()
    ]

    def _pick_candidate(points: list[tuple[float, float]]) -> tuple[float, float] | None:
        for x, y in _arrow_label_candidates(points, label_w, label_h, gap):
            if x < 0 or y < 0:
                continue
            label_box = (x, y, x + label_w, y + label_h)
            if _label_overlaps_obstacles(label_box, obstacles):
                continue
            if _path_hits_obstacle(points, [label_box]):
                continue
            return (x, y)
        return None

    pts = [src] + waypoints + [tgt]
    chosen = _pick_candidate(pts)
    if chosen is None:
        rerouted = _route_for_label_space(src, tgt, waypoints, label_w, label_h, gap, obstacles)
        if rerouted is not None:
            waypoints = rerouted
            pts = [src] + waypoints + [tgt]
            chosen = _pick_candidate(pts)

    if chosen is None:
        fallback_candidates = _arrow_label_candidates(pts, label_w, label_h, gap)
        if fallback_candidates:
            for candidate in fallback_candidates:
                if candidate[0] >= 0 and candidate[1] >= 0:
                    chosen = candidate
                    break
            if chosen is None:
                chosen = fallback_candidates[0]
        else:
            chosen = (max(0.0, (src[0] + tgt[0]) / 2 + gap), max(0.0, (src[1] + tgt[1]) / 2))

    return waypoints, ArrowLabelPrimitive(
        x=chosen[0],
        y=chosen[1],
        width=label_w,
        height=label_h,
        lines=lines,
        component_id=arrow_id,
    )


def _resolve_arrows(
    arrows: list[Arrow],
    bounds_map: dict[str, _Bounds],
) -> list[tuple[ArrowPrimitive, ArrowLabelPrimitive | None]]:
    """Resolve arrow source/target references to absolute coordinates.

    When no explicit waypoints are given and the source/target aren't
    axis-aligned, the arrow is auto-routed orthogonally:
      - vertical (top/bottom sides): Z-bend with clearance-aware placement
      - horizontal (left/right sides): L-bend favouring the longer final segment

    The Z-bend placement ensures the final approach segment is at least
    MIN_ARROW_SEGMENT long (arrowhead + visible shaft) and the exit
    segment is at least ARROW_EXIT_CLEARANCE long.

    After initial routing, each arrow is checked for obstacle intersections.
    If the path crosses any component box, it is re-routed around the
    obstacle(s) using ``_route_around_obstacles``.
    """
    prims: list[tuple[ArrowPrimitive, ArrowLabelPrimitive | None]] = []
    for idx, arrow in enumerate(arrows):
        src = _resolve_anchor(arrow.source, bounds_map)
        tgt = _resolve_anchor(arrow.target, bounds_map)
        if not (src and tgt):
            continue

        # Auto-generate arrow ID if not provided
        arrow_id = arrow.id if arrow.id else f"arrow_{idx}"

        waypoints = list(arrow.waypoints)
        src_side = arrow.source.split(".")[-1]
        tgt_side = arrow.target.split(".")[-1]

        # Auto-route orthogonal if no explicit waypoints
        if not waypoints:
            sx, sy = src
            tx, ty = tgt

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

        # Obstacle avoidance: re-route if path crosses any component box
        src_comp_id = arrow.source.split(".")[0]
        tgt_comp_id = arrow.target.split(".")[0]
        exclude = {src_comp_id, tgt_comp_id}
        obstacles = _collect_obstacles(bounds_map, exclude)
        waypoints = _route_around_obstacles(
            src, tgt, src_side, tgt_side, waypoints, obstacles,
        )

        # Determine direction from last segment
        pts = [src] + waypoints + [tgt]
        dx = pts[-1][0] - pts[-2][0]
        dy = pts[-1][1] - pts[-2][1]
        if abs(dy) >= abs(dx):
            direction = "down" if dy > 0 else "up"
        else:
            direction = "right" if dx > 0 else "left"

        waypoints, label_prim = _resolve_arrow_label(
            arrow, arrow_id, src, tgt, waypoints, bounds_map,
        )

        arrow_prim = ArrowPrimitive(
            start=src, end=tgt, color=arrow.color,
            waypoints=waypoints, direction=direction,
            component_id=arrow_id,
            source_ref=arrow.source, target_ref=arrow.target,
        )
        prims.append((arrow_prim, label_prim))
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


def _measured_child_gaps(children: list[_Bounds]) -> tuple[float, float]:
    """Infer the rendered horizontal and vertical gaps between child bounds."""
    col_gaps: list[float] = []
    row_gaps: list[float] = []

    for idx, left in enumerate(children):
        for right in children[idx + 1:]:
            if abs(left.y - right.y) < 1.5:
                if left.x <= right.x:
                    gap = right.x - (left.x + left.width)
                else:
                    gap = left.x - (right.x + right.width)
                if gap > 0:
                    col_gaps.append(gap)

            if abs(left.x - right.x) < 1.5:
                if left.y <= right.y:
                    gap = right.y - (left.y + left.height)
                else:
                    gap = left.y - (right.y + right.height)
                if gap > 0:
                    row_gaps.append(gap)

    measured_col_gap = min(col_gaps) if col_gaps else 0.0
    measured_row_gap = min(row_gaps) if row_gaps else 0.0
    return measured_col_gap, measured_row_gap


def _bounds_to_component_info(bounds: "_Bounds") -> ComponentInfo | None:
    """Convert a _Bounds node to a ComponentInfo, recursively."""
    comp = bounds.component
    cid = getattr(comp, "id", None) or ""
    if not cid:
        return None
    ctype = type(comp).__name__
    children: list[ComponentInfo] = []
    for child in bounds.children:
        ci = _bounds_to_component_info(child)
        if ci:
            children.append(ci)
    # Derive layout metadata from the component
    layout_str = ""
    layout_gap = 0.0
    layout_col_gap = 0.0
    layout_row_gap = 0.0
    layout_cols = 0
    layout_rows = 0
    comp_pad = 0.0
    comp_heading_height = 0.0
    grid_col = int(getattr(comp, "col", 0) or 0)
    grid_row = int(getattr(comp, "row", 0) or 0)
    grid_col_span = int(getattr(comp, "col_span", 1) or 1)
    grid_row_span = int(getattr(comp, "row_span", 1) or 1)
    if hasattr(comp, "children") and len(getattr(comp, "children", [])) > 0:
        # Compute padding from border
        border = getattr(comp, "effective_border", None)
        if border is not None:
            comp_pad = 0.0 if border == Border.NONE else float(INSET)  # FILL keeps pad
        # Compute heading height
        heading = getattr(comp, "heading", None)
        if heading:
            heading_lines = _lines_to_dicts([heading])
            hh = tight_box_height(heading_lines)
            _erg = getattr(comp, "effective_row_gap", None)
            _rg = getattr(comp, "row_gap", None)
            row_gap_val = float(_erg if _erg is not None else (_rg if _rg is not None else 0))
            comp_heading_height = float(hh + row_gap_val)
        # Extract col_gap and row_gap
        _ecg = getattr(comp, "effective_col_gap", None)
        _cg = getattr(comp, "col_gap", None)
        cg = float(_ecg if _ecg is not None else (_cg if _cg is not None else 0))
        _erg2 = getattr(comp, "effective_row_gap", None)
        _rg2 = getattr(comp, "row_gap", None)
        rg = float(_erg2 if _erg2 is not None else (_rg2 if _rg2 is not None else 0))
        measured_cg, measured_rg = _measured_child_gaps(bounds.children)
        if measured_cg > 0:
            cg = measured_cg
        if measured_rg > 0:
            rg = measured_rg
        layout_col_gap = cg
        layout_row_gap = rg
        if hasattr(comp, "cols"):
            cols = getattr(comp, "effective_cols", None) or getattr(comp, "cols", 1)
            num_children = len(getattr(comp, "children", []))
            layout_cols = int(cols)
            if cols > 1:
                # Single row with cols == children count → horizontal
                # Multi-row grid otherwise
                rows = getattr(comp, "effective_rows", None) or getattr(comp, "rows", None)
                if rows is None and num_children > 0:
                    rows = -(-num_children // cols)  # ceil division
                layout_rows = int(rows or 0)
                if rows == 1 and cols == num_children:
                    layout_str = "horizontal"
                    layout_gap = cg
                else:
                    layout_str = "grid"
                    layout_gap = cg  # primary gap for grid
            else:
                layout_str = "vertical"
                layout_gap = rg
                layout_cols = 1
                explicit_rows = getattr(comp, "effective_rows", None) or getattr(comp, "rows", None)
                if explicit_rows is not None:
                    layout_rows = int(explicit_rows)
                else:
                    layout_rows = max(
                        (int(getattr(child, "row", 0) or 0) + int(getattr(child, "row_span", 1) or 1))
                        for child in getattr(comp, "children", [])
                    )
        else:
            layout_str = "vertical"
            layout_gap = rg
            layout_cols = 1
            layout_rows = max(
                (int(getattr(child, "row", 0) or 0) + int(getattr(child, "row_span", 1) or 1))
                for child in getattr(comp, "children", [])
            )
    return ComponentInfo(
        id=cid, type=ctype,
        x=bounds.x, y=bounds.y,
        width=bounds.width, height=bounds.height,
        children=children,
        layout=layout_str,
        layout_gap=layout_gap,
        layout_col_gap=layout_col_gap,
        layout_row_gap=layout_row_gap,
        layout_cols=layout_cols,
        layout_rows=layout_rows,
        pad=comp_pad,
        heading_height=comp_heading_height,
        grid_col=grid_col,
        grid_row=grid_row,
        grid_col_span=grid_col_span,
        grid_row_span=grid_row_span,
    )


# ---------------------------------------------------------------------------
# Main layout function
# ---------------------------------------------------------------------------

def layout(diagram: Diagram) -> LayoutResult:
    """Walk the diagram tree and compute all positions."""

    # ── Auto-assign IDs to components that lack them ──
    # This ensures every box, panel, etc. appears in the interactive preview's
    # component tree even when the diagram definition omits explicit IDs.
    _auto_counter = 0

    def _ensure_ids(components, prefix=""):
        nonlocal _auto_counter
        for comp in components:
            if hasattr(comp, "id") and not comp.id:
                _auto_counter += 1
                comp.id = f"_auto_{prefix}{_auto_counter}"
            # Recurse into panel children
            if hasattr(comp, "children") and comp.children:
                child_prefix = (comp.id + "_") if hasattr(comp, "id") and comp.id else prefix
                _ensure_ids(comp.children, child_prefix)

    _ensure_ids(diagram.components)

    outer = diagram.outer_margin if diagram.outer_margin is not None else OUTER_MARGIN
    col_gap = diagram.effective_col_gap if diagram.effective_col_gap is not None else GRID_GUTTER
    row_gap = diagram.effective_row_gap if diagram.effective_row_gap is not None else GRID_GUTTER

    fg: list[Primitive] = []
    bg: list[Primitive] = []
    bounds_map: dict[str, _Bounds] = {}
    all_bounds: list[_Bounds] = []

    # Separate arrows from positionable components
    arrows = [c for c in diagram.components if isinstance(c, Arrow)]
    components = [c for c in diagram.components if not isinstance(c, Arrow)]

    if diagram.arrangement == Diagram.Arrangement.GRID:
        # ── Müller-Brockmann grid: explicit cell placement ──

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
        n_cols = max(max_col, diagram.effective_cols)
        n_rows = max_row

        # Derive default column width:
        # If canvas_width is set, divide available space equally.
        # If col_width is set explicitly, use it.
        # Otherwise fall back to BLOCK_WIDTH.
        if diagram.canvas_width is not None:
            content_w = diagram.canvas_width - 2 * outer - (n_cols - 1) * col_gap
            default_cw = round_up_to_grid(content_w // n_cols)
        else:
            default_cw = diagram.effective_col_width or BLOCK_WIDTH
        default_rh = diagram.row_height or BOX_MIN_HEIGHT

        # 2. Compute natural sizes and build per-cell size requirements
        col_widths = [default_cw] * n_cols
        # Rows size from actual content first. This keeps thin primitives
        # such as separators from consuming a full box-height grid field.
        # Only rows with no measured single-row content fall back to the
        # diagram's default row height later.
        row_heights = [0] * n_rows

        sizes: list[tuple[float, float]] = []
        for comp in components:
            nw, nh = _natural_size(comp, default_cw, bounds_map,
                                   parent_col_gap=col_gap, parent_row_gap=row_gap)
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

        # Fill any still-empty rows with the diagram default, then snap.
        row_heights = [h if h > 0 else default_rh for h in row_heights]

        # Snap to grid
        col_widths = [round_up_to_grid(w) for w in col_widths]
        row_heights = [round_up_to_grid(h) for h in row_heights]

        # When canvas_width is set, lock columns to the derived width
        # so content-driven growth doesn't break the fixed canvas.
        if diagram.canvas_width is not None:
            col_widths = [default_cw] * n_cols

        # Uniform rows: equalize all row heights to the tallest
        if diagram.uniform_rows:
            max_rh = max(row_heights)
            row_heights = [max_rh] * n_rows

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

            # Outset: panels shift left by pad and grow wider so their
            # children land on the same column rhythm as standalone boxes.
            pcg: int | None = None
            prg: int | None = None
            pcw: int | None = None
            if isinstance(comp, Panel) and cs >= 1:
                panel_pad = 0 if comp.effective_border == Border.NONE else INSET
                x -= panel_pad
                cell_w += 2 * panel_pad
                pcg = col_gap
                prg = row_gap
                pcw = col_widths[c]

            bounds, comp_fg, comp_bg = _render_component(
                comp, x, y, cell_w, cell_h,
                default_width=int(cell_w),
                bounds_map=bounds_map,
                min_height=int(cell_h),
                parent_col_gap=pcg,
                parent_row_gap=prg,
                parent_col_width=pcw,
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
        #
        # Two-pass layout (like Figma "Fill container"):
        #   Pass 1 — measure natural widths/heights of all components.
        #            Separate CONTENT width from OUTER width.  Panels have
        #            padding (INSET) around their content; standalone boxes
        #            do not.  The resolved column is based on the widest
        #            CONTENT, so standalone boxes and panel children share
        #            the same right edge.
        #   Pass 2 — render each component at the resolved width.

        # Pass 1: measure
        nat_sizes: list[tuple[float, float]] = []
        for comp in components:
            nw, nh = _natural_size(comp, BLOCK_WIDTH, bounds_map)
            nat_sizes.append((nw, nh))

        if diagram.arrangement == Diagram.Arrangement.HORIZONTAL:
            # Horizontal: unify row height across siblings
            col_width_resolved = BLOCK_WIDTH
            row_height_resolved = max((nh for _, nh in nat_sizes), default=BOX_MIN_HEIGHT)
        else:
            # Vertical: resolve a CONTENT width that gives all boxes and
            # panel children the same right edge.
            #
            # A panel's natural width already includes 2 * INSET of padding.
            # Strip that padding to get its content width, take the max
            # across all siblings, then re-add padding for panels.
            #
            # When standalone boxes sit next to padded panels, their
            # explicit width was typically set to match the panel's OUTER
            # width.  Treat them the same way: strip 2*INSET so that the
            # content-width resolution uses the inner corridor.
            has_padded_sibling = any(
                isinstance(c, Panel) and c.effective_border not in (Border.NONE,)
                for c in components if not isinstance(c, Arrow)
            )
            content_widths: list[int] = []
            for comp, (nw, _) in zip(components, nat_sizes):
                if isinstance(comp, Panel):
                    if comp.effective_border == Border.NONE:
                        # Borderless panels (e.g. horizontal rows) follow
                        # the resolved width rather than driving it.
                        pass
                    else:
                        content_widths.append(int(nw) - 2 * INSET)
                elif isinstance(comp, Arrow):
                    pass  # arrows don't participate in width resolution
                else:
                    cw = int(nw)
                    if has_padded_sibling:
                        cw = cw - 2 * INSET
                    content_widths.append(cw)
            content_w_resolved = max(content_widths, default=BLOCK_WIDTH)
            content_w_resolved = round_up_to_grid(content_w_resolved)
            row_height_resolved = BOX_MIN_HEIGHT

        # Pass 2: render at resolved dimensions
        x = outer
        y = outer
        max_row_height = 0

        for comp, (nw, nh) in zip(components, nat_sizes):
            if diagram.arrangement == Diagram.Arrangement.HORIZONTAL:
                render_w = int(nw)
                render_h = row_height_resolved
                render_x = x
            else:
                # Panels: wrap content width with their own padding
                if isinstance(comp, Panel):
                    panel_pad = 0 if comp.effective_border == Border.NONE else INSET  # FILL keeps pad
                    render_w = content_w_resolved + 2 * panel_pad
                    render_x = x
                elif isinstance(comp, Arrow):
                    render_w = 0
                    render_x = x
                else:
                    # Standalone boxes: content width, inset to align
                    # with panel children
                    if has_padded_sibling:
                        render_w = content_w_resolved
                        render_x = x + INSET
                    else:
                        render_w = content_w_resolved
                        render_x = x
                render_h = int(nh)

            bounds, comp_fg, comp_bg = _render_component(
                comp, render_x, y, render_w, render_h,
                default_width=render_w,
                bounds_map=bounds_map,
                min_height=render_h,
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
    resolved_arrows = _resolve_arrows(arrows, bounds_map)
    arrow_prims = [arrow_prim for arrow_prim, _ in resolved_arrows]
    arrow_labels = {arrow_prim.component_id: label for arrow_prim, label in resolved_arrows if label is not None}
    for arrow_prim, label_prim in resolved_arrows:
        fg.append(arrow_prim)
        if label_prim is not None:
            fg.append(label_prim)

    # Compute canvas size from component bounds plus any free-positioned
    # arrow labels, which intentionally sit outside the box grid.
    max_x = max((b.x + b.width for b in all_bounds), default=0)
    max_y = max((b.y + b.height for b in all_bounds), default=0)
    for label_prim in arrow_labels.values():
        max_x = max(max_x, label_prim.x + label_prim.width)
        max_y = max(max_y, label_prim.y + label_prim.height)
    width = round_up_to_grid(int(max_x) + outer)
    height = round_up_to_grid(int(max_y) + outer)

    # Apply fixed canvas dimensions when set
    if diagram.canvas_width is not None:
        width = diagram.canvas_width
    if diagram.canvas_height is not None:
        height = diagram.canvas_height

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

    # Build component tree for interactive preview
    component_tree: list[ComponentInfo] = []
    for b in all_bounds:
        ci = _bounds_to_component_info(b)
        if ci:
            component_tree.append(ci)

    # Add arrows to component tree
    for ap in arrow_prims:
        if ap.component_id:
            pts = [ap.start] + ap.waypoints + [ap.end]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            label_prim = arrow_labels.get(ap.component_id)
            if label_prim is not None:
                xs.extend([label_prim.x, label_prim.x + label_prim.width])
                ys.extend([label_prim.y, label_prim.y + label_prim.height])
            component_tree.append(ComponentInfo(
                id=ap.component_id,
                type="arrow",
                x=min(xs), y=min(ys),
                width=max(xs) - min(xs),
                height=max(ys) - min(ys),
                source=ap.source_ref,
                target=ap.target_ref,
                waypoints=[[wp[0], wp[1]] for wp in ap.waypoints],
            ))

    return LayoutResult(width=width, height=height, background=bg,
                        foreground=fg, grid_info=grid_info,
                        component_tree=component_tree)


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
        elif isinstance(p, ArrowLabelPrimitive):
            # Arrow labels are intentionally free-positioned relative to the
            # arrow path. They should avoid overlap, not snap to the grid.
            pass
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


@dataclass
class ArrowCrossing:
    """An arrow that crosses through a component box it doesn't connect to."""
    arrow_id: str               # component_id of the arrow
    source_ref: str
    target_ref: str
    crossed_id: str             # component_id of the box being crossed
    segment_start: tuple[float, float]
    segment_end: tuple[float, float]


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


def validate_arrow_crossings(result: LayoutResult) -> list[ArrowCrossing]:
    """Check that no arrow passes through a component box it doesn't connect to.

    Collects all Rect primitives with a component_id as potential obstacles,
    then checks every arrow segment against every non-source/non-target box.
    Parent panels that contain both the source and target are excluded —
    arrows between children naturally pass through their shared ancestor.
    Returns a list of crossings.  An empty list means all arrows are clean.
    """
    crossings: list[ArrowCrossing] = []
    all_prims = list(result.background) + list(result.foreground)

    # Build parent map from component_tree: child_id -> set of ancestor ids
    ancestors: dict[str, set[str]] = {}

    def _walk(node: ComponentInfo, parent_chain: list[str]) -> None:
        ancestors[node.id] = set(parent_chain)
        for child in node.children:
            _walk(child, parent_chain + [node.id])

    for root in result.component_tree:
        _walk(root, [])

    # Collect component types from the tree so separator-like primitives can
    # be treated differently from box obstacles.
    component_types: dict[str, str] = {}

    def _collect_types(node: ComponentInfo) -> None:
        component_types[node.id] = node.type
        for child in node.children:
            _collect_types(child)

    for root in result.component_tree:
        _collect_types(root)

    # Collect all component boxes (Rect with a component_id)
    boxes: dict[str, tuple[float, float, float, float]] = {}
    for p in all_prims:
        if isinstance(p, Rect) and p.component_id:
            # Use the first Rect seen for each component_id (outer box)
            if p.component_id not in boxes:
                boxes[p.component_id] = (p.x, p.y, p.x + p.width, p.y + p.height)

    for p in all_prims:
        if not isinstance(p, ArrowPrimitive):
            continue

        src_comp = p.source_ref.split(".")[0] if p.source_ref else ""
        tgt_comp = p.target_ref.split(".")[0] if p.target_ref else ""
        # Exclude source, target, and any shared ancestor panels
        src_ancestors = ancestors.get(src_comp, set())
        tgt_ancestors = ancestors.get(tgt_comp, set())
        exclude = {src_comp, tgt_comp} | (src_ancestors & tgt_ancestors)

        pts = [p.start] + list(p.waypoints) + [p.end]
        if len(pts) < 2:
            continue

        for cid, box in boxes.items():
            if cid in exclude:
                continue
            if component_types.get(cid) == "Separator":
                continue
            for i in range(len(pts) - 1):
                if _seg_hits_obstacle(
                    pts[i][0], pts[i][1],
                    pts[i + 1][0], pts[i + 1][1],
                    [box],
                ):
                    crossings.append(ArrowCrossing(
                        arrow_id=p.component_id or "",
                        source_ref=p.source_ref,
                        target_ref=p.target_ref,
                        crossed_id=cid,
                        segment_start=pts[i],
                        segment_end=pts[i + 1],
                    ))
                    break  # one crossing per box per arrow is enough

    return crossings
