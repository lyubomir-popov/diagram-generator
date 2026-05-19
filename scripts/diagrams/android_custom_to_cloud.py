"""Custom Android files → Host-side tools → Anbox Cloud → Virtualized Android.

Horizontal 4-column flow showing the path from custom Android files
through host-side tooling and Anbox Cloud to a running virtualized instance.
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


android_custom_to_cloud = Diagram(
    title="Custom Android to Anbox Cloud",
    arrangement=Diagram.Arrangement.GRID,
    cols=4,
    col_width=336,
    col_gap=32,
    row_gap=24,
    outer_margin=24,
    uniform_rows=True,
    components=[
        # ── Col 0: Custom Android files ──
        Panel(
            id="custom_files",
            heading=_heading("Custom Android files"),
            fill=Fill.WHITE,
            cols=1,
            row_gap=8,
            col=0, row=0,
            children=[
                Box(
                    id="partitions",
                    label=[_heading("Partitions")],
                    fill=Fill.GREY,
                    border=Border.FILL,
                    col=0, row=0,
                ),
                Box(
                    id="system_image",
                    label=[_body("Android system image")],
                    fill=Fill.WHITE,
                    col=0, row=1,
                ),
                Box(
                    id="kernel",
                    label=[_body("Kernel")],
                    fill=Fill.GREY,
                    col=0, row=2,
                ),
            ],
        ),

        # ── Col 1: Host-side tools ──
        Panel(
            id="host_tools",
            heading=_heading("Host-side tools"),
            fill=Fill.WHITE,
            cols=1,
            row_gap=24,
            col=1, row=0,
            children=[
                Box(
                    id="cvd",
                    label=[_body("cvd")],
                    fill=Fill.WHITE,
                    col=0, row=0,
                ),
                Box(
                    id="launchers",
                    label=[_body("Launchers")],
                    fill=Fill.WHITE,
                    col=0, row=1,
                ),
            ],
        ),

        # ── Col 2: Anbox Cloud ──
        Box(
            id="anbox_cloud",
            label=[
                _heading("Anbox Cloud"),
                _body("- Consumes system images"),
                _body("- Consumes host-side tools"),
            ],
            fill=Fill.WHITE,
            icon="Cloud.svg",
            col=2, row=0,
        ),

        # ── Col 3: Virtualized Android instance ──
        Box(
            id="virt_instance",
            label=[
                _heading("Virtualized Android instance"),
                _body("- Unmodified"),
                _body("  Cuttlefish-based Android"),
                _body("- No rebuild required"),
            ],
            fill=Fill.WHITE,
            icon="Virtual machine.svg",
            col=3, row=0,
        ),

        # ── Arrows ──
        Arrow(source="custom_files.right", target="host_tools.left"),
        Arrow(source="host_tools.right", target="anbox_cloud.left"),
        Arrow(source="anbox_cloud.right", target="virt_instance.left"),
    ],
)
