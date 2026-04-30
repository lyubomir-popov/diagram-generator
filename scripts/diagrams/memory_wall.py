"""Memory wall diagram – vertical inference stack with jagged memory wall.

Declarative definition using the diagram model.

Grid layout: 2 columns, 8 rows.
  col 0: main vertical box stack (192px wide)
  col 1: side annotations (request cluster, helper text)
  Rows step through the stack layers with arrows between.
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Border,
    Box,
    Diagram,
    Fill,
    IconCluster,
    JaggedPanel,
    Line,
    Separator,
)
from diagram_shared import HELPER as HELPER_COLOR


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER_COLOR)


memory_wall = Diagram(
    title="Memory wall",
    arrangement=Diagram.Arrangement.GRID,
    cols=2,
    col_width=192,
    row_height=64,
    col_gap=24,  # arrow routes horizontally between columns
    row_gap=24,  # arrows route vertically between rows
    outer_margin=24,
    components=[
        # ── Row 0: User request + request cluster ──
        Box(id="user", label=[_body("User request")], width=192,
            col=0, row=0),
        IconCluster(id="requests",
            icons=["Document.svg", "Photography.svg", "Globe.svg"],
            col=1, row=0),

        # ── Row 1: App & model framework ──
        Box(
            id="app",
            label=[_body("App & model"), _body("framework")],
            fill=Fill.GREY,
            icon="Package.svg",
            width=192, height=64,
            col=0, row=1,
        ),

        # ── Row 2: Dashed separator ──
        Separator(col=0, row=2),

        # ── Row 3: Missing layer + side annotation ──
        Box(id="missing", label=[_body("Missing layer")], width=192, height=64,
            col=0, row=3),
        Annotation(
            id="missing_note",
            lines=[_helper("No model-aware"), _helper("orchestration!")],
            col=1, row=3,
        ),

        # ── Row 4: OS ──
        Box(
            id="os",
            label=[_body("Operating"), _body("system")],
            fill=Fill.GREY,
            icon="Server.svg",
            width=192,
            col=0, row=4,
        ),

        # ── Row 5: Hardware ──
        Box(
            id="hw",
            label=[_body("Hardware")],
            fill=Fill.GREY,
            icon="Chip 1.svg",
            width=192,
            col=0, row=5,
        ),

        # ── Row 6: Silicon ──
        Box(
            id="si",
            label=[_body("Silicon")],
            fill=Fill.GREY,
            icon="Chip 2.svg",
            width=192,
            col=0, row=6,
        ),

        # ── Row 7: Memory wall ──
        JaggedPanel(
            id="wall",
            label=[_body("Memory wall")],
            width=192,
            height=64,
            col=0, row=7,
        ),

        # ── Arrows: vertical chain ──
        Arrow(source="user.bottom", target="app.top"),
        Arrow(source="app.bottom", target="missing.top"),
        Arrow(source="missing.bottom", target="os.top"),
        Arrow(source="os.bottom", target="hw.top"),
        Arrow(source="hw.bottom", target="si.top"),
        Arrow(source="si.bottom", target="wall.top"),

        # Horizontal arrow from annotation to missing layer
        Arrow(source="missing_note.left", target="missing.right", color="#000000"),
    ],
)
