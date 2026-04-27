"""SVG renderer for the declarative diagram system.

Consumes a ``LayoutResult`` from ``diagram_layout`` and emits an SVG string.
Reuses the proven SVG-generation patterns from ``generate_remaining_diagrams``
but operates on abstract positioned primitives rather than per-diagram
imperative code.
"""

from __future__ import annotations

import html as html_mod
import pathlib

from diagram_layout import (
    ArrowPrimitive,
    CircleMarker,
    DashedLinePrimitive,
    GridInfo,
    Icon,
    JaggedRect,
    LayoutResult,
    MatrixTile,
    Primitive,
    Rect,
    RequestClusterPrimitive,
    TerminalBar,
    TextBlock,
)
from diagram_shared import (
    ARROW_HEAD_HALF_WIDTH,
    ARROW_HEAD_LENGTH,
    BASELINE_UNIT,
    BLACK,
    BODY_SIZE,
    GREY,
    ICON_SIZE,
    INSET,
    MATRIX_COLUMN_DIVIDERS,
    MATRIX_HEADER_HEIGHT,
    MATRIX_LABEL_SIZE,
    MATRIX_ROW_DIVIDERS,
    MATRIX_SIZE,
    ORANGE,
    TERMINAL_CHROME_HEIGHT,
    TERMINAL_DOT_RADIUS,
    TERMINAL_FONT_FAMILY,
    WHITE,
    centered_band_text_top,
    fmt,
    line_top_to_baseline,
    load_icon,
)


# ---------------------------------------------------------------------------
# SVG element emitters (thin wrappers)
# ---------------------------------------------------------------------------

def _svg_open(width: int, height: int) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" xml:space="preserve">',
        f'  <rect width="{width}" height="{height}" fill="{WHITE}" />',
    ]


def _rect(x, y, w, h, *, fill=WHITE, stroke=BLACK, dashed=False) -> str:
    dash = ' stroke-dasharray="8 8"' if dashed else ""
    return (
        f'  <rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-miterlimit="10"{dash} />'
    )


def _line(x1, y1, x2, y2, *, stroke=BLACK) -> str:
    return (
        f'  <line x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" '
        f'fill="none" stroke="{stroke}" stroke-width="1" stroke-miterlimit="10" />'
    )


def _polygon(points, fill=BLACK) -> str:
    pts = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in points)
    return f'  <polygon points="{pts}" fill="{fill}" />'


def _circle(cx, cy, r, *, fill, stroke=BLACK) -> str:
    return (
        f'  <circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="1" stroke-miterlimit="10" />'
    )


def _text_block(x, y, lines) -> str:
    if not lines:
        return ""
    parts = ['  <text font-family="Ubuntu Sans">']
    top = y
    for spec in lines:
        content = html_mod.escape(str(spec["content"]))
        size = str(spec["size"])
        weight = str(spec["weight"])
        fill = str(spec["fill"])
        sc = bool(spec.get("small_caps", False))
        sc_attr = ' font-variant-caps="all-small-caps" letter-spacing="0.05em"' if sc else ""
        ff = spec.get("font_family")
        ff_attr = f' font-family="{ff}"' if ff else ""
        parts.append(
            f'    <tspan x="{fmt(x)}" y="{fmt(line_top_to_baseline(top, size))}" '
            f'font-size="{size}" font-weight="{weight}" fill="{fill}"{sc_attr}{ff_attr}>'
            f'{content}</tspan>'
        )
        top += int(spec["line_step"])
    parts.append("  </text>")
    return "\n".join(parts)


def _icon_group(x, y, name, fill=BLACK) -> str:
    return f'  <g transform="translate({fmt(x)} {fmt(y)})">\n{load_icon(name, fill)}\n  </g>'


