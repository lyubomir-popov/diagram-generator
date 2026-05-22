"use strict";
const SLUG = window.__DG_CONFIG.slug;
const ENGINE = window.__DG_CONFIG.engine || "v2";
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
// HANDLE_SIZE now shared via SHARED_HANDLE_SIZE in editor-base.js
let multiActionGap = window.__DG_CONFIG.col_gap || 24;

function getThemeToken(name, fallback) {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const UI_AUTHORING_ACCENT = getThemeToken("--bf-authoring-accent", "#F6B73C");
const UI_AUTHORING_ACCENT_LINE = getThemeToken("--bf-authoring-accent-line", "rgba(246, 183, 60, 0.9)");

// ---- BoxStyle presets (mirrors diagram_model.py BoxStyle enum) ----
const BOX_STYLES = window.__DG_BOX_STYLES || {
  default: { fill: "#FFFFFF", text: "#000000", icon: "#000000", border: "solid", label: "Default" },
  parent:  { fill: "#F3F3F3", text: "#000000", icon: "#000000", border: "none",  label: "Parent" },
  highlight: { fill: "#000000", text: "#FFFFFF", icon: "#FFFFFF", border: "solid", label: "Highlight" },
};
const renderBoxStyleOptions = window.__DG_boxStyleOptionsHtml || function renderBoxStyleOptions(selectedValue, options = {}) {
  const current = selectedValue == null ? "" : String(selectedValue);
  const resetLabel = options.originalLabel || "— as defined —";
  let html = `<option value=""${current === "" ? " selected" : ""}>${resetLabel}</option>`;
  for (const [key, preset] of Object.entries(BOX_STYLES)) {
    html += `<option value="${key}"${current === key ? " selected" : ""}>${preset.label}</option>`;
  }
  return html;
};

// ---- Brockman grid constants ----
// BASELINE_STEP is defined in editor-base.js (shared constant)

// ---- Guide mode (W key) ----
const GUIDE_MODES = ["off", "all"];
let guideMode = "off";
let gridInfo = null;
let baseGridInfo = null;

// ---- Alignment snap guides ----
// Snap primitives (snapEdgeToTarget, collectGridSnapTargets, collectPeerSnapTargets,
// snapRectToTargets, renderGuideLines, clearGuideLines) are shared via editor-base.js.
// This file keeps only grid-model-aware wrappers that depend on `model` and `gridInfo`.
const GUIDE_COLOR = UI_AUTHORING_ACCENT_LINE;
const GUIDE_OPACITY = "0.5";

/**
 * Collect snap targets from peer components AND the Brockman grid.
 * Uses the grid model (not available in force mode) for peer lookups.
 */
function collectSnapTargets(dragCid) {
  const node = model.get(dragCid);
  if (!node) return { xs: [], ys: [] };
  // Collect from siblings (same parent) or all top-level nodes
  const peers = node.parent
    ? node.parent.children.filter(n => n.id !== dragCid && n.type !== "arrow" && n.type !== "separator")
    : model._roots.filter(n => n.id !== dragCid && n.type !== "arrow" && n.type !== "separator");

  // Build peer rects for the shared helper
  const peerRects = peers.map(peer => {
    const eff = model.getEffectiveDelta(peer.id);
    const own = model.getOwnDelta(peer.id);
    return {
      x: peer.data.x + eff.dx,
      y: peer.data.y + eff.dy,
      width: peer.data.width + own.dw,
      height: peer.data.height + own.dh,
    };
  });

  const peerSnaps = collectPeerSnapTargets(peerRects);
  const gridSnaps = collectGridSnapTargets(gridInfo);

  return {
    xs: [...peerSnaps.xs, ...gridSnaps.xs],
    ys: [...peerSnaps.ys, ...gridSnaps.ys],
  };
}

/**
 * Find which snap targets the dragged component is close to.
 * Returns { snapDx, snapDy, lines[] }.
 */
function findSnaps(cid, proposedDx, proposedDy, targets) {
  const node = model.get(cid);
  if (!node) return { snapDx: proposedDx, snapDy: proposedDy, lines: [] };
  const own = model.getOwnDelta(cid);
  const w = node.data.width + own.dw;
  const h = node.data.height + own.dh;
  const left = node.data.x + proposedDx;
  const top = node.data.y + proposedDy;

  const snap = snapRectToTargets(left, top, left + w, top + h, targets);

  // Apply snap adjustment then round to 8px grid
  let snapDx = Math.round((proposedDx + snap.adjX) / 8) * 8;
  let snapDy = Math.round((proposedDy + snap.adjY) / 8) * 8;

  // Regenerate guide lines at the FINAL (8px-rounded) position so guides
  // match where the component actually lands, not the pre-rounded snap.
  const finalLeft = node.data.x + snapDx;
  const finalTop = node.data.y + snapDy;
  const finalSnap = snapRectToTargets(finalLeft, finalTop, finalLeft + w, finalTop + h, targets);

  return { snapDx, snapDy, lines: finalSnap.lines };
}

/**
 * Grid-model-aware wrapper for resize snapping.
 * Delegates to collectGridSnapTargets() from editor-base.js.
 */
function _gridSnapTargets() {
  return collectGridSnapTargets(gridInfo);
}

/**
 * Grid-model-aware wrapper for edge snapping.
 * Delegates to snapEdgeToTarget() from editor-base.js.
 */
function _snapEdgeToGrid(edge, targets) {
  return snapEdgeToTarget(edge, targets);
}

// ---- Undo/Redo stack ----
let undoStack = [];
let redoStack = [];
let lastSavedState = null;
let pendingGridAction = null;
const MAX_UNDO_STACK_SIZE = 50;

function _cloneState(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function _captureEditorState() {
  return {
    o: _cloneState(overrides),
    g: _cloneState(model.gridOverrides || {}),
  };
}

function _normaliseGridOverrides(gridOverrides) {
  const next = {};
  if (gridOverrides && Number.isFinite(gridOverrides.cols)) next.cols = gridOverrides.cols;
  if (gridOverrides && Number.isFinite(gridOverrides.col_gap)) next.col_gap = gridOverrides.col_gap;
  if (gridOverrides && Number.isFinite(gridOverrides.row_gap)) next.row_gap = gridOverrides.row_gap;
  if (gridOverrides && Number.isFinite(gridOverrides.outer_margin)) next.outer_margin = gridOverrides.outer_margin;
  return next;
}

function _gridRequestValues(gridOverrides) {
  const fallback = baseGridInfo || gridInfo || {};
  return {
    cols: gridOverrides.cols ?? ((fallback.col_xs || []).length || 1),
    colGap: gridOverrides.col_gap ?? fallback.col_gap ?? window.__DG_CONFIG.col_gap ?? 24,
    rowGap: gridOverrides.row_gap ?? fallback.row_gap ?? window.__DG_CONFIG.row_gap ?? 24,
    outerMargin: gridOverrides.outer_margin ?? fallback.outer_margin ?? 24,
  };
}

function _getV3RootGap(gridRequest, rootNode) {
  const layout = String((rootNode && rootNode.layout) || "").toLowerCase();
  if (layout === "vertical") return gridRequest.rowGap;
  if (layout === "horizontal") return gridRequest.colGap;
  return Math.max(gridRequest.colGap, gridRequest.rowGap);
}

function _createUndoCommand(label, beforeState, afterState) {
  return { label, before: beforeState, after: afterState };
}

function _createOverridePatchCommand(label, beforeEntries, afterEntries) {
  return { label, kind: "override-patch", beforeEntries, afterEntries };
}

function _captureOverrideEntries(ids) {
  const snapshot = {};
  const orderedIds = [...new Set(ids || [])].sort();
  for (const cid of orderedIds) {
    const entry = overrides[cid];
    snapshot[cid] = entry ? _cloneState(entry) : null;
  }
  return snapshot;
}

function _restoreOverrideEntries(entries) {
  for (const [cid, entry] of Object.entries(entries || {})) {
    if (entry && Object.keys(entry).length > 0) {
      overrides[cid] = _cloneState(entry);
      model.cleanOverride(cid);
      if (overrides[cid] && Object.keys(overrides[cid]).length === 0) {
        delete overrides[cid];
      }
    } else {
      delete overrides[cid];
    }
  }
}

function _pushUndoCommand(command) {
  undoStack.push(command);
  if (undoStack.length > MAX_UNDO_STACK_SIZE) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
  return true;
}

function beginUndoableAction(label) {
  return { label, before: _serializeDirtyState() };
}

function commitUndoableAction(action) {
  if (!action) return false;
  const after = _serializeDirtyState();
  if (action.before === after) return false;
  return _pushUndoCommand(_createUndoCommand(action.label, action.before, after));
}

function commitOverridePatchAction(label, beforeEntries, afterEntries) {
  if (JSON.stringify(beforeEntries) === JSON.stringify(afterEntries)) return false;
  return _pushUndoCommand(_createOverridePatchCommand(label, beforeEntries, afterEntries));
}

function runUndoableAction(label, mutate) {
  const action = beginUndoableAction(label);
  const result = mutate();
  commitUndoableAction(action);
  return result;
}

/** Serialise the full dirty-trackable state (overrides + grid overrides). */
function _serializeDirtyState() {
  return JSON.stringify(_captureEditorState());
}

async function _restoreEditorState(serializedState) {
  if (relayoutTimer) {
    clearTimeout(relayoutTimer);
    relayoutTimer = null;
  }
  pendingGridAction = null;
  const parsed = JSON.parse(serializedState || "{}");
  const nextOverrides = _cloneState(parsed.o);
  const nextGridOverrides = _normaliseGridOverrides(parsed.g);
  const currentGridOverrides = _normaliseGridOverrides(model.gridOverrides || {});
  const gridChanged = JSON.stringify(currentGridOverrides) !== JSON.stringify(nextGridOverrides);

  model.gridOverrides = _cloneState(nextGridOverrides);
  if (gridChanged) {
    if (ENGINE === "v3") {
      const request = _gridRequestValues(nextGridOverrides);
      const rootId = (model.roots[0] || {}).id || "root";
      const rootNode = model.roots[0] || null;
      if (!overrides[rootId]) overrides[rootId] = {};
      overrides[rootId].gap = _getV3RootGap(request, rootNode);
      overrides[rootId].padding = request.outerMargin;
      await requestV3Relayout(rootId);
    } else {
      const request = _gridRequestValues(nextGridOverrides);
      await requestRelayout(request.cols, request.colGap, request.rowGap, request.outerMargin);
    }
  }

  overrides = nextOverrides;
  applyWaypointOverrides();
  applyAllOverrides();
  reapplySelection();
  renderSelectionInspector();
  updateOverrideSummary();
  refreshTreeColors();
  runConstraints();
  if (gridInfo) populateGridControls();

  const currentStateStr = _serializeDirtyState();
  setDirty(currentStateStr !== lastSavedState);
}

async function _restoreOverridePatch(entries) {
  if (relayoutTimer) {
    clearTimeout(relayoutTimer);
    relayoutTimer = null;
  }
  clearTimeout(_v3RelayoutTimer);
  pendingGridAction = null;
  _restoreOverrideEntries(entries);
  applyWaypointOverrides();
  applyAllOverrides();
  reapplySelection();
  renderSelectionInspector();
  updateOverrideSummary();
  refreshTreeColors();
  runConstraints();

  const currentStateStr = _serializeDirtyState();
  setDirty(currentStateStr !== lastSavedState);
}

async function _applyUndoCommand(command, direction) {
  if (command && command.kind === "override-patch") {
    await _restoreOverridePatch(direction === "undo" ? command.beforeEntries : command.afterEntries);
    return;
  }
  await _restoreEditorState(direction === "undo" ? command.before : command.after);
}

async function loadSVG() {
  const suffix = GRID ? `-${ENGINE}-grid.svg` : `-${ENGINE}.svg`;
  const resp = await fetch("/svg/" + SLUG + "-onbrand" + suffix + "?t=" + Date.now());
  if (!resp.ok) return;
  document.getElementById("stage").innerHTML = await resp.text();
  await loadTree();
  await loadGridInfo();
  // Wire diagram-level grid into the model so root nodes get sibling relayout
  if (gridInfo) model.setDiagramGrid(gridInfo);
  populateGridControls();
  await loadOverrides();
  // Apply saved grid overrides (gutter/margin changes) before rendering
  const hasGridOverrides = model.gridOverrides && Object.keys(model.gridOverrides).length > 0;
  // Check if any frame overrides need a relayout (text, sizing, etc.)
  const hasFrameOverrides = ENGINE === "v3" && Object.values(overrides).some(ovr => ovr.text || ovr.direction || ovr.sizing_w || ovr.sizing_h || ovr.fill || ovr.border);
  if (hasGridOverrides) {
    const go = model.gridOverrides;
    if (ENGINE === "v3") {
      const rootNode = model.roots[0] || null;
      const rootId = (model.roots[0] || {}).id || "root";
      if (!overrides[rootId]) overrides[rootId] = {};
      overrides[rootId].gap = _getV3RootGap(_gridRequestValues(go), rootNode);
      overrides[rootId].padding = go.outer_margin ?? 0;
      await requestV3Relayout(rootId);
    } else {
      await requestRelayout(go.cols || 1, go.col_gap, go.row_gap, go.outer_margin);
    }
  } else if (hasFrameOverrides) {
    // Text or frame overrides without grid overrides — still need relayout
    const rootId = (model.roots[0] || {}).id || "root";
    await requestV3Relayout(rootId);
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
    if (resp.ok) {
      gridInfo = await resp.json();
      baseGridInfo = _cloneState(gridInfo);
      model.setDiagramGrid(gridInfo);
    }
  } catch (e) { /* ignore */ }
  // Fallback only if the server has not produced authoritative v3 grid info.
  if (!gridInfo && ENGINE === "v3") {
    const rootNode = model.roots[0] || null;
    const gap = rootNode ? (rootNode.data.layout_gap ?? 24) : 24;
    const pad = rootNode ? (rootNode.data.padding_top ?? 24) : 24;
    const svg = document.querySelector("#stage svg");
    const svgW = svg ? (svg.viewBox.baseVal.width || parseFloat(svg.getAttribute("width") || 840)) : 840;
    const svgH = svg ? (svg.viewBox.baseVal.height || parseFloat(svg.getAttribute("height") || 840)) : 840;
    gridInfo = _computeBrockmanGrid(svgW, svgH, 2, gap, gap, pad);
    baseGridInfo = _cloneState(gridInfo);
  }
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
    badge.textContent = "Grid: on (W)";
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

  if (guideMode === "all") {
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

  // -- Baseline grid (BASELINE_STEP lines) --
  if (guideMode === "all") {
    // Horizontal baseline grid
    const baselineColor = "rgba(255,100,100,0.08)";
    for (let y = margin; y <= svgH - margin; y += BASELINE_STEP) {
      const bl = document.createElementNS(ns, "line");
      bl.setAttribute("x1", margin); bl.setAttribute("y1", y);
      bl.setAttribute("x2", svgW - margin); bl.setAttribute("y2", y);
      bl.setAttribute("stroke", baselineColor); bl.setAttribute("stroke-width", "0.5");
      g.appendChild(bl);
    }
    // Vertical baseline grid
    for (let x = margin; x <= svgW - margin; x += BASELINE_STEP) {
      const vl = document.createElementNS(ns, "line");
      vl.setAttribute("x1", x); vl.setAttribute("y1", margin);
      vl.setAttribute("x2", x); vl.setAttribute("y2", svgH - margin);
      vl.setAttribute("stroke", baselineColor); vl.setAttribute("stroke-width", "0.25");
      g.appendChild(vl);
    }
    // -- Bottom margin absorption zone --
    // When row heights are baseline-snapped, the bottom margin absorbs
    // the leftover slack.  Highlight it so the user can see the resolved
    // bottom margin differs from the top/side margins.
    const resolvedBottom = gridInfo.resolved_bottom_margin ?? gridInfo._resolved_bottom_margin;
    if (resolvedBottom != null && resolvedBottom > margin + 1) {
      addRect(g, ns, 0, svgH - resolvedBottom, svgW, resolvedBottom, "rgba(235,180,65,0.10)");
    }

    // Same for column widths: right margin absorbs leftover after baseline-snapping.
    const resolvedRight = gridInfo.resolved_right_margin ?? gridInfo._resolved_right_margin;
    if (resolvedRight != null && resolvedRight > margin + 1) {
      addRect(g, ns, svgW - resolvedRight, 0, resolvedRight, svgH, "rgba(235,180,65,0.10)");
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
  // Rows are always derived (read-only)
  document.getElementById("grid-rows").value = (gridInfo.row_ys || []).length;
  // Only update editable fields if there are no pending user overrides
  if (!model.gridOverrides || Object.keys(model.gridOverrides).length === 0) {
    document.getElementById("grid-cols").value = (gridInfo.col_xs || []).length || 1;
    document.getElementById("grid-col-gap").value = gridInfo.col_gap || 0;
    document.getElementById("grid-row-gap").value = gridInfo.row_gap || 0;
    document.getElementById("grid-margin").value = gridInfo.outer_margin || 0;
  }
}

let relayoutTimer = null;

function onGridControlChange() {
  if (!gridInfo) return;
  const cols = Math.max(1, parseInt(document.getElementById("grid-cols").value) || 1);
  const colGap = Math.max(0, parseInt(document.getElementById("grid-col-gap").value) || 0);
  const rowGap = Math.max(0, parseInt(document.getElementById("grid-row-gap").value) || 0);
  const margin = Math.max(0, parseInt(document.getElementById("grid-margin").value) || 0);

  if (!pendingGridAction) {
    pendingGridAction = beginUndoableAction("Adjust grid");
  }

  // Track grid overrides for persistence
  model.gridOverrides = { cols: cols, col_gap: colGap, row_gap: rowGap, outer_margin: margin };
  setDirty(true);

  // Capture root ID before the debounce window so a concurrent tree
  // reload can't change it mid-flight.
  const rootNode = ENGINE === "v3" ? (model.roots[0] || null) : null;
  const rootId = rootNode ? (rootNode.id || "root") : null;

  // Debounce the relayout call so rapid typing doesn't flood the server
  if (relayoutTimer) clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(async () => {
    try {
      if (ENGINE === "v3") {
        // In v3, the root frame has a single primary-axis gap.
        // Preserve both gutter inputs for the Brockman overlay, but drive
        // the actual relayout from the root layout axis.
        if (!overrides[rootId]) overrides[rootId] = {};
        overrides[rootId].gap = _getV3RootGap({ cols, colGap, rowGap, outerMargin: margin }, rootNode);
        overrides[rootId].padding = margin;
        await requestV3Relayout(rootId);
      } else {
        await requestRelayout(cols, colGap, rowGap, margin);
      }
    } finally {
      commitUndoableAction(pendingGridAction);
      pendingGridAction = null;
    }
  }, 200);

  // Immediately update the grid overlay from the input values (local recompute)
  updateGridOverlayFromInputs();
}

// ---- Column/row span ↔ pixel conversion ----

/** Convert a column span count to pixel width. */
function colSpanToPx(span) {
  if (!gridInfo || !gridInfo.col_widths || !gridInfo.col_widths.length) return null;
  const colW = gridInfo.col_widths[0];
  const gap = gridInfo.col_gap || 0;
  return colW * span + gap * (span - 1);
}

/** Convert a row span count to pixel height. */
function rowSpanToPx(span) {
  if (!gridInfo || !gridInfo.row_heights || !gridInfo.row_heights.length) return null;
  const rowH = gridInfo.row_heights[0];
  const gap = gridInfo.row_gap || 0;
  return rowH * span + gap * (span - 1);
}

/** Convert a pixel width to the nearest column span (may be fractional). */
function pxToColSpan(px) {
  if (!gridInfo || !gridInfo.col_widths || !gridInfo.col_widths.length) return null;
  const colW = gridInfo.col_widths[0];
  const gap = gridInfo.col_gap || 0;
  if (colW + gap <= 0) return null;
  return (px + gap) / (colW + gap);
}

/** Convert a pixel height to the nearest row span (may be fractional). */
function pxToRowSpan(px) {
  if (!gridInfo || !gridInfo.row_heights || !gridInfo.row_heights.length) return null;
  const rowH = gridInfo.row_heights[0];
  const gap = gridInfo.row_gap || 0;
  if (rowH + gap <= 0) return null;
  return (px + gap) / (rowH + gap);
}

// Track inspector width/height unit preference: 'px', 'cols', 'rows'
let _inspectorWidthUnit = 'px';
let _inspectorHeightUnit = 'px';

// ---- Brockman grid resolver ----
// Mirrors the a4-generator rigorous solver: row heights are whole multiples
// of BASELINE_STEP, the bottom margin absorbs leftover slack, and column
// widths are derived from the content area after subtracting gutters.
function _computeBrockmanGrid(svgW, svgH, cols, colGap, rowGap, margin) {
  const contentW = svgW - 2 * margin;
  const contentH = svgH - 2 * margin;

  // ---- Columns ----
  const colWRaw = cols > 1
    ? (contentW - (cols - 1) * colGap) / cols
    : contentW;
  const colW = colWRaw >= BASELINE_STEP
    ? Math.floor(colWRaw / BASELINE_STEP) * BASELINE_STEP
    : Math.max(BASELINE_STEP, Math.round(colWRaw));
  const colXs = [];
  const colWidths = [];
  for (let c = 0; c < cols; c++) {
    colXs.push(margin + c * (colW + colGap));
    colWidths.push(colW);
  }

  // ---- Rows (baseline-snapped, bottom margin absorbs slack) ----
  // Clamp row gutter to a baseline multiple
  const rowGapSnapped = Math.floor(rowGap / BASELINE_STEP) * BASELINE_STEP;
  // Available height for a single row stack pass: determine how many rows
  // fit with baseline-quantised heights.
  const availH = contentH - rowGapSnapped; // space if 1 row (no inter-row gutters)
  // Row height = largest baseline multiple that fits
  // We solve for N rows: rowH * N + rowGapSnapped * (N-1) <= contentH
  // → rowH <= (contentH - rowGapSnapped * (N-1)) / N, snapped down to BASELINE_STEP
  // Start with N that yields a row height between 1× and ~200× baseline step
  let rowCount = 1;
  let rowH = Math.floor(contentH / BASELINE_STEP) * BASELINE_STEP;
  if (rowH > 0) {
    // Target a reasonable row height (aim for ~80-160px rows)
    const targetRowH = Math.max(BASELINE_STEP * 10, 80); // ~80px minimum
    rowCount = Math.max(1, Math.floor((contentH + rowGapSnapped) / (targetRowH + rowGapSnapped)));
    const maxRowH = Math.floor((contentH - rowGapSnapped * Math.max(0, rowCount - 1)) / (rowCount * BASELINE_STEP)) * BASELINE_STEP;
    rowH = Math.max(BASELINE_STEP, maxRowH);
  }

  const rowYs = [];
  const rowHeights = [];
  for (let r = 0; r < rowCount; r++) {
    rowYs.push(margin + r * (rowH + rowGapSnapped));
    rowHeights.push(rowH);
  }

  return {
    col_xs: colXs, col_widths: colWidths,
    row_ys: rowYs, row_heights: rowHeights,
    col_gap: colGap, row_gap: rowGapSnapped,
    outer_margin: margin,
    // Brockman-specific: resolved margins (absorb slack)
    _resolved_bottom_margin: svgH - margin - (rowCount > 0 ? rowYs[rowCount - 1] + rowH : 0),
    _resolved_right_margin: svgW - margin - (cols > 0 ? colXs[cols - 1] + colW : 0),
    _baseline_step: BASELINE_STEP,
  };
}

function updateGridOverlayFromInputs() {
  const cols = Math.max(1, parseInt(document.getElementById("grid-cols").value) || 1);
  const colGap = Math.max(0, parseInt(document.getElementById("grid-col-gap").value) || 0);
  const rowGap = Math.max(0, parseInt(document.getElementById("grid-row-gap").value) || 0);
  const margin = Math.max(0, parseInt(document.getElementById("grid-margin").value) || 0);

  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  const svgW = vb.width || parseFloat(svg.getAttribute("width") || svg.clientWidth);
  const svgH = vb.height || parseFloat(svg.getAttribute("height") || svg.clientHeight);

  gridInfo = _computeBrockmanGrid(svgW, svgH, cols, colGap, rowGap, margin);
  // Update derived rows display
  document.getElementById("grid-rows").value = (gridInfo.row_ys || []).length;
  renderGridOverlay();
}

async function requestRelayout(cols, colGap, rowGap, margin) {
  try {
    const resp = await fetch("/api/relayout/" + SLUG, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cols: cols, col_gap: colGap, row_gap: rowGap, outer_margin: margin }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    // Replace SVG in stage
    document.getElementById("stage").innerHTML = data.svg;
    // Update component tree — positions changed, so clear stale position overrides
    // but preserve grid_overrides (they are the source of the relayout)
    // and non-position overrides (waypoints, text, style).
    const savedGridOverrides = Object.assign({}, model.gridOverrides);
    const cleaned = {};
    for (const [cid, ov] of Object.entries(model.overrides)) {
      const kept = {};
      // Preserve non-position fields (waypoints, text, style, etc.)
      for (const [k, v] of Object.entries(ov)) {
        if (k !== "dx" && k !== "dy" && k !== "dw" && k !== "dh") {
          kept[k] = v;
        }
      }
      if (Object.keys(kept).length > 0) cleaned[cid] = kept;
    }
    model.overrides = cleaned;
    model.gridOverrides = savedGridOverrides;
    if (data.tree) componentTree = data.tree;
    // Update grid info from the actual layout result
    if (data.grid_info) {
      gridInfo = data.grid_info;
      model.setDiagramGrid(gridInfo);
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
  pendingGridAction = null;
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

function canUndo() {
  return undoStack.length > 0;
}

function canRedo() {
  return redoStack.length > 0;
}

async function performUndo() {
  if (!canUndo()) return;
  
  const command = undoStack.pop();
  redoStack.push(command);
  await _applyUndoCommand(command, "undo");
  
  updateUndoRedoButtons();
}

async function performRedo() {
  if (!canRedo()) return;
  
  const command = redoStack.pop();
  undoStack.push(command);
  await _applyUndoCommand(command, "redo");
  
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
  const svg = document.querySelector("#stage svg");
  if (!svg) return null;

  function walk(nodes, depth) {
    let bestId = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      // Use actual SVG DOM geometry instead of model data, which can diverge
      // from the rendered positions. Fall back to model data for arrows or
      // components without a rect.
      let nx, ny, nw, nh;
      const g = svg.querySelector('[data-component-id="' + node.id + '"]');
      const rect = g ? g.querySelector("rect:first-of-type") : null;
      if (rect) {
        nx = parseFloat(rect.getAttribute("x"));
        ny = parseFloat(rect.getAttribute("y"));
        nw = parseFloat(rect.getAttribute("width"));
        nh = parseFloat(rect.getAttribute("height"));
      } else {
        const eff = getEffectiveDelta(node.id);
        const own = getOwnDelta(node.id);
        nx = node.x + eff.dx;
        ny = node.y + eff.dy;
        nw = node.width + own.dw;
        nh = node.height + own.dh;
      }
      // Account for CSS transforms (override dx/dy + reflow cascade shifts)
      if (g) {
        const t = g.style.transform || "";
        const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        if (m) { nx += parseFloat(m[1]); ny += parseFloat(m[2]); }
      }
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        if (depth === targetDepth) {
          // When overrides cause overlapping bounds, pick the child
          // whose center is closest to the click point.
          const cx = nx + nw / 2;
          const cy = ny + nh / 2;
          const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (dist < bestDist) {
            bestDist = dist;
            bestId = node.id;
          }
        } else if (node.children && node.children.length > 0 && depth < targetDepth) {
          const child = walk(node.children, depth + 1);
          if (child) return child;
        }
      }
    }
    return bestId;
  }
  const roots = model._roots.map(n => n.data);
  return walk(roots, 0);
}

/**
 * Ctrl+click: find the deepest (innermost) component containing the point.
 * Walks children-first so the deepest match wins.
 */
function findDeepestComponent(x, y) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return null;

  function walk(nodes) {
    for (const node of nodes) {
      let nx, ny, nw, nh;
      const g = svg.querySelector('[data-component-id="' + node.id + '"]');
      const rect = g ? g.querySelector("rect:first-of-type") : null;
      if (rect) {
        nx = parseFloat(rect.getAttribute("x"));
        ny = parseFloat(rect.getAttribute("y"));
        nw = parseFloat(rect.getAttribute("width"));
        nh = parseFloat(rect.getAttribute("height"));
      } else {
        nx = node.x; ny = node.y; nw = node.width; nh = node.height;
      }
      if (g) {
        const t = g.style.transform || "";
        const m = t.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)/);
        if (m) { nx += parseFloat(m[1]); ny += parseFloat(m[2]); }
      }
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        if (node.children && node.children.length > 0) {
          const deeper = walk(node.children);
          if (deeper) return deeper;
        }
        return node.id;
      }
    }
    return null;
  }
  const roots = model._roots.map(n => n.data);
  return walk(roots);
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

function snapToGrid(value) {
  return Math.round(value / 8) * 8;
}

function getInspectorElement() {
  return document.getElementById("inspector");
}

function renderEmptyInspector() {
  const inspector = getInspectorElement();
  if (!inspector) return;
  inspector.innerHTML =
    '<p class="dg-empty-message bf-form-help">Click a component to inspect it.</p>';
}

function getPrimarySelectedId(preferredCid) {
  if (preferredCid && selectedIds.has(preferredCid)) return preferredCid;
  return [...selectedIds].pop() || null;
}

function renderSelectionInspector(preferredCid) {
  const primary = getPrimarySelectedId(preferredCid);
  if (!primary) {
    renderEmptyInspector();
    return;
  }
  if (selectedIds.size === 1) {
    updateInspector(primary);
  } else {
    renderMultiSelectionInspector();
  }
}

function getSelectionActionItems() {
  const items = [];
  let hasUnsupported = false;

  selectedIds.forEach((id) => {
    const node = model.get(id);
    if (!node || node.type === "arrow" || node.type === "separator") {
      hasUnsupported = true;
      return;
    }
    const own = getOwnDelta(id);
    const eff = getEffectiveDelta(id);
    items.push({
      id,
      node,
      parentId: node.parent ? node.parent.id : "",
      own,
      eff,
      x: node.data.x + eff.dx,
      y: node.data.y + eff.dy,
      width: node.data.width + own.dw,
      height: node.data.height + own.dh,
    });
  });

  const parentIds = new Set(items.map(item => item.parentId));
  return {
    items,
    hasUnsupported,
    sameParent: parentIds.size <= 1,
    parentId: parentIds.size === 1 ? [...parentIds][0] : null,
  };
}

function inferSelectionGap(info) {
  if (!info.sameParent || info.items.length < 2) {
    return snapToGrid(window.__DG_CONFIG.col_gap || 24);
  }

  if (info.parentId) {
    const parent = model.get(info.parentId);
    if (parent) {
      if (parent.layout === "vertical") {
        return snapToGrid(parent.layoutRowGap || parent.layoutGap || 24);
      }
      if (parent.layout === "horizontal") {
        return snapToGrid(parent.layoutColGap || parent.layoutGap || 24);
      }
    }
  }

  const byX = [...info.items].sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const byY = [...info.items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const xGaps = [];
  const yGaps = [];
  for (let i = 1; i < byX.length; i++) {
    xGaps.push(byX[i].x - (byX[i - 1].x + byX[i - 1].width));
    yGaps.push(byY[i].y - (byY[i - 1].y + byY[i - 1].height));
  }
  const nonNegativeX = xGaps.filter(gap => gap >= 0);
  const nonNegativeY = yGaps.filter(gap => gap >= 0);
  const candidate = nonNegativeX.length >= nonNegativeY.length ? nonNegativeX[0] : nonNegativeY[0];
  return snapToGrid(candidate != null ? candidate : (window.__DG_CONFIG.col_gap || 24));
}

function setMultiActionGap(value) {
  const parsed = parseInt(value, 10);
  multiActionGap = snapToGrid(Math.max(0, Number.isFinite(parsed) ? parsed : 0));
  const input = document.getElementById("multi-action-gap");
  if (input) input.value = multiActionGap;
}

function clampSelectionTarget(item, targetX, targetY) {
  let nextX = snapToGrid(targetX);
  let nextY = snapToGrid(targetY);

  if (!item.parentId) {
    return { x: nextX, y: nextY };
  }

  const parent = model.get(item.parentId);
  if (!parent) {
    return { x: nextX, y: nextY };
  }

  const parentEff = getEffectiveDelta(parent.id);
  const parentOwn = getOwnDelta(parent.id);
  const minX = parent.data.x + parentEff.dx + INSET;
  const minY = parent.data.y + parentEff.dy + INSET;
  const maxX = minX + parent.data.width + parentOwn.dw - 2 * INSET - item.width;
  const maxY = minY + parent.data.height + parentOwn.dh - 2 * INSET - item.height;

  nextX = snapToGrid(Math.min(Math.max(nextX, minX), maxX));
  nextY = snapToGrid(Math.min(Math.max(nextY, minY), maxY));
  return { x: nextX, y: nextY };
}

function applySelectionTargets(targets) {
  if (Object.keys(targets).length === 0) return;
  const ids = Object.keys(targets);
  const beforeEntries = _captureOverrideEntries(ids);
  for (const [id, target] of Object.entries(targets)) {
    const node = model.get(id);
    if (!node) continue;
    const own = getOwnDelta(id);
    const eff = getEffectiveDelta(id);
    const ancestorDx = eff.dx - own.dx;
    const ancestorDy = eff.dy - own.dy;
    const dx = snapToGrid(target.x - node.data.x - ancestorDx);
    const dy = snapToGrid(target.y - node.data.y - ancestorDy);
    setOverride(id, { dx, dy });
  }
  applyAllOverrides();
  reapplySelection();
  renderSelectionInspector();
  updateOverrideSummary();
  refreshTreeColors();
  runConstraints();
  commitOverridePatchAction("Reposition selection", beforeEntries, _captureOverrideEntries(ids));
}

function distributeSelection(axis) {
  const info = getSelectionActionItems();
  if (info.items.length < 2) return;
  if (!info.sameParent) {
    alert("Distribute works on sibling components under one parent.");
    return;
  }
  if (info.hasUnsupported) {
    alert("Distribute currently supports boxes, panels, terminals, and other non-arrow components only.");
    return;
  }

  const gap = snapToGrid(Math.max(0, multiActionGap));
  multiActionGap = gap;
  const items = [...info.items].sort((a, b) =>
    axis === "x" ? ((a.x - b.x) || (a.y - b.y)) : ((a.y - b.y) || (a.x - b.x))
  );

  const targets = {};
  let cursor = axis === "x" ? items[0].x : items[0].y;
  for (const item of items) {
    const target = clampSelectionTarget(
      item,
      axis === "x" ? cursor : item.x,
      axis === "y" ? cursor : item.y,
    );
    targets[item.id] = target;
    cursor = axis === "x" ? (target.x + item.width + gap) : (target.y + item.height + gap);
  }
  applySelectionTargets(targets);
}

function alignSelection(mode) {
  const info = getSelectionActionItems();
  if (info.items.length < 2) return;
  if (info.hasUnsupported) {
    alert("Align currently supports boxes, panels, terminals, and other non-arrow components only.");
    return;
  }

  const left = Math.min(...info.items.map(item => item.x));
  const top = Math.min(...info.items.map(item => item.y));
  const right = Math.max(...info.items.map(item => item.x + item.width));
  const bottom = Math.max(...info.items.map(item => item.y + item.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const targets = {};

  info.items.forEach((item) => {
    let targetX = item.x;
    let targetY = item.y;
    if (mode === "left") targetX = left;
    if (mode === "center") targetX = centerX - (item.width / 2);
    if (mode === "right") targetX = right - item.width;
    if (mode === "top") targetY = top;
    if (mode === "middle") targetY = centerY - (item.height / 2);
    if (mode === "bottom") targetY = bottom - item.height;
    targets[item.id] = clampSelectionTarget(item, targetX, targetY);
  });

  applySelectionTargets(targets);
}

function renderMultiSelectionInspector() {
  const inspector = getInspectorElement();
  if (!inspector) {
    return;
  }
  const info = getSelectionActionItems();
  if (info.items.length < 2) {
    renderEmptyInspector();
    return;
  }

  multiActionGap = inferSelectionGap(info);

  let html = '<div class="field"><span class="label">Selection</span><br>' +
    '<span class="value">' + selectedIds.size + ' components</span></div>';
  html += '<div class="hint">Shift+click adds to the selection. Drag still moves the group together.</div>';

  if (!info.sameParent) {
    html += '<div class="field" style="margin-top:8px"><span class="label">Actions</span><br>' +
      '<div class="hint">Distribute is limited to sibling components under the same parent. Align still works across the current selection.</div>' +
      '<div class="multi-action-grid">' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'left\')">Align left</button>' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'center\')">Align center</button>' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'right\')">Align right</button>' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'top\')">Align top</button>' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'middle\')">Align middle</button>' +
      '<button class="bf-button is-base" type="button" onclick="alignSelection(\'bottom\')">Align bottom</button>' +
      '</div></div>';
    inspector.innerHTML = html;
    return;
  }

  html += '<div class="field" style="margin-top:8px"><span class="label">Distribute</span>' +
    '<div class="multi-action-row">' +
    '<span class="value">Gap</span>' +
    '<input class="bf-input" type="number" id="multi-action-gap" min="0" step="8" value="' + multiActionGap + '" oninput="setMultiActionGap(this.value)">' +
    '<span class="unit">px</span>' +
    '</div>' +
    '<div class="multi-action-grid">' +
    '<button class="bf-button" type="button" onclick="distributeSelection(\'x\')">Distribute H</button>' +
    '<button class="bf-button" type="button" onclick="distributeSelection(\'y\')">Distribute V</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'left\')">Align left</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'center\')">Align center</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'right\')">Align right</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'top\')">Align top</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'middle\')">Align middle</button>' +
    '<button class="bf-button is-base" type="button" onclick="alignSelection(\'bottom\')">Align bottom</button>' +
    '</div></div>';

  if (info.hasUnsupported) {
    html += '<div class="field"><div class="hint">Arrow and separator selections are ignored by these actions.</div></div>';
  }

  // ── Bulk sizing controls (v3 only, homogeneous selection) ──
  if (ENGINE === "v3" && info.items.length >= 2) {
    // ── Alignment widget (v3) ──
    const alignInfo = _getMultiAlignValues(info.items);
    if (alignInfo) {
      html += '<div class="field"><span class="label">Alignment</span>';
      html += '<div class="dg-align-field">';
      html += '<div class="dg-align-grid">';
      for (const pt of ALIGN_POINTS) {
        const active = !alignInfo.mixed && pt === alignInfo.align ? " active" : "";
        html += '<button class="' + active + '" title="' + ALIGN_LABELS[pt] +
          '" onclick="setMultiFrameAlign(\'' + pt + '\')">' +
          '</button>';
      }
      html += '</div>';
      html += '<span class="value">' + (alignInfo.mixed ? 'Mixed' : ALIGN_LABELS[alignInfo.align]) + '</span>';
      html += '</div></div>';
    }

    // ── Container properties (direction, gap, padding) ──
    const containerInfo = _getMultiContainerValues(info.items);
    if (containerInfo) {
      html += '<div class="dg-autolayout-section" style="margin-top:8px">';
      html += '<span class="label" style="margin-bottom:4px;display:block">Auto-layout (' + containerInfo.containerCount + ' containers)</span>';

      // Direction
      html += '<div class="field"><span class="label">Direction</span>';
      html += '<select class="bf-input" onchange="setMultiFrameProp(\'direction\',this.value)">';
      if (containerInfo.dirMixed) html += '<option value="" selected>Mixed</option>';
      html += '<option value="VERTICAL"' + (containerInfo.direction === 'VERTICAL' ? ' selected' : '') + '>Vertical</option>';
      html += '<option value="HORIZONTAL"' + (containerInfo.direction === 'HORIZONTAL' ? ' selected' : '') + '>Horizontal</option>';
      html += '</select></div>';

      // Gap
      html += '<div class="field"><span class="label">Gap</span>';
      html += '<input class="bf-input" type="number" min="0" step="8" value="' + (containerInfo.gapMixed ? '' : containerInfo.gap) + '"';
      html += ' placeholder="' + (containerInfo.gapMixed ? 'Mixed' : '') + '"';
      html += ' onchange="setMultiFrameProp(\'gap\',parseInt(this.value))"';
      html += ' style="width:60px"></div>';

      // Padding
      html += '<div class="field"><span class="label">Padding</span>';
      html += '<input class="bf-input" type="number" min="0" step="8" value="' + (containerInfo.padMixed ? '' : containerInfo.padding) + '"';
      html += ' placeholder="' + (containerInfo.padMixed ? 'Mixed' : '') + '"';
      html += ' onchange="setMultiFrameProp(\'padding\',parseInt(this.value))"';
      html += ' style="width:60px"></div>';

      html += '</div>';
    }

    // ── Sizing ──
    const sizingInfo = _getMultiSizingValues(info.items);
    if (sizingInfo) {
      html += '<div class="dg-autolayout-section" style="margin-top:8px">';
      html += '<span class="label" style="margin-bottom:4px;display:block">Sizing</span>';

      // Width sizing
      html += '<div class="field"><span class="label">Width</span>';
      html += '<select class="bf-input" onchange="setMultiFrameProp(\'sizing_w\',this.value)">';
      if (sizingInfo.wMixed) html += '<option value="" selected>Mixed</option>';
      html += '<option value="HUG"' + (sizingInfo.sizingW === 'HUG' ? ' selected' : '') + '>Hug</option>';
      html += '<option value="FILL"' + (sizingInfo.sizingW === 'FILL' ? ' selected' : '') + '>Fill</option>';
      html += '<option value="FIXED"' + (sizingInfo.sizingW === 'FIXED' ? ' selected' : '') + '>Fixed</option>';
      html += '</select>';
      if (sizingInfo.sizingW === 'FIXED' && !sizingInfo.wMixed) {
        const stepW = _inspectorWidthUnit === 'cols' ? 1 : BASELINE_STEP;
        html += '<input class="bf-input" type="number" min="0" step="' + stepW + '" value=""';
        html += ' placeholder="' + (_inspectorWidthUnit === 'cols' ? 'cols' : 'px') + '"';
        html += ' onchange="setMultiFrameSize(\'width\',parseFloat(this.value))"';
        html += ' style="width:60px;margin-left:4px">';
        html += '<select class="bf-input" style="width:50px;margin-left:2px" onchange="setWidthUnit(this.value)">';
        html += '<option value="px"' + (_inspectorWidthUnit === 'px' ? ' selected' : '') + '>px</option>';
        html += '<option value="cols"' + (_inspectorWidthUnit === 'cols' ? ' selected' : '') + '>cols</option>';
        html += '</select>';
      }
      html += '</div>';

      // Height sizing
      html += '<div class="field"><span class="label">Height</span>';
      html += '<select class="bf-input" onchange="setMultiFrameProp(\'sizing_h\',this.value)">';
      if (sizingInfo.hMixed) html += '<option value="" selected>Mixed</option>';
      html += '<option value="HUG"' + (sizingInfo.sizingH === 'HUG' ? ' selected' : '') + '>Hug</option>';
      html += '<option value="FILL"' + (sizingInfo.sizingH === 'FILL' ? ' selected' : '') + '>Fill</option>';
      html += '<option value="FIXED"' + (sizingInfo.sizingH === 'FIXED' ? ' selected' : '') + '>Fixed</option>';
      html += '</select>';
      if (sizingInfo.sizingH === 'FIXED' && !sizingInfo.hMixed) {
        const stepH = _inspectorHeightUnit === 'rows' ? 1 : BASELINE_STEP;
        html += '<input class="bf-input" type="number" min="0" step="' + stepH + '" value=""';
        html += ' placeholder="' + (_inspectorHeightUnit === 'rows' ? 'rows' : 'px') + '"';
        html += ' onchange="setMultiFrameSize(\'height\',parseFloat(this.value))"';
        html += ' style="width:60px;margin-left:4px">';
        html += '<select class="bf-input" style="width:50px;margin-left:2px" onchange="setHeightUnit(this.value)">';
        html += '<option value="px"' + (_inspectorHeightUnit === 'px' ? ' selected' : '') + '>px</option>';
        html += '<option value="rows"' + (_inspectorHeightUnit === 'rows' ? ' selected' : '') + '>rows</option>';
        html += '</select>';
      }
      html += '</div>';

      html += '</div>';
    }

    // ── Bulk style picker ──
    const styleInfo = _getMultiStyleValues(info.items);
    if (styleInfo) {
      html += '<div class="field" style="margin-top:6px"><span class="label">Style (' + styleInfo.count + ' boxes)</span><br>';
      html += '<select class="style-picker bf-input" onchange="applyMultiStyleOverride(this.value)">';
      if (styleInfo.mixed) html += '<option value="__mixed__" selected>Mixed</option>';
      html += renderBoxStyleOptions(styleInfo.mixed ? '__nomatch__' : styleInfo.style, { originalLabel: '— original —' });
      html += '</select></div>';
    }
  }

  html += '<p class="dg-selection-note">All actions snap to the 8px baseline and remain undoable.</p>';
  inspector.innerHTML = html;
}

/**
 * Read the common sizing_w / sizing_h across all selected items.
 * Returns null if none of the items are v3 frame nodes.
 */
function _getMultiSizingValues(items) {
  let firstW = null, firstH = null;
  let wMixed = false, hMixed = false;
  let hasAny = false;

  for (const item of items) {
    const node = item.node;
    if (!node) continue;
    const ovr = overrides[item.id] || {};
    const sw = ovr.sizing_w || node.sizing_w || null;
    const sh = ovr.sizing_h || node.sizing_h || null;
    if (!sw && !sh) continue; // not a v3 frame node
    hasAny = true;
    if (firstW === null) firstW = sw || 'HUG';
    else if (firstW !== (sw || 'HUG')) wMixed = true;
    if (firstH === null) firstH = sh || 'HUG';
    else if (firstH !== (sh || 'HUG')) hMixed = true;
  }

  if (!hasAny) return null;
  return {
    sizingW: wMixed ? '' : (firstW || 'HUG'),
    sizingH: hMixed ? '' : (firstH || 'HUG'),
    wMixed,
    hMixed,
  };
}

/**
 * Read shared container properties (direction, gap, padding) across selected items.
 * Returns null if no containers in selection.
 */
function _getMultiContainerValues(items) {
  let firstDir = null, firstGap = null, firstPad = null;
  let dirMixed = false, gapMixed = false, padMixed = false;
  let containerCount = 0;

  for (const item of items) {
    const node = item.node;
    if (!node) continue;
    const isContainer = node.layout || (node.children && node.children.length > 0);
    if (!isContainer) continue;
    containerCount++;
    const ovr = overrides[item.id] || {};
    const dir = ovr.direction || (node.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL');
    const gap = ovr.gap !== undefined ? ovr.gap : (node.layoutGap || 24);
    const pad = ovr.padding !== undefined ? ovr.padding : (node.padding_top !== undefined ? node.padding_top : 8);
    if (firstDir === null) firstDir = dir; else if (firstDir !== dir) dirMixed = true;
    if (firstGap === null) firstGap = gap; else if (firstGap !== gap) gapMixed = true;
    if (firstPad === null) firstPad = pad; else if (firstPad !== pad) padMixed = true;
  }

  if (containerCount === 0) return null;
  return {
    containerCount,
    direction: dirMixed ? '' : firstDir,
    gap: gapMixed ? '' : firstGap,
    padding: padMixed ? '' : firstPad,
    dirMixed, gapMixed, padMixed,
  };
}

/**
 * Read shared alignment across selected items.
 * Returns null if no v3 frame nodes, or {align, mixed}.
 */
function _getMultiAlignValues(items) {
  let first = null, mixed = false, hasAny = false;
  for (const item of items) {
    const node = item.node;
    if (!node) continue;
    if (!node.sizing_w && !node.sizing_h && !node.align) continue;
    hasAny = true;
    const ovr = overrides[item.id] || {};
    const align = ovr.align || node.align || 'TOP_LEFT';
    if (first === null) first = align; else if (first !== align) mixed = true;
  }
  if (!hasAny) return null;
  return { align: mixed ? '' : first, mixed };
}

/**
 * Read shared style across selected box/panel/terminal items.
 * Returns null if no styleable items, or {style, mixed, count}.
 */
function _getMultiStyleValues(items) {
  let first = null, mixed = false, count = 0;
  for (const item of items) {
    const ctype = getComponentType(item.id).toLowerCase();
    if (ctype !== 'box' && ctype !== 'panel' && ctype !== 'terminal') continue;
    count++;
    const ovr = overrides[item.id] || {};
    const style = ovr.style || '';
    if (first === null) first = style; else if (first !== style) mixed = true;
  }
  if (count === 0) return null;
  return { style: mixed ? '__mixed__' : first, mixed, count };
}

/**
 * Apply alignment to ALL selected items, then trigger a single relayout.
 */
function setMultiFrameAlign(align) {
  const ids = [...selectedIds];
  const maiBefore = _captureOverrideEntries(ids);
  for (const cid of ids) {
    const node = model.get(cid);
    if (!node) continue;
    if (node.type === 'arrow' || node.type === 'separator') continue;
    if (!overrides[cid]) overrides[cid] = {};
    overrides[cid].align = align;
  }
  setDirty(true);
  commitOverridePatchAction("Change alignment (multi)", maiBefore, _captureOverrideEntries(ids));
  if (ids.length > 0) {
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(ids[0]), 300);
  }
  renderMultiSelectionInspector();
}
window.setMultiFrameAlign = setMultiFrameAlign;

/**
 * Apply style override to ALL selected box/panel/terminal items.
 */
function applyMultiStyleOverride(styleName) {
  const preset = BOX_STYLES[styleName];
  const ids = [...selectedIds];
  const msoBefore = _captureOverrideEntries(ids);
  for (const cid of ids) {
    const ctype = getComponentType(cid).toLowerCase();
    if (ctype !== 'box' && ctype !== 'panel' && ctype !== 'terminal') continue;
    if (ENGINE === "v3") {
      if (!preset) {
        if (overrides[cid]) {
          delete overrides[cid].fill;
          delete overrides[cid].border;
          delete overrides[cid].style;
          model.cleanOverride(cid);
        }
      } else {
        if (!overrides[cid]) overrides[cid] = {};
        const fillMap = { "#FFFFFF": "WHITE", "#F3F3F3": "GREY", "#000000": "BLACK" };
        const borderMap = { "solid": "SOLID", "none": "NONE" };
        overrides[cid].fill = fillMap[preset.fill] || "WHITE";
        overrides[cid].border = borderMap[preset.border] || "SOLID";
        overrides[cid].style = styleName;
      }
    } else {
      if (preset) {
        if (!overrides[cid]) overrides[cid] = {};
        overrides[cid].style = styleName;
      } else {
        if (overrides[cid]) {
          delete overrides[cid].style;
          model.cleanOverride(cid);
        }
      }
    }
  }
  setDirty(true);
  commitOverridePatchAction("Change style (multi)", msoBefore, _captureOverrideEntries(ids));
  if (ENGINE === "v3") {
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(ids[0]), 300);
  }
  renderMultiSelectionInspector();
  applyAllOverrides();
  reapplySelection();
  runConstraints();
}
window.applyMultiStyleOverride = applyMultiStyleOverride;

/**
 * Apply a frame property to ALL selected items, then trigger a single relayout.
 */
function setMultiFrameProp(prop, value) {
  if (value === '' || value === null || value === undefined) return; // ignore "Mixed" placeholder
  if (typeof value === 'number' && !Number.isFinite(value)) return; // ignore NaN from empty input

  // For container-only props, only apply to containers
  const containerProps = new Set(['direction', 'gap', 'padding']);
  const isContainerProp = containerProps.has(prop);

  // Clamp numeric frame properties
  if (prop === 'gap' || prop === 'padding') {
    value = Math.max(0, Number.isFinite(value) ? value : 0);
  }

  const ids = [...selectedIds];
  const mfpBefore = _captureOverrideEntries(ids);
  for (const cid of ids) {
    const node = model.get(cid);
    if (!node) continue;
    // Skip non-frame nodes (arrows, separators)
    if (node.type === "arrow" || node.type === "separator") continue;
    // Container-only props skip leaf nodes
    if (isContainerProp) {
      const isContainer = node.layout || (node.children && node.children.length > 0);
      if (!isContainer) continue;
    }

    if (!overrides[cid]) overrides[cid] = {};
    overrides[cid][prop] = value;
    _coercedKeys.delete(cid + ':' + prop);

    // FIXED captures current placed size (guard node.data for un-laid-out nodes)
    if ((prop === 'sizing_w' || prop === 'sizing_h') && value === 'FIXED' && node.data) {
      if (prop === 'sizing_w' && overrides[cid].width === undefined) {
        overrides[cid].width = Math.round(node.data.width);
      }
      if (prop === 'sizing_h' && overrides[cid].height === undefined) {
        overrides[cid].height = Math.round(node.data.height);
      }
    }
    // Switching away from FIXED clears the captured size
    if (prop === 'sizing_w' && value !== 'FIXED') {
      delete overrides[cid].width;
    }
    if (prop === 'sizing_h' && value !== 'FIXED') {
      delete overrides[cid].height;
    }
  }

  setDirty(true);
  commitOverridePatchAction("Change " + prop + " (multi)", mfpBefore, _captureOverrideEntries(ids));

  // Single debounced relayout for the batch (guard empty selection)
  if (ids.length > 0) {
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(ids[0]), 300);
  }

  // Refresh inspector
  renderMultiSelectionInspector();
}
window.setMultiFrameProp = setMultiFrameProp;

/**
 * Set an explicit width or height for all selected items, converting from
 * the current inspector unit (px, cols, rows) to pixels.
 */
function setMultiFrameSize(dimension, value) {
  if (!Number.isFinite(value) || value <= 0) return;
  let px;
  if (dimension === 'width' && _inspectorWidthUnit === 'cols') {
    px = colSpanToPx(value);
  } else if (dimension === 'height' && _inspectorHeightUnit === 'rows') {
    px = rowSpanToPx(value);
  } else {
    px = Math.round(value / BASELINE_STEP) * BASELINE_STEP;
  }
  if (px == null || isNaN(px) || px <= 0) return;
  px = Math.round(px);

  const sizingProp = dimension === 'width' ? 'sizing_w' : 'sizing_h';
  const ids = [...selectedIds];
  const msBefore = _captureOverrideEntries(ids);
  for (const cid of ids) {
    const node = model.get(cid);
    if (!node) continue;
    if (node.type === 'arrow' || node.type === 'separator') continue;
    if (!overrides[cid]) overrides[cid] = {};
    overrides[cid][sizingProp] = 'FIXED';
    overrides[cid][dimension] = px;
  }
  setDirty(true);
  commitOverridePatchAction("Set " + dimension + " (multi)", msBefore, _captureOverrideEntries(ids));
  if (ids.length > 0) {
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(ids[0]), 300);
  }
  renderMultiSelectionInspector();
}
window.setMultiFrameSize = setMultiFrameSize;

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

  // Lazily created canvas context for text measurement
  let _measureCtx = null;
  function getMeasureCtx() {
    if (!_measureCtx) {
      _measureCtx = document.createElement("canvas").getContext("2d");
    }
    return _measureCtx;
  }

  /**
   * Reflow text inside a component group to fit the current box width.
   * Wraps long tspans at word boundaries and auto-expands the rect height
   * to accommodate the wrapped text.
   */
  function reflowTextInGroup(g, dw) {
    const rect = g.querySelector("rect:first-of-type");
    if (!rect) return 0;
    const textEl = g.querySelector("text");
    if (!textEl) return 0;

    const origW = parseFloat(rect.getAttribute("data-orig-width") || rect.getAttribute("width"));
    const newW = origW + dw;
    const INSET = window.__DG_CONFIG.inset || 8;
    const hasIcon = !!g.querySelector(".dg-icon");
    const iconW = hasIcon ? (window.__DG_CONFIG.icon_size || 48) : 0;
    const iconGap = hasIcon ? INSET : 0;
    const availW = newW - 2 * INSET - (iconW > 0 ? iconW + iconGap : 0);
    if (availW <= 0) return 0;

    const tspans = textEl.querySelectorAll("tspan");
    if (tspans.length === 0) return;

    // Compute line step from existing tspans
    const firstY = parseFloat(tspans[0].getAttribute("y"));
    const lineStep = tspans.length >= 2
      ? parseFloat(tspans[1].getAttribute("y")) - firstY
      : 24;

    const ctx = getMeasureCtx();
    const ns = "http://www.w3.org/2000/svg";

    // --- Phase 1: Join consecutive same-style tspans into runs ---
    // Without this, widening a box can't merge lines that were previously
    // wrapped at a narrower width (each narrow tspan still fits, so the
    // split-only logic below would keep them as-is).
    const runs = []; // { text, fontSize, fontWeight, fill, x, scAttr, lsAttr, ffAttr }
    for (const ts of tspans) {
      const fontSize = ts.getAttribute("font-size") || "14";
      const fontWeight = ts.getAttribute("font-weight") || "400";
      const fill = ts.getAttribute("fill") || "#000";
      const x = ts.getAttribute("x");
      const content = ts.textContent;
      const scAttr = ts.getAttribute("font-variant-caps") || "";
      const lsAttr = ts.getAttribute("letter-spacing") || "";
      const ffAttr = ts.getAttribute("font-family") || "";

      const prev = runs.length > 0 ? runs[runs.length - 1] : null;
      const sameStyle = prev
        && prev.fontSize === fontSize
        && prev.fontWeight === fontWeight
        && prev.fill === fill
        && prev.scAttr === scAttr
        && prev.lsAttr === lsAttr
        && prev.ffAttr === ffAttr;

      if (sameStyle && prev.text !== "" && content !== "") {
        // Merge into the previous run (space-join wrapped fragments)
        prev.text += " " + content;
      } else {
        runs.push({ text: content, fontSize, fontWeight, fill, x, scAttr, lsAttr, ffAttr });
      }
    }

    // --- Phase 2: Re-wrap each run at the new available width ---
    const specs = [];
    for (const run of runs) {
      ctx.font = run.fontWeight + " " + run.fontSize + "px 'Ubuntu Sans', sans-serif";

      if (!run.text || ctx.measureText(run.text).width <= availW) {
        specs.push({ content: run.text, fontSize: run.fontSize, fontWeight: run.fontWeight,
          fill: run.fill, x: run.x, scAttr: run.scAttr, lsAttr: run.lsAttr, ffAttr: run.ffAttr });
      } else {
        // Word-wrap at word boundaries
        const words = run.text.split(/(\s+)/);
        let line = "";
        for (const word of words) {
          const test = line + word;
          if (ctx.measureText(test.trim()).width > availW && line.trim()) {
            specs.push({ content: line.trim(), fontSize: run.fontSize, fontWeight: run.fontWeight,
              fill: run.fill, x: run.x, scAttr: run.scAttr, lsAttr: run.lsAttr, ffAttr: run.ffAttr });
            line = word.trimStart();
          } else {
            line = test;
          }
        }
        if (line.trim()) {
          specs.push({ content: line.trim(), fontSize: run.fontSize, fontWeight: run.fontWeight,
            fill: run.fill, x: run.x, scAttr: run.scAttr, lsAttr: run.lsAttr, ffAttr: run.ffAttr });
        }
      }
    }

    // Rebuild tspans if wrapping changed the line count or content
    const contentChanged = specs.length !== tspans.length
      || specs.some((s, i) => s.content !== tspans[i].textContent);
    if (contentChanged) {
      textEl.innerHTML = "";
      let y = firstY;
      for (const spec of specs) {
        const ts = document.createElementNS(ns, "tspan");
        ts.setAttribute("x", spec.x);
        ts.setAttribute("y", y.toFixed(2));
        ts.setAttribute("font-size", spec.fontSize);
        ts.setAttribute("font-weight", spec.fontWeight);
        ts.setAttribute("fill", spec.fill);
        if (spec.scAttr) ts.setAttribute("font-variant-caps", spec.scAttr);
        if (spec.lsAttr) ts.setAttribute("letter-spacing", spec.lsAttr);
        if (spec.ffAttr) ts.setAttribute("font-family", spec.ffAttr);
        ts.textContent = spec.content;
        textEl.appendChild(ts);
        y += lineStep;
      }
    }

    // Always auto-expand box height to fit text (even if tspan count didn't change,
    // since a prior applyToComponent pass may have reset the rect height)
    const origH = parseFloat(rect.getAttribute("data-orig-height") || rect.getAttribute("height"));
    const lastTspan = textEl.querySelector("tspan:last-of-type");
    if (lastTspan) {
      const lastY = parseFloat(lastTspan.getAttribute("y"));
      const lastFontSize = parseFloat(lastTspan.getAttribute("font-size") || "18");
      const textBottom = lastY + lastFontSize * 0.25; // baseline + descender
      const rectY = parseFloat(rect.getAttribute("y") || "0");
      const minHeight = textBottom - rectY + INSET;
      const currentH = parseFloat(rect.getAttribute("height"));
      if (minHeight > currentH) {
        const newH = Math.ceil(minHeight / 8) * 8;
        rect.setAttribute("height", newH);
        return newH - origH; // height expansion delta
      }
    }
    return 0; // no expansion
  }

  // Collect reflow-induced height expansions for post-pass vertical shift
  const reflowDhByComponent = {};

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

      // Reflow text when box width has changed
      if (eff.dw !== 0) {
        const reflowDh = reflowTextInGroup(g, eff.dw);
        if (reflowDh > 0) reflowDhByComponent[cid] = reflowDh;
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

  // -----------------------------------------------------------------------
  // Reflow post-pass: when text reflow made a box taller, shift all
  // components in subsequent grid rows downward so nothing overlaps.
  // The shift is computed per-row (max reflow dh across all columns in
  // that row) and applied cumulatively to every component below.
  // -----------------------------------------------------------------------
  const cumulativeReflowDy = {}; // cid → total dy from reflow of boxes above
  if (Object.keys(reflowDhByComponent).length > 0 && model.diagramGrid) {
    const rootNodes = model._roots.filter(n => n.type !== "arrow" && n.type !== "separator");
    // Compute the max reflow dh per row (across all columns)
    const maxReflowDhByRow = {};
    for (const [cid, dh] of Object.entries(reflowDhByComponent)) {
      const node = model.get(cid);
      if (!node) continue;
      const row = node.gridRow || 0;
      maxReflowDhByRow[row] = Math.max(maxReflowDhByRow[row] || 0, dh);
    }
    // For each component, sum reflow dh from all rows above it
    const affectedRows = Object.keys(maxReflowDhByRow).map(Number).sort((a, b) => a - b);
    for (const n of rootNodes) {
      const row = n.gridRow || 0;
      let dy = 0;
      for (const affectedRow of affectedRows) {
        if (affectedRow < row) dy += maxReflowDhByRow[affectedRow];
      }
      if (dy > 0) cumulativeReflowDy[n.id] = dy;
    }
    // Re-apply transforms for shifted components
    for (const [cid, dy] of Object.entries(cumulativeReflowDy)) {
      const eff = getEffectiveDelta(cid);
      svg.querySelectorAll('[data-component-id="' + cid + '"]').forEach(g => {
        g.style.transform = "translate(" + eff.dx + "px, " + (eff.dy + dy) + "px)";
      });
    }
  }

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
    // Also accounts for reflow-induced height expansion and cumulative vertical shift
    function sideShift(eff, side, cid) {
      const reflowDh = reflowDhByComponent[cid] || 0;
      const totalDh = eff.dh + reflowDh;
      const reflowDy = cumulativeReflowDy[cid] || 0;
      let sdx = eff.dx, sdy = eff.dy + reflowDy;
      if (side === "bottom") sdy += totalDh;
      if (side === "top") {} // top edge doesn't move on dh
      if (side === "right") sdx += eff.dw;
      if (side === "left") {} // left edge doesn't move on dw
      // Side midpoint shifts by half the perpendicular size delta
      if (side === "top" || side === "bottom") sdx += eff.dw / 2;
      if (side === "left" || side === "right") sdy += totalDh / 2;
      return { dx: sdx, dy: sdy };
    }

    const srcShift = sideShift(srcEff, srcSide, srcCid);
    const tgtShift = sideShift(tgtEff, tgtSide, tgtCid);

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

        // Read original coords for all visible segments
        const origCoords = visLines.map(ln => ({
          x1: parseFloat(ln.getAttribute("data-orig-x1")),
          y1: parseFloat(ln.getAttribute("data-orig-y1")),
          x2: parseFloat(ln.getAttribute("data-orig-x2")),
          y2: parseFloat(ln.getAttribute("data-orig-y2")),
        }));

        // Determine segment orientation: true = horizontal, false = vertical
        function isHorizontal(c) { return Math.abs(c.y2 - c.y1) <= Math.abs(c.x2 - c.x1); }

        if (visLines.length === 1) {
          // Single segment: shift start by srcShift, end by tgtShift
          visLines[0].setAttribute("x1", origCoords[0].x1 + srcShift.dx);
          visLines[0].setAttribute("y1", origCoords[0].y1 + srcShift.dy);
          visLines[0].setAttribute("x2", origCoords[0].x2 + tgtShift.dx);
          visLines[0].setAttribute("y2", origCoords[0].y2 + tgtShift.dy);
        } else {
          // Multi-segment orthogonal arrows: axis-aware waypoint adjustment.
          // Endpoints shift fully with their respective box. Waypoints shift
          // only on the axis perpendicular to their source-side segment,
          // preserving orthogonality.

          // Start with all coords at original
          const coords = origCoords.map(c => ({ ...c }));
          const n = coords.length;

          // 1. Shift first endpoint by srcShift
          coords[0].x1 += srcShift.dx;
          coords[0].y1 += srcShift.dy;

          // 2. Shift last endpoint by tgtShift
          coords[n - 1].x2 += tgtShift.dx;
          coords[n - 1].y2 += tgtShift.dy;

          // 3. Adjust first waypoint (end of seg0 / start of seg1)
          //    by the perpendicular component of srcShift
          if (isHorizontal(origCoords[0])) {
            coords[0].y2 += srcShift.dy;
          } else {
            coords[0].x2 += srcShift.dx;
          }
          coords[1].x1 = coords[0].x2;
          coords[1].y1 = coords[0].y2;

          // 4. Adjust last waypoint (end of seg[n-2] / start of seg[n-1])
          //    by the perpendicular component of tgtShift
          if (isHorizontal(origCoords[n - 1])) {
            coords[n - 1].y1 += tgtShift.dy;
          } else {
            coords[n - 1].x1 += tgtShift.dx;
          }
          coords[n - 2].x2 = coords[n - 1].x1;
          coords[n - 2].y2 = coords[n - 1].y1;

          // Apply computed coords
          for (let i = 0; i < n; i++) {
            visLines[i].setAttribute("x1", coords[i].x1);
            visLines[i].setAttribute("y1", coords[i].y1);
            visLines[i].setAttribute("x2", coords[i].x2);
            visLines[i].setAttribute("y2", coords[i].y2);
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

/**
 * Expand the SVG artboard (viewBox + width/height) if any component's
 * effective bounding box extends past the current canvas edges.
 * Called after drag/resize so content never gets clipped.
 */
function autoFitArtboard() {
  const svg = document.querySelector("#stage svg");
  if (!svg || !componentTree || componentTree.length === 0) return;

  const PADDING = 24; // breathing room on every side

  // Compute the union bounding box of all positioned components
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function visit(nodes) {
    for (const node of nodes) {
      if (node.type === "arrow") { if (node.children) visit(node.children); continue; }
      // Use actual SVG DOM geometry + CSS transform
      const g = svg.querySelector('[data-component-id="' + node.id + '"]');
      if (!g) { if (node.children) visit(node.children); continue; }
      const bbox = g.getBBox();
      let tdx = 0, tdy = 0;
      const tm = (g.style.transform || "").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      if (tm) { tdx = parseFloat(tm[1]); tdy = parseFloat(tm[2]); }
      const x = bbox.x + tdx;
      const y = bbox.y + tdy;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + bbox.width > maxX) maxX = x + bbox.width;
      if (y + bbox.height > maxY) maxY = y + bbox.height;
      if (node.children) visit(node.children);
    }
  }
  visit(componentTree);
  if (!isFinite(minX)) return;

  const vb = svg.viewBox.baseVal;
  const curW = vb.width || parseFloat(svg.getAttribute("width") || "0");
  const curH = vb.height || parseFloat(svg.getAttribute("height") || "0");
  const curX = vb.x || 0;
  const curY = vb.y || 0;

  // Required canvas extents
  const needX = Math.min(curX, minX - PADDING);
  const needY = Math.min(curY, minY - PADDING);
  const needRight = Math.max(curX + curW, maxX + PADDING);
  const needBottom = Math.max(curY + curH, maxY + PADDING);
  const needW = needRight - needX;
  const needH = needBottom - needY;

  if (needX < curX || needY < curY || needW > curW || needH > curH) {
    svg.setAttribute("viewBox", needX + " " + needY + " " + needW + " " + needH);
    svg.setAttribute("width", needW);
    svg.setAttribute("height", needH);
  }
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
      if (overrides[node.id]) item.style.color = UI_AUTHORING_ACCENT;
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

  // If current selection is a container with children, select all children
  const current = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth);
  if (current && selectedIds.has(current)) {
    const node = model.get(current);
    if (node && node.children && node.children.length > 0) {
      const childIds = node.children.map(n => n.data.id);
      selectedIds.clear();
      childIds.forEach(id => selectedIds.add(id));
      selectionDepth++;
      reapplySelection();
      return;
    }
    // No children — try text edit
    startTextEdit(current, e);
    return;
  }

  const deeper = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth + 1);
  if (deeper) {
    selectionDepth++;
    selectComponent(deeper, false);
  }
}

function onSvgMouseDown(e) {
  // If currently text-editing, commit the edit before handling the new interaction
  if (mgr.isMode(InteractionMode.TEXT_EDITING)) {
    commitTextEdit();
  }

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
  
  if (e.button !== 0) return;

  // Ctrl+click: jump straight to the deepest (innermost) component (Figma behavior)
  if (e.ctrlKey || e.metaKey) {
    const deepest = findDeepestComponent(svgPt.x, svgPt.y);
    if (deepest) {
      // Set selectionDepth to match so subsequent clicks stay at that level
      const ancestors = getAncestors(deepest);
      selectionDepth = ancestors.length;
      selectComponent(deepest, e.shiftKey);
    } else {
      deselectAll();
    }
    e.preventDefault();
    return;
  }

  // Find component at current selectionDepth (shallowest = depth 0 by default)
  const cid = findComponentAtDepth(svgPt.x, svgPt.y, selectionDepth);
  // Fall back: if nothing at current depth, try top-level
  const effectiveCid = cid || findComponentAtDepth(svgPt.x, svgPt.y, 0);
  
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
                   origDeltas, hasMoved: false,
                   overrideSnapshotBefore: _captureOverrideEntries(dragCids),
                   snapTargets: dragCids.length === 1 ? collectSnapTargets(finalCid) : null,
                   autolayout: _isAutolayoutChild(finalCid),
                   reorderTarget: null });
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragUp);
  e.preventDefault();
}

