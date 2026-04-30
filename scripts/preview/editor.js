"use strict";
const SLUG = window.__DG_CONFIG.slug;
const GRID = window.__DG_CONFIG.grid;
const INSET = window.__DG_CONFIG.inset;
let generation = 0;

// ---- Component model, interaction manager & constraints ----
const model = new ComponentModel();
const mgr = new InteractionManager();
const constraints = createDefaultRegistry();
let lastViolations = [];

// Legacy accessors – thin wrappers that delegate to model/mgr so the rest of
// the file can be migrated incrementally.
function _getOverrides() { return model.overrides; }

// Compatibility shims – these expose the old global variable interface
// while storing state in the model/manager objects.
Object.defineProperty(window, "componentTree", {
  get() { return model._roots.map(n => n.data); },
  set(v) { model.loadTree(v); },
});
Object.defineProperty(window, "overrides", {
  get() { return model.overrides; },
  set(v) { model.overrides = v; },
});
Object.defineProperty(window, "definitionHash", {
  get() { return model.definitionHash; },
  set(v) { model.definitionHash = v; },
});
Object.defineProperty(window, "isStale", {
  get() { return model.isStale; },
  set(v) { model.isStale = v; },
});
Object.defineProperty(window, "selectedIds", {
  get() { return mgr.selectedIds; },
  set(v) { mgr.selectedIds = v; },
});
Object.defineProperty(window, "selectionDepth", {
  get() { return mgr.selectionDepth; },
  set(v) { mgr.selectionDepth = v; },
});

let isDirty = false;
const HANDLE_SIZE = 8;

// ---- BoxStyle presets (mirrors diagram_model.py BoxStyle enum) ----
const BOX_STYLES = {
  default:   { fill: "#FFFFFF", text: "#000000", icon: "#000000", label: "Default (white)" },
  accent:    { fill: "#F3F3F3", text: "#000000", icon: "#000000", label: "Accent (grey)" },
  highlight: { fill: "#000000", text: "#FFFFFF", icon: "#FFFFFF", label: "Highlight (black)" },
};

// ---- Guide mode (W key) ----
const GUIDE_MODES = ["off", "composition", "baseline"];
let guideMode = "off";
let gridInfo = null;

// ---- Alignment snap guides ----
const SNAP_THRESHOLD = 6; // px — distance to snap to an edge
const GUIDE_COLOR = "#E95420";
const GUIDE_OPACITY = "0.5";

/**
 * Collect snap targets from peer components (siblings or all top-level).
 * Returns arrays of { x, label } and { y, label } targets.
 */
function collectSnapTargets(dragCid) {
  const node = model.get(dragCid);
  if (!node) return { xs: [], ys: [] };
  // Collect from siblings (same parent) or all top-level nodes
  const peers = node.parent
    ? node.parent.children.filter(n => n.id !== dragCid && n.type !== "arrow" && n.type !== "separator")
    : model._roots.filter(n => n.id !== dragCid && n.type !== "arrow" && n.type !== "separator");
  const xs = [];
  const ys = [];
  for (const peer of peers) {
    const eff = model.getEffectiveDelta(peer.id);
    const own = model.getOwnDelta(peer.id);
    const px = peer.data.x + eff.dx;
    const py = peer.data.y + eff.dy;
    const pw = peer.data.width + own.dw;
    const ph = peer.data.height + own.dh;
    xs.push(px);           // left edge
    xs.push(px + pw);      // right edge
    xs.push(px + pw / 2);  // center
    ys.push(py);           // top edge
    ys.push(py + ph);      // bottom edge
    ys.push(py + ph / 2);  // center
  }
  return { xs, ys };
}

/**
 * Find which snap targets the dragged component is close to.
 * Returns { snapX: number|null, snapY: number|null, guideLines: [{x1,y1,x2,y2}] }
 */
function findSnaps(cid, proposedDx, proposedDy, targets) {
  const node = model.get(cid);
  if (!node) return { snapDx: proposedDx, snapDy: proposedDy, lines: [] };
  const own = model.getOwnDelta(cid);
  const w = node.data.width + own.dw;
  const h = node.data.height + own.dh;
  const left = node.data.x + proposedDx;
  const top = node.data.y + proposedDy;
  const right = left + w;
  const bottom = top + h;
  const cx = left + w / 2;
  const cy = top + h / 2;

  let bestDx = proposedDx;
  let bestDy = proposedDy;
  let bestDistX = SNAP_THRESHOLD + 1;
  let bestDistY = SNAP_THRESHOLD + 1;
  const lines = [];

  // Check each edge and center against snap targets
  for (const tx of targets.xs) {
    for (const edge of [left, right, cx]) {
      const dist = Math.abs(edge - tx);
      if (dist < bestDistX) {
        bestDistX = dist;
        bestDx = proposedDx + (tx - edge);
      }
    }
  }
  for (const ty of targets.ys) {
    for (const edge of [top, bottom, cy]) {
      const dist = Math.abs(edge - ty);
      if (dist < bestDistY) {
        bestDistY = dist;
        bestDy = proposedDy + (ty - edge);
      }
    }
  }

  // Snap to 4px grid
  bestDx = Math.round(bestDx / 8) * 8;
  bestDy = Math.round(bestDy / 8) * 8;

  // Build guide lines for the snapped position
  const snapLeft = node.data.x + bestDx;
  const snapTop = node.data.y + bestDy;
  const snapRight = snapLeft + w;
  const snapBottom = snapTop + h;
  const snapCx = snapLeft + w / 2;
  const snapCy = snapTop + h / 2;

  // Only draw lines if we actually snapped (within threshold)
  if (bestDistX <= SNAP_THRESHOLD) {
    // Find which x we snapped to
    for (const tx of targets.xs) {
      const edges = [snapLeft, snapRight, snapCx];
      for (const edge of edges) {
        if (Math.abs(edge - tx) < 2) {
          const svgEl = document.querySelector("#stage svg");
          const svgH = svgEl ? parseFloat(svgEl.getAttribute("height") || "2000") : 2000;
          lines.push({ x1: tx, y1: 0, x2: tx, y2: svgH });
        }
      }
    }
  }
  if (bestDistY <= SNAP_THRESHOLD) {
    for (const ty of targets.ys) {
      const edges = [snapTop, snapBottom, snapCy];
      for (const edge of edges) {
        if (Math.abs(edge - ty) < 2) {
          const svgElH = document.querySelector("#stage svg");
          const svgW = svgElH ? parseFloat(svgElH.getAttribute("width") || "2000") : 2000;
          lines.push({ x1: 0, y1: ty, x2: svgW, y2: ty });
        }
      }
    }
  }

  return { snapDx: bestDx, snapDy: bestDy, lines };
}

/** Render alignment guide lines on the SVG. */
function renderGuideLines(lines) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  clearGuideLines();
  const ns = "http://www.w3.org/2000/svg";
  for (const ln of lines) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", ln.x1);
    line.setAttribute("y1", ln.y1);
    line.setAttribute("x2", ln.x2);
    line.setAttribute("y2", ln.y2);
    line.setAttribute("stroke", GUIDE_COLOR);
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", GUIDE_OPACITY);
    line.setAttribute("stroke-dasharray", "4 4");
    line.setAttribute("class", "dg-snap-guide");
    line.setAttribute("pointer-events", "none");
    svg.appendChild(line);
  }
}

/** Remove all alignment guide lines. */
function clearGuideLines() {
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-snap-guide").forEach(el => el.remove());
}

// ---- Undo/Redo stack ----
let undoStack = [];
let redoStack = [];
let lastSavedState = null;
const MAX_UNDO_STACK_SIZE = 50;

/** Serialise the full dirty-trackable state (overrides + grid overrides). */
function _serializeDirtyState() {
  return JSON.stringify({ o: overrides, g: model.gridOverrides || {} });
}

async function loadSVG() {
  const suffix = GRID ? "-v2-grid.svg" : "-v2.svg";
  const resp = await fetch("/svg/" + SLUG + "-onbrand" + suffix + "?t=" + Date.now());
  if (!resp.ok) return;
  document.getElementById("stage").innerHTML = await resp.text();
  await loadTree();
  await loadGridInfo();
  populateGridControls();
  await loadOverrides();
  // Apply saved grid overrides (gutter/margin changes) before rendering
  if (model.gridOverrides && Object.keys(model.gridOverrides).length > 0) {
    const go = model.gridOverrides;
    await requestRelayout(go.col_gap, go.row_gap, go.outer_margin);
  }
  applyWaypointOverrides();
  applyAllOverrides();
  bindInteraction();
  renderGridOverlay();
  reapplySelection();
  runConstraints();
  // Re-baseline dirty state after initial load + relayout
  lastSavedState = _serializeDirtyState();
  setDirty(false);
}

async function loadTree() {
  try {
    const resp = await fetch("/api/tree/" + SLUG);
    if (resp.ok) {
      const data = await resp.json();
      model.loadTree(data);
    }
  } catch (e) { /* ignore */ }
}

async function loadGridInfo() {
  try {
    const resp = await fetch("/api/grid/" + SLUG);
    if (resp.ok) gridInfo = await resp.json();
  } catch (e) { /* ignore */ }
}

function cycleGuideMode() {
  const idx = GUIDE_MODES.indexOf(guideMode);
  guideMode = GUIDE_MODES[(idx + 1) % GUIDE_MODES.length];
  renderGridOverlay();
  const badge = document.getElementById("guide-badge");
  badge.className = "guide-badge " + guideMode;
  if (guideMode === "off") {
    badge.textContent = "";
  } else {
    badge.textContent = "Grid: " + guideMode + " (W)";
  }
}

