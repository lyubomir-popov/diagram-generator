const FORCE_CONFIG = window.__DG_FORCE_CONFIG || {};
const FORCE_SLUG = FORCE_CONFIG.slug;

/** Control metadata from the TS preview-engine registry (spec 025). */
function forcePreviewEngine() {
  return window.LayoutEngine?.getPreviewEngine?.("force") ?? null;
}

function forceParamSpec(key) {
  const specs = forcePreviewEngine()?.controlSpecs;
  if (!Array.isArray(specs)) return null;
  return specs.find((spec) => spec.key === key) ?? null;
}

function forceApiPath(routeKey, fallbackPath) {
  const template = forcePreviewEngine()?.apiRoutes?.[routeKey];
  if (typeof template !== "string" || !template) {
    return fallbackPath;
  }
  return template.replace("{slug}", encodeURIComponent(FORCE_SLUG));
}

const INSET = Number(FORCE_CONFIG.inset || 8);
const BODY_LINE_STEP = Number(FORCE_CONFIG.body_line_step || 24);
const HEAD_LEN = Number(FORCE_CONFIG.head_len || 10.8408);
const HEAD_HALF = Number(FORCE_CONFIG.head_half || 2.9053);
const DEFAULT_CURVE_HANDLE_RATIO = 0.35;
const DEFAULT_CURVE_HANDLE_MIN = 24;
const DEFAULT_CURVE_HANDLE_MAX = 72;
const DRAG_THRESHOLD = 4;
// HANDLE_SIZE and MIN_NODE_SIZE now shared via editor-base.js
// (SHARED_HANDLE_SIZE, SHARED_MIN_NODE_SIZE)
const BOX_STYLES = window.__DG_BOX_STYLES || {
  default: { fill: "#FFFFFF", text: "#000000", icon: "#000000", label: "Default (white)" },
  accent: { fill: "#F3F3F3", text: "#000000", icon: "#000000", label: "Accent (grey)" },
  highlight: { fill: "#000000", text: "#FFFFFF", icon: "#FFFFFF", label: "Highlight (black)" },
};
const boxStyleLabel = window.__DG_boxStyleLabel || ((styleName) => BOX_STYLES[styleName]?.label || "Original");
const boxStyleOptionsHtml = window.__DG_boxStyleOptionsHtml || function boxStyleOptionsHtml(selectedValue, options = {}) {
  const current = selectedValue == null ? "" : String(selectedValue);
  const originalLabel = options.originalLabel || "— original —";
  let html = `<option value=""${current === "" ? " selected" : ""}>${escapeHtml(originalLabel)}</option>`;
  for (const [key, preset] of Object.entries(BOX_STYLES)) {
    html += `<option value="${escapeHtml(key)}"${current === key ? " selected" : ""}>${escapeHtml(preset.label)}</option>`;
  }
  return html;
};

let currentSnapshot = null;
let committedSnapshot = null;
let running = false;
let inFlight = false;
let localRuntimeOnly = false;
let selectedIds = new Set();
let dragCandidate = null;
let dragState = null;
let resizeState = null;
let suppressStageClick = false;
let forceSaveDirty = false;
const EMPTY_SELECTION_HTML = '<p class="dg-empty-message bf-form-help">Select or drag a node from the stage or the left rail. Dragging drops it into a pinned manual-polish position.</p>';

function canUseLocalForceRuntime() {
  return Boolean(window.LayoutEngine && typeof window.LayoutEngine.createInitialForceSnapshot === "function");
}

function isForceBackendUnavailable(error) {
  const message = String(error?.message || error || "");
  return message.includes("Force layout backend is not available");
}

async function loadLocalForceSnapshot() {
  if (!canUseLocalForceRuntime()) {
    throw new Error("Local TS force runtime is unavailable");
  }
  const spec = await fetchJson(forceApiPath("spec", `/api/force-spec/${encodeURIComponent(FORCE_SLUG)}`));
  localRuntimeOnly = true;
  return window.LayoutEngine.createInitialForceSnapshot(spec);
}

function applyForceParamMetadata() {
  const container = document.getElementById("force-params");
  if (!container) return;
  for (const input of container.querySelectorAll("[data-force-param]")) {
    const key = input.getAttribute("data-force-param");
    const spec = key ? forceParamSpec(key) : null;
    if (!spec) continue;
    if (spec.min != null) input.setAttribute("min", String(spec.min));
    if (spec.max != null) input.setAttribute("max", String(spec.max));
    if (spec.step != null) input.setAttribute("step", String(spec.step));
    if (spec.defaultValue != null && !input.hasAttribute("value")) {
      input.setAttribute("value", String(spec.defaultValue));
    }
    const label = container.querySelector(`label[for="${input.id}"]`);
    if (label && spec.label) {
      label.textContent = spec.label;
    }
  }
}

function updateLocalRuntimeControls() {
  byId("btn-play").disabled = false;
  byId("btn-step").disabled = false;
  byId("btn-force-save").disabled = !(forceUndoManager.isDirty() || forceSaveDirty);
  const container = document.getElementById("force-params");
  if (!container) return;
  const canEditLocalParams = !localRuntimeOnly || Boolean(
    window.LayoutEngine && typeof window.LayoutEngine.updateForceSimulationParams === "function"
  );
  for (const input of container.querySelectorAll("input")) {
    input.disabled = !canEditLocalParams;
  }
}

// ---- Undo/Redo via shared UndoRedoManager ----

function captureNodeState(nodeId) {
  if (!currentSnapshot) return null;
  const node = currentSnapshot.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  return {
    nodeId,
    x: node.x,
    y: node.y,
    fx: node.fx,
    fy: node.fy,
    width: node.width,
    height: node.height,
    style: node.style_override != null ? node.style_override : null,
    pinned: node.fx != null,
  };
}