/**
 * Check if a component is a child of an autolayout parent (v3 frame with direction).
 */
function _isAutolayoutChild(cid) {
  const parent = getParentNode(cid);
  if (!parent) return false;
  return parent.layout === 'vertical' || parent.layout === 'horizontal';
}

/**
 * Get sibling insertion targets for autolayout reorder.
 * Returns array of { cid, midpoint } sorted by position along the layout axis.
 */
function _getReorderTargets(cid) {
  const parentNode = model.getParent(cid);
  if (!parentNode) return [];
  const parent = parentNode.data;
  const isVertical = parent.layout === 'vertical';
  const siblings = parentNode.children.map(n => n.data);
  // Build midpoints along the layout axis
  return siblings.map(s => ({
    cid: s.id,
    midpoint: isVertical ? (s.y + s.height / 2) : (s.x + s.width / 2),
    pos: isVertical ? s.y : s.x,
    size: isVertical ? s.height : s.width,
  }));
}

/**
 * Show a reorder insertion indicator line between siblings.
 */
function _showReorderIndicator(parentCid, insertIndex, isVertical) {
  _clearReorderIndicator();
  const parentNode = model.get(parentCid);
  if (!parentNode) return;
  const parent = parentNode.data;
  const siblings = parentNode.children.map(n => n.data);
  if (siblings.length === 0) return;

  const svg = document.querySelector('#stage svg');
  if (!svg) return;

  // Calculate indicator position
  let x1, y1, x2, y2;
  const gap = parent.layout_gap || 24;
  if (isVertical) {
    const leftEdge = parent.x + (parent.padding_left || parent.pad || 0);
    const rightEdge = leftEdge + (siblings[0] ? siblings[0].width : 100);
    if (insertIndex <= 0) {
      const firstY = siblings[0].y;
      y1 = y2 = firstY - gap / 2;
    } else if (insertIndex >= siblings.length) {
      const last = siblings[siblings.length - 1];
      y1 = y2 = last.y + last.height + gap / 2;
    } else {
      const prev = siblings[insertIndex - 1];
      const next = siblings[insertIndex];
      y1 = y2 = (prev.y + prev.height + next.y) / 2;
    }
    x1 = leftEdge;
    x2 = rightEdge;
  } else {
    const topEdge = parent.y + (parent.padding_top || parent.pad || 0);
    const bottomEdge = topEdge + (siblings[0] ? siblings[0].height : 64);
    if (insertIndex <= 0) {
      const firstX = siblings[0].x;
      x1 = x2 = firstX - gap / 2;
    } else if (insertIndex >= siblings.length) {
      const last = siblings[siblings.length - 1];
      x1 = x2 = last.x + last.width + gap / 2;
    } else {
      const prev = siblings[insertIndex - 1];
      const next = siblings[insertIndex];
      x1 = x2 = (prev.x + prev.width + next.x) / 2;
    }
    y1 = topEdge;
    y2 = bottomEdge;
  }

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#E95420');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-dasharray', '6 4');
  line.setAttribute('data-reorder-indicator', 'true');
  svg.appendChild(line);
}