function renderGridOverlay() {
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

  if (guideMode === "composition") {
    // -- Margin overlays --
    const marginColor = "rgba(235,180,65,0.06)";
    if (margin > 0) {
      addRect(g, ns, 0, 0, svgW, margin, marginColor);
      addRect(g, ns, 0, svgH - margin, svgW, margin, marginColor);
      addRect(g, ns, 0, margin, margin, svgH - 2 * margin, marginColor);
      addRect(g, ns, svgW - margin, margin, margin, svgH - 2 * margin, marginColor);
    }

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
    for (let c = 0; c < colXs.length; c++) {
      const cx = colXs[c];
      const cw = c < colWidths.length ? colWidths[c] : colWidths[colWidths.length - 1];
      addRect(g, ns, cx, margin, cw, svgH - 2 * margin, colFill);
      const kl = document.createElementNS(ns, "line");
      kl.setAttribute("x1", cx); kl.setAttribute("y1", margin);
      kl.setAttribute("x2", cx); kl.setAttribute("y2", svgH - margin);
      kl.setAttribute("stroke", keylineColor); kl.setAttribute("stroke-width", "0.5");
      g.appendChild(kl);
      const kr = document.createElementNS(ns, "line");
      kr.setAttribute("x1", cx + cw); kr.setAttribute("y1", margin);
      kr.setAttribute("x2", cx + cw); kr.setAttribute("y2", svgH - margin);
      kr.setAttribute("stroke", keylineColor); kr.setAttribute("stroke-width", "0.5");
      g.appendChild(kr);
      if (c < colXs.length - 1 && colGap > 0) {
        addRect(g, ns, cx + cw, margin, colGap, svgH - 2 * margin, "rgba(255,100,100,0.06)");
      }
    }

    // -- Row bands --
    const rowLine = "rgba(100,255,160,0.15)";
    for (let r = 0; r < rowYs.length; r++) {
      const ry = rowYs[r];
      const rh = r < rowHeights.length ? rowHeights[r] : rowHeights[rowHeights.length - 1];
      const rl = document.createElementNS(ns, "line");
      rl.setAttribute("x1", margin); rl.setAttribute("y1", ry);
      rl.setAttribute("x2", svgW - margin); rl.setAttribute("y2", ry);
      rl.setAttribute("stroke", rowLine); rl.setAttribute("stroke-width", "0.5");
      g.appendChild(rl);
      const rb = document.createElementNS(ns, "line");
      rb.setAttribute("x1", margin); rb.setAttribute("y1", ry + rh);
      rb.setAttribute("x2", svgW - margin); rb.setAttribute("y2", ry + rh);
      rb.setAttribute("stroke", rowLine); rb.setAttribute("stroke-width", "0.5");
      g.appendChild(rb);
      if (r < rowYs.length - 1 && rowGap > 0) {
        addRect(g, ns, margin, ry + rh, svgW - 2 * margin, rowGap, "rgba(255,100,100,0.06)");
      }
    }
  }

  // -- Baseline grid (4px lines, only in "baseline" mode) --
  if (guideMode === "baseline") {
    const baselineStep = 8;
    // Content area boundary
    const boundary = document.createElementNS(ns, "rect");
    boundary.setAttribute("x", margin);
    boundary.setAttribute("y", margin);
    boundary.setAttribute("width", svgW - 2 * margin);
    boundary.setAttribute("height", svgH - 2 * margin);
    boundary.setAttribute("fill", "none");
    boundary.setAttribute("stroke", "rgba(255,255,255,0.12)");
    boundary.setAttribute("stroke-dasharray", "6 4");
    boundary.setAttribute("stroke-width", "1");
    g.appendChild(boundary);
    // Horizontal 4px baseline grid
    const baselineColor = "rgba(255,100,100,0.08)";
    for (let y = margin; y <= svgH - margin; y += baselineStep) {
      const bl = document.createElementNS(ns, "line");
      bl.setAttribute("x1", margin); bl.setAttribute("y1", y);
      bl.setAttribute("x2", svgW - margin); bl.setAttribute("y2", y);
      bl.setAttribute("stroke", baselineColor); bl.setAttribute("stroke-width", "0.5");
      g.appendChild(bl);
    }
    // Vertical 4px baseline grid
    for (let x = margin; x <= svgW - margin; x += baselineStep) {
      const vl = document.createElementNS(ns, "line");
      vl.setAttribute("x1", x); vl.setAttribute("y1", margin);
      vl.setAttribute("x2", x); vl.setAttribute("y2", svgH - margin);
      vl.setAttribute("stroke", baselineColor); vl.setAttribute("stroke-width", "0.25");
      g.appendChild(vl);
    }
  }

  // Insert overlay just before the closing of the SVG so it sits on top
  svg.appendChild(g);
}

function addRect(parent, ns, x, y, w, h, fill) {
  const r = document.createElementNS(ns, "rect");
  r.setAttribute("x", x); r.setAttribute("y", y);
  r.setAttribute("width", w); r.setAttribute("height", h);
  r.setAttribute("fill", fill);
  parent.appendChild(r);
}

function populateGridControls() {
  if (!gridInfo) return;
  document.getElementById("grid-cols").value = (gridInfo.col_xs || []).length;
  document.getElementById("grid-rows").value = (gridInfo.row_ys || []).length;
  document.getElementById("grid-col-gap").value = gridInfo.col_gap || 0;
  document.getElementById("grid-row-gap").value = gridInfo.row_gap || 0;
  document.getElementById("grid-margin").value = gridInfo.outer_margin || 0;
}

let relayoutTimer = null;

function onGridControlChange() {
  if (!gridInfo) return;
  const colGap = Math.max(0, parseInt(document.getElementById("grid-col-gap").value) || 0);
  const rowGap = Math.max(0, parseInt(document.getElementById("grid-row-gap").value) || 0);
  const margin = Math.max(0, parseInt(document.getElementById("grid-margin").value) || 0);

  // Track grid overrides for persistence
  model.gridOverrides = { col_gap: colGap, row_gap: rowGap, outer_margin: margin };
  setDirty(true);

  // Debounce the relayout call so rapid typing doesn't flood the server
  if (relayoutTimer) clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(() => requestRelayout(colGap, rowGap, margin), 200);

  // Immediately update the grid overlay from the input values (local recompute)
  updateGridOverlayFromInputs();
}

function updateGridOverlayFromInputs() {
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

  gridInfo = {
    col_xs: newColXs, col_widths: newColWidths,
    row_ys: newRowYs, row_heights: newRowHeights,
    col_gap: colGap, row_gap: rowGap, outer_margin: margin,
  };
  renderGridOverlay();
}

async function requestRelayout(colGap, rowGap, margin) {
  try {
    const resp = await fetch("/api/relayout/" + SLUG, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ col_gap: colGap, row_gap: rowGap, outer_margin: margin }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    // Replace SVG in stage
    document.getElementById("stage").innerHTML = data.svg;
    // Update component tree — positions changed, so clear stale position overrides
    // but preserve grid_overrides (they are the source of the relayout).
    const savedGridOverrides = Object.assign({}, model.gridOverrides);
    model.overrides = {};
    model.gridOverrides = savedGridOverrides;
    if (data.tree) componentTree = data.tree;
    // Update grid info from the actual layout result
    if (data.grid_info) {
      gridInfo = data.grid_info;
      populateGridControls();
    }
    // Re-apply interaction on the new SVG (no position overrides to apply)
    bindInteraction();
    renderGridOverlay();
    reapplySelection();
    // Rebuild component tree in sidebar
    buildTreeUI();
    runConstraints();
    updateOverrideSummary();
  } catch (e) { /* ignore relayout errors */ }
}

// Bind grid control events
["grid-cols", "grid-rows", "grid-col-gap", "grid-row-gap", "grid-margin"].forEach(id => {
  document.getElementById(id).addEventListener("input", onGridControlChange);
});

async function loadOverrides() {
  try {
    const resp = await fetch("/api/overrides/" + SLUG);
    if (resp.ok) {
      const data = await resp.json();
      model.loadOverrides(data);
    }
  } catch (e) { /* ignore */ }
  updateOverrideSummary();
  // Initialize undo stack and saved state
  undoStack = [];
  redoStack = [];
  lastSavedState = _serializeDirtyState();
  updateUndoRedoButtons();
}

function applyWaypointOverrides() {
  // Patch arrow waypoints in the component tree from saved overrides,
  // then rebuild the arrow SVG to reflect the new paths.
  for (const cid of Object.keys(overrides)) {
    const o = overrides[cid];
    if (!o || !o.waypoints) continue;
    const node = getArrowNode(cid);
    if (node) {
      node.waypoints = JSON.parse(JSON.stringify(o.waypoints));
      rebuildArrowSVG(cid);
    }
  }
}

// ---- Undo/Redo functions ----

function recordSnapshot() {
  // Record current state to undo stack (call BEFORE making the change)
  const currentState = JSON.stringify(overrides);
  if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentState) {
    undoStack.push(currentState);
    // Cap stack size
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {
      undoStack.shift();
    }
    // Clear redo stack when new action is performed
    redoStack = [];
    updateUndoRedoButtons();
  }
}

function canUndo() {
  return undoStack.length > 0;
}

function canRedo() {
  return redoStack.length > 0;
}

function performUndo() {
  if (!canUndo()) return;
  
  // Save current state to redo stack before undoing
  const currentState = JSON.stringify(overrides);
  redoStack.push(currentState);
  
  // Restore previous state
  const previousState = undoStack.pop();
  overrides = JSON.parse(previousState);
  
  // Update UI
  applyWaypointOverrides();
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  updateOverrideSummary();
  refreshTreeColors();
  
  // Update dirty flag
  const currentStateStr = _serializeDirtyState();
  setDirty(currentStateStr !== lastSavedState);
  
  updateUndoRedoButtons();
}

function performRedo() {
  if (!canRedo()) return;
  
  // Save current state to undo stack before redoing
  const currentState = JSON.stringify(overrides);
  undoStack.push(currentState);
  
  // Restore next state
  const nextState = redoStack.pop();
  overrides = JSON.parse(nextState);
  
  // Update UI
  applyWaypointOverrides();
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  updateOverrideSummary();
  refreshTreeColors();
  
  // Update dirty flag
  const currentStateStr = _serializeDirtyState();
  setDirty(currentStateStr !== lastSavedState);
  
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("btn-undo");
  const redoBtn = document.getElementById("btn-redo");
  if (undoBtn) undoBtn.disabled = !canUndo();
  if (redoBtn) redoBtn.disabled = !canRedo();
}

// ---- Override application ----

function getOwnDelta(cid) {
  return model.getOwnDelta(cid);
}

function findComponentAtDepth(x, y, targetDepth) {
  function walk(nodes, depth) {
    for (const node of nodes) {
      const eff = getEffectiveDelta(node.id);
      const own = getOwnDelta(node.id);
      const nx = node.x + eff.dx;
      const ny = node.y + eff.dy;
      const nw = node.width + own.dw;
      const nh = node.height + own.dh;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        if (depth === targetDepth) return node.id;
        if (node.children && node.children.length > 0 && depth < targetDepth) {
          const child = walk(node.children, depth + 1);
          if (child) return child;
        }
      }
    }
    return null;
  }
  const roots = model._roots.map(n => n.data);
  return walk(roots, 0);
}

function getAncestors(cid) {
  return model.getAncestors(cid);
}

function getParentNode(cid) {
  const parent = model.getParent(cid);
  return parent ? parent.data : null;
}

function getComponentNode(cid) {
  const node = model.get(cid);
  return node ? node.data : null;
}

function getDescendantIds(cid) {
  return model.getDescendants(cid);
}

function getEffectiveDelta(cid) {
  return model.getEffectiveDelta(cid);
}

