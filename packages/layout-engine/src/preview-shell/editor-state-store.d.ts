/**
 * Preview editor state store: snapshots + undo/redo (spec 026 T020).
 */
import type { EditorSnapshot } from './editor-snapshot.js';
import { EditorUndoStack, type PendingUndoableAction } from './editor-undo-stack.js';
export interface EditorStateStoreDeps {
    getOverrides: () => Record<string, unknown>;
    getGridOverrides: () => Record<string, unknown> | null | undefined;
    getElkLayoutOverrides: () => Record<string, unknown> | null | undefined;
    getRemovedIds: () => Iterable<string> | null | undefined;
    getFrameTree: () => unknown | null | undefined;
}
export interface EditorStateStoreOptions {
    maxUndoSize?: number;
}
export declare function captureOverrideEntries(overrides: Record<string, unknown>, ids: Iterable<string> | null | undefined): Record<string, unknown | null>;
export declare class EditorStateStore {
    private readonly deps;
    private readonly undoStack;
    private pendingGridAction;
    constructor(deps: EditorStateStoreDeps, options?: EditorStateStoreOptions);
    private snapshotInput;
    captureSnapshot(): EditorSnapshot;
    serializeDirtyState(): string;
    normalizeGridOverrides(gridOverrides: Record<string, unknown> | null | undefined): Record<string, unknown>;
    beginUndoableAction(label: string): PendingUndoableAction;
    commitUndoableAction(action: PendingUndoableAction | null | undefined): boolean;
    commitOverridePatchAction(label: string, beforeEntries: Record<string, unknown | null>, afterEntries: Record<string, unknown | null>): boolean;
    runUndoableAction<T>(label: string, mutate: () => T): T;
    pushUndoCommand(command: Parameters<EditorUndoStack['pushCommand']>[0]): boolean;
    captureOverrideEntries(ids: Iterable<string> | null | undefined): Record<string, unknown | null>;
    canUndo(): boolean;
    canRedo(): boolean;
    popUndoCommand(): import("./editor-undo-stack.js").EditorUndoCommand | null;
    popRedoCommand(): import("./editor-undo-stack.js").EditorUndoCommand | null;
    clearUndoHistory(): void;
    getPendingGridAction(): PendingUndoableAction | null;
    setPendingGridAction(action: PendingUndoableAction | null): void;
}
export declare function createEditorStateStore(deps: EditorStateStoreDeps, options?: EditorStateStoreOptions): EditorStateStore;
//# sourceMappingURL=editor-state-store.d.ts.map