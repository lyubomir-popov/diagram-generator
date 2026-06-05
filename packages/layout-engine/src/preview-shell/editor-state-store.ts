/**
 * Preview editor state store: snapshots + undo/redo (spec 026 T020).
 */

import {
  captureEditorSnapshot,
  cloneEditorSnapshotValue,
  normalizeGridOverrides,
  serializeEditorSnapshot,
} from './editor-snapshot.js';
import type { EditorSnapshot, EditorSnapshotInput } from './editor-snapshot.js';
import {
  EditorUndoStack,
  type PendingUndoableAction,
} from './editor-undo-stack.js';

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

export function captureOverrideEntries(
  overrides: Record<string, unknown>,
  ids: Iterable<string> | null | undefined,
): Record<string, unknown | null> {
  const snapshot: Record<string, unknown | null> = {};
  const orderedIds = [...new Set(ids ?? [])].sort();
  for (const cid of orderedIds) {
    const entry = overrides[cid];
    snapshot[cid] = entry ? cloneEditorSnapshotValue(entry) : null;
  }
  return snapshot;
}

export class EditorStateStore {
  private readonly deps: EditorStateStoreDeps;
  private readonly undoStack: EditorUndoStack;
  private pendingGridAction: PendingUndoableAction | null = null;

  constructor(deps: EditorStateStoreDeps, options: EditorStateStoreOptions = {}) {
    this.deps = deps;
    this.undoStack = new EditorUndoStack({
      maxSize: options.maxUndoSize ?? 50,
      serializeState: () => this.serializeDirtyState(),
    });
  }

  private snapshotInput(): EditorSnapshotInput {
    return {
      overrides: this.deps.getOverrides(),
      gridOverrides: this.deps.getGridOverrides(),
      elkLayoutOverrides: this.deps.getElkLayoutOverrides(),
      removedIds: this.deps.getRemovedIds(),
      frameTree: this.deps.getFrameTree(),
    };
  }

  captureSnapshot(): EditorSnapshot {
    return captureEditorSnapshot(this.snapshotInput());
  }

  serializeDirtyState(): string {
    return serializeEditorSnapshot(this.captureSnapshot());
  }

  normalizeGridOverrides(
    gridOverrides: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    return normalizeGridOverrides(gridOverrides);
  }

  beginUndoableAction(label: string): PendingUndoableAction {
    return this.undoStack.beginUndoableAction(label);
  }

  commitUndoableAction(action: PendingUndoableAction | null | undefined): boolean {
    return this.undoStack.commitUndoableAction(action);
  }

  commitOverridePatchAction(
    label: string,
    beforeEntries: Record<string, unknown | null>,
    afterEntries: Record<string, unknown | null>,
  ): boolean {
    return this.undoStack.commitOverridePatchAction(label, beforeEntries, afterEntries);
  }

  runUndoableAction<T>(label: string, mutate: () => T): T {
    const action = this.beginUndoableAction(label);
    const result = mutate();
    this.commitUndoableAction(action);
    return result;
  }

  pushUndoCommand(command: Parameters<EditorUndoStack['pushCommand']>[0]): boolean {
    return this.undoStack.pushCommand(command);
  }

  captureOverrideEntries(ids: Iterable<string> | null | undefined): Record<string, unknown | null> {
    return captureOverrideEntries(this.deps.getOverrides(), ids);
  }

  canUndo(): boolean {
    return this.undoStack.canUndo();
  }

  canRedo(): boolean {
    return this.undoStack.canRedo();
  }

  popUndoCommand() {
    return this.undoStack.popUndo();
  }

  popRedoCommand() {
    return this.undoStack.popRedo();
  }

  clearUndoHistory(): void {
    this.undoStack.clear();
    this.pendingGridAction = null;
  }

  getPendingGridAction(): PendingUndoableAction | null {
    return this.pendingGridAction;
  }

  setPendingGridAction(action: PendingUndoableAction | null): void {
    this.pendingGridAction = action;
  }
}

export function createEditorStateStore(
  deps: EditorStateStoreDeps,
  options?: EditorStateStoreOptions,
): EditorStateStore {
  return new EditorStateStore(deps, options);
}