function applyAllOverrides() {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Reset transforms
  svg.querySelectorAll("[data-component-id]").forEach(g => { g.style.transform = ""; });
  // Restore original rect sizes
  svg.querySelectorAll("rect[data-orig-width]").forEach(r => {
    r.setAttribute("width", r.getAttribute("data-orig-width"));
    r.setAttribute("height", r.getAttribute("data-orig-height"));
  });
  // Restore original icon transforms
  svg.querySelectorAll(".dg-icon[data-orig-tx]").forEach(icon => {
    icon.setAttribute("transform", "translate(" + icon.getAttribute("data-orig-tx") + " " + icon.getAttribute("data-orig-ty") + ")");
  });
  // Restore original arrow line coords
  svg.querySelectorAll("line[data-orig-x1]").forEach(ln => {
    ln.setAttribute("x1", ln.getAttribute("data-orig-x1"));
    ln.setAttribute("y1", ln.getAttribute("data-orig-y1"));
    ln.setAttribute("x2", ln.getAttribute("data-orig-x2"));
    ln.setAttribute("y2", ln.getAttribute("data-orig-y2"));
  });
  svg.querySelectorAll("polygon[data-orig-points]").forEach(p => {
    p.setAttribute("points", p.getAttribute("data-orig-points"));
  });
  // Save original sizes on first pass
  svg.querySelectorAll("[data-component-id] > rect:first-of-type").forEach(r => {
    if (!r.hasAttribute("data-orig-width")) {
      r.setAttribute("data-orig-width", r.getAttribute("width") || "0");
      r.setAttribute("data-orig-height", r.getAttribute("height") || "0");
      r.setAttribute("data-orig-fill", r.getAttribute("fill") || "#FFFFFF");
    }
  });
  // Restore original rect fills (style overrides may have changed them)
  svg.querySelectorAll("rect[data-orig-fill]").forEach(r => {
    r.setAttribute("fill", r.getAttribute("data-orig-fill"));
  });
  // Reset icon filters (style overrides may have set invert(1))
  svg.querySelectorAll(".dg-icon").forEach(icon => { icon.style.filter = ""; });
  // Save original tspan text on first pass, restore on subsequent passes
  svg.querySelectorAll("[data-component-id] text").forEach(textEl => {
    if (!textEl.hasAttribute("data-orig-inner")) {
      textEl.setAttribute("data-orig-inner", textEl.innerHTML);
    } else {
      textEl.innerHTML = textEl.getAttribute("data-orig-inner");
    }
  });

  function applyToComponent(cid) {
    const eff = getEffectiveDelta(cid);
    svg.querySelectorAll('[data-component-id="' + cid + '"]').forEach(g => {
      if (eff.dx !== 0 || eff.dy !== 0) {
        g.style.transform = "translate(" + eff.dx + "px, " + eff.dy + "px)";
      }
      if (eff.dw !== 0 || eff.dh !== 0) {
        const rect = g.querySelector("rect:first-of-type");
        if (rect) {
          const origW = parseFloat(rect.getAttribute("data-orig-width") || rect.getAttribute("width"));
          const origH = parseFloat(rect.getAttribute("data-orig-height") || rect.getAttribute("height"));
          rect.setAttribute("width", Math.max(32, origW + eff.dw));
          rect.setAttribute("height", Math.max(32, origH + eff.dh));
        }
        // Re-anchor top-right icons when width changes
        if (eff.dw !== 0) {
          g.querySelectorAll(".dg-icon").forEach(icon => {
            if (!icon.hasAttribute("data-orig-tx")) {
              const m = (icon.getAttribute("transform") || "").match(/translate\(([\d.e+-]+)[, ]\s*([\d.e+-]+)\)/);
              if (m) {
                icon.setAttribute("data-orig-tx", m[1]);
                icon.setAttribute("data-orig-ty", m[2]);
              }
            }
            const otx = parseFloat(icon.getAttribute("data-orig-tx") || "0");
            const oty = parseFloat(icon.getAttribute("data-orig-ty") || "0");
            const ownDw = getOwnDelta(cid).dw;
            icon.setAttribute("transform", "translate(" + (otx + ownDw) + " " + oty + ")");
          });
        }
      }
      // Apply text overrides
      const ovr = overrides[cid];
      if (ovr && ovr.text) {
        const textEl = g.querySelector("text");
        if (textEl) {
          const tspans = textEl.querySelectorAll("tspan");
          const newLines = ovr.text;
          const minLen = Math.min(newLines.length, tspans.length);
          for (let i = 0; i < minLen; i++) {
            tspans[i].textContent = newLines[i];
          }
          // Add tspans for extra lines
          if (newLines.length > tspans.length && tspans.length > 0) {
            const lastTs = tspans[tspans.length - 1];
            const x = lastTs.getAttribute("x");
            const lastY = parseFloat(lastTs.getAttribute("y"));
            const lineStep = tspans.length >= 2
              ? parseFloat(tspans[1].getAttribute("y")) - parseFloat(tspans[0].getAttribute("y"))
              : 20;
            const ns = "http://www.w3.org/2000/svg";
            for (let ti = tspans.length; ti < newLines.length; ti++) {
              const ts = document.createElementNS(ns, "tspan");
              ts.setAttribute("x", x);
              ts.setAttribute("y", lastY + lineStep * (ti - tspans.length + 1));
              ts.setAttribute("font-size", lastTs.getAttribute("font-size") || "14");
              ts.setAttribute("font-weight", lastTs.getAttribute("font-weight") || "400");
              ts.setAttribute("fill", lastTs.getAttribute("fill") || "#000");
              ts.textContent = newLines[ti];
              textEl.appendChild(ts);
            }
          }
          // Remove excess tspans
          if (newLines.length < tspans.length) {
            for (let ti = tspans.length - 1; ti >= newLines.length; ti--) {
              tspans[ti].remove();
            }
          }
        }
      }
      // Apply style overrides (BoxStyle swap)
      if (ovr && ovr.style && BOX_STYLES[ovr.style]) {
        const preset = BOX_STYLES[ovr.style];
        const rect = g.querySelector("rect:first-of-type");
        if (rect) rect.setAttribute("fill", preset.fill);
        g.querySelectorAll("text tspan").forEach(ts => ts.setAttribute("fill", preset.text));
        g.querySelectorAll(".dg-icon").forEach(icon => {
          icon.style.filter = preset.icon === "#FFFFFF" ? "invert(1)" : "";
        });
      }
    });
  }
  // Apply to tree components
  function visit(nodes) {
    for (const node of nodes) {
      if (node.type !== "arrow") applyToComponent(node.id);
      if (node.children) visit(node.children);
    }
  }
  visit(componentTree);
  // Also handle overrides outside tree
  for (const cid of Object.keys(overrides)) applyToComponent(cid);

  // Arrow attachment: adjust arrow positions based on source/target box overrides
  for (const node of componentTree) {
    if (node.type !== "arrow" || (!node.source && !node.target)) continue;
    const srcCid = node.source ? node.source.split(".")[0] : "";
    const srcSide = node.source ? node.source.split(".").pop() : "";
    const tgtCid = node.target ? node.target.split(".")[0] : "";
    const tgtSide = node.target ? node.target.split(".").pop() : "";

    // Compute the endpoint deltas from source/target box overrides
    const srcEff = srcCid ? getEffectiveDelta(srcCid) : { dx: 0, dy: 0, dw: 0, dh: 0 };
    const tgtEff = tgtCid ? getEffectiveDelta(tgtCid) : { dx: 0, dy: 0, dw: 0, dh: 0 };

    // Side-aware endpoint shift: midpoint of the side shifts with dx/dy + half of dw/dh
    function sideShift(eff, side) {
      let sdx = eff.dx, sdy = eff.dy;
      if (side === "bottom") sdy += eff.dh;
      if (side === "top") {} // top edge doesn't move on dh
      if (side === "right") sdx += eff.dw;
      if (side === "left") {} // left edge doesn't move on dw
      // Side midpoint shifts by half the perpendicular size delta
      if (side === "top" || side === "bottom") sdx += eff.dw / 2;
      if (side === "left" || side === "right") sdy += eff.dh / 2;
      return { dx: sdx, dy: sdy };
    }

    const srcShift = sideShift(srcEff, srcSide);
    const tgtShift = sideShift(tgtEff, tgtSide);

    // If both shifts are the same, just CSS-translate the whole arrow group
    if (srcShift.dx === tgtShift.dx && srcShift.dy === tgtShift.dy) {
      if (srcShift.dx !== 0 || srcShift.dy !== 0) {
        svg.querySelectorAll('[data-component-id="' + node.id + '"]').forEach(g => {
          g.style.transform = "translate(" + srcShift.dx + "px, " + srcShift.dy + "px)";
        });
      }
    } else {
      // Different shifts for source vs target → modify individual line coords
      svg.querySelectorAll('[data-component-id="' + node.id + '"]').forEach(g => {
        const lines = g.querySelectorAll("line");
        const polys = g.querySelectorAll("polygon");
        if (lines.length === 0) return;

        // Save original coords on first pass
        lines.forEach(ln => {
          if (!ln.hasAttribute("data-orig-x1")) {
            ln.setAttribute("data-orig-x1", ln.getAttribute("x1"));
            ln.setAttribute("data-orig-y1", ln.getAttribute("y1"));
            ln.setAttribute("data-orig-x2", ln.getAttribute("x2"));
            ln.setAttribute("data-orig-y2", ln.getAttribute("y2"));
          }
        });
        polys.forEach(p => {
          if (!p.hasAttribute("data-orig-points")) {
            p.setAttribute("data-orig-points", p.getAttribute("points"));
          }
        });

        // Restore originals before applying new shifts
        lines.forEach(ln => {
          ln.setAttribute("x1", ln.getAttribute("data-orig-x1"));
          ln.setAttribute("y1", ln.getAttribute("data-orig-y1"));
          ln.setAttribute("x2", ln.getAttribute("data-orig-x2"));
          ln.setAttribute("y2", ln.getAttribute("data-orig-y2"));
        });
        polys.forEach(p => {
          p.setAttribute("points", p.getAttribute("data-orig-points"));
        });

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
        if (visLines.length > 1) {
          // Shift intermediate connections: line end/next line start
          // Linearly interpolate between source and target shifts for waypoints
          for (let i = 0; i < visLines.length; i++) {
            const t = visLines.length > 1 ? i / (visLines.length - 1) : 0;
            const nt = visLines.length > 1 ? (i + 1) / (visLines.length - 1) : 1;
            const wdx = srcShift.dx + t * (tgtShift.dx - srcShift.dx);
            const wdy = srcShift.dy + t * (tgtShift.dy - srcShift.dy);
            const wdx2 = srcShift.dx + nt * (tgtShift.dx - srcShift.dx);
            const wdy2 = srcShift.dy + nt * (tgtShift.dy - srcShift.dy);

            if (i > 0) {
              // Adjust start of this segment (= waypoint)
              visLines[i].setAttribute("x1", parseFloat(visLines[i].getAttribute("data-orig-x1") || visLines[i].getAttribute("x1")) + wdx);
              visLines[i].setAttribute("y1", parseFloat(visLines[i].getAttribute("data-orig-y1") || visLines[i].getAttribute("y1")) + wdy);
            }
            if (i < visLines.length - 1) {
              // Adjust end of this segment (= waypoint)
              visLines[i].setAttribute("x2", parseFloat(visLines[i].getAttribute("data-orig-x2") || visLines[i].getAttribute("x2")) + wdx2);
              visLines[i].setAttribute("y2", parseFloat(visLines[i].getAttribute("data-orig-y2") || visLines[i].getAttribute("y2")) + wdy2);
            }
          }
        }

        // Shift arrowhead polygon by target shift
        polys.forEach(p => {
          const origPts = p.getAttribute("data-orig-points");
          const shifted = origPts.split(/[, ]+/).reduce((acc, v, i) => {
            if (i % 2 === 0) acc.push(parseFloat(v) + tgtShift.dx);
            else acc[acc.length - 1] = acc[acc.length - 1] + "," + (parseFloat(v) + tgtShift.dy);
            return acc;
          }, []).join(" ");
          p.setAttribute("points", shifted);
        });

        // Update hit-area lines to match
        hitLines.forEach((hl, i) => {
          if (i < visLines.length) {
            hl.setAttribute("x1", visLines[i].getAttribute("x1"));
            hl.setAttribute("y1", visLines[i].getAttribute("y1"));
            hl.setAttribute("x2", visLines[i].getAttribute("x2"));
            hl.setAttribute("y2", visLines[i].getAttribute("y2"));
          }
        });
      });
    }
  }

  // Refresh resize handles if selected
  if (selectedIds.size > 0) showResizeHandles([...selectedIds].pop());
}

