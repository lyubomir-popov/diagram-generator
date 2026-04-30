"""Inference snaps – snap packaging diagram.

Declarative definition using the diagram model.
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
    Terminal,
)


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


inference_snaps = Diagram(
    title="Inference snaps",
    arrangement=Diagram.Arrangement.VERTICAL,
    row_gap=24,  # ARROW_GAP: fan-out arrows route between rows
    outer_margin=24,
    components=[
        # Title bar
        Box(
            id="title",
            label=[_heading("Inference snaps")],
            icon="Snap.svg",
            width=616,
        ),

        Arrow(source="title.bottom", target="terminal.top"),

        # Terminal command
        Terminal(id="terminal", command="$ snap install gemma3", width=616),

        # Dashed outer frame containing snap + pad + tiles
        # Wrapper: outer width must match peer boxes (616).
        # Content span = 616 − 2×8 = 600.
        Panel(
            id="frame",
            cols=1,
            col_width=600,
            fill=Fill.WHITE,
            border=Border.DASHED,
            children=[
                # Snap identity box
                Box(label=[_heading("Inference snap")], icon="Package.svg", width=600),

                # Grey pad with 2×4 tile grid
                # Pad outer = 600 (fills frame content).
                # Content = 600 − 2×8 = 584.  Two cols + 8px gap → (584−8)/2 = 288.
                Panel(
                    id="pad",
                    cols=2,
                    rows=4,
                    col_width=288,
                    col_gap=8,
                    row_gap=8,
                    fill=Fill.GREY,
                    children=[
                        Box(label=[_body("Model")], icon="Network.svg", col=0, row=0),
                        Box(label=[_body("Workload"), _body("identity")], icon="User.svg", col=1, row=0),
                        Box(label=[_body("Runtime")], icon="Gauge.svg", col=0, row=1),
                        Box(label=[_body("Heterogeneous"), _body("hardware")], icon="Chip 1.svg", col=1, row=1),
                        Box(label=[_body("Dependencies")], icon="Wrench 1.svg", col=0, row=2),
                        Box(label=[_body("Reproducibility")], icon="Clipboard.svg", col=1, row=2),
                        Box(label=[_body("Hardware"), _body("config")], icon="CPU.svg", col=0, row=3),
                        Box(label=[_body("Operational"), _body("observability")], icon="Bar chart with check.svg", col=1, row=3),
                    ],
                ),
            ],
        ),

        # Arrows from frame to each hardware box
        Arrow(source="frame.bottom", target="hw_cpu.top"),
        Arrow(source="frame.bottom", target="hw_gpu.top"),
        Arrow(source="frame.bottom", target="hw_npu.top"),

        # Hardware boxes in a horizontal row
        Panel(
            id="hardware",
            cols=3,
            col_width=200,
            col_gap=8,
            fill=Fill.WHITE,
            border=Border.NONE,
            uniform_height=True,
            children=[
                Box(id="hw_cpu", label=[_body("CPU")], icon="CPU.svg", col=0, row=0),
                Box(id="hw_gpu", label=[_body("GPU")], fill=Fill.GREY, icon="RAM.svg", col=1, row=0),
                Box(id="hw_npu", label=[_body("NPU")], icon="Chip 2.svg", col=2, row=0),
            ],
        ),
    ],
)
