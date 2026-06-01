"""Hot-reload preview server for diagram-generator.

Serves diagram SVGs in a browser with:
  - Component tree sidebar with click-to-select and inspector
  - Live rebuild on file change (watches scripts/diagrams/ and scripts/diagram_*.py)
  - Server-Sent Events for instant browser refresh
  - YAML-backed persistence for canonical v3 frame edits

Usage:
    python scripts/preview_server.py                     # all diagrams, port 8100
    python scripts/preview_server.py --slug aws-hld      # single diagram
    python scripts/preview_server.py --port 8200
    python scripts/preview_server.py --grid               # show grid overlay
"""

from __future__ import annotations

import argparse
import http.server
import importlib
import json
import math
import os
import pathlib
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from urllib.parse import unquote, urlparse

from frame_yaml_persistence import persist_override_payload_to_yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
OUTPUT_SVG = ROOT / "diagrams" / "2.output" / "svg"
V3_OUTPUT = ROOT / "diagrams" / "2.output" / "v3"
V3_SVG = V3_OUTPUT / "svg"
V3_DRAWIO = V3_OUTPUT / "draw.io"
DEFINITIONS_DIR = SCRIPTS / "diagrams"
FRAMES_DIR = pathlib.Path(os.environ.get("DG_FRAMES_DIR") or (SCRIPTS / "diagrams" / "frames"))

WATCH_PATHS = [
    DEFINITIONS_DIR,
    FRAMES_DIR,
    SCRIPTS / "frame_loader.py",
    SCRIPTS / "frame_model.py",
    SCRIPTS / "layout_v3.py",
    SCRIPTS / "diagram_layout.py",
    SCRIPTS / "diagram_render_svg.py",
    SCRIPTS / "diagram_shared.py",
    SCRIPTS / "preview",
]

_rebuild_generation = 0
_rebuild_lock = threading.Lock()
_last_rebuild_error: str | None = None
_layout_cache: dict[str, object] = {}
_force_sessions: dict[str, object] = {}


def _load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _default_preview_port() -> int:
    raw_port = os.environ.get("DG_PREVIEW_PORT") or os.environ.get("PREVIEW_PORT") or "8100"
    try:
        return int(raw_port)
    except ValueError:
        return 8100


def _collect_mtimes() -> dict[str, float]:
    mtimes: dict[str, float] = {}
    for p in WATCH_PATHS:
        if p.is_file():
            mtimes[str(p)] = p.stat().st_mtime
        elif p.is_dir():
            for ext in ("*.py", "*.yaml", "*.yml", "*.json", "*.html", "*.css", "*.js"):
                for f in p.rglob(ext):
                    mtimes[str(f)] = f.stat().st_mtime
    return mtimes


def _list_diagrams() -> list[str]:
    return []


def _list_v3_diagrams() -> list[str]:
    slugs = []
    if V3_SVG.exists():
        for f in sorted(V3_SVG.glob("*-onbrand-v3.svg")):
            slug = f.stem.replace("-onbrand-v3", "")
            slugs.append(slug)
    # Also discover native frame YAML definitions
    if FRAMES_DIR.exists():
        for f in sorted(FRAMES_DIR.glob("*.yaml")):
            slug = f.stem
            if slug not in slugs:
                slugs.append(slug)
    return slugs


def _list_autolayout_diagrams() -> list[str]:
    """Return slugs that have a native frame YAML (v3 autolayout)."""
    if not FRAMES_DIR.exists():
        return []
    return sorted(f.stem for f in FRAMES_DIR.glob("*.yaml"))


# Slug/filename safety: only allow alphanumeric, hyphens, underscores, and dots.
import re as _re
_SAFE_SLUG_RE = _re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def _is_safe_slug(slug: str) -> bool:
    """Reject slugs that could traverse paths or inject into filenames.

    Allows the ``v3:`` engine prefix — strips it before checking the
    actual slug component.
    """
    if not slug:
        return False
    # Strip the v3: engine prefix before validating
    check = slug[3:] if slug.startswith("v3:") else slug
    return bool(check and _SAFE_SLUG_RE.match(check) and ".." not in check)


def _rebuild(grid: bool = False) -> bool:
    global _last_rebuild_error, _layout_cache, _viewer_template, _force_template, _unified_template, _force_sessions
    _layout_cache.clear()
    _force_sessions.clear()
    _viewer_template = None
    _force_template = None
    _unified_template = None
    # Reload engine modules so code changes take effect without a
    # full server restart.
    for mod_name in ("frame_model", "frame_loader", "layout_v3",
                     "diagram_render_svg", "diagram_layout", "diagram_shared"):
        if mod_name in sys.modules:
            importlib.reload(sys.modules[mod_name])
    _last_rebuild_error = None
    return True


def _get_layout_result(slug: str, engine: str = "v3"):
    # Strip v3: prefix if present
    if slug.startswith("v3:"):
        slug = slug[3:]
    cache_key = f"{slug}:v3"
    if cache_key in _layout_cache:
        return _layout_cache[cache_key]
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))

        frame_yaml = FRAMES_DIR / (slug + ".yaml")
        if frame_yaml.exists():
            from frame_loader import load_frame_yaml
            from layout_v3 import layout_frame_diagram
            frame_diagram = load_frame_yaml(frame_yaml)
            result = layout_frame_diagram(frame_diagram)
            _layout_cache[cache_key] = result
            return result
        return None
    except Exception:
        import traceback; traceback.print_exc()
        return None