def _polyline_arrow(points, color=ORANGE) -> str:
    if len(points) < 2:
        return ""
    shaft = list(points)
    tx, ty = shaft[-1]
    px, py = shaft[-2]
    dx, dy = tx - px, ty - py
    if dx == 0:
        d = 1 if dy > 0 else -1
        bp = (tx, ty - d * ARROW_HEAD_LENGTH)
        head = [(tx - ARROW_HEAD_HALF_WIDTH, bp[1]), (tx, ty), (tx + ARROW_HEAD_HALF_WIDTH, bp[1])]
    elif dy == 0:
        d = 1 if dx > 0 else -1
        bp = (tx - d * ARROW_HEAD_LENGTH, ty)
        head = [(bp[0], ty - ARROW_HEAD_HALF_WIDTH), (tx, ty), (bp[0], ty + ARROW_HEAD_HALF_WIDTH)]
    else:
        bp = (tx, ty)
        head = [(tx, ty)]
    shaft[-1] = bp
    parts = []
    for i in range(len(shaft) - 1):
        parts.append(_line(shaft[i][0], shaft[i][1], shaft[i + 1][0], shaft[i + 1][1], stroke=color))
    parts.append(_polygon(head, fill=color))
    return "\n".join(parts)


def _jagged_box(x, y, w, h, fill=GREY) -> str:
    step, half = 8, 4
    pts: list[tuple[float, float]] = []
    for i in range(int(w // step) + 1):
        px = min(x + i * step, x + w)
        pts.append((px, y if i % 2 == 0 else y - half))
    pts.append((x + w, y + h))
    for i in range(int(w // step), -1, -1):
        px = min(x + i * step, x + w)
        pts.append((px, y + h if i % 2 == 0 else y + h + half))
    d = [f"M {fmt(pts[0][0])} {fmt(pts[0][1])}"]
    for px, py in pts[1:]:
        d.append(f"L {fmt(px)} {fmt(py)}")
    d.append("Z")
    return (
        f'  <path d="{" ".join(d)}" fill="{fill}" stroke="{BLACK}" '
        'stroke-width="1" stroke-miterlimit="10" />'
    )


def _matrix_group(x, y, label) -> str:
    lt = y + centered_band_text_top(MATRIX_HEADER_HEIGHT, MATRIX_LABEL_SIZE)
    parts = [
        _rect(x, y, MATRIX_SIZE, MATRIX_SIZE, fill=GREY),
        _line(x, y + MATRIX_HEADER_HEIGHT, x + MATRIX_SIZE, y + MATRIX_HEADER_HEIGHT),
    ]
    for dx in MATRIX_COLUMN_DIVIDERS:
        parts.append(_line(x + dx, y + MATRIX_HEADER_HEIGHT, x + dx, y + MATRIX_SIZE))
    for dy in MATRIX_ROW_DIVIDERS:
        parts.append(_line(x, y + dy, x + MATRIX_SIZE, y + dy))
    parts.append(
        f'  <text x="{fmt(x + MATRIX_SIZE / 2)}" y="{fmt(line_top_to_baseline(lt, MATRIX_LABEL_SIZE))}" '
        f'text-anchor="middle" font-family="Ubuntu Sans" font-size="{MATRIX_LABEL_SIZE}" '
        f'font-weight="700" fill="{BLACK}">{html_mod.escape(label)}</text>'
    )
    return "\n".join(parts)


def _command_bar(x, y, w, h, command, font_family=None) -> str:
    ff = font_family or TERMINAL_FONT_FAMILY
    parts = [_rect(x, y, w, h, fill=GREY)]
    parts.append(_line(x, y + TERMINAL_CHROME_HEIGHT, x + w, y + TERMINAL_CHROME_HEIGHT))
    for cx in (20, 36, 52):
        parts.append(_circle(x + cx, y + TERMINAL_CHROME_HEIGHT / 2, TERMINAL_DOT_RADIUS, fill=WHITE))
    parts.append(
        f'  <text x="{fmt(x + INSET)}" y="{fmt(line_top_to_baseline(y + TERMINAL_CHROME_HEIGHT + INSET, BODY_SIZE))}" '
        f'font-family="{ff}" font-size="{BODY_SIZE}" font-weight="400" fill="{BLACK}">'
        f'{html_mod.escape(command)}</text>'
    )
    return "\n".join(parts)


def _request_cluster(x, y) -> str:
    return "\n".join([
        _icon_group(x, y, "Document.svg"),
        _icon_group(x + 56, y, "Photography.svg"),
        _icon_group(x + 112, y, "Globe.svg"),
    ])


# ---------------------------------------------------------------------------
# Primitive dispatcher
# ---------------------------------------------------------------------------

def _render_primitive(prim: Primitive) -> str:
    if isinstance(prim, Rect):
        return _rect(prim.x, prim.y, prim.width, prim.height,
                     fill=prim.fill, stroke=prim.stroke, dashed=prim.dashed)
    if isinstance(prim, TextBlock):
        return _text_block(prim.x, prim.y, prim.lines)
    if isinstance(prim, Icon):
        return _icon_group(prim.x, prim.y, prim.name, prim.fill)
    if isinstance(prim, ArrowPrimitive):
        pts = [prim.start] + prim.waypoints + [prim.end]
        return _polyline_arrow(pts, color=prim.color)
    if isinstance(prim, CircleMarker):
        return _circle(prim.cx, prim.cy, prim.radius, fill=prim.fill,
                       stroke=prim.stroke)
    if isinstance(prim, JaggedRect):
        return _jagged_box(prim.x, prim.y, prim.width, prim.height, prim.fill)
    if isinstance(prim, TerminalBar):
        return _command_bar(prim.x, prim.y, prim.width, prim.height,
                           prim.command, prim.font_family)
    if isinstance(prim, MatrixTile):
        return _matrix_group(prim.x, prim.y, prim.label)
    if isinstance(prim, RequestClusterPrimitive):
        return _request_cluster(prim.x, prim.y)
    if isinstance(prim, DashedLinePrimitive):
        return (
            f'  <line x1="{prim.x1}" y1="{prim.y1}" x2="{prim.x2}" y2="{prim.y2}"'
            f' fill="none" stroke="#000000" stroke-width="1"'
            f' stroke-miterlimit="10" stroke-dasharray="{prim.dash}" />'
        )
    return ""


def _grid_overlay(width: int, height: int, step: int = INSET) -> list[str]:
    """Emit faint grid lines at every *step* px."""
    parts = ['  <g id="baseline-grid" opacity="0.25">']
    for x in range(0, width + 1, step):
        parts.append(f'    <line x1="{x}" y1="0" x2="{x}" y2="{height}" '
                     f'stroke="#FF0000" stroke-width="0.5" />')
    for y in range(0, height + 1, step):
        parts.append(f'    <line x1="0" y1="{y}" x2="{width}" y2="{y}" '
                     f'stroke="#FF0000" stroke-width="0.5" />')
    parts.append('  </g>')
    return parts


def _layout_grid_overlay(gi: GridInfo, width: int, height: int) -> list[str]:
    """Emit the Müller-Brockmann layout grid: columns, rows, gaps, margins.

    Draws:
    - Blue column bands (semi-transparent fills for cells)
    - Blue row bands
    - Purple gap regions between cells
    - Dashed margin boundary
    - Column/row dimension labels
    """
    parts = ['  <g id="layout-grid" opacity="0.35">']

    # Margin boundary (dashed)
    m = gi.outer_margin
    parts.append(
        f'    <rect x="{m}" y="{m}" '
        f'width="{width - 2 * m}" height="{height - 2 * m}" '
        f'fill="none" stroke="#0066CC" stroke-width="1" '
        f'stroke-dasharray="6 4" />'
    )

    # Column fills and labels
    for i, (cx, cw) in enumerate(zip(gi.col_xs, gi.col_widths)):
        # Column cell band (full height, light blue)
        parts.append(
            f'    <rect x="{cx}" y="{m}" '
            f'width="{cw}" height="{height - 2 * m}" '
            f'fill="#3399FF" opacity="0.08" />'
        )
        # Column left/right edges
        parts.append(
            f'    <line x1="{cx}" y1="{m}" x2="{cx}" y2="{height - m}" '
            f'stroke="#0066CC" stroke-width="0.75" />'
        )
        parts.append(
            f'    <line x1="{cx + cw}" y1="{m}" x2="{cx + cw}" y2="{height - m}" '
            f'stroke="#0066CC" stroke-width="0.75" />'
        )
        # Column width label at top
        parts.append(
            f'    <text x="{cx + cw / 2}" y="{m - 4}" '
            f'text-anchor="middle" font-size="9" fill="#0066CC" '
            f'font-family="Ubuntu Sans, sans-serif">{cw}px</text>'
        )

    # Column gap fills (purple tint between columns)
    for i in range(len(gi.col_xs) - 1):
        gap_x = gi.col_xs[i] + gi.col_widths[i]
        gap_w = gi.col_xs[i + 1] - gap_x
        if gap_w > 0:
            parts.append(
                f'    <rect x="{gap_x}" y="{m}" '
                f'width="{gap_w}" height="{height - 2 * m}" '
                f'fill="#9933FF" opacity="0.06" />'
            )
            # Gap label
            parts.append(
                f'    <text x="{gap_x + gap_w / 2}" y="{m - 4}" '
                f'text-anchor="middle" font-size="7" fill="#9933FF" '
                f'font-family="Ubuntu Sans, sans-serif">{int(gap_w)}</text>'
            )

    # Row fills and labels
    for i, (ry, rh) in enumerate(zip(gi.row_ys, gi.row_heights)):
        # Row cell band (full width, light blue)
        parts.append(
            f'    <rect x="{m}" y="{ry}" '
            f'width="{width - 2 * m}" height="{rh}" '
            f'fill="#3399FF" opacity="0.08" />'
        )
        # Row top/bottom edges
        parts.append(
            f'    <line x1="{m}" y1="{ry}" x2="{width - m}" y2="{ry}" '
            f'stroke="#0066CC" stroke-width="0.75" />'
        )
        parts.append(
            f'    <line x1="{m}" y1="{ry + rh}" x2="{width - m}" y2="{ry + rh}" '
            f'stroke="#0066CC" stroke-width="0.75" />'
        )
        # Row height label on right edge
        parts.append(
            f'    <text x="{width - m + 4}" y="{ry + rh / 2 + 3}" '
            f'font-size="9" fill="#0066CC" '
            f'font-family="Ubuntu Sans, sans-serif">{rh}px</text>'
        )

    # Row gap fills (purple tint between rows)
    for i in range(len(gi.row_ys) - 1):
        gap_y = gi.row_ys[i] + gi.row_heights[i]
        gap_h = gi.row_ys[i + 1] - gap_y
        if gap_h > 0:
            parts.append(
                f'    <rect x="{m}" y="{gap_y}" '
                f'width="{width - 2 * m}" height="{gap_h}" '
                f'fill="#9933FF" opacity="0.06" />'
            )
            # Gap label
            parts.append(
                f'    <text x="{width - m + 4}" y="{gap_y + gap_h / 2 + 3}" '
                f'font-size="7" fill="#9933FF" '
                f'font-family="Ubuntu Sans, sans-serif">{int(gap_h)}</text>'
            )

    parts.append('  </g>')
    return parts


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_svg(result: LayoutResult, *, show_grid: bool = False,
               show_layout_grid: bool = False) -> str:
    """Render a LayoutResult to a complete SVG string.

    When *show_grid* is True, a faint 4px baseline grid overlay is drawn
    on top of the diagram (red lines at 8px rhythm, cyan at 4px steps).
    When *show_layout_grid* is True, the Müller-Brockmann layout grid
    (column/row boundaries, gap regions, dimension labels) is drawn.
    """
    parts = _svg_open(result.width, result.height)
    for prim in result.background:
        s = _render_primitive(prim)
        if s:
            parts.append(s)
    for prim in result.foreground:
        s = _render_primitive(prim)
        if s:
            parts.append(s)
    if show_layout_grid and result.grid_info:
        parts.extend(_layout_grid_overlay(
            result.grid_info, result.width, result.height))
    if show_grid:
        parts.extend(_grid_overlay(result.width, result.height))
    parts.append("</svg>")
    parts.append("")
    return "\n".join(parts)


def write_svg(
    path: pathlib.Path,
    result: LayoutResult,
    *,
    show_grid: bool = False,
    show_layout_grid: bool = False,
) -> None:
    """Render and write an SVG file."""
    path.write_text(render_svg(result, show_grid=show_grid,
                               show_layout_grid=show_layout_grid),
                    encoding="utf-8")
