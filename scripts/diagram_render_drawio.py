"""Draw.io (mxfile) renderer for the declarative diagram system.

Consumes a ``LayoutResult`` from ``diagram_layout`` and emits draw.io XML.
Reuses the ``DrawioBuilder`` and style helpers from ``export_drawio_batch``
but operates on abstract positioned primitives.
"""

from __future__ import annotations

import pathlib

from diagram_layout import (
    ArrowPrimitive,
    CircleMarker,
    DashedLinePrimitive,
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
    BLACK,
    BODY_SIZE,
    GREY,
    ICON_SIZE,
    INSET,
    ORANGE,
    WHITE,
    box_text_width,
    fmt,
    load_icon,
    make_line,
    size_to_px,
    stack_required_height,
)
from export_drawio_batch import (
    DrawioBuilder,
    add_box,
    add_circle_marker,
    add_image,
    add_label,
    add_plain_rect,
    edge_style,
    icon_uri,
    image_style,
    label_style,
    memory_panel_uri,
    rect_style,
    rich_text,
    text_height,
)
import drawio_style_tokens as dg_tokens


# ---------------------------------------------------------------------------
# Primitive → draw.io mapping
# ---------------------------------------------------------------------------

def _find_children(
    prims: list[Primitive],
    parent: Rect,
) -> tuple[list[TextBlock], list[Icon]]:
    """Find TextBlocks and Icons visually inside *parent*."""
    texts: list[TextBlock] = []
    icons: list[Icon] = []
    px, py, pw, ph = parent.x, parent.y, parent.width, parent.height
    for p in prims:
        if isinstance(p, TextBlock):
            if px <= p.x <= px + pw and py <= p.y <= py + ph:
                texts.append(p)
        elif isinstance(p, Icon):
            if px <= p.x <= px + pw and py <= p.y <= py + ph:
                icons.append(p)
    return texts, icons


