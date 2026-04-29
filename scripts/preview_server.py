"""Hot-reload preview server for diagram-generator.

Serves diagram SVGs in a browser with:
  - Component tree sidebar with click-to-select and inspector
  - Drag-to-nudge with position overrides that persist across rebuilds
  - Live rebuild on file change (watches scripts/diagrams/ and scripts/diagram_*.py)
  - Server-Sent Events for instant browser refresh
  - Override staleness detection: flags when the definition changes under saved tweaks

Override architecture:
  Overrides live in diagrams/2.output/overrides/<slug>.json and store per-component
  position deltas (dx, dy).  The SVG from the engine is always "pure" -- overrides are
  applied client-side via CSS transforms.  This means the override is a drafting aid:
  the user nudges things visually, then the agent reads the override file and applies
  the fix to the Python definition.

Usage:
    python scripts/preview_server.py                     # all diagrams, port 8100
    python scripts/preview_server.py --slug aws-hld      # single diagram
    python scripts/preview_server.py --port 8200
    python scripts/preview_server.py --grid               # show grid overlay
"""

from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import os
import pathlib
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
OUTPUT_SVG = ROOT / "diagrams" / "2.output" / "svg"
OVERRIDES_DIR = ROOT / "diagrams" / "2.output" / "overrides"
DEFINITIONS_DIR = SCRIPTS / "diagrams"

WATCH_PATHS = [
    DEFINITIONS_DIR,
    SCRIPTS / "diagram_layout.py",
    SCRIPTS / "diagram_model.py",
    SCRIPTS / "diagram_render_svg.py",
    SCRIPTS / "diagram_render_drawio.py",
    SCRIPTS / "diagram_shared.py",
]

_rebuild_generation = 0
_rebuild_lock = threading.Lock()
_last_rebuild_error: str | None = None
_layout_cache: dict[str, object] = {}


def _collect_mtimes() -> dict[str, float]:
    mtimes: dict[str, float] = {}
    for p in WATCH_PATHS:
        if p.is_file():
            mtimes[str(p)] = p.stat().st_mtime
        elif p.is_dir():
            for f in p.rglob("*.py"):
                mtimes[str(f)] = f.stat().st_mtime
    return mtimes


def _definition_hash(slug: str) -> str:
    py_name = slug.replace("-", "_") + ".py"
    py_path = DEFINITIONS_DIR / py_name
    if py_path.exists():
        return hashlib.sha256(py_path.read_bytes()).hexdigest()[:16]
    return ""


def _list_diagrams() -> list[str]:
    slugs = []
    for f in sorted(OUTPUT_SVG.glob("*-onbrand-v2.svg")):
        slug = f.stem.replace("-onbrand-v2", "")
        slugs.append(slug)
    return slugs


def _rebuild(grid: bool = False) -> bool:
    global _last_rebuild_error, _layout_cache, _viewer_template
    cmd = [sys.executable, str(SCRIPTS / "build_v2.py")]
    if grid:
        cmd.append("--grid")
    try:
        result = subprocess.run(
            cmd, cwd=str(ROOT),
            capture_output=True, text=True, timeout=60,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        if result.returncode == 0:
            _last_rebuild_error = None
            _layout_cache.clear()
            _viewer_template = None  # reload template on next request
            return True
        _last_rebuild_error = result.stderr or result.stdout
        return False
    except Exception as e:
        _last_rebuild_error = str(e)
        return False


def _get_layout_result(slug: str):
    if slug in _layout_cache:
        return _layout_cache[slug]
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))
        import importlib
        mod_name = slug.replace("-", "_")
        mod = importlib.import_module(f"diagrams.{mod_name}")
        importlib.reload(mod)
        diagram_obj = getattr(mod, mod_name)
        import diagram_layout
        result = diagram_layout.layout(diagram_obj)
        _layout_cache[slug] = result
        return result
    except Exception:
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


