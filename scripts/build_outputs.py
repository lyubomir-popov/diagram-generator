from __future__ import annotations

import sys
from pathlib import Path

import build_compare_pages
import export_drawio_library
import export_drawio_batch
import generate_remaining_diagrams


# Pairs of (generated SVG, manual reference raster) for visual validation.
# Only pairs where both files exist are compared.
VISUAL_PAIRS = [
    ("logic-data-vram-onbrand.svg", "logic-data-vram-onbrand.jpg"),
    ("logic-data-vram-onbrand-v2.svg", "logic-data-vram-onbrand.jpg"),
    ("gpu-waiting-scheduler-onbrand.svg", "gpu-waiting-scheduler-onbrand.drawio.png"),
    ("inference-snaps-onbrand.svg", "inference-snaps-onbrand.jpg"),
    ("request-to-hardware-stack-onbrand.svg", "request-to-hardware-stack-onbrand.jpg"),
]


def _visual_validate() -> None:
    """Run Playwright visual comparisons for all available pairs."""
    try:
        from visual_compare import compare
    except ImportError:
        print("  visual_compare not importable – skipping validation")
        return

    svg_dir = Path("diagrams/2.output/svg")
    ref_dir = Path("diagrams/2.output/draw.io/manually-edited/raster")
    out_dir = Path("diagrams/3.compare/visual-diff")

    ran = 0
    for svg_name, ref_name in VISUAL_PAIRS:
        left = svg_dir / svg_name
        right = ref_dir / ref_name
        if not left.exists() or not right.exists():
            continue
        slug = left.stem
        out = out_dir / f"{slug}-vs-manual.png"
        title = f"{svg_name} vs {ref_name}"
        print(f"  Comparing {svg_name} ↔ {ref_name} …", end=" ")
        try:
            result = compare(left, right, output=out, title=title)
            pct = result["diff_percent"]
            pct_str = f"{pct}%" if pct is not None else "n/a"
            print(f"diff={pct_str}")
            ran += 1
        except Exception as exc:
            print(f"FAILED: {exc}")

    if ran == 0:
        print("  No visual pairs found – skipping validation")
    else:
        print(f"  {ran} visual comparisons written to {out_dir}/")


def main() -> None:
    export_drawio_library.main()
    export_drawio_batch.main()
    generate_remaining_diagrams.main()
    build_compare_pages.main()

    # Visual validation (Playwright + pixel diff)
    if "--no-visual" not in sys.argv:
        print("\n── Visual validation ──")
        _visual_validate()
    else:
        print("\n── Visual validation skipped (--no-visual) ──")


if __name__ == "__main__":
    main()