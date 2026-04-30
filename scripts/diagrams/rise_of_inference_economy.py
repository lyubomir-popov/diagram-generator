"""Rise of the inference economy – two-column comparison layout.

Declarative definition using the diagram model.
"""

from __future__ import annotations

from diagram_model import (
    Arrow,
    Box,
    BoxStyle,
    Diagram,
    Fill,
    Line,
    Panel,
)


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _white_text(text: str, **kw) -> Line:
    return Line(text, weight="700", fill="#FFFFFF", **kw)


rise_of_inference_economy = Diagram(
    title="Rise of the inference economy",
    arrangement=Diagram.Arrangement.GRID,
    cols=2,
    col_gap=24,
    row_gap=24,  # arrows route vertically between rows
    outer_margin=24,
    components=[
        # ── Row 0: full-width title ──
        Box(
            id="title",
            label=[_heading("The rise of the inference economy")],
            icon="Cloud.svg",
            width=848,
            col=0, row=0, col_span=2,
        ),

        # ── Row 1: Training vs Inference headers ──
        Box(
            id="training_hdr",
            label=[_heading("Training")],
            fill=Fill.GREY,
            icon="AI.svg",
            width=408,
            col=0, row=1,
        ),
        Box(
            id="inference_hdr",
            label=[_white_text("Inference")],
            style=BoxStyle.HIGHLIGHT,
            icon="CPU.svg",
            width=408,
            col=1, row=1,
        ),

        # Arrows from headers to detail boxes
        Arrow(source="training_hdr.bottom", target="training_detail.top"),
        Arrow(source="inference_hdr.bottom", target="inference_detail.top"),

        # ── Row 2: detail boxes ──
        Box(
            id="training_detail",
            label=[_body("Costly & episodic"), _body("High investment")],
            icon="Finance.svg",
            width=408,
            col=0, row=2,
        ),
        Box(
            id="inference_detail",
            label=[_body("Constant & demand-driven"), _body("Ongoing expense")],
            icon="Server.svg",
            width=408,
            col=1, row=2,
        ),

        # Horizontal arrow from training to inference
        Arrow(source="training_detail.right", target="inference_detail.left"),

        # ── Row 3: sub-panels ──
        Panel(
            id="compute",
            heading=_heading("Always-on compute"),
            icon="Globe.svg",
            cols=2,
            rows=2,
            col_gap=24,
            fill=Fill.GREY,
            col=0, row=3,
            children=[
                Box(label=[_body("Data centers")], icon="Server.svg", col=0, row=0),
                Box(label=[_body("Edge devices")], icon="Mobile.svg", col=1, row=0),
                Box(label=[_body("Local AI")], icon="AI.svg", col=0, row=1, width=408),
            ],
        ),
        Panel(
            id="revenue",
            heading=_heading("Revenue impact"),
            icon="Financial data.svg",
            cols=2,
            rows=2,
            col_gap=24,
            fill=Fill.GREY,
            col=1, row=3,
            children=[
                Box(label=[_body("Latency down")], icon="Gauge.svg", col=0, row=0),
                Box(label=[_body("Tokens/sec up")], icon="Scale up.svg", col=1, row=0),
                Box(label=[_body("Efficiency up")], icon="Line chart with check.svg", col=0, row=1),
                Box(label=[_body("Optimization"), _body("& scale")], icon="Line chart with commerce.svg", col=1, row=1),
            ],
        ),

        # ── Row 4: summary boxes (full-width) ──
        Box(
            id="summary1",
            label=[_heading("From training focused to inference focused")],
            fill=Fill.GREY,
            width=848,
            col=0, row=4, col_span=2,
        ),

        Arrow(source="summary1.bottom", target="summary2.top"),

        Box(
            id="summary2",
            label=[_heading("Performance & cost efficiency")],
            width=848,
            col=0, row=5, col_span=2,
        ),
    ],
)
