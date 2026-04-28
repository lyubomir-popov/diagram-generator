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
        from diagram_layout import layout
        result = layout(diagram_obj)
        _layout_cache[slug] = result
        return result
    except Exception:
        return None


def _get_component_tree(slug: str) -> list[dict]:
    result = _get_layout_result(slug)
    if result and hasattr(result, "component_tree"):
        return [asdict(ci) for ci in result.component_tree]
    return []


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
.tree-item.selected {{ border-left-color: #E95420; color: #E95420; }}
.stage {{ flex: 1; overflow: auto; display: flex; align-items: flex-start;
         justify-content: center; padding: 32px; }}
.stage svg {{ background: #fff; cursor: crosshair; }}
.stage svg [data-component-id] {{ cursor: pointer; }}
.stage svg g.dg-selected > rect:first-of-type {{ outline: 2px solid #E95420; outline-offset: -1px; }}
.stage svg g.dg-hover > rect:first-of-type {{ outline: 1px dashed #6cc; outline-offset: -1px; }}
.dg-handle {{ fill: #E95420; stroke: #fff; stroke-width: 1; cursor: pointer; pointer-events: all; }}
.dg-handle.dg-handle-r {{ cursor: ew-resize; }}
.dg-handle.dg-handle-b {{ cursor: ns-resize; }}
.dg-handle.dg-handle-br {{ cursor: nwse-resize; }}
.btn {{ font-size: 11px; padding: 3px 8px; border: 1px solid #555;
       background: #2a2a2a; color: #e0e0e0; border-radius: 3px; cursor: pointer; }}
.btn:hover {{ background: #3a3a3a; }}
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
  <h2>Overrides</h2>
  <div id="override-summary" style="font-size:11px;color:#666">No overrides.</div>
  <div style="margin-top:4px;display:flex;gap:4px">
    <button class="btn" id="btn-clear-all">Clear all</button>
    <button class="btn" id="btn-export">Export</button>
  </div>
</div>
<div class="stage" id="stage"></div>
<script>
"use strict";
const SLUG = "{slug}";
const GRID = {grid_js};
let generation = 0;
let componentTree = [];
let overrides = {{}};
let definitionHash = "";
let isStale = false;
let selectedId = null;
let dragState = null;
let resizeState = null;
const HANDLE_SIZE = 8;

async function loadSVG() {{
  const suffix = GRID ? "-v2-grid.svg" : "-v2.svg";
  const resp = await fetch("/svg/" + SLUG + "-onbrand" + suffix + "?t=" + Date.now());
  if (!resp.ok) return;
  document.getElementById("stage").innerHTML = await resp.text();
  await loadTree();
  await loadOverrides();
  applyAllOverrides();
  bindInteraction();
  if (selectedId) selectComponent(selectedId);
}}

async function loadTree() {{
  try {{
    const resp = await fetch("/api/tree/" + SLUG);
    if (resp.ok) componentTree = await resp.json();
  }} catch (e) {{ /* ignore */ }}
}}

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
      }}
    }});
  }}
  // Apply to tree components
  function visit(nodes) {{
    for (const node of nodes) {{
      applyToComponent(node.id);
      if (node.children) visit(node.children);
    }}
  }}
  visit(componentTree);
  // Also handle overrides outside tree
  for (const cid of Object.keys(overrides)) applyToComponent(cid);
  // Refresh resize handles if selected
  if (selectedId) showResizeHandles(selectedId);
}}

// ---- Interaction ----

function bindInteraction() {{
  const svg = document.querySelector("#stage svg");
  if (!svg) return;

  // Build tree sidebar
  const treeEl = document.getElementById("tree");
  treeEl.innerHTML = "";
  function buildTree(nodes, container, depth) {{
    for (const node of nodes) {{
      const item = document.createElement("div");
      item.className = "tree-item";
      item.style.paddingLeft = (8 + depth * 12) + "px";
      item.textContent = node.id;
      if (overrides[node.id]) item.style.color = "#E95420";
      item.onclick = (e) => {{ e.stopPropagation(); selectComponent(node.id); }};
      container.appendChild(item);
      if (node.children && node.children.length > 0) buildTree(node.children, container, depth + 1);
    }}
  }}
  buildTree(componentTree, treeEl, 0);

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
  const own = getOwnDelta(cid);
  dragState = {{ cid, startX: e.clientX, startY: e.clientY,
                origDx: own.dx, origDy: own.dy, hasMoved: false }};
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
  const newDx = Math.round((dragState.origDx + dx) / 4) * 4;
  const newDy = Math.round((dragState.origDy + dy) / 4) * 4;
  setOverride(dragState.cid, {{ dx: newDx, dy: newDy }});
  applyAllOverrides();
  if (selectedId === dragState.cid) updateInspector(dragState.cid);
}}

function onDragUp() {{
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragUp);
  if (dragState && dragState.hasMoved) {{
    cleanOverride(dragState.cid);
    saveOverrides();
    selectComponent(dragState.cid);
  }} else if (dragState) {{
    selectComponent(dragState.cid);
  }}
  dragState = null;
}}

// ---- Resize ----

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
  // Right-edge midpoint
  mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
  // Bottom-edge midpoint
  mkHandle((minX + maxX) / 2, maxY, "dg-handle-b", "b");
  // Bottom-right corner
  mkHandle(maxX, maxY, "dg-handle-br", "br");
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
    origDw: own.dw, origDh: own.dh,
    hasMoved: false,
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
  let newDw = resizeState.origDw;
  let newDh = resizeState.origDh;
  if (resizeState.axis === "r" || resizeState.axis === "br") {{
    newDw = Math.round((resizeState.origDw + dx) / 4) * 4;
  }}
  if (resizeState.axis === "b" || resizeState.axis === "br") {{
    newDh = Math.round((resizeState.origDh + dy) / 4) * 4;
  }}
  setOverride(resizeState.cid, {{ dw: newDw, dh: newDh }});
  applyAllOverrides();
  if (selectedId === resizeState.cid) updateInspector(resizeState.cid);
}}

function onResizeUp() {{
  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", onResizeUp);
  if (resizeState && resizeState.hasMoved) {{
    cleanOverride(resizeState.cid);
    saveOverrides();
    selectComponent(resizeState.cid);
  }}
  resizeState = null;
}}

// ---- Override helpers ----

function setOverride(cid, partial) {{
  const prev = overrides[cid] || {{}};
  overrides[cid] = {{ dx: prev.dx || 0, dy: prev.dy || 0, dw: prev.dw || 0, dh: prev.dh || 0, ...partial }};
}}

function cleanOverride(cid) {{
  const o = overrides[cid];
  if (!o) return;
  if ((o.dx || 0) === 0 && (o.dy || 0) === 0 && (o.dw || 0) === 0 && (o.dh || 0) === 0) {{
    delete overrides[cid];
  }}
}}

// ---- Selection & Inspector ----

function selectComponent(cid) {{
  selectedId = cid;
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  svg.querySelectorAll('[data-component-id="' + cid + '"]')
    .forEach(g => g.classList.add("dg-selected"));
  document.querySelectorAll(".tree-item").forEach(el => {{
    el.classList.toggle("selected", el.textContent === cid);
  }});
  showResizeHandles(cid);
  updateInspector(cid);
}}

function clearSelection() {{
  selectedId = null;
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
  html += '<div style="margin-top:8px;font-size:10px;color:#555">Drag to move &#xb7; handles to resize (4px grid).</div>';
  document.getElementById("inspector").innerHTML = html;
}}

// ---- Override persistence ----

async function saveOverrides() {{
  await fetch("/api/overrides/" + SLUG, {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{ format_version: 1, definition_hash: definitionHash, overrides }}),
  }});
  updateOverrideSummary();
  refreshTreeColors();
}}

function clearOverride(cid) {{
  delete overrides[cid];
  saveOverrides();
  applyAllOverrides();
  if (selectedId === cid) updateInspector(cid);
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

document.getElementById("btn-clear-all").addEventListener("click", () => {{
  if (Object.keys(overrides).length === 0) return;
  if (!confirm("Clear all overrides for " + SLUG + "?")) return;
  overrides = {{}};
  saveOverrides();
  applyAllOverrides();
  if (selectedId) updateInspector(selectedId);
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
        elif path.startswith("/api/overrides/"):
            self._serve_overrides_get(path[15:])
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if path.startswith("/api/overrides/"):
            self._serve_overrides_post(path[15:])
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