def _get_component_tree(slug: str) -> list[dict]:
    result = _get_layout_result(slug)
    if result and hasattr(result, "component_tree"):
        return [asdict(ci) for ci in result.component_tree]
    return []


def _get_grid_info(slug: str) -> dict | None:
    result = _get_layout_result(slug)
    if result and result.grid_info:
        return asdict(result.grid_info)
    return None


def _load_frame_diagram(slug: str):
    """Load the raw FrameDiagram for a slug (before layout)."""
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))
        import copy

        frame_yaml = FRAMES_DIR / (slug + ".yaml")
        if frame_yaml.exists():
            from frame_loader import load_frame_yaml
            return copy.deepcopy(load_frame_yaml(frame_yaml))
        return None
    except Exception:
        import traceback; traceback.print_exc()
        return None


def _serialize_line(line) -> dict:
    """Serialize a Line dataclass to a JSON-safe dict."""
    return {
        "content": line.content,
        "size": line.size,
        "weight": line.weight,
        "fill": line.fill,
        "smallCaps": getattr(line, "small_caps", False),
        "letterSpacing": getattr(line, "letter_spacing", None),
        "lineStep": getattr(line, "line_step", None),
        "fontFamily": getattr(line, "font_family", None),
    }


def _serialize_arrow(arrow) -> dict:
    """Serialize an Arrow dataclass to a JSON-safe dict."""
    return {
        "source": arrow.source,
        "target": arrow.target,
        "id": getattr(arrow, "id", None),
        "color": getattr(arrow, "color", "#E95420"),
    }


def _serialize_frame(frame) -> dict:
    """Recursively serialize a Frame to a JSON-safe dict for the TS layout engine."""
    return {
        "id": frame.id,
        "direction": frame.direction.name,
        "gap": frame.gap,
        "padding": frame.padding,
        "paddingTop": frame.padding_top,
        "paddingRight": frame.padding_right,
        "paddingBottom": frame.padding_bottom,
        "paddingLeft": frame.padding_left,
        "align": frame.align.name,
        "wrap": frame.wrap,
        "sizingW": frame.sizing_w.name,
        "sizingH": frame.sizing_h.name,
        "fillWeight": frame.fill_weight,
        "width": frame.width,
        "height": frame.height,
        "minWidth": frame.min_width,
        "maxWidth": frame.max_width,
        "minHeight": frame.min_height,
        "maxHeight": frame.max_height,
        "fill": frame.fill.value,
        "border": frame.border.name,
        "heading": _serialize_line(frame.heading) if frame.heading else None,
        "icon": frame.icon,
        "iconFill": frame.icon_fill,
        "label": [_serialize_line(ln) for ln in frame.label],
        "role": frame.role,
        "level": frame.level,
        "children": [_serialize_frame(child) for child in frame.children],
        "positionType": frame.position_type,
        "x": frame.x,
        "y": frame.y,
    }


def _serialize_frame_diagram(diagram) -> dict:
    """Serialize a FrameDiagram for the TS layout engine."""
    return {
        "title": diagram.title,
        "root": _serialize_frame(diagram.root),
        "arrows": [_serialize_arrow(a) for a in diagram.arrows],
        "gridCols": diagram.grid_cols,
        "gridColGap": diagram.grid_col_gap,
        "gridRowGap": diagram.grid_row_gap,
        "gridOuterMargin": diagram.grid_outer_margin,
        "overlays": [{"id": o.id, "label": o.label, "members": o.members} for o in diagram.overlays],
    }


def _save_overrides(slug: str, data: dict) -> None:
    frame_path = FRAMES_DIR / f"{slug}.yaml"
    if not frame_path.exists():
        raise ValueError(f"Unknown frame slug: {slug}")
    persist_override_payload_to_yaml(frame_path, data)
    _layout_cache.pop(f"{slug}:v3", None)


def _watch_loop(grid: bool = False, interval: float = 0.5):
    global _rebuild_generation, _viewer_template, _force_template, _unified_template
    prev_mtimes = _collect_mtimes()
    while True:
        time.sleep(interval)
        curr_mtimes = _collect_mtimes()
        if curr_mtimes != prev_mtimes:
            prev_mtimes = curr_mtimes
            # Invalidate cached viewer template so HTML/CSS/JS changes are picked up
            _viewer_template = None
            _force_template = None
            _unified_template = None
            with _rebuild_lock:
                ok = _rebuild(grid=grid)
                _rebuild_generation += 1
                status = "ok" if ok else "error"
                print(f"  [preview] rebuild #{_rebuild_generation} ({status})")


# ---------------------------------------------------------------------------
# Viewer HTML – serves static template with config injection
# ---------------------------------------------------------------------------

PREVIEW_DIR = pathlib.Path(__file__).resolve().parent / "preview"
BF_VENDOR_ROOT = ROOT / "assets" / "baseline-foundry"
BF_VENDOR_OS_CSS = BF_VENDOR_ROOT / "os" / "styles.css"
BF_VENDOR_FONT_DIR = BF_VENDOR_ROOT / "fonts"
_viewer_template: str | None = None
_force_template: str | None = None
_unified_template: str | None = None

# Reference-image directories (rough input sketches)
_INPUT_DIRS = [
    ROOT / "diagrams" / "1.input",
]

