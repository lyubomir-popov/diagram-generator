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
import math
import os
import pathlib
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from urllib.parse import unquote, urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
OUTPUT_SVG = ROOT / "diagrams" / "2.output" / "svg"
V3_OUTPUT = ROOT / "diagrams" / "2.output" / "v3"
V3_SVG = V3_OUTPUT / "svg"
V3_DRAWIO = V3_OUTPUT / "draw.io"
OVERRIDES_DIR = ROOT / "diagrams" / "2.output" / "overrides"
DEFINITIONS_DIR = SCRIPTS / "diagrams"
FRAMES_DIR = SCRIPTS / "diagrams" / "frames"

WATCH_PATHS = [
    DEFINITIONS_DIR,
    DEFINITIONS_DIR / "yaml",
    DEFINITIONS_DIR / "force",
    SCRIPTS / "diagram_layout.py",
    SCRIPTS / "diagram_model.py",
    SCRIPTS / "diagram_render_svg.py",
    SCRIPTS / "diagram_render_drawio.py",
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


def _definition_hash(slug: str) -> str:
    py_name = slug.replace("-", "_") + ".py"
    py_path = DEFINITIONS_DIR / py_name
    if py_path.exists():
        return hashlib.sha256(py_path.read_bytes()).hexdigest()[:16]
    # Check YAML/JSON definitions
    yaml_dir = DEFINITIONS_DIR / "yaml"
    for ext in (".yaml", ".yml", ".json"):
        candidate = yaml_dir / (slug + ext)
        if candidate.exists():
            return hashlib.sha256(candidate.read_bytes()).hexdigest()[:16]
    return ""


def _list_diagrams() -> list[str]:
    slugs = []
    for f in sorted(OUTPUT_SVG.glob("*-onbrand-v2.svg")):
        slug = f.stem.replace("-onbrand-v2", "")
        slugs.append(slug)
    return slugs


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
    global _last_rebuild_error, _layout_cache, _viewer_template, _force_template, _force_sessions
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
            _force_sessions.clear()
            _viewer_template = None  # reload template on next request
            _force_template = None
            return True
        _last_rebuild_error = result.stderr or result.stdout
        return False
    except Exception as e:
        _last_rebuild_error = str(e)
        return False


def _get_layout_result(slug: str, engine: str = "v2"):
    # Auto-detect engine from slug prefix
    if slug.startswith("v3:"):
        engine = "v3"
        slug = slug[3:]
    # Auto-detect frame YAML when engine wasn't explicitly set to v3
    if engine != "v3":
        frame_yaml = FRAMES_DIR / (slug + ".yaml")
        if frame_yaml.exists():
            engine = "v3"
    cache_key = f"{slug}:{engine}"
    if cache_key in _layout_cache:
        return _layout_cache[cache_key]
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))

        # Check for native frame YAML first (v3-only, no conversion)
        if engine == "v3":
            frame_yaml = FRAMES_DIR / (slug + ".yaml")
            if frame_yaml.exists():
                from frame_loader import load_frame_yaml
                from layout_v3 import layout_frame_diagram
                frame_diagram = load_frame_yaml(frame_yaml)
                result = layout_frame_diagram(frame_diagram)
                _layout_cache[cache_key] = result
                return result

        import importlib
        mod_name = slug.replace("-", "_")
        try:
            mod = importlib.import_module(f"diagrams.{mod_name}")
            importlib.reload(mod)
            diagram_obj = getattr(mod, mod_name)
        except (ModuleNotFoundError, AttributeError):
            # Fall back to YAML definition
            from diagram_loader import load_diagram
            yaml_dir = SCRIPTS / "diagrams" / "yaml"
            yaml_path = None
            for ext in (".yaml", ".yml", ".json"):
                candidate = yaml_dir / (slug + ext)
                if candidate.exists():
                    yaml_path = candidate
                    break
            if yaml_path is None:
                return None
            diagram_obj = load_diagram(yaml_path)

        if engine == "v3":
            from frame_adapter import diagram_to_frame
            from layout_v3 import layout_frame_diagram
            frame_diagram = diagram_to_frame(diagram_obj)
            result = layout_frame_diagram(frame_diagram)
        else:
            import diagram_layout
            result = diagram_layout.layout(diagram_obj)
        _layout_cache[cache_key] = result
        return result
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