// ---- Interaction ----

function buildTreeUI() {
  const treeEl = document.getElementById("tree");
  treeEl.innerHTML = "";
  function buildTree(nodes, container, depth) {
    for (const node of nodes) {
      const item = document.createElement("div");
      item.className = "tree-item";
      item.style.paddingLeft = (8 + depth * 12) + "px";
      item.textContent = node.id;
      if (overrides[node.id]) item.style.color = "#E95420";
      item.onclick = (e) => { e.stopPropagation(); selectComponent(node.id, e.shiftKey); };
      container.appendChild(item);
      if (node.children && node.children.length > 0) {
        buildTree(node.children, container, depth + 1);
      }
    }
  }
  buildTree(model._roots.map(n => n.data), treeEl, 0);
}

function bindInteraction() {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;

  // Add invisible wider hit-area lines for arrow and separator components
  const ns = "http://www.w3.org/2000/svg";
  svg.querySelectorAll("[data-component-id]").forEach(g => {
    const hasRect = g.querySelector("rect");
    const lines = g.querySelectorAll("line");
    const icons = g.querySelectorAll(".dg-icon");
    if (lines.length > 0 && !hasRect) {
      // Arrow or separator group (lines, no rect) – add wider hit areas
      lines.forEach(ln => {
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
      });
    }
    if (icons.length > 0 && !hasRect) {
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
    }
  });

  // Build tree sidebar
  buildTreeUI();

  // Mouse handlers on SVG
  svg.addEventListener("mousedown", onSvgMouseDown);
  svg.addEventListener("dblclick", onSvgDblClick);
  svg.addEventListener("mouseover", (e) => {
    if (mgr.suppressHover) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const hoverCid = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth);
    svg.querySelectorAll(".dg-hover").forEach(el => el.classList.remove("dg-hover"));
    if (hoverCid) {
      svg.querySelectorAll('[data-component-id="' + hoverCid + '"]')
        .forEach(el => el.classList.add("dg-hover"));
    }
  });
  svg.addEventListener("mouseout", () => {
    if (!mgr.suppressHover) {
      svg.querySelectorAll(".dg-hover").forEach(el => el.classList.remove("dg-hover"));
    }
  });
}

// ---- Drag (move) ----

function onSvgDblClick(e) {
  if (e.target.classList.contains("dg-handle")) return;
  if (e.target.classList.contains("dg-wp-handle")) return;
  if (mgr.isMode(InteractionMode.TEXT_EDITING)) return;
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  const deeper = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth + 1);
  if (deeper) {
    selectionDepth++;
    selectComponent(deeper, false);
  } else {
    // No deeper child — try entering text edit on the current selection
    const current = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth);
    if (current && selectedIds.has(current)) {
      startTextEdit(current, e);
    }
  }
}

function onSvgMouseDown(e) {
  // Check if clicking a resize handle
  if (e.target.classList.contains("dg-handle")) {
    startResize(e);
    return;
  }
  
  const svg = document.querySelector("#stage svg");
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  
  // Find component at current selectionDepth (shallowest = depth 0 by default)
  const cid = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth);
  // Fall back: if nothing at current depth, try top-level
  const effectiveCid = cid || findComponentAtDepth(svgPt.x, svgPt.y, 0);
  
  if (e.button !== 0) return;
  if (!effectiveCid) {
    deselectAll();
    return;
  }
  
  // If clicking a different top-level group, reset to depth 0
  const clickedTopLevel = findComponentAtDepth(svgPt.x, svgPt.y, 0);
  const currentTopLevel = selectedIds.size > 0
    ? findComponentAtDepth(svgPt.x, svgPt.y, 0)
    : null;
  let currentSelectedTopLevel = null;
  if (selectedIds.size > 0) {
    const firstSelected = [...selectedIds][0];
    // Walk ancestors to find the root
    const ancestors = getAncestors(firstSelected);
    currentSelectedTopLevel = ancestors.length > 0 ? ancestors[0] : firstSelected;
  }
  if (clickedTopLevel && currentSelectedTopLevel && clickedTopLevel !== currentSelectedTopLevel) {
    selectionDepth = 0;
  }
  
  const finalCid = selectionDepth === 0 ? (clickedTopLevel || effectiveCid) : effectiveCid;

  // Shift+click: toggle additive selection, no drag
  if (e.shiftKey) {
    selectComponent(finalCid, true);
    e.preventDefault();
    return;
  }

  // Determine which components to drag
  let dragCids;
  if (selectedIds.has(finalCid)) {
    dragCids = [...selectedIds];
  } else {
    dragCids = [finalCid];
  }
  const origDeltas = {};
  for (const id of dragCids) {
    const own = getOwnDelta(id);
    origDeltas[id] = { dx: own.dx, dy: own.dy };
  }
  mgr.startDrag({ cid: finalCid, cids: dragCids, startX: e.clientX, startY: e.clientY,
                   origDeltas, hasMoved: false, snapshotRecorded: false,
                   snapTargets: dragCids.length === 1 ? collectSnapTargets(finalCid) : null });
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragUp);
  e.preventDefault();
}

function onDragMove(e) {
  if (!mgr.isMode(InteractionMode.DRAGGING)) return;
  const s = mgr.state;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasMoved = true;
  if (!s.hasMoved) return;
  // Record pre-drag snapshot on first actual move
  if (!s.snapshotRecorded) {
    recordSnapshot();
    s.snapshotRecorded = true;
  }
  for (const id of s.cids) {
    const orig = s.origDeltas[id];
    let newDx = Math.round((orig.dx + dx) / 8) * 8;
    let newDy = Math.round((orig.dy + dy) / 8) * 8;

    // Alignment snap guides (single-component drag only)
    if (s.snapTargets && s.cids.length === 1) {
      const snap = findSnaps(id, newDx, newDy, s.snapTargets);
      newDx = snap.snapDx;
      newDy = snap.snapDy;
      renderGuideLines(snap.lines);
    }

    // Clamp to parent bounds if nested
    const parent = getParentNode(id);
    const node = getComponentNode(id);
    if (parent && node && parent.type !== "arrow") {
      const pEff = getEffectiveDelta(parent.id);
      const pOwn = getOwnDelta(parent.id);
      const pLeft = parent.x + pEff.dx + INSET;
      const pTop = parent.y + pEff.dy + INSET;
      const pRight = pLeft + parent.width + pOwn.dw - 2 * INSET;
      const pBottom = pTop + parent.height + pOwn.dh - 2 * INSET;
      const own = getOwnDelta(id);
      const cW = node.width + own.dw;
      const cH = node.height + own.dh;
      const cLeft = node.x + newDx;
      const cTop = node.y + newDy;
      if (cLeft < pLeft) newDx = pLeft - node.x;
      if (cTop < pTop) newDy = pTop - node.y;
      if (cLeft + cW > pRight) newDx = pRight - cW - node.x;
      if (cTop + cH > pBottom) newDy = pBottom - cH - node.y;
    }

    setOverride(id, { dx: newDx, dy: newDy });
  }
  applyAllOverrides();
  if (selectedIds.has(s.cid) && selectedIds.size === 1) updateInspector(s.cid);
}

function onDragUp() {
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragUp);
  clearGuideLines();
  const s = mgr.state;
  if (s && s.hasMoved) {
    for (const id of s.cids) cleanOverride(id);
    if (s.cids.length === 1) {
      selectComponent(s.cid);
    } else {
      reapplySelection();
    }
  } else if (s) {
    selectComponent(s.cid);
  }
  mgr.endInteraction();
}

// ---- Resize ----

function getComponentType(cid) {
  return model.getType(cid) || "Box";
}

function showResizeHandles(cid) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Remove old handles
  svg.querySelectorAll(".dg-handle").forEach(h => h.remove());
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  if (groups.length === 0) return;
  // Compute union bbox accounting for transform
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {
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
  });
  const hs = HANDLE_SIZE;
  const ns = "http://www.w3.org/2000/svg";
  function mkHandle(cx, cy, cls, axis) {
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", cx - hs / 2);
    r.setAttribute("y", cy - hs / 2);
    r.setAttribute("width", hs);
    r.setAttribute("height", hs);
    r.setAttribute("class", "dg-handle " + cls);
    r.setAttribute("data-resize-cid", cid);
    r.setAttribute("data-resize-axis", axis);
    svg.appendChild(r);
  }
  const ctype = getComponentType(cid);
  const isHLine = ctype === "Separator";
  const isArrow = ctype === "arrow";
  if (isHLine) {
    // Horizontal line: left and right edge handles only
    mkHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
    mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
  } else if (isArrow) {
    // Arrow: show draggable waypoint handles (circles at each bend)
    showArrowWaypointHandles(cid);
  } else {
    // 2D component: all 8 handles
    mkHandle(minX, minY, "dg-handle-tl", "tl");
    mkHandle((minX + maxX) / 2, minY, "dg-handle-t", "t");
    mkHandle(maxX, minY, "dg-handle-tr", "tr");
    mkHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
    mkHandle(maxX, maxY, "dg-handle-br", "br");
    mkHandle((minX + maxX) / 2, maxY, "dg-handle-b", "b");
    mkHandle(minX, maxY, "dg-handle-bl", "bl");
    mkHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
  }
}

function removeResizeHandles() {
  const svg = document.querySelector("#stage svg");
  if (svg) {
    svg.querySelectorAll(".dg-handle").forEach(h => h.remove());
    svg.querySelectorAll(".dg-wp-handle").forEach(h => h.remove());
  }
}

