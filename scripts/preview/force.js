const FORCE_CONFIG = window.__DG_FORCE_CONFIG || {};
const FORCE_SLUG = FORCE_CONFIG.slug;
const INSET = Number(FORCE_CONFIG.inset || 8);
const BODY_LINE_STEP = Number(FORCE_CONFIG.body_line_step || 24);
const HEAD_LEN = Number(FORCE_CONFIG.head_len || 10.8408);
const HEAD_HALF = Number(FORCE_CONFIG.head_half || 2.9053);
const DEFAULT_CURVE_HANDLE_RATIO = 0.35;
const DEFAULT_CURVE_HANDLE_MIN = 24;
const DEFAULT_CURVE_HANDLE_MAX = 72;
const DRAG_THRESHOLD = 4;
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
let running = false;
let inFlight = false;
let selectedId = null;
let dragCandidate = null;
let dragState = null;
let suppressStageClick = false;
const EMPTY_SELECTION_HTML = '<p class="dg-empty-message bf-form-help">Select or drag a node from the stage or the left rail. Dragging drops it into a pinned manual-polish position.</p>';

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

function setStatus(message, kind = "ok") {
  const status = byId("force-status");
  status.textContent = message;
  status.className = `build-status ${kind === "error" ? "build-err" : "build-ok"}`;
}

function updateRunButton() {
  byId("btn-play").textContent = running ? "Pause" : "Run";
}

function currentTicksPerFrame() {
  const raw = Number(byId("ticks-per-frame").value);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(32, Math.floor(raw));
  }
  return currentSnapshot?.simulation?.ticks_per_frame || 4;
}

function setViewMode(mode) {
  const shell = byId("stage-shell");
  shell.dataset.viewMode = mode;

  const tabs = Array.from(document.querySelectorAll(".dg-view-tab"));
  for (const tab of tabs) {
    const active = tab.dataset.viewMode === mode;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  }
}

function isNodePinned(node) {
  return node.fx != null || node.fy != null;
}

function getStageSvg() {
  return byId("stage")?.querySelector("svg") || null;
}

function pointerToStagePoint(event) {
  const svg = getStageSvg();
  if (!svg) {
    return null;
  }
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return null;
  }
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(ctm.inverse());
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
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${node.width.toFixed(1)}" height="${node.height.toFixed(1)}" fill="${escapeHtml(node.fill)}" stroke="${escapeHtml(node.stroke)}" stroke-width="${Number(node.stroke_width || 1).toFixed(1)}"></rect>
      ${textMarkup}
    </g>`;
}

function buildSvg(snapshot) {
  const width = snapshot.canvas.width;
  const height = snapshot.canvas.height;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const links = snapshot.links.map((link) => buildLinkMarkup(link, nodesById)).join("");
  const nodes = snapshot.nodes.map((node) => buildNodeMarkup(node, node.id === selectedId)).join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="${escapeHtml(snapshot.title)}">
      <rect width="100%" height="100%" fill="#FFFFFF"></rect>
      <g class="force-links">${links}</g>
      <g class="force-nodes">${nodes}</g>
    </svg>`;
}

function renderTree(snapshot) {
  const tree = byId("tree");
  tree.innerHTML = snapshot.nodes
    .map((node) => {
      const selected = node.id === selectedId ? " selected" : "";
      return `<div class="tree-item${selected}" data-node-id="${escapeHtml(node.id)}">${escapeHtml(node.id)}</div>`;
    })
    .join("");
}

