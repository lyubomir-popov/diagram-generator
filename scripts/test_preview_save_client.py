"""Regression: save/reload orchestration extracted to save-client.js (spec 026 T010)."""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "scripts" / "preview"


def test_save_client_module_exists():
    path = PREVIEW / "save-client.js"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "PreviewSaveClient" in text
    assert "saveOverrides" in text
    assert "reloadDiagram" in text


def test_unified_shell_keeps_shared_scripts_only():
    html = (PREVIEW / "viewer-unified.html").read_text(encoding="utf-8")
    assert "save-client.js" in html
    assert "engine-interface.js" in html
    assert "elk-controller.js" not in html
    assert "elk-layout-controls.js" not in html


def test_editor_delegates_save_orchestration_to_save_client():
    editor = (PREVIEW / "editor.js").read_text(encoding="utf-8")
    assert "PreviewSaveClient.init" in editor
    assert "async function saveOverrides" not in editor
    assert 'document.getElementById("btn-save").addEventListener' not in editor


def test_save_client_threads_canonical_state_into_reload_path():
    text = (PREVIEW / "save-client.js").read_text(encoding="utf-8")
    assert "canonicalState" in text
    assert "await resp.json()" in text
    assert "reloadDiagram({ preserveSelectionIds: preservedSelectionIds, canonicalState })" in text


def test_editor_loadsvg_accepts_canonical_state_overrides():
    editor = (PREVIEW / "editor.js").read_text(encoding="utf-8")
    assert "const canonicalState = options.canonicalState" in editor
    assert "await loadTree(canonicalState)" in editor
    assert "await loadGridInfo(canonicalState)" in editor