// ---- Arrow waypoint handles ----

function getArrowNode(cid) {
  const node = model.get(cid);
  return (node && node.type === "arrow") ? node.data : null;
}

function showArrowWaypointHandles(cid) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Remove old waypoint handles
  svg.querySelectorAll(".dg-wp-handle").forEach(h => h.remove());
  svg.querySelectorAll(".dg-wp-add").forEach(h => h.remove());

  const node = getArrowNode(cid);
  if (!node) return;

  const wps = node.waypoints || [];
  if (wps.length === 0) return;

  const ns = "http://www.w3.org/2000/svg";
  const eff = getEffectiveDelta(cid);

  // Show a circle handle at each waypoint
  wps.forEach((wp, idx) => {
    const cx = wp[0] + eff.dx;
    const cy = wp[1] + eff.dy;
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", 5);
    circle.setAttribute("class", "dg-wp-handle");
    circle.setAttribute("data-wp-cid", cid);
    circle.setAttribute("data-wp-idx", idx);
    circle.addEventListener("mousedown", startWpDrag);
    circle.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      removeWaypoint(cid, idx);
    });
    svg.appendChild(circle);
  });

  // Make arrow segments clickable to add waypoints at click position.
  // We attach listeners to the transparent hit-area lines in the arrow group
  // so clicks anywhere on the segment body (not just a midpoint) work.
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let segIdx = 0;
  groups.forEach(g => {
    g.querySelectorAll("line").forEach(ln => {
      if (ln.style.pointerEvents !== "stroke") return; // only hit-area lines
      const idx = segIdx++;
      // Tag for cleanup
      ln.setAttribute("data-wp-seg-cid", cid);
      ln.setAttribute("data-wp-seg-idx", idx);
      ln.addEventListener("dblclick", function wpSegClick(e) {
        e.stopPropagation();
        const svg = document.querySelector("#stage svg");
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
        // Snap to 4px grid
        const snapX = Math.round(svgPt.x / 8) * 8;
        const snapY = Math.round(svgPt.y / 8) * 8;
        addWaypoint(cid, idx, snapX - eff.dx, snapY - eff.dy);
      });
    });
  });
}

function startWpDrag(e) {
  const cid = e.target.getAttribute("data-wp-cid");
  const idx = parseInt(e.target.getAttribute("data-wp-idx"), 10);
  const node = getArrowNode(cid);
  if (!node || !node.waypoints || !node.waypoints[idx]) return;

  mgr.startWaypointDrag({
    cid, idx,
    startX: e.clientX, startY: e.clientY,
    origX: node.waypoints[idx][0],
    origY: node.waypoints[idx][1],
    hasMoved: false,
    axis: null,  // will be set on first move
  });
  document.addEventListener("mousemove", onWpDragMove);
  document.addEventListener("mouseup", onWpDragUp);
  e.preventDefault();
  e.stopPropagation();
}

function onWpDragMove(e) {
  if (!mgr.isMode(InteractionMode.WAYPOINT_DRAGGING)) return;
  const s = mgr.state;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasMoved = true;
  if (!s.hasMoved) return;

  const node = getArrowNode(s.cid);
  if (!node || !node.waypoints) return;

  const wps = node.waypoints;
  const idx = s.idx;

  // Determine axis constraint from adjacent segments on first move.
  // For orthogonal arrows, a waypoint that sits on a straight horizontal
  // or vertical run should only move perpendicular to that run.
  if (s.axis === null) {
    const pts = getArrowPoints(s.cid);
    if (pts.start) {
      const all = [pts.start, ...wps, pts.end];
      const ai = idx + 1;  // offset for start point
      const prev = all[ai - 1];
      const next = all[ai + 1];
      const inH = Math.abs(prev[1] - s.origY) < 2;  // prev segment horizontal
      const inV = Math.abs(prev[0] - s.origX) < 2;  // prev segment vertical
      const outH = Math.abs(next[1] - s.origY) < 2; // next segment horizontal
      const outV = Math.abs(next[0] - s.origX) < 2; // next segment vertical
      if (inH && outH) s.axis = "y";       // on horizontal run → move vertically
      else if (inV && outV) s.axis = "x";  // on vertical run → move horizontally
      else s.axis = "free";                 // corner → free movement
    } else {
      s.axis = "free";
    }
  }

  let newX = s.origX + dx;
  let newY = s.origY + dy;

  // Apply axis constraint
  if (s.axis === "x") newY = s.origY;
  if (s.axis === "y") newX = s.origX;

  // Snap to 4px grid
  const snapX = Math.round(newX / 8) * 8;
  const snapY = Math.round(newY / 8) * 8;

  // Update the waypoint position in the component tree
  wps[idx] = [snapX, snapY];

  // Visually update the SVG lines and waypoint handle
  updateArrowVisual(s.cid);
  e.preventDefault();
}

function onWpDragUp(e) {
  document.removeEventListener("mousemove", onWpDragMove);
  document.removeEventListener("mouseup", onWpDragUp);
  const s = mgr.state;
  if (s && s.hasMoved) {
    // Prune collinear waypoints (dragged onto a straight line between neighbours)
    pruneCollinearWaypoints(s.cid);
    recordSnapshot();
    setWaypointOverride(s.cid);
  }
  mgr.endInteraction();
}

// Remove any waypoint that sits on a straight line between its neighbours.
// Tolerance in px – if the perpendicular distance from the waypoint to the
// line through its neighbours is below this, the waypoint is redundant.
function pruneCollinearWaypoints(cid) {
  const node = getArrowNode(cid);
  if (!node || !node.waypoints || node.waypoints.length === 0) return;

  const pts = getArrowPoints(cid);
  if (!pts.start) return;

  // Full ordered point list: start → waypoints → end
  const all = [pts.start, ...node.waypoints, pts.end];
  const TOLERANCE = 2; // px

  // Walk backwards so splicing doesn't shift indices of points still to check
  let changed = false;
  for (let i = node.waypoints.length - 1; i >= 0; i--) {
    // Index inside `all` is i + 1 (offset by the start point)
    const ai = i + 1;
    const prev = all[ai - 1];
    const cur  = all[ai];
    const next = all[ai + 1];
    // Perpendicular distance of cur from line prev→next
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) { node.waypoints.splice(i, 1); changed = true; continue; }
    const dist = Math.abs(dx * (prev[1] - cur[1]) - dy * (prev[0] - cur[0])) / len;
    if (dist < TOLERANCE) {
      node.waypoints.splice(i, 1);
      all.splice(ai, 1);
      changed = true;
    }
  }

  if (changed) {
    rebuildArrowSVG(cid);
    showArrowWaypointHandles(cid);
  }
}

function addWaypoint(cid, segIdx, x, y) {
  const node = getArrowNode(cid);
  if (!node) return;
  if (!node.waypoints) node.waypoints = [];
  const snapX = Math.round(x / 8) * 8;
  const snapY = Math.round(y / 8) * 8;
  node.waypoints.splice(segIdx, 0, [snapX, snapY]);
  rebuildArrowSVG(cid);
  showArrowWaypointHandles(cid);
  recordSnapshot();
  setWaypointOverride(cid);
}

function removeWaypoint(cid, idx) {
  const node = getArrowNode(cid);
  if (!node || !node.waypoints || node.waypoints.length <= 1) return;
  recordSnapshot();
  node.waypoints.splice(idx, 1);
  rebuildArrowSVG(cid);
  showArrowWaypointHandles(cid);
  setWaypointOverride(cid);
}

function getArrowPoints(cid) {
  // Build the full point list for an arrow: start → waypoints → end
  const svg = document.querySelector("#stage svg");
  if (!svg) return [];
  const node = getArrowNode(cid);
  if (!node) return [];

  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let visLines = [];
  let poly = null;
  groups.forEach(g => {
    g.querySelectorAll("line").forEach(ln => {
      if (ln.getAttribute("stroke") !== "transparent") visLines.push(ln);
    });
    const p = g.querySelector("polygon");
    if (p) poly = p;
  });

  if (visLines.length === 0) return [];

  // Start point from first line
  const sx = parseFloat(visLines[0].getAttribute("data-orig-x1") || visLines[0].getAttribute("x1"));
  const sy = parseFloat(visLines[0].getAttribute("data-orig-y1") || visLines[0].getAttribute("y1"));

  // End point: arrowhead tip from polygon
  let ex, ey;
  if (poly) {
    const ptsStr = (poly.getAttribute("data-orig-points") || poly.getAttribute("points")).trim();
    const ptsArr = ptsStr.split(/\s+/).map(s => s.split(",").map(Number));
    if (ptsArr.length >= 3) { ex = ptsArr[1][0]; ey = ptsArr[1][1]; }
    else { ex = sx; ey = sy; }
  } else {
    const last = visLines[visLines.length - 1];
    ex = parseFloat(last.getAttribute("data-orig-x2") || last.getAttribute("x2"));
    ey = parseFloat(last.getAttribute("data-orig-y2") || last.getAttribute("y2"));
  }

  return { start: [sx, sy], end: [ex, ey] };
}

