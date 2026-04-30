"""Request-to-hardware stack – vertical panel stack.

Declarative definition using the diagram model.
"""

from __future__ import annotations

from diagram_model import (
    Arrow,
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


request_to_hardware_stack = Diagram(
    title="Request to hardware stack",
    arrangement=Diagram.Arrangement.VERTICAL,
    row_gap=24,  # arrows route vertically between rows
    outer_margin=24,
    components=[
        # Top box
        Box(id="user", label=[_body("User request")], icon="Cloud.svg"),

        Arrow(source="user.bottom", target="orch.top"),

        # Orchestration layer
        Panel(
            id="orch",
            heading=_heading("Orchestration layer"),
            icon="Snap.svg",
            cols=2,
            rows=2,
            fill=Fill.GREY,
            children=[
                Box(label=[_body("Ollama")], col=0, row=0),
                Box(label=[_body("Lemonade"), _body("Server")], col=1, row=0),
                Box(label=[_body("vLLM")], col=0, row=1, col_span=2),
            ],
        ),

        Arrow(source="orch.bottom", target="runtime.top"),

        # Model runtime
        Panel(
            id="runtime",
            heading=_heading("Model runtime"),
            icon="AI.svg",
            cols=2,
            rows=3,
            fill=Fill.WHITE,
            children=[
                Box(label=[_body("llama.cpp")], fill=Fill.GREY, col=0, row=0),
                Box(label=[_body("OpenVINO")], fill=Fill.GREY, col=1, row=0),
                Box(label=[_body("vLLM")], fill=Fill.GREY, col=0, row=1),
                Box(label=[_body("TensorRT-"), _body("LLM")], fill=Fill.GREY, col=1, row=1),
                Box(label=[_body("ONNX Runtime")], fill=Fill.GREY, col=0, row=2, col_span=2),
            ],
        ),

        Arrow(source="runtime.bottom", target="kernel.top"),

        # Compute kernel
        Panel(
            id="kernel",
            heading=_heading("Compute kernel"),
            icon="kernel.svg",
            cols=2,
            rows=2,
            fill=Fill.GREY,
            children=[
                Box(label=[_body("CUDA")], col=0, row=0),
                Box(label=[_body("ROCm")], col=1, row=0),
                Box(label=[_body("Metal")], col=0, row=1),
                Box(label=[_body("oneDNN")], col=1, row=1),
            ],
        ),

        Arrow(source="kernel.bottom", target="driver.top"),

        # Driver
        Panel(
            id="driver",
            heading=_heading("Driver"),
            icon="Wrench 1.svg",
            cols=2,
            rows=1,
            fill=Fill.WHITE,
            children=[
                Box(label=[_body("CUDA")], fill=Fill.GREY, col=0, row=0),
                Box(label=[_body("ROCm")], fill=Fill.GREY, col=1, row=0),
            ],
        ),

        Arrow(source="driver.bottom", target="hardware.top"),

        # Hardware
        Panel(
            id="hardware",
            heading=_heading("Hardware"),
            icon="Chip 1.svg",
            cols=2,
            rows=2,
            fill=Fill.GREY,
            children=[
                Box(label=[_body("CPU")], icon="CPU.svg", col=0, row=0),
                Box(label=[_body("GPU")], icon="RAM.svg", col=1, row=0),
                Box(label=[_body("NPU")], icon="Chip 2.svg", col=0, row=1),
                Box(label=[_body("RAM &"), _body("VRAM")], icon="Memory.svg", col=1, row=1),
            ],
        ),
    ],
)
