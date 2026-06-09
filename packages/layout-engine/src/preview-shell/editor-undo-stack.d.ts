/**
 * Undo/redo stack for preview editor state (spec 026 T020).
 */
export interface EditorStatePatchCommand {
    label: string;
    before: string;
    after: string;
}
export interface EditorOverridePatchCommand {
    label: string;
    kind: 'override-patch';
    beforeEntries: Record<string, unknown | null>;
    afterEntries: Record<string, unknown | null>;
}
export type EditorUndoCommand = EditorStatePatchCommand | EditorOverridePatchCommand;
export interface EditorUndoStackOptions {
    maxSize?: number;
    serializeState: () => string;
}
export interface PendingUndoableAction {
    label: string;
    before: string;
}
export declare function createStatePatchCommand(label: string, beforeState: string, afterState: string): EditorStatePatchCommand;
export declare function createOverridePatchCommand(label: string, beforeEntries: Record<string, unknown | null>, afterEntries: Record<string, unknown | null>): EditorOverridePatchCommand;
export declare function overridePatchChanged(beforeEntries: Record<string, unknown | null>, afterEntries: Record<string, unknown | null>): boolean;
export declare class EditorUndoStack {
    private readonly maxSize;
    private readonly serializeState;
    private undoStack;
    private redoStack;
    constructor(options: EditorUndoStackOptions);
    canUndo(): boolean;
    canRedo(): boolean;
    beginUndoableAction(label: string): PendingUndoableAction;
    commitUndoableAction(action: PendingUndoableAction | null | undefined): boolean;
    commitOverridePatchAction(label: string, beforeEntries: Record<string, unknown | null>, afterEntries: Record<string, unknown | null>): boolean;
    pushCommand(command: EditorUndoCommand): boolean;
    popUndo(): EditorUndoCommand | null;
    popRedo(): EditorUndoCommand | null;
    clear(): void;
}
//# sourceMappingURL=editor-undo-stack.d.ts.map