async function applyNodeState(state) {
  const patch = {
    x: state.x,
    y: state.y,
    pinned: state.pinned,
  };
  if (state.width != null) patch.width = state.width;
  if (state.height != null) patch.height = state.height;
  if (state.style !== undefined) patch.style = state.style;
  await updateForceNode(state.nodeId, patch);
}

const forceUndoManager = new UndoRedoManager({
  maxSize: 50,
  undoBtnId: "btn-force-undo",
  redoBtnId: "btn-force-redo",
  saveBtnId: "btn-force-save",
  onRestore: async (state, direction) => {
    try {
      await applyNodeState(state);
    } catch (err) {
      setStatus(err.message || `${direction} failed`, "error");
      throw err;
    }
  },
});

function pushForceUndo(label, before, after) {
  if (!before || !after) return;
  forceUndoManager.push(label, before, after);
  updateLocalRuntimeControls();
}

async function performForceUndo() {
  const label = await forceUndoManager.undo();
  updateLocalRuntimeControls();
  if (label) setStatus(`Undo: ${label}`, "ok");
}

async function performForceRedo() {
  const label = await forceUndoManager.redo();
  updateLocalRuntimeControls();
  if (label) setStatus(`Redo: ${label}`, "ok");
}

// Utilities come from editor-base.js (byId, escapeHtml, fetchJson, setStatus,
// getStageSvg, pointerToSvgPoint, setViewMode).  Keep thin local wrappers
// where the old force API differs from the base.

function pointerToStagePoint(event) {
  return pointerToSvgPoint(event);
}

function currentTicksPerFrame() {
  const raw = Number(byId("ticks-per-frame").value);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(32, Math.floor(raw));
  }
  return committedSnapshot?.simulation?.ticks_per_frame || currentSnapshot?.simulation?.ticks_per_frame || 4;
}

// setViewMode, getStageSvg come from editor-base.js

function updateRunButton() {
  byId("btn-play").textContent = running ? "Pause" : "Run";
}

function isNodePinned(node) {
  return node.fx != null || node.fy != null;
}

function clampNodePosition(snapshot, node, x, y) {
  const minX = node.width / 2;
  const maxX = snapshot.canvas.width - node.width / 2;
  const minY = node.height / 2;
  const maxY = snapshot.canvas.height - node.height / 2;
  return {
    x: maxX < minX ? snapshot.canvas.width / 2 : Math.max(minX, Math.min(maxX, x)),
    y: maxY < minY ? snapshot.canvas.height / 2 : Math.max(minY, Math.min(maxY, y)),
  };
}

function previewDraggedSnapshot(snapshot, nodeId, x, y) {
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node) => (node.id === nodeId ? { ...node, x, y, fx: x, fy: y } : node)),
  };
}

function previewResizedSnapshot(snapshot, nodeId, x, y, width, height) {
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node) =>
      node.id === nodeId ? { ...node, x, y, fx: x, fy: y, width, height } : node
    ),
  };
}

// ---- Resize handles ----

function showForceResizeHandles(nodeId) {
  const svg = getStageSvg();
  if (!svg || !currentSnapshot) return;
  clearForceResizeHandles();

  const node = currentSnapshot.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const left = node.x - node.width / 2;
  const top = node.y - node.height / 2;
  const right = left + node.width;
  const bottom = top + node.height;

  renderResizeHandles(svg, left, top, right, bottom, nodeId, {
    handleClass: "dg-force-handle",
    nodeAttr: "data-resize-node",
    dirAttr: "data-resize-dir",
  });
}

function clearForceResizeHandles() {
  clearHandlesByClass("dg-force-handle");
}

function startForceResize(event, handleEl) {
  if (!currentSnapshot) return;

  const nodeId = handleEl.dataset.resizeNode;
  const dir = handleEl.dataset.resizeDir;
  const node = currentSnapshot.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  if (running) {
    running = false;
    updateRunButton();
  }

  const point = pointerToStagePoint(event);
  if (!point) return;

  resizeState = {
    nodeId,
    dir,
    startSvgX: point.x,
    startSvgY: point.y,
    origX: node.x,
    origY: node.y,
    origW: node.width,
    origH: node.height,
    undoBefore: captureNodeState(nodeId),
  };
  selectedIds = new Set([nodeId]);
  event.preventDefault();
  event.stopPropagation();
}

function updateForceResize(event) {
  if (!resizeState || !currentSnapshot) return;

  const point = pointerToStagePoint(event);
  if (!point) return;

  const dx = point.x - resizeState.startSvgX;
  const dy = point.y - resizeState.startSvgY;
  const dir = resizeState.dir;

  let newW = resizeState.origW;
  let newH = resizeState.origH;
  let newX = resizeState.origX;
  let newY = resizeState.origY;

  // Horizontal component
  if (dir.includes("r")) {
    newW = Math.max(SHARED_MIN_NODE_SIZE, resizeState.origW + dx);
  } else if (dir.includes("l")) {
    newW = Math.max(SHARED_MIN_NODE_SIZE, resizeState.origW - dx);
  }

  // Vertical component
  if (dir.includes("b")) {
    newH = Math.max(SHARED_MIN_NODE_SIZE, resizeState.origH + dy);
  } else if (dir === "t" || dir === "tl" || dir === "tr") {
    newH = Math.max(SHARED_MIN_NODE_SIZE, resizeState.origH - dy);
  }

  // Snap dimensions to grid
  newW = Math.round(newW / BASELINE_STEP) * BASELINE_STEP;
  newH = Math.round(newH / BASELINE_STEP) * BASELINE_STEP;
  newW = Math.max(SHARED_MIN_NODE_SIZE, newW);
  newH = Math.max(SHARED_MIN_NODE_SIZE, newH);

  // Adjust center position based on which edge moved
  const dw = newW - resizeState.origW;
  const dh = newH - resizeState.origH;

  if (dir.includes("r") && !dir.includes("l")) {
    newX = resizeState.origX + dw / 2;
  } else if (dir.includes("l") && !dir.includes("r")) {
    newX = resizeState.origX - dw / 2;
  }

  if (dir.includes("b") && !dir.includes("t")) {
    newY = resizeState.origY + dh / 2;
  } else if (dir.includes("t") && !dir.includes("b")) {
    newY = resizeState.origY - dh / 2;
  }

  render(previewResizedSnapshot(currentSnapshot, resizeState.nodeId, newX, newY, newW, newH), { previewOnly: true });
  showForceResizeHandles(resizeState.nodeId);
  setStatus(`Resizing ${newW}×${newH}`, "ok");
}