function _clearReorderIndicator() {
  const svg = document.querySelector('#stage svg');
  if (!svg) return;
  const indicators = svg.querySelectorAll('[data-reorder-indicator]');
  indicators.forEach(el => el.remove());
}

/**
 * Apply a reorder: move child `cid` to `insertIndex` within parent's children.
 * Sends a `children_order` override to the server and triggers relayout.
 */
function _applyReorder(parentId, cid, insertIndex) {
  const parentNode = model.get(parentId);
  if (!parentNode) return;
  const currentOrder = parentNode.children.map(n => n.data.id);
  const currentIdx = currentOrder.indexOf(cid);
  if (currentIdx === -1) return;

  // Build new order
  const newOrder = currentOrder.filter(id => id !== cid);
  // Adjust insertIndex since we removed the item
  const adjustedIdx = insertIndex > currentIdx ? insertIndex - 1 : insertIndex;
  newOrder.splice(adjustedIdx, 0, cid);

  // Skip if order didn't change
  if (newOrder.every((id, i) => id === currentOrder[i])) {
    return;
  }

  // Set children_order override on the parent
  setFrameProp(parentId, 'children_order', newOrder);
}

function onDragMove(e) {
  if (!mgr.isMode(InteractionMode.DRAGGING)) return;
  const s = mgr.state;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasMoved = true;
  if (!s.hasMoved) return;

  // Autolayout drag: show reorder indicator instead of free positioning
  if (s.autolayout && s.cids.length === 1) {
    const cid = s.cids[0];
    const parentNode = model.getParent(cid);
    if (parentNode) {
      const parent = parentNode.data;
      const isVertical = parent.layout === 'vertical';
      const targets = _getReorderTargets(cid);
      // Get the SVG coordinate of the cursor
      const svg = document.querySelector('#stage svg');
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      const svgPt = pt.matrixTransform(ctm.inverse());
      const cursorPos = isVertical ? svgPt.y : svgPt.x;

      // Find insertion index
      let insertIdx = targets.length;
      for (let i = 0; i < targets.length; i++) {
        if (cursorPos < targets[i].midpoint) {
          insertIdx = i;
          break;
        }
      }
      // Skip if dropping at the same position
      const currentIdx = targets.findIndex(t => t.cid === cid);
      if (insertIdx === currentIdx || insertIdx === currentIdx + 1) {
        _clearReorderIndicator();
        s.reorderTarget = null;
      } else {
        _showReorderIndicator(parentNode.data.id, insertIdx, isVertical);
        s.reorderTarget = { parentId: parentNode.data.id, insertIndex: insertIdx };
      }
    }
    return; // Don't apply dx/dy for autolayout children
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
      renderGuideLines(snap.lines, GUIDE_COLOR, GUIDE_OPACITY);
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
  _clearReorderIndicator();
  const s = mgr.state;
  if (s && s.hasMoved) {
    // Handle autolayout reorder
    if (s.autolayout && s.reorderTarget && s.cids.length === 1) {
      const { parentId, insertIndex } = s.reorderTarget;
      const cid = s.cids[0];
      _applyReorder(parentId, cid, insertIndex);
      selectComponent(s.cid);
    } else if (!s.autolayout) {
      for (const id of s.cids) cleanOverride(id);
      const afterOverrides = _captureOverrideEntries(s.cids);
      if (s.cids.length === 1) {
        selectComponent(s.cid);
      } else {
        reapplySelection();
      }
      commitOverridePatchAction(
        s.cids.length > 1 ? "Move selection" : "Move component",
        s.overrideSnapshotBefore,
        afterOverrides,
      );
    }
  } else if (s) {
    selectComponent(s.cid);
  }
  mgr.endInteraction();
  autoFitArtboard();
}

// ---- Resize ----

function getComponentType(cid) {
  return model.getType(cid) || "Box";
}

function showResizeHandles(cid) {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  // Remove old handles
  clearHandlesByClass("dg-handle");
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  if (groups.length === 0) {
    // Fallback: use tree data for borderless containers
    const treeNode = model.get(cid);
    if (!treeNode || !treeNode.data) return;
    var minX = treeNode.data.x, minY = treeNode.data.y;
    var maxX = treeNode.data.x + treeNode.data.width, maxY = treeNode.data.y + treeNode.data.height;
  } else {
  // Compute union bbox accounting for CSS transforms (overrides + reflow shifts)
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {
    const bbox = g.getBBox();
    // Parse actual CSS transform which includes override dx/dy + reflow cascade
    let tdx = 0, tdy = 0;
    const tm = (g.style.transform || "").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (tm) { tdx = parseFloat(tm[1]); tdy = parseFloat(tm[2]); }
    minX = Math.min(minX, bbox.x + tdx);
    minY = Math.min(minY, bbox.y + tdy);
    maxX = Math.max(maxX, bbox.x + bbox.width + tdx);
    maxY = Math.max(maxY, bbox.y + bbox.height + tdy);
  });
  }
  const ctype = getComponentType(cid);
  const isHLine = ctype === "Separator";
  const isArrow = ctype === "arrow";
  if (isHLine) {
    // Horizontal line: left and right edge handles only
    const hs = SHARED_HANDLE_SIZE;
    const ns = "http://www.w3.org/2000/svg";
    function mkEdgeHandle(cx, cy, cls, axis) {
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
    mkEdgeHandle(minX, (minY + maxY) / 2, "dg-handle-l", "l");
    mkEdgeHandle(maxX, (minY + maxY) / 2, "dg-handle-r", "r");
  } else if (isArrow) {
    // Arrow: show draggable waypoint handles (circles at each bend)
    showArrowWaypointHandles(cid);
  } else {
    // 2D component: all 8 handles via shared renderer
    renderResizeHandles(svg, minX, minY, maxX, maxY, cid, {
      handleClass: "dg-handle",
      nodeAttr: "data-resize-cid",
      dirAttr: "data-resize-axis",
    });
  }
}

function removeResizeHandles() {
  clearHandlesByClass("dg-handle");
  clearHandlesByClass("dg-wp-handle");
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
    const wpIds = [s.cid];
    const wpBefore = _captureOverrideEntries(wpIds);
    pruneCollinearWaypoints(s.cid);
    setWaypointOverride(s.cid);
    commitOverridePatchAction("Move waypoint", wpBefore, _captureOverrideEntries(wpIds));
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
  const addWpIds = [cid];
  const addWpBefore = _captureOverrideEntries(addWpIds);
  if (!node.waypoints) node.waypoints = [];
  const snapX = Math.round(x / 8) * 8;
  const snapY = Math.round(y / 8) * 8;
  node.waypoints.splice(segIdx, 0, [snapX, snapY]);
  rebuildArrowSVG(cid);
  showArrowWaypointHandles(cid);
  setWaypointOverride(cid);
  commitOverridePatchAction("Add waypoint", addWpBefore, _captureOverrideEntries(addWpIds));
}

function removeWaypoint(cid, idx) {
  const node = getArrowNode(cid);
  if (!node || !node.waypoints || node.waypoints.length <= 1) return;
  const rmWpIds = [cid];
  const rmWpBefore = _captureOverrideEntries(rmWpIds);
  node.waypoints.splice(idx, 1);
  rebuildArrowSVG(cid);
  showArrowWaypointHandles(cid);
  setWaypointOverride(cid);
  commitOverridePatchAction("Remove waypoint", rmWpBefore, _captureOverrideEntries(rmWpIds));
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

  // Get semantic text from the component tree (unwrapped, pre-wrapping content)
  const node = model.get(cid);
  const headingText = (node && node.data.heading_text) || "";
  const labelText = (node && node.data.label_text) || [];
  const hasHeading = !!headingText;

  // Build semantic lines for the textarea (heading first, then label entries)
  const semanticLines = [];
  if (hasHeading) semanticLines.push(headingText);
  for (const lt of labelText) semanticLines.push(lt);

  // If no semantic text available, fall back to tspan content
  if (semanticLines.length === 0) {
    const tspans = textEl.querySelectorAll("tspan");
    if (tspans.length === 0) return;
    tspans.forEach(ts => semanticLines.push(ts.textContent));
  }

  // Read styles from the first tspan for visual appearance
  const tspans = textEl.querySelectorAll("tspan");
  const styles = [];
  tspans.forEach(ts => {
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

  // Compute SVG-to-screen scale so we can convert SVG-coordinate values
  // (font-size, icon gutter) to screen pixels for the HTML overlay.
  const ctm = svg.getScreenCTM();
  const svgScale = ctm ? ctm.a : 1;  // uniform scale (a == d for non-skew)

  // Width: container minus insets, minus icon area + gutter if icon present
  const iconGutter = hasIcon ? (window.__DG_CONFIG.icon_size + window.__DG_CONFIG.col_gap) * svgScale : 0;
  const insetPx = 16 * svgScale;
  const editorW = Math.max(containerRect.width - insetPx - iconGutter, 60);

  // Create textarea overlay — shows semantic (unwrapped) text so the user
  // edits the raw text flow and the engine handles visual line breaking.
  const ta = document.createElement("textarea");
  ta.className = "dg-text-editor";
  ta.value = semanticLines.join("\n");
  ta.style.left = (textBBox.left - 4) + "px";
  ta.style.top = (textBBox.top - 4) + "px";
  ta.style.width = editorW + "px";
  ta.style.minHeight = textBBox.height + "px";
  ta.style.fontSize = (parseFloat(styles[0] ? styles[0].fontSize : "14") * svgScale) + "px";
  ta.style.lineHeight = (24 * svgScale) + "px";
  ta.style.fontWeight = styles[0] ? styles[0].fontWeight : "400";
  ta.style.color = styles[0] ? styles[0].fill : "#000";

  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  // Hide the original text while editing
  textEl.style.opacity = "0";

  mgr.startTextEdit({ cid, textEl, ta, originalLines: semanticLines, styles, hasHeading });

  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      cancelTextEdit();
    } else if (ev.key === "Enter" && ev.ctrlKey) {
      ev.preventDefault();
      commitTextEdit();
    }
    // Stop all key events from bubbling to the document handler
    // (prevents arrow keys from nudging the box while editing text)
    ev.stopPropagation();
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
  const { cid, textEl, ta, originalLines, hasHeading } = mgr.state;
  const newLines = ta.value.split("\n");

  // Check if text actually changed
  const changed = newLines.join("\n") !== originalLines.join("\n");

  if (changed) {
    // Build structured text override: split into heading + label
    const textOverride = {};
    if (hasHeading) {
      textOverride.heading = newLines[0] || "";
      textOverride.label = newLines.slice(1);
    } else {
      textOverride.heading = "";
      textOverride.label = newLines;
    }
    const editIds = [cid];
    const editBefore = _captureOverrideEntries(editIds);
    setOverride(cid, { text: textOverride });
    commitOverridePatchAction("Edit text", editBefore, _captureOverrideEntries(editIds));
  }

  // Remove the textarea and show text element (will be replaced by relayout)
  ta.remove();
  textEl.style.opacity = "";

  mgr.endInteraction();

  // Trigger server relayout to re-wrap text at the correct frame width
  // and resize the box if needed (HUG height).
  if (changed) {
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 100);
  }
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
  // Capture original overrides for ALL nodes that may be affected
  const origOverrides = {};
  function captureSubtree(nodeId) {
    const n = model.get(nodeId);
    if (!n) return;
    const o = getOwnDelta(nodeId);
    origOverrides[nodeId] = { dx: o.dx, dy: o.dy, dw: o.dw, dh: o.dh };
    for (const child of n.children) captureSubtree(child.id);
  }
  const node = model.get(cid);
  if (node) {
    captureSubtree(cid);
    // Capture parent + siblings for child-in-layout resize
    if (node.parent) {
      const po = getOwnDelta(node.parent.id);
      origOverrides[node.parent.id] = { dx: po.dx, dy: po.dy, dw: po.dw, dh: po.dh };
      const siblings = model.getSiblings(cid);
      for (const sib of siblings) captureSubtree(sib.id);
    } else if (model.diagramGrid) {
      // Root node: capture all root siblings for diagram-level grid relayout
      const siblings = model.getSiblings(cid);
      for (const sib of siblings) captureSubtree(sib.id);
    }
  }
  const touchedIds = Object.keys(origOverrides);
  mgr.startResize({
    cid, axis,
    startX: e.clientX, startY: e.clientY,
    origDx: own.dx, origDy: own.dy,
    origDw: own.dw, origDh: own.dh,
    origOverrides,
    overrideSnapshotBefore: _captureOverrideEntries(touchedIds),
    hasMoved: false, snapshotRecorded: false,
  });
  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", onResizeUp);
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Recursively apply relayoutChildren down the tree.
 * For each child that is itself a layout parent, relayout its children too.
 */
function _applyRelayoutRecursive(parentId, parentDw, parentDh, origOverrides, propagatedIds) {
  const childDeltas = model.relayoutChildren(parentId, parentDw, parentDh);
  for (const [childId, delta] of Object.entries(childDeltas)) {
    const orig = origOverrides[childId] || { dx: 0, dy: 0, dw: 0, dh: 0 };
    setOverride(childId, {
      dx: orig.dx + delta.dx,
      dy: orig.dy + delta.dy,
      dw: orig.dw + delta.dw,
      dh: orig.dh + delta.dh,
    });
    propagatedIds.add(childId);
    // Recurse: if this child has layout children, relayout them too
    const childNode = model.get(childId);
    if (childNode && childNode.layout && childNode.children.length > 0) {
      const childEffDw = orig.dw + delta.dw;
      const childEffDh = orig.dh + delta.dh;
      _applyRelayoutRecursive(childId, childEffDw, childEffDh, origOverrides, propagatedIds);
    }
  }
}

function onResizeMove(e) {
  if (!mgr.isMode(InteractionMode.RESIZING)) return;
  const s = mgr.state;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.hasMoved = true;
  if (!s.hasMoved) return;
  if (!s.snapshotRecorded) {
    const svg = document.querySelector("#stage svg");
    if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.style.display = "none");
    s.snapshotRecorded = true;
  }
  let newDx = s.origDx;
  let newDy = s.origDy;
  let newDw = s.origDw;
  let newDh = s.origDh;
  
  const axis = s.axis;
  const node = model.get(s.cid);
  const baseX = node ? node.data.x : 0;
  const baseY = node ? node.data.y : 0;
  const baseW = node ? node.data.width : 0;
  const baseH = node ? node.data.height : 0;
  const gridTargets = _gridSnapTargets();
  const resizeLines = [];

  // Hoist SVG dimensions for guide lines (avoid repeated DOM queries)
  const svgEl = document.querySelector("#stage svg");
  const svgW = svgEl ? parseFloat(svgEl.getAttribute("width") || "0") : 0;
  const svgH = svgEl ? parseFloat(svgEl.getAttribute("height") || "0") : 0;

  // Handle horizontal resizing
  if (axis === "l" || axis === "tl" || axis === "bl") {
    const delta = Math.round(dx / 8) * 8;
    newDx = s.origDx + delta;
    newDw = s.origDw - delta;
    // Snap left edge to grid
    const leftEdge = baseX + newDx;
    const snapL = _snapEdgeToGrid(leftEdge, gridTargets.xs);
    if (snapL.snapped) {
      const adj = snapL.value - leftEdge;
      newDx += adj;
      newDw -= adj;
      resizeLines.push({ x1: snapL.target, y1: 0, x2: snapL.target, y2: svgH });
    }
  } else if (axis === "r" || axis === "tr" || axis === "br") {
    newDw = Math.round((s.origDw + dx) / 8) * 8;
    // Snap right edge to grid
    const rightEdge = baseX + s.origDx + baseW + newDw;
    const snapR = _snapEdgeToGrid(rightEdge, gridTargets.xs);
    if (snapR.snapped) {
      newDw += snapR.value - rightEdge;
      resizeLines.push({ x1: snapR.target, y1: 0, x2: snapR.target, y2: svgH });
    }
  }
  
  // Handle vertical resizing
  if (axis === "t" || axis === "tl" || axis === "tr") {
    const delta = Math.round(dy / 8) * 8;
    newDy = s.origDy + delta;
    newDh = s.origDh - delta;
    // Snap top edge to grid
    const topEdge = baseY + newDy;
    const snapT = _snapEdgeToGrid(topEdge, gridTargets.ys);
    if (snapT.snapped) {
      const adj = snapT.value - topEdge;
      newDy += adj;
      newDh -= adj;
      resizeLines.push({ x1: 0, y1: snapT.target, x2: svgW, y2: snapT.target });
    }
  } else if (axis === "b" || axis === "bl" || axis === "br") {
    newDh = Math.round((s.origDh + dy) / 8) * 8;
    // Snap bottom edge to grid
    const bottomEdge = baseY + s.origDy + baseH + newDh;
    const snapB = _snapEdgeToGrid(bottomEdge, gridTargets.ys);
    if (snapB.snapped) {
      newDh += snapB.value - bottomEdge;
      resizeLines.push({ x1: 0, y1: snapB.target, x2: svgW, y2: snapB.target });
    }
  }

  // Show grid snap guides during resize
  if (resizeLines.length > 0) {
    renderGuideLines(resizeLines, GUIDE_COLOR, GUIDE_OPACITY);
  } else {
    clearGuideLines();
  }

  setOverride(s.cid, { dx: newDx, dy: newDy, dw: newDw, dh: newDh });

  // --- Auto-layout engine ---
  if (!s.propagatedIds) s.propagatedIds = new Set();

  // Parent resize: children keep their size and position.
  // Only child resize propagates to siblings (below).

  // Child resize → shift siblings to maintain gutters.
  // Works for both nested children and root-level nodes (via diagramGrid).
  const resizedNode = model.get(s.cid);
  const hasLayoutContext = resizedNode && (
    (resizedNode.parent && resizedNode.parent.layout) ||
    (!resizedNode.parent && model.diagramGrid)
  );
  if (hasLayoutContext) {
    const deltaDw = newDw - s.origDw;
    const deltaDh = newDh - s.origDh;
    const siblingAdj = model.relayoutSiblingsAfterChildResize(s.cid, deltaDw, deltaDh);
    for (const [adjId, delta] of Object.entries(siblingAdj)) {
      const origAdj = s.origOverrides[adjId] || { dx: 0, dy: 0, dw: 0, dh: 0 };
      const patch = {};
      if (delta.dx !== undefined) patch.dx = origAdj.dx + delta.dx;
      if (delta.dy !== undefined) patch.dy = origAdj.dy + delta.dy;
      if (delta.dw !== undefined) patch.dw = origAdj.dw + delta.dw;
      if (delta.dh !== undefined) patch.dh = origAdj.dh + delta.dh;
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
    const afterOverrides = _captureOverrideEntries(Object.keys(s.origOverrides));
    selectComponent(s.cid);
    commitOverridePatchAction("Resize component", s.overrideSnapshotBefore, afterOverrides);

    // V3: convert resize delta into frame width/height override → relayout
    if (ENGINE === "v3") {
      const node = model.get(s.cid);
      if (node) {
        const baseW = node.data.width;
        const baseH = node.data.height;
        const own = getOwnDelta(s.cid);
        const newW = Math.max(8, baseW + own.dw);
        const newH = Math.max(8, baseH + own.dh);
        if (!overrides[s.cid]) overrides[s.cid] = {};
        // Per-axis resize: only the axis that changed becomes FIXED
        const resizedW = own.dw !== 0;
        const resizedH = own.dh !== 0;
        if (resizedW) {
          overrides[s.cid].width = newW;
          overrides[s.cid].sizing_w = "FIXED";
        }
        if (resizedH) {
          overrides[s.cid].height = newH;
          overrides[s.cid].sizing_h = "FIXED";
        }
        // Clear visual delta — the relayout will reposition everything
        setOverride(s.cid, { dx: 0, dy: 0, dw: 0, dh: 0 });
        // Clear sibling deltas too
        if (s.propagatedIds) {
          for (const pid of s.propagatedIds) {
            setOverride(pid, { dx: 0, dy: 0, dw: 0, dh: 0 });
          }
        }
        requestV3Relayout(s.cid);
      }
    }
  } else {
    // No move happened: re-show handles that were hidden
    if (svg) svg.querySelectorAll(".dg-handle").forEach(h => h.style.display = "");
  }
  mgr.endInteraction();
  autoFitArtboard();
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
  if (ENGINE === "v3") {
    applyV3Style(cid, styleName);
    return;
  }
  const styleIds = [cid];
  const styleBefore = _captureOverrideEntries(styleIds);
  if (styleName && BOX_STYLES[styleName]) {
    setOverride(cid, { style: styleName });
  } else {
    const ovr = overrides[cid];
    if (ovr) {
      delete ovr.style;
      model.cleanOverride(cid);
    }
    setDirty(true);
  }
  commitOverridePatchAction("Change style", styleBefore, _captureOverrideEntries(styleIds));
}

/**
 * v3 style override: sets fill + border as frame properties and triggers relayout.
 */
function applyV3Style(cid, styleName) {
  const v3StyleIds = [cid];
  const v3StyleBefore = _captureOverrideEntries(v3StyleIds);
  const preset = BOX_STYLES[styleName];
  if (!preset) {
    // Reset to definition — clear fill and border overrides
    if (overrides[cid]) {
      delete overrides[cid].fill;
      delete overrides[cid].border;
      delete overrides[cid].style;
      model.cleanOverride(cid);
    }
    setDirty(true);
    clearTimeout(_v3RelayoutTimer);
    _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 300);
    renderSelectionInspector(cid);
    commitOverridePatchAction("Change style", v3StyleBefore, _captureOverrideEntries(v3StyleIds));
    return;
  }
  if (!overrides[cid]) overrides[cid] = {};
  // Map preset fill to frame fill enum value
  const fillMap = { "#FFFFFF": "WHITE", "#F3F3F3": "GREY", "#000000": "BLACK" };
  const borderMap = { "solid": "SOLID", "none": "NONE" };  // DASHED gated out of style picker
  overrides[cid].fill = fillMap[preset.fill] || "WHITE";
  overrides[cid].border = borderMap[preset.border] || "SOLID";
  overrides[cid].style = styleName;
  setDirty(true);
  clearTimeout(_v3RelayoutTimer);
  _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 300);
  renderSelectionInspector(cid);
  applyAllOverrides();
  reapplySelection();
  runConstraints();
  updateInspector(cid);
  commitOverridePatchAction("Change style", v3StyleBefore, _captureOverrideEntries(v3StyleIds));
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
  renderEmptyInspector();
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
    // Sync selectionDepth so SVG mousedown targets the right level
    const ancestors = getAncestors(cid);
    selectionDepth = ancestors.length;
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
  renderSelectionInspector(cid);
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
  renderSelectionInspector(primary);
}

