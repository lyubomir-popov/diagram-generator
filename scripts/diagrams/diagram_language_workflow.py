"""Diagram language workflow – from inputs through skill chain to outputs.

Declarative definition using the diagram model.
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

WHITE = "#FFFFFF"
HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str, fill: str = "#000000") -> Line:
    return Line(text, weight="700", fill=fill)


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER)


diagram_language_workflow = Diagram(
    title="Diagram language workflow",
    arrangement=Diagram.Arrangement.VERTICAL,
    row_gap=32,  # arrows route vertically between rows
    outer_margin=32,
    components=[
        # ── Dashed input frame ──
        Panel(
            id="inputs",
            cols=3,
            col_width=192,
            col_gap=8,
            row_gap=8,
            fill=Fill.WHITE,
            border=Border.DASHED,
            heading=_heading("Inputs and canonical context"),
            children=[
                Box(
                    label=[_body("Rough source"), _body("diagram")],
                    icon="Document.svg",
                    fill=Fill.WHITE,
                    col=0, row=0,
                ),
                Box(
                    label=[_body("Local refs"), _body("+ outputs")],
                    icon="Document with Magnifying glass.svg",
                    fill=Fill.GREY,
                    col=1, row=0,
                ),
                Box(
                    label=[
                        _heading("DIAGRAM.md"),
                        _body("canonical spec"),
                    ],
                    icon="Book with Magnifying glass.svg",
                    style=BoxStyle.HIGHLIGHT,
                    col=2, row=0,
                ),
            ],
        ),

        Arrow(source="inputs.bottom", target="redraw.top"),

        # ── Sequential skill chain ──
        Box(
            id="redraw",
            label=[
                _heading("Diagram redraw"),
                _body("skill"),
            ],
            icon="Wrench 1.svg",
            style=BoxStyle.HIGHLIGHT,
            width=608,
        ),

        Arrow(source="redraw.bottom", target="generators.top"),

        Box(
            id="generators",
            label=[
                _heading("Repo generators"),
                _helper("shared tokens + library"),
            ],
            icon="Screen with code.svg",
            fill=Fill.WHITE,
            width=608,
        ),

        Arrow(source="generators.bottom", target="validate.top"),

        Box(
            id="validate",
            label=[
                _heading("Build + validate"),
                _body("skill"),
            ],
            icon="Rosette with check.svg",
            style=BoxStyle.HIGHLIGHT,
            width=608,
        ),

        Arrow(source="validate.bottom", target="review.top"),

        Box(
            id="review",
            label=[
                _heading("Compare + review lane"),
                _helper("before / agent / refined"),
            ],
            icon="Document with Magnifying glass.svg",
            fill=Fill.GREY,
            width=608,
        ),

        Arrow(source="review.bottom", target="drawio.top"),

        Box(
            id="drawio",
            label=[
                _heading("Protected draw.io"),
                _body("review skill"),
            ],
            icon="Design.svg",
            style=BoxStyle.HIGHLIGHT,
            width=608,
        ),

        Arrow(source="drawio.bottom", target="outputs.top"),

        Box(
            id="outputs",
            label=[
                _heading("Editable draw.io +"),
                _body("SVG outputs"),
                _helper("ready for token ingest"),
            ],
            icon="Storage image.svg",
            fill=Fill.WHITE,
            width=608,
        ),
    ],
)