function updateArrowVisual(cid) {
  // Update SVG line coordinates to match current waypoints in componentTree
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const node = getArrowNode(cid);
  if (!node) return;

  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  const wps = node.waypoints || [];
  const eff = getEffectiveDelta(cid);

  let visLines = [];
  let hitLines = [];
  let poly = null;
  groups.forEach(g => {
    g.querySelectorAll("line").forEach(ln => {
      if (ln.getAttribute("stroke") === "transparent") hitLines.push(ln);
      else visLines.push(ln);
    });
    const p = g.querySelector("polygon");
    if (p) poly = p;
  });

  if (visLines.length === 0) return;

  // Get the original start/end points
  const pts = getArrowPoints(cid);
  if (!pts.start) return;

  // Build full point list: start → waypoints → end
  const allPts = [pts.start, ...wps, pts.end];

  // Arrow head geometry constants
  const HEAD_LEN = window.__DG_CONFIG.head_len;
  const HEAD_HALF = window.__DG_CONFIG.head_half;

  // Update each visible line segment
  // There should be (waypoints.length + 1) segments = (allPts.length - 1) segments
  // But SVG may have different count if waypoints were added/removed
  // If counts match, update in place; otherwise rebuild is needed
  if (visLines.length === allPts.length - 1) {
    for (let i = 0; i < visLines.length; i++) {
      visLines[i].setAttribute("x1", allPts[i][0]);
      visLines[i].setAttribute("y1", allPts[i][1]);
      if (i < visLines.length - 1) {
        // Intermediate segment: end at next waypoint
        visLines[i].setAttribute("x2", allPts[i + 1][0]);
        visLines[i].setAttribute("y2", allPts[i + 1][1]);
      } else {
        // Last segment: end at arrowhead base (not tip)
        const tipX = allPts[i + 1][0];
        const tipY = allPts[i + 1][1];
        const prevX = allPts[i][0];
        const prevY = allPts[i][1];
        // Calculate arrowhead base
        const segDx = tipX - prevX;
        const segDy = tipY - prevY;
        const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
        if (segLen > HEAD_LEN) {
          const baseX = tipX - (segDx / segLen) * HEAD_LEN;
          const baseY = tipY - (segDy / segLen) * HEAD_LEN;
          visLines[i].setAttribute("x2", baseX);
          visLines[i].setAttribute("y2", baseY);
        } else {
          visLines[i].setAttribute("x2", tipX);
          visLines[i].setAttribute("y2", tipY);
        }
      }
    }

    // Update hit-area lines to match
    for (let i = 0; i < hitLines.length && i < visLines.length; i++) {
      hitLines[i].setAttribute("x1", visLines[i].getAttribute("x1"));
      hitLines[i].setAttribute("y1", visLines[i].getAttribute("y1"));
      hitLines[i].setAttribute("x2", visLines[i].getAttribute("x2"));
      hitLines[i].setAttribute("y2", visLines[i].getAttribute("y2"));
    }

    // Update arrowhead polygon
    if (poly && allPts.length >= 2) {
      const tipX = allPts[allPts.length - 1][0];
      const tipY = allPts[allPts.length - 1][1];
      const prevX = allPts[allPts.length - 2][0];
      const prevY = allPts[allPts.length - 2][1];
      const segDx = tipX - prevX;
      const segDy = tipY - prevY;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      if (segLen > 0) {
        const ux = segDx / segLen;
        const uy = segDy / segLen;
        const baseX = tipX - ux * HEAD_LEN;
        const baseY = tipY - uy * HEAD_LEN;
        const perpX = -uy * HEAD_HALF;
        const perpY = ux * HEAD_HALF;
        const p1 = (baseX + perpX) + "," + (baseY + perpY);
        const p2 = tipX + "," + tipY;
        const p3 = (baseX - perpX) + "," + (baseY - perpY);
        poly.setAttribute("points", p1 + " " + p2 + " " + p3);
      }
    }
  }

  // Update waypoint handles positions
  svg.querySelectorAll('.dg-wp-handle[data-wp-cid="' + cid + '"]').forEach(h => {
    const idx = parseInt(h.getAttribute("data-wp-idx"), 10);
    if (wps[idx]) {
      h.setAttribute("cx", wps[idx][0] + eff.dx);
      h.setAttribute("cy", wps[idx][1] + eff.dy);
    }
  });
}

function rebuildArrowSVG(cid) {
  // When waypoint count changes (add/remove), rebuild the arrow SVG elements
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const node = getArrowNode(cid);
  if (!node) return;
  const wps = node.waypoints || [];
  const pts = getArrowPoints(cid);
  if (!pts.start) return;

  const allPts = [pts.start, ...wps, pts.end];
  const HEAD_LEN = window.__DG_CONFIG.head_len;
  const HEAD_HALF = window.__DG_CONFIG.head_half;
  const color = "#E95420";

  // Find the existing arrow group and rebuild its contents
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  if (groups.length === 0) return;
  const g = groups[0];

  // Clear existing lines and polygon
  g.querySelectorAll("line, polygon").forEach(el => el.remove());

  const ns = "http://www.w3.org/2000/svg";

  // Build line segments
  for (let i = 0; i < allPts.length - 1; i++) {
    const x1 = allPts[i][0];
    const y1 = allPts[i][1];
    let x2, y2;

    if (i < allPts.length - 2) {
      x2 = allPts[i + 1][0];
      y2 = allPts[i + 1][1];
    } else {
      // Last segment: end at arrowhead base
      const tipX = allPts[i + 1][0];
      const tipY = allPts[i + 1][1];
      const segDx = tipX - x1;
      const segDy = tipY - y1;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      if (segLen > HEAD_LEN) {
        x2 = tipX - (segDx / segLen) * HEAD_LEN;
        y2 = tipY - (segDy / segLen) * HEAD_LEN;
      } else {
        x2 = tipX; y2 = tipY;
      }
    }

    // Visible line
    const ln = document.createElementNS(ns, "line");
    ln.setAttribute("x1", x1); ln.setAttribute("y1", y1);
    ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
    ln.setAttribute("stroke", color); ln.setAttribute("stroke-width", "1");
    g.appendChild(ln);

    // Hit-area line (transparent, fat)
    const hit = document.createElementNS(ns, "line");
    hit.setAttribute("x1", x1); hit.setAttribute("y1", y1);
    hit.setAttribute("x2", x2); hit.setAttribute("y2", y2);
    hit.setAttribute("stroke", "transparent"); hit.setAttribute("stroke-width", "12");
    hit.style.pointerEvents = "stroke";
    g.appendChild(hit);
  }

  // Build arrowhead polygon
  if (allPts.length >= 2) {
    const tipX = allPts[allPts.length - 1][0];
    const tipY = allPts[allPts.length - 1][1];
    const prevX = allPts[allPts.length - 2][0];
    const prevY = allPts[allPts.length - 2][1];
    const segDx = tipX - prevX;
    const segDy = tipY - prevY;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
    if (segLen > 0) {
      const ux = segDx / segLen;
      const uy = segDy / segLen;
      const baseX = tipX - ux * HEAD_LEN;
      const baseY = tipY - uy * HEAD_LEN;
      const perpX = -uy * HEAD_HALF;
      const perpY = ux * HEAD_HALF;
      const poly = document.createElementNS(ns, "polygon");
      poly.setAttribute("points",
        (baseX + perpX) + "," + (baseY + perpY) + " " +
        tipX + "," + tipY + " " +
        (baseX - perpX) + "," + (baseY - perpY));
      poly.setAttribute("fill", color);
      g.appendChild(poly);
    }
  }
}

// ---- Inline text editing ----

function startTextEdit(cid, e) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;

  // Find the <text> element(s) inside this component's group
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let textEl = null;
  groups.forEach(g => {
    const t = g.querySelector("text");
    if (t && !textEl) textEl = t;
  });
  if (!textEl) return;

  // Get the text element's bounding box in screen coordinates
  const tspans = textEl.querySelectorAll("tspan");
  if (tspans.length === 0) return;

  // Collect existing text content (one line per tspan)
  const lines = [];
  const styles = [];
  tspans.forEach(ts => {
    lines.push(ts.textContent);
    styles.push({
      fontSize: ts.getAttribute("font-size") || "14",
      fontWeight: ts.getAttribute("font-weight") || "400",
      fill: ts.getAttribute("fill") || "#000",
    });
  });

  // Get bounding rect of the text element in page coordinates
  const textBBox = textEl.getBoundingClientRect();
  // Also get the parent component's bounding rect for width constraint
  let containerRect = textBBox;
  let hasIcon = false;
  groups.forEach(g => {
    const rect = g.querySelector("rect");
    if (rect) containerRect = rect.getBoundingClientRect();
    if (g.querySelector(".dg-icon")) hasIcon = true;
  });

  // Width: container minus insets, minus icon area + gutter if icon present
  const iconGutter = hasIcon ? (window.__DG_CONFIG.icon_size + window.__DG_CONFIG.col_gap) : 0;
  const editorW = Math.max(containerRect.width - 16 - iconGutter, 60);

  // Create textarea overlay
  const ta = document.createElement("textarea");
  ta.className = "dg-text-editor";
  ta.value = lines.join("\\n");
  ta.style.left = textBBox.left + "px";
  ta.style.top = textBBox.top + "px";
  ta.style.width = editorW + "px";
  ta.style.minHeight = textBBox.height + "px";
  ta.style.fontSize = (styles[0] ? styles[0].fontSize : "14") + "px";
  ta.style.fontWeight = styles[0] ? styles[0].fontWeight : "400";
  ta.style.color = styles[0] ? styles[0].fill : "#000";

  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  // Hide the original text while editing
  textEl.style.opacity = "0";

  mgr.startTextEdit({ cid, textEl, ta, originalLines: lines, styles });

  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      cancelTextEdit();
    } else if (ev.key === "Enter" && ev.ctrlKey) {
      ev.preventDefault();
      commitTextEdit();
    }
    // Regular Enter inserts a line break (default textarea behavior)
  });
  ta.addEventListener("blur", () => {
    // Small delay to avoid race with Escape
    setTimeout(() => { if (mgr.isMode(InteractionMode.TEXT_EDITING)) commitTextEdit(); }, 100);
  });
  // Prevent SVG interactions while editing
  e.stopPropagation();
}

function commitTextEdit() {
  if (!mgr.isMode(InteractionMode.TEXT_EDITING)) return;
  const { cid, textEl, ta, originalLines, styles } = mgr.state;
  const newLines = ta.value.split("\\n");

  // Check if text actually changed
  const changed = newLines.join("\\n") !== originalLines.join("\\n");

  if (changed) {
    // Record undo snapshot BEFORE applying the change
    recordSnapshot();

    // Store text override so undo/redo can restore it
    setOverride(cid, { text: newLines });
  }

  // Update the tspan content
  const tspans = textEl.querySelectorAll("tspan");
  const minLen = Math.min(newLines.length, tspans.length);

  // Update existing tspans
  for (let i = 0; i < minLen; i++) {
    tspans[i].textContent = newLines[i];
  }

  // If more lines than tspans, add new tspans
  if (newLines.length > tspans.length) {
    const lastTs = tspans[tspans.length - 1];
    const x = lastTs.getAttribute("x");
    const lastY = parseFloat(lastTs.getAttribute("y"));
    const lineStep = tspans.length >= 2
      ? parseFloat(tspans[1].getAttribute("y")) - parseFloat(tspans[0].getAttribute("y"))
      : 20;
    const ns = "http://www.w3.org/2000/svg";
    for (let i = tspans.length; i < newLines.length; i++) {
      const ts = document.createElementNS(ns, "tspan");
      ts.setAttribute("x", x);
      ts.setAttribute("y", lastY + lineStep * (i - tspans.length + 1));
      ts.setAttribute("font-size", lastTs.getAttribute("font-size") || "14");
      ts.setAttribute("font-weight", lastTs.getAttribute("font-weight") || "400");
      ts.setAttribute("fill", lastTs.getAttribute("fill") || "#000");
      ts.textContent = newLines[i];
      textEl.appendChild(ts);
    }
  }

  // If fewer lines, remove extra tspans
  if (newLines.length < tspans.length) {
    for (let i = tspans.length - 1; i >= newLines.length; i--) {
      tspans[i].remove();
    }
  }

  // Show the text again
  textEl.style.opacity = "";

  // Remove the textarea
  ta.remove();

  mgr.endInteraction();
}

function cancelTextEdit() {
  if (!mgr.isMode(InteractionMode.TEXT_EDITING)) return;
  mgr.state.textEl.style.opacity = "";
  mgr.state.ta.remove();
  mgr.endInteraction();
}