function clearSelection() {
  selectedIds.clear();
  selectionDepth = 0;
  const svg = document.querySelector("#stage svg");
  if (svg) svg.querySelectorAll(".dg-selected").forEach(el => el.classList.remove("dg-selected"));
  removeResizeHandles();
  document.querySelectorAll(".tree-item.selected").forEach(el => el.classList.remove("selected"));
  renderEmptyInspector();
}

// ---- 9-point alignment widget (v3) ----
const ALIGN_POINTS = [
  "TOP_LEFT", "TOP_CENTER", "TOP_RIGHT",
  "CENTER_LEFT", "CENTER", "CENTER_RIGHT",
  "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT",
];
const ALIGN_LABELS = {
  TOP_LEFT: "Top Left", TOP_CENTER: "Top Center", TOP_RIGHT: "Top Right",
  CENTER_LEFT: "Center Left", CENTER: "Center", CENTER_RIGHT: "Center Right",
  BOTTOM_LEFT: "Bottom Left", BOTTOM_CENTER: "Bottom Center", BOTTOM_RIGHT: "Bottom Right",
};
function buildAlignWidget(cid, currentAlign) {
  let html = '<div class="field"><span class="label">Alignment</span>';
  html += '<div class="dg-align-field">';
  html += '<div class="dg-align-grid">';
  for (const pt of ALIGN_POINTS) {
    const active = pt === currentAlign ? " active" : "";
    html += '<button class="' + active + '" title="' + ALIGN_LABELS[pt] +
      '" onclick="setFrameAlign(\'' + cid + '\',\'' + pt + '\')">' +
      '</button>';
  }
  html += '</div>';
  html += '<span class="value">' + ALIGN_LABELS[currentAlign] + '</span>';
  html += '</div></div>';
  return html;
}
function setFrameAlign(cid, align) {
  const faIds = [cid];
  const faBefore = _captureOverrideEntries(faIds);
  if (!overrides[cid]) overrides[cid] = {};
  overrides[cid].align = align;
  setDirty(true);
  commitOverridePatchAction("Change alignment", faBefore, _captureOverrideEntries(faIds));
  renderSelectionInspector(cid);
  // Trigger v3 relayout so alignment change takes effect immediately
  clearTimeout(_v3RelayoutTimer);
  _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 300);
}
// Expose to onclick handlers
window.setFrameAlign = setFrameAlign;

