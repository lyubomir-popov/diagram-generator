/**
 * ELK preview controller (spec 026 T011).
 *
 * Orchestrates ELK engine detection, sidebar wiring, override state, and relayout
 * requests. Sidebar DOM lives in elk-layout-controls.js; this module owns shell integration.
 */
(function () {
  "use strict";

  const SECTION_ID = "elk-layout-section";

  /** @type {object | null} */
  let _deps = null;
  let _panelWired = false;

  function _requireDeps() {
    if (!_deps) {
      throw new Error("ElkPreviewController.init() must run before ELK shell operations");
    }
    return _deps;
  }

  function isElkLayeredDiagram(frameTreeJson) {
    const tree = frameTreeJson !== undefined
      ? frameTreeJson
      : (typeof getFrameTreeJson === "function" ? getFrameTreeJson() : null);
    const layoutEngine = tree?.layoutEngine
      ?? (window.__DG_CONFIG && window.__DG_CONFIG.layout_engine)
      ?? null;
    if (
      typeof LayoutEngine !== "undefined"
      && typeof LayoutEngine.resolvePreviewEngine === "function"
      && LayoutEngine.resolvePreviewEngine({ layoutEngine, shellMode: "grid" })?.id === "elk-layered"
    ) {
      return true;
    }
    if (tree && tree.layoutEngine === "elk-layered") return true;
    const cfg = window.__DG_CONFIG || {};
    if (cfg.layout_engine === "elk-layered") return true;
    const section = document.getElementById(SECTION_ID);
    if (section && !section.hasAttribute("hidden")) return true;
    return false;
  }

  function applyElkLayoutOverrides(overrides) {
    if (!_deps) return;
    _deps.setElkLayoutOverrides({ ...(overrides || {}) });
  }

  function wirePanel() {
    if (!window.ElkLayoutControls) return;
    if (_panelWired) return;
    const deps = _requireDeps();
    ElkLayoutControls.init({
      getOverrides: () => deps.getElkLayoutOverrides() || {},
      setOverrides: (value) => deps.setElkLayoutOverrides({ ...value }),
    });
    _panelWired = true;
  }

  function syncPanel() {
    wirePanel();
    if (window.ElkLayoutControls && typeof ElkLayoutControls.refresh === "function") {
      ElkLayoutControls.refresh();
    }
  }

  function initPanel() {
    syncPanel();
  }

  async function requestRelayout() {
    wirePanel();
    if (window.ElkLayoutControls && typeof ElkLayoutControls.collectOverrides === "function") {
      const deps = _deps;
      applyElkLayoutOverrides({
        ...((deps && deps.getElkLayoutOverrides()) || {}),
        ...ElkLayoutControls.collectOverrides(),
      });
    }
    const deps = _requireDeps();
    const rootId = typeof deps.getRootId === "function" ? deps.getRootId() : "root";
    return deps.requestV3Relayout(rootId);
  }

  function init(deps) {
    _deps = deps;
    window.__DG_wireElkLayoutPanel = wirePanel;
    window.__DG_applyElkLayoutOverrides = applyElkLayoutOverrides;
    window.requestElkRelayout = requestRelayout;
  }

  window.ElkPreviewController = {
    init,
    isElkLayeredDiagram,
    wirePanel,
    syncPanel,
    initPanel,
    applyElkLayoutOverrides,
    requestRelayout,
  };
})();