function startResize(e) {
  const handle = e.target;
  const cid = handle.getAttribute("data-resize-cid");
  const axis = handle.getAttribute("data-resize-axis");
  const own = getOwnDelta(cid);
  // Capture original overrides for children, parent, and siblings (for propagation)
  const origChildOverrides = {};
  const node = model.get(cid);
  if (node) {
    // Children's original overrides
    for (const child of node.children) {
      const co = getOwnDelta(child.id);
      origChildOverrides[child.id] = { dx: co.dx, dy: co.dy, dw: co.dw, dh: co.dh };
    }
    // Parent's original overrides (for auto-layout fill)
    if (node.parent) {
      const po = getOwnDelta(node.parent.id);
      origChildOverrides[node.parent.id] = { dx: po.dx, dy: po.dy, dw: po.dw, dh: po.dh };
      // Siblings' original overrides (for sibling fill redistribution)
      const siblings = model.getSiblings(cid);
      for (const sib of siblings) {
        const so = getOwnDelta(sib.id);
        origChildOverrides[sib.id] = { dx: so.dx, dy: so.dy, dw: so.dw, dh: so.dh };
      }
    }
  }
  mgr.startResize({
    cid, axis,
    startX: e.clientX, startY: e.clientY,
    origDx: own.dx, origDy: own.dy,
    origDw: own.dw, origDh: own.dh,
    origChildOverrides,
    hasMoved: false, snapshotRecorded: false,
  });
  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", onResizeUp);
  e.preventDefault();
  e.stopPropagation();
}

function onResizeMove(e) {
  if (!mgr.isMode(InteractionMode.RESIZING)) return;
  const s = mgr.state;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasMoved = true;
  if (!s.hasMoved) return;
  // Record pre-resize snapshot on first actual move
  if (!s.snapshotRecorded) {
    recordSnapshot();
    // Hide handles during drag so stale positions don't overlap icons
    const svg = document.querySelector("#stage svg");
    if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.style.display = "none");
    s.snapshotRecorded = true;
  }
  let newDx = s.origDx;
  let newDy = s.origDy;
  let newDw = s.origDw;
  let newDh = s.origDh;
  
  const axis = s.axis;
  // Handle horizontal resizing
  if (axis === "l" || axis === "tl" || axis === "bl") {
    // Left side: move left edge, right edge stays anchored
    const delta = Math.round(dx / 8) * 8;
    newDx = s.origDx + delta;
    newDw = s.origDw - delta;
  } else if (axis === "r" || axis === "tr" || axis === "br") {
    // Right side: left edge stays anchored, grow rightward
    newDw = Math.round((s.origDw + dx) / 8) * 8;
  }
  
  // Handle vertical resizing
  if (axis === "t" || axis === "tl" || axis === "tr") {
    // Top side: move top edge, bottom edge stays anchored
    const delta = Math.round(dy / 8) * 8;
    newDy = s.origDy + delta;
    newDh = s.origDh - delta;
  } else if (axis === "b" || axis === "bl" || axis === "br") {
    // Bottom side: top edge stays anchored, grow downward
    newDh = Math.round((s.origDh + dy) / 8) * 8;
  }

  // Clamp to parent bounds if nested
  const parent = getParentNode(s.cid);
  const node = getComponentNode(s.cid);
  if (parent && node && parent.type !== "arrow") {
    const pEff = getEffectiveDelta(parent.id);
    const pOwn = getOwnDelta(parent.id);
    const pLeft = parent.x + pEff.dx + INSET;
    const pTop = parent.y + pEff.dy + INSET;
    const pRight = pLeft + parent.width + pOwn.dw - 2 * INSET;
    const pBottom = pTop + parent.height + pOwn.dh - 2 * INSET;

    // Compute the child's effective box with proposed overrides
    const cLeft = node.x + newDx;
    const cTop = node.y + newDy;
    const cRight = cLeft + node.width + newDw;
    const cBottom = cTop + node.height + newDh;

    // Clamp: child edges cannot exceed parent edges
    // Adjust position-based overrides (left/top edges)
    if (cLeft < pLeft) newDx += (pLeft - cLeft);
    if (cTop < pTop) newDy += (pTop - cTop);
    // Adjust size-based overrides (right/bottom edges)
    if (cRight > pRight) newDw -= (cRight - pRight);
    if (cBottom > pBottom) newDh -= (cBottom - pBottom);
    // Re-check left/top after size clamp for left/top resize axes
    if (axis === "l" || axis === "tl" || axis === "bl") {
      const adjRight = node.x + newDx + node.width + newDw;
      if (adjRight > pRight) newDw = pRight - node.x - newDx - node.width;
    }
    if (axis === "t" || axis === "tl" || axis === "tr") {
      const adjBottom = node.y + newDy + node.height + newDh;
      if (adjBottom > pBottom) newDh = pBottom - node.y - newDy - node.height;
    }
  }

  setOverride(s.cid, { dx: newDx, dy: newDy, dw: newDw, dh: newDh });

  // Propagate resize to children (auto-layout): parent resize → children resize
  const resizedNode = model.get(s.cid);
  if (!s.propagatedIds) s.propagatedIds = new Set();
  if (resizedNode && resizedNode.children.length > 0 && resizedNode.layout) {
    const deltaDw = newDw - s.origDw;
    const deltaDh = newDh - s.origDh;
    const childDeltas = model.propagateResize(s.cid, deltaDw, deltaDh);
    for (const [childId, delta] of Object.entries(childDeltas)) {
      const origChild = s.origChildOverrides[childId] || { dw: 0, dh: 0 };
      setOverride(childId, { dw: origChild.dw + delta.dw, dh: origChild.dh + delta.dh });
      s.propagatedIds.add(childId);
    }
  }

  // Auto-layout fill: child resize → siblings absorb the delta
  if (resizedNode && resizedNode.parent && resizedNode.parent.layout) {
    const deltaDw = newDw - s.origDw;
    const deltaDh = newDh - s.origDh;
    const siblingAdj = model.redistributeAfterChildResize(s.cid, deltaDw, deltaDh);
    for (const [adjId, delta] of Object.entries(siblingAdj)) {
      const origAdj = s.origChildOverrides[adjId] || { dx: 0, dy: 0, dw: 0, dh: 0 };
      const patch = {};
      if (delta.dw !== undefined) patch.dw = origAdj.dw + delta.dw;
      if (delta.dh !== undefined) patch.dh = origAdj.dh + delta.dh;
      if (delta.dx !== undefined) patch.dx = origAdj.dx + delta.dx;
      if (delta.dy !== undefined) patch.dy = origAdj.dy + delta.dy;
      setOverride(adjId, patch);
      s.propagatedIds.add(adjId);
    }
  }

  applyAllOverrides();
  if (selectedIds.has(s.cid)) updateInspector(s.cid);
}

function onResizeUp() {
  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", onResizeUp);
  clearGuideLines();
  // Clear any hover effects that accumulated during the drag
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-hover").forEach(el => el.classList.remove("dg-hover"));
  const s = mgr.state;
  if (s && s.hasMoved) {
    cleanOverride(s.cid);
    // Clean propagated child/parent overrides (only zero-valued fields)
    if (s.propagatedIds) {
      for (const childId of s.propagatedIds) {
        cleanOverride(childId);
      }
    }
    selectComponent(s.cid);
  } else {
    // No move happened: re-show handles that were hidden
    if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.style.display = "");
  }
  mgr.endInteraction();
}

// ---- Override helpers ----

function setOverride(cid, partial) {
  model.setOverride(cid, partial);
  setDirty(true);
}

function setWaypointOverride(cid) {
  // Persist current waypoints from the component tree into overrides
  const node = getArrowNode(cid);
  if (!node) return;
  const wps = node.waypoints ? JSON.parse(JSON.stringify(node.waypoints)) : [];
  model.setWaypointOverride(cid, wps);
  setDirty(true);
}

function cleanOverride(cid) {
  model.cleanOverride(cid);
}

function applyStyleOverride(cid, styleName) {
  recordSnapshot();
  if (styleName && BOX_STYLES[styleName]) {
    setOverride(cid, { style: styleName });
  } else {
    // Clear style override
    const ovr = overrides[cid];
    if (ovr) {
      delete ovr.style;
      model.cleanOverride(cid);
    }
    setDirty(true);
  }
  applyAllOverrides();
  reapplySelection();
  runConstraints();
  updateInspector(cid);
}

// ---- Selection & Inspector ----

function deselectAll() {
  selectedIds.clear();
  selectionDepth = 0;
  const svg = document.querySelector("#stage svg");
  if (svg) {
    svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  }
  removeResizeHandles();
  document.querySelectorAll(".tree-item").forEach(el => el.classList.remove("selected"));
  document.getElementById("inspector").innerHTML =
    '<div style="color:#555">Click a component to inspect it.</div>';
}

function selectComponent(cid, additive) {
  if (additive) {
    if (selectedIds.has(cid)) {
      selectedIds.delete(cid);
    } else {
      selectedIds.add(cid);
    }
  } else {
    selectedIds.clear();
    selectedIds.add(cid);
  }
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  selectedIds.forEach(id => {
    svg.querySelectorAll('[data-component-id="' + id + '"]')
      .forEach(g => g.classList.add("dg-selected"));
  });
  document.querySelectorAll(".tree-item").forEach(el => {
    el.classList.toggle("selected", selectedIds.has(el.textContent));
  });
  showResizeHandles(cid);
  if (selectedIds.size === 1) {
    updateInspector(cid);
  } else if (selectedIds.size > 1) {
    document.getElementById("inspector").innerHTML =
      '<div style="color:#555">' + selectedIds.size + ' components selected. Drag to move all.</div>';
  } else {
    document.getElementById("inspector").innerHTML =
      '<div style="color:#555">Click a component to inspect it.</div>';
  }
}

function reapplySelection() {
  const svg = document.querySelector("#stage svg");
  if (!svg || selectedIds.size === 0) return;
  svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  selectedIds.forEach(id => {
    svg.querySelectorAll('[data-component-id="' + id + '"]')
      .forEach(g => g.classList.add("dg-selected"));
  });
  document.querySelectorAll(".tree-item").forEach(el => {
    el.classList.toggle("selected", selectedIds.has(el.textContent));
  });
  const primary = [...selectedIds].pop();
  if (primary) showResizeHandles(primary);
}

function clearSelection() {
  selectedIds.clear();
  selectionDepth = 0;
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  removeResizeHandles();
  document.querySelectorAll(".tree-item.selected").forEach(el => el.classList.remove("selected"));
  document.getElementById("inspector").innerHTML =
    '<div style="color:#555">Click a component to inspect it.</div>';
}