# Slug → input sketch mapping (mirrors build_compare_pages.py PAIRS)
_REFERENCE_MAP: dict[str, str] = {
    "memory-wall": "redo-this-image-onbrand.png",
    "rise-of-inference-economy": "image.png",
    "attention-qkv": "image 3.png",
    "logic-data-vram": "image 4.png",
    "gpu-waiting-scheduler": "image 5.png",
    "request-to-hardware-stack": "image 6.png",
    "inference-snaps": "image 7.png",
    "example-arrow-label-separator": "example-arrow-label-separator-rough.svg",
    "force-stakeholders": "force/IMG_3229.jpg",
    "android-graphics-stack": "android/android-graphics-stack.png",
    "android-custom-to-cloud": "android/image.png",
    "android-security-comparison": "android/image1.png",
    "android-container-vs-vm": "android/image2.png",
}


def _list_force_examples() -> list[str]:
    try:
        import force_preview

        return force_preview.list_force_examples()
    except Exception:
        return []


def _build_preview_nav_options(current_path: str) -> str:
    sections: list[str] = []

    autolayout_options = "".join(
        f'<option value="/view/v3:{slug}"{" selected" if current_path == f"/view/v3:{slug}" else ""}>{slug}</option>'
        for slug in _list_autolayout_diagrams()
    )
    if autolayout_options:
        sections.append(f'<optgroup label="Autolayout">{autolayout_options}</optgroup>')

    return "".join(sections)


def _build_browse_nav(current_path: str) -> str:
    """Build the left-sidebar browse panel HTML."""
    autolayout = _list_autolayout_diagrams()
    if not autolayout:
        return ""
    items = "".join(
        f'<li><a class="dg-browse-link{" is-active" if current_path == f"/view/v3:{s}" else ""}" href="/view/v3:{s}">{s}</a></li>'
        for s in autolayout
    )
    return f'<div class="dg-browse-group"><h3 class="dg-browse-heading">Autolayout</h3><ul class="dg-browse-list">{items}</ul></div>'


def _get_force_state(slug: str, *, reset: bool = False):
    global _force_sessions
    import force_preview

    if reset and slug in _force_sessions:
        _force_sessions[slug] = force_preview.reset_force_state(_force_sessions[slug])
    elif reset or slug not in _force_sessions:
        _force_sessions[slug] = force_preview.create_force_state(slug)
    return _force_sessions[slug]


def _get_force_snapshot(slug: str, *, reset: bool = False, snap: bool = False) -> dict | None:
    try:
        import force_preview

        state = _get_force_state(slug, reset=reset)
        if snap:
            return force_preview.export_force_snapshot(state)
        return force_preview.get_force_snapshot(state)
    except Exception:
        import traceback

        traceback.print_exc()
        return None


def _tick_force_snapshot(slug: str, iterations: int | None = None) -> dict | None:
    try:
        import force_preview

        state = _get_force_state(slug)
        return force_preview.tick_force_state(state, iterations=iterations)
    except Exception:
        import traceback

        traceback.print_exc()
        return None


def _find_reference_image(slug: str) -> pathlib.Path | None:
    """Find the rough input sketch for a diagram slug."""
    filename = _REFERENCE_MAP.get(slug)
    if not filename:
        try:
            import force_preview

            if slug in force_preview.list_force_examples():
                spec = force_preview.load_force_spec(slug)
                filename = spec.get("reference_image")
        except Exception:
            filename = None
    if not filename:
        return None
    for d in _INPUT_DIRS:
        p = d / filename
        if p.exists():
            return p
    return None



def _resolve_bf_preview_assets() -> tuple[pathlib.Path, pathlib.Path] | None:
    if BF_VENDOR_OS_CSS.exists() and BF_VENDOR_FONT_DIR.exists():
        return BF_VENDOR_OS_CSS, BF_VENDOR_FONT_DIR

    return None


def _has_bf_preview_assets() -> bool:
    return _resolve_bf_preview_assets() is not None


def _get_viewer_template() -> str:
    global _viewer_template
    if _viewer_template is None:
        _viewer_template = (PREVIEW_DIR / "viewer.html").read_text(encoding="utf-8")
    return _viewer_template


def _get_force_template() -> str:
    global _force_template
    if _force_template is None:
        _force_template = (PREVIEW_DIR / "force-viewer.html").read_text(encoding="utf-8")
    return _force_template


def _get_unified_template() -> str:
    global _unified_template
    if _unified_template is None:
        _unified_template = (PREVIEW_DIR / "viewer-unified.html").read_text(encoding="utf-8")
    return _unified_template


def _build_viewer_html(slug: str, all_slugs: list[str], grid: bool) -> str:
    view_path = f"/view/{slug}"
    nav_options = _build_preview_nav_options(view_path)
    browse_nav = _build_browse_nav(view_path)
    from diagram_shared import ARROW_HEAD_LENGTH, ARROW_HEAD_HALF_WIDTH, ICON_SIZE, GRID_GUTTER, INSET
    is_v3 = True
    real_slug = slug[3:] if slug.startswith("v3:") else slug
    engine = "v3"
    has_ref = _find_reference_image(real_slug) is not None
    config_script = (
        f"window.__DG_CONFIG = {{"
        f'"slug":"{real_slug}",'
        f'"engine":"{engine}",'
        f'"grid":{str(grid).lower()},'
        f'"inset":{INSET},'
        f'"head_len":{ARROW_HEAD_LENGTH},'
        f'"head_half":{ARROW_HEAD_HALF_WIDTH},'
        f'"icon_size":{ICON_SIZE},'
        f'"col_gap":{GRID_GUTTER},'
        f'"has_reference":{str(has_ref).lower()}'
        f"}};"
    )
    html = _get_unified_template()
    html = html.replace("%TITLE%", f"{slug} – diagram preview")
    html = html.replace(
        "%BF_STYLES%",
        '<link rel="stylesheet" href="/preview/bf-os.css">' if _has_bf_preview_assets() else "",
    )
    html = html.replace("%MODE%", "grid")
    html = html.replace("%NAV_OPTIONS%", nav_options)
    html = html.replace("%BROWSE_NAV%", browse_nav)
    html = html.replace("%INSPECTOR_EMPTY%", "Click a component to inspect it.")
    html = html.replace(
        "%MODE_SCRIPTS%",
        '<script src="/preview/layout-engine.js"></script>\n'
        '<script src="/preview/layout-bridge.js"></script>\n'
        '<script src="/preview/component-model.js"></script>\n'
        '<script src="/preview/constraints.js"></script>\n'
        '<script src="/preview/editor.js"></script>',
    )
    html = html.replace("%CONFIG_SCRIPT%", config_script)
    return html


