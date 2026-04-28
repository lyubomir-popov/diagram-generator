"""GPU waiting scheduler – sparse layout with orthogonal arrow.

Declarative definition using the diagram model.
The grid adapts to contain:
  - Scheduler box (top right, 2 columns wide)
  - Document icon (middle)
  - Gauge icon (left)
  - GPU box (bottom left)
  - Helper text annotations
  - Orthogonal arrow connecting GPU area to scheduler
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Box,
    Diagram,
    Fill,
    IconCluster,
    Line,
)

HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


gpu_waiting_scheduler = Diagram(
    title="GPU waiting scheduler",
    arrangement=Diagram.Arrangement.GRID,
    cols=4,
    col_width=96,
    row_height=48,
    col_gap=8,
    row_gap=8,
    outer_margin=32,
    components=[
        # Scheduler box – top right, spanning 3 columns
        Box(
            id="scheduler",
            label=[
                _heading("Scheduler"),
                _body("AI inference"),
                _body("request"),
            ],
            icon="Desktop monitor.svg",
            fill=Fill.WHITE,
            width=304,
            col=1, row=0, col_span=3,
        ),

        # Document icon – middle area
        IconCluster(
            icons=["Document.svg"],
            col=1, row=1,
        ),

        # Annotation "Queued request" – beside document icon
        Annotation(
            id="queued",
            lines=[_body("Queued request", fill=HELPER)],
            col=2, row=1, col_span=2,
        ),

        # Gauge icon – left area
        IconCluster(
            icons=["Gauge.svg"],
            col=0, row=2,
        ),

        # GPU box – bottom left, explicit width so icon fits
        Box(
            id="gpu",
            label=[_heading("GPU")],
            icon="CPU.svg",
            fill=Fill.GREY,
            width=192,
            col=0, row=3,
        ),

        # Annotation "Waiting..." – below GPU
        Annotation(
            lines=[_heading("Waiting...")],
            col=0, row=4,
        ),

        # Orthogonal arrow from GPU to scheduler
        # Uses explicit waypoints to create 3-segment path matching v1:
        # 1. vertical up from GPU
        # 2. horizontal right 
        # 3. horizontal to scheduler
        # This creates 3 line segments + 1 arrowhead = 4 orange elements
        Arrow(
            source="gpu.top",
            target="scheduler.left",
            waypoints=[
                # Route up from GPU, then right, then to scheduler
                # Using coordinates that create the orthogonal 3-segment path
                (0, 264),   # horizontal segment start (x will be adjusted by renderer)
                (304, 264), # corner point - horizontal then vertical
                (304, 68),  # vertical segment end point
            ],
        ),
    ],
)