def _relayout(slug: str, grid_overrides: dict) -> dict | None:
    """Re-run layout with patched grid params and return SVG + metadata."""
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))
        import importlib, copy
        mod_name = slug.replace("-", "_")
        try:
            mod = importlib.import_module(f"diagrams.{mod_name}")
            importlib.reload(mod)
            diagram_obj = copy.deepcopy(getattr(mod, mod_name))
            orig_col_gap = getattr(mod, mod_name).col_gap
            orig_row_gap = getattr(mod, mod_name).row_gap
        except (ModuleNotFoundError, AttributeError):
            from diagram_loader import load_diagram
            yaml_dir = SCRIPTS / "diagrams" / "yaml"
            yaml_path = None
            for ext in (".yaml", ".yml", ".json"):
                candidate = yaml_dir / (slug + ext)
                if candidate.exists():
                    yaml_path = candidate
                    break
            if yaml_path is None:
                return None
            diagram_obj = copy.deepcopy(load_diagram(yaml_path))
            orig_col_gap = diagram_obj.col_gap
            orig_row_gap = diagram_obj.row_gap

        # Patch grid params
        for key in ("cols", "col_gap", "row_gap", "outer_margin"):
            if key in grid_overrides:
                setattr(diagram_obj, key, grid_overrides[key])

        def _patch_panel_gaps(children):
            from diagram_model import Panel as _PanelType
            for comp in children:
                if isinstance(comp, _PanelType):
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


