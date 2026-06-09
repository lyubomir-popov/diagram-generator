/**
 * Preview editor state store: snapshots + undo/redo (spec 026 T020).
 */
import { captureEditorSnapshot, cloneEditorSnapshotValue, normalizeGridOverrides, serializeEditorSnapshot, } from './editor-snapshot.js';
import { EditorUndoStack, } from './editor-undo-stack.js';
export function captureOverrideEntries(overrides, ids) {
    const snapshot = {};
    const orderedIds = [...new Set(ids ?? [])].sort();
    for (const cid of orderedIds) {
        const entry = overrides[cid];
        snapshot[cid] = entry ? cloneEditorSnapshotValue(entry) : null;
    }
    return snapshot;
}
export class EditorStateStore {
    deps;
    undoStack;
    pendingGridAction = null;
    constructor(deps, options = {}) {
        this.deps = deps;
        this.undoStack = new EditorUndoStack({
            maxSize: options.maxUndoSize ?? 50,
            serializeState: () => this.serializeDirtyState(),
        });
    }
    snapshotInput() {
        return {
            overrides: this.deps.getOverrides(),
            gridOverrides: this.deps.getGridOverrides(),
            elkLayoutOverrides: this.deps.getElkLayoutOverrides(),
            removedIds: this.deps.getRemovedIds(),
            frameTree: this.deps.getFrameTree(),
        };
    }
    captureSnapshot() {
        return captureEditorSnapshot(this.snapshotInput());
    }
    serializeDirtyState() {
        return serializeEditorSnapshot(this.captureSnapshot());
    }
    normalizeGridOverrides(gridOverrides) {
        return normalizeGridOverrides(gridOverrides);
    }
    beginUndoableAction(label) {
        return this.undoStack.beginUndoableAction(label);
    }
    commitUndoableAction(action) {
        return this.undoStack.commitUndoableAction(action);
    }
    commitOverridePatchAction(label, beforeEntries, afterEntries) {
        return this.undoStack.commitOverridePatchAction(label, beforeEntries, afterEntries);
    }
    runUndoableAction(label, mutate) {
        const action = this.beginUndoableAction(label);
        const result = mutate();
        this.commitUndoableAction(action);
        return result;
    }
    pushUndoCommand(command) {
        return this.undoStack.pushCommand(command);
    }
    captureOverrideEntries(ids) {
        return captureOverrideEntries(this.deps.getOverrides(), ids);
    }
    canUndo() {
        return this.undoStack.canUndo();
    }
    canRedo() {
        return this.undoStack.canRedo();
    }
    popUndoCommand() {
        return this.undoStack.popUndo();
    }
    popRedoCommand() {
        return this.undoStack.popRedo();
    }
    clearUndoHistory() {
        this.undoStack.clear();
        this.pendingGridAction = null;
    }
    getPendingGridAction() {
        return this.pendingGridAction;
    }
    setPendingGridAction(action) {
        this.pendingGridAction = action;
    }
}
export function createEditorStateStore(deps, options) {
    return new EditorStateStore(deps, options);
}
//# sourceMappingURL=editor-state-store.js.map