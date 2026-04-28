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
    global _last_rebuild_error, _layout_cache
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
# Viewer HTML (f-string with {{ }} escaping for JS braces)
# ---------------------------------------------------------------------------

def _build_viewer_html(slug: str, all_slugs: list[str], grid: bool) -> str:
    nav_links = " ".join(
        f'<a href="/view/{s}" class="{"active" if s == slug else ""}">{s}</a>'
        for s in all_slugs
    )
    grid_js = "true" if grid else "false"
    # NOTE: all JS { } are doubled to {{ }} because this is a Python f-string.
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{slug} – diagram preview</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #1a1a1a;
       color: #e0e0e0; display: flex; height: 100vh; overflow: hidden; }}
.sidebar {{ width: 300px; min-width: 300px; background: #222; border-right: 1px solid #333;
           overflow-y: auto; padding: 16px; font-size: 13px;
           display: flex; flex-direction: column; gap: 12px; }}
.sidebar h2 {{ font-size: 12px; font-weight: 600; color: #777;
              text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }}
.nav-back {{ color: #6cc; text-decoration: none; font-size: 13px; }}
.nav-strip {{ display: flex; flex-wrap: wrap; gap: 4px; }}
.nav-strip a {{ color: #6cc; text-decoration: none; font-size: 11px; padding: 3px 6px;
               border-radius: 3px; background: #2a2a2a; }}
.nav-strip a:hover {{ background: #3a3a3a; }}
.nav-strip a.active {{ background: #E95420; color: #fff; }}
.build-status {{ padding: 6px 8px; border-radius: 4px; font-size: 11px; }}
.build-ok {{ background: #1a3a1a; color: #6c6; }}
.build-err {{ background: #3a1a1a; color: #c66; }}
.inspector {{ font-size: 12px; }}
.inspector .field {{ margin-bottom: 6px; }}
.inspector .label {{ color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }}
.inspector .value {{ color: #e0e0e0; font-family: 'Ubuntu Mono', monospace; font-size: 12px; }}
.inspector .override {{ color: #E95420; }}
.inspector button {{ font-size: 11px; padding: 3px 8px; border: 1px solid #555;
                    background: #2a2a2a; color: #e0e0e0; border-radius: 3px; cursor: pointer; }}
.inspector button:hover {{ background: #3a3a3a; }}
.inspector button.danger {{ border-color: #c66; color: #c66; }}
.tree {{ font-size: 12px; }}
.tree-item {{ padding: 2px 0; cursor: pointer; border-left: 2px solid transparent;
             padding-left: 8px; font-family: 'Ubuntu Mono', monospace; }}
.tree-item:hover {{ border-left-color: #555; }}
.tree-item.selected {{ border-left-color: #F6B73C; color: #F6B73C; }}
.stage {{ flex: 1; overflow: auto; display: flex; align-items: flex-start;
         justify-content: center; padding: 32px; }}
.stage svg {{ background: #fff; cursor: crosshair; }}
.stage svg [data-component-id] {{ cursor: pointer; }}
.stage svg [data-component-id] > text,
.stage svg [data-component-id] > image,
.stage svg [data-component-id] > tspan {{ pointer-events: none; }}
.stage svg g.dg-selected > rect:first-of-type {{ outline: 2px solid #F6B73C; outline-offset: -1px; }}
.stage svg g.dg-selected > line {{ filter: drop-shadow(0 0 2px #F6B73C); }}
.stage svg g.dg-selected > polygon {{ filter: drop-shadow(0 0 2px #F6B73C); }}
.stage svg g.dg-selected > .dg-icon {{ filter: drop-shadow(0 0 2px #F6B73C); }}
.stage svg g.dg-hover > rect:first-of-type {{ outline: 1px dashed #6cc; outline-offset: -1px; }}
.stage svg g.dg-hover > line {{ filter: drop-shadow(0 0 1px #6cc); }}
.stage svg g.dg-hover > .dg-icon {{ filter: drop-shadow(0 0 1px #6cc); }}
.stage svg .dg-icon > * {{ pointer-events: none; }}
.dg-handle {{ fill: #F6B73C; stroke: #fff; stroke-width: 1; cursor: pointer; pointer-events: all; }}
.dg-handle.dg-handle-tl {{ cursor: nw-resize; }}
.dg-handle.dg-handle-t {{ cursor: ns-resize; }}
.dg-handle.dg-handle-tr {{ cursor: ne-resize; }}
.dg-handle.dg-handle-r {{ cursor: ew-resize; }}
.dg-handle.dg-handle-br {{ cursor: nwse-resize; }}
.dg-handle.dg-handle-b {{ cursor: ns-resize; }}
.dg-handle.dg-handle-bl {{ cursor: nesw-resize; }}
.dg-handle.dg-handle-l {{ cursor: ew-resize; }}
.btn {{ font-size: 11px; padding: 3px 8px; border: 1px solid #555;
       background: #2a2a2a; color: #e0e0e0; border-radius: 3px; cursor: pointer; }}
.btn:hover {{ background: #3a3a3a; }}
.btn:disabled {{ opacity: 0.4; cursor: not-allowed; }}
.btn:disabled:hover {{ background: #2a2a2a; }}
.btn-save.dirty {{ background: #E95420; border-color: #E95420; color: #fff; }}
.btn-save.dirty:hover {{ background: #d44a1a; }}
.guide-badge {{ position: fixed; top: 8px; right: 8px; padding: 4px 10px;
               font-size: 11px; font-family: 'Ubuntu Mono', monospace;
               border-radius: 3px; pointer-events: none; z-index: 9999;
               display: none; }}
.guide-badge.composition {{ display: block; background: rgba(100,160,255,0.25); color: #9cf; }}
.guide-badge.baseline {{ display: block; background: rgba(100,255,160,0.25); color: #9f9; }}
.grid-controls {{ font-size: 12px; }}
.grid-controls .grid-row {{ display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }}
.grid-controls .grid-label {{ color: #666; font-size: 10px; text-transform: uppercase;
                             letter-spacing: 0.06em; min-width: 60px; }}
.grid-controls input[type=number] {{ width: 52px; padding: 2px 4px; font-size: 12px;
                                    font-family: 'Ubuntu Mono', monospace;
                                    background: #2a2a2a; color: #e0e0e0; border: 1px solid #555;
                                    border-radius: 3px; text-align: right; }}
.grid-controls input[type=number]:focus {{ border-color: #6cc; outline: none; }}
.grid-controls .unit {{ font-size: 10px; color: #555; }}
</style>
</head>
<body>
<div class="sidebar">
  <a class="nav-back" href="/">&#x2190; all diagrams</a>
  <div class="nav-strip">{nav_links}</div>
  <div class="build-status build-ok" id="build-status">Watching for changes&#x2026;</div>
  <h2>Inspector</h2>
  <div class="inspector" id="inspector">
    <div style="color:#555">Click a component to inspect it.</div>
  </div>
  <h2>Components</h2>
  <div class="tree" id="tree"></div>
  <h2>Grid</h2>
  <div class="grid-controls" id="grid-controls">
    <div class="grid-row"><span class="grid-label">Columns</span><input type="number" id="grid-cols" min="1" max="20" value="1"><span class="unit">cols</span></div>
    <div class="grid-row"><span class="grid-label">Rows</span><input type="number" id="grid-rows" min="1" max="40" value="1"><span class="unit">rows</span></div>
    <div class="grid-row"><span class="grid-label">Col gutter</span><input type="number" id="grid-col-gap" min="0" max="128" step="4" value="32"><span class="unit">px</span></div>
    <div class="grid-row"><span class="grid-label">Row gutter</span><input type="number" id="grid-row-gap" min="0" max="128" step="4" value="32"><span class="unit">px</span></div>
    <div class="grid-row"><span class="grid-label">Margin</span><input type="number" id="grid-margin" min="0" max="128" step="4" value="32"><span class="unit">px</span></div>
  </div>
  <h2>Overrides</h2>
  <div id="override-summary" style="font-size:11px;color:#666">No overrides.</div>
  <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
    <button class="btn btn-save" id="btn-save" disabled>Save</button>
    <button class="btn" id="btn-undo" disabled>Undo</button>
    <button class="btn" id="btn-redo" disabled>Redo</button>
    <button class="btn" id="btn-clear-all">Clear all</button>
    <button class="btn" id="btn-export">Export</button>
  </div>
</div>
<div class="stage" id="stage"></div>
<div class="guide-badge" id="guide-badge"></div>
<script>
"use strict";
const SLUG = "{slug}";
const GRID = {grid_js};
let generation = 0;
let componentTree = [];
let overrides = {{}};
let definitionHash = "";
let isStale = false;
let selectedIds = new Set();
let dragState = null;
let resizeState = null;
let isDirty = false;
const HANDLE_SIZE = 8;

// ---- Guide mode (W key) ----
const GUIDE_MODES = ["off", "composition", "baseline"];
let guideMode = "off";
let gridInfo = null;

// ---- Undo/Redo stack ----
let undoStack = [];
let redoStack = [];
let lastSavedState = null;
const MAX_UNDO_STACK_SIZE = 50;

async function loadSVG() {{
  const suffix = GRID ? "-v2-grid.svg" : "-v2.svg";
  const resp = await fetch("/svg/" + SLUG + "-onbrand" + suffix + "?t=" + Date.now());
  if (!resp.ok) return;
  document.getElementById("stage").innerHTML = await resp.text();
  await loadTree();
  await loadGridInfo();
  populateGridControls();
  await loadOverrides();
  applyAllOverrides();
  bindInteraction();
  renderGridOverlay();
  reapplySelection();
}}

async function loadTree() {{
  try {{
    const resp = await fetch("/api/tree/" + SLUG);
    if (resp.ok) componentTree = await resp.json();
  }} catch (e) {{ /* ignore */ }}
}}

async function loadGridInfo() {{
  try {{
    const resp = await fetch("/api/grid/" + SLUG);
    if (resp.ok) gridInfo = await resp.json();
  }} catch (e) {{ /* ignore */ }}
}}

function cycleGuideMode() {{
  const idx = GUIDE_MODES.indexOf(guideMode);
  guideMode = GUIDE_MODES[(idx + 1) % GUIDE_MODES.length];
  renderGridOverlay();
  const badge = document.getElementById("guide-badge");
  badge.className = "guide-badge " + guideMode;
  if (guideMode === "off") {{
    badge.textContent = "";
  }} else {{
    badge.textContent = "Grid: " + guideMode + " (W)";
  }}
}}

function renderGridOverlay() {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Remove existing overlay
  const existing = svg.querySelector("#dg-grid-overlay");
  if (existing) existing.remove();

  if (guideMode === "off" || !gridInfo) return;

  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g");
  g.id = "dg-grid-overlay";
  g.style.pointerEvents = "none";

  const vb = svg.viewBox.baseVal;
  const svgW = vb.width || parseFloat(svg.getAttribute("width") || svg.clientWidth);
  const svgH = vb.height || parseFloat(svg.getAttribute("height") || svg.clientHeight);
  const colXs = gridInfo.col_xs || [];
  const colWidths = gridInfo.col_widths || [];
  const rowYs = gridInfo.row_ys || [];
  const rowHeights = gridInfo.row_heights || [];
  const colGap = gridInfo.col_gap || 0;
  const rowGap = gridInfo.row_gap || 0;
  const margin = gridInfo.outer_margin || 0;

  // -- Margin overlays --
  const marginColor = "rgba(235,180,65,0.06)";
  // top
  if (margin > 0) {{
    addRect(g, ns, 0, 0, svgW, margin, marginColor);
    // bottom
    addRect(g, ns, 0, svgH - margin, svgW, margin, marginColor);
    // left
    addRect(g, ns, 0, margin, margin, svgH - 2 * margin, marginColor);
    // right
    addRect(g, ns, svgW - margin, margin, margin, svgH - 2 * margin, marginColor);
  }}

  // -- Content area dashed boundary --
  const boundary = document.createElementNS(ns, "rect");
  boundary.setAttribute("x", margin);
  boundary.setAttribute("y", margin);
  boundary.setAttribute("width", svgW - 2 * margin);
  boundary.setAttribute("height", svgH - 2 * margin);
  boundary.setAttribute("fill", "none");
  boundary.setAttribute("stroke", "rgba(255,255,255,0.18)");
  boundary.setAttribute("stroke-dasharray", "6 4");
  boundary.setAttribute("stroke-width", "1");
  g.appendChild(boundary);

  // -- Column bands --
  const colFill = "rgba(100,160,255,0.04)";
  const keylineColor = "rgba(100,160,255,0.22)";
  for (let c = 0; c < colXs.length; c++) {{
    const cx = colXs[c];
    const cw = c < colWidths.length ? colWidths[c] : colWidths[colWidths.length - 1];
    // Column fill
    addRect(g, ns, cx, margin, cw, svgH - 2 * margin, colFill);
    // Left keyline
    const kl = document.createElementNS(ns, "line");
    kl.setAttribute("x1", cx); kl.setAttribute("y1", margin);
    kl.setAttribute("x2", cx); kl.setAttribute("y2", svgH - margin);
    kl.setAttribute("stroke", keylineColor); kl.setAttribute("stroke-width", "0.5");
    g.appendChild(kl);
    // Right keyline
    const kr = document.createElementNS(ns, "line");
    kr.setAttribute("x1", cx + cw); kr.setAttribute("y1", margin);
    kr.setAttribute("x2", cx + cw); kr.setAttribute("y2", svgH - margin);
    kr.setAttribute("stroke", keylineColor); kr.setAttribute("stroke-width", "0.5");
    g.appendChild(kr);
    // Column gutter highlight (between columns)
    if (c < colXs.length - 1 && colGap > 0) {{
      addRect(g, ns, cx + cw, margin, colGap, svgH - 2 * margin, "rgba(255,100,100,0.03)");
    }}
  }}

  // -- Row bands --
  const rowFill = "rgba(100,255,160,0.03)";
  const rowLine = "rgba(100,255,160,0.15)";
  for (let r = 0; r < rowYs.length; r++) {{
    const ry = rowYs[r];
    const rh = r < rowHeights.length ? rowHeights[r] : rowHeights[rowHeights.length - 1];
    // Row top line
    const rl = document.createElementNS(ns, "line");
    rl.setAttribute("x1", margin); rl.setAttribute("y1", ry);
    rl.setAttribute("x2", svgW - margin); rl.setAttribute("y2", ry);
    rl.setAttribute("stroke", rowLine); rl.setAttribute("stroke-width", "0.5");
    g.appendChild(rl);
    // Row bottom line
    const rb = document.createElementNS(ns, "line");
    rb.setAttribute("x1", margin); rb.setAttribute("y1", ry + rh);
    rb.setAttribute("x2", svgW - margin); rb.setAttribute("y2", ry + rh);
    rb.setAttribute("stroke", rowLine); rb.setAttribute("stroke-width", "0.5");
    g.appendChild(rb);
    // Row gutter highlight (between rows)
    if (r < rowYs.length - 1 && rowGap > 0) {{
      addRect(g, ns, margin, ry + rh, svgW - 2 * margin, rowGap, "rgba(255,100,100,0.03)");
    }}
  }}

  // -- Baseline grid (4px lines, shown only in "baseline" mode) --
  if (guideMode === "baseline") {{
    const baselineStep = 4;
    const baselineColor = "rgba(255,255,255,0.07)";
    for (let y = margin; y <= svgH - margin; y += baselineStep) {{
      const bl = document.createElementNS(ns, "line");
      bl.setAttribute("x1", margin); bl.setAttribute("y1", y);
      bl.setAttribute("x2", svgW - margin); bl.setAttribute("y2", y);
      bl.setAttribute("stroke", baselineColor); bl.setAttribute("stroke-width", "0.25");
      g.appendChild(bl);
    }}
  }}

  // Insert overlay just before the closing of the SVG so it sits on top
  svg.appendChild(g);
}}

function addRect(parent, ns, x, y, w, h, fill) {{
  const r = document.createElementNS(ns, "rect");
  r.setAttribute("x", x); r.setAttribute("y", y);
  r.setAttribute("width", w); r.setAttribute("height", h);
  r.setAttribute("fill", fill);
  parent.appendChild(r);
}}

function populateGridControls() {{
  if (!gridInfo) return;
  document.getElementById("grid-cols").value = (gridInfo.col_xs || []).length;
  document.getElementById("grid-rows").value = (gridInfo.row_ys || []).length;
  document.getElementById("grid-col-gap").value = gridInfo.col_gap || 0;
  document.getElementById("grid-row-gap").value = gridInfo.row_gap || 0;
  document.getElementById("grid-margin").value = gridInfo.outer_margin || 0;
}}

let relayoutTimer = null;

function onGridControlChange() {{
  if (!gridInfo) return;
  const colGap = Math.max(0, parseInt(document.getElementById("grid-col-gap").value) || 0);
  const rowGap = Math.max(0, parseInt(document.getElementById("grid-row-gap").value) || 0);
  const margin = Math.max(0, parseInt(document.getElementById("grid-margin").value) || 0);

  // Debounce the relayout call so rapid typing doesn't flood the server
  if (relayoutTimer) clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(() => requestRelayout(colGap, rowGap, margin), 200);

  // Immediately update the grid overlay from the input values (local recompute)
  updateGridOverlayFromInputs();
}}

function updateGridOverlayFromInputs() {{
  const cols = Math.max(1, parseInt(document.getElementById("grid-cols").value) || 1);
  const rows = Math.max(1, parseInt(document.getElementById("grid-rows").value) || 1);
  const colGap = Math.max(0, parseInt(document.getElementById("grid-col-gap").value) || 0);
  const rowGap = Math.max(0, parseInt(document.getElementById("grid-row-gap").value) || 0);
  const margin = Math.max(0, parseInt(document.getElementById("grid-margin").value) || 0);

  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  const svgW = vb.width || parseFloat(svg.getAttribute("width") || svg.clientWidth);
  const svgH = vb.height || parseFloat(svg.getAttribute("height") || svg.clientHeight);

  const contentW = svgW - 2 * margin;
  const contentH = svgH - 2 * margin;
  const colW = cols > 1 ? Math.floor((contentW - (cols - 1) * colGap) / cols) : contentW;
  const rowH = rows > 1 ? Math.floor((contentH - (rows - 1) * rowGap) / rows) : contentH;

  const newColXs = [];
  for (let c = 0; c < cols; c++) newColXs.push(margin + c * (colW + colGap));
  const newColWidths = Array(cols).fill(colW);

  const newRowYs = [];
  for (let r = 0; r < rows; r++) newRowYs.push(margin + r * (rowH + rowGap));
  const newRowHeights = Array(rows).fill(rowH);

  gridInfo = {{
    col_xs: newColXs, col_widths: newColWidths,
    row_ys: newRowYs, row_heights: newRowHeights,
    col_gap: colGap, row_gap: rowGap, outer_margin: margin,
  }};
  renderGridOverlay();
}}

async function requestRelayout(colGap, rowGap, margin) {{
  try {{
    const resp = await fetch("/api/relayout/" + SLUG, {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify({{ col_gap: colGap, row_gap: rowGap, outer_margin: margin }}),
    }});
    if (!resp.ok) return;
    const data = await resp.json();
    // Replace SVG in stage
    document.getElementById("stage").innerHTML = data.svg;
    // Update component tree
    if (data.tree) componentTree = data.tree;
    // Update grid info from the actual layout result
    if (data.grid_info) {{
      gridInfo = data.grid_info;
      populateGridControls();
    }}
    // Re-apply overrides and interaction on the new SVG
    applyAllOverrides();
    bindInteraction();
    renderGridOverlay();
    reapplySelection();
    // Rebuild component tree in sidebar
    buildTreeUI();
  }} catch (e) {{ /* ignore relayout errors */ }}
}}

// Bind grid control events
["grid-cols", "grid-rows", "grid-col-gap", "grid-row-gap", "grid-margin"].forEach(id => {{
  document.getElementById(id).addEventListener("input", onGridControlChange);
}});

async function loadOverrides() {{
  try {{
    const resp = await fetch("/api/overrides/" + SLUG);
    if (resp.ok) {{
      const data = await resp.json();
      overrides = data.overrides || {{}};
      definitionHash = data.definition_hash || "";
      isStale = data.stale || false;
    }}
  }} catch (e) {{ /* ignore */ }}
  updateOverrideSummary();
  // Initialize undo stack and saved state
  undoStack = [];
  redoStack = [];
  lastSavedState = JSON.stringify(overrides);
  updateUndoRedoButtons();
}}

// ---- Undo/Redo functions ----

function recordSnapshot() {{
  // Record current state to undo stack (call BEFORE making the change)
  const currentState = JSON.stringify(overrides);
  if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentState) {{
    undoStack.push(currentState);
    // Cap stack size
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {{
      undoStack.shift();
    }}
    // Clear redo stack when new action is performed
    redoStack = [];
    updateUndoRedoButtons();
  }}
}}

function canUndo() {{
  return undoStack.length > 0;
}}

function canRedo() {{
  return redoStack.length > 0;
}}

function performUndo() {{
  if (!canUndo()) return;
  
  // Save current state to redo stack before undoing
  const currentState = JSON.stringify(overrides);
  redoStack.push(currentState);
  
  // Restore previous state
  const previousState = undoStack.pop();
  overrides = JSON.parse(previousState);
  
  // Update UI
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  updateOverrideSummary();
  refreshTreeColors();
  
  // Update dirty flag
  const currentStateStr = JSON.stringify(overrides);
  setDirty(currentStateStr !== lastSavedState);
  
  updateUndoRedoButtons();
}}

function performRedo() {{
  if (!canRedo()) return;
  
  // Save current state to undo stack before redoing
  const currentState = JSON.stringify(overrides);
  undoStack.push(currentState);
  
  // Restore next state
  const nextState = redoStack.pop();
  overrides = JSON.parse(nextState);
  
  // Update UI
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  updateOverrideSummary();
  refreshTreeColors();
  
  // Update dirty flag
  const currentStateStr = JSON.stringify(overrides);
  setDirty(currentStateStr !== lastSavedState);
  
  updateUndoRedoButtons();
}}

function updateUndoRedoButtons() {{
  const undoBtn = document.getElementById("btn-undo");
  const redoBtn = document.getElementById("btn-redo");
  if (undoBtn) undoBtn.disabled = !canUndo();
  if (redoBtn) redoBtn.disabled = !canRedo();
}}

// ---- Override application ----

function getOwnDelta(cid) {{
  const o = overrides[cid] || {{}};
  return {{ dx: o.dx || 0, dy: o.dy || 0, dw: o.dw || 0, dh: o.dh || 0 }};
}}

function getAncestors(cid) {{
  const path = [];
  function walk(nodes, trail) {{
    for (const node of nodes) {{
      if (node.id === cid) {{ path.push(...trail); return true; }}
      if (node.children && node.children.length > 0) {{
        if (walk(node.children, [...trail, node.id])) return true;
      }}
    }}
    return false;
  }}
  walk(componentTree, []);
  return path;
}}

function getDescendantIds(cid) {{
  const result = [];
  function findNode(nodes) {{
    for (const node of nodes) {{
      if (node.id === cid) {{ collectAll(node.children || [], result); return true; }}
      if (node.children && findNode(node.children)) return true;
    }}
    return false;
  }}
  function collectAll(nodes, acc) {{
    for (const node of nodes) {{ acc.push(node.id); if (node.children) collectAll(node.children, acc); }}
  }}
  findNode(componentTree);
  return result;
}}

function getEffectiveDelta(cid) {{
  let dx = 0, dy = 0;
  for (const aid of getAncestors(cid)) {{
    const d = overrides[aid];
    if (d) {{ dx += (d.dx || 0); dy += (d.dy || 0); }}
  }}
  const own = overrides[cid];
  if (own) {{ dx += (own.dx || 0); dy += (own.dy || 0); }}
  return {{ dx, dy, dw: own ? (own.dw || 0) : 0, dh: own ? (own.dh || 0) : 0 }};
}}

function applyAllOverrides() {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Reset transforms
  svg.querySelectorAll("[data-component-id]").forEach(g => {{ g.style.transform = ""; }});
  // Restore original rect sizes
  svg.querySelectorAll("rect[data-orig-width]").forEach(r => {{
    r.setAttribute("width", r.getAttribute("data-orig-width"));
    r.setAttribute("height", r.getAttribute("data-orig-height"));
  }});
  // Restore original icon transforms
  svg.querySelectorAll(".dg-icon[data-orig-tx]").forEach(icon => {{
    icon.setAttribute("transform", "translate(" + icon.getAttribute("data-orig-tx") + " " + icon.getAttribute("data-orig-ty") + ")");
  }});
  // Restore original arrow line coords
  svg.querySelectorAll("line[data-orig-x1]").forEach(ln => {{
    ln.setAttribute("x1", ln.getAttribute("data-orig-x1"));
    ln.setAttribute("y1", ln.getAttribute("data-orig-y1"));
    ln.setAttribute("x2", ln.getAttribute("data-orig-x2"));
    ln.setAttribute("y2", ln.getAttribute("data-orig-y2"));
  }});
  svg.querySelectorAll("polygon[data-orig-points]").forEach(p => {{
    p.setAttribute("points", p.getAttribute("data-orig-points"));
  }});
  // Save original sizes on first pass
  svg.querySelectorAll("[data-component-id] > rect:first-of-type").forEach(r => {{
    if (!r.hasAttribute("data-orig-width")) {{
      r.setAttribute("data-orig-width", r.getAttribute("width") || "0");
      r.setAttribute("data-orig-height", r.getAttribute("height") || "0");
    }}
  }});

  function applyToComponent(cid) {{
    const eff = getEffectiveDelta(cid);
    svg.querySelectorAll('[data-component-id="' + cid + '"]').forEach(g => {{
      if (eff.dx !== 0 || eff.dy !== 0) {{
        g.style.transform = "translate(" + eff.dx + "px, " + eff.dy + "px)";
      }}
      if (eff.dw !== 0 || eff.dh !== 0) {{
        const rect = g.querySelector("rect:first-of-type");
        if (rect) {{
          const origW = parseFloat(rect.getAttribute("data-orig-width") || rect.getAttribute("width"));
          const origH = parseFloat(rect.getAttribute("data-orig-height") || rect.getAttribute("height"));
          rect.setAttribute("width", Math.max(32, origW + eff.dw));
          rect.setAttribute("height", Math.max(32, origH + eff.dh));
        }}
        // Re-anchor top-right icons when width changes
        if (eff.dw !== 0) {{
          g.querySelectorAll(".dg-icon").forEach(icon => {{
            if (!icon.hasAttribute("data-orig-tx")) {{
              const m = (icon.getAttribute("transform") || "").match(/translate\(([\\d.e+-]+)[, ]\\s*([\\d.e+-]+)\)/);
              if (m) {{
                icon.setAttribute("data-orig-tx", m[1]);
                icon.setAttribute("data-orig-ty", m[2]);
              }}
            }}
            const otx = parseFloat(icon.getAttribute("data-orig-tx") || "0");
            const oty = parseFloat(icon.getAttribute("data-orig-ty") || "0");
            icon.setAttribute("transform", "translate(" + (otx + eff.dw) + " " + oty + ")");
          }});
        }}
      }}
    }});
  }}
  // Apply to tree components
  function visit(nodes) {{
    for (const node of nodes) {{
      if (node.type !== "arrow") applyToComponent(node.id);
      if (node.children) visit(node.children);
    }}
  }}
  visit(componentTree);
  // Also handle overrides outside tree
  for (const cid of Object.keys(overrides)) applyToComponent(cid);

  // Arrow attachment: adjust arrow positions based on source/target box overrides
  for (const node of componentTree) {{
    if (node.type !== "arrow" || (!node.source && !node.target)) continue;
    const srcCid = node.source ? node.source.split(".")[0] : "";
    const srcSide = node.source ? node.source.split(".").pop() : "";
    const tgtCid = node.target ? node.target.split(".")[0] : "";
    const tgtSide = node.target ? node.target.split(".").pop() : "";

    // Compute the endpoint deltas from source/target box overrides
    const srcEff = srcCid ? getEffectiveDelta(srcCid) : {{ dx: 0, dy: 0, dw: 0, dh: 0 }};
    const tgtEff = tgtCid ? getEffectiveDelta(tgtCid) : {{ dx: 0, dy: 0, dw: 0, dh: 0 }};

    // Side-aware endpoint shift: midpoint of the side shifts with dx/dy + half of dw/dh
    function sideShift(eff, side) {{
      let sdx = eff.dx, sdy = eff.dy;
      if (side === "bottom") sdy += eff.dh;
      if (side === "top") {{}} // top edge doesn't move on dh
      if (side === "right") sdx += eff.dw;
      if (side === "left") {{}} // left edge doesn't move on dw
      // Side midpoint shifts by half the perpendicular size delta
      if (side === "top" || side === "bottom") sdx += eff.dw / 2;
      if (side === "left" || side === "right") sdy += eff.dh / 2;
      return {{ dx: sdx, dy: sdy }};
    }}

    const srcShift = sideShift(srcEff, srcSide);
    const tgtShift = sideShift(tgtEff, tgtSide);

    // If both shifts are the same, just CSS-translate the whole arrow group
    if (srcShift.dx === tgtShift.dx && srcShift.dy === tgtShift.dy) {{
      if (srcShift.dx !== 0 || srcShift.dy !== 0) {{
        svg.querySelectorAll('[data-component-id="' + node.id + '"]').forEach(g => {{
          g.style.transform = "translate(" + srcShift.dx + "px, " + srcShift.dy + "px)";
        }});
      }}
    }} else {{
      // Different shifts for source vs target → modify individual line coords
      svg.querySelectorAll('[data-component-id="' + node.id + '"]').forEach(g => {{
        const lines = g.querySelectorAll("line");
        const polys = g.querySelectorAll("polygon");
        if (lines.length === 0) return;

        // Save original coords on first pass
        lines.forEach(ln => {{
          if (!ln.hasAttribute("data-orig-x1")) {{
            ln.setAttribute("data-orig-x1", ln.getAttribute("x1"));
            ln.setAttribute("data-orig-y1", ln.getAttribute("y1"));
            ln.setAttribute("data-orig-x2", ln.getAttribute("x2"));
            ln.setAttribute("data-orig-y2", ln.getAttribute("y2"));
          }}
        }});
        polys.forEach(p => {{
          if (!p.hasAttribute("data-orig-points")) {{
            p.setAttribute("data-orig-points", p.getAttribute("points"));
          }}
        }});

        // Restore originals before applying new shifts
        lines.forEach(ln => {{
          ln.setAttribute("x1", ln.getAttribute("data-orig-x1"));
          ln.setAttribute("y1", ln.getAttribute("data-orig-y1"));
          ln.setAttribute("x2", ln.getAttribute("data-orig-x2"));
          ln.setAttribute("y2", ln.getAttribute("data-orig-y2"));
        }});
        polys.forEach(p => {{
          p.setAttribute("points", p.getAttribute("data-orig-points"));
        }});

        // The visible lines are those NOT used as hit areas (not transparent)
        const visLines = Array.from(lines).filter(ln => ln.getAttribute("stroke") !== "transparent");
        const hitLines = Array.from(lines).filter(ln => ln.getAttribute("stroke") === "transparent");

        if (visLines.length === 0) return;

        // First visible line starts from source, last visible line ends at target
        // Shift first line's start by srcShift, last line's end by tgtShift
        // For intermediate waypoints, interpolate or shift by srcShift
        const first = visLines[0];
        const last = visLines[visLines.length - 1];

        // Shift source end (first line start)
        const fx1 = parseFloat(first.getAttribute("x1")) + srcShift.dx;
        const fy1 = parseFloat(first.getAttribute("y1")) + srcShift.dy;
        first.setAttribute("x1", fx1);
        first.setAttribute("y1", fy1);

        // Shift target end (last line end)
        const lx2 = parseFloat(last.getAttribute("x2")) + tgtShift.dx;
        const ly2 = parseFloat(last.getAttribute("y2")) + tgtShift.dy;
        last.setAttribute("x2", lx2);
        last.setAttribute("y2", ly2);

        // For multi-segment arrows, adjust waypoints (shared endpoints between segments)
        if (visLines.length > 1) {{
          // Shift intermediate connections: line end/next line start
          // Linearly interpolate between source and target shifts for waypoints
          for (let i = 0; i < visLines.length; i++) {{
            const t = visLines.length > 1 ? i / (visLines.length - 1) : 0;
            const nt = visLines.length > 1 ? (i + 1) / (visLines.length - 1) : 1;
            const wdx = srcShift.dx + t * (tgtShift.dx - srcShift.dx);
            const wdy = srcShift.dy + t * (tgtShift.dy - srcShift.dy);
            const wdx2 = srcShift.dx + nt * (tgtShift.dx - srcShift.dx);
            const wdy2 = srcShift.dy + nt * (tgtShift.dy - srcShift.dy);

            if (i > 0) {{
              // Adjust start of this segment (= waypoint)
              visLines[i].setAttribute("x1", parseFloat(visLines[i].getAttribute("data-orig-x1") || visLines[i].getAttribute("x1")) + wdx);
              visLines[i].setAttribute("y1", parseFloat(visLines[i].getAttribute("data-orig-y1") || visLines[i].getAttribute("y1")) + wdy);
            }}
            if (i < visLines.length - 1) {{
              // Adjust end of this segment (= waypoint)
              visLines[i].setAttribute("x2", parseFloat(visLines[i].getAttribute("data-orig-x2") || visLines[i].getAttribute("x2")) + wdx2);
              visLines[i].setAttribute("y2", parseFloat(visLines[i].getAttribute("data-orig-y2") || visLines[i].getAttribute("y2")) + wdy2);
            }}
          }}
        }}

        // Shift arrowhead polygon by target shift
        polys.forEach(p => {{
          const origPts = p.getAttribute("data-orig-points");
          const shifted = origPts.split(/[, ]+/).reduce((acc, v, i) => {{
            if (i % 2 === 0) acc.push(parseFloat(v) + tgtShift.dx);
            else acc[acc.length - 1] = acc[acc.length - 1] + "," + (parseFloat(v) + tgtShift.dy);
            return acc;
          }}, []).join(" ");
          p.setAttribute("points", shifted);
        }});

        // Update hit-area lines to match
        hitLines.forEach((hl, i) => {{
          if (i < visLines.length) {{
            hl.setAttribute("x1", visLines[i].getAttribute("x1"));
            hl.setAttribute("y1", visLines[i].getAttribute("y1"));
            hl.setAttribute("x2", visLines[i].getAttribute("x2"));
            hl.setAttribute("y2", visLines[i].getAttribute("y2"));
          }}
        }});
      }});
    }}
  }}

  // Refresh resize handles if selected
  if (selectedIds.size > 0) showResizeHandles([...selectedIds].pop());
}}

// ---- Interaction ----

function buildTreeUI() {{
  const treeEl = document.getElementById("tree");
  treeEl.innerHTML = "";
  function buildTree(nodes, container, depth) {{
    for (const node of nodes) {{
      const item = document.createElement("div");
      item.className = "tree-item";
      item.style.paddingLeft = (8 + depth * 12) + "px";
      item.textContent = node.id;
      if (overrides[node.id]) item.style.color = "#E95420";
      item.onclick = (e) => {{ e.stopPropagation(); selectComponent(node.id, e.shiftKey); }};
      container.appendChild(item);
      if (node.children && node.children.length > 0) buildTree(node.children, container, depth + 1);
    }}
  }}
  buildTree(componentTree, treeEl, 0);
}}

function bindInteraction() {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;

  // Add invisible wider hit-area lines for arrow and separator components
  const ns = "http://www.w3.org/2000/svg";
  svg.querySelectorAll("[data-component-id]").forEach(g => {{
    const hasRect = g.querySelector("rect");
    const lines = g.querySelectorAll("line");
    const icons = g.querySelectorAll(".dg-icon");
    if (lines.length > 0 && !hasRect) {{
      // Arrow or separator group (lines, no rect) – add wider hit areas
      lines.forEach(ln => {{
        if (ln.style.pointerEvents === "stroke") return; // already a hit area
        const hit = document.createElementNS(ns, "line");
        hit.setAttribute("x1", ln.getAttribute("x1"));
        hit.setAttribute("y1", ln.getAttribute("y1"));
        hit.setAttribute("x2", ln.getAttribute("x2"));
        hit.setAttribute("y2", ln.getAttribute("y2"));
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "12");
        hit.style.pointerEvents = "stroke";
        g.insertBefore(hit, g.firstChild);
      }});
    }}
    if (icons.length > 0 && !hasRect) {{
      // Icon cluster (icons, no rect) – add invisible rect hit area
      const bbox = g.getBBox();
      const hit = document.createElementNS(ns, "rect");
      hit.setAttribute("x", bbox.x);
      hit.setAttribute("y", bbox.y);
      hit.setAttribute("width", bbox.width);
      hit.setAttribute("height", bbox.height);
      hit.setAttribute("fill", "transparent");
      hit.style.pointerEvents = "fill";
      g.insertBefore(hit, g.firstChild);
    }}
  }});

  // Build tree sidebar
  buildTreeUI();

  // Mouse handlers on SVG
  svg.addEventListener("mousedown", onSvgMouseDown);
  svg.addEventListener("mouseover", (e) => {{
    if (dragState) return;
    
    // Find the deepest component at hover point (same logic as click)
    const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
    let deepestComponent = null;
    let maxDepth = -1;
    
    for (const el of elementsAtPoint) {{
      const componentEl = el.closest("[data-component-id]");
      if (componentEl) {{
        // Calculate depth by counting parent elements
        let depth = 0;
        let parent = componentEl.parentElement;
        while (parent && parent !== svg) {{
          depth++;
          parent = parent.parentElement;
        }}
        if (depth > maxDepth) {{
          maxDepth = depth;
          deepestComponent = componentEl;
        }}
      }}
    }}
    
    if (deepestComponent) {{
      svg.querySelectorAll(".dg-hover").forEach(el => el.classList.remove("dg-hover"));
      svg.querySelectorAll('[data-component-id="' + deepestComponent.dataset.componentId + '"]')
        .forEach(el => el.classList.add("dg-hover"));
    }}
  }});
  svg.addEventListener("mouseout", () => {{
    if (!dragState) {{
      svg.querySelectorAll(".dg-hover").forEach(el => el.classList.remove("dg-hover"));
    }}
  }});
}}

// ---- Drag (move) ----

function onSvgMouseDown(e) {{
  // Check if clicking a resize handle
  if (e.target.classList.contains("dg-handle")) {{
    startResize(e);
    return;
  }}
  
  // Find the deepest (innermost) component at the click point
  const svg = document.querySelector("#stage svg");
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  
  // Get all elements at this point and find the deepest one with data-component-id
  const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
  let deepestComponent = null;
  let maxDepth = -1;
  
  for (const el of elementsAtPoint) {{
    const componentEl = el.closest("[data-component-id]");
    if (componentEl) {{
      // Calculate depth by counting parent elements
      let depth = 0;
      let parent = componentEl.parentElement;
      while (parent && parent !== svg) {{
        depth++;
        parent = parent.parentElement;
      }}
      if (depth > maxDepth) {{
        maxDepth = depth;
        deepestComponent = componentEl;
      }}
    }}
  }}
  
  if (!deepestComponent || e.button !== 0) return;
  const cid = deepestComponent.dataset.componentId;

  // Shift+click: toggle additive selection, no drag
  if (e.shiftKey) {{
    selectComponent(cid, true);
    e.preventDefault();
    return;
  }}

  // Determine which components to drag
  let dragCids;
  if (selectedIds.has(cid)) {{
    dragCids = [...selectedIds];
  }} else {{
    dragCids = [cid];
  }}
  const origDeltas = {{}};
  for (const id of dragCids) {{
    const own = getOwnDelta(id);
    origDeltas[id] = {{ dx: own.dx, dy: own.dy }};
  }}
  dragState = {{ cid, cids: dragCids, startX: e.clientX, startY: e.clientY,
                origDeltas, hasMoved: false, snapshotRecorded: false }};
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragUp);
  e.preventDefault();
}}

function onDragMove(e) {{
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragState.hasMoved = true;
  if (!dragState.hasMoved) return;
  // Record pre-drag snapshot on first actual move
  if (!dragState.snapshotRecorded) {{
    recordSnapshot();
    dragState.snapshotRecorded = true;
  }}
  for (const id of dragState.cids) {{
    const orig = dragState.origDeltas[id];
    const newDx = Math.round((orig.dx + dx) / 4) * 4;
    const newDy = Math.round((orig.dy + dy) / 4) * 4;
    setOverride(id, {{ dx: newDx, dy: newDy }});
  }}
  applyAllOverrides();
  if (selectedIds.has(dragState.cid) && selectedIds.size === 1) updateInspector(dragState.cid);
}}

function onDragUp() {{
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragUp);
  if (dragState && dragState.hasMoved) {{
    for (const id of dragState.cids) cleanOverride(id);
    if (dragState.cids.length === 1) {{
      selectComponent(dragState.cid);
    }} else {{
      reapplySelection();
    }}
  }} else if (dragState) {{
    selectComponent(dragState.cid);
  }}
  dragState = null;
}}

// ---- Resize ----

function getComponentType(cid) {{
  function find(nodes) {{
    for (const n of nodes) {{
      if (n.id === cid) return n.type;
      if (n.children) {{ const r = find(n.children); if (r) return r; }}
    }}
    return null;
  }}
  return find(componentTree) || "Box";
}}

function showResizeHandles(cid) {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Remove old handles
  svg.querySelectorAll(".dg-handle").forEach(h => h.remove());
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  if (groups.length === 0) return;
  // Compute union bbox accounting for transform
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {{
    const bbox = g.getBBox();
    const ctm = g.getCTM();
    const svgCtm = svg.getCTM();
    // getBBox is in local coords; transform to SVG root coords
    const pt = svg.createSVGPoint();
    pt.x = bbox.x; pt.y = bbox.y;
    const tl = pt.matrixTransform(g.getScreenCTM().inverse().multiply(g.getScreenCTM()));
    // Simpler: use the effective delta
    const eff = getEffectiveDelta(cid);
    minX = Math.min(minX, bbox.x + eff.dx);
    minY = Math.min(minY, bbox.y + eff.dy);
    maxX = Math.max(maxX, bbox.x + bbox.width + eff.dx);
    maxY = Math.max(maxY, bbox.y + bbox.height + eff.dy);
  }});
  const hs = HANDLE_SIZE;
  const ns = "http://www.w3.org/2000/svg";
  function mkHandle(cx, cy, cls, axis) {{
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", cx - hs / 2);
    r.setAttribute("y", cy - hs / 2);
    r.setAttribute("width", hs);
    r.setAttribute("height", hs);
    r.setAttribute("class", "dg-handle " + cls);
    r.setAttribute("data-resize-cid", cid);
    r.setAttribute("data-resize-axis", axis);
    svg.appendChild(r);
  }}
  const ctype = getComponentType(cid);
  const isHLine = ctype === "Separator";
  const isArrow = ctype === "arrow";
  if (isHLine) {{
    // Horizontal line: left and right edge handles only
    mkHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
    mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
  }} else if (isArrow) {{
    // Arrow: resize along primary axis only
    const w = maxX - minX;
    const h = maxY - minY;
    if (w > h) {{
      // Primarily horizontal
      mkHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
      mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
    }} else {{
      // Primarily vertical
      mkHandle((minX + maxX) / 2, minY, "dg-handle-t", "t");
      mkHandle((minX + maxX) / 2, maxY, "dg-handle-b", "b");
    }}
  }} else {{
    // 2D component: all 8 handles
    mkHandle(minX, minY, "dg-handle-tl", "tl");
    mkHandle((minX + maxX) / 2, minY, "dg-handle-t", "t");
    mkHandle(maxX, minY, "dg-handle-tr", "tr");
    mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
    mkHandle(maxX, maxY, "dg-handle-br", "br");
    mkHandle((minX + maxX) / 2, maxY, "dg-handle-b", "b");
    mkHandle(minX, maxY, "dg-handle-bl", "bl");
    mkHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
  }}
}}

function removeResizeHandles() {{
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.remove());
}}

function startResize(e) {{
  const handle = e.target;
  const cid = handle.getAttribute("data-resize-cid");
  const axis = handle.getAttribute("data-resize-axis");
  const own = getOwnDelta(cid);
  resizeState = {{
    cid, axis,
    startX: e.clientX, startY: e.clientY,
    origDx: own.dx, origDy: own.dy,
    origDw: own.dw, origDh: own.dh,
    hasMoved: false, snapshotRecorded: false,
  }};
  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", onResizeUp);
  e.preventDefault();
  e.stopPropagation();
}}

function onResizeMove(e) {{
  if (!resizeState) return;
  const dx = e.clientX - resizeState.startX;
  const dy = e.clientY - resizeState.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) resizeState.hasMoved = true;
  if (!resizeState.hasMoved) return;
  // Record pre-resize snapshot on first actual move
  if (!resizeState.snapshotRecorded) {{
    recordSnapshot();
    resizeState.snapshotRecorded = true;
  }}
  let newDx = resizeState.origDx;
  let newDy = resizeState.origDy;
  let newDw = resizeState.origDw;
  let newDh = resizeState.origDh;
  
  const axis = resizeState.axis;
  // Handle horizontal resizing
  if (axis === "l" || axis === "tl" || axis === "bl") {{
    // Left side: move left edge, right edge stays anchored
    const delta = Math.round(dx / 4) * 4;
    newDx = resizeState.origDx + delta;
    newDw = resizeState.origDw - delta;
  }} else if (axis === "r" || axis === "tr" || axis === "br") {{
    // Right side: left edge stays anchored, grow rightward
    newDw = Math.round((resizeState.origDw + dx) / 4) * 4;
  }}
  
  // Handle vertical resizing
  if (axis === "t" || axis === "tl" || axis === "tr") {{
    // Top side: move top edge, bottom edge stays anchored
    const delta = Math.round(dy / 4) * 4;
    newDy = resizeState.origDy + delta;
    newDh = resizeState.origDh - delta;
  }} else if (axis === "b" || axis === "bl" || axis === "br") {{
    // Bottom side: top edge stays anchored, grow downward
    newDh = Math.round((resizeState.origDh + dy) / 4) * 4;
  }}
  
  setOverride(resizeState.cid, {{ dx: newDx, dy: newDy, dw: newDw, dh: newDh }});
  applyAllOverrides();
  if (selectedIds.has(resizeState.cid)) updateInspector(resizeState.cid);
}}

function onResizeUp() {{
  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", onResizeUp);
  if (resizeState && resizeState.hasMoved) {{
    cleanOverride(resizeState.cid);
    selectComponent(resizeState.cid);
  }}
  resizeState = null;
}}

// ---- Override helpers ----

function setOverride(cid, partial) {{
  const prev = overrides[cid] || {{}};
  overrides[cid] = {{ dx: prev.dx || 0, dy: prev.dy || 0, dw: prev.dw || 0, dh: prev.dh || 0, ...partial }};
  setDirty(true);
}}

function cleanOverride(cid) {{
  const o = overrides[cid];
  if (!o) return;
  if ((o.dx || 0) === 0 && (o.dy || 0) === 0 && (o.dw || 0) === 0 && (o.dh || 0) === 0) {{
    delete overrides[cid];
  }}
}}

// ---- Selection & Inspector ----

function selectComponent(cid, additive) {{
  if (additive) {{
    if (selectedIds.has(cid)) {{
      selectedIds.delete(cid);
    }} else {{
      selectedIds.add(cid);
    }}
  }} else {{
    selectedIds.clear();
    selectedIds.add(cid);
  }}
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  selectedIds.forEach(id => {{
    svg.querySelectorAll('[data-component-id="' + id + '"]')
      .forEach(g => g.classList.add("dg-selected"));
  }});
  document.querySelectorAll(".tree-item").forEach(el => {{
    el.classList.toggle("selected", selectedIds.has(el.textContent));
  }});
  showResizeHandles(cid);
  if (selectedIds.size === 1) {{
    updateInspector(cid);
  }} else if (selectedIds.size > 1) {{
    document.getElementById("inspector").innerHTML =
      '<div style="color:#555">' + selectedIds.size + ' components selected. Drag to move all.</div>';
  }} else {{
    document.getElementById("inspector").innerHTML =
      '<div style="color:#555">Click a component to inspect it.</div>';
  }}
}}

function reapplySelection() {{
  const svg = document.querySelector("#stage svg");
  if (!svg || selectedIds.size === 0) return;
  svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  selectedIds.forEach(id => {{
    svg.querySelectorAll('[data-component-id="' + id + '"]')
      .forEach(g => g.classList.add("dg-selected"));
  }});
  document.querySelectorAll(".tree-item").forEach(el => {{
    el.classList.toggle("selected", selectedIds.has(el.textContent));
  }});
  const primary = [...selectedIds].pop();
  if (primary) showResizeHandles(primary);
}}

function clearSelection() {{
  selectedIds.clear();
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  removeResizeHandles();
  document.querySelectorAll(".tree-item.selected").forEach(el => el.classList.remove("selected"));
  document.getElementById("inspector").innerHTML =
    '<div style="color:#555">Click a component to inspect it.</div>';
}}

function updateInspector(cid) {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {{
    const bbox = g.getBBox();
    minX = Math.min(minX, bbox.x); minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width); maxY = Math.max(maxY, bbox.y + bbox.height);
  }});
  const own = getOwnDelta(cid);
  const eff = getEffectiveDelta(cid);
  const hasMoveOverride = own.dx !== 0 || own.dy !== 0;
  const hasSizeOverride = own.dw !== 0 || own.dh !== 0;
  const hasOverride = hasMoveOverride || hasSizeOverride;
  const hasParentOverride = eff.dx !== own.dx || eff.dy !== own.dy;

  let html = '<div class="field"><span class="label">Component</span><br>' +
    '<span class="value">' + cid + '</span></div>';
  html += '<div class="field"><span class="label">Computed position</span><br>' +
    '<span class="value">' + Math.round(minX) + ', ' + Math.round(minY) + '</span></div>';
  html += '<div class="field"><span class="label">Size</span><br>' +
    '<span class="value">' + Math.round(maxX - minX) + ' &#x00d7; ' + Math.round(maxY - minY) + '</span></div>';
  if (hasMoveOverride) {{
    html += '<div class="field"><span class="label">Position override</span><br>' +
      '<span class="value override">dx=' + own.dx + '  dy=' + own.dy + '</span></div>';
  }}
  if (hasSizeOverride) {{
    html += '<div class="field"><span class="label">Size override</span><br>' +
      '<span class="value override">dw=' + own.dw + '  dh=' + own.dh + '</span></div>';
  }}
  if (hasParentOverride) {{
    html += '<div class="field"><span class="label">Effective (incl. parents)</span><br>' +
      '<span class="value override">dx=' + eff.dx + '  dy=' + eff.dy + '</span></div>';
  }}
  if (hasOverride) {{
    html += '<button class="danger" onclick="clearOverride(\\''+cid+'\\')">Clear override</button>';
  }}
  html += '<div style="margin-top:8px;font-size:10px;color:#555">Drag to move &#xb7; handles to resize (4px grid) &#xb7; W to toggle grid overlay.</div>';
  document.getElementById("inspector").innerHTML = html;
}}

// ---- Override persistence ----

async function saveOverrides() {{
  await fetch("/api/overrides/" + SLUG, {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{ format_version: 1, definition_hash: definitionHash, overrides }}),
  }});
  setDirty(false);
  // Update saved state for dirty flag comparison
  lastSavedState = JSON.stringify(overrides);
  updateOverrideSummary();
  refreshTreeColors();
}}

function clearOverride(cid) {{
  // Record snapshot before clearing override
  recordSnapshot();
  delete overrides[cid];
  setDirty(true);
  applyAllOverrides();
  if (selectedIds.has(cid)) updateInspector(cid);
}}

function updateOverrideSummary() {{
  const n = Object.keys(overrides).length;
  const el = document.getElementById("override-summary");
  if (n === 0) {{ el.innerHTML = '<span style="color:#555">No overrides.</span>'; }}
  else {{
    let txt = n + " override" + (n > 1 ? "s" : "");
    if (isStale) txt += ' <span style="color:#cc6">(stale &#x2013; definition changed)</span>';
    el.innerHTML = txt;
  }}
}}

function refreshTreeColors() {{
  document.querySelectorAll(".tree-item").forEach(el => {{
    el.style.color = overrides[el.textContent] ? "#E95420" : "";
  }});
}}

document.getElementById("btn-export").addEventListener("click", () => {{
  const entries = Object.entries(overrides).filter(([,d]) =>
    (d.dx||0) !== 0 || (d.dy||0) !== 0 || (d.dw||0) !== 0 || (d.dh||0) !== 0);
  if (entries.length === 0) {{ alert("No overrides to export."); return; }}
  const lines = ["# Overrides for " + SLUG, ""];
  for (const [cid, d] of entries) {{
    let parts = [];
    if (d.dx || d.dy) parts.push("move x+" + (d.dx||0) + " y+" + (d.dy||0));
    if (d.dw || d.dh) parts.push("resize w+" + (d.dw||0) + " h+" + (d.dh||0));
    lines.push("# " + cid + ": " + parts.join(", "));
  }}
  navigator.clipboard.writeText(lines.join("\\n")).then(() => alert("Copied to clipboard."));
}});

function setDirty(dirty) {{
  isDirty = dirty;
  const saveBtn = document.getElementById("btn-save");
  saveBtn.disabled = !dirty;
  if (dirty) {{
    saveBtn.classList.add("dirty");
  }} else {{
    saveBtn.classList.remove("dirty");
  }}
}}

document.getElementById("btn-save").addEventListener("click", () => {{
  if (!isDirty) return;
  saveOverrides();
}});

document.getElementById("btn-clear-all").addEventListener("click", () => {{
  if (Object.keys(overrides).length === 0) return;
  if (!confirm("Clear all overrides for " + SLUG + "?")) return;
  // Record snapshot before clearing all overrides
  recordSnapshot();
  overrides = {{}};
  setDirty(true);
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
}});

// Keyboard shortcuts: Ctrl+S to save, Ctrl+Z to undo, Ctrl+Shift+Z/Ctrl+Y to redo, arrows to nudge
document.addEventListener("keydown", (e) => {{
  if (e.ctrlKey && e.key === "s") {{
    e.preventDefault();
    if (isDirty) {{
      saveOverrides();
    }}
  }} else if (e.ctrlKey && e.key === "z" && !e.shiftKey) {{
    e.preventDefault();
    performUndo();
  }} else if ((e.ctrlKey && e.shiftKey && e.key === "Z") || (e.ctrlKey && e.key === "y")) {{
    e.preventDefault();
    performRedo();
  }} else if ((e.key === "w" || e.key === "W") && !e.ctrlKey && !e.metaKey && !e.altKey) {{
    cycleGuideMode();
  }} else if (selectedIds.size > 0 && !e.ctrlKey && !e.metaKey && !e.altKey &&
             ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {{
    e.preventDefault();
    const step = e.shiftKey ? 8 : 1;
    recordSnapshot();
    selectedIds.forEach(id => {{
      const own = getOwnDelta(id);
      let dx = own.dx, dy = own.dy;
      if (e.key === "ArrowUp") dy -= step;
      else if (e.key === "ArrowDown") dy += step;
      else if (e.key === "ArrowLeft") dx -= step;
      else if (e.key === "ArrowRight") dx += step;
      setOverride(id, {{ dx, dy }});
    }});
    applyAllOverrides();
    const primary = [...selectedIds].pop();
    if (primary) showResizeHandles(primary);
    if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  }}
}});

// Undo/Redo button event listeners
document.getElementById("btn-undo").addEventListener("click", performUndo);
document.getElementById("btn-redo").addEventListener("click", performRedo);

// Warn before leaving with unsaved changes
window.addEventListener("beforeunload", (e) => {{
  if (isDirty) {{
    e.preventDefault();
    return "You have unsaved changes. Are you sure you want to leave?";
  }}
}});

// ---- SSE ----

function connectSSE() {{
  const es = new EventSource("/events");
  es.onmessage = (e) => {{
    const data = JSON.parse(e.data);
    if (data.generation > generation) {{
      generation = data.generation;
      loadSVG();
      const st = document.getElementById("build-status");
      if (data.error) {{ st.className = "build-status build-err"; st.textContent = "Build error"; }}
      else {{ st.className = "build-status build-ok"; st.textContent = "Rebuilt #" + generation; }}
    }}
  }};
  es.onerror = () => setTimeout(connectSSE, 2000);
}}

loadSVG();
connectSSE();
</script>
</body>
</html>"""


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