def _relayout_v3(slug: str, params: dict) -> dict | None:
    """Re-run v3 frame layout with patched frame properties.

    params can contain:
      - frame_overrides: dict of frame_id → {direction, gap, padding, sizing,
        align, width, height} (multi-frame format, preferred)

    Legacy single-frame format (frame_id + flat props) is also accepted
    for backwards compatibility.
    """
    try:
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))
        import copy
        result = _get_layout_result(slug)
        if result is None:
            return None

        # Re-load the frame diagram from the original source
        from frame_model import Direction, Sizing, Align

        # Try native frame YAML first
        frame_yaml = FRAMES_DIR / (slug + ".yaml")
        if frame_yaml.exists():
            from frame_loader import load_frame_yaml
            frame_diagram = load_frame_yaml(frame_yaml)
        else:
            from diagram_loader import load_diagram
            from frame_adapter import diagram_to_frame

            yaml_dir = SCRIPTS / "diagrams" / "yaml"
            yaml_path = None
            for ext in (".yaml", ".yml", ".json"):
                candidate = yaml_dir / (slug + ext)
                if candidate.exists():
                    yaml_path = candidate
                    break

            if yaml_path is None:
                # Try Python module
                import importlib
                mod_name = slug.replace("-", "_")
                try:
                    mod = importlib.import_module(f"diagrams.{mod_name}")
                    importlib.reload(mod)
                    diagram_obj = copy.deepcopy(getattr(mod, mod_name))
                except (ModuleNotFoundError, AttributeError):
                    return None
            else:
                diagram_obj = copy.deepcopy(load_diagram(yaml_path))

            frame_diagram = diagram_to_frame(diagram_obj)

        # Build overrides map: { frame_id: { prop: value } }
        if "frame_overrides" in params:
            all_overrides = params["frame_overrides"]
        else:
            # Legacy single-frame format
            target_id = params.get("frame_id", "root")
            legacy_ovr = {k: v for k, v in params.items() if k != "frame_id"}
            all_overrides = {target_id: legacy_ovr} if legacy_ovr else {}

        def _find_frame(frame, fid):
            if frame.id == fid:
                return frame
            for child in frame.children:
                found = _find_frame(child, fid)
                if found:
                    return found
            return None

        direction_map = {"VERTICAL": Direction.VERTICAL, "HORIZONTAL": Direction.HORIZONTAL}
        sizing_map = {"HUG": Sizing.HUG, "FILL": Sizing.FILL, "FIXED": Sizing.FIXED}
        align_map = {a.name: a for a in Align}

        for fid, ovr in all_overrides.items():
            if fid == "root":
                target = frame_diagram.root
            else:
                target = _find_frame(frame_diagram.root, fid)
            if target is None:
                continue

            if "direction" in ovr and ovr["direction"] in direction_map:
                target.direction = direction_map[ovr["direction"]]
            if "gap" in ovr and ovr["gap"] is not None:
                target.gap = max(0, int(ovr["gap"]))
            if "padding" in ovr and ovr["padding"] is not None:
                target.padding = max(0, int(ovr["padding"]))
                target.padding_top = target.padding
                target.padding_right = target.padding
                target.padding_bottom = target.padding
                target.padding_left = target.padding
            if "sizing" in ovr and ovr["sizing"] in sizing_map:
                # Legacy uniform sizing → both axes
                target.sizing_w = sizing_map[ovr["sizing"]]
                target.sizing_h = sizing_map[ovr["sizing"]]
            if "sizing_w" in ovr and ovr["sizing_w"] in sizing_map:
                target.sizing_w = sizing_map[ovr["sizing_w"]]
            if "sizing_h" in ovr and ovr["sizing_h"] in sizing_map:
                target.sizing_h = sizing_map[ovr["sizing_h"]]
            if "align" in ovr and ovr["align"] in align_map:
                target.align = align_map[ovr["align"]]
            if "width" in ovr and ovr["width"] is not None:
                target.width = int(ovr["width"])
            if "height" in ovr and ovr["height"] is not None:
                target.height = int(ovr["height"])
            if "children_order" in ovr and isinstance(ovr["children_order"], list):
                new_order = ovr["children_order"]
                # Reorder children to match requested order
                child_map = {c.id: c for c in target.children}
                reordered = [child_map[cid] for cid in new_order if cid in child_map]
                # Append any children not in the new order list (safety)
                remaining = [c for c in target.children if c.id not in {cid for cid in new_order}]
                target.children = reordered + remaining

        # Re-layout
        from layout_v3 import layout_frame_diagram
        layout_result = layout_frame_diagram(frame_diagram)

        import diagram_render_svg
        svg_str = diagram_render_svg.render_svg(layout_result)

        # Build updated component tree for the editor
        tree_data = []
        if layout_result.component_tree:
            tree_data = [asdict(ci) for ci in layout_result.component_tree]

        # Clear layout cache for this slug so subsequent requests see fresh data
        cache_key = f"v3:{slug}"
        if cache_key in _layout_cache:
            del _layout_cache[cache_key]

        response = {"svg": svg_str, "tree": tree_data}

        # Return any engine-coerced overrides so the editor can persist them
        if layout_result.coerced_overrides:
            response["coerced_overrides"] = layout_result.coerced_overrides

        return response
    except Exception:
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
    global _rebuild_generation, _viewer_template, _force_template
    prev_mtimes = _collect_mtimes()
    while True:
        time.sleep(interval)
        curr_mtimes = _collect_mtimes()
        if curr_mtimes != prev_mtimes:
            prev_mtimes = curr_mtimes
            # Invalidate cached viewer template so HTML/CSS/JS changes are picked up
            _viewer_template = None
            _force_template = None
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

    diagram_options = "".join(
        f'<option value="/view/{slug}"{" selected" if current_path == f"/view/{slug}" else ""}>{slug}</option>'
        for slug in _list_diagrams()
    )
    if diagram_options:
        sections.append(f'<optgroup label="Diagrams">{diagram_options}</optgroup>')

    v3_options = "".join(
        f'<option value="/view/v3:{slug}"{" selected" if current_path == f"/view/v3:{slug}" else ""}>{slug}</option>'
        for slug in _list_v3_diagrams()
    )
    if v3_options:
        sections.append(f'<optgroup label="v3 Frame engine">{v3_options}</optgroup>')

    force_options = "".join(
        f'<option value="/force/view/{slug}"{" selected" if current_path == f"/force/view/{slug}" else ""}>{slug}</option>'
        for slug in _list_force_examples()
    )
    if force_options:
        sections.append(f'<optgroup label="Force demos">{force_options}</optgroup>')

    return "".join(sections)


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


