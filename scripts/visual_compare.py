"""Playwright visual comparison for diagram outputs.

Renders two SVG files (or an SVG and a raster reference) side by side,
captures screenshots, and computes a pixel-diff summary.

Usage:
    python scripts/visual_compare.py \
        --left  diagrams/2.output/svg/logic-data-vram-onbrand-v2.svg \
        --right diagrams/2.output/draw.io/manually-edited/raster/logic-data-vram-onbrand.jpg \
        --output diagrams/3.compare/visual-diff/logic-data-vram.png

Can also compare two SVGs:
    python scripts/visual_compare.py \
        --left  diagrams/2.output/svg/logic-data-vram-onbrand-v2.svg \
        --right diagrams/2.output/svg/logic-data-vram-onbrand.svg \
        --output diagrams/3.compare/visual-diff/logic-data-vram-old-vs-new.png
"""

from __future__ import annotations

import argparse
import html as html_mod
import os
import sys
from pathlib import Path

# Playwright is expected in the venv
from playwright.sync_api import sync_playwright


COMPARE_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Visual Comparison</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Ubuntu Sans', sans-serif; background: #f5f5f5; padding: 24px; }}
  h1 {{ font-size: 18px; margin-bottom: 16px; }}
  .row {{ display: flex; gap: 24px; align-items: flex-start; }}
  .col {{ flex: 1; }}
  .col h2 {{ font-size: 14px; color: #666; margin-bottom: 8px; }}
  .col img {{ width: 100%; border: 1px solid #ccc; background: #fff; }}
</style>
</head>
<body>
<h1>{title}</h1>
<div class="row">
  <div class="col">
    <h2>{left_label}</h2>
    <img src="{left_src}" />
  </div>
  <div class="col">
    <h2>{right_label}</h2>
    <img src="{right_src}" />
  </div>
</div>
</body>
</html>
"""


def _file_uri(path: Path) -> str:
    """Convert a local path to a file:// URI."""
    return path.resolve().as_uri()


_WRAP_HTML = """\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  * {{ margin: 0; padding: 0; }}
  body {{ background: #fff; }}
  img {{ display: block; max-width: 100%; }}
</style></head>
<body><img src="{src}" /></body>
</html>
"""


def _screenshot_file(page, src: Path, out: Path) -> None:
    """Screenshot a file, wrapping SVGs in HTML to avoid font-load hangs."""
    if src.suffix.lower() == ".svg":
        # Wrap SVG in HTML so Chromium doesn't hang on font loading
        tmp = out.with_suffix(".html")
        tmp.write_text(
            _WRAP_HTML.format(src=_file_uri(src)),
            encoding="utf-8",
        )
        page.goto(_file_uri(tmp), wait_until="load")
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out), full_page=True,
                        timeout=60000, animations="disabled")
        tmp.unlink(missing_ok=True)
    else:
        page.goto(_file_uri(src), wait_until="load")
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out), full_page=True,
                        timeout=60000, animations="disabled")


def _label_from_path(p: Path) -> str:
    """Derive a short display label from a file path."""
    parts = p.parts
    # Try to show the last 3 meaningful segments
    meaningful = [x for x in parts if x not in (".", "..")]
    return " / ".join(meaningful[-3:])


