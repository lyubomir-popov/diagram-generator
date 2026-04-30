"""Example: platform architecture – grid layout with panels.

A generic cloud platform overview for demonstration purposes.
Shows nested panels, annotations, icon clusters, and multi-column grids.
"""

from __future__ import annotations

from diagram_model import (
    Arrow,
    Border,
    Box,
    Diagram,
    Fill,
    Line,
    Panel,
)

HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER)


example_platform_architecture = Diagram(
    title="Platform architecture",
    arrangement=Diagram.Arrangement.GRID,
    cols=3,
    col_width=192,
    row_height=64,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        # ── Row 0: User-facing layer ──
        Panel(
            id="frontend",
            cols=2,
            col_width=192,
            col_gap=8,
            row_gap=8,
            border=Border.DASHED,
            heading=_heading("User-facing services"),
            col=0, row=0, col_span=3,
            children=[
                Box(label=[_body("Web"), _body("application")],
                    icon="Laptop with window.svg", fill=Fill.WHITE, col=0, row=0),
                Box(label=[_body("Mobile"), _body("client")],
                    icon="Mobile.svg", fill=Fill.WHITE, col=1, row=0),
            ],
        ),

        # ── Row 1: API gateway ──
        Box(id="gateway", label=[_body("API"), _body("gateway")],
            fill=Fill.GREY, icon="Gateway.svg",
            col=0, row=1, col_span=3),

        # ── Row 2: Backend services ──
        Panel(
            id="services",
            cols=3,
            col_width=126,
            col_gap=8,
            row_gap=8,
            border=Border.DASHED,
            heading=_heading("Backend services"),
            col=0, row=2, col_span=3,
            children=[
                Box(label=[_body("Auth"), _body("service")],
                    icon="Lock.svg", fill=Fill.GREY, col=0, row=0),
                Box(label=[_body("Order"), _body("service")],
                    icon="Document.svg", fill=Fill.GREY, col=1, row=0),
                Box(label=[_body("Notification"), _body("service")],
                    icon="Letter.svg", fill=Fill.GREY, col=2, row=0),
            ],
        ),

        # ── Row 3: Data layer ──
        Box(id="database", label=[_body("Primary"), _body("database")],
            fill=Fill.GREY, icon="Storage node.svg",
            col=0, row=3),
        Box(id="cache", label=[_body("Cache"), _body("layer")],
            fill=Fill.GREY, icon="Memory.svg",
            col=1, row=3),
        Box(id="queue", label=[_body("Message"), _body("queue")],
            fill=Fill.GREY, icon="Operations.svg",
            col=2, row=3),

        # ── Arrows ──
        Arrow(source="frontend.bottom", target="gateway.top"),
        Arrow(source="gateway.bottom", target="services.top"),
        Arrow(source="services.bottom", target="database.top"),
        Arrow(source="services.bottom", target="cache.top"),
        Arrow(source="services.bottom", target="queue.top"),
    ],
)
