"""3-way visual comparison: input sketch → v1 stable → v2 experimental.

Generates Playwright screenshots for each diagram showing all three
versions side by side so regressions are immediately obvious.

Usage:
    python scripts/_compare_3way.py              # all diagrams
    python scripts/_compare_3way.py attention-qkv # single slug
"""
from __future__ import annotations

import html as html_mod
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

# ── File mapping: slug → (input_sketch, v1_svg, v2_svg) ──

INPUT_DIR = Path("../diagrams/1.input")
SVG_DIR = Path("../diagrams/2.output/svg")
OUT_DIR = Path("../diagrams/3.compare/visual-diff")

DIAGRAMS = [
    {
        "slug": "attention-qkv",
        "input": INPUT_DIR / "image 3.png",
        "v1": SVG_DIR / "attention-qkv-onbrand.svg",
        "v2": SVG_DIR / "attention-qkv-onbrand-v2.svg",
    },
    {
        "slug": "gpu-waiting-scheduler",
        "input": INPUT_DIR / "image 5.png",
        "v1": SVG_DIR / "gpu-waiting-scheduler-onbrand.svg",
        "v2": SVG_DIR / "gpu-waiting-scheduler-onbrand-v2.svg",
    },
    {
        "slug": "inference-snaps",
        "input": INPUT_DIR / "image 7.png",
        "v1": SVG_DIR / "inference-snaps-onbrand.svg",
        "v2": SVG_DIR / "inference-snaps-onbrand-v2.svg",
    },
    {
        "slug": "logic-data-vram",
        "input": INPUT_DIR / "image 4.png",
        "v1": SVG_DIR / "logic-data-vram-onbrand.svg",
        "v2": SVG_DIR / "logic-data-vram-onbrand-v2.svg",
    },
    {
        "slug": "memory-wall",
        "input": INPUT_DIR / "redo-this-image-onbrand.png",
        "v1": SVG_DIR / "memory-wall-onbrand.svg",
        "v2": SVG_DIR / "memory-wall-onbrand-v2.svg",
    },
    {
        "slug": "request-to-hardware-stack",
        "input": INPUT_DIR / "image 6.png",
        "v1": SVG_DIR / "request-to-hardware-stack-onbrand.svg",
        "v2": SVG_DIR / "request-to-hardware-stack-onbrand-v2.svg",
    },
    {
        "slug": "rise-of-inference-economy",
        "input": INPUT_DIR / "image.png",
        "v1": SVG_DIR / "rise-of-inference-economy-onbrand.svg",
        "v2": SVG_DIR / "rise-of-inference-economy-onbrand-v2.svg",
    },
]


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

_COMPARE_3WAY_HTML = """\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Ubuntu Sans', sans-serif; background: #f5f5f5; padding: 24px; }}
  h1 {{ font-size: 18px; margin-bottom: 16px; }}
  .row {{ display: flex; gap: 16px; align-items: flex-start; }}
  .col {{ flex: 1; min-width: 0; }}
  .col h2 {{ font-size: 14px; color: #666; margin-bottom: 8px; }}
  .col img {{ width: 100%; border: 1px solid #ccc; background: #fff; }}
  .missing {{ color: #c00; font-style: italic; padding: 32px; }}
</style>
</head>
<body>
<h1>{title}</h1>
<div class="row">
  <div class="col">
    <h2>Input sketch</h2>
    {input_content}
  </div>
  <div class="col">
    <h2>v1 (stable)</h2>
    {v1_content}
  </div>
  <div class="col">
    <h2>v2 (experimental)</h2>
    {v2_content}
  </div>
</div>
</body>
</html>
"""


def _file_uri(path: Path) -> str:
    return path.resolve().as_uri()


def _img_or_missing(path: Path, label: str) -> str:
    if path.exists():
        return f'<img src="{_file_uri(path)}" />'
    return f'<p class="missing">{html_mod.escape(label)} not found: {html_mod.escape(str(path))}</p>'


def compare_3way(
    slug: str,
    input_path: Path,
    v1_path: Path,
    v2_path: Path,
    out_dir: Path,
    width: int = 2400,
) -> Path:
    """Generate a 3-way comparison screenshot.

    Returns the path to the combined PNG.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    title = f"{slug}: input → v1 → v2"

    html_content = _COMPARE_3WAY_HTML.format(
        title=html_mod.escape(title),
        input_content=_img_or_missing(input_path, "Input sketch"),
        v1_content=_img_or_missing(v1_path, "v1 stable"),
        v2_content=_img_or_missing(v2_path, "v2 experimental"),
    )

    tmp_html = out_dir / f"_3way_{slug}.html"
    tmp_html.write_text(html_content, encoding="utf-8")
    out_png = out_dir / f"{slug}-3way.png"

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": width, "height": 800},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        page.goto(_file_uri(tmp_html), wait_until="load")
        page.wait_for_timeout(2000)
        page.screenshot(path=str(out_png), full_page=True,
                        timeout=60000, animations="disabled")
        page.close()
        browser.close()

    tmp_html.unlink(missing_ok=True)
    return out_png


def main():
    filter_slug = sys.argv[1] if len(sys.argv) > 1 else None

    for d in DIAGRAMS:
        slug = d["slug"]
        if filter_slug and slug != filter_slug:
            continue

        missing = []
        if not d["input"].exists():
            missing.append(f"input={d['input']}")
        if not d["v1"].exists():
            missing.append(f"v1={d['v1']}")
        if not d["v2"].exists():
            missing.append(f"v2={d['v2']}")

        if missing:
            print(f"SKIP {slug}: {', '.join(missing)}")
            continue

        print(f"Comparing {slug}...")
        out = compare_3way(slug, d["input"], d["v1"], d["v2"], OUT_DIR)
        print(f"  → {out}")

    print("Done")


if __name__ == "__main__":
    main()
