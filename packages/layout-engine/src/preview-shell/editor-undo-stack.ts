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

export function createStatePatchCommand(
  label: string,
  beforeState: string,
  afterState: string,
): EditorStatePatchCommand {
  return { label, before: beforeState, after: afterState };
}

export function createOverridePatchCommand(
  label: string,
  beforeEntries: Record<string, unknown | null>,
  afterEntries: Record<string, unknown | null>,
): EditorOverridePatchCommand {
  return { label, kind: 'override-patch', beforeEntries, afterEntries };
}

export function overridePatchChanged(
  beforeEntries: Record<string, unknown | null>,
  afterEntries: Record<string, unknown | null>,
): boolean {
  return JSON.stringify(beforeEntries) !== JSON.stringify(afterEntries);
}

export class EditorUndoStack {
  private readonly maxSize: number;
  private readonly serializeState: () => string;
  private undoStack: EditorUndoCommand[] = [];
  private redoStack: EditorUndoCommand[] = [];

  constructor(options: EditorUndoStackOptions) {
    this.maxSize = options.maxSize ?? 50;
    this.serializeState = options.serializeState;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  beginUndoableAction(label: string): PendingUndoableAction {
    return { label, before: this.serializeState() };
  }

  commitUndoableAction(action: PendingUndoableAction | null | undefined): boolean {
    if (!action) return false;
    const after = this.serializeState();
    if (action.before === after) return false;
    return this.pushCommand(createStatePatchCommand(action.label, action.before, after));
  }

  commitOverridePatchAction(
    label: string,
    beforeEntries: Record<string, unknown | null>,
    afterEntries: Record<string, unknown | null>,
  ): boolean {
    if (!overridePatchChanged(beforeEntries, afterEntries)) return false;
    return this.pushCommand(createOverridePatchCommand(label, beforeEntries, afterEntries));
  }

  pushCommand(command: EditorUndoCommand): boolean {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return true;
  }

  popUndo(): EditorUndoCommand | null {
    if (!this.canUndo()) return null;
    const command = this.undoStack.pop() ?? null;
    if (command) this.redoStack.push(command);
    return command;
  }

  popRedo(): EditorUndoCommand | null {
    if (!this.canRedo()) return null;
    const command = this.redoStack.pop() ?? null;
    if (command) this.undoStack.push(command);
    return command;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