async function finishForceResize(event) {
  if (!resizeState || !currentSnapshot) return;

  const activeResize = resizeState;
  resizeState = null;
  suppressStageClick = true;

  const point = pointerToStagePoint(event);
  if (!point) return;

  const dx = point.x - activeResize.startSvgX;
  const dy = point.y - activeResize.startSvgY;
  const dir = activeResize.dir;

  let newW = activeResize.origW;
  let newH = activeResize.origH;

  if (dir.includes("r")) newW = activeResize.origW + dx;
  else if (dir.includes("l")) newW = activeResize.origW - dx;

  if (dir.includes("b")) newH = activeResize.origH + dy;
  else if (dir === "t" || dir === "tl" || dir === "tr") newH = activeResize.origH - dy;

  newW = Math.round(newW / BASELINE_STEP) * BASELINE_STEP;
  newH = Math.round(newH / BASELINE_STEP) * BASELINE_STEP;
  newW = Math.max(SHARED_MIN_NODE_SIZE, newW);
  newH = Math.max(SHARED_MIN_NODE_SIZE, newH);

  const dw = newW - activeResize.origW;
  const dh = newH - activeResize.origH;
  let newX = activeResize.origX;
  let newY = activeResize.origY;

  if (dir.includes("r") && !dir.includes("l")) newX += dw / 2;
  else if (dir.includes("l") && !dir.includes("r")) newX -= dw / 2;

  if (dir.includes("b") && !dir.includes("t")) newY += dh / 2;
  else if (dir.includes("t") && !dir.includes("b")) newY -= dh / 2;

  try {
    await updateForceNode(activeResize.nodeId, {
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      pinned: true,
    });
    pushForceUndo("Resize", activeResize.undoBefore, captureNodeState(activeResize.nodeId));
    setStatus(`Resized to ${newW}×${newH}`, "ok");
    startRunning();
  } catch (error) {
    setStatus(error.message || "Resize failed", "error");
  }
}

