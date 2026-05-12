"""Lightning talk – Ubuntu Summit identity generator pipeline.

Shows the identity tool: 3 guidelines feed from the left, 1 input
from the top, through a 3-stage engine, producing static and animated outputs.

Grid: 3 cols × 3 rows.
  Row 0: "2. Input" panel (cols 1–2)
  Row 1: "1. Guidelines" panel (col 0) + "3. Engine" panel (cols 1–2)
  Row 2: "4. Export" panel (cols 1–2) with PNG and MP4 boxes
"""

from __future__ import annotations

from diagram_model import (
    Arrow,
    Border,
    Box,
    BoxStyle,
    Diagram,
    Fill,
    Line,
    Panel,
)
from diagram_shared import HELPER as HELPER_COLOR


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


lt_summit_identity = Diagram(
    title="Summit identity generator",
    arrangement=Diagram.Arrangement.GRID,
    cols=3,
    col_width=192,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        # ── Row 0: "2. Input" panel ──
        Panel(
            id="input_panel",
            cols=2,
            col_gap=8,
            row_gap=8,
            fill=Fill.GREY,
            border=Border.FILL,
            heading=_heading("2. Input"),
            col=1, row=0, col_span=2,
            children=[
                Box(
                    id="brief",
                    label=[_body("Marketing"), _body("brief")],
                    icon="Marketing.svg",
                    col=0, row=0,
                ),
                Box(
                    id="formats",
                    label=[_body("Format"), _body("requirements")],
                    icon="Documents.svg",
                    col=1, row=0,
                ),
            ],
        ),

        # ── Row 1: "1. Guidelines" panel ──
        Panel(
            id="guidelines",
            cols=1,
            row_gap=8,
            fill=Fill.GREY,
            border=Border.FILL,
            heading=_heading("1. Guidelines"),
            col=0, row=1,
            children=[
                Box(
                    id="typo",
                    label=[_body("Typography")],
                    icon="Document.svg",
                    col=0, row=0,
                ),
                Box(
                    id="spacing_guide",
                    label=[_body("Spacing")],
                    icon="Document.svg",
                    col=0, row=1,
                ),
                Box(
                    id="layout_guide",
                    label=[_body("Layout")],
                    icon="Document.svg",
                    col=0, row=2,
                ),
            ],
        ),

        # ── Row 1: "3. Engine" panel ──
        Panel(
            id="engine",
            cols=1,
            row_gap=8,
            fill=Fill.GREY,
            border=Border.FILL,
            heading=_heading("3. Engine"),
            col=1, row=1, col_span=2,
            children=[
                Box(
                    id="layout_engine",
                    label=[_body("Layout engine")],
                    icon="Composable.svg",
                    col=0, row=0,
                ),
                Box(
                    id="anim_system",
                    label=[_body("Animation"), _body("system")],
                    icon="Video.svg",
                    col=0, row=1,
                ),
                Box(
                    id="editor_box",
                    label=[_body("Constrained"), _body("editor")],
                    icon="Screen with code.svg",
                    col=0, row=2,
                ),
            ],
        ),

        # ── Row 2: "4. Export" panel ──
        Panel(
            id="export_panel",
            cols=3,
            col_gap=8,
            row_gap=8,
            fill=Fill.GREY,
            border=Border.FILL,
            heading=_heading("4. Export"),
            col=1, row=2, col_span=2,
            children=[
                Box(
                    id="output_png",
                    label=[_body("PNG")],
                    style=BoxStyle.HIGHLIGHT,
                    icon="Photography.svg",
                    col=0, row=0,
                ),
                Box(
                    id="output_mp4",
                    label=[_body("MP4")],
                    style=BoxStyle.HIGHLIGHT,
                    icon="Video.svg",
                    col=1, row=0,
                ),
                Box(
                    id="output_drawio",
                    label=[_body("Draw.io native")],
                    style=BoxStyle.HIGHLIGHT,
                    icon="Design.svg",
                    col=2, row=0,
                ),
            ],
        ),

        # ── Arrows ──
        Arrow(source="input_panel.bottom", target="engine.top"),
        Arrow(source="guidelines.right", target="engine.left"),
        Arrow(source="engine.bottom", target="export_panel.top"),
    ],
)