function renderSelection(snapshot) {
  const panel = byId("force-selection");
  if (!selectedId) {
    panel.innerHTML = EMPTY_SELECTION_HTML;
    return;
  }

  const node = snapshot.nodes.find((candidate) => candidate.id === selectedId);
  if (!node) {
    selectedId = null;
    panel.innerHTML = EMPTY_SELECTION_HTML;
    return;
  }

  panel.innerHTML = `
    <div class="field">
      <div class="label">Node</div>
      <div class="value">${escapeHtml(node.id)}</div>
    </div>
    <div class="field">
      <div class="label">Label</div>
      <div class="value">${escapeHtml(nodeLabelLines(node).join(" / "))}</div>
    </div>
    <div class="field">
      <div class="label">Position</div>
      <div class="value">${Math.round(node.x)}, ${Math.round(node.y)}</div>
    </div>
    <div class="field">
      <div class="label">Size</div>
      <div class="value">${Math.round(node.width)} × ${Math.round(node.height)}</div>
    </div>
    <div class="field">
      <div class="label">Pinned</div>
      <div class="value">${isNodePinned(node) ? "yes" : "no"}</div>
    </div>
    <div class="field">
      <div class="label">Effective style</div>
      <div class="value">${escapeHtml(node.style ? boxStyleLabel(node.style) : "Original")}</div>
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
      <p class="bf-form-help dg-override-summary">Drag this node on the stage to place it manually and leave it pinned where you drop it.</p>
    </div>`;
}

function updateSummary(snapshot) {
  const settled = snapshot.simulation.settled ? "settled" : "live";
  byId("force-summary").textContent = `alpha ${snapshot.simulation.alpha.toFixed(3)} • ${snapshot.simulation.tick_count} ticks • ${settled}. Export snaps positions to the 8px grid.`;
}

async function updateForceNode(nodeId, patch) {
  const snapshot = await fetchJson(`/api/force-node/${encodeURIComponent(FORCE_SLUG)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, ...patch }),
  });
  render(snapshot);
  return snapshot;
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
  };
  dragCandidate = null;
  selectedId = candidate.nodeId;
  render(previewDraggedSnapshot(currentSnapshot, candidate.nodeId, node.x, node.y));
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
  const position = clampNodePosition(currentSnapshot, node, point.x + dragState.offsetX, point.y + dragState.offsetY);
  render(previewDraggedSnapshot(currentSnapshot, dragState.nodeId, position.x, position.y));
  setStatus("Dragging…", "ok");
}

async function finishDrag(event) {
  if (!dragState || !currentSnapshot) {
    return;
  }

  const activeDrag = dragState;
  dragState = null;
  suppressStageClick = true;

  const node = currentSnapshot.nodes.find((candidateNode) => candidateNode.id === activeDrag.nodeId);
  if (!node) {
    return;
  }

  let finalX = node.x;
  let finalY = node.y;
  const point = pointerToStagePoint(event);
  if (point) {
    const position = clampNodePosition(currentSnapshot, node, point.x + activeDrag.offsetX, point.y + activeDrag.offsetY);
    finalX = position.x;
    finalY = position.y;
  }

  try {
    await updateForceNode(activeDrag.nodeId, { x: finalX, y: finalY, pinned: true });
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

function render(snapshot) {
  currentSnapshot = snapshot;
  document.title = `${snapshot.title} – force preview`;
  if (snapshot.simulation.tick_count === 0) {
    byId("ticks-per-frame").value = String(snapshot.simulation.ticks_per_frame);
  }
  if (selectedId && !snapshot.nodes.some((node) => node.id === selectedId)) {
    selectedId = null;
  }
  byId("stage").innerHTML = buildSvg(snapshot);
  renderTree(snapshot);
  renderSelection(snapshot);
  updateSummary(snapshot);
  updateSimulationParams(snapshot);
  ensureReferenceImage();

  if (dragState) {
    setStatus("Dragging…", "ok");
  } else if (snapshot.simulation.settled) {
    setStatus("Settled", "ok");
  } else if (running) {
    setStatus("Running…", "ok");
  } else {
    setStatus("Paused", "ok");
  }
}

async function loadSnapshot(reset = true) {
  const url = reset
    ? `/api/force-reset/${encodeURIComponent(FORCE_SLUG)}`
    : `/api/force/${encodeURIComponent(FORCE_SLUG)}`;
  const options = reset
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    : undefined;
  const snapshot = await fetchJson(url, options);
  render(snapshot);
}

async function tickSimulation(iterations) {
  const snapshot = await fetchJson(`/api/force-tick/${encodeURIComponent(FORCE_SLUG)}`, {
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
  const snapshot = await fetchJson(`/api/force-export/${encodeURIComponent(FORCE_SLUG)}`);
  render(snapshot);
  downloadBlob(`${FORCE_SLUG}-snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`, "application/json");
  setStatus("Exported JSON", "ok");
}

async function exportSvg() {
  const snapshot = await fetchJson(`/api/force-export/${encodeURIComponent(FORCE_SLUG)}`);
  render(snapshot);
  downloadBlob(`${FORCE_SLUG}.svg`, `${buildSvg(snapshot)}\n`, "image/svg+xml;charset=utf-8");
  setStatus("Exported SVG", "ok");
}

async function saveForceOverrides() {
  await fetchJson(`/api/force-save/${encodeURIComponent(FORCE_SLUG)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
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

byId("force-picker").addEventListener("change", (event) => {
  const nextUrl = event.target.value;
  if (!nextUrl || nextUrl === window.location.pathname) {
    return;
  }
  window.location.assign(nextUrl);
});

function stepPicker(delta) {
  const picker = byId("force-picker");
  if (!(picker instanceof HTMLSelectElement) || picker.options.length === 0) {
    return;
  }
  const nextIndex = picker.selectedIndex + delta;
  if (nextIndex < 0 || nextIndex >= picker.options.length) {
    return;
  }
  picker.selectedIndex = nextIndex;
  picker.dispatchEvent(new Event("change"));
}

const prevBtn = byId("diagram-prev");
const nextBtn = byId("diagram-next");
if (prevBtn) {
  prevBtn.addEventListener("click", () => stepPicker(-1));
}
if (nextBtn) {
  nextBtn.addEventListener("click", () => stepPicker(1));
}

byId("tree").addEventListener("click", (event) => {
  const item = event.target.closest("[data-node-id]");
  if (!item || !currentSnapshot) {
    return;
  }
  selectedId = item.getAttribute("data-node-id");
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
  selectedId = node ? node.getAttribute("data-component-id") : null;
  render(currentSnapshot);
});

byId("stage").addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !currentSnapshot) {
    return;
  }
  const nodeElement = event.target.closest("[data-component-id]");
  if (!nodeElement) {
    return;
  }
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

document.addEventListener("mousemove", (event) => {
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
  if (dragState) {
    event.preventDefault();
    await finishDrag(event);
    return;
  }
  dragCandidate = null;
});

byId("force-selection").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-force-style-select]");
  if (!select) {
    return;
  }
  try {
    await updateForceNode(select.getAttribute("data-force-style-select"), { style: select.value || null });
    setStatus(select.value ? "Style updated" : "Style reset", "ok");
  } catch (error) {
    setStatus(error.message || "Style update failed", "error");
  }
});