def _entry_exit(direction: str) -> dict[str, float]:
    """Return exit/entry anchor kwargs for an edge_style call."""
    if direction == "down":
        return dict(exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0)
    if direction == "up":
        return dict(exit_x=0.5, exit_y=0, entry_x=0.5, entry_y=1)
    if direction == "right":
        return dict(exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5)
    if direction == "left":
        return dict(exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5)
    return {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_drawio(
    result: LayoutResult,
    *,
    name: str = "Page-1",
    diagram_id: str = "declarative",
) -> DrawioBuilder:
    """Render a LayoutResult into a DrawioBuilder (draw.io XML tree).

    The caller can further modify the builder or write it directly.
    """
    builder = DrawioBuilder(
        name=name,
        diagram_id=diagram_id,
        page_width=result.width,
        page_height=result.height,
    )

    all_prims = list(result.background) + list(result.foreground)

    # Collect all rects first – we need to identify parent/child relationships
    rects = [(i, p) for i, p in enumerate(all_prims) if isinstance(p, Rect)]
    arrows = [p for p in all_prims if isinstance(p, ArrowPrimitive)]
    markers = [p for p in all_prims if isinstance(p, CircleMarker)]
    jagged = [p for p in all_prims if isinstance(p, JaggedRect)]
    terminals = [p for p in all_prims if isinstance(p, TerminalBar)]
    matrices = [p for p in all_prims if isinstance(p, MatrixTile)]
    clusters = [p for p in all_prims if isinstance(p, RequestClusterPrimitive)]

    # Standalone text blocks (not inside any rect) – collected after rect pass
    all_texts = [p for p in all_prims if isinstance(p, TextBlock)]
    all_icons = [p for p in all_prims if isinstance(p, Icon)]
    claimed_texts: set[int] = set()
    claimed_icons: set[int] = set()

    # Map rect index → draw.io cell id for parent lookups
    rect_ids: dict[int, str] = {}

    # Sort rects by area descending so panels come before boxes
    rects_sorted = sorted(rects, key=lambda r: r[1].width * r[1].height, reverse=True)

    # Build parent map: for each rect, find the smallest enclosing rect
    rect_parent: dict[int, int | None] = {}
    for idx, rect in rects:
        best_parent: int | None = None
        best_area = float("inf")
        for pidx, prect in rects:
            if pidx == idx:
                continue
            if (prect.x <= rect.x and prect.y <= rect.y
                    and prect.x + prect.width >= rect.x + rect.width
                    and prect.y + prect.height >= rect.y + rect.height):
                area = prect.width * prect.height
                if area < best_area:
                    best_area = area
                    best_parent = pidx
        rect_parent[idx] = best_parent

    # Emit rects in area-descending order (panels first)
    for idx, rect in rects_sorted:
        parent_idx = rect_parent[idx]
        parent_id = rect_ids.get(parent_idx, "1") if parent_idx is not None else "1"

        # Relative coordinates when parented
        if parent_idx is not None:
            parent_rect = next(r for i, r in rects if i == parent_idx)
            rx = rect.x - parent_rect.x
            ry = rect.y - parent_rect.y
        else:
            rx = rect.x
            ry = rect.y

        # Find text and icon children inside this rect
        texts, icons = [], []
        for ti, t in enumerate(all_texts):
            if ti in claimed_texts:
                continue
            if (rect.x <= t.x <= rect.x + rect.width
                    and rect.y <= t.y <= rect.y + rect.height):
                texts.append((ti, t))
        for ii, ic in enumerate(all_icons):
            if ii in claimed_icons:
                continue
            if (rect.x <= ic.x <= rect.x + rect.width
                    and rect.y <= ic.y <= rect.y + rect.height):
                icons.append((ii, ic))

        # Determine if this is a "box" (has text directly touching its inset)
        # vs a "panel frame" (larger container)
        has_direct_text = False
        direct_text: TextBlock | None = None
        direct_icon: Icon | None = None

        for ti, t in texts:
            if (abs(t.x - (rect.x + INSET)) < 1.5
                    and abs(t.y - (rect.y + INSET)) < 1.5):
                has_direct_text = True
                direct_text = t
                claimed_texts.add(ti)
                break

        for ii, ic in icons:
            if (abs(ic.x - (rect.x + rect.width - INSET - ICON_SIZE)) < 1.5
                    and abs(ic.y - (rect.y + INSET)) < 1.5):
                direct_icon = ic
                claimed_icons.add(ii)
                break

        if has_direct_text and direct_text is not None:
            # This is a box with label (and optional icon)
            cell_id = add_box(
                builder,
                x=rx, y=ry,
                width=rect.width,
                height=rect.height,
                fill=rect.fill,
                lines=direct_text.lines,
                icon_name=direct_icon.name if direct_icon else None,
                icon_fill=direct_icon.fill if direct_icon else None,
                parent=parent_id,
                connectable=True,
            )
        else:
            # Panel frame or plain rect
            cell_id = add_plain_rect(
                builder,
                x=rx, y=ry,
                width=rect.width,
                height=rect.height,
                fill=rect.fill,
                stroke=rect.stroke,
                dashed=rect.dashed,
                parent=parent_id,
                connectable=False,
            )

        rect_ids[idx] = cell_id

    # Emit unclaimed text blocks as free labels
    for ti, t in enumerate(all_texts):
        if ti in claimed_texts:
            continue
        # Find smallest enclosing rect for parent
        best_rect_idx: int | None = None
        best_area = float("inf")
        for idx, rect in rects:
            if (rect.x <= t.x <= rect.x + rect.width
                    and rect.y <= t.y <= rect.y + rect.height):
                area = rect.width * rect.height
                if area < best_area:
                    best_area = area
                    best_rect_idx = idx
        parent_id = rect_ids.get(best_rect_idx, "1") if best_rect_idx is not None else "1"
        if best_rect_idx is not None:
            parent_rect = next(r for i, r in rects if i == best_rect_idx)
            lx = t.x - parent_rect.x
            ly = t.y - parent_rect.y
        else:
            lx = t.x
            ly = t.y
        add_label(
            builder,
            x=lx, y=ly,
            width=300,
            lines=t.lines,
            parent=parent_id,
        )

    # Emit unclaimed icons as images
    for ii, ic in enumerate(all_icons):
        if ii in claimed_icons:
            continue
        best_rect_idx = None
        best_area = float("inf")
        for idx, rect in rects:
            if (rect.x <= ic.x <= rect.x + rect.width
                    and rect.y <= ic.y <= rect.y + rect.height):
                area = rect.width * rect.height
                if area < best_area:
                    best_area = area
                    best_rect_idx = idx
        parent_id = rect_ids.get(best_rect_idx, "1") if best_rect_idx is not None else "1"
        if best_rect_idx is not None:
            parent_rect = next(r for i, r in rects if i == best_rect_idx)
            ix = ic.x - parent_rect.x
            iy = ic.y - parent_rect.y
        else:
            ix = ic.x
            iy = ic.y
        add_image(
            builder,
            x=ix, y=iy,
            width=ICON_SIZE, height=ICON_SIZE,
            image_uri=icon_uri(ic.name, ic.fill),
            parent=parent_id,
        )

    # Emit arrows
    for arrow in arrows:
        anchors = _entry_exit(arrow.direction)
        builder.add_edge(
            style=edge_style(arrow.color, **anchors),
            source_point=arrow.start,
            target_point=arrow.end,
            waypoints=arrow.waypoints if arrow.waypoints else None,
        )

    # Emit circle markers (legend)
    for marker in markers:
        add_circle_marker(
            builder,
            cx=marker.cx, cy=marker.cy,
            radius=marker.radius,
            fill=marker.fill,
        )

    # Emit jagged rects (memory wall)
    for j in jagged:
        add_image(
            builder,
            x=j.x, y=j.y,
            width=j.width, height=j.height,
            image_uri=memory_panel_uri(),
            style_tokens=("memory-wall",),
        )

    # Emit dashed separator lines
    dashed_lines = [p for p in all_prims if isinstance(p, DashedLinePrimitive)]
    for dl in dashed_lines:
        w = abs(dl.x2 - dl.x1)
        add_plain_rect(
            builder,
            x=min(dl.x1, dl.x2), y=dl.y1 - 1,
            width=w, height=2,
            fill="none",
            stroke="#000000",
            dashed=True,
            style_tokens=("dashed-separator",),
        )

    # Emit terminal bars
    for term in terminals:
        term_id = add_plain_rect(
            builder,
            x=term.x, y=term.y,
            width=term.width, height=term.height,
            fill=GREY,
            style_tokens=("terminal-bar",),
        )
        add_label(
            builder,
            x=INSET, y=20,
            width=term.width - INSET * 2,
            lines=[make_line(term.command)],
            parent=term_id,
            font_family=term.font_family or "Ubuntu Sans Mono",
        )

    # Emit matrix tiles
    for mt in matrices:
        add_label(
            builder,
            x=mt.x, y=mt.y,
            width=48, height=48,
            lines=[make_line(mt.label, size="12", weight="700")],
            align="center",
            vertical_align="middle",
        )

    return builder


def write_drawio(
    path: pathlib.Path,
    result: LayoutResult,
    *,
    name: str = "Page-1",
    diagram_id: str = "declarative",
) -> None:
    """Render and write a draw.io file."""
    builder = render_drawio(result, name=name, diagram_id=diagram_id)
    builder.write(path)