// ---- Auto-layout controls (v3) ----

function buildAutolayoutPanel(cid, node) {
  // Show for any node that has layout data from the v3 engine
  if (!node) return '';
  const isContainer = node.layout || (node.children && node.children.length > 0);

  // Read current values from overrides first, then from tree data
  const ovr = overrides[cid] || {};
  const sizingW = ovr.sizing_w || node.sizing_w || 'HUG';
  const sizingH = ovr.sizing_h || node.sizing_h || 'HUG';

  let html = '<div class="dg-autolayout-section">';

  if (isContainer) {
    const direction = ovr.direction || (node.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL');
    const gap = ovr.gap !== undefined ? ovr.gap : (node.layoutGap || 24);
    const padding = ovr.padding !== undefined ? ovr.padding : (node.padding_top !== undefined ? node.padding_top : 8);

    html += '<span class="label" style="margin-bottom:4px;display:block">Auto-layout</span>';

    // Direction
    html += '<div class="field"><span class="label">Direction</span>';
    html += '<select class="bf-input" onchange="setFrameProp(\'' + cid + '\',\'direction\',this.value)">';
    html += '<option value="VERTICAL"' + (direction === 'VERTICAL' ? ' selected' : '') + '>Vertical</option>';
    html += '<option value="HORIZONTAL"' + (direction === 'HORIZONTAL' ? ' selected' : '') + '>Horizontal</option>';
    html += '</select></div>';

    // Gap
    html += '<div class="field"><span class="label">Gap</span>';
    html += '<input class="bf-input" type="number" min="0" step="8" value="' + gap + '"';
    html += ' onchange="setFrameProp(\'' + cid + '\',\'gap\',parseInt(this.value))"';
    html += ' style="width:60px"></div>';

    // Padding
    const pt = node.padding_top || 0, pr = node.padding_right || 0;
    const pb = node.padding_bottom || 0, pl = node.padding_left || 0;
    const isUniformPad = (pt === pr && pr === pb && pb === pl);
    html += '<div class="field"><span class="label">Padding</span>';
    html += '<input class="bf-input" type="number" min="0" step="8" value="' + padding + '"';
    html += ' onchange="setFrameProp(\'' + cid + '\',\'padding\',parseInt(this.value))"';
    html += ' style="width:60px"></div>';
    if (!isUniformPad && ovr.padding === undefined) {
      html += '<div class="hint" style="color:#c90;font-size:11px">Non-uniform padding (' + pt + '/' + pr + '/' + pb + '/' + pl + '). Editing sets all sides.</div>';
    }
  } else {
    html += '<span class="label" style="margin-bottom:4px;display:block">Sizing</span>';
  }

  // Per-axis sizing (shown for all nodes)
  html += '<div class="field"><span class="label">Width</span>';
  html += '<select class="bf-input" onchange="setFrameProp(\'' + cid + '\',\'sizing_w\',this.value)">';
  html += '<option value="HUG"' + (sizingW === 'HUG' ? ' selected' : '') + '>Hug</option>';
  html += '<option value="FILL"' + (sizingW === 'FILL' ? ' selected' : '') + '>Fill</option>';
  html += '<option value="FIXED"' + (sizingW === 'FIXED' ? ' selected' : '') + '>Fixed</option>';
  html += '</select>';
  // Numeric width + unit selector (shown when FIXED)
  if (sizingW === 'FIXED') {
    const rawW = ovr.width !== undefined ? ovr.width : (node.data ? node.data.width : 0);
    const displayW = _inspectorWidthUnit === 'cols' ? Math.round(pxToColSpan(rawW) * 100) / 100 : Math.round(rawW);
    const stepW = _inspectorWidthUnit === 'cols' ? 1 : BASELINE_STEP;
    html += '<input class="bf-input" type="number" min="0" step="' + stepW + '" value="' + displayW + '"';
    html += ' onchange="setFrameSize(\'' + cid + '\',\'width\',parseFloat(this.value))"';
    html += ' style="width:60px;margin-left:4px">';
    html += '<select class="bf-input" style="width:50px;margin-left:2px" onchange="setWidthUnit(this.value,\'' + cid + '\')">';
    html += '<option value="px"' + (_inspectorWidthUnit === 'px' ? ' selected' : '') + '>px</option>';
    html += '<option value="cols"' + (_inspectorWidthUnit === 'cols' ? ' selected' : '') + '>cols</option>';
    html += '</select>';
  }
  html += '</div>';

  html += '<div class="field"><span class="label">Height</span>';
  html += '<select class="bf-input" onchange="setFrameProp(\'' + cid + '\',\'sizing_h\',this.value)">';
  html += '<option value="HUG"' + (sizingH === 'HUG' ? ' selected' : '') + '>Hug</option>';
  html += '<option value="FILL"' + (sizingH === 'FILL' ? ' selected' : '') + '>Fill</option>';
  html += '<option value="FIXED"' + (sizingH === 'FIXED' ? ' selected' : '') + '>Fixed</option>';
  html += '</select>';
  // Numeric height + unit selector (shown when FIXED)
  if (sizingH === 'FIXED') {
    const rawH = ovr.height !== undefined ? ovr.height : (node.data ? node.data.height : 0);
    const displayH = _inspectorHeightUnit === 'rows' ? Math.round(pxToRowSpan(rawH) * 100) / 100 : Math.round(rawH);
    const stepH = _inspectorHeightUnit === 'rows' ? 1 : BASELINE_STEP;
    html += '<input class="bf-input" type="number" min="0" step="' + stepH + '" value="' + displayH + '"';
    html += ' onchange="setFrameSize(\'' + cid + '\',\'height\',parseFloat(this.value))"';
    html += ' style="width:60px;margin-left:4px">';
    html += '<select class="bf-input" style="width:50px;margin-left:2px" onchange="setHeightUnit(this.value,\'' + cid + '\')">';
    html += '<option value="px"' + (_inspectorHeightUnit === 'px' ? ' selected' : '') + '>px</option>';
    html += '<option value="rows"' + (_inspectorHeightUnit === 'rows' ? ' selected' : '') + '>rows</option>';
    html += '</select>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

let _v3RelayoutTimer = null;
function setFrameProp(cid, prop, value) {
  const fpIds = [cid];
  const fpBefore = _captureOverrideEntries(fpIds);
  if (!overrides[cid]) overrides[cid] = {};

  // Clamp numeric frame properties to sane ranges
  if (prop === 'gap' || prop === 'padding') {
    value = Math.max(0, Number.isFinite(value) ? value : 0);
  }

  overrides[cid][prop] = value;

  // User explicitly set this property — remove it from coercion tracking
  _coercedKeys.delete(cid + ':' + prop);

  // Figma behavior: switching to FIXED captures the current placed size
  // so the frame remembers its dimensions instead of falling back to measured.
  if ((prop === 'sizing_w' || prop === 'sizing_h') && value === 'FIXED') {
    const node = model.get(cid);
    if (node && node.data) {
      if (prop === 'sizing_w' && overrides[cid].width === undefined) {
        overrides[cid].width = Math.round(node.data.width);
      }
      if (prop === 'sizing_h' && overrides[cid].height === undefined) {
        overrides[cid].height = Math.round(node.data.height);
      }
    }
  }
  // Switching away from FIXED: clear the captured explicit size so the
  // frame reverts to content-driven (HUG) or parent-driven (FILL) sizing.
  if (prop === 'sizing_w' && value !== 'FIXED') {
    delete overrides[cid].width;
  }
  if (prop === 'sizing_h' && value !== 'FIXED') {
    delete overrides[cid].height;
  }

  setDirty(true);
  commitOverridePatchAction("Change " + prop, fpBefore, _captureOverrideEntries(fpIds));

  // Debounce relayout — 300ms after last change
  clearTimeout(_v3RelayoutTimer);
  _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 300);

  // Update inspector immediately for responsive feel
  renderSelectionInspector(cid);
}

// Track which override keys were set by engine coercion (not user action).
// Format: Set of "fid:key" strings, e.g. "root:sizing_h"
const _coercedKeys = new Set();

async function requestV3Relayout(triggerCid) {
  const slug = SLUG.replace('v3:', '');
  // Send ALL accumulated frame overrides so the server can apply them together
  const allFrameOverrides = {};
  const FRAME_KEYS = ['direction', 'gap', 'padding', 'sizing', 'sizing_w', 'sizing_h', 'align', 'width', 'height', 'min_width', 'max_width', 'min_height', 'max_height', 'children_order', 'fill', 'border', 'text'];
  for (const [fid, ovr] of Object.entries(overrides)) {
    const entry = {};
    for (const key of FRAME_KEYS) {
      if (ovr[key] !== undefined) entry[key] = ovr[key];
    }
    if (Object.keys(entry).length > 0) allFrameOverrides[fid] = entry;
  }
  const payload = { frame_overrides: allFrameOverrides };
  const gridOverrides = _normaliseGridOverrides(model.gridOverrides || {});
  if (Object.keys(gridOverrides).length > 0) {
    payload.grid_overrides = gridOverrides;
  }
  try {
    const resp = await fetch('/api/relayout-v3/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error('v3 relayout failed:', resp.status);
      return;
    }
    const data = await resp.json();
    if (data.svg) {
      const stage = document.getElementById('stage');
      if (stage) {
        stage.innerHTML = data.svg;
        // Reload component tree from relayout response
        if (data.tree) {
          model.loadTree(data.tree);
          buildTreeUI();
        }
        // Clear stale position/size deltas — the full relayout recomputed
        // every position, so manual nudges from the old layout are invalid.
        for (const [cid, ovr] of Object.entries(overrides)) {
          delete ovr.dx; delete ovr.dy; delete ovr.dw; delete ovr.dh;
          if (Object.keys(ovr).length === 0) delete overrides[cid];
        }
        // Merge engine-coerced overrides: when the engine coerces a HUG
        // parent to FIXED (because children are FILL), persist the coerced
        // sizing + dimensions so subsequent relayouts preserve the frozen
        // size instead of re-measuring at the new content size.
        //
        // We do NOT auto-clear stale coerced keys. Once a parent is coerced
        // to FIXED, it stays FIXED until the user explicitly changes it back
        // via the dropdown (which calls setFrameProp and clears _coercedKeys).
        // This matches Figma: coercion is a one-way lock.
        const newCoerced = data.coerced_overrides || {};
        for (const [fid, coerced] of Object.entries(newCoerced)) {
          if (!overrides[fid]) overrides[fid] = {};
          for (const [key, val] of Object.entries(coerced)) {
            const ck = fid + ':' + key;
            // Only persist if user hasn't explicitly set this property
            // (unless it was a previous coercion)
            if (overrides[fid][key] === undefined || _coercedKeys.has(ck)) {
              overrides[fid][key] = val;
              _coercedKeys.add(ck);
            }
          }
        }
        // Reconcile sizing overrides with engine coercion: if the user
        // requested HUG but the engine coerced to FIXED (because children
        // are FILL), update the override so the inspector shows reality.
        for (const [fid, ovr] of Object.entries(overrides)) {
          const node = model.get(fid);
          if (!node) continue;
          if (ovr.sizing_w === 'HUG' && node.sizing_w === 'FIXED') {
            ovr.sizing_w = 'FIXED';
            ovr.width = Math.round(node.data.width);
          }
          if (ovr.sizing_h === 'HUG' && node.sizing_h === 'FIXED') {
            ovr.sizing_h = 'FIXED';
            ovr.height = Math.round(node.data.height);
          }
        }
        bindInteraction();
        applyAllOverrides();
        reapplySelection();
        if (data.grid_info) {
          gridInfo = data.grid_info;
          baseGridInfo = _cloneState(data.grid_info);
          model.setDiagramGrid(gridInfo);
          const request = _gridRequestValues(model.gridOverrides || {});
          const hasSavedCols = Number.isFinite((model.gridOverrides || {}).cols);
          const hasSavedColGap = Number.isFinite((model.gridOverrides || {}).col_gap);
          const hasSavedRowGap = Number.isFinite((model.gridOverrides || {}).row_gap);
          const hasSavedMargin = Number.isFinite((model.gridOverrides || {}).outer_margin);
          const nextCols = hasSavedCols ? request.cols : ((gridInfo.col_xs || []).length || 1);
          const nextColGap = hasSavedColGap ? request.colGap : (gridInfo.col_gap ?? 0);
          const nextRowGap = hasSavedRowGap ? request.rowGap : (gridInfo.row_gap ?? 0);
          const nextMargin = hasSavedMargin ? request.outerMargin : (gridInfo.outer_margin ?? 0);

          document.getElementById("grid-cols").value = nextCols;
          document.getElementById("grid-col-gap").value = nextColGap;
          document.getElementById("grid-row-gap").value = nextRowGap;
          document.getElementById("grid-margin").value = nextMargin;
          populateGridControls();
          renderGridOverlay();
        }
      }
    }
  } catch (e) {
    console.error('v3 relayout error:', e);
  }
}

// Expose to inline handlers
window.setFrameProp = setFrameProp;

/**
 * Set an explicit width or height value, converting from the current
 * inspector unit (px, cols, rows) to pixels.
 */
function setFrameSize(cid, dimension, value) {
  let px;
  if (dimension === 'width' && _inspectorWidthUnit === 'cols') {
    px = colSpanToPx(value);
  } else if (dimension === 'height' && _inspectorHeightUnit === 'rows') {
    px = rowSpanToPx(value);
  } else {
    px = Math.round(value / BASELINE_STEP) * BASELINE_STEP;
  }
  if (px == null || isNaN(px) || px <= 0) return;
  px = Math.round(px);
  const sizingProp = dimension === 'width' ? 'sizing_w' : 'sizing_h';
  if (!overrides[cid]) overrides[cid] = {};
  overrides[cid][sizingProp] = 'FIXED';
  overrides[cid][dimension] = px;
  setDirty(true);
  clearTimeout(_v3RelayoutTimer);
  _v3RelayoutTimer = setTimeout(() => requestV3Relayout(cid), 300);
  renderSelectionInspector(cid);
}
window.setFrameSize = setFrameSize;

function setWidthUnit(unit, cid) {
  _inspectorWidthUnit = unit;
  if (cid) renderSelectionInspector(cid);
}
window.setWidthUnit = setWidthUnit;

function setHeightUnit(unit, cid) {
  _inspectorHeightUnit = unit;
  if (cid) renderSelectionInspector(cid);
}
window.setHeightUnit = setHeightUnit;

function updateInspector(cid) {
  const inspector = getInspectorElement();
  if (!inspector) {
    return;
  }
  const svg = document.querySelector("#stage svg");
  if (!svg) return;
  const groups = svg.querySelectorAll('[data-component-id="' + cid + '"]');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach(g => {
    const bbox = g.getBBox();
    // Account for CSS transforms (overrides + reflow cascade)
    let tdx = 0, tdy = 0;
    const tm = (g.style.transform || "").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (tm) { tdx = parseFloat(tm[1]); tdy = parseFloat(tm[2]); }
    minX = Math.min(minX, bbox.x + tdx); minY = Math.min(minY, bbox.y + tdy);
    maxX = Math.max(maxX, bbox.x + bbox.width + tdx); maxY = Math.max(maxY, bbox.y + bbox.height + tdy);
  });
  // Fallback to component-tree data when no SVG elements found (e.g. borderless containers)
  if (!isFinite(minX)) {
    const treeNode = model.get(cid);
    if (treeNode && treeNode.data) {
      minX = treeNode.data.x; minY = treeNode.data.y;
      maxX = treeNode.data.x + treeNode.data.width; maxY = treeNode.data.y + treeNode.data.height;
    }
  }
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
  // 9-point alignment widget (v3 only)
  if (ENGINE === "v3") {
    const currentAlign = (overrides[cid] && overrides[cid].align) || (inspNode && inspNode.align) || "TOP_LEFT";
    html += buildAlignWidget(cid, currentAlign);
    // Auto-layout controls (v3 only — shown for all nodes)
    html += buildAutolayoutPanel(cid, inspNode);
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
    html += '<button class="bf-button is-base danger" onclick="clearOverride(\''+cid+'\')">Clear override</button>';
  }
  // Style picker for box-type components
  const ctype = getComponentType(cid).toLowerCase();
  if (ctype === "box" || ctype === "panel" || ctype === "terminal") {
    const currentStyle = (overrides[cid] && overrides[cid].style) || "";
    html += '<div class="field" style="margin-top:6px"><span class="label">Style</span><br>';
    html += '<select class="style-picker bf-input" onchange="applyStyleOverride(\'' + cid + '\', this.value)">';
    html += renderBoxStyleOptions(currentStyle, { originalLabel: '— original —' });
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
  const isAutoChild = _isAutolayoutChild(cid);
  if (isAutoChild) {
    html += '<p class="dg-inspector-note">Drag to reorder &#xb7; Shift+Enter to select parent &#xb7; W to toggle grid overlay.</p>';
  } else {
    html += '<p class="dg-inspector-note">Drag to move &#xb7; handles to resize (8px grid) &#xb7; W to toggle grid overlay.</p>';
  }
  inspector.innerHTML = html;
}

// ---- Override persistence ----

async function saveOverrides() {
  // Block save when error-severity constraint violations exist
  const summary = constraints.summarise(lastViolations);
  if (summary.errors > 0) {
    console.warn("Save blocked: " + summary.errors + " error-severity constraint violation(s)");
    alert("Cannot save: " + summary.errors + " constraint error(s) must be resolved first.");
    return;
  }
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
  const clearIds = [cid];
  const clearBefore = _captureOverrideEntries(clearIds);
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
  commitOverridePatchAction("Clear override", clearBefore, _captureOverrideEntries(clearIds));
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
    el.style.color = overrides[el.textContent] ? UI_AUTHORING_ACCENT : "";
  });
}

function _downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function _currentSvgFilename() {
  const baseSlug = SLUG.replace(/^v3:/, "");
  if (ENGINE === "v3") return baseSlug + "-onbrand-v3.svg";
  const suffix = GRID ? `-${ENGINE}-grid.svg` : `-${ENGINE}.svg`;
  return baseSlug + "-onbrand" + suffix;
}

function saveCurrentSvg() {
  const svg = document.querySelector("#stage svg");
  if (!svg) {
    alert("No SVG is loaded.");
    return;
  }
  const clone = svg.cloneNode(true);
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  const serialized = new XMLSerializer().serializeToString(clone);
  const prolog = serialized.startsWith("<?xml") ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n';
  _downloadTextFile(_currentSvgFilename(), prolog + serialized + "\n", "image/svg+xml;charset=utf-8");
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
  navigator.clipboard.writeText(lines.join("\n")).then(() => alert("Copied to clipboard."));
});