def _relayout(slug: str, grid_overrides: dict) -> dict | None:
    """Re-run layout with patched grid params and return SVG + metadata."""
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))
        import importlib, copy
        mod_name = slug.replace("-", "_")
        mod = importlib.import_module(f"diagrams.{mod_name}")
        importlib.reload(mod)
        diagram_obj = copy.deepcopy(getattr(mod, mod_name))
        # Patch grid params
        for key in ("col_gap", "row_gap", "outer_margin"):
            if key in grid_overrides:
                setattr(diagram_obj, key, grid_overrides[key])

        # Propagate gap overrides into nested panels.  Patch panels whose
        # gap matches the diagram's original default (i.e. they were set to
        # the same value as the diagram level) as well as panels with None.
        # Panels with intentionally different gaps (e.g. COMPACT_GAP inside
        # dense sub-panels) keep their values.
        from diagram_model import Panel as _Panel
        orig_col_gap = getattr(mod, mod_name).col_gap
        orig_row_gap = getattr(mod, mod_name).row_gap

        def _patch_panel_gaps(children):
            for comp in children:
                if isinstance(comp, _Panel):
                    if "col_gap" in grid_overrides:
                        if comp.col_gap is None or comp.col_gap == orig_col_gap:
                            comp.col_gap = grid_overrides["col_gap"]
                    if "row_gap" in grid_overrides:
                        if comp.row_gap is None or comp.row_gap == orig_row_gap:
                            comp.row_gap = grid_overrides["row_gap"]
                    if hasattr(comp, "children") and comp.children:
                        _patch_panel_gaps(comp.children)
        _patch_panel_gaps(diagram_obj.components)

        import diagram_layout
        result = diagram_layout.layout(diagram_obj)
        import diagram_render_svg
        svg_str = diagram_render_svg.render_svg(result)
        tree = [asdict(ci) for ci in result.component_tree] if result.component_tree else []
        gi = asdict(result.grid_info) if result.grid_info else None
        return {"svg": svg_str, "tree": tree, "grid_info": gi}
    except Exception as e:
        import traceback; traceback.print_exc()
        return None


def _load_overrides(slug: str) -> dict:
    path = OVERRIDES_DIR / f"{slug}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"format_version": 1, "definition_hash": "", "overrides": {}}


def _save_overrides(slug: str, data: dict) -> None:
    OVERRIDES_DIR.mkdir(parents=True, exist_ok=True)
    path = OVERRIDES_DIR / f"{slug}.json"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _watch_loop(grid: bool = False, interval: float = 0.5):
    global _rebuild_generation
    prev_mtimes = _collect_mtimes()
    while True:
        time.sleep(interval)
        curr_mtimes = _collect_mtimes()
        if curr_mtimes != prev_mtimes:
            prev_mtimes = curr_mtimes
            with _rebuild_lock:
                ok = _rebuild(grid=grid)
                _rebuild_generation += 1
                status = "ok" if ok else "error"
                print(f"  [preview] rebuild #{_rebuild_generation} ({status})")


# ---------------------------------------------------------------------------
# Viewer HTML – serves static template with config injection
# ---------------------------------------------------------------------------

PREVIEW_DIR = pathlib.Path(__file__).resolve().parent / "preview"
_viewer_template: str | None = None


def _get_viewer_template() -> str:
    global _viewer_template
    if _viewer_template is None:
        _viewer_template = (PREVIEW_DIR / "viewer.html").read_text(encoding="utf-8")
    return _viewer_template


def _build_viewer_html(slug: str, all_slugs: list[str], grid: bool) -> str:
    nav_links = " ".join(
        f'<a href="/view/{s}" class="{"active" if s == slug else ""}">{s}</a>'
        for s in all_slugs
    )
    from diagram_shared import ARROW_HEAD_LENGTH, ARROW_HEAD_HALF_WIDTH, ICON_SIZE, GRID_GUTTER, INSET
    config_script = (
        f"window.__DG_CONFIG = {{"
        f'"slug":"{slug}",'
        f'"grid":{str(grid).lower()},'
        f'"inset":{INSET},'
        f'"head_len":{ARROW_HEAD_LENGTH},'
        f'"head_half":{ARROW_HEAD_HALF_WIDTH},'
        f'"icon_size":{ICON_SIZE},'
        f'"col_gap":{GRID_GUTTER}'
        f"}};"
    )
    html = _get_viewer_template()
    html = html.replace("%TITLE%", f"{slug} – diagram preview")
    html = html.replace("%NAV_LINKS%", nav_links)
    html = html.replace("%CONFIG_SCRIPT%", config_script)
    return html


INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Diagram preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #1a1a1a; color: #e0e0e0; }
  .nav { padding: 16px 24px; display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #333; }
  .nav a { color: #6cc; text-decoration: none; padding: 6px 12px; border-radius: 4px;
           background: #2a2a2a; font-size: 14px; }
  .nav a:hover { background: #3a3a3a; }
  h1 { font-size: 16px; font-weight: 600; padding: 16px 24px 0; }
</style>
</head>
<body>
<h1>Diagram preview</h1>
<div class="nav">%LINKS%</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class PreviewHandler(http.server.BaseHTTPRequestHandler):
    grid: bool = False

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/":
            self._serve_index()
        elif path == "/events":
            self._serve_sse()
        elif path.startswith("/preview/"):
            self._serve_static(path[9:])
        elif path.startswith("/svg/"):
            self._serve_svg(path[5:])
        elif path.startswith("/view/"):
            self._serve_viewer(path[6:])
        elif path.startswith("/api/tree/"):
            self._serve_tree(path[10:])
        elif path.startswith("/api/grid/"):
            self._serve_grid(path[10:])
        elif path.startswith("/api/overrides/"):
            self._serve_overrides_get(path[15:])
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if path.startswith("/api/overrides/"):
            self._serve_overrides_post(path[15:])
        elif path.startswith("/api/relayout/"):
            self._serve_relayout(path[14:])
        else:
            self.send_error(404)

    def _serve_index(self):
        slugs = _list_diagrams()
        links = "\n  ".join(f'<a href="/view/{s}">{s}</a>' for s in slugs)
        self._respond(200, "text/html", INDEX_HTML.replace("%LINKS%", links).encode())

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

    def _serve_viewer(self, slug: str):
        slugs = _list_diagrams()
        if slug not in slugs:
            self.send_error(404, f"Unknown diagram: {slug}")
            return
        html = _build_viewer_html(slug, slugs, self.grid)
        self._respond(200, "text/html", html.encode())

    def _serve_svg(self, filename: str):
        svg_path = OUTPUT_SVG / filename
        if not svg_path.exists():
            self.send_error(404)
            return
        self._respond(200, "image/svg+xml", svg_path.read_bytes())

    def _serve_tree(self, slug: str):
        tree = _get_component_tree(slug)
        self._respond(200, "application/json", json.dumps(tree, indent=2).encode())

    def _serve_grid(self, slug: str):
        info = _get_grid_info(slug)
        if info is None:
            self._respond(200, "application/json", b"null")
        else:
            self._respond(200, "application/json", json.dumps(info, indent=2).encode())

    def _serve_overrides_get(self, slug: str):
        data = _load_overrides(slug)
        current_hash = _definition_hash(slug)
        saved_hash = data.get("definition_hash", "")
        stale = bool(saved_hash and current_hash and saved_hash != current_hash)
        response = {
            "definition_hash": current_hash,
            "overrides": data.get("overrides", {}),
            "grid_overrides": data.get("grid_overrides", {}),
            "stale": stale,
        }
        self._respond(200, "application/json", json.dumps(response, indent=2).encode())

    def _serve_overrides_post(self, slug: str):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        data["definition_hash"] = _definition_hash(slug)
        data["format_version"] = 1
        _save_overrides(slug, data)
        self._respond(200, "application/json", b'{"ok":true}')

    def _serve_relayout(self, slug: str):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        grid_overrides = {}
        for key in ("col_gap", "row_gap", "outer_margin"):
            if key in params and params[key] is not None:
                grid_overrides[key] = int(params[key])
        result = _relayout(slug, grid_overrides)
        if result is None:
            self.send_error(500, "Relayout failed")
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

    def _respond(self, code: int, content_type: str, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Diagram preview server")
    parser.add_argument("--port", type=int, default=8100)
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
                 f" | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
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
