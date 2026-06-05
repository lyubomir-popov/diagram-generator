import { describe, expect, it } from 'vitest';
import {
  EditorStateStore,
  captureOverrideEntries,
  createEditorStateStore,
} from '../src/preview-shell/editor-state-store.js';

describe('editor state store', () => {
  it('serializes dirty state from injected deps', () => {
    const store = createEditorStateStore({
      getOverrides: () => ({ root: { gap: 8 } }),
      getGridOverrides: () => ({ cols: 12 }),
      getElkLayoutOverrides: () => ({ direction: 'RIGHT' }),
      getRemovedIds: () => ['a'],
      getFrameTree: () => ({ id: 'root' }),
    });

    const snapshot = store.captureSnapshot();
    expect(snapshot.o).toEqual({ root: { gap: 8 } });
    expect(snapshot.g).toEqual({ cols: 12 });
    expect(snapshot.e).toEqual({ direction: 'RIGHT' });
    expect(snapshot.r).toEqual(['a']);
    expect(snapshot.f).toEqual({ id: 'root' });
    expect(JSON.parse(store.serializeDirtyState())).toEqual(snapshot);
  });

  it('captures override entries without sharing references', () => {
    const overrides = { n1: { text: 'hello' }, n2: { gap: 4 } };
    const captured = captureOverrideEntries(overrides, ['n2', 'n1', 'missing']);
    expect(Object.keys(captured)).toEqual(['missing', 'n1', 'n2']);
    expect(captured.n1).toEqual({ text: 'hello' });
    expect(captured.missing).toBeNull();
    captured.n1!.text = 'changed';
    expect(overrides.n1).toEqual({ text: 'hello' });
  });

  it('runs undoable actions through the embedded undo stack', () => {
    let gap = 4;
    const store = new EditorStateStore({
      getOverrides: () => ({ root: { gap } }),
      getGridOverrides: () => ({}),
      getElkLayoutOverrides: () => ({}),
      getRemovedIds: () => null,
      getFrameTree: () => null,
    });

    store.runUndoableAction('Adjust gap', () => {
      gap = 12;
    });
    expect(store.canUndo()).toBe(true);

    const command = store.popUndoCommand();
    expect(command?.label).toBe('Adjust gap');
    if (command && 'before' in command) {
      expect(JSON.parse(command.before).o.root.gap).toBe(4);
      expect(JSON.parse(command.after).o.root.gap).toBe(12);
    }
  });

  it('tracks pending grid actions separately from undo history', () => {
    const store = createEditorStateStore({
      getOverrides: () => ({}),
      getGridOverrides: () => ({}),
      getElkLayoutOverrides: () => ({}),
      getRemovedIds: () => null,
      getFrameTree: () => null,
    });

    const pending = store.beginUndoableAction('Adjust grid');
    store.setPendingGridAction(pending);
    expect(store.getPendingGridAction()).toEqual(pending);

    store.clearUndoHistory();
    expect(store.getPendingGridAction()).toBeNull();
  });
});
