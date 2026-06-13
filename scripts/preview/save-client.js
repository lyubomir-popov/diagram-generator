/**
 * Preview save/reload orchestration (spec 026 T010).
 *
 * Owns dirty tracking, override persistence POST, and post-save diagram reload.
 * Editor.js supplies runtime hooks via init(); this module stays DOM/event focused.
 */
(function () {
  "use strict";

  /** @type {object | null} */
  let _deps = null;
  let _dirty = false;
  /** @type {string | null} */
  let _lastSavedState = null;
  let _initialized = false;

  function _requireDeps() {
    if (!_deps) {
      throw new Error("PreviewSaveClient.init() must run before save operations");
    }
    return _deps;
  }

  function isDirty() {
    return _dirty;
  }

  function getLastSavedState() {
    return _lastSavedState;
  }

  function markSaved(serializedState) {
    _lastSavedState = serializedState;
    setDirty(false);
  }

  function syncDirtyFromSerialized(serializedState) {
    setDirty(serializedState !== _lastSavedState);
  }

  function syncSaveButton(errorCount) {
    const saveBtn = document.getElementById("btn-save");
    if (!saveBtn) return;
    const deps = _deps;
    const errors = errorCount != null
      ? errorCount
      : (deps && typeof deps.getConstraintErrorCount === "function"
        ? deps.getConstraintErrorCount()
        : 0);
    saveBtn.disabled = !_dirty || errors > 0;
    if (_dirty) {
      saveBtn.classList.add("dirty");
    } else {
      saveBtn.classList.remove("dirty");
    }
  }

  function setDirty(dirty) {
    _dirty = Boolean(dirty);
    syncSaveButton();
    if (_dirty && _deps && typeof _deps.runConstraints === "function") {
      _deps.runConstraints();
    }
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

  function _currentSvgFilename(slug) {
    const baseSlug = String(slug || "").replace(/^v3:/, "");
    return baseSlug + "-onbrand-v3.svg";
  }

  function _commitFocusedControl() {
    const active = document.activeElement;
    if (!active || active === document.body || typeof active.blur !== "function") {
      return;
    }
    active.blur();
  }

  function saveCurrentSvg() {
    const deps = _requireDeps();
    const svg = document.querySelector("#stage svg");
    if (!svg) {
      alert("No SVG is loaded.");
      return;
    }
    const clone = svg.cloneNode(true);
    if (typeof deps.sanitizeSvgCloneForExport === "function") {
      deps.sanitizeSvgCloneForExport(clone);
    }
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!clone.getAttribute("xmlns:xlink")) {
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    }
    const serialized = new XMLSerializer().serializeToString(clone);
    const prolog = serialized.startsWith("<?xml") ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n';
    _downloadTextFile(
      _currentSvgFilename(deps.slug),
      prolog + serialized + "\n",
      "image/svg+xml;charset=utf-8",
    );
  }

  async function saveOverrides() {
    const deps = _requireDeps();
    // Inspector size fields and some ELK controls commit on blur/change.
    // Flush the focused control before validating or serializing payload.
    _commitFocusedControl();
    const summary = typeof deps.getConstraintSummary === "function"
      ? deps.getConstraintSummary()
      : { errors: 0 };
    if (summary.errors > 0) {
      console.warn("Save blocked: " + summary.errors + " error-severity constraint violation(s)");
      alert("Cannot save: " + summary.errors + " constraint error(s) must be resolved first.");
      return;
    }

    const model = typeof deps.getModel === "function" ? deps.getModel() : null;
    if (!model || typeof model.toOverridePayload !== "function") {
      throw new Error("PreviewSaveClient requires a component model with toOverridePayload()");
    }

    let payload = model.toOverridePayload();
    const isElk = typeof deps.isElkLayeredDiagram === "function" && deps.isElkLayeredDiagram();
    if (isElk && window.ElkLayoutControls && typeof ElkLayoutControls.collectOverrides === "function") {
      if (typeof deps.wireElkLayoutPanel === "function") {
        deps.wireElkLayoutPanel();
      }
      const domElk = ElkLayoutControls.collectOverrides();
      const elkOverrides = { ...(model.elkLayoutOverrides || {}), ...domElk };
      if (typeof deps.applyElkLayoutOverrides === "function") {
        deps.applyElkLayoutOverrides(elkOverrides);
      }
      payload = { ...payload, elk_layout_overrides: { ...elkOverrides } };
    }

    const relayout = typeof deps.getV3RelayoutStatus === "function"
      ? deps.getV3RelayoutStatus()
      : { localReady: true };
    const relayoutRuntime = typeof deps.getV3RelayoutRuntime === "function"
      ? deps.getV3RelayoutRuntime()
      : {};
    if (relayoutRuntime.lastMode === "local-error") {
      alert("Cannot save while local relayout is in an error state. Resolve the local relayout error first.");
      return;
    }
    if (
      !relayout.localReady
      && (Object.keys(model.overrides || {}).length > 0 || Object.keys(model.gridOverrides || {}).length > 0)
    ) {
      alert("Cannot save while local relayout is unavailable.");
      return;
    }

    const preservedSelectionIds = typeof deps.getSelectedIds === "function"
      ? deps.getSelectedIds()
      : [];
    let canonicalState = null;
    try {
      const resp = await fetch("/api/overrides/" + deps.slug, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const message = await resp.text();
        console.error("Save failed:", resp.status, resp.statusText, message);
        alert("Save failed: " + (message || resp.statusText || "Unknown error"));
        return;
      }
      try {
        const responsePayload = await resp.json();
        if (responsePayload && typeof responsePayload.canonicalState === "object") {
          canonicalState = responsePayload.canonicalState;
        }
      } catch (parseError) {
        console.warn("Save response did not include canonical state JSON:", parseError);
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed: " + err);
      return;
    }

    if (typeof deps.clearCoercedKeys === "function") {
      deps.clearCoercedKeys();
    }
    model.removedIds = new Set();
    if (typeof deps.reloadDiagram !== "function") {
      throw new Error("PreviewSaveClient requires reloadDiagram() for post-save rehydration");
    }
    await deps.reloadDiagram({ preserveSelectionIds: preservedSelectionIds, canonicalState });
    if (
      preservedSelectionIds.length > 0
      && typeof deps.restoreSelectionIds === "function"
    ) {
      deps.restoreSelectionIds(preservedSelectionIds);
    }
    if (typeof deps.setStatus === "function") {
      deps.setStatus("Ready", "ok");
    }
  }

  function trySaveIfDirty() {
    if (_dirty) {
      void saveOverrides();
    }
  }

  function init(deps) {
    if (_initialized) return;
    _deps = deps;
    _initialized = true;

    const saveBtn = document.getElementById("btn-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (_dirty) {
          void saveOverrides();
        }
      });
    }

    const saveSvgBtn = document.getElementById("btn-save-svg");
    if (saveSvgBtn) {
      saveSvgBtn.addEventListener("click", saveCurrentSvg);
    }

    if (typeof deps.onBeforeUnload === "function") {
      window.addEventListener("beforeunload", deps.onBeforeUnload);
    }
  }

  window.PreviewSaveClient = {
    init,
    isDirty,
    setDirty,
    markSaved,
    syncDirtyFromSerialized,
    getLastSavedState,
    syncSaveButton,
    saveOverrides,
    saveCurrentSvg,
    trySaveIfDirty,
  };
})();