function nodeLabelLines(node) {
  const labels = Array.isArray(node.label) ? node.label : [node.label || node.id];
  return labels.map((line) => (typeof line === "string" ? line : line?.text || ""));
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function curveConfig(link) {
  const render = currentSnapshot?.render || {};
  const linkRender = link?.render || {};
  return {
    handleRatio: numberOr(linkRender.curve_handle_ratio, numberOr(render.curve_handle_ratio, DEFAULT_CURVE_HANDLE_RATIO)),
    handleMin: numberOr(linkRender.curve_handle_min, numberOr(render.curve_handle_min, DEFAULT_CURVE_HANDLE_MIN)),
    handleMax: numberOr(linkRender.curve_handle_max, numberOr(render.curve_handle_max, DEFAULT_CURVE_HANDLE_MAX)),
  };
}

function sideCenter(node, axis, direction) {
  if (axis === "horizontal") {
    return {
      x: node.x + (direction >= 0 ? node.width / 2 : -node.width / 2),
      y: node.y,
    };
  }
  return {
    x: node.x,
    y: node.y + (direction >= 0 ? node.height / 2 : -node.height / 2),
  };
}

function cubicArrowGeometry(link, source, target) {
  const centerDx = target.x - source.x;
  const centerDy = target.y - source.y;
  const axis = Math.abs(centerDx) >= Math.abs(centerDy) ? "horizontal" : "vertical";
  const start = sideCenter(source, axis, axis === "horizontal" ? centerDx : centerDy);
  const end = sideCenter(target, axis, axis === "horizontal" ? -centerDx : -centerDy);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const direction = axis === "horizontal"
    ? (Math.abs(dx) > 1e-6 ? Math.sign(dx) : Math.sign(centerDx || 1))
    : (Math.abs(dy) > 1e-6 ? Math.sign(dy) : Math.sign(centerDy || 1));
  const primarySpan = axis === "horizontal" ? Math.abs(dx) : Math.abs(dy);
  const config = curveConfig(link);
  const unclampedHandle = primarySpan * config.handleRatio;
  const handleMin = Math.min(config.handleMin, primarySpan);
  const handleLength = Math.min(config.handleMax, Math.max(handleMin, unclampedHandle));

  let control1;
  let control2;
  if (axis === "horizontal") {
    control1 = {
      x: start.x + direction * handleLength,
      y: start.y,
    };
    control2 = {
      x: end.x - direction * handleLength,
      y: end.y,
    };
  } else {
    control1 = {
      x: start.x,
      y: start.y + direction * handleLength,
    };
    control2 = {
      x: end.x,
      y: end.y - direction * handleLength,
    };
  }

  const tangentX = end.x - control2.x;
  const tangentY = end.y - control2.y;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const ux = tangentX / tangentLength;
  const uy = tangentY / tangentLength;
  const shaftEnd = {
    x: end.x - HEAD_LEN * ux,
    y: end.y - HEAD_LEN * uy,
  };
  const shaftControl2 = {
    x: control2.x - HEAD_LEN * ux,
    y: control2.y - HEAD_LEN * uy,
  };
  const px = -uy * HEAD_HALF;
  const py = ux * HEAD_HALF;
  const points = [
    `${end.x.toFixed(1)},${end.y.toFixed(1)}`,
    `${(shaftEnd.x + px).toFixed(1)},${(shaftEnd.y + py).toFixed(1)}`,
    `${(shaftEnd.x - px).toFixed(1)},${(shaftEnd.y - py).toFixed(1)}`,
  ].join(" ");
  const path = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${control1.x.toFixed(1)} ${control1.y.toFixed(1)} ${shaftControl2.x.toFixed(1)} ${shaftControl2.y.toFixed(1)} ${shaftEnd.x.toFixed(1)} ${shaftEnd.y.toFixed(1)}`;
  return { path, points };
}

function buildLinkMarkup(link, nodesById) {
  const source = nodesById.get(link.source);
  const target = nodesById.get(link.target);
  if (!source || !target) {
    return "";
  }

  const geometry = cubicArrowGeometry(link, source, target);
  const color = link.stroke || "#E95420";
  const strokeWidth = Number(link.stroke_width || 1).toFixed(1);
  return `
    <g class="force-link" aria-hidden="true">
      <path d="${geometry.path}" fill="none" stroke="${escapeHtml(color)}" stroke-width="${strokeWidth}" stroke-linecap="square"></path>
      <polygon points="${geometry.points}" fill="${escapeHtml(color)}"></polygon>
    </g>`;
}

function buildNodeMarkup(node, isSelected) {
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const labels = nodeLabelLines(node);
  const textX = x + INSET;
  const textStartY = y + INSET + BODY_LINE_STEP / 2;
  const textMarkup = labels
    .map((label, index) => {
      const lineY = textStartY + index * BODY_LINE_STEP;
      return `<text x="${textX.toFixed(1)}" y="${lineY.toFixed(1)}" text-anchor="start" dominant-baseline="middle" font-family="Ubuntu Sans, sans-serif" font-size="18" font-weight="400" fill="${escapeHtml(node.text_fill)}">${escapeHtml(label)}</text>`;
    })
    .join("");

  return `
    <g ${isSelected ? 'class="dg-selected" ' : ""}data-component-id="${escapeHtml(node.id)}">
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${node.width.toFixed(1)}" height="${node.height.toFixed(1)}" fill="${escapeHtml(node.fill)}" stroke="${escapeHtml(node.stroke)}" stroke-width="${Number(node.stroke_width ?? 1).toFixed(1)}"></rect>
      ${textMarkup}
    </g>`;
}

function buildSvg(snapshot) {
  const width = snapshot.canvas.width;
  const height = snapshot.canvas.height;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const links = snapshot.links.map((link) => buildLinkMarkup(link, nodesById)).join("");
  const nodes = snapshot.nodes.map((node) => buildNodeMarkup(node, selectedIds.has(node.id))).join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="${escapeHtml(snapshot.title)}">
      <rect width="100%" height="100%" fill="#FFFFFF"></rect>
      <g class="force-links">${links}</g>
      <g class="force-nodes">${nodes}</g>
    </svg>`;
}

function renderTree(snapshot) {
  const tree = byId("tree-force");
  tree.innerHTML = snapshot.nodes
    .map((node) => {
      const selected = selectedIds.has(node.id) ? " selected" : "";
      const hasOverride = isNodePinned(node) || node.style_override != null;
      const overridden = hasOverride ? " overridden" : "";
      return `<div class="tree-item${selected}${overridden}" data-node-id="${escapeHtml(node.id)}">${escapeHtml(node.id)}</div>`;
    })
    .join("");
}

function renderSelection(snapshot) {
  const panel = byId("inspector");
  if (selectedIds.size === 0) {
    panel.innerHTML = EMPTY_SELECTION_HTML;
    return;
  }

  if (selectedIds.size > 1) {
    panel.innerHTML = `<div class="field"><div class="label">${selectedIds.size} nodes selected</div></div>`;
    return;
  }

  const singleId = [...selectedIds][0];
  const node = snapshot.nodes.find((candidate) => candidate.id === singleId);
  if (!node) {
    selectedIds.clear();
    panel.innerHTML = EMPTY_SELECTION_HTML;
    return;
  }

  panel.innerHTML = `
    <div class="field">
      <div class="label">Node</div>
      <div class="value">${escapeHtml(node.id)}</div>
    </div>
    <div class="field">
      <span class="label">Style</span>
      <select class="style-picker bf-input" data-force-style-select="${escapeHtml(node.id)}">
        ${boxStyleOptionsHtml(node.style_override || "", {
          originalLabel: node.base_style ? `— original (${boxStyleLabel(node.base_style)}) —` : "— original —",
        })}
      </select>
    </div>
    <div class="field">
      <span class="label">Actions</span>
      <div class="bf-cluster dg-button-row">
        <button class="btn bf-button is-base" type="button" data-force-pin-toggle="${escapeHtml(node.id)}">${isNodePinned(node) ? "Unpin" : "Pin here"}</button>
      </div>
    </div>`;
}

function updateSummary(snapshot) {
  const settled = snapshot.simulation.settled ? "settled" : "live";
  if (localRuntimeOnly) {
    byId("force-summary").textContent = `TS local runtime. alpha ${snapshot.simulation.alpha.toFixed(3)} • ${snapshot.simulation.tick_count} ticks • ${settled}. Export snaps positions to the 8px grid; Save writes the current defaults and node state to YAML.`;
    return;
  }
  byId("force-summary").textContent = `alpha ${snapshot.simulation.alpha.toFixed(3)} • ${snapshot.simulation.tick_count} ticks • ${settled}. Export snaps positions to the 8px grid.`;
}

async function updateForceNode(nodeId, patch) {
  const shouldResumeSimulation = patch.x != null || patch.y != null || patch.width != null || patch.height != null || patch.pinned != null;
  const shouldImmediateTick = patch.pinned === false;
  if (localRuntimeOnly) {
    if (!committedSnapshot) {
      throw new Error("Force snapshot is not loaded");
    }
    let snapshot = window.LayoutEngine.applyForceNodePatch(committedSnapshot, nodeId, patch);
    render(snapshot);
    if (shouldImmediateTick && !inFlight && !snapshot.simulation.settled) {
      snapshot = window.LayoutEngine.tickForceSimulation(committedSnapshot, 1);
      render(snapshot);
    }
    if (shouldResumeSimulation && !running) {
      startRunning();
    }
    updateLocalRuntimeControls();
    return snapshot;
  }
  let snapshot = await fetchJson(`/api/force-node/${encodeURIComponent(FORCE_SLUG)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, ...patch }),
  });
  render(snapshot);
  if (shouldImmediateTick && !inFlight && !snapshot.simulation.settled) {
    snapshot = await tickSimulation(1);
  }
  if (shouldResumeSimulation && !running) {
    startRunning();
  }
  return snapshot;
}

/**
 * Collect snap targets for a force node being dragged.
 * Uses shared collectPeerSnapTargets() from editor-base.js.
 * Force nodes are center-positioned, so rects use x - w/2, y - h/2.
 */
function collectForceSnapTargets(dragNodeId) {
  if (!currentSnapshot) return { xs: [], ys: [] };
  const peers = currentSnapshot.nodes
    .filter(n => n.id !== dragNodeId)
    .map(n => ({
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    }));
  return collectPeerSnapTargets(peers);
}

/**
 * Snap a force node's center position to peer edges within SHARED_SNAP_THRESHOLD.
 * Returns adjusted { x, y } and guide lines array.
 */
function snapForcePosition(nodeId, cx, cy, w, h, targets) {
  const left = cx - w / 2;
  const top = cy - h / 2;
  const right = cx + w / 2;
  const bottom = cy + h / 2;

  const snap = snapRectToTargets(left, top, right, bottom, targets);
  return { x: cx + snap.adjX, y: cy + snap.adjY, lines: snap.lines };
}

function startDragPreview(candidate) {
  if (!currentSnapshot) {
    return;
  }
  const node = currentSnapshot.nodes.find((candidateNode) => candidateNode.id === candidate.nodeId);
  if (!node) {
    dragCandidate = null;
    return;
  }

  if (running) {
    running = false;
    updateRunButton();
  }

  dragState = {
    nodeId: candidate.nodeId,
    offsetX: candidate.nodeX - candidate.startSvgX,
    offsetY: candidate.nodeY - candidate.startSvgY,
    snapTargets: collectForceSnapTargets(candidate.nodeId),
    undoBefore: captureNodeState(candidate.nodeId),
  };
  dragCandidate = null;
  selectedIds = new Set([candidate.nodeId]);
  render(previewDraggedSnapshot(currentSnapshot, candidate.nodeId, node.x, node.y), { previewOnly: true });
  setStatus("Dragging…", "ok");
}

function updateDragPreview(event) {
  if (!dragState || !currentSnapshot) {
    return;
  }
  const point = pointerToStagePoint(event);
  if (!point) {
    return;
  }
  const node = currentSnapshot.nodes.find((candidateNode) => candidateNode.id === dragState.nodeId);
  if (!node) {
    return;
  }
  const clamped = clampNodePosition(currentSnapshot, node, point.x + dragState.offsetX, point.y + dragState.offsetY);

  // Snap to peer edges
  const snap = snapForcePosition(
    dragState.nodeId, clamped.x, clamped.y,
    node.width, node.height, dragState.snapTargets
  );

  render(previewDraggedSnapshot(currentSnapshot, dragState.nodeId, snap.x, snap.y), { previewOnly: true });

  // Render guide lines after render() rebuilds the SVG
  if (snap.lines.length > 0) {
    renderGuideLines(snap.lines);
  } else {
    clearGuideLines();
  }

  setStatus("Dragging…", "ok");
}

async function finishDrag(event) {
  if (!dragState || !currentSnapshot) {
    return;
  }

  const activeDrag = dragState;
  dragState = null;
  suppressStageClick = true;
  clearGuideLines();

  const node = currentSnapshot.nodes.find((candidateNode) => candidateNode.id === activeDrag.nodeId);
  if (!node) {
    return;
  }

  let finalX = node.x;
  let finalY = node.y;
  const point = pointerToStagePoint(event);
  if (point) {
    const clamped = clampNodePosition(currentSnapshot, node, point.x + activeDrag.offsetX, point.y + activeDrag.offsetY);
    const snap = snapForcePosition(
      activeDrag.nodeId, clamped.x, clamped.y,
      node.width, node.height, activeDrag.snapTargets
    );
    finalX = snap.x;
    finalY = snap.y;
  }

  try {
    await updateForceNode(activeDrag.nodeId, { x: finalX, y: finalY, pinned: true });
    const afterState = captureNodeState(activeDrag.nodeId);
    pushForceUndo("Move", activeDrag.undoBefore, afterState);
    setStatus("Dropped and pinned", "ok");
    startRunning();
  } catch (error) {
    setStatus(error.message || "Drag update failed", "error");
  }
}

function ensureReferenceImage() {
  const image = byId("reference-img");
  if (image.dataset.initialized) {
    return;
  }
  image.dataset.initialized = "true";
  image.onerror = () => {
    byId("view-tab-input").disabled = true;
    byId("view-tab-both").disabled = true;
    setViewMode("output");
    byId("force-reference-wrap").innerHTML = '<p class="dg-empty-message bf-form-help">No tracked source image is mapped for this force example.</p>';
  };
  image.src = `/reference/${encodeURIComponent(FORCE_SLUG)}`;
}

function render(snapshot, options = {}) {
  const { previewOnly = false } = options;
  currentSnapshot = snapshot;
  if (!previewOnly) {
    committedSnapshot = snapshot;
  }
  document.title = `${snapshot.title} – force preview`;
  if (snapshot.simulation.tick_count === 0) {
    byId("ticks-per-frame").value = String(snapshot.simulation.ticks_per_frame);
  }
  // Remove stale selections
  for (const id of [...selectedIds]) {
    if (!snapshot.nodes.some((node) => node.id === id)) selectedIds.delete(id);
  }
  byId("stage").innerHTML = buildSvg(snapshot);
  renderTree(snapshot);
  renderSelection(snapshot);
  updateSummary(snapshot);
  updateSimulationParams(snapshot);
  ensureReferenceImage();

  // Show resize handles on the single selected node (unless dragging)
  if (selectedIds.size === 1 && !dragState && !resizeState) {
    showForceResizeHandles([...selectedIds][0]);
  }

  if (dragState) {
    setStatus("Dragging…", "ok");
  } else if (snapshot.simulation.settled) {
    setStatus("Settled", "ok");
  } else if (running) {
    setStatus("Running…", "ok");
  } else if (localRuntimeOnly) {
    setStatus("TS local snapshot", "ok");
  } else {
    setStatus("Paused", "ok");
  }

  // Stale-definition warning
  const staleEl = document.getElementById("stale-definition-warning");
  if (staleEl) {
    staleEl.style.display = snapshot.definition_stale ? "block" : "none";
  }

  updateLocalRuntimeControls();
}

async function loadSnapshot(reset = true) {
  let snapshot;
  if (localRuntimeOnly || canUseLocalForceRuntime()) {
    snapshot = await loadLocalForceSnapshot();
  } else {
    const url = reset
      ? forceApiPath("reset", `/api/force-reset/${encodeURIComponent(FORCE_SLUG)}`)
      : `/api/force/${encodeURIComponent(FORCE_SLUG)}`;
    const options = reset
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      : undefined;
    try {
      snapshot = await fetchJson(url, options);
    } catch (error) {
      if (!isForceBackendUnavailable(error)) {
        throw error;
      }
      snapshot = await loadLocalForceSnapshot();
    }
  }
  render(snapshot);
  forceSaveDirty = false;
  updateLocalRuntimeControls();
}

async function tickSimulation(iterations) {
  if (localRuntimeOnly) {
    if (!committedSnapshot) {
      throw new Error("Force snapshot is not loaded");
    }
    const snapshot = window.LayoutEngine.tickForceSimulation(committedSnapshot, iterations);
    render(snapshot);
    return snapshot;
  }
  const snapshot = await fetchJson(forceApiPath("tick", `/api/force-tick/${encodeURIComponent(FORCE_SLUG)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iterations }),
  });
  render(snapshot);
  return snapshot;
}

