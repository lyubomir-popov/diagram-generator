export type {
  EditorSnapshot,
  EditorSnapshotInput,
} from './editor-snapshot.js';

export {
  captureEditorSnapshot,
  cloneEditorSnapshotValue,
  normalizeGridOverrides,
  parseEditorSnapshot,
  serializeEditorSnapshot,
} from './editor-snapshot.js';

export type {
  EditorOverridePatchCommand,
  EditorStatePatchCommand,
  EditorUndoCommand,
  EditorUndoStackOptions,
  PendingUndoableAction,
} from './editor-undo-stack.js';

export {
  EditorUndoStack,
  createOverridePatchCommand,
  createStatePatchCommand,
  overridePatchChanged,
} from './editor-undo-stack.js';

export type {
  EditorStateStoreDeps,
  EditorStateStoreOptions,
} from './editor-state-store.js';

export {
  EditorStateStore,
  captureOverrideEntries,
  createEditorStateStore,
} from './editor-state-store.js';

export {
  PERSIST_FRAME_KEYS,
  UNSUPPORTED_PERSIST_FRAME_KEYS,
  PERSIST_INT_FRAME_KEYS,
  PERSIST_LOWER_FRAME_KEYS,
  RELAYOUT_FRAME_KEYS,
  UNDO_RELAYOUT_FRAME_KEYS,
  hasV3FrameOverride,
  filterRelayoutOverrideEntry,
  type PersistFrameKey,
  type RelayoutFrameKey,
} from './frame-override-manifest.js';
