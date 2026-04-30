"""Example: data processing stack – panels, bars, and mixed layout.

A generic data-processing pipeline for demonstration purposes.
Shows panels with Bar segments, Separators, Annotations, and multi-column
grids alongside standard Box and Arrow components.
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Bar,
    BarSegment,
    Border,
    Box,
    BoxStyle,
    Diagram,
    Fill,
    Line,
    Panel,
    Separator,
)

HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER)


example_data_processing = Diagram(
    title="Data processing stack",
    arrangement=Diagram.Arrangement.GRID,
    cols=2,
    col_width=192,
    row_height=64,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        # ── Row 0: Ingestion ──
        Box(id="ingest", label=[_body("Data"), _body("ingestion")],
            icon="Cloud.svg", col=0, row=0),
        Annotation(
            id="ingest_note",
            lines=[_helper("Accepts CSV,"), _helper("JSON, Parquet")],
            col=1, row=0,
        ),

        # ── Row 1: Processing ──
        Box(id="validate", label=[_body("Validate"), _body("& clean")],
            fill=Fill.GREY, icon="Rosette with check.svg",
            col=0, row=1),
        Box(id="enrich", label=[_body("Enrich"), _body("& join")],
            fill=Fill.GREY, icon="Integration.svg",
            col=1, row=1),

        # ── Row 2: Separator ──
        Separator(col=0, row=2, col_span=2),

        # ── Row 3: Storage panel with allocation bars ──
        Panel(
            id="storage",
            cols=1,
            heading=_heading("Storage tiers"),
            icon="Storage node.svg",
            fill=Fill.GREY,
            border=Border.DASHED,
            col=0, row=3, col_span=2,
            children=[
                Bar(segments=[
                    BarSegment(width_px=128, fill=Fill.GREY, label=_body("Hot")),
                    BarSegment(label=_body("Archive")),
                ]),
                Bar(segments=[
                    BarSegment(width_px=96, fill=Fill.GREY, label=_body("SSD")),
                    BarSegment(width_px=96, label=_body("HDD")),
                    BarSegment(label=_body("Object")),
                ]),
            ],
        ),

        # ── Row 4: Output ──
        Box(id="warehouse", label=[_body("Data"), _body("warehouse")],
            style=BoxStyle.HIGHLIGHT, icon="Storage node.svg",
            col=0, row=4),
        Box(id="dashboard", label=[_body("Analytics"), _body("dashboard")],
            icon="Bar chart with check.svg",
            col=1, row=4),

        # ── Arrows ──
        Arrow(source="ingest.bottom", target="validate.top"),
        Arrow(source="ingest.bottom", target="enrich.top"),
        Arrow(source="validate.bottom", target="warehouse.top"),
        Arrow(source="enrich.bottom", target="dashboard.top"),
    ],
)