function downloadBlob(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportJson() {
  const snapshot = localRuntimeOnly
    ? window.LayoutEngine.exportForceSnapshot(committedSnapshot)
    : await fetchJson(forceApiPath("export", `/api/force-export/${encodeURIComponent(FORCE_SLUG)}`));
  if (!snapshot) {
    throw new Error("Force snapshot is not loaded");
  }
  render(snapshot);
  downloadBlob(`${FORCE_SLUG}-snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`, "application/json");
  setStatus("Exported JSON", "ok");
}

async function exportSvg() {
  const snapshot = localRuntimeOnly
    ? window.LayoutEngine.exportForceSnapshot(committedSnapshot)
    : await fetchJson(forceApiPath("export", `/api/force-export/${encodeURIComponent(FORCE_SLUG)}`));
  if (!snapshot) {
    throw new Error("Force snapshot is not loaded");
  }
  render(snapshot);
  downloadBlob(`${FORCE_SLUG}.svg`, `${buildSvg(snapshot)}\n`, "image/svg+xml;charset=utf-8");
  setStatus("Exported SVG", "ok");
}

async function saveForceOverrides() {
  if (localRuntimeOnly) {
    if (!committedSnapshot) {
      throw new Error("Force snapshot is not loaded");
    }
    const snapshot = window.LayoutEngine.exportForceSnapshot(committedSnapshot);
    await fetchJson(forceApiPath("save", `/api/force-save/${encodeURIComponent(FORCE_SLUG)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    render(snapshot);
    forceSaveDirty = false;
    forceUndoManager.markSaved();
    updateLocalRuntimeControls();
    setStatus("Saved to YAML", "ok");
    return;
  }
  await fetchJson(forceApiPath("save", `/api/force-save/${encodeURIComponent(FORCE_SLUG)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  forceSaveDirty = false;
  forceUndoManager.markSaved();
  updateLocalRuntimeControls();
  setStatus("Saved", "ok");
}

async function runLoop() {
  if (!running) {
    return;
  }
  if (inFlight) {
    requestAnimationFrame(runLoop);
    return;
  }

  inFlight = true;
  try {
    const snapshot = await tickSimulation(currentTicksPerFrame());
    if (snapshot.simulation.settled) {
      running = false;
      updateRunButton();
      setStatus("Settled", "ok");
      return;
    }
  } catch (error) {
    running = false;
    updateRunButton();
    setStatus(error.message || "Tick failed", "error");
    return;
  } finally {
    inFlight = false;
  }

  if (running) {
    requestAnimationFrame(runLoop);
  }
}

function startRunning() {
  if (running || !currentSnapshot || currentSnapshot.simulation.settled) {
    return;
  }
  running = true;
  updateRunButton();
  setStatus("Running…", "ok");
  requestAnimationFrame(runLoop);
}

function toggleRun() {
  if (running) {
    running = false;
    updateRunButton();
    setStatus("Paused", "ok");
    return;
  }
  startRunning();
}

function pauseForceInteraction() {
  if (!running) {
    return false;
  }
  running = false;
  updateRunButton();
  setStatus("Paused", "ok");
  return true;
}

// Diagram picker + prev/next: initPreviewShell() → editor-base.js initDiagramPicker()

byId("tree-force").addEventListener("click", (event) => {
  const item = event.target.closest("[data-node-id]");
  if (!item || !currentSnapshot) {
    return;
  }
  pauseForceInteraction();
  const nodeId = item.getAttribute("data-node-id");
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    if (selectedIds.has(nodeId)) selectedIds.delete(nodeId);
    else selectedIds.add(nodeId);
  } else {
    selectedIds = new Set([nodeId]);
  }
  render(currentSnapshot);
});

byId("stage").addEventListener("click", (event) => {
  if (suppressStageClick) {
    suppressStageClick = false;
    return;
  }
  const node = event.target.closest("[data-component-id]");
  if (!currentSnapshot) {
    return;
  }
  if (node) {
    pauseForceInteraction();
    const nodeId = node.getAttribute("data-component-id");
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      if (selectedIds.has(nodeId)) selectedIds.delete(nodeId);
      else selectedIds.add(nodeId);
    } else {
      selectedIds = new Set([nodeId]);
    }
  } else {
    selectedIds = new Set();
  }
  render(currentSnapshot);
});

// Hover highlighting
byId("stage").addEventListener("mouseover", (event) => {
  const g = event.target.closest("[data-component-id]");
  if (g && !g.classList.contains("dg-selected")) g.classList.add("dg-hover");
});
byId("stage").addEventListener("mouseout", (event) => {
  const g = event.target.closest("[data-component-id]");
  if (g) g.classList.remove("dg-hover");
});

// Double-click inline text editing
let activeTextEdit = null;
byId("stage").addEventListener("dblclick", (event) => {
  if (activeTextEdit) return;
  const g = event.target.closest("[data-component-id]");
  if (!g || !currentSnapshot) return;
  const nodeId = g.getAttribute("data-component-id");
  const nodeData = currentSnapshot.nodes.find(n => n.id === nodeId);
  if (!nodeData) return;
  startForceTextEdit(nodeData, g);
});

function startForceTextEdit(nodeData, gEl) {
  const rect = gEl.querySelector("rect");
  if (!rect) return;
  const svg = gEl.closest("svg");
  const svgRect = svg.getBoundingClientRect();
  const x = parseFloat(rect.getAttribute("x"));
  const y = parseFloat(rect.getAttribute("y"));
  const w = parseFloat(rect.getAttribute("width"));
  const h = parseFloat(rect.getAttribute("height"));

  const labels = Array.isArray(nodeData.label) ? nodeData.label : [nodeData.label || nodeData.id];
  const text = labels.map(ln => typeof ln === "string" ? ln : ln?.text || "").join("\n");

  const ta = document.createElement("textarea");
  ta.className = "dg-force-text-edit";
  ta.value = text;
  ta.style.position = "absolute";
  ta.style.left = `${svgRect.left + x + 4}px`;
  ta.style.top = `${svgRect.top + y + 4}px`;
  ta.style.width = `${w - 8}px`;
  ta.style.height = `${h - 8}px`;
  ta.style.fontFamily = "Ubuntu Sans, sans-serif";
  ta.style.fontSize = "18px";
  ta.style.lineHeight = "1.4";
  ta.style.border = "2px solid var(--dg-selection-accent, #e95420)";
  ta.style.borderRadius = "2px";
  ta.style.padding = "4px";
  ta.style.background = "rgba(255,255,255,0.95)";
  ta.style.color = "#000";
  ta.style.resize = "none";
  ta.style.zIndex = "1000";
  ta.style.outline = "none";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  activeTextEdit = { nodeId: nodeData.id, ta, originalText: text };

  function commit() {
    if (!activeTextEdit) return;
    const newText = ta.value;
    ta.remove();
    const oldText = activeTextEdit.originalText;
    const nodeId = activeTextEdit.nodeId;
    activeTextEdit = null;
    if (newText === oldText) return;
    const newLabel = newText.split("\n").filter((_, i, arr) => i < arr.length - 1 || arr[i] !== "");
    if (newLabel.length === 0) newLabel.push(nodeId);
    const beforeSnapshot = currentSnapshot;
    pushForceUndo("Edit label", beforeSnapshot, null);
    updateForceNode(nodeId, { label: newLabel }).then(snap => {
      forceUndoManager._stack[forceUndoManager._stack.length - 1].after = snap;
    });
  }

  ta.addEventListener("blur", commit);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ta.value = activeTextEdit.originalText;
      ta.blur();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ta.blur();
    }
    e.stopPropagation();
  });
}

