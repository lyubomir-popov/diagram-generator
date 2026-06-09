/**
 * Undo/redo stack for preview editor state (spec 026 T020).
 */
export function createStatePatchCommand(label, beforeState, afterState) {
    return { label, before: beforeState, after: afterState };
}
export function createOverridePatchCommand(label, beforeEntries, afterEntries) {
    return { label, kind: 'override-patch', beforeEntries, afterEntries };
}
export function overridePatchChanged(beforeEntries, afterEntries) {
    return JSON.stringify(beforeEntries) !== JSON.stringify(afterEntries);
}
export class EditorUndoStack {
    maxSize;
    serializeState;
    undoStack = [];
    redoStack = [];
    constructor(options) {
        this.maxSize = options.maxSize ?? 50;
        this.serializeState = options.serializeState;
    }
    canUndo() {
        return this.undoStack.length > 0;
    }
    canRedo() {
        return this.redoStack.length > 0;
    }
    beginUndoableAction(label) {
        return { label, before: this.serializeState() };
    }
    commitUndoableAction(action) {
        if (!action)
            return false;
        const after = this.serializeState();
        if (action.before === after)
            return false;
        return this.pushCommand(createStatePatchCommand(action.label, action.before, after));
    }
    commitOverridePatchAction(label, beforeEntries, afterEntries) {
        if (!overridePatchChanged(beforeEntries, afterEntries))
            return false;
        return this.pushCommand(createOverridePatchCommand(label, beforeEntries, afterEntries));
    }
    pushCommand(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        return true;
    }
    popUndo() {
        if (!this.canUndo())
            return null;
        const command = this.undoStack.pop() ?? null;
        if (command)
            this.redoStack.push(command);
        return command;
    }
    popRedo() {
        if (!this.canRedo())
            return null;
        const command = this.redoStack.pop() ?? null;
        if (command)
            this.undoStack.push(command);
        return command;
    }
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
//# sourceMappingURL=editor-undo-stack.js.map