# Spec 017 – Preview editor frame delete

**Created**: 2026-06-03  
**Status**: Complete  
**Input**: `AGENT-INBOX.md` — restore interactive frame deletion

## Mission

Allow authors to remove frames from v3 diagrams in the preview editor via keyboard and component-tree context menu. Deletions mutate the in-memory frame tree, relayout locally, and persist to canonical YAML on save.

## Behavior

- **Delete** / **Backspace**: delete all selected non-root frames (subtree included).
- **Context menu** on tree row: Delete frame.
- Cannot delete diagram root (`page` / root id).
- Arrows referencing removed frames are dropped from YAML.
- Undo/redo restores frame-tree snapshot + override state.

## Deliverables

1. `layout-bridge.js` — `applyFrameTreeRemovals`, `getFrameTreeJson` / `setFrameTreeJson`
2. `component-model.js` — `removedIds`, `toOverridePayload().removed_ids`
3. `frame_yaml_persistence.py` — apply `removed_ids` on save
4. `editor.js` — `deleteSelectedFrames`, shortcuts, context menu
5. Tests: `test_frame_yaml_persistence.py`, `test_preview_frame_delete.py` (Node removals)