byId("stage").addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !currentSnapshot) {
    return;
  }

  // Check for resize handle first
  const handleEl = event.target.closest(".dg-force-handle");
  if (handleEl) {
    startForceResize(event, handleEl);
    return;
  }

  const nodeElement = event.target.closest("[data-component-id]");
  if (!nodeElement) {
    return;
  }
  pauseForceInteraction();
  const point = pointerToStagePoint(event);
  if (!point) {
    return;
  }
  const nodeId = nodeElement.getAttribute("data-component-id");
  const node = currentSnapshot.nodes.find((candidateNode) => candidateNode.id === nodeId);
  if (!node) {
    return;
  }
  dragCandidate = {
    nodeId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startSvgX: point.x,
    startSvgY: point.y,
    nodeX: node.x,
    nodeY: node.y,
    wasRunning: running,
  };
});

byId("inspector").addEventListener("pointerdown", (event) => {
  if (!event.target.closest("[data-force-style-select], [data-force-pin-toggle]")) {
    return;
  }
  pauseForceInteraction();
});

document.addEventListener("mousemove", (event) => {
  // Resize takes priority
  if (resizeState) {
    event.preventDefault();
    updateForceResize(event);
    return;
  }

  if (dragCandidate && !dragState) {
    const moved = Math.hypot(event.clientX - dragCandidate.startClientX, event.clientY - dragCandidate.startClientY);
    if (moved >= DRAG_THRESHOLD) {
      startDragPreview(dragCandidate);
    }
  }

  if (!dragState) {
    return;
  }

  event.preventDefault();
  updateDragPreview(event);
});

