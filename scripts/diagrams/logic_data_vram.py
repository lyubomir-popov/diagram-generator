"""Logic + data conflict / AI inference / VRAM fragmentation diagram.

Declarative definition using the diagram model.  This replaces the
imperative ``build_logic_data_vram()`` in ``generate_remaining_diagrams.py``.
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Bar,
    BarSegment,
    Box,
    Diagram,
    Fill,
    Line,
    Panel,
)
from diagram_shared import HELPER as HELPER_COLOR


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER_COLOR)


logic_data_vram = Diagram(
    title="Logic + data conflict / AI inference / VRAM fragmentation",
    arrangement=Diagram.Arrangement.GRID,
    cols=2,
    # col_gap and row_gap default to GRID_GUTTER (32)
    outer_margin=32,
    components=[
        # ── Row 0: two top panels ──
        Panel(
            id="left",
            heading=_heading("Logic + data conflict"),
            cols=2,
            rows=3,
            row_gap=8,  # compact: no arrows between rows
            fill=Fill.WHITE,
            col=0, row=0,
            children=[
                Box(label=[_body("CPU")], fill=Fill.GREY, icon="CPU.svg", col=0, row=0),
                Box(label=[_body("Logic")], col=1, row=0),
                Box(label=[_body("Logic")], col=0, row=1),
                Box(label=[_body("Memory")], fill=Fill.GREY, icon="Memory.svg", col=0, row=2),
            ],
        ),

        Panel(
            id="right_panel",
            heading=_heading("AI inference"),
            cols=2,
            rows=3,
            row_gap=32,  # structural: arrows route between rows
            fill=Fill.WHITE,
            col=1, row=0,
            children=[
                Box(id="r_logic", label=[_body("Logic")], icon="AI.svg", col=0, row=0),
                Box(id="r_data", label=[_body("Data")], fill=Fill.GREY, icon="Data.svg", col=0, row=1),
                Box(id="r_cpu", label=[_body("CPU")], icon="CPU.svg", col=0, row=2),
                Box(id="r_data2", label=[_body("Data")], icon="Data.svg", col=1, row=0),
                Box(id="r_memory", label=[_body("Memory")], fill=Fill.GREY, icon="Memory.svg", col=1, row=2),
            ],
        ),

        # Arrows inside right panel (using box IDs)
        Arrow(source="r_logic.bottom", target="r_data.top"),
        Arrow(source="r_data.bottom", target="r_cpu.top"),
        Arrow(source="r_data2.bottom", target="r_memory.top"),

        # ── Row 1: annotation text ──
        Annotation(
            lines=[
                _helper("Logic with optional data."),
                _helper("Optional data can stay separate."),
            ],
            col=0, row=1,
        ),
        Annotation(
            lines=[_helper("Logic inseparable from data.")],
            col=1, row=1,
        ),

        # ── Row 2: VRAM fragmentation (col_span=2) ──
        # Outer cell = 2 × 408 + 32 = 848.  Content = 848 − 16 = 832.
        # Two sub-panels + 32px gap → each sub-panel outer = (832 − 32) / 2 = 400.
        # Sub-panel content col_width = 400 − 2 × 8 = 384.
        Panel(
            id="vram",
            heading=_heading("VRAM fragmentation"),
            cols=2,
            col_span=2,
            col_gap=32,  # structural: arrow routes between sub-panels
            fill=Fill.WHITE,
            col=0, row=2,
            children=[
                # Fragmented layout sub-panel
                Panel(
                    id="frag",
                    heading=_heading("Fragmented layout"),
                    icon="RAM.svg",
                    cols=1,
                    col_width=384,
                    fill=Fill.GREY,
                    children=[
                        Bar(segments=[BarSegment(label=_body("10 GB"))]),
                        Bar(segments=[BarSegment(label=_body("6 GB context cache"))]),
                        Bar(segments=[
                            BarSegment(width_px=72),
                            BarSegment(width_px=56, fill=Fill.GREY),
                            BarSegment(width_px=88),
                            BarSegment(width_px=40, fill=Fill.GREY),
                            BarSegment(),  # auto-fill remainder
                        ]),
                    ],
                ),
                # Packed layout sub-panel
                Panel(
                    id="packed",
                    heading=_heading("Packed layout"),
                    icon="Memory.svg",
                    cols=1,
                    col_width=384,
                    fill=Fill.GREY,
                    children=[
                        Bar(segments=[BarSegment(label=_body("24 GB GPU memory"))]),
                        Bar(segments=[
                            BarSegment(width_px=72, label=_body("9 GB")),
                            BarSegment(width_px=112, fill=Fill.GREY, label=_body("Alloc")),
                            BarSegment(),  # auto-fill remainder
                        ]),
                        Bar(segments=[
                            BarSegment(width_px=220, fill=Fill.GREY),
                            BarSegment(label=_body("8 GB model")),  # auto-fill remainder
                        ]),
                    ],
                ),
            ],
        ),

        # Arrow between sub-panels
        Arrow(source="frag.right", target="packed.left"),

        # ── Row 3: annotation text below VRAM ──
        Annotation(
            lines=[_helper("Fragmented allocations leave gaps.")],
            col=0, row=3,
        ),
        Annotation(
            lines=[_helper("860 B free")],
            col=1, row=3,
        ),
    ],
)
