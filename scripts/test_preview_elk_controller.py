"""Regression: ELK controller extracted from editor.js (spec 026 T011)."""

from __future__ import annotations

import pathlib

import preview_server

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "scripts" / "preview"


def test_elk_controller_module_exists():
    path = PREVIEW / "elk-controller.js"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "ElkPreviewController" in text
    assert "isElkLayeredDiagram" in text
    assert "requestRelayout" in text
    assert "resolvePreviewEngine" in text


def test_elk_shell_scripts_live_in_unified_template():
    unified = (PREVIEW / "viewer-unified.html").read_text(encoding="utf-8")
    assert "elk-controller.js" not in unified
    assert "elk-layout-controls.js" not in unified


def test_built_elk_viewer_html_includes_manifest_scripts():
    html = preview_server._build_viewer_html("v3:juju-bootstrap-machines-process", [], False)
    assert "/preview/elk-layout-controls.js" in html
    assert "/preview/elk-controller.js" in html


def test_editor_delegates_elk_wiring_to_controller():
    editor = (PREVIEW / "editor.js").read_text(encoding="utf-8")
    assert "ElkPreviewController.init" in editor
    assert "function _isElkLayeredDiagram" not in editor
    assert "window.requestElkRelayout = async function" not in editor
    assert "window.__DG_applyElkLayoutOverrides = function" not in editor
