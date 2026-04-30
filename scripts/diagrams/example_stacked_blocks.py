"""Example: infrastructure overview – standard box layout.

Demonstrates Box and Panel components in a 3-column grid with a
dashed wrapper panel spanning all columns.
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


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


example_stacked_blocks = Diagram(
    title="Infrastructure overview",
    arrangement=Diagram.Arrangement.GRID,
    cols=3,
    col_width=192,
    row_height=64,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        # Row 0: three standard boxes
        Box(
            label=[_body("Cloud")],
            icon="Cloud.svg",
            fill=Fill.WHITE,
            id="cloud",
            col=0, row=0,
        ),
        Box(
            label=[_body("Container")],
            icon="Container.svg",
            fill=Fill.WHITE,
            id="container",
            col=1, row=0,
        ),
        Box(
            label=[_body("Server")],
            icon="Server.svg",
            fill=Fill.WHITE,
            id="server",
            col=2, row=0,
        ),

        # Row 1: dashed wrapper panel spanning all 3 columns
        Panel(
            id="services",
            cols=3,
            col_gap=24,
            row_gap=8,
            border=Border.DASHED,
            heading=_heading("Managed services"),
            col=0, row=1, col_span=3,
            children=[
                Box(
                    label=[_body("Database")],
                    icon="Storage node.svg",
                    fill=Fill.GREY,
                    col=0, row=0,
                ),
                Box(
                    label=[_body("Storage")],
                    icon="Storage object.svg",
                    fill=Fill.GREY,
                    col=1, row=0,
                ),
                Box(
                    label=[_body("Network")],
                    icon="Network.svg",
                    fill=Fill.GREY,
                    col=2, row=0,
                ),
            ],
        ),

        # Row 2: standard boxes
        Box(
            label=[_body("Lock"), _body("manager")],
            icon="Lock.svg",
            fill=Fill.WHITE,
            id="lockman",
            col=0, row=2,
        ),
        Box(
            label=[_body("Monitoring"), _body("dashboard")],
            icon="Memory.svg",
            fill=Fill.GREY,
            id="monitor",
            col=1, row=2, col_span=2,
        ),

        # Arrows
        Arrow(source="cloud", target="services"),
        Arrow(source="container", target="services"),
        Arrow(source="server", target="services"),
        Arrow(source="services", target="lockman"),
        Arrow(source="services", target="monitor"),
    ],
)