document.addEventListener("mouseup", async (event) => {
  if (resizeState) {
    event.preventDefault();
    await finishForceResize(event);
    return;
  }
  if (dragState) {
    event.preventDefault();
    await finishDrag(event);
    return;
  }
  dragCandidate = null;
});

byId("inspector").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-force-style-select]");
  if (!select) {
    return;
  }
  const styleNodeId = select.getAttribute("data-force-style-select");
  const beforeStyle = captureNodeState(styleNodeId);
  try {
    await updateForceNode(styleNodeId, { style: select.value || null });
    pushForceUndo("Style", beforeStyle, captureNodeState(styleNodeId));
    setStatus(select.value ? "Style updated" : "Style reset", "ok");
  } catch (error) {
    setStatus(error.message || "Style update failed", "error");
  }
});

byId("inspector").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-force-pin-toggle]");
  if (!button || !currentSnapshot) {
    return;
  }
  const nodeId = button.getAttribute("data-force-pin-toggle");
  const node = currentSnapshot.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return;
  }
  const nextPinned = !isNodePinned(node);
  const beforePin = captureNodeState(nodeId);
  try {
    await updateForceNode(nodeId, { pinned: nextPinned });
    pushForceUndo(nextPinned ? "Pin" : "Unpin", beforePin, captureNodeState(nodeId));
    setStatus(nextPinned ? "Pinned" : "Unpinned", "ok");
  } catch (error) {
    setStatus(error.message || "Pin update failed", "error");
  }
});

