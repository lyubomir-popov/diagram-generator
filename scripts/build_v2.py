"""Build all declarative v2 diagram outputs (SVG + draw.io).

Flags:
    --grid    Also emit *-v2-grid.svg with the layout grid overlay.
"""
from __future__ import annotations

import pathlib
import sys

from diagram_layout import layout, validate_arrows, validate_grid
from diagram_render_svg import write_svg
from diagram_render_drawio import write_drawio

from diagrams.attention_qkv import attention_qkv
from diagrams.aws_hld import aws_hld
from diagrams.gpu_waiting_scheduler import gpu_waiting_scheduler
from diagrams.inference_snaps import inference_snaps
from diagrams.logic_data_vram import logic_data_vram
from diagrams.memory_wall import memory_wall
from diagrams.request_to_hardware_stack import request_to_hardware_stack
from diagrams.rise_of_inference_economy import rise_of_inference_economy
from diagrams.diagram_intake_workflow import diagram_intake_workflow
from diagrams.diagram_language_workflow import diagram_language_workflow

from diagram_shared import SVG_DIR, DRAWIO_DIR


DIAGRAMS = [
    ("attention-qkv-onbrand", attention_qkv),
    ("aws-hld-onbrand", aws_hld),
    ("gpu-waiting-scheduler-onbrand", gpu_waiting_scheduler),
    ("inference-snaps-onbrand", inference_snaps),
    ("logic-data-vram-onbrand", logic_data_vram),
    ("memory-wall-onbrand", memory_wall),
    ("request-to-hardware-stack-onbrand", request_to_hardware_stack),
    ("rise-of-inference-economy-onbrand", rise_of_inference_economy),
    ("diagram-intake-workflow-onbrand", diagram_intake_workflow),
    ("diagram-language-workflow-onbrand", diagram_language_workflow),
]


def main() -> None:
    emit_grid = "--grid" in sys.argv
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    DRAWIO_DIR.mkdir(parents=True, exist_ok=True)
    total_arrow_violations = 0
    for slug, diagram in DIAGRAMS:
        result = layout(diagram)
        svg_path = SVG_DIR / f"{slug}-v2.svg"
        drawio_path = DRAWIO_DIR / f"{slug}-v2.drawio"
        write_svg(svg_path, result)
        write_drawio(drawio_path, result, name=diagram.title)

        # Grid overlay SVG
        if emit_grid:
            grid_path = SVG_DIR / f"{slug}-v2-grid.svg"
            write_svg(grid_path, result, show_layout_grid=True)

        # Arrow clearance check
        arrow_violations = validate_arrows(result)
        if arrow_violations:
            total_arrow_violations += len(arrow_violations)
            print(f"  {slug}: SVG + draw.io  ⚠ {len(arrow_violations)} arrow violation(s)")
            for v in arrow_violations:
                print(f"    {v.segment}: {v.length:.1f}px < {v.minimum:.0f}px  "
                      f"({v.start[0]:.0f},{v.start[1]:.0f})→({v.end[0]:.0f},{v.end[1]:.0f})")
        else:
            print(f"  {slug}: SVG + draw.io")

    if total_arrow_violations:
        print(f"\n  ⚠ {total_arrow_violations} total arrow clearance violation(s)")
        print(f"    Increase row_gap/col_gap to ARROW_GAP (32) where arrows route.")


if __name__ == "__main__":
    main()
