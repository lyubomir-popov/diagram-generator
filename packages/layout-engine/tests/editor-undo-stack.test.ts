import { describe, expect, it } from 'vitest';
import {
  EditorUndoStack,
  createOverridePatchCommand,
  createStatePatchCommand,
  overridePatchChanged,
} from '../src/preview-shell/editor-undo-stack.js';

describe('editor undo stack', () => {
  it('tracks state patch commands and clears redo on push', () => {
    let serialized = 'a';
    const stack = new EditorUndoStack({
      serializeState: () => serialized,
    });

    stack.pushCommand(createStatePatchCommand('Move', 'a', 'b'));
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    serialized = 'b';
    const redoCommand = stack.popUndo();
    expect(redoCommand?.label).toBe('Move');
    expect(stack.canRedo()).toBe(true);

    stack.pushCommand(createStatePatchCommand('Resize', 'b', 'c'));
    expect(stack.canRedo()).toBe(false);
  });

  it('commits undoable actions only when serialized state changes', () => {
    let serialized = '{"o":{}}';
    const stack = new EditorUndoStack({
      serializeState: () => serialized,
    });

    const action = stack.beginUndoableAction('Edit text');
    serialized = '{"o":{}}';
    expect(stack.commitUndoableAction(action)).toBe(false);

    serialized = '{"o":{"n1":{"text":"hi"}}}';
    expect(stack.commitUndoableAction(action)).toBe(true);
    expect(stack.canUndo()).toBe(true);
  });

  it('commits override patch commands when entries differ', () => {
    const stack = new EditorUndoStack({
      serializeState: () => '{}',
    });

    const before = { n1: { text: 'a' } };
    const after = { n1: { text: 'b' } };
    expect(overridePatchChanged(before, after)).toBe(true);
    expect(
      stack.commitOverridePatchAction('Patch override', before, after),
    ).toBe(true);

    const command = stack.popUndo();
    expect(command).toEqual(createOverridePatchCommand('Patch override', before, after));
  });

  it('caps undo history at maxSize', () => {
    const stack = new EditorUndoStack({
      maxSize: 2,
      serializeState: () => '{}',
    });

    stack.pushCommand(createStatePatchCommand('one', '1', '2'));
    stack.pushCommand(createStatePatchCommand('two', '2', '3'));
    stack.pushCommand(createStatePatchCommand('three', '3', '4'));

    expect(stack.popUndo()?.label).toBe('three');
    expect(stack.popUndo()?.label).toBe('two');
    expect(stack.canUndo()).toBe(false);
  });
});