// Shell init: sidebar resize, view tabs, prev/next — from editor-base.js
initPreviewShell();

byId("btn-play").addEventListener("click", toggleRun);
byId("btn-step").addEventListener("click", async () => {
  if (running) {
    toggleRun();
  }
  try {
    await tickSimulation(currentTicksPerFrame());
  } catch (error) {
    setStatus(error.message || "Step failed", "error");
  }
});
byId("btn-reset").addEventListener("click", async () => {
  running = false;
  updateRunButton();
  try {
    await loadSnapshot(true);
    forceUndoManager.clear();
    startRunning();
  } catch (error) {
    setStatus(error.message || "Reset failed", "error");
  }
});
byId("btn-force-save").addEventListener("click", async () => {
  try {
    await saveForceOverrides();
  } catch (error) {
    setStatus(error.message || "Save failed", "error");
  }
});
byId("btn-force-undo").addEventListener("click", performForceUndo);
byId("btn-force-redo").addEventListener("click", performForceRedo);
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
    event.preventDefault();
    performForceUndo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "z" && event.shiftKey) {
    event.preventDefault();
    performForceRedo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "y") {
    event.preventDefault();
    performForceRedo();
  }
  // Arrow-key nudge for selected pinned nodes (8px default, 24px with Shift)
  if (selectedIds.size > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    const pinnedNodes = currentSnapshot ? currentSnapshot.nodes.filter(n => selectedIds.has(n.id) && isNodePinned(n)) : [];
    if (pinnedNodes.length === 0) return;
    event.preventDefault();
    const step = event.shiftKey ? 24 : 8;
    let dx = 0, dy = 0;
    if (event.key === "ArrowUp") dy = -step;
    if (event.key === "ArrowDown") dy = step;
    if (event.key === "ArrowLeft") dx = -step;
    if (event.key === "ArrowRight") dx = step;
    const firstId = pinnedNodes[0].id;
    const beforeNudge = captureNodeState(firstId);
    Promise.all(pinnedNodes.map(n => updateForceNode(n.id, { x: n.x + dx, y: n.y + dy, pinned: true }))).then(() => {
      pushForceUndo("Nudge", beforeNudge, captureNodeState(firstId));
    });
  }
});
byId("btn-export-json").addEventListener("click", async () => {
  try {
    await exportJson();
  } catch (error) {
    setStatus(error.message || "Export failed", "error");
  }
});
byId("btn-export-svg").addEventListener("click", async () => {
  try {
    await exportSvg();
  } catch (error) {
    setStatus(error.message || "Export failed", "error");
  }
});

setViewMode("output");
updateRunButton();

// --- Simulation parameter sliders ---

let _paramsInitialized = false;

function updateSimulationParams(snapshot) {
  const params = snapshot.simulation && snapshot.simulation.params;
  const render = snapshot.render || {};
  if (!params && !render) return;
  const container = document.getElementById("force-params");
  if (!container) return;
  for (const input of container.querySelectorAll("[data-force-param]")) {
    const key = input.getAttribute("data-force-param");
    const source = input.getAttribute("data-param-source") === "render" ? render : params;
    if (source && key in source && source[key] != null) {
      if (!_paramsInitialized || document.activeElement !== input) {
        input.value = source[key];
      }
    }
  }
  _paramsInitialized = true;
}

document.getElementById("force-params").addEventListener("change", async (event) => {
  const input = event.target.closest("[data-force-param]");
  if (!input) return;
  const key = input.getAttribute("data-force-param");
  const value = parseFloat(input.value);
  if (isNaN(value)) return;
  if (localRuntimeOnly) {
    try {
      if (!committedSnapshot) {
        throw new Error("Force snapshot is not loaded");
      }
      const snapshot = window.LayoutEngine.updateForceSimulationParams(committedSnapshot, { [key]: value });
      render(snapshot);
      forceSaveDirty = true;
      updateLocalRuntimeControls();
      if (!running) startRunning();
      setStatus(`${key} → ${value}`, "ok");
    } catch (error) {
      setStatus(error.message || "Param update failed", "error");
    }
    return;
  }
  try {
    const resp = await fetch(forceApiPath("params", `/api/force-params/${encodeURIComponent(FORCE_SLUG)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const snapshot = await resp.json();
    render(snapshot);
    forceSaveDirty = true;
    updateLocalRuntimeControls();
    if (!running) startRunning();
    setStatus(`${key} → ${value}`, "ok");
  } catch (error) {
    setStatus(error.message || "Param update failed", "error");
  }
});

applyForceParamMetadata();
loadSnapshot(true)
  .then(() => {
    startRunning();
  })
  .catch((error) => {
    setStatus(error.message || "Initial load failed", "error");
    byId("stage").innerHTML = `<p class="dg-empty-message bf-form-help">${escapeHtml(error.message || "Initial load failed")}</p>`;
  });