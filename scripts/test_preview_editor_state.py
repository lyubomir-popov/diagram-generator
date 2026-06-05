"""Regression: editor state extracted to editor-state.js (spec 026 T012/T020)."""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "scripts" / "preview"
PREVIEW_SHELL = ROOT / "packages" / "layout-engine" / "src" / "preview-shell"


def test_editor_state_module_exists():
    path = PREVIEW / "editor-state.js"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "EditorState" in text
    assert "serializeDirtyState" in text
    assert "getPendingGridAction" in text
    assert "clearUndoHistory" in text


def test_editor_state_js_is_thin_adapter_over_ts_store():
    text = (PREVIEW / "editor-state.js").read_text(encoding="utf-8")
    assert "LayoutEngine.createEditorStateStore" in text
    assert "_undoStack" not in text
    assert "MAX_UNDO_STACK_SIZE" not in text
    assert "createUndoCommand" not in text
    assert "function updateUndoRedoButtons" in text


def test_ts_preview_shell_owns_undo_and_state_store():
    undo_stack = (PREVIEW_SHELL / "editor-undo-stack.ts").read_text(encoding="utf-8")
    state_store = (PREVIEW_SHELL / "editor-state-store.ts").read_text(encoding="utf-8")
    browser_entry = (ROOT / "packages" / "layout-engine" / "src" / "browser-entry.ts").read_text(
        encoding="utf-8"
    )
    assert "export class EditorUndoStack" in undo_stack
    assert "export class EditorStateStore" in state_store
    assert "createEditorStateStore" in browser_entry


def test_unified_shell_loads_editor_state_before_mode_scripts():
    html = (PREVIEW / "viewer-unified.html").read_text(encoding="utf-8")
    state_idx = html.index("editor-state.js")
    mode_idx = html.index("%MODE_SCRIPTS%")
    assert state_idx < mode_idx
    assert "save-client.js" in html


def test_editor_delegates_state_to_editor_state_container():
    editor = (PREVIEW / "editor.js").read_text(encoding="utf-8")
    assert "EditorState.init" in editor
    assert "_initEditorState" in editor
    assert "EditorState.serializeDirtyState" in editor
    assert "EditorState.beginUndoableAction" in editor
    assert "EditorState.undo" in editor
    assert "EditorState.getPendingGridAction" in editor
    assert "undoStack" not in editor
    assert "redoStack" not in editor
    assert "pendingGridAction" not in editor


def test_ts_editor_snapshot_helpers_are_exported():
    browser_entry = (ROOT / "packages" / "layout-engine" / "src" / "browser-entry.ts").read_text(
        encoding="utf-8"
    )
    snapshot = (PREVIEW_SHELL / "editor-snapshot.ts").read_text(encoding="utf-8")
    assert "captureEditorSnapshot" in browser_entry
    assert "normalizeGridOverrides" in browser_entry
    assert "export function captureEditorSnapshot" in snapshot
