/**
 * ELK layered layout controls — Baseline Foundry sidebar panel.
 * Control metadata comes from the TypeScript ELK registry exposed on LayoutEngine.
 */
(function () {
  "use strict";

  const SECTION_ID = "elk-layout-section";
  const CONTAINER_ID = "elk-layout-controls";

  let _relayoutTimer = null;
  let _getOverrides = () => ({});
  let _setOverrides = () => {};

  function _resolvePreviewEngine(context) {
    if (typeof LayoutEngine !== "undefined" && typeof LayoutEngine.resolvePreviewEngine === "function") {
      return LayoutEngine.resolvePreviewEngine(context);
    }
    return null;
  }

  function _elkPreviewEngine() {
    if (typeof LayoutEngine !== "undefined" && typeof LayoutEngine.getPreviewEngine === "function") {
      return LayoutEngine.getPreviewEngine("elk-layered");
    }
    return null;
  }

  function _isElkDiagram(frameTreeJson) {
    if (window.ElkPreviewController && typeof ElkPreviewController.isElkLayeredDiagram === "function") {
      return ElkPreviewController.isElkLayeredDiagram(frameTreeJson);
    }
    const layoutEngine = frameTreeJson?.layoutEngine
      ?? (window.__DG_CONFIG && window.__DG_CONFIG.layout_engine)
      ?? null;
    const resolved = _resolvePreviewEngine({ layoutEngine, shellMode: "grid" });
    if (resolved && resolved.id === "elk-layered") return true;
    if (frameTreeJson && frameTreeJson.layoutEngine === "elk-layered") return true;
    const cfg = window.__DG_CONFIG || {};
    if (cfg.layout_engine === "elk-layered") return true;
    const section = document.getElementById(SECTION_ID);
    if (section && !section.hasAttribute("hidden")) return true;
    return false;
  }

  function _containerHasPlaceholder(container) {
    return /%ELK_LAYOUT_CONTROLS_HTML%/.test(container.innerHTML);
  }

  function _paramSpecs() {
    const engine = _elkPreviewEngine();
    if (engine && Array.isArray(engine.controlSpecs) && engine.controlSpecs.length) {
      return engine.controlSpecs;
    }
    if (typeof LayoutEngine !== "undefined" && Array.isArray(LayoutEngine.ELK_LAYERED_PARAM_SPECS)) {
      return LayoutEngine.ELK_LAYERED_PARAM_SPECS;
    }
    return [];
  }

  function _groups() {
    if (typeof LayoutEngine !== "undefined" && typeof LayoutEngine.elkParamGroups === "function") {
      const fromBundle = LayoutEngine.elkParamGroups();
      if (fromBundle && fromBundle.length) return fromBundle;
    }
    const buckets = new Map();
    for (const spec of _paramSpecs()) {
      const list = buckets.get(spec.group) || [];
      list.push(spec);
      buckets.set(spec.group, list);
    }
    const order = ["Graph", "Spacing", "Edges", "Layering", "Compound"];
    return order.filter((g) => buckets.has(g)).map((group) => ({ group, specs: buckets.get(group) }));
  }

  function _controlId(spec) {
    return "elk-" + spec.key.replace(/\./g, "-");
  }

  function _fieldHtml(spec, value) {
    const id = _controlId(spec);
    const title = spec.description ? ` title="${spec.description.replace(/"/g, "&quot;")}"` : "";
    if (spec.kind === "boolean") {
      const checked = value === "true" || value === true;
      return (
        `<label class="bf-switch is-full-span"${title}>` +
        `<input class="bf-switch-input" type="checkbox" id="${id}" data-elk-key="${spec.key}"${checked ? " checked" : ""}>` +
        `<span class="bf-switch-slider"></span>` +
        `<span class="bf-switch-label">${spec.label}</span>` +
        `</label>`
      );
    }
    if (spec.kind === "enum" && spec.enumValues && spec.enumValues.length) {
      const opts = spec.enumValues
        .map((ev) => `<option value="${ev.value}"${ev.value === value ? " selected" : ""}>${ev.label}</option>`)
        .join("");
      return (
        `<label class="bf-field dg-grid-field is-full-span"${title}>` +
        `<span class="bf-form-label">${spec.label}</span>` +
        `<span class="bf-control dg-grid-control">` +
        `<select class="bf-input" id="${id}" data-elk-key="${spec.key}">${opts}</select>` +
        `</span></label>`
      );
    }
    const step = spec.step != null ? ` step="${spec.step}"` : "";
    const min = spec.min != null ? ` min="${spec.min}"` : "";
    const max = spec.max != null ? ` max="${spec.max}"` : "";
    const unit = spec.kind === "number" ? `<span class="dg-grid-unit">px</span>` : "";
    const type = spec.kind === "number" ? "number" : "text";
    return (
      `<label class="bf-field dg-grid-field is-full-span"${title}>` +
      `<span class="bf-form-label">${spec.label}</span>` +
      `<span class="bf-control dg-grid-control">` +
      `<input class="bf-input dg-number-input" type="${type}" id="${id}" data-elk-key="${spec.key}"` +
      ` value="${String(value ?? spec.defaultValue).replace(/"/g, "&quot;")}"${step}${min}${max}>` +
      `${unit}</span></label>`
    );
  }

  function _readControlValue(el, spec) {
    if (spec.kind === "boolean") return el.checked ? "true" : "false";
    return String(el.value ?? "").trim();
  }

  function _collectOverridesFromDom() {
    const next = {};
    for (const spec of _paramSpecs()) {
      const el = document.getElementById(_controlId(spec));
      if (!el) continue;
      next[spec.key] = _readControlValue(el, spec);
    }
    return next;
  }

  /** Read sidebar values only — never sync DOM from YAML/model first. */
  function collectOverrides() {
    return _collectOverridesFromDom();
  }

  function _onControlInput() {
    if (window.ElkPreviewController && typeof ElkPreviewController.wirePanel === "function") {
      ElkPreviewController.wirePanel();
    } else if (typeof window.__DG_wireElkLayoutPanel === "function") {
      window.__DG_wireElkLayoutPanel();
    }
    const next = _collectOverridesFromDom();
    _setOverrides(next);
    if (window.ElkPreviewController && typeof ElkPreviewController.applyElkLayoutOverrides === "function") {
      ElkPreviewController.applyElkLayoutOverrides(next);
    } else if (typeof window.__DG_applyElkLayoutOverrides === "function") {
      window.__DG_applyElkLayoutOverrides(next);
    }
    if (typeof window.setDirty === "function") window.setDirty(true);
    if (_relayoutTimer) clearTimeout(_relayoutTimer);
    _relayoutTimer = setTimeout(() => {
      if (window.ElkPreviewController && typeof ElkPreviewController.requestRelayout === "function") {
        void ElkPreviewController.requestRelayout();
      } else if (typeof window.requestElkRelayout === "function") {
        window.requestElkRelayout();
      } else if (typeof window.requestV3Relayout === "function") {
        const rootId = (window.componentTree && window.componentTree[0] && window.componentTree[0].id) || "root";
        window.requestV3Relayout(rootId);
      }
    }, 250);
  }

  function _bindControls(container) {
    container.querySelectorAll("[data-elk-key]").forEach((el) => {
      if (el.dataset.elkBound === "1") return;
      el.dataset.elkBound = "1";
      el.addEventListener("input", _onControlInput);
      el.addEventListener("change", _onControlInput);
    });
  }

  function _syncExistingControls(container, resolved) {
    const activeId = document.activeElement && document.activeElement.id;
    for (const spec of _paramSpecs()) {
      const id = _controlId(spec);
      const el = document.getElementById(id);
      if (!el) continue;
      // Do not clobber the field the user is actively editing.
      if (activeId && id === activeId) continue;
      const val = resolved[spec.key] ?? spec.defaultValue;
      if (spec.kind === "boolean") {
        el.checked = val === "true" || val === true;
      } else {
        el.value = String(val);
      }
    }
    _bindControls(container);
  }

  function _sidebarDisplayValues(family, merged) {
    const out = {};
    for (const spec of _paramSpecs()) {
      const raw = merged[spec.key];
      out[spec.key] = raw != null && String(raw) !== ""
        ? String(raw)
        : spec.defaultValue;
    }
    return out;
  }

  function buildPanel(frameTreeJson) {
    const section = document.getElementById(SECTION_ID);
    const container = document.getElementById(CONTAINER_ID);
    if (!section || !container) return;

    const isElk = _isElkDiagram(frameTreeJson);
    section.hidden = !isElk;
    if (!isElk) {
      return;
    }

    const hasServerControls = Boolean(container.querySelector("[data-elk-key]"));

    // Before initLayoutBridge loads the frame tree, keep server-rendered values.
    // Syncing from an empty YAML merge would reset inputs to registry defaults.
    if (!frameTreeJson && hasServerControls) {
      _bindControls(container);
      _bindElkViewToggles(section);
      return;
    }

    if (!frameTreeJson) {
      return;
    }

    if (_containerHasPlaceholder(container)) {
      container.textContent = "";
    }

    const specs = _paramSpecs();
    if (!specs.length) {
      container.innerHTML = '<p class="bf-form-help">ELK parameter registry unavailable. Rebuild the browser bundle from packages/layout-engine.</p>';
      _bindElkViewToggles(section);
      return;
    }

    const yamlElk = (frameTreeJson && frameTreeJson.elkLayout) || {};
    const session = _getOverrides() || {};
    const merged = { ...yamlElk, ...session };
    const display = _sidebarDisplayValues(null, merged);

    if (container.querySelector("[data-elk-key]")) {
      _syncExistingControls(container, display);
      _bindElkViewToggles(section);
      return;
    }

    const parts = [];
    for (const { group, specs } of _groups()) {
      parts.push(`<h3 class="dg-section-subheading bf-h6">${group}</h3>`);
      parts.push('<div class="grid-controls">');
      for (const spec of specs) {
        parts.push(_fieldHtml(spec, display[spec.key] ?? spec.defaultValue));
      }
      parts.push("</div>");
    }
    container.innerHTML = parts.join("");
    _bindControls(container);
    _bindElkViewToggles(section);
  }

  function _bindElkViewToggles(section) {
    const rawToggle = section.querySelector("#elk-raw-view-toggle");
    if (rawToggle && rawToggle.dataset.elkBound !== "1") {
      rawToggle.dataset.elkBound = "1";
      rawToggle.checked = !!window.__DG_elkRawView;
      rawToggle.addEventListener("change", () => {
        if (typeof window.__DG_setElkRawView === "function") {
          window.__DG_setElkRawView(rawToggle.checked);
        }
      });
    }

    const debugToggle = section.querySelector("#elk-debug-overlay-toggle");
    if (debugToggle && debugToggle.dataset.elkBound !== "1") {
      debugToggle.dataset.elkBound = "1";
      debugToggle.checked = !!window.__DG_elkDebugOverlay;
      debugToggle.addEventListener("change", () => {
        if (typeof window.__DG_setElkDebugOverlay === "function") {
          window.__DG_setElkDebugOverlay(debugToggle.checked);
        }
      });
    }
  }

  function init(options) {
    _getOverrides = (options && options.getOverrides) || (() => ({}));
    _setOverrides = (options && options.setOverrides) || (() => {});
  }

  function refresh() {
    const tree = typeof getFrameTreeJson === "function" ? getFrameTreeJson() : null;
    buildPanel(tree);
  }

  window.ElkLayoutControls = {
    init,
    buildPanel,
    refresh,
    collectOverrides,
  };
})();