def _build_force_viewer_html(slug: str, all_slugs: list[str]) -> str:
    view_path = f"/force/view/{slug}"
    nav_options = _build_preview_nav_options(view_path)
    browse_nav = _build_browse_nav(view_path)
    from diagram_shared import ARROW_HEAD_HALF_WIDTH, ARROW_HEAD_LENGTH, BODY_LINE_STEP, INSET

    config_script = (
        f'window.__DG_FORCE_CONFIG = {{'
        f'"slug":"{slug}",'
        f'"inset":{INSET},'
        f'"body_line_step":{BODY_LINE_STEP},'
        f'"head_len":{ARROW_HEAD_LENGTH},'
        f'"head_half":{ARROW_HEAD_HALF_WIDTH}'
        f'}};'
    )
    html = _get_unified_template()
    html = html.replace("%TITLE%", f"{slug} – force preview")
    html = html.replace(
        "%BF_STYLES%",
        '<link rel="stylesheet" href="/preview/bf-os.css">' if _has_bf_preview_assets() else "",
    )
    html = html.replace("%MODE%", "force")
    html = html.replace("%NAV_OPTIONS%", nav_options)
    html = html.replace("%BROWSE_NAV%", browse_nav)
    html = html.replace("%INSPECTOR_EMPTY%", "Click a node to select it.")
    html = html.replace(
        "%MODE_SCRIPTS%",
        '<script src="/preview/force.js"></script>',
    )
    html = html.replace("%CONFIG_SCRIPT%", config_script)
    return html


INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Preview index</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #1a1a1a; color: #e0e0e0; }
    .page { padding: 16px 24px 32px; }
    .section { margin-top: 20px; }
    h1 { font-size: 16px; font-weight: 600; }
    h2 { font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .nav { display: flex; flex-wrap: wrap; gap: 8px; }
  .nav a { color: #6cc; text-decoration: none; padding: 6px 12px; border-radius: 4px;
           background: #2a2a2a; font-size: 14px; }
  .nav a:hover { background: #3a3a3a; }
</style>
</head>
<body>
<div class="page">
    <h1>Preview index</h1>
    %AUTOLAYOUT_SECTION%
    <section class="section">
        <h2>Diagrams</h2>
        <div class="nav">%DIAGRAM_LINKS%</div>
    </section>
    %FORCE_SECTION%
    %V3_SECTION%
</div>
</body>
</html>"""

V3_INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>v3 Frame engine output</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #1a1a1a; color: #e0e0e0; }
  .page { padding: 16px 24px 32px; }
  h1 { font-size: 16px; font-weight: 600; }
  h2 { font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .back { color: #6cc; text-decoration: none; font-size: 13px; margin-bottom: 12px; display: inline-block; }
  .nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .nav a { color: #6cc; text-decoration: none; padding: 6px 12px; border-radius: 4px;
           background: #2a2a2a; font-size: 14px; }
  .nav a:hover { background: #3a3a3a; }
</style>
</head>
<body>
<div class="page">
    <a class="back" href="/">&larr; Back to index</a>
    <h1>v3 Frame engine output</h1>
    <section>
        <h2>SVG</h2>
        <div class="nav">%SVG_LINKS%</div>
    </section>
    <section style="margin-top:20px">
        <h2>Draw.io</h2>
        <div class="nav">%DRAWIO_LINKS%</div>
    </section>
</div>
</body>
</html>"""

V3_VIEWER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%SLUG% (v3)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #f5f5f5; }
  .toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 16px;
             background: #1a1a1a; color: #e0e0e0; font-size: 13px; }
  .toolbar a { color: #6cc; text-decoration: none; }
  .toolbar .title { font-weight: 600; }
  .toolbar .nav-links { display: flex; gap: 6px; margin-left: auto; }
  .toolbar .nav-links a { padding: 4px 8px; border-radius: 3px; background: #2a2a2a; }
  .toolbar .nav-links a:hover { background: #3a3a3a; }
  .canvas { display: flex; justify-content: center; padding: 24px; }
  .canvas img { max-width: 100%%; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
</style>
</head>
<body>
<div class="toolbar">
    <a href="/v3">&larr; v3 index</a>
    <span class="title">%SLUG%</span>
    <span style="color:#888">(v3 frame engine)</span>
    <div class="nav-links">%NAV_LINKS%</div>
</div>
<div class="canvas">
    <img src="/v3/svg/%SLUG%-onbrand-v3.svg" alt="%SLUG%">
</div>
</body>
</html>"""


FORCE_INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Force preview</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #121826; color: #e8edf6; }
    .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px 48px; }
    h1 { font-size: 28px; font-weight: 600; margin-bottom: 12px; }
    p { color: #9fb0c8; margin-bottom: 24px; max-width: 64ch; }
    .nav { display: grid; gap: 12px; }
    .nav a { color: #f2f5f9; text-decoration: none; padding: 14px 16px; border-radius: 14px; background: #1d2740; border: 1px solid #31415f; }
    .nav a:hover { background: #24304d; }
    .back { display: inline-block; margin-top: 24px; color: #9fb0c8; }
</style>
</head>
<body>
    <div class="page">
        <h1>Force previews</h1>
        <p>Live Python-solver demos that tick over time, can be paused, and can export the current settled state.</p>
        <div class="nav">%LINKS%</div>
        <a class="back" href="/">&larr; all previews</a>
    </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class PreviewHandler(http.server.BaseHTTPRequestHandler):
    grid: bool = False

    def log_message(self, fmt, *args):
        pass

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            self.close_connection = True
        except OSError as exc:
            if getattr(exc, "winerror", None) in (10053, 10054):
                self.close_connection = True
                return
            raise

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/":
            self._serve_index()
        elif path == "/force":
            self._serve_force_index()
        elif path == "/events":
            self._serve_sse()
        elif path == "/preview/bf-os.css":
            self._serve_bf_os_css()
        elif path.startswith("/preview/bf-fonts/"):
            self._serve_bf_font(path[len("/preview/bf-fonts/"):])
        elif path == "/preview/layout-engine.js":
            self._serve_layout_engine_bundle()
        elif path == "/preview/layout-engine-harfbuzz.js":
            self._serve_layout_engine_harfbuzz_bundle()
        elif path == "/preview/harfbuzz.wasm":
            self._serve_layout_engine_harfbuzz_wasm()
        elif path == "/preview/layout-font.ttf":
            self._serve_layout_engine_font()
        elif path.startswith("/preview/"):
            self._serve_static(path[9:])
        elif path.startswith("/svg/"):
            self._serve_svg(path[5:])
        elif path.startswith("/force/view/"):
            self._serve_force_viewer(path[12:])
        elif path.startswith("/view/"):
            self._serve_viewer(path[6:])
        elif path.startswith("/api/force-export/"):
            self._serve_force_export(path[18:])
        elif path.startswith("/api/force/"):
            self._serve_force_get(path[11:])
        elif path.startswith("/api/tree/"):
            self._serve_tree(path[10:])
        elif path.startswith("/api/frame-tree/"):
            self._serve_frame_tree(path[16:])
        elif path.startswith("/api/grid/"):
            self._serve_grid(path[10:])
        elif path.startswith("/api/icon/"):
            self._serve_icon(path[10:])
        elif path.startswith("/reference/"):
            self._serve_reference_image(path[11:])
        elif path == "/v3":
            self._serve_v3_index()
        elif path.startswith("/v3/view/"):
            self._serve_v3_viewer(path[9:])
        elif path.startswith("/v3/svg/"):
            self._serve_v3_svg(path[8:])
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if path.startswith("/api/overrides/"):
            self._serve_overrides_post(path[15:])
        elif path.startswith("/api/force-reset/"):
            self._serve_force_reset(path[17:])
        elif path.startswith("/api/force-save/"):
            self._serve_force_save(path[16:])
        elif path.startswith("/api/force-node/"):
            self._serve_force_node_update(path[16:])
        elif path.startswith("/api/force-tick/"):
            self._serve_force_tick(path[16:])
        elif path.startswith("/api/force-params/"):
            self._serve_force_params(path[18:])
        else:
            self.send_error(404)

    def _serve_index(self):
        slugs = _list_diagrams()
        diagram_links = "\n  ".join(f'<a href="/view/{s}">{s}</a>' for s in slugs)
        force_slugs = _list_force_examples()
        force_section = ""
        if force_slugs:
            force_links = "\n  ".join(f'<a href="/force/view/{s}">{s}</a>' for s in force_slugs)
            force_section = (
                '<section class="section">'
                '<h2>Force demos</h2>'
                f'<div class="nav">{force_links}</div>'
                '</section>'
            )
        autolayout_slugs = _list_autolayout_diagrams()
        autolayout_section = ""
        if autolayout_slugs:
            autolayout_links = "\n  ".join(f'<a href="/view/v3:{s}">{s}</a>' for s in autolayout_slugs)
            autolayout_section = (
                '<section class="section">'
                '<h2>Autolayout</h2>'
                f'<div class="nav">{autolayout_links}</div>'
                '</section>'
            )
        v3_slugs = _list_v3_diagrams()
        v3_section = ""
        if v3_slugs:
            v3_section = (
                '<section class="section">'
                '<h2>v3 Frame engine</h2>'
                '<div class="nav"><a href="/v3">Browse v3 output (' + str(len(v3_slugs)) + ' diagrams)</a></div>'
                '</section>'
            )
        html = INDEX_HTML.replace("%DIAGRAM_LINKS%", diagram_links)
        html = html.replace("%AUTOLAYOUT_SECTION%", autolayout_section)
        html = html.replace("%FORCE_SECTION%", force_section)
        html = html.replace("%V3_SECTION%", v3_section)
        self._respond(200, "text/html", html.encode())

    def _serve_force_index(self):
        slugs = _list_force_examples()
        if not slugs:
            self.send_error(404, "No force previews found")
            return
        links = "\n  ".join(f'<a href="/force/view/{s}">{s}</a>' for s in slugs)
        self._respond(200, "text/html", FORCE_INDEX_HTML.replace("%LINKS%", links).encode())

    def _serve_v3_index(self):
        slugs = _list_v3_diagrams()
        if not slugs:
            self.send_error(404, "No v3 outputs found. Run: python build_v2.py --engine v3")
            return
        svg_links = "\n  ".join(f'<a href="/v3/view/{s}">{s}</a>' for s in slugs)
        drawio_files = sorted(V3_DRAWIO.glob("*-v3.drawio")) if V3_DRAWIO.exists() else []
        drawio_links = "\n  ".join(
            f'<a href="/v3/svg/{f.name}" download>{f.stem.replace("-onbrand-v3", "")}</a>'
            for f in drawio_files
        )
        html = V3_INDEX_HTML.replace("%SVG_LINKS%", svg_links)
        html = html.replace("%DRAWIO_LINKS%", drawio_links or "<span style='color:#888'>none</span>")
        self._respond(200, "text/html", html.encode())

    def _serve_v3_viewer(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        slugs = _list_v3_diagrams()
        if slug not in slugs:
            self.send_error(404, f"Unknown v3 diagram: {slug}")
            return
        nav_links = "\n".join(f'<a href="/v3/view/{s}">{s}</a>' for s in slugs)
        html = V3_VIEWER_HTML.replace("%SLUG%", slug).replace("%NAV_LINKS%", nav_links)
        self._respond(200, "text/html", html.encode())

    def _serve_v3_svg(self, filename: str):
        safe_name = pathlib.PurePosixPath(filename).name
        if not _is_safe_slug(safe_name):
            self.send_error(400, "Invalid filename")
            return
        # Serve from SVG or draw.io subfolder
        svg_path = V3_SVG / safe_name
        drawio_path = V3_DRAWIO / safe_name
        if svg_path.exists():
            self._respond(200, "image/svg+xml", svg_path.read_bytes())
        elif drawio_path.exists():
            self._respond(200, "application/xml", drawio_path.read_bytes())
        else:
            self.send_error(404)

    def _serve_static(self, filename: str):
        """Serve static files from scripts/preview/ (editor.css, editor.js)."""
        CONTENT_TYPES = {".css": "text/css", ".js": "application/javascript", ".html": "text/html"}
        safe_name = pathlib.PurePosixPath(filename).name  # prevent path traversal
        static_path = PREVIEW_DIR / safe_name
        if not static_path.exists():
            self.send_error(404)
            return
        ext = static_path.suffix
        ct = CONTENT_TYPES.get(ext, "application/octet-stream")
        self._respond(200, ct, static_path.read_bytes())

    def _serve_bf_os_css(self):
        assets = _resolve_bf_preview_assets()
        if assets is None:
            self.send_error(404)
            return
        css_path, _ = assets
        css_text = css_path.read_text(encoding="utf-8")
        css_text = css_text.replace("../../../assets/fonts/", "/preview/bf-fonts/")
        self._respond(200, "text/css", css_text.encode("utf-8"))

    def _serve_bf_font(self, filename: str):
        assets = _resolve_bf_preview_assets()
        if assets is None:
            self.send_error(404)
            return
        _, font_dir = assets
        safe_name = pathlib.PurePosixPath(unquote(filename)).name
        font_path = font_dir / safe_name
        if not font_path.exists():
            self.send_error(404)
            return
        content_types = {
            ".ttf": "font/ttf",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
        }
        self._respond(200, content_types.get(font_path.suffix.lower(), "application/octet-stream"), font_path.read_bytes())

    def _serve_viewer(self, slug: str):
        # v3 diagrams use "v3:<slug>" in the URL
        is_v3 = slug.startswith("v3:")
        real_slug = slug[3:] if is_v3 else slug
        if not _is_safe_slug(real_slug):
            self.send_error(400, "Invalid slug")
            return
        if is_v3:
            if real_slug not in _list_v3_diagrams():
                self.send_error(404, f"Unknown v3 diagram: {real_slug}")
                return
        else:
            if real_slug not in _list_diagrams():
                self.send_error(404, f"Unknown diagram: {real_slug}")
                return
        html = _build_viewer_html(slug, _list_diagrams(), self.grid)
        self._respond(200, "text/html", html.encode())

    def _serve_force_viewer(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        slugs = _list_force_examples()
        if slug not in slugs:
            self.send_error(404, f"Unknown force example: {slug}")
            return
        html = _build_force_viewer_html(slug, slugs)
        self._respond(200, "text/html", html.encode())

    def _serve_reference_image(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        ref_path = _find_reference_image(slug)
        if not ref_path or not ref_path.exists():
            self.send_error(404, "No reference image")
            return
        ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                  ".svg": "image/svg+xml", ".webp": "image/webp"}
        ct = ct_map.get(ref_path.suffix.lower(), "application/octet-stream")
        self._respond(200, ct, ref_path.read_bytes())

    def _serve_svg(self, filename: str):
        safe_name = pathlib.PurePosixPath(filename).name  # strip traversal

        # Handle v3-prefixed filenames: "v3:<slug>-onbrand-v3.svg"
        if safe_name.startswith("v3:"):
            slug = safe_name[3:]  # strip "v3:"
            # Remove "-onbrand-v3.svg" suffix to get the bare slug
            for suffix in ("-onbrand-v3.svg", "-onbrand-v3-grid.svg"):
                if slug.endswith(suffix):
                    slug = slug[:-len(suffix)]
                    break
            if not _is_safe_slug(slug):
                self.send_error(400, "Invalid slug")
                return
            # Prefer live rendering when a frame YAML exists (avoids stale pre-built files)
            frame_yaml = FRAMES_DIR / (slug + ".yaml")
            if not frame_yaml.exists():
                prebuilt = V3_SVG / f"{slug}-onbrand-v3.svg"
                if prebuilt.exists():
                    self._respond(200, "image/svg+xml", prebuilt.read_bytes())
                    return
            # Generate on-the-fly from layout engine
            result = _get_layout_result(slug, engine="v3")
            if result is None:
                self.send_error(404, f"Cannot layout v3 diagram: {slug}")
                return
            import diagram_render_svg
            svg_str = diagram_render_svg.render_svg(result)
            self._respond(200, "image/svg+xml", svg_str.encode("utf-8"))
            return

        if not _is_safe_slug(safe_name):
            self.send_error(400, "Invalid filename")
            return

        # Extract slug + engine from filename suffix
        slug = safe_name
        engine = None
        for suffix in ("-onbrand-v3.svg", "-onbrand-v3-grid.svg"):
            if slug.endswith(suffix):
                slug = slug[:-len(suffix)]
                engine = "v3"
                break

        # For v3 frame YAML diagrams, always prefer live rendering
        if engine == "v3":
            frame_yaml = FRAMES_DIR / (slug + ".yaml")
            if frame_yaml.exists():
                result = _get_layout_result(slug, engine="v3")
                if result is not None:
                    import diagram_render_svg
                    svg_str = diagram_render_svg.render_svg(result)
                    self._respond(200, "image/svg+xml", svg_str.encode("utf-8"))
                    return

        # Try v2 output first, then v3 pre-built
        svg_path = OUTPUT_SVG / safe_name
        if not svg_path.exists():
            svg_path = V3_SVG / safe_name
        if svg_path.exists():
            self._respond(200, "image/svg+xml", svg_path.read_bytes())
            return
        # No pre-built file — try on-the-fly v3 rendering
        if engine == "v3":
            result = _get_layout_result(slug, engine="v3")
            if result is not None:
                import diagram_render_svg
                svg_str = diagram_render_svg.render_svg(result)
                self._respond(200, "image/svg+xml", svg_str.encode("utf-8"))
                return
        self.send_error(404)

    def _serve_tree(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        tree = _get_component_tree(slug)
        self._respond(200, "application/json", json.dumps(tree, indent=2).encode())

    def _serve_frame_tree(self, slug: str):
        """Serve the raw Frame tree JSON for client-side layout."""
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        diagram = _load_frame_diagram(slug)
        if diagram is None:
            self.send_error(404, "Frame diagram not found")
            return
        data = _serialize_frame_diagram(diagram)
        self._respond(200, "application/json", json.dumps(data).encode())

    def _serve_layout_engine_bundle(self):
        """Serve the TS layout engine IIFE bundle."""
        bundle_path = ROOT / "packages" / "layout-engine" / "dist" / "layout-engine.iife.js"
        if not bundle_path.exists():
            self.send_error(404, "Layout engine bundle not built")
            return
        self._respond(200, "application/javascript", bundle_path.read_bytes())

    def _serve_layout_engine_harfbuzz_bundle(self):
        """Serve the browser ESM bundle for the HarfBuzz text adapter."""
        bundle_path = ROOT / "packages" / "layout-engine" / "dist" / "layout-engine-harfbuzz.js"
        if not bundle_path.exists():
            self.send_error(404, "HarfBuzz text adapter bundle not built")
            return
        self._respond(200, "application/javascript", bundle_path.read_bytes())

    def _serve_layout_engine_harfbuzz_wasm(self):
        wasm_path = ROOT / "packages" / "layout-engine" / "dist" / "harfbuzz.wasm"
        if not wasm_path.exists():
            self.send_error(404, "HarfBuzz wasm not built")
            return
        self._respond(200, "application/wasm", wasm_path.read_bytes())

    def _serve_layout_engine_font(self):
        font_path = ROOT / "assets" / "UbuntuSans[wdth,wght].ttf"
        if not font_path.exists():
            self.send_error(404, "Layout font not found")
            return
        self._respond(200, "font/ttf", font_path.read_bytes())

    def _serve_grid(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        info = _get_grid_info(slug)
        if info is None:
            self._respond(200, "application/json", b"null")
        else:
            self._respond(200, "application/json", json.dumps(info, indent=2).encode())

    def _serve_overrides_post(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 1_000_000:  # 1MB limit
            self.send_error(413, "Payload too large")
            return
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        if not isinstance(data, dict):
            self.send_error(400, "Expected JSON object")
            return
        try:
            _save_overrides(slug, data)
        except ValueError as exc:
            self._respond(400, "text/plain; charset=utf-8", str(exc).encode("utf-8"))
            return
        except OSError as exc:
            self._respond(500, "text/plain; charset=utf-8", f"Failed to save YAML: {exc}".encode("utf-8"))
            return
        self._respond(200, "application/json", b'{"ok":true}')

    def _serve_force_get(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return
        result = _get_force_snapshot(slug)
        if result is None:
            self.send_error(500, "Force preview failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_reset(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return
        result = _get_force_snapshot(slug, reset=True)
        if result is None:
            self.send_error(500, "Force reset failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_tick(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        iterations = params.get("iterations")
        if iterations is not None:
            iterations = int(iterations)
        result = _tick_force_snapshot(slug, iterations=iterations)
        if result is None:
            self.send_error(500, "Force tick failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_node_update(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        node_id = params.get("node_id")
        if not isinstance(node_id, str) or not _is_safe_slug(node_id):
            self.send_error(400, "Invalid node_id")
            return

        try:
            x = None if "x" not in params or params.get("x") is None else float(params.get("x"))
            y = None if "y" not in params or params.get("y") is None else float(params.get("y"))
        except (TypeError, ValueError):
            self.send_error(400, "Invalid node position")
            return

        try:
            w = None if "width" not in params or params.get("width") is None else float(params.get("width"))
            h = None if "height" not in params or params.get("height") is None else float(params.get("height"))
        except (TypeError, ValueError):
            self.send_error(400, "Invalid node dimensions")
            return

        if x is not None and not math.isfinite(x):
            self.send_error(400, "Invalid x position")
            return
        if y is not None and not math.isfinite(y):
            self.send_error(400, "Invalid y position")
            return
        if w is not None and (not math.isfinite(w) or w <= 0):
            self.send_error(400, "Invalid width")
            return
        if h is not None and (not math.isfinite(h) or h <= 0):
            self.send_error(400, "Invalid height")
            return

        # Validate label if provided
        _LABEL_UNSET = object()
        label_val = _LABEL_UNSET
        if "label" in params:
            raw_label = params["label"]
            if raw_label is None or raw_label == []:
                label_val = None
            elif isinstance(raw_label, list) and all(isinstance(ln, str) for ln in raw_label) and len(raw_label) <= 20:
                label_val = raw_label
            else:
                self.send_error(400, "Invalid label: must be a list of strings (max 20)")
                return

        try:
            import force_preview

            state = _get_force_state(slug)
            result = force_preview.update_force_node(
                state,
                node_id,
                pinned=(bool(params["pinned"]) if "pinned" in params else None),
                x=x,
                y=y,
                width=w,
                height=h,
                style=(params["style"] if "style" in params else force_preview.STYLE_UNSET),
                label=(label_val if label_val is not _LABEL_UNSET else force_preview.STYLE_UNSET),
            )
        except KeyError:
            self.send_error(404, f"Unknown force node: {node_id}")
            return
        except ValueError as exc:
            self.send_error(400, str(exc))
            return
        except Exception:
            import traceback

            traceback.print_exc()
            self.send_error(500, "Force node update failed")
            return

        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_save(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return

        try:
            import force_preview

            state = _get_force_state(slug)
            force_preview.save_force_overrides(state)
        except Exception:
            import traceback

            traceback.print_exc()
            self.send_error(500, "Force save failed")
            return

        self._respond(200, "application/json", b'{"ok":true}')

    def _serve_force_params(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b"{}"
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        try:
            import force_preview
            state = _get_force_state(slug)
            result = force_preview.update_simulation_params(state, params)
        except Exception:
            import traceback
            traceback.print_exc()
            self.send_error(500, "Force params update failed")
            return

        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_export(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return
        result = _get_force_snapshot(slug, snap=True)
        if result is None:
            self.send_error(500, "Force export failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        last_gen = _rebuild_generation
        try:
            while True:
                if _rebuild_generation != last_gen:
                    last_gen = _rebuild_generation
                    payload = json.dumps({
                        "generation": last_gen,
                        "error": _last_rebuild_error,
                    })
                    self.wfile.write(f"data: {payload}\n\n".encode())
                    self.wfile.flush()
                time.sleep(0.3)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _serve_icon(self, name: str):
        """Serve an individual icon SVG from assets/icons/."""
        # Prevent path traversal
        safe_name = pathlib.PurePosixPath(name).name
        if not safe_name or safe_name != name or '..' in name:
            self.send_error(400, "Invalid icon name")
            return
        icon_path = ROOT / "assets" / "icons" / safe_name
        if not icon_path.exists():
            self.send_error(404, f"Icon not found: {safe_name}")
            return
        self._respond(200, "image/svg+xml", icon_path.read_bytes())

    def _respond(self, code: int, content_type: str, body: bytes):
        try:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


def main():
    _load_env_local()
    parser = argparse.ArgumentParser(description="Diagram preview server")
    parser.add_argument("--port", type=int, default=_default_preview_port())
    parser.add_argument("--slug", help="Open a specific diagram on start")
    parser.add_argument("--grid", action="store_true", help="Show grid overlay")
    parser.add_argument("--no-watch", action="store_true", help="Disable file watching")
    args = parser.parse_args()

    # Auto-kill any process holding the port (Windows)
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command",
                 f"Get-NetTCPConnection -LocalPort {args.port} -ErrorAction SilentlyContinue"
                 f" | Select-Object -ExpandProperty OwningProcess -Unique"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
            if out:
                for pid_str in out.splitlines():
                    pid = int(pid_str.strip())
                    if pid > 0 and pid != os.getpid():
                        print(f"  [preview] killing PID {pid} holding port {args.port}")
                        subprocess.run(
                            ["powershell", "-NoProfile", "-Command",
                             f"Stop-Process -Id {pid} -Force -ErrorAction SilentlyContinue"],
                            stderr=subprocess.DEVNULL,
                        )
        except (subprocess.CalledProcessError, ValueError):
            pass

    PreviewHandler.grid = args.grid

    print("  [preview] initial build\u2026")
    _rebuild(grid=args.grid)

    if not args.no_watch:
        t = threading.Thread(target=_watch_loop, args=(args.grid,), daemon=True)
        t.start()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    url = f"http://127.0.0.1:{args.port}"
    if args.slug:
        url += f"/view/{args.slug}"
    print(f"  [preview] serving at {url}")
    print("  [preview] watching for changes\u2026 (Ctrl+C to stop)")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  [preview] stopped")
        server.server_close()


if __name__ == "__main__":
    main()