document.getElementById("btn-save-svg").addEventListener("click", saveCurrentSvg);

function setDirty(dirty) {
  isDirty = dirty;
  const saveBtn = document.getElementById("btn-save");
  const hasErrors = constraints.summarise(lastViolations).errors > 0;
  saveBtn.disabled = !dirty || hasErrors;
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
  runUndoableAction("Clear all overrides", () => {
    overrides = {};
    _coercedKeys.clear();
    setDirty(true);
  });
  applyAllOverrides();
  renderSelectionInspector();
});

// Keyboard shortcuts: Ctrl+S to save, Ctrl+Z to undo, Ctrl+Shift+Z/Ctrl+Y to redo, arrows to nudge
document.addEventListener("keydown", (e) => {
  // Alt+1 / Alt+2: toggle left / right sidebars
  if (e.altKey && (e.key === "1" || e.key === "2") && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const app = document.querySelector(".dg-preview-app");
    if (!app) return;
    app.classList.toggle(e.key === "1" ? "is-nav-hidden" : "is-aside-hidden");
    return;
  }
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
  } else if (e.key === "Enter" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
             selectedIds.size > 0 && !mgr.isMode(InteractionMode.TEXT_EDITING)) {
    // Shift+Enter: navigate to parent
    e.preventDefault();
    const primary = [...selectedIds][0];
    const parent = getParentNode(primary);
    if (parent) {
      selectComponent(parent.id);
    }
  } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
             selectedIds.size === 1 && !mgr.isMode(InteractionMode.TEXT_EDITING)) {
    // Enter: select all children of the selected frame
    e.preventDefault();
    const primary = [...selectedIds][0];
    const node = model.get(primary);
    if (node && node.children && node.children.length > 0) {
      const childIds = node.children.map(n => n.data.id);
      selectedIds.clear();
      childIds.forEach(id => selectedIds.add(id));
      selectionDepth = getAncestors(childIds[0]).length;
      reapplySelection();
    }
  } else if (selectedIds.size > 0 && !mgr.isMode(InteractionMode.TEXT_EDITING) &&
             !e.ctrlKey && !e.metaKey && !e.altKey &&
             ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    // Skip nudge for autolayout children — position is engine-controlled
    const anyAutolayout = [...selectedIds].some(id => _isAutolayoutChild(id));
    if (anyAutolayout) return;
    e.preventDefault();
    const step = e.shiftKey ? 24 : 8;
    const nudgeIds = [...selectedIds];
    const nudgeBefore = _captureOverrideEntries(nudgeIds);
    selectedIds.forEach(id => {
      const own = getOwnDelta(id);
      let dx = own.dx, dy = own.dy;
      if (e.key === "ArrowUp") dy -= step;
      else if (e.key === "ArrowDown") dy += step;
      else if (e.key === "ArrowLeft") dx -= step;
      else if (e.key === "ArrowRight") dx += step;
      setOverride(id, { dx, dy });
    });
    commitOverridePatchAction("Nudge selection", nudgeBefore, _captureOverrideEntries(nudgeIds));
    applyAllOverrides();
    const primary = [...selectedIds].pop();
    if (primary) showResizeHandles(primary);
    renderSelectionInspector(primary);
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
  // Keep save button in sync with error state
  const saveBtn = document.getElementById("btn-save");
  if (saveBtn) saveBtn.disabled = !isDirty || summary.errors > 0;
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

function resolveShellCssLengthPx(context, cssValue, fallbackPx) {
  const trimmedValue = typeof cssValue === "string" ? cssValue.trim() : "";
  if (!trimmedValue) {
    return fallbackPx;
  }

  const probe = context.ownerDocument.createElement("div");
  probe.style.border = "0";
  probe.style.inlineSize = trimmedValue;
  probe.style.margin = "0";
  probe.style.opacity = "0";
  probe.style.padding = "0";
  probe.style.pointerEvents = "none";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  context.appendChild(probe);
  const resolvedPx = probe.getBoundingClientRect().width;
  probe.remove();

  return Number.isFinite(resolvedPx) && resolvedPx > 0 ? resolvedPx : fallbackPx;
}

function shellWidthToRem(context, widthPx) {
  const rootFontSizePx = Number.parseFloat(getComputedStyle(context.ownerDocument.documentElement).fontSize || "16");
  const safeRootFontSizePx = Number.isFinite(rootFontSizePx) && rootFontSizePx > 0 ? rootFontSizePx : 16;
  const widthRem = Math.round((widthPx / safeRootFontSizePx) * 1000) / 1000;
  return `${widthRem}rem`;
}

function clampShellWidth(value, minPx, maxPx) {
  return Math.max(minPx, Math.min(maxPx, value));
}

function readShellWidth(application, storageKey) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const trimmedValue = rawValue.trim();
    const parsedWidth = Number.parseFloat(trimmedValue);
    if (!Number.isFinite(parsedWidth)) {
      return null;
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
      return parsedWidth;
    }

    const resolvedWidthPx = resolveShellCssLengthPx(application, trimmedValue, -1);
    return Number.isFinite(resolvedWidthPx) && resolvedWidthPx > 0 ? resolvedWidthPx : null;
  } catch {
    return null;
  }
}

