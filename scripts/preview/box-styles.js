"use strict";

(function initBoxStyles(global) {
  const BOX_STYLES = {
    default: { fill: "#FFFFFF", text: "#000000", icon: "#000000", border: "solid", label: "Default (white)" },
    accent: { fill: "#F3F3F3", text: "#000000", icon: "#000000", border: "none", label: "Accent (grey)" },
    highlight: { fill: "#000000", text: "#FFFFFF", icon: "#FFFFFF", border: "solid", label: "Highlight (black)" },
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function boxStyleLabel(styleName) {
    return BOX_STYLES[styleName]?.label || "Original";
  }

  function boxStyleOptionsHtml(selectedValue, options = {}) {
    const current = selectedValue == null ? "" : String(selectedValue);
    const includeOriginal = options.includeOriginal !== false;
    const originalLabel = options.originalLabel || "— original —";
    let html = "";
    if (includeOriginal) {
      html += `<option value=""${current === "" ? " selected" : ""}>${escapeHtml(originalLabel)}</option>`;
    }
    for (const [key, preset] of Object.entries(BOX_STYLES)) {
      html += `<option value="${escapeHtml(key)}"${current === key ? " selected" : ""}>${escapeHtml(preset.label)}</option>`;
    }
    return html;
  }

  global.__DG_BOX_STYLES = BOX_STYLES;
  global.__DG_boxStyleLabel = boxStyleLabel;
  global.__DG_boxStyleOptionsHtml = boxStyleOptionsHtml;
})(window);