def _build_viewer_html(slug: str, all_slugs: list[str], grid: bool) -> str:
    nav_options = _build_preview_nav_options(f"/view/{slug}")
    from diagram_shared import ARROW_HEAD_LENGTH, ARROW_HEAD_HALF_WIDTH, ICON_SIZE, GRID_GUTTER, INSET
    is_v3 = slug.startswith("v3:")
    real_slug = slug[3:] if is_v3 else slug
    engine = "v3" if is_v3 else "v2"
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
    html = _get_viewer_template()
    html = html.replace("%TITLE%", f"{slug} – diagram preview")
    html = html.replace(
        "%BF_STYLES%",
        '<link rel="stylesheet" href="/preview/bf-os.css">' if _has_bf_preview_assets() else "",
    )
    html = html.replace("%NAV_OPTIONS%", nav_options)
    html = html.replace("%NAV_LINKS%", nav_options)
    html = html.replace("%CONFIG_SCRIPT%", config_script)
    return html


def _build_force_viewer_html(slug: str, all_slugs: list[str]) -> str:
    nav_options = _build_preview_nav_options(f"/force/view/{slug}")
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
    html = _get_force_template()
    html = html.replace("%TITLE%", f"{slug} – force preview")
    html = html.replace(
        "%BF_STYLES%",
        '<link rel="stylesheet" href="/preview/bf-os.css">' if _has_bf_preview_assets() else "",
    )
    html = html.replace("%FORCE_OPTIONS%", nav_options)
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
        elif path.startswith("/api/grid/"):
            self._serve_grid(path[10:])
        elif path.startswith("/api/overrides/"):
            self._serve_overrides_get(path[15:])
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
        elif path.startswith("/api/relayout/"):
            self._serve_relayout(path[14:])
        elif path.startswith("/api/relayout-v3/"):
            self._serve_relayout_v3(path[17:])
        elif path.startswith("/api/force-reset/"):
            self._serve_force_reset(path[17:])
        elif path.startswith("/api/force-save/"):
            self._serve_force_save(path[16:])
        elif path.startswith("/api/force-node/"):
            self._serve_force_node_update(path[16:])
        elif path.startswith("/api/force-tick/"):
            self._serve_force_tick(path[16:])
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
            # Try pre-built SVG file first
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
        # Try v2 output first, then v3 pre-built
        svg_path = OUTPUT_SVG / safe_name
        if not svg_path.exists():
            svg_path = V3_SVG / safe_name
        if svg_path.exists():
            self._respond(200, "image/svg+xml", svg_path.read_bytes())
            return
        # No pre-built file — try on-the-fly v3 rendering
        slug = safe_name
        engine = None
        for suffix in ("-onbrand-v3.svg", "-onbrand-v3-grid.svg"):
            if slug.endswith(suffix):
                slug = slug[:-len(suffix)]
                engine = "v3"
                break
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

    def _serve_grid(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        info = _get_grid_info(slug)
        if info is None:
            self._respond(200, "application/json", b"null")
        else:
            self._respond(200, "application/json", json.dumps(info, indent=2).encode())

    def _serve_overrides_get(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
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
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
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
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        grid_overrides = {}
        for key in ("cols", "col_gap", "row_gap", "outer_margin"):
            if key in params and params[key] is not None:
                grid_overrides[key] = int(params[key])
        result = _relayout(slug, grid_overrides)
        if result is None:
            self.send_error(500, "Relayout failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

    def _serve_relayout_v3(self, slug: str):
        if not _is_safe_slug(slug):
            self.send_error(400, "Invalid slug")
            return
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        result = _relayout_v3(slug, params)
        if result is None:
            self.send_error(500, "v3 relayout failed")
            return
        self._respond(200, "application/json", json.dumps(result).encode())

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

        if x is not None and not math.isfinite(x):
            self.send_error(400, "Invalid x position")
            return
        if y is not None and not math.isfinite(y):
            self.send_error(400, "Invalid y position")
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
                style=(params["style"] if "style" in params else force_preview.STYLE_UNSET),
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