byId("force-selection").addEventListener("click", async (event) => {
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
  try {
    await updateForceNode(nodeId, { pinned: nextPinned });
    setStatus(nextPinned ? "Pinned" : "Unpinned", "ok");
  } catch (error) {
    setStatus(error.message || "Pin update failed", "error");
  }
});

for (const tab of document.querySelectorAll(".dg-view-tab")) {
  tab.addEventListener("click", () => setViewMode(tab.dataset.viewMode || "output"));
}

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
    startRunning();
  } catch (error) {
    setStatus(error.message || "Reset failed", "error");
  }
});
byId("btn-save").addEventListener("click", async () => {
  try {
    await saveForceOverrides();
  } catch (error) {
    setStatus(error.message || "Save failed", "error");
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
  try {
    const resp = await fetch(`/api/force-params/${encodeURIComponent(FORCE_SLUG)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const snapshot = await resp.json();
    render(snapshot);
    if (!running) startRunning();
    setStatus(`${key} → ${value}`, "ok");
  } catch (error) {
    setStatus(error.message || "Param update failed", "error");
  }
});

loadSnapshot(true)
  .then(() => {
    startRunning();
  })
  .catch((error) => {
    setStatus(error.message || "Initial load failed", "error");
    byId("stage").innerHTML = `<p class="dg-empty-message bf-form-help">${escapeHtml(error.message || "Initial load failed")}</p>`;
  });