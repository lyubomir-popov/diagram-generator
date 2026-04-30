"""Build all declarative v2 diagram outputs (SVG + draw.io).

Flags:
    --grid    Also emit *-v2-grid.svg with the layout grid overlay.

Diagram definitions live in scripts/diagrams/ (Python) and
scripts/diagrams/yaml/ (YAML/JSON).  Company-specific definitions
may be gitignored; the build gracefully skips any that are absent.
"""
from __future__ import annotations

import importlib
import pathlib
import sys

from diagram_layout import layout, validate_arrows, validate_grid
from diagram_loader import load_diagram
from diagram_render_svg import write_svg
from diagram_render_drawio import write_drawio
from diagram_shared import SVG_DIR, DRAWIO_DIR


# (slug, module_name, variable_name)
_REGISTRY: list[tuple[str, str, str]] = [
    ("attention-qkv-onbrand", "diagrams.attention_qkv", "attention_qkv"),
    ("aws-hld-onbrand", "diagrams.aws_hld", "aws_hld"),
    ("gpu-waiting-scheduler-onbrand", "diagrams.gpu_waiting_scheduler", "gpu_waiting_scheduler"),
    ("inference-snaps-onbrand", "diagrams.inference_snaps", "inference_snaps"),
    ("logic-data-vram-onbrand", "diagrams.logic_data_vram", "logic_data_vram"),
    ("memory-wall-onbrand", "diagrams.memory_wall", "memory_wall"),
    ("request-to-hardware-stack-onbrand", "diagrams.request_to_hardware_stack", "request_to_hardware_stack"),
    ("rise-of-inference-economy-onbrand", "diagrams.rise_of_inference_economy", "rise_of_inference_economy"),
    ("diagram-intake-workflow-onbrand", "diagrams.diagram_intake_workflow", "diagram_intake_workflow"),
    ("diagram-language-workflow-onbrand", "diagrams.diagram_language_workflow", "diagram_language_workflow"),
    ("example-deployment-pipeline-onbrand", "diagrams.example_deployment_pipeline", "example_deployment_pipeline"),
    ("example-platform-architecture-onbrand", "diagrams.example_platform_architecture", "example_platform_architecture"),
    ("example-data-processing-onbrand", "diagrams.example_data_processing", "example_data_processing"),
    ("example-stacked-blocks-onbrand", "diagrams.example_stacked_blocks", "example_stacked_blocks"),
]


def _load_diagrams() -> list[tuple[str, object]]:
    """Import diagram definitions, skipping any that are missing (gitignored)."""
    diagrams = []
    # Python definitions
    for slug, mod_name, var_name in _REGISTRY:
        try:
            mod = importlib.import_module(mod_name)
            diagrams.append((slug, getattr(mod, var_name)))
        except (ModuleNotFoundError, FileNotFoundError):
            print(f"  {slug}: skipped (definition not found)")

    # YAML/JSON definitions from scripts/diagrams/yaml/
    yaml_dir = pathlib.Path(__file__).parent / "diagrams" / "yaml"
    if yaml_dir.is_dir():
        for p in sorted(yaml_dir.iterdir()):
            if p.suffix in (".yaml", ".yml", ".json"):
                slug = p.stem
                # Append -onbrand only if the stem doesn't already have it
                if not slug.endswith("-onbrand"):
                    slug += "-onbrand"
                try:
                    diagrams.append((slug, load_diagram(p)))
                except Exception as exc:
                    print(f"  {slug}: skipped ({exc})")
    return diagrams


def main() -> None:
    emit_grid = "--grid" in sys.argv
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    DRAWIO_DIR.mkdir(parents=True, exist_ok=True)
    total_arrow_violations = 0
    diagrams = _load_diagrams()
    for slug, diagram in diagrams:
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