def compare(
    left: Path,
    right: Path,
    output: Path | None = None,
    title: str = "Visual comparison",
    width: int = 1920,
) -> dict:
    """Render two files side by side and screenshot.

    Returns a dict with paths to the individual and combined screenshots,
    plus a basic pixel-level diff metric.
    """
    output = output or Path("diagrams/3.compare/visual-diff/compare.png")
    output.parent.mkdir(parents=True, exist_ok=True)

    left_label = _label_from_path(left)
    right_label = _label_from_path(right)

    # Build comparison HTML
    compare_html = COMPARE_HTML_TEMPLATE.format(
        title=html_mod.escape(title),
        left_label=html_mod.escape(left_label),
        right_label=html_mod.escape(right_label),
        left_src=_file_uri(left),
        right_src=_file_uri(right),
    )
    tmp_html = output.parent / "_compare_tmp.html"
    tmp_html.write_text(compare_html, encoding="utf-8")

    # Also capture individual screenshots for pixel comparison
    left_png = output.with_stem(output.stem + "-left")
    right_png = output.with_stem(output.stem + "-right")

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": width, "height": 800},
            device_scale_factor=2,
        )

        # ── Screenshot left ──
        page = ctx.new_page()
        _screenshot_file(page, left, left_png)
        page.close()

        # ── Screenshot right ──
        page = ctx.new_page()
        _screenshot_file(page, right, right_png)
        page.close()

        # ── Combined comparison page ──
        page = ctx.new_page()
        page.goto(_file_uri(tmp_html), wait_until="load")
        page.wait_for_timeout(2000)
        page.screenshot(path=str(output), full_page=True,
                        timeout=60000, animations="disabled")
        page.close()

        browser.close()

    tmp_html.unlink(missing_ok=True)

    # ── Pixel diff (basic) ──
    diff_png = output.with_stem(output.stem + "-diff")
    diff_pct = _pixel_diff(left_png, right_png, diff_out=diff_png)

    return {
        "combined": str(output),
        "left_screenshot": str(left_png),
        "right_screenshot": str(right_png),
        "diff_image": str(diff_png) if diff_pct is not None else None,
        "diff_percent": diff_pct,
    }


def _pixel_diff(a: Path, b: Path, diff_out: Path | None = None) -> float | None:
    """Compute percentage of differing pixels between two PNGs.

    Returns None if Pillow is not available. Resizes to the larger
    canvas before comparing. Optionally writes a red-on-white diff image.
    """
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        print("  (Pillow/numpy not available – skipping pixel diff)", file=sys.stderr)
        return None

    img_a = Image.open(a).convert("RGB")
    img_b = Image.open(b).convert("RGB")

    # Resize to common canvas (larger of the two)
    w = max(img_a.width, img_b.width)
    h = max(img_a.height, img_b.height)

    canvas_a = Image.new("RGB", (w, h), (255, 255, 255))
    canvas_a.paste(img_a, (0, 0))
    canvas_b = Image.new("RGB", (w, h), (255, 255, 255))
    canvas_b.paste(img_b, (0, 0))

    arr_a = np.array(canvas_a)
    arr_b = np.array(canvas_b)

    # Per-pixel difference (threshold: any channel differs by > 16)
    diff = np.abs(arr_a.astype(int) - arr_b.astype(int))
    changed_mask = np.any(diff > 16, axis=2)
    changed_pixels = changed_mask.sum()
    total_pixels = w * h
    pct = round(100 * changed_pixels / total_pixels, 2)

    # Write diff heatmap
    if diff_out is not None:
        # Blend: unchanged = faded left image, changed = red
        faded = (arr_a * 0.3 + 255 * 0.7).astype(np.uint8)
        faded[changed_mask] = [255, 60, 60]
        Image.fromarray(faded).save(diff_out)

    return pct


def main():
    parser = argparse.ArgumentParser(description="Visual diagram comparison")
    parser.add_argument("--left", required=True, help="Left file (SVG or raster)")
    parser.add_argument("--right", required=True, help="Right file (SVG or raster)")
    parser.add_argument("--output", default=None, help="Output comparison PNG")
    parser.add_argument("--title", default="Visual comparison")
    parser.add_argument("--width", type=int, default=1920, help="Browser viewport width")
    args = parser.parse_args()

    left = Path(args.left)
    right = Path(args.right)
    if not left.exists():
        print(f"Error: {left} does not exist", file=sys.stderr)
        sys.exit(1)
    if not right.exists():
        print(f"Error: {right} does not exist", file=sys.stderr)
        sys.exit(1)

    output = Path(args.output) if args.output else None

    result = compare(left, right, output=output, title=args.title, width=args.width)

    print(f"Combined: {result['combined']}")
    print(f"Left:     {result['left_screenshot']}")
    print(f"Right:    {result['right_screenshot']}")
    if result["diff_image"]:
        print(f"Diff map: {result['diff_image']}")
    if result["diff_percent"] is not None:
        print(f"Diff:     {result['diff_percent']}% pixels changed")
    else:
        print("Diff:     (Pillow not available)")


if __name__ == "__main__":
    main()
