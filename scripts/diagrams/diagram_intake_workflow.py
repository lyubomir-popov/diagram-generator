"""Diagram intake workflow – vertical flow from rough sources to final SVGs.

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


diagram_intake_workflow = Diagram(
    title="Diagram intake workflow",
    arrangement=Diagram.Arrangement.VERTICAL,
    row_gap=24,  # arrows route vertically between rows
    outer_margin=24,
    components=[
        # ── Dashed header frame ──
        # Wrapper: outer width must match peer boxes (608).
        # Content span = 608 − 2×8 = 592.  Two cols + 8px gap → (592−8)/2 = 292.
        Panel(
            id="sources",
            cols=2,
            col_width=292,
            col_gap=8,
            row_gap=8,
            fill=Fill.WHITE,
            border=Border.DASHED,
            heading=_heading("Rough initial diagram sources"),
            children=[
                Box(
                    label=[_body("ChatGPT-generated"), _body("diagrams")],
                    icon="AI.svg",
                    fill=Fill.WHITE,
                    col=0, row=0,
                ),
                Box(
                    label=[
                        _body("? Additional rough"),
                        _body("source formats"),
                        _body("from PMs"),
                    ],
                    fill=Fill.GREY,
                    col=1, row=0,
                ),
            ],
        ),

        Arrow(source="sources.bottom", target="workflow.top"),

        # ── Sequential boxes ──
        Box(
            id="workflow",
            label=[
                _heading("Agentic workflow"),
                _body("in this repo"),
                _helper("playbook + generators"),
            ],
            icon="Screen with code.svg",
            fill=Fill.WHITE,
            width=608,
        ),

        Arrow(source="workflow.bottom", target="compare.top"),

        Box(
            id="compare",
            label=[
                _heading("Compare mode"),
                _helper("HTML before / agent / refined"),
            ],
            icon="Document with Magnifying glass.svg",
            fill=Fill.GREY,
            width=608,
        ),

        Arrow(source="compare.bottom", target="polish.top"),

        Box(
            id="polish",
            label=[
                _heading("Designer polish"),
                _helper("manual pass in generated draw.io"),
            ],
            icon="Design.svg",
            fill=Fill.WHITE,
            width=608,
        ),

        Arrow(source="polish.bottom", target="final.top"),

        Box(
            id="final",
            label=[
                _heading("Final SVGs"),
                _body("on-brand deliverables"),
            ],
            icon="Storage image.svg",
            style=BoxStyle.HIGHLIGHT,
            width=608,
        ),
    ],
)