function updateInspector(cid) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {
    const bbox = g.getBBox();
    minX = Math.min(minX, bbox.x); minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width); maxY = Math.max(maxY, bbox.y + bbox.height);
  });
  const own = getOwnDelta(cid);
  const eff = getEffectiveDelta(cid);
  const hasMoveOverride = own.dx !== 0 || own.dy !== 0;
  const hasSizeOverride = own.dw !== 0 || own.dh !== 0;
  const arrowNode = getArrowNode(cid);
  const hasWpOverride = !!(overrides[cid] && overrides[cid].waypoints);
  const hasOverride = hasMoveOverride || hasSizeOverride || hasWpOverride;
  const hasParentOverride = eff.dx !== own.dx || eff.dy !== own.dy;

  let html = '<div class="field"><span class="label">Component</span><br>' +
    '<span class="value">' + cid + '</span></div>';
  html += '<div class="field"><span class="label">Computed position</span><br>' +
    '<span class="value">' + Math.round(minX) + ', ' + Math.round(minY) + '</span></div>';
  html += '<div class="field"><span class="label">Size</span><br>' +
    '<span class="value">' + Math.round(maxX - minX) + ' &#x00d7; ' + Math.round(maxY - minY) + '</span></div>';
  // Show layout type if this component has children
  const inspNode = model.get(cid);
  if (inspNode && inspNode.layout) {
    html += '<div class="field"><span class="label">Layout</span><br>' +
      '<span class="value">' + inspNode.layout + (inspNode.layoutGap ? ' (gap ' + inspNode.layoutGap + 'px)' : '') + '</span></div>';
  }
  if (hasMoveOverride) {
    html += '<div class="field"><span class="label">Position override</span><br>' +
      '<span class="value override">dx=' + own.dx + '  dy=' + own.dy + '</span></div>';
  }
  if (hasSizeOverride) {
    html += '<div class="field"><span class="label">Size override</span><br>' +
      '<span class="value override">dw=' + own.dw + '  dh=' + own.dh + '</span></div>';
  }
  if (hasParentOverride) {
    html += '<div class="field"><span class="label">Effective (incl. parents)</span><br>' +
      '<span class="value override">dx=' + eff.dx + '  dy=' + eff.dy + '</span></div>';
  }
  if (arrowNode) {
    const wpCount = arrowNode.waypoints ? arrowNode.waypoints.length : 0;
    html += '<div class="field"><span class="label">Waypoints</span><br>' +
      '<span class="value' + (hasWpOverride ? ' override' : '') + '">' + wpCount +
      (hasWpOverride ? ' (overridden)' : '') + '</span></div>';
  }
  if (hasOverride) {
    html += '<button class="danger" onclick="clearOverride(\''+cid+'\')">Clear override</button>';
  }
  // Style picker for box-type components
  const ctype = getComponentType(cid).toLowerCase();
  if (ctype === "box" || ctype === "panel" || ctype === "terminal") {
    const currentStyle = (overrides[cid] && overrides[cid].style) || "";
    html += '<div class="field" style="margin-top:6px"><span class="label">Style</span><br>';
    html += '<select class="style-picker" onchange="applyStyleOverride(\'' + cid + '\', this.value)">';
    html += '<option value=""' + (currentStyle === "" ? ' selected' : '') + '>— original —</option>';
    for (const [key, preset] of Object.entries(BOX_STYLES)) {
      html += '<option value="' + key + '"' + (currentStyle === key ? ' selected' : '') + '>' +
              preset.label + '</option>';
    }
    html += '</select></div>';
  }
  // Show constraint violations for this component
  const cv = getViolationsForComponent(cid);
  if (cv.length > 0) {
    html += '<div style="margin-top:8px"><span class="label">Violations</span>';
    for (const v of cv) {
      const color = v.severity === "error" ? "#c66" : "#cc6";
      html += '<div style="font-size:11px;color:' + color + '">&#x26a0; ' + v.message + '</div>';
    }
    html += '</div>';
  }
  html += '<div style="margin-top:8px;font-size:10px;color:#555">Drag to move &#xb7; handles to resize (8px grid) &#xb7; W to toggle grid overlay.</div>';
  document.getElementById("inspector").innerHTML = html;
}

// ---- Override persistence ----

async function saveOverrides() {
  try {
    const resp = await fetch("/api/overrides/" + SLUG, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model.toOverridePayload()),
    });
    if (!resp.ok) {
      console.error("Save failed:", resp.status, resp.statusText);
      return;
    }
  } catch (e) {
    console.error("Save failed:", e);
    return;
  }
  setDirty(false);
  // Update saved state for dirty flag comparison
  lastSavedState = _serializeDirtyState();
  updateOverrideSummary();
  refreshTreeColors();
}

function clearOverride(cid) {
  // Record snapshot before clearing override
  recordSnapshot();
  const hadWaypoints = overrides[cid] && overrides[cid].waypoints;
  model.clearOverride(cid);
  setDirty(true);
  if (hadWaypoints) {
    // Reload tree to restore original arrow waypoints from the layout engine
    loadTree().then(() => {
      rebuildArrowSVG(cid);
      applyAllOverrides();
      if (selectedIds.has(cid)) updateInspector(cid);
    });
  } else {
    applyAllOverrides();
    if (selectedIds.has(cid)) updateInspector(cid);
  }
}

function updateOverrideSummary() {
  const n = Object.keys(overrides).length;
  const el = document.getElementById("override-summary");
  if (n === 0) { el.innerHTML = '<span style="color:#555">No overrides.</span>'; }
  else {
    let txt = n + " override" + (n > 1 ? "s" : "");
    if (isStale) txt += ' <span style="color:#cc6">(stale &#x2013; definition changed)</span>';
    el.innerHTML = txt;
  }
}

function refreshTreeColors() {
  document.querySelectorAll(".tree-item").forEach(el => {
    el.style.color = overrides[el.textContent] ? "#E95420" : "";
  });
}

document.getElementById("btn-export").addEventListener("click", () => {
  const entries = Object.entries(overrides).filter(([,d]) =>
    (d.dx||0) !== 0 || (d.dy||0) !== 0 || (d.dw||0) !== 0 || (d.dh||0) !== 0 || d.waypoints);
  if (entries.length === 0) { alert("No overrides to export."); return; }
  const lines = ["# Overrides for " + SLUG, ""];
  for (const [cid, d] of entries) {
    let parts = [];
    if (d.dx || d.dy) parts.push("move x+" + (d.dx||0) + " y+" + (d.dy||0));
    if (d.dw || d.dh) parts.push("resize w+" + (d.dw||0) + " h+" + (d.dh||0));
    if (d.waypoints) parts.push("waypoints: " + d.waypoints.length);
    lines.push("# " + cid + ": " + parts.join(", "));
  }
  navigator.clipboard.writeText(lines.join("\\n")).then(() => alert("Copied to clipboard."));
});

function setDirty(dirty) {
  isDirty = dirty;
  const saveBtn = document.getElementById("btn-save");
  saveBtn.disabled = !dirty;
  if (dirty) {
    saveBtn.classList.add("dirty");
    runConstraints();
  } else {
    saveBtn.classList.remove("dirty");
  }
}

document.getElementById("btn-save").addEventListener("click", () => {
  if (!isDirty) return;
  saveOverrides();
});

document.getElementById("btn-clear-all").addEventListener("click", () => {
  if (Object.keys(overrides).length === 0) return;
  if (!confirm("Clear all overrides for " + SLUG + "?")) return;
  // Record snapshot before clearing all overrides
  recordSnapshot();
  overrides = {};
  setDirty(true);
  applyAllOverrides();
  if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
});

// Keyboard shortcuts: Ctrl+S to save, Ctrl+Z to undo, Ctrl+Shift+Z/Ctrl+Y to redo, arrows to nudge
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    if (isDirty) {
      saveOverrides();
    }
  } else if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    performUndo();
  } else if ((e.ctrlKey && e.shiftKey && e.key === "Z") || (e.ctrlKey && e.key === "y")) {
    e.preventDefault();
    performRedo();
  } else if (e.key === "Escape") {
    if (mgr.isMode(InteractionMode.TEXT_EDITING)) {
      cancelTextEdit();
    } else if (mgr.isMode(InteractionMode.DRAGGING)) {
      clearGuideLines();
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup", onDragUp);
      mgr.endInteraction();
    } else if (mgr.isMode(InteractionMode.RESIZING)) {
      clearGuideLines();
      document.removeEventListener("mousemove", onResizeMove);
      document.removeEventListener("mouseup", onResizeUp);
      const svg = document.querySelector("#stage svg");
      if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.style.display = "");
      mgr.endInteraction();
    } else {
      deselectAll();
    }
  } else if ((e.key === "w" || e.key === "W") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    cycleGuideMode();
  } else if (selectedIds.size > 0 && !e.ctrlKey && !e.metaKey && !e.altKey &&
             ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    const step = e.shiftKey ? 24 : 8;
    recordSnapshot();
    selectedIds.forEach(id => {
      const own = getOwnDelta(id);
      let dx = own.dx, dy = own.dy;
      if (e.key === "ArrowUp") dy -= step;
      else if (e.key === "ArrowDown") dy += step;
      else if (e.key === "ArrowLeft") dx -= step;
      else if (e.key === "ArrowRight") dx += step;
      setOverride(id, { dx, dy });
    });
    applyAllOverrides();
    const primary = [...selectedIds].pop();
    if (primary) showResizeHandles(primary);
    if (selectedIds.size === 1) updateInspector([...selectedIds][0]);
  }
});

// Undo/Redo button event listeners
document.getElementById("btn-undo").addEventListener("click", performUndo);
document.getElementById("btn-redo").addEventListener("click", performRedo);

// Warn before leaving with unsaved changes
window.addEventListener("beforeunload", (e) => {
  if (isDirty) {
    e.preventDefault();
    return "You have unsaved changes. Are you sure you want to leave?";
  }
});

// ---- Constraint validation ----

function runConstraints() {
  const svg = document.querySelector("#stage svg");
  lastViolations = constraints.validate(model, svg);
  updateConstraintUI();
}

function updateConstraintUI() {
  const summary = constraints.summarise(lastViolations);
  const el = document.getElementById("constraint-status");
  if (!el) return;
  if (summary.total === 0) {
    el.textContent = "No violations";
    el.className = "build-status build-ok";
  } else if (summary.errors > 0) {
    el.textContent = `${summary.errors} error(s), ${summary.warnings} warning(s)`;
    el.className = "build-status build-err";
  } else {
    el.textContent = `${summary.warnings} warning(s)`;
    el.className = "build-status";
    el.style.background = "#3a3a1a";
    el.style.color = "#cc6";
  }
}

function getViolationsForComponent(cid) {
  return constraints.forComponent(lastViolations, cid);
}

// ---- SSE ----

function connectSSE() {
  const es = new EventSource("/events");
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.generation > generation) {
      generation = data.generation;
      loadSVG();
      const st = document.getElementById("build-status");
      if (data.error) { st.className = "build-status build-err"; st.textContent = "Build error"; }
      else { st.className = "build-status build-ok"; st.textContent = "Rebuilt #" + generation; }
    }
  };
  es.onerror = () => setTimeout(connectSSE, 2000);
}

loadSVG();
connectSSE();
