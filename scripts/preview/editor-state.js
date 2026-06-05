/**
 * Thin preview editor state adapter (spec 026 T021).
 *
 * DOM wiring and undo apply callbacks stay here; snapshot + undo logic live in
 * LayoutEngine.createEditorStateStore (TS preview-shell modules).
 */
(function () {
  "use strict";

  /** @type {import("@diagram-generator/layout-engine").EditorStateStore | null} */
  let _store = null;

  function _requireStore() {
    if (!_store) {
      throw new Error("EditorState.init() must run before editor state operations");
    }
    if (typeof LayoutEngine === "undefined" || !LayoutEngine.createEditorStateStore) {
      throw new Error("LayoutEngine.createEditorStateStore is required for EditorState");
    }
    return _store;
  }

  function init(deps) {
    if (typeof LayoutEngine === "undefined" || !LayoutEngine.createEditorStateStore) {
      throw new Error("LayoutEngine.createEditorStateStore is required for EditorState");
    }
    _store = LayoutEngine.createEditorStateStore({
      getOverrides: () => deps.getOverrides(),
      getGridOverrides: () => deps.getGridOverrides(),
      getElkLayoutOverrides: () => deps.getElkLayoutOverrides(),
      getRemovedIds: () => deps.getRemovedIds(),
      getFrameTree: () => deps.getFrameTree(),
    });
  }

  function cloneValue(value) {
    return LayoutEngine.cloneEditorSnapshotValue(value);
  }

  function captureSnapshot() {
    return _requireStore().captureSnapshot();
  }

  function serializeDirtyState() {
    return _requireStore().serializeDirtyState();
  }

  function normalizeGridOverrides(gridOverrides) {
    return _requireStore().normalizeGridOverrides(gridOverrides);
  }

  function beginUndoableAction(label) {
    return _requireStore().beginUndoableAction(label);
  }

  function commitUndoableAction(action) {
    return _requireStore().commitUndoableAction(action);
  }

  function commitOverridePatchAction(label, beforeEntries, afterEntries) {
    return _requireStore().commitOverridePatchAction(label, beforeEntries, afterEntries);
  }

  function runUndoableAction(label, mutate) {
    return _requireStore().runUndoableAction(label, mutate);
  }

  function pushUndoCommand(command) {
    return _requireStore().pushUndoCommand(command);
  }

  function captureOverrideEntries(ids) {
    return _requireStore().captureOverrideEntries(ids);
  }

  function canUndo() {
    return _requireStore().canUndo();
  }

  function canRedo() {
    return _requireStore().canRedo();
  }

  async function undo(applyCommand) {
    const command = _requireStore().popUndoCommand();
    if (!command) return null;
    await applyCommand(command, "undo");
    updateUndoRedoButtons();
    return command.label;
  }

  async function redo(applyCommand) {
    const command = _requireStore().popRedoCommand();
    if (!command) return null;
    await applyCommand(command, "redo");
    updateUndoRedoButtons();
    return command.label;
  }

  function clearUndoHistory() {
    _requireStore().clearUndoHistory();
    updateUndoRedoButtons();
  }

  function getPendingGridAction() {
    return _requireStore().getPendingGridAction();
  }

  function setPendingGridAction(action) {
    _requireStore().setPendingGridAction(action);
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById("btn-undo");
    const redoBtn = document.getElementById("btn-redo");
    if (!_store) return;
    if (undoBtn) undoBtn.disabled = !_store.canUndo();
    if (redoBtn) redoBtn.disabled = !_store.canRedo();
  }

  window.EditorState = {
    init,
    cloneValue,
    captureSnapshot,
    serializeDirtyState,
    normalizeGridOverrides,
    beginUndoableAction,
    commitUndoableAction,
    commitOverridePatchAction,
    runUndoableAction,
    pushUndoCommand,
    captureOverrideEntries,
    canUndo,
    canRedo,
    undo,
    redo,
    clearUndoHistory,
    getPendingGridAction,
    setPendingGridAction,
    updateUndoRedoButtons,
  };
})();
