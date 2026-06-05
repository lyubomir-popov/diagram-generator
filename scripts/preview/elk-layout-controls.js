/**
 * ELK layered layout controls — Baseline Foundry sidebar panel.
 * Uses LayoutEngine.ELK_LAYERED_PARAM_SPECS when available; embedded fallback otherwise.
 */
(function () {
  "use strict";

  const SECTION_ID = "elk-layout-section";
  const CONTAINER_ID = "elk-layout-controls";

  /** Mirror of packages/graph-layout-elk/src/elk-param-registry.ts (fallback when bundle is stale). */
  const FALLBACK_PARAM_SPECS = [
    { key: "elk.direction", label: "Direction", group: "Graph", kind: "enum", defaultValue: "DOWN",
      enumValues: [
        { value: "DOWN", label: "Top → bottom (TB)" },
        { value: "RIGHT", label: "Left → right (LR)" },
        { value: "UP", label: "Bottom → top" },
        { value: "LEFT", label: "Right → left" },
      ] },
    { key: "elk.layered.spacing.nodeNodeBetweenLayers", label: "Layer gap", group: "Spacing", kind: "number", defaultValue: "96", min: 8, max: 512, step: 8,
      description: "Vertical gap between layers — main control for arrow length (TB)." },
    { key: "elk.spacing.nodeNode", label: "Same-layer gap", group: "Spacing", kind: "number", defaultValue: "48", min: 8, max: 256, step: 8 },
    { key: "elk.spacing.edgeNode", label: "Edge ↔ node", group: "Spacing", kind: "number", defaultValue: "24", min: 0, max: 128, step: 4,
      description: "Clearance between edges and boxes — helps keep labels off nodes." },
    { key: "elk.spacing.edgeEdge", label: "Edge ↔ edge", group: "Spacing", kind: "number", defaultValue: "32", min: 0, max: 128, step: 4 },
    { key: "elk.layered.spacing.edgeEdgeBetweenLayers", label: "Edge gap (layers)", group: "Spacing", kind: "number", defaultValue: "32", min: 0, max: 128, step: 4 },
    { key: "elk.edgeRouting", label: "Edge routing", group: "Edges", kind: "enum", defaultValue: "ORTHOGONAL",
      enumValues: [
        { value: "ORTHOGONAL", label: "Orthogonal" },
        { value: "POLYLINE", label: "Polyline" },
        { value: "SPLINES", label: "Splines" },
      ] },
    { key: "elk.layered.unnecessaryBendpoints", label: "Remove extra bends", group: "Edges", kind: "boolean", defaultValue: "true" },
    { key: "elk.layered.nodePlacement.favorStraightEdges", label: "Favor straight edges", group: "Edges", kind: "boolean", defaultValue: "true" },
    { key: "elk.layered.layering.strategy", label: "Layering strategy", group: "Layering", kind: "enum", defaultValue: "NETWORK_SIMPLEX",
      enumValues: [
        { value: "NETWORK_SIMPLEX", label: "Network simplex" },
        { value: "LONGEST_PATH", label: "Longest path" },
        { value: "INTERACTIVE", label: "Interactive" },
      ] },
    { key: "elk.layered.crossingMinimization.strategy", label: "Crossing minimization", group: "Layering", kind: "enum", defaultValue: "LAYER_SWEEP",
      enumValues: [
        { value: "LAYER_SWEEP", label: "Layer sweep" },
        { value: "INTERACTIVE", label: "Interactive" },
      ] },
    { key: "elk.layered.nodePlacement.strategy", label: "Node placement", group: "Layering", kind: "enum", defaultValue: "NETWORK_SIMPLEX",
      enumValues: [
        { value: "NETWORK_SIMPLEX", label: "Network simplex" },
        { value: "BRANDES_KOEPF", label: "Brandes-Köpf" },
        { value: "LINEAR_SEGMENTS", label: "Linear segments" },
        { value: "SIMPLE", label: "Simple" },
      ] },
    { key: "elk.hierarchyHandling", label: "Hierarchy handling", group: "Compound", kind: "enum", defaultValue: "INCLUDE_CHILDREN",
      enumValues: [
        { value: "INCLUDE_CHILDREN", label: "Include children" },
        { value: "SEPARATE_CHILDREN", label: "Separate children" },
        { value: "CHILDREN_ON", label: "Children on" },
      ] },
    { key: "elk.portConstraints", label: "Port constraints", group: "Compound", kind: "enum", defaultValue: "FREE",
      enumValues: [
        { value: "FREE", label: "Free" },
        { value: "FIXED_SIDE", label: "Fixed side" },
        { value: "FIXED_ORDER", label: "Fixed order" },
        { value: "FIXED_RATIO", label: "Fixed ratio" },
      ] },
    { key: "elk.padding", label: "Compound padding", group: "Compound", kind: "text", defaultValue: "[top=32,left=8,bottom=8,right=8]" },
  ];

  let _relayoutTimer = null;
  let _getOverrides = () => ({});
  let _setOverrides = () => {};

  function _isElkDiagram(frameTreeJson) {
    if (frameTreeJson && frameTreeJson.layoutEngine === "elk-layered") return true;
    const cfg = window.__DG_CONFIG || {};
    return cfg.layout_engine === "elk-layered";
  }

  function _paramSpecs() {
    if (typeof LayoutEngine !== "undefined" && Array.isArray(LayoutEngine.ELK_LAYERED_PARAM_SPECS)) {
      return LayoutEngine.ELK_LAYERED_PARAM_SPECS;
    }
    return FALLBACK_PARAM_SPECS;
  }

  function _slugToFamily(diagramType) {
    const t = String(diagramType || "process_and_workflow");
    if (t === "data_flow_and_integration" || t === "deployment_and_runtime_topology" || t === "process_and_workflow") {
      return t;
    }
    return "process_and_workflow";
  }

  function _resolvedValues(family, overrides) {
    if (typeof LayoutEngine !== "undefined" && typeof LayoutEngine.resolvedElkOptionsForFamily === "function") {
      return LayoutEngine.resolvedElkOptionsForFamily(family, overrides);
    }
    const resolved = {};
    for (const spec of _paramSpecs()) {
      resolved[spec.key] = spec.defaultValue;
    }
    return { ...resolved, ...overrides };
  }

  function _groups() {
    if (typeof LayoutEngine !== "undefined" && typeof LayoutEngine.elkParamGroups === "function") {
      return LayoutEngine.elkParamGroups();
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

  function _onControlInput() {
    _setOverrides(_collectOverridesFromDom());
    if (typeof window.setDirty === "function") window.setDirty(true);
    if (_relayoutTimer) clearTimeout(_relayoutTimer);
    _relayoutTimer = setTimeout(() => {
      if (typeof window.requestElkRelayout === "function") {
        window.requestElkRelayout();
      } else if (typeof window.requestV3Relayout === "function") {
        const rootId = (window.componentTree && window.componentTree[0] && window.componentTree[0].id) || "root";
        window.requestV3Relayout(rootId);
      }
    }, 250);
  }

  function _bindControls(container) {
    container.querySelectorAll("[data-elk-key]").forEach((el) => {
      el.addEventListener("input", _onControlInput);
      el.addEventListener("change", _onControlInput);
    });
  }

  function buildPanel(frameTreeJson) {
    const section = document.getElementById(SECTION_ID);
    const container = document.getElementById(CONTAINER_ID);
    if (!section || !container) return;

    const isElk = _isElkDiagram(frameTreeJson);
    section.hidden = !isElk;
    if (!isElk) {
      container.innerHTML = "";
      return;
    }

    const family = _slugToFamily(frameTreeJson && frameTreeJson.diagramType);
    const session = _getOverrides() || {};
    const yamlElk = (frameTreeJson && frameTreeJson.elkLayout) || {};
    const merged = { ...yamlElk, ...session };
    const resolved = _resolvedValues(family, merged);

    const parts = [];
    if (typeof LayoutEngine === "undefined") {
      parts.push('<p class="bf-form-help">Layout engine bundle not loaded.</p>');
    } else if (!LayoutEngine.ELK_LAYERED_PARAM_SPECS && !LayoutEngine.resolvedElkOptionsForFamily) {
      parts.push(
        '<p class="bf-form-help">Using embedded ELK defaults. Run ' +
        '<code>npm run build:browser</code> in packages/layout-engine for live resolved values.</p>',
      );
    }
    for (const { group, specs } of _groups()) {
      parts.push(`<h3 class="dg-section-subheading bf-h6">${group}</h3>`);
      parts.push('<div class="grid-controls">');
      for (const spec of specs) {
        parts.push(_fieldHtml(spec, resolved[spec.key] ?? spec.defaultValue));
      }
      parts.push("</div>");
    }
    container.innerHTML = parts.join("");
    _bindControls(container);
  }

  function init(options) {
    _getOverrides = (options && options.getOverrides) || (() => ({}));
    _setOverrides = (options && options.setOverrides) || (() => {});
    buildPanel(typeof getFrameTreeJson === "function" ? getFrameTreeJson() : null);
  }

  window.ElkLayoutControls = {
    init,
    buildPanel,
    refresh: () => {
      const tree = typeof getFrameTreeJson === "function" ? getFrameTreeJson() : null;
      buildPanel(tree);
    },
  };
})();
