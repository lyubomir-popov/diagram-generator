/**
 * editor-base.js — Shared shell infrastructure for grid and force editor modes.
 *
 * Loaded before the mode-specific script (editor.js or force.js).
 * Provides: utilities, shell init, sidebar resize, view tabs, diagram picker.
 */

// ---- Shared utilities ----

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ---- Theme helpers ----

function getThemeToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---- Shell mode ----

function getShellMode() {
  const shell = document.querySelector("[data-dg-mode]");
  return shell ? shell.dataset.dgMode : "grid";
}

// ---- View mode tabs ----

function setViewMode(mode) {
  const shell = byId("stage-shell");
  if (shell) shell.dataset.viewMode = mode;

  const tabs = Array.from(document.querySelectorAll(".dg-view-tab"));
  for (const tab of tabs) {
    const active = (tab.dataset.viewMode || tab.dataset.forceViewTab) === mode;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  }
}

function initViewTabs() {
  document.querySelectorAll(".dg-view-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.viewMode || tab.dataset.forceViewTab;
      if (mode) setViewMode(mode);
    });
  });
}

// ---- Diagram picker (prev / next) ----

function initDiagramPicker() {
  const picker = byId("diagram-picker");
  if (!picker) return;

  const prevBtn = byId("diagram-prev");
  const nextBtn = byId("diagram-next");

  function stepPicker(delta) {
    const options = Array.from(picker.options);
    const idx = options.findIndex(o => o.selected);
    const next = idx + delta;
    if (next >= 0 && next < options.length) {
      picker.selectedIndex = next;
      picker.dispatchEvent(new Event("change"));
    }
  }

  if (prevBtn) prevBtn.addEventListener("click", () => stepPicker(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepPicker(1));
}

// ---- Sidebar resize handles ----

function bindShellResize() {
  // Navigation (left) resize handle
  const navHandle = document.querySelector(".bf-application-navigation-resize-handle");
  const nav = byId("dg-component-navigation");
  if (navHandle && nav) {
    _bindResizeHandle(navHandle, nav, "width", 120, 500, "left");
  }

  // Aside (right) resize handle
  const asideHandle = document.querySelector(".bf-application-aside-resize-handle");
  const aside = byId("dg-preview-aside");
  if (asideHandle && aside) {
    _bindResizeHandle(asideHandle, aside, "width", 200, 600, "right");
  }
}

function _bindResizeHandle(handle, panel, dimension, min, max, side) {
  let startPos = 0;
  let startSize = 0;

  function onMouseDown(e) {
    e.preventDefault();
    startPos = side === "left" || side === "top" ? e.clientX : e.clientX;
    startSize = panel.getBoundingClientRect()[dimension];
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = dimension === "width" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }

  function onMouseMove(e) {
    const delta = side === "right"
      ? startPos - e.clientX
      : e.clientX - startPos;
    const newSize = Math.max(min, Math.min(max, startSize + delta));
    panel.style[dimension] = newSize + "px";
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  handle.addEventListener("mousedown", onMouseDown);
}

// ---- SVG coordinate helpers ----

function getStageSvg() {
  return byId("stage")?.querySelector("svg") || null;
}

function pointerToSvgPoint(event, svg) {
  svg = svg || getStageSvg();
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(ctm.inverse());
}

// ---- Status bar ----

function setStatus(message, kind) {
  const el = byId("build-status");
  if (!el) return;
  el.textContent = message;
  el.className = "build-status " + (kind === "error" ? "build-err" : "build-ok");
}

// ---- Init shell ----

function initNavTabs() {
  const tabs = Array.from(document.querySelectorAll(".dg-nav-tab"));
  const panes = Array.from(document.querySelectorAll(".dg-nav-pane"));
  if (tabs.length === 0 || panes.length === 0) return;

  function activateTab(tab) {
    tabs.forEach(t => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
      t.setAttribute("tabindex", active ? "0" : "-1");
    });
    panes.forEach(p => {
      const show = p.id === tab.getAttribute("aria-controls");
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
  }

  tabs.forEach(tab => tab.addEventListener("click", () => activateTab(tab)));

  // Scroll active browse link into view
  const activeLink = document.querySelector(".dg-browse-link.is-active");
  if (activeLink) {
    requestAnimationFrame(() => activeLink.scrollIntoView({ block: "nearest" }));
  }
}

function initPreviewShell() {
  bindShellResize();
  initViewTabs();
  initDiagramPicker();
  initNavTabs();
}

// ---- Shared snap primitives ----
// Used by both grid (editor.js) and force (force.js) editors for
// magnetic snap-to-grid and peer-edge alignment during drag/resize.

/** Distance in px within which a component edge snaps to a target. */
const SHARED_SNAP_THRESHOLD = 6;

/**
 * Snap a single coordinate to the nearest target within SHARED_SNAP_THRESHOLD.
 * @param {number} edge - The proposed edge coordinate.
 * @param {number[]} targets - Snap target positions.
 * @returns {{ value: number, snapped: boolean, target: number|null }}
 */
function snapEdgeToTarget(edge, targets) {
  let best = edge;
  let bestDist = SHARED_SNAP_THRESHOLD + 1;
  let snappedTarget = null;
  for (const t of targets) {
    const dist = Math.abs(edge - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
      snappedTarget = t;
    }
  }
  return { value: best, snapped: bestDist <= SHARED_SNAP_THRESHOLD, target: snappedTarget };
}

/**
 * Collect Brockman grid x and y snap positions from a gridInfo object.
 * Returns column left/right edges and row top/bottom edges.
 * @param {Object|null} gi - Grid info with col_xs, col_widths, row_ys, row_heights.
 * @returns {{ xs: number[], ys: number[] }}
 */
function collectGridSnapTargets(gi) {
  if (!gi) return { xs: [], ys: [] };
  const xs = [];
  const ys = [];
  if (gi.col_xs && gi.col_widths) {
    for (let i = 0; i < gi.col_xs.length; i++) {
      xs.push(gi.col_xs[i]);
      xs.push(gi.col_xs[i] + gi.col_widths[i]);
    }
  }
  if (gi.row_ys && gi.row_heights) {
    for (let i = 0; i < gi.row_ys.length; i++) {
      ys.push(gi.row_ys[i]);
      ys.push(gi.row_ys[i] + gi.row_heights[i]);
    }
  }
  return { xs, ys };
}

/**
 * Collect snap targets from a list of peer component rects.
 * Returns left, right, center x positions and top, bottom, center y positions.
 * @param {{ x: number, y: number, width: number, height: number }[]} peers
 * @returns {{ xs: number[], ys: number[] }}
 */
function collectPeerSnapTargets(peers) {
  const xs = [];
  const ys = [];
  for (const p of peers) {
    xs.push(p.x);              // left edge
    xs.push(p.x + p.width);    // right edge
    xs.push(p.x + p.width / 2);// center
    ys.push(p.y);              // top edge
    ys.push(p.y + p.height);   // bottom edge
    ys.push(p.y + p.height / 2);// center
  }
  return { xs, ys };
}

/** Render dashed alignment guide lines on the SVG stage. */
function renderGuideLines(lines, color, opacity) {
  const svg = getStageSvg();
  if (!svg) return;
  clearGuideLines();
  const ns = "http://www.w3.org/2000/svg";
  const strokeColor = color || "rgba(255, 165, 0, 0.8)";
  const strokeOpacity = opacity || "0.5";
  for (const ln of lines) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", ln.x1);
    line.setAttribute("y1", ln.y1);
    line.setAttribute("x2", ln.x2);
    line.setAttribute("y2", ln.y2);
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", strokeOpacity);
    line.setAttribute("stroke-dasharray", "4 4");
    line.setAttribute("class", "dg-snap-guide");
    line.setAttribute("pointer-events", "none");
    svg.appendChild(line);
  }
}

/** Remove all alignment guide lines from the SVG stage. */
function clearGuideLines() {
  const svg = getStageSvg();
  if (svg) svg.querySelectorAll(".dg-snap-guide").forEach(el => el.remove());
}

// Expose shared API on window for inline handlers
window.byId = byId;
window.escapeHtml = escapeHtml;
window.fetchJson = fetchJson;
window.downloadFile = downloadFile;
window.getThemeToken = getThemeToken;
window.getShellMode = getShellMode;
window.setViewMode = setViewMode;
window.getStageSvg = getStageSvg;
window.pointerToSvgPoint = pointerToSvgPoint;
window.setStatus = setStatus;
window.initPreviewShell = initPreviewShell;
window.SHARED_SNAP_THRESHOLD = SHARED_SNAP_THRESHOLD;
window.snapEdgeToTarget = snapEdgeToTarget;
window.collectGridSnapTargets = collectGridSnapTargets;
window.collectPeerSnapTargets = collectPeerSnapTargets;
window.renderGuideLines = renderGuideLines;
window.clearGuideLines = clearGuideLines;
