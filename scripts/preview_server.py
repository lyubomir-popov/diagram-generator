"""Hot-reload preview server for diagram-generator.

Serves diagram SVGs in a browser with:
  - Component tree sidebar with click-to-select and inspector
  - Live rebuild on file change (watches scripts/diagrams/ and scripts/diagram_*.py)
  - Server-Sent Events for instant browser refresh
  - YAML-backed persistence for canonical v3 frame edits

Usage:
    python scripts/preview_server.py                     # all diagrams, port 8100
    python scripts/preview_server.py --slug request-to-hardware-stack  # single diagram
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
import yaml
from urllib.parse import unquote, urlparse

from frame_yaml_persistence import persist_override_payload_to_yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
_TS_PREVIEW_MODULE_NAMES = ("preview_ts_export", "preview_ts_layout")
SCRIPTS = ROOT / "scripts"
OUTPUT_SVG = ROOT / "diagrams" / "2.output" / "svg"
V3_OUTPUT = ROOT / "diagrams" / "2.output" / "v3"
V3_SVG = V3_OUTPUT / "svg"
V3_DRAWIO = V3_OUTPUT / "draw.io"
DEFINITIONS_DIR = SCRIPTS / "diagrams"
FORCE_DEFINITIONS_DIR = DEFINITIONS_DIR / "force"
FRAMES_DIR = pathlib.Path(os.environ.get("DG_FRAMES_DIR") or (SCRIPTS / "diagrams" / "frames"))

_LAYOUT_ENGINE_DIST = ROOT / "packages" / "layout-engine" / "dist"
_TS_LAYOUT_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "layout-frame-diagram.mjs"
_TS_EMIT_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "emit-frame-diagram-json.mjs"
_TS_EXPORT_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "export-frame-svg.mjs"

WATCH_PATHS = [
    DEFINITIONS_DIR,
    FRAMES_DIR,
    SCRIPTS / "frame_yaml_persistence.py",
    SCRIPTS / "preview_ts_layout.py",
    SCRIPTS / "preview_ts_export.py",
    _TS_LAYOUT_SCRIPT,
    _TS_EMIT_SCRIPT,
    _TS_EXPORT_SCRIPT,
    _LAYOUT_ENGINE_DIST,
    SCRIPTS / "preview",
]

_rebuild_generation = 0
_rebuild_lock = threading.Lock()
_last_rebuild_error: str | None = None
_force_sessions: dict[str, object] = {}


def _ts_layout_disabled() -> bool:
    return os.environ.get("DG_DISABLE_TS_LAYOUT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _import_ts_preview_module(name: str):
    mod = sys.modules.get(name)
    if mod is None:
        return importlib.import_module(name)
    return importlib.reload(mod)


def _recreate_ts_preview_pools() -> None:
    """Build pools from the current preview_ts_* modules (not stale import aliases)."""
    global _ts_svg_pool, _ts_layout_pool
    export_mod = _import_ts_preview_module("preview_ts_export")
    layout_mod = _import_ts_preview_module("preview_ts_layout")
    _ts_svg_pool = export_mod.pool_from_env(
        script_path=_TS_EXPORT_SCRIPT,
        repo_root=ROOT,
        frames_dir=FRAMES_DIR,
    )
    _ts_layout_pool = layout_mod.pool_from_env(
        layout_script=_TS_LAYOUT_SCRIPT,
        emit_script=_TS_EMIT_SCRIPT,
        repo_root=ROOT,
        frames_dir=FRAMES_DIR,
    )


_recreate_ts_preview_pools()


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
    global _last_rebuild_error, _viewer_template, _force_template, _unified_template, _force_sessions
    _force_sessions.clear()
    _viewer_template = None
    _force_template = None
    _unified_template = None
    try:
        _recreate_ts_preview_pools()
    except Exception as exc:
        _last_rebuild_error = f"Reload error in TS preview pools: {exc}"
        return False
    _last_rebuild_error = None
    return True


def _normalize_slug(slug: str) -> str:
    return slug[3:] if slug.startswith("v3:") else slug


def _render_svg_via_ts(slug: str) -> bytes | None:
    """Layout + render SVG via the TypeScript engine (cached Node pool)."""
    return _ts_svg_pool.render_svg(_normalize_slug(slug))


def _serve_v3_svg_bytes(slug: str) -> bytes | None:
    """Live v3 SVG bytes for frame YAML, or None when TS export fails."""
    key = _normalize_slug(slug)
    if not (FRAMES_DIR / f"{key}.yaml").is_file():
        return None
    return _render_svg_via_ts(slug)


def _ts_layout_bundle(slug: str) -> dict | None:
    return _ts_layout_pool.layout_bundle(_normalize_slug(slug))


def _get_component_tree(slug: str) -> list[dict]:
    bundle = _ts_layout_bundle(slug)
    if not bundle:
        return []
    tree = bundle.get("componentTree")
    return tree if isinstance(tree, list) else []


def _get_grid_info(slug: str) -> dict | None:
    bundle = _ts_layout_bundle(slug)
    if not bundle:
        return None
    info = bundle.get("gridInfo")
    return info if isinstance(info, dict) else None


def _save_overrides(slug: str, data: dict) -> None:
    frame_path = FRAMES_DIR / f"{slug}.yaml"
    if not frame_path.exists():
        raise ValueError(f"Unknown frame slug: {slug}")
    persist_override_payload_to_yaml(frame_path, data)
    key = _normalize_slug(slug)
    _ts_layout_pool.invalidate_slug(key)
    _ts_svg_pool.invalidate_slug(key)


def _watch_loop(grid: bool = False, interval: float = 0.5):
    global _rebuild_generation, _viewer_template, _force_template, _unified_template
    _DEBOUNCE = 2.0  # seconds quiet after last change before rebuilding
    # Give the OS a moment to settle file timestamps after startup
    time.sleep(1.0)
    prev_mtimes = _collect_mtimes()
    _last_change_time: float = 0.0
    _pending = False
    while True:
        try:
            time.sleep(interval)
            curr_mtimes = _collect_mtimes()
            now = time.monotonic()
            if curr_mtimes != prev_mtimes:
                added = [k for k in curr_mtimes if k not in prev_mtimes]
                removed = [k for k in prev_mtimes if k not in curr_mtimes]
                changed = [k for k in curr_mtimes if k in prev_mtimes and curr_mtimes[k] != prev_mtimes[k]]
                for f in (added + removed + changed)[:5]:
                    tag = "+" if f in added else ("-" if f in removed else "~")
                    print(f"  [preview] {tag} {pathlib.Path(f).name}")
                prev_mtimes = curr_mtimes
                _last_change_time = now
                _pending = True
            # Fire the rebuild once things have been quiet for _DEBOUNCE seconds
            if _pending and (now - _last_change_time) >= _DEBOUNCE:
                _pending = False
                # Invalidate cached viewer template so HTML/CSS/JS changes are picked up
                _viewer_template = None
                _force_template = None
                _unified_template = None
                with _rebuild_lock:
                    ok = _rebuild(grid=grid)
                    _rebuild_generation += 1
                    status = "ok" if ok else "error"
                    print(f"  [preview] rebuild #{_rebuild_generation} ({status})")
        except Exception as exc:
            print(f"  [preview] watcher error (will retry): {exc}")


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


def _preview_asset_url(filename: str) -> str:
    asset_map = {
        "layout-engine.js": ROOT / "packages" / "layout-engine" / "dist" / "layout-engine.iife.js",
    }
    asset_path = asset_map.get(filename, PREVIEW_DIR / filename)
    version = int(asset_path.stat().st_mtime_ns) if asset_path.exists() else 0
    return f"/preview/{filename}?v={version}"

# Reference-image directories (rough input sketches + corpus audit PNGs)
_INPUT_DIRS = [
    ROOT / "diagrams" / "1.input",
]
_CORPUS_REF_DIR = ROOT / "docs" / "corpus-references"

# Slug → input sketch mapping (mirrors build_compare_pages.py PAIRS)
_REFERENCE_MAP: dict[str, str] = {
    "memory-wall": "redo-this-image-onbrand.png",
    "attention-qkv": "image 3.png",
    "logic-data-vram": "image 4.png",
    "request-to-hardware-stack": "image 6.png",
    "inference-snaps": "image 7.png",
    "example-arrow-label-separator": "example-arrow-label-separator-rough.svg",
    "force-stakeholders": "force/IMG_3229.jpg",
    "tiered-network-architecture": "maas/tiered-network-architecture.png",
}


def _load_force_preview_module():
    try:
        import force_preview

        return force_preview
    except Exception:
        return None


def _force_backend_unavailable_message() -> str:
    return "Force layout backend is not available in this checkout. Restore the TypeScript force lane before using /force."


def _load_force_spec_from_disk(slug: str) -> dict | None:
    if not _is_safe_slug(slug):
        return None
    spec_path = FORCE_DEFINITIONS_DIR / f"{slug}.yaml"
    if not spec_path.exists():
        return None
    try:
        data = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _list_force_examples() -> list[str]:
    if not FORCE_DEFINITIONS_DIR.exists():
        return []
    return sorted(path.stem for path in FORCE_DEFINITIONS_DIR.glob("*.yaml") if _is_safe_slug(path.stem))


def _build_preview_nav_options(current_path: str) -> str:
    sections: list[str] = []

    autolayout_options = "".join(
        f'<option value="/view/v3:{slug}"{" selected" if current_path == f"/view/v3:{slug}" else ""}>{slug}</option>'
        for slug in _list_autolayout_diagrams()
    )
    if autolayout_options:
        sections.append(f'<optgroup label="Autolayout">{autolayout_options}</optgroup>')

    force_options = "".join(
        f'<option value="/force/view/{slug}"{" selected" if current_path == f"/force/view/{slug}" else ""}>{slug}</option>'
        for slug in _list_force_examples()
    )
    if force_options:
        sections.append(f'<optgroup label="Force demos">{force_options}</optgroup>')

    return "".join(sections)


def _build_browse_nav(current_path: str) -> str:
    """Build the left-sidebar browse panel HTML."""
    sections: list[str] = []

    autolayout = _list_autolayout_diagrams()
    if autolayout:
        items = "".join(
            f'<li><a class="dg-browse-link{" is-active" if current_path == f"/view/v3:{s}" else ""}" href="/view/v3:{s}">{s}</a></li>'
            for s in autolayout
        )
        sections.append(
            f'<div class="dg-browse-group"><h3 class="dg-browse-heading">Autolayout</h3><ul class="dg-browse-list">{items}</ul></div>'
        )

    force = _list_force_examples()
    if force:
        items = "".join(
            f'<li><a class="dg-browse-link{" is-active" if current_path == f"/force/view/{s}" else ""}" href="/force/view/{s}">{s}</a></li>'
            for s in force
        )
        sections.append(
            f'<div class="dg-browse-group"><h3 class="dg-browse-heading">Force demos</h3><ul class="dg-browse-list">{items}</ul></div>'
        )

    return "".join(sections)


def _get_force_state(slug: str, *, reset: bool = False):
    global _force_sessions
    force_preview = _load_force_preview_module()
    if force_preview is None:
        raise RuntimeError(_force_backend_unavailable_message())

    if reset and slug in _force_sessions:
        _force_sessions[slug] = force_preview.reset_force_state(_force_sessions[slug])
    elif reset or slug not in _force_sessions:
        _force_sessions[slug] = force_preview.create_force_state(slug)
    return _force_sessions[slug]


def _get_force_snapshot(slug: str, *, reset: bool = False, snap: bool = False) -> dict | None:
    force_preview = _load_force_preview_module()
    if force_preview is None:
        return None
    try:
        state = _get_force_state(slug, reset=reset)
        if snap:
            return force_preview.export_force_snapshot(state)
        return force_preview.get_force_snapshot(state)
    except Exception:
        import traceback

        traceback.print_exc()
        return None


def _tick_force_snapshot(slug: str, iterations: int | None = None) -> dict | None:
    force_preview = _load_force_preview_module()
    if force_preview is None:
        return None
    try:
        state = _get_force_state(slug)
        return force_preview.tick_force_state(state, iterations=iterations)
    except Exception:
        import traceback

        traceback.print_exc()
        return None


def _find_reference_image(slug: str) -> pathlib.Path | None:
    """Find the rough input sketch or corpus source PNG for a diagram slug."""
    corpus = _CORPUS_REF_DIR / f"{slug}-source.png"
    if corpus.exists():
        return corpus
    filename = _REFERENCE_MAP.get(slug)
    if not filename:
        spec = _load_force_spec_from_disk(slug)
        if spec is not None:
            filename = spec.get("reference_image")
    if not filename:
        force_preview = _load_force_preview_module()
        if force_preview is not None:
            try:
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


def _require_bf_preview_assets() -> tuple[pathlib.Path, pathlib.Path]:
    """Hard fail when vendored Baseline Foundry assets are missing."""
    assets = _resolve_bf_preview_assets()
    if assets is None:
        raise RuntimeError(
            "Baseline Foundry preview assets are required but missing under "
            f"{BF_VENDOR_ROOT.relative_to(ROOT)}. "
            "Run: python scripts/sync_baseline_foundry_assets.py "
            "(requires sibling baseline-foundry checkout with built os tier)."
        )
    return assets


def _bf_styles_link_html() -> str:
    _require_bf_preview_assets()
    return '<link rel="stylesheet" href="/preview/bf-os.css">'


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


def _frame_yaml_layout_engine(slug: str) -> str | None:
    """Read meta.layout_engine from frame YAML without running TS emit."""
    path = FRAMES_DIR / f"{_normalize_slug(slug)}.yaml"
    if not path.is_file():
        return None
    try:
        import yaml

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        meta = data.get("meta")
        if not isinstance(meta, dict):
            return None
        value = meta.get("layout_engine")
        return str(value) if value is not None else None
    except Exception:
        return None


def _build_viewer_html(slug: str, all_slugs: list[str], grid: bool) -> str:
    view_path = f"/view/{slug}"
    nav_options = _build_preview_nav_options(view_path)
    browse_nav = _build_browse_nav(view_path)
    from diagram_shared import ARROW_HEAD_LENGTH, ARROW_HEAD_HALF_WIDTH, ICON_SIZE, GRID_GUTTER, INSET
    is_v3 = True
    real_slug = slug[3:] if slug.startswith("v3:") else slug
    engine = "v3"
    layout_engine = _frame_yaml_layout_engine(real_slug) or ""
    is_elk = layout_engine == "elk-layered"
    has_ref = _find_reference_image(real_slug) is not None
    config_script = (
        f"window.__DG_CONFIG = {{"
        f'"slug":"{real_slug}",'
        f'"engine":"{engine}",'
        f'"layout_engine":"{layout_engine}",'
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
    html = html.replace("%BF_STYLES%", _bf_styles_link_html())
    html = html.replace("%MODE%", "grid")
    html = html.replace("%NAV_OPTIONS%", nav_options)
    html = html.replace("%BROWSE_NAV%", browse_nav)
    html = html.replace("%INSPECTOR_EMPTY%", "Click a component to inspect it.")
    html = html.replace("%ELK_SECTION_HIDDEN%", "" if is_elk else "hidden")
    html = html.replace(
        "%MODE_SCRIPTS%",
        f'<script src="{_preview_asset_url("layout-engine.js")}"></script>\n'
        f'<script src="{_preview_asset_url("layout-bridge.js")}"></script>\n'
        f'<script src="{_preview_asset_url("elk-layout-controls.js")}"></script>\n'
        f'<script src="{_preview_asset_url("component-model.js")}"></script>\n'
        f'<script src="{_preview_asset_url("constraints.js")}"></script>\n'
        f'<script src="{_preview_asset_url("editor.js")}"></script>',
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
    html = html.replace("%BF_STYLES%", _bf_styles_link_html())
    html = html.replace("%MODE%", "force")
    html = html.replace("%NAV_OPTIONS%", nav_options)
    html = html.replace("%BROWSE_NAV%", browse_nav)
    html = html.replace("%INSPECTOR_EMPTY%", "Click a node to select it.")
    html = html.replace(
        "%MODE_SCRIPTS%",
        f'<script src="{_preview_asset_url("layout-engine.js")}"></script>\n'
        f'<script src="{_preview_asset_url("force.js")}"></script>',
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
        <p>Tracked force-layout demos with restored navigation and preview shell wiring. Live interaction remains blocked until the TypeScript runtime replaces the deleted backend.</p>
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
        elif path.startswith("/api/force-spec/"):
            self._serve_force_spec(path[16:])
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

    def _ensure_force_backend(self) -> bool:
        if _load_force_preview_module() is None:
            self.send_error(501, _force_backend_unavailable_message())
            return False
        return True

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
            self.send_error(404, "No v3 outputs or frame YAMLs found for the current preview roots")
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
            svg_bytes = _serve_v3_svg_bytes(slug)
            if svg_bytes is None:
                print(f"TS SVG export failed for {slug}; returning 404", file=sys.stderr)
                self.send_error(404, f"Cannot render v3 diagram: {slug}")
                return
            self._respond(200, "image/svg+xml", svg_bytes)
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
                svg_bytes = _serve_v3_svg_bytes(slug)
                if svg_bytes is not None:
                    self._respond(200, "image/svg+xml", svg_bytes)
                    return
                print(f"TS SVG export failed for {slug}; returning 404", file=sys.stderr)
                self.send_error(404, f"Cannot render v3 diagram: {slug}")
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
            svg_bytes = _serve_v3_svg_bytes(slug)
            if svg_bytes is not None:
                self._respond(200, "image/svg+xml", svg_bytes)
                return
            if (FRAMES_DIR / f"{_normalize_slug(slug)}.yaml").is_file():
                print(f"TS SVG export failed for {slug}; returning 404", file=sys.stderr)
                self.send_error(404, f"Cannot render v3 diagram: {slug}")
                return
        self.send_error(404)

    def _serve_tree(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        tree = _get_component_tree(slug)
        self._respond(200, "application/json", json.dumps(tree, indent=2).encode())

    def _serve_frame_tree(self, slug: str):
        """Serve frame-tree JSON from TS YAML loader (derived DTO, not authority)."""
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        key = _normalize_slug(slug)
        frame_yaml = FRAMES_DIR / f"{key}.yaml"
        if not frame_yaml.is_file():
            self.send_error(404, "Frame diagram not found")
            return
        if _ts_layout_disabled():
            self.send_error(503, "TS frame-tree export disabled")
            return
        data = _ts_layout_pool.frame_tree_json(slug)
        if data is None:
            print(f"TS frame-tree export failed for {key}", file=sys.stderr)
            self.send_error(503, "TS frame-tree export failed")
            return
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
        if not self._ensure_force_backend():
            return
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

    def _serve_force_spec(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        spec = _load_force_spec_from_disk(slug)
        if spec is None:
            self.send_error(404, f"Unknown force example: {slug}")
            return
        self._respond(200, "application/json", json.dumps(spec).encode())

    def _serve_force_reset(self, slug: str):
        if not self._ensure_force_backend():
            return
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
        if not self._ensure_force_backend():
            return
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
        if not self._ensure_force_backend():
            return
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
            force_preview = _load_force_preview_module()
            if force_preview is None:
                raise RuntimeError(_force_backend_unavailable_message())
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
        if not self._ensure_force_backend():
            return
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        if slug not in _list_force_examples():
            self.send_error(404, f"Unknown force example: {slug}")
            return

        try:
            force_preview = _load_force_preview_module()
            if force_preview is None:
                raise RuntimeError(_force_backend_unavailable_message())
            state = _get_force_state(slug)
            force_preview.save_force_overrides(state)
        except Exception:
            import traceback

            traceback.print_exc()
            self.send_error(500, "Force save failed")
            return

        self._respond(200, "application/json", b'{"ok":true}')

    def _serve_force_params(self, slug: str):
        if not self._ensure_force_backend():
            return
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
            force_preview = _load_force_preview_module()
            if force_preview is None:
                raise RuntimeError(_force_backend_unavailable_message())
            state = _get_force_state(slug)
            result = force_preview.update_simulation_params(state, params)
        except Exception:
            import traceback
            traceback.print_exc()
            self.send_error(500, "Force params update failed")
            return

        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_force_export(self, slug: str):
        if not self._ensure_force_backend():
            return
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
        # URL-decode then prevent path traversal
        safe_name = pathlib.PurePosixPath(unquote(name)).name
        if not safe_name or '..' in name:
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

    _require_bf_preview_assets()

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
    except Exception as exc:
        import traceback
        print(f"\n  [preview] FATAL: {exc}")
        traceback.print_exc()
        server.server_close()
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        import traceback
        print(f"\n  [preview] top-level crash: {exc}")
        traceback.print_exc()
        raise
