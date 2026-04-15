from __future__ import annotations

import html
import pathlib
import urllib.parse


ROOT = pathlib.Path(__file__).resolve().parents[1]
DIAGRAMS_DIR = ROOT / "diagrams"
BEFORE_DIR = DIAGRAMS_DIR / "1. input"
AFTER_DIR = DIAGRAMS_DIR / "2.output"
COMPARE_DIR = DIAGRAMS_DIR / "3.compare"
HTML_DIR = COMPARE_DIR / "html"
JPG_DIR = COMPARE_DIR / "jpg"


PAIRS = [
    {
        "slug": "memory-wall",
        "title": "Memory wall",
        "before": "redo-this-image-onbrand.png",
        "after": "memory-wall-onbrand.svg",
    },
    {
        "slug": "rise-of-inference-economy",
        "title": "Rise of the inference economy",
        "before": "image.png",
        "after": "rise-of-inference-economy-onbrand.svg",
    },
    {
        "slug": "attention-qkv",
        "title": "Attention QKV",
        "before": "image 3.png",
        "after": "attention-qkv-onbrand.svg",
    },
    {
        "slug": "logic-data-vram",
        "title": "Logic, data, VRAM",
        "before": "image 4.png",
        "after": "logic-data-vram-onbrand.svg",
    },
    {
        "slug": "gpu-waiting-scheduler",
        "title": "GPU waiting scheduler",
        "before": "image 5.png",
        "after": "gpu-waiting-scheduler-onbrand.svg",
    },
    {
        "slug": "request-to-hardware-stack",
        "title": "Request to hardware stack",
        "before": "image 6.png",
        "after": "request-to-hardware-stack-onbrand.svg",
    },
    {
        "slug": "inference-snaps",
        "title": "Inference snaps",
        "before": "image 7.png",
        "after": "inference-snaps-onbrand.svg",
    },
]


def rel_url(source: pathlib.Path, target: pathlib.Path) -> str:
  relative_path = pathlib.Path(pathlib.os.path.relpath(target, source.parent)).as_posix()
  return urllib.parse.quote(relative_path, safe="/")


def build_panel(label: str, asset_path: pathlib.Path, asset_url: str, missing_text: str) -> str:
    body = ""
    if asset_path.exists():
        body = f'<img src="{html.escape(asset_url)}" alt="{html.escape(label)}" />'
    else:
        body = (
            '<div class="missing">'
            f'<div class="missing-label">Missing {html.escape(label.lower())}</div>'
            f'<div class="missing-path">{html.escape(missing_text)}</div>'
            "</div>"
        )
    return (
        '<section class="panel">'
        f'<div class="panel-title">{html.escape(label)}</div>'
        f'<div class="asset-frame">{body}</div>'
        "</section>"
    )


def build_page(pair: dict[str, str]) -> str:
    html_path = HTML_DIR / f"{pair['slug']}.html"
    before_path = BEFORE_DIR / pair["before"]
    after_path = AFTER_DIR / pair["after"]
    before_url = rel_url(html_path, before_path)
    after_url = rel_url(html_path, after_path)
    before_text = f"Expected: diagrams/1. input/{pair['before']}"
    after_text = f"Expected: diagrams/2.output/{pair['after']}"

    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{html.escape(pair['title'])} comparison</title>
  <style>
    :root {{
      color-scheme: light;
      --page-bg: #f4f1ea;
      --panel-bg: #fffdfa;
      --panel-border: #d6d0c4;
      --text: #1d1b18;
      --muted: #6b655c;
      --accent: #e95420;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, #fff4ea, transparent 28%),
        linear-gradient(180deg, #f8f5ef 0%, var(--page-bg) 100%);
    }}

    .page {{
      width: 1800px;
      min-height: 1080px;
      padding: 32px;
    }}

    .header {{
      display: flex;
      justify-content: space-between;
      align-items: end;
      margin-bottom: 24px;
      border-bottom: 2px solid rgba(233, 84, 32, 0.25);
      padding-bottom: 16px;
    }}

    h1 {{
      margin: 0;
      font-size: 36px;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }}

    .meta {{
      font-size: 18px;
      color: var(--muted);
    }}

    .grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: stretch;
    }}

    .panel {{
      display: flex;
      flex-direction: column;
      min-height: 940px;
      border: 1px solid var(--panel-border);
      background: var(--panel-bg);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
    }}

    .panel-title {{
      padding: 14px 18px;
      border-bottom: 1px solid var(--panel-border);
      font-size: 22px;
      font-weight: 700;
    }}

    .asset-frame {{
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background:
        linear-gradient(45deg, #f6f2eb 25%, transparent 25%),
        linear-gradient(-45deg, #f6f2eb 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f6f2eb 75%),
        linear-gradient(-45deg, transparent 75%, #f6f2eb 75%);
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0;
    }}

    img {{
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
      background: #ffffff;
    }}

    .missing {{
      width: 100%;
      height: 100%;
      min-height: 820px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 12px;
      padding: 24px;
      border: 2px dashed rgba(233, 84, 32, 0.45);
      background: rgba(255, 255, 255, 0.88);
      text-align: center;
    }}

    .missing-label {{
      font-size: 28px;
      font-weight: 700;
    }}

    .missing-path {{
      font-size: 20px;
      color: var(--muted);
    }}
  </style>
</head>
<body>
  <main class=\"page\">
    <header class=\"header\">
      <h1>{html.escape(pair['title'])}</h1>
      <div class=\"meta\">Before on the left, redraw on the right</div>
    </header>
    <section class=\"grid\">
      {build_panel('Before', before_path, before_url, before_text)}
      {build_panel('After', after_path, after_url, after_text)}
    </section>
  </main>
</body>
</html>
"""


def build_index() -> str:
    links = []
    for pair in PAIRS:
        links.append(
            f'<li><a href="html/{html.escape(pair["slug"])}.html">{html.escape(pair["title"])}<span>jpg/{html.escape(pair["slug"])}.jpg</span></a></li>'
        )
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diagram compare batch</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f4f1ea;
      color: #1d1b18;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
    }
    p {
      margin: 0 0 24px;
      color: #6b655c;
      font-size: 18px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
      max-width: 960px;
    }
    a {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px;
      border: 1px solid #d6d0c4;
      background: #fffdfa;
      text-decoration: none;
      color: inherit;
    }
    span {
      color: #6b655c;
    }
  </style>
</head>
<body>
  <h1>Diagram compare batch</h1>
  <p>Open a page to review the merged before/after layout. JPG renders are written to diagrams/3.compare/jpg/.</p>
  <ul>
    """ + "".join(links) + """
  </ul>
</body>
</html>
"""


def main() -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    JPG_DIR.mkdir(parents=True, exist_ok=True)
    for pair in PAIRS:
        html_path = HTML_DIR / f"{pair['slug']}.html"
        html_path.write_text(build_page(pair), encoding="utf-8")
    (COMPARE_DIR / "index.html").write_text(build_index(), encoding="utf-8")


if __name__ == "__main__":
    main()