function writeShellWidth(application, storageKey, widthPx) {
  try {
    window.localStorage.setItem(storageKey, shellWidthToRem(application, widthPx));
  } catch {
    // Ignore storage failures so resizing still works for the current session.
  }
}

function clearShellWidth(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures so reset still works visually.
  }
}

function bindShellResize({
  application,
  panel,
  handle,
  resizingClass,
  storageKey,
  widthProperty,
  legacyWidthProperty,
  minWidthProperty,
  maxWidthProperty,
  fallbackWidth,
  fallbackMinWidth,
  fallbackMaxWidth,
  isEnabled,
  measureWidth,
  pointerWidthFromEvent,
  ariaLabel,
}) {
  const documentRoot = application.ownerDocument.documentElement;

  function getBounds() {
    const computedStyle = getComputedStyle(application);
    const minPx = resolveShellCssLengthPx(
      application,
      computedStyle.getPropertyValue(minWidthProperty) || fallbackMinWidth,
      resolveShellCssLengthPx(application, fallbackMinWidth, 160)
    );
    const maxPx = resolveShellCssLengthPx(
      application,
      computedStyle.getPropertyValue(maxWidthProperty) || fallbackMaxWidth,
      resolveShellCssLengthPx(application, fallbackMaxWidth, 320)
    );

    return {
      minPx,
      maxPx: Math.max(minPx, maxPx)
    };
  }

  function getCurrentWidthPx() {
    const measuredWidth = measureWidth();
    if (measuredWidth > 0) {
      return measuredWidth;
    }

    const computedStyle = getComputedStyle(application);
    return resolveShellCssLengthPx(
      application,
      computedStyle.getPropertyValue(widthProperty)
        || computedStyle.getPropertyValue(legacyWidthProperty)
        || fallbackWidth,
      resolveShellCssLengthPx(application, fallbackWidth, 240)
    );
  }

  function updateHandleA11y(widthPx = getCurrentWidthPx()) {
    if (!handle.hasAttribute("role")) {
      handle.setAttribute("role", "separator");
    }

    if (!handle.hasAttribute("aria-orientation")) {
      handle.setAttribute("aria-orientation", "vertical");
    }

    if (!handle.hasAttribute("aria-label")) {
      handle.setAttribute("aria-label", ariaLabel);
    }

    const enabled = isEnabled();
    handle.setAttribute("aria-disabled", String(!enabled));
    handle.tabIndex = enabled ? 0 : -1;

    if (!enabled) {
      return;
    }

    const { minPx, maxPx } = getBounds();
    handle.setAttribute("aria-valuemin", String(Math.round(minPx)));
    handle.setAttribute("aria-valuemax", String(Math.round(maxPx)));
    handle.setAttribute("aria-valuenow", String(Math.round(clampShellWidth(widthPx, minPx, maxPx))));
  }

  function applyWidth(widthPx, persist) {
    const { minPx, maxPx } = getBounds();
    const nextWidthPx = clampShellWidth(widthPx, minPx, maxPx);
    const nextWidthCss = shellWidthToRem(documentRoot, nextWidthPx);
    application.style.setProperty(widthProperty, nextWidthCss);
    application.style.setProperty(legacyWidthProperty, nextWidthCss);
    updateHandleA11y(nextWidthPx);

    if (persist) {
      writeShellWidth(application, storageKey, nextWidthPx);
    }

    return nextWidthPx;
  }

  function resetWidth() {
    application.style.removeProperty(widthProperty);
    application.style.removeProperty(legacyWidthProperty);
    clearShellWidth(storageKey);
    updateHandleA11y();
  }

  const persistedWidth = readShellWidth(application, storageKey);
  if (persistedWidth !== null) {
    applyWidth(persistedWidth, false);
  } else {
    updateHandleA11y();
  }

  const onDoubleClick = () => {
    resetWidth();
  };

  const onKeyDown = (event) => {
    if (!isEnabled()) {
      return;
    }

    const currentWidthPx = getCurrentWidthPx();
    const stepPx = resolveShellCssLengthPx(application, "1rem", 16);
    const adjustedStepPx = event.shiftKey ? stepPx * 3 : stepPx;
    const { minPx, maxPx } = getBounds();

    if (event.key === "ArrowLeft") {
      applyWidth(currentWidthPx - adjustedStepPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight") {
      applyWidth(currentWidthPx + adjustedStepPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "Home") {
      applyWidth(minPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "End") {
      applyWidth(maxPx, true);
      event.preventDefault();
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isEnabled()) {
      return;
    }

    event.preventDefault();
    const shellRect = application.getBoundingClientRect();
    application.classList.add(resizingClass);
    handle.setPointerCapture(event.pointerId);
    let finished = false;

    const onPointerMove = (moveEvent) => {
      const nextWidthPx = pointerWidthFromEvent(shellRect, moveEvent);
      applyWidth(nextWidthPx, false);
    };

    const finishResize = () => {
      if (finished) {
        return;
      }

      finished = true;
      application.classList.remove(resizingClass);
      applyWidth(getCurrentWidthPx(), true);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", finishResize);
      handle.removeEventListener("pointercancel", finishResize);
      handle.removeEventListener("lostpointercapture", finishResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);

      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    };

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", finishResize, { once: true });
    handle.addEventListener("pointercancel", finishResize, { once: true });
    handle.addEventListener("lostpointercapture", finishResize, { once: true });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
  };

  const onWindowResize = () => {
    if (isEnabled()) {
      applyWidth(getCurrentWidthPx(), false);
      return;
    }

    updateHandleA11y();
  };

  handle.addEventListener("dblclick", onDoubleClick);
  handle.addEventListener("keydown", onKeyDown);
  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onWindowResize);

  return () => {
    handle.removeEventListener("dblclick", onDoubleClick);
    handle.removeEventListener("keydown", onKeyDown);
    handle.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("resize", onWindowResize);
  };
}

function initPreviewShell() {
  const application = document.querySelector(".dg-preview-app");
  const navigation = document.getElementById("dg-component-navigation");
  const navigationHandle = navigation?.querySelector(".bf-application-navigation-resize-handle");
  const aside = document.getElementById("dg-preview-aside");
  const asideHandle = aside?.querySelector(".bf-application-aside-resize-handle");
  const desktopMedia = window.matchMedia ? window.matchMedia("(min-width: 48rem)") : null;

  if (!(application instanceof HTMLElement)) {
    return () => {};
  }

  const teardowns = [];

  if (navigation instanceof HTMLElement && navigationHandle instanceof HTMLElement) {
    teardowns.push(bindShellResize({
      application,
      panel: navigation,
      handle: navigationHandle,
      resizingClass: "is-resizing-navigation",
      storageKey: "diagram-generator:preview-navigation-width",
      widthProperty: "--bf-application-navigation-width",
      legacyWidthProperty: "--bf-app-navigation-width",
      minWidthProperty: "--dg-component-nav-width-min",
      maxWidthProperty: "--dg-component-nav-width-max",
      fallbackWidth: "12rem",
      fallbackMinWidth: "10rem",
      fallbackMaxWidth: "16rem",
      isEnabled: () => !navigation.classList.contains("is-collapsed") && (desktopMedia ? desktopMedia.matches : true),
      measureWidth: () => navigation.getBoundingClientRect().width,
      pointerWidthFromEvent: (shellRect, moveEvent) => moveEvent.clientX - shellRect.left,
      ariaLabel: "Resize components panel",
    }));
  }

  if (aside instanceof HTMLElement && asideHandle instanceof HTMLElement) {
    teardowns.push(bindShellResize({
      application,
      panel: aside,
      handle: asideHandle,
      resizingClass: "is-resizing-aside",
      storageKey: "diagram-generator:preview-aside-width",
      widthProperty: "--bf-application-aside-width",
      legacyWidthProperty: "--bf-app-aside-width",
      minWidthProperty: "--dg-preview-aside-width-min",
      maxWidthProperty: "--dg-preview-aside-width-max",
      fallbackWidth: "22rem",
      fallbackMinWidth: "18rem",
      fallbackMaxWidth: "36rem",
      isEnabled: () => !aside.classList.contains("is-collapsed") && !aside.classList.contains("is-overlay") && !aside.classList.contains("is-drawer"),
      measureWidth: () => aside.getBoundingClientRect().width,
      pointerWidthFromEvent: (shellRect, moveEvent) => shellRect.right - moveEvent.clientX,
      ariaLabel: "Resize inspector panel",
    }));
  }

  return () => {
    teardowns.forEach((teardown) => teardown());
  };
}

function initDiagramPicker() {
  const picker = document.getElementById("diagram-picker");
  if (!(picker instanceof HTMLSelectElement)) {
    return;
  }

  const currentPath = window.location.pathname;

  async function populateDiagramOptions() {
    if (picker.options.length > 0) {
      picker.value = currentPath;
      return;
    }

    try {
      const response = await fetch("/", { credentials: "same-origin" });
      if (!response.ok) {
        return;
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const viewLinks = Array.from(doc.querySelectorAll('a[href^="/view/"], a[href^="/force/view/"]'));
      const seen = new Set();

      viewLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || seen.has(href)) {
          return;
        }
        seen.add(href);
        const option = document.createElement("option");
        option.value = href;
        option.textContent = link.textContent?.trim() || href.replace("/view/", "").replace("/force/view/", "");
        picker.append(option);
      });

      picker.value = currentPath;
    } catch {
      // Leave the picker empty if the index cannot be fetched.
    }
  }

  picker.addEventListener("change", () => {
    const nextUrl = picker.value;
    if (nextUrl && nextUrl !== window.location.pathname) {
      window.location.assign(nextUrl);
    }
  });

  const prevBtn = document.getElementById("diagram-prev");
  const nextBtn = document.getElementById("diagram-next");

  function stepPicker(delta) {
    if (picker.options.length === 0) return;
    const idx = picker.selectedIndex + delta;
    if (idx < 0 || idx >= picker.options.length) return;
    picker.selectedIndex = idx;
    picker.dispatchEvent(new Event("change"));
  }

  if (prevBtn) prevBtn.addEventListener("click", () => stepPicker(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepPicker(1));

  void populateDiagramOptions();
}

initPreviewShell();
initDiagramPicker();
initNavTabs();
loadSVG();
connectSSE();

// ---- Input/output/both preview modes ----
(function initPreviewModes() {
  const hasReference = Boolean(window.__DG_CONFIG.has_reference);
  const stageShell = document.getElementById("stage-shell");
  const stageLayout = document.getElementById("stage-layout");
  const viewControls = document.getElementById("view-controls");
  const inputPane = document.getElementById("input-pane");
  const outputPane = document.getElementById("output-pane");
  const img = document.getElementById("reference-img");
  const tabs = Array.from(document.querySelectorAll(".dg-view-tab"));
  if (!stageShell || !stageLayout || !viewControls || !inputPane || !outputPane || !img || tabs.length === 0) return;

  const setViewMode = (mode) => {
    const nextMode = ["input", "output", "both"].includes(mode) ? mode : "output";
    stageShell.dataset.viewMode = nextMode;
    // Let CSS data-attribute selector handle grid columns — no inline style needed.
    tabs.forEach((tab) => {
      const isActive = tab.dataset.viewMode === nextMode;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
  };

  // Always show the tab bar — it's a global editor feature.
  viewControls.hidden = false;

  if (hasReference) {
    img.src = "/reference/" + SLUG;
  } else {
    // No reference sketch — show placeholder in input pane.
    img.alt = "No reference sketch available";
    img.removeAttribute("src");
    const wrap = img.closest(".dg-reference-img-wrap");
    if (wrap) {
      wrap.innerHTML = '<p class="dg-empty-message">No reference sketch for this diagram.</p>';
    }
  }

  // ---- Horizontal / vertical split toggle ----
  const splitToggle = document.getElementById("split-toggle");
  const setSplitDirection = (dir) => {
    const next = dir === "vertical" ? "vertical" : "horizontal";
    stageShell.dataset.splitDirection = next;
    splitToggle.setAttribute("aria-label",
      next === "horizontal" ? "Switch to vertical split" : "Switch to horizontal split");
    splitToggle.title = splitToggle.getAttribute("aria-label");
  };

  const origSetViewMode = setViewMode;
  const setViewModeWithToggle = (mode) => {
    origSetViewMode(mode);
    if (splitToggle) splitToggle.style.display = mode === "both" ? "" : "none";
  };

  if (splitToggle) {
    splitToggle.addEventListener("click", () => {
      const current = stageShell.dataset.splitDirection || "vertical";
      const next = current === "horizontal" ? "vertical" : "horizontal";
      setSplitDirection(next);
      try { localStorage.setItem("diagram-generator:split-direction", next); } catch {}
    });
    const savedSplit = (() => { try { return localStorage.getItem("diagram-generator:split-direction"); } catch { return null; } })();
    setSplitDirection(savedSplit || "vertical");
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.viewMode || "output";
      setViewModeWithToggle(mode);
      try { localStorage.setItem("diagram-generator:view-mode", mode); } catch {}
    });
  });
  const savedMode = (() => { try { return localStorage.getItem("diagram-generator:view-mode"); } catch { return null; } })();
  setViewModeWithToggle(savedMode || "output");
})();

// ---- Left sidebar tabs (Browse / Layers) ----
// Handled by initNavTabs() in editor-base.js via initPreviewShell().
