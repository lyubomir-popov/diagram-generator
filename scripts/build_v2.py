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

from diagram_layout import layout, validate_arrows, validate_arrow_crossings, validate_grid
from diagram_loader import load_diagram
from diagram_render_svg import write_svg
from diagram_render_drawio import write_drawio
from diagram_shared import SVG_DIR, DRAWIO_DIR, cleanup_legacy_output_root_svgs
from frame_adapter import diagram_to_frame
from layout_v3 import layout_frame_diagram


# (slug, module_name, variable_name)
_REGISTRY: list[tuple[str, str, str]] = [
    ("android-graphics-stack-onbrand", "diagrams.android_graphics_stack", "android_graphics_stack"),
    ("android-custom-to-cloud-onbrand", "diagrams.android_custom_to_cloud", "android_custom_to_cloud"),
    ("android-security-comparison-onbrand", "diagrams.android_security_comparison", "android_security_comparison"),
    ("android-container-vs-vm-onbrand", "diagrams.android_container_vs_vm", "android_container_vs_vm"),
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
    ("lightning-talk-engine-onbrand", "diagrams.lightning_talk_engine", "lightning_talk_engine"),
    ("lt-diagram-generator-onbrand", "diagrams.lt_diagram_generator", "lt_diagram_generator"),
    ("lt-a4-generator-onbrand", "diagrams.lt_a4_generator", "lt_a4_generator"),
    ("lt-summit-identity-onbrand", "diagrams.lt_summit_identity", "lt_summit_identity"),
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
    seen_slugs = {s for s, _ in diagrams}
    if yaml_dir.is_dir():
        for p in sorted(yaml_dir.iterdir()):
            if p.suffix in (".yaml", ".yml", ".json"):
                slug = p.stem
                # Append -onbrand only if the stem doesn't already have it
                if not slug.endswith("-onbrand"):
                    slug += "-onbrand"
                if slug in seen_slugs:
                    print(f"  {slug}: skipped (collides with Python definition)")
                    continue
                try:
                    diagrams.append((slug, load_diagram(p)))
                except Exception as exc:
                    print(f"  {slug}: skipped ({exc})")
    return diagrams


def main() -> None:
    emit_grid = "--grid" in sys.argv
    use_v3 = "--engine" in sys.argv and "v3" in sys.argv
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    DRAWIO_DIR.mkdir(parents=True, exist_ok=True)
    total_arrow_violations = 0
    total_arrow_crossings = 0
    total_grid_violations = 0
    diagrams = _load_diagrams()
    for slug, diagram in diagrams:
        if use_v3:
            frame_diagram = diagram_to_frame(diagram)
            result = layout_frame_diagram(frame_diagram)
        else:
            result = layout(diagram)
        suffix = "-v3" if use_v3 else "-v2"
        svg_path = SVG_DIR / f"{slug}{suffix}.svg"
        drawio_path = DRAWIO_DIR / f"{slug}{suffix}.drawio"
        write_svg(svg_path, result)
        write_drawio(drawio_path, result, name=diagram.title)

        # Grid overlay SVG
        if emit_grid:
            grid_path = SVG_DIR / f"{slug}-v2-grid.svg"
            write_svg(grid_path, result, show_layout_grid=True)

        # Arrow clearance check
        arrow_violations = validate_arrows(result)
        crossings = validate_arrow_crossings(result)
        has_issues = arrow_violations or crossings
        if has_issues:
            total_arrow_violations += len(arrow_violations)
            total_arrow_crossings += len(crossings)
            parts = []
            if arrow_violations:
                parts.append(f"{len(arrow_violations)} clearance")
            if crossings:
                parts.append(f"{len(crossings)} crossing")
            print(f"  {slug}: SVG + draw.io  [!] {' + '.join(parts)} violation(s)")
            for v in arrow_violations:
                print(f"    clearance: {v.segment} {v.length:.1f}px < {v.minimum:.0f}px  "
                      f"({v.start[0]:.0f},{v.start[1]:.0f})->({v.end[0]:.0f},{v.end[1]:.0f})")
            for c in crossings:
                print(f"    crossing: {c.source_ref}->{c.target_ref} passes through '{c.crossed_id}'  "
                      f"({c.segment_start[0]:.0f},{c.segment_start[1]:.0f})->({c.segment_end[0]:.0f},{c.segment_end[1]:.0f})")
        else:
            print(f"  {slug}: SVG + draw.io")

        # Baseline grid alignment check
        grid_violations = validate_grid(result)
        if grid_violations:
            total_grid_violations += len(grid_violations)
            print(f"    [!] {len(grid_violations)} grid violation(s)")
            for gv in grid_violations[:10]:
                print(f"      {gv.primitive_type}.{gv.field} = {gv.value} (nearest grid: {gv.nearest})")
            if len(grid_violations) > 10:
                print(f"      ... and {len(grid_violations) - 10} more")

    removed = cleanup_legacy_output_root_svgs()
    if removed:
        names = ", ".join(path.name for path in removed)
        print(f"  Removed stale root SVGs: {names}")

    if total_arrow_violations:
        print(f"\n  [!] {total_arrow_violations} total arrow clearance violation(s)")
        print(f"    Increase row_gap/col_gap to ARROW_GAP (24) where arrows route.")

    if total_arrow_crossings:
        print(f"\n  [!] {total_arrow_crossings} total arrow crossing violation(s)")
        print(f"    Arrows must not pass through non-source/target component boxes.")

    if total_grid_violations:
        print(f"\n  [!] {total_grid_violations} total baseline-grid violation(s) (warning only)")

    if total_arrow_violations or total_arrow_crossings:
        sys.exit(1)


if __name__ == "__main__":
    main()
