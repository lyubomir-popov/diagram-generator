"""Regression: ELK controller stays wired through the unified preview shell."""

from __future__ import annotations

import pathlib
import urllib.request

import pytest
from test_preview_app_harness import preview_app

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "scripts" / "preview"


def _fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read().decode()


@pytest.fixture(scope="module")
def preview_base() -> str:
    with preview_app() as base:
        yield base


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


def test_elk_viewer_html_includes_manifest_scripts(preview_base: str):
    html = _fetch_text(f"{preview_base}/view/v3:juju-bootstrap-machines-process")
    assert "/preview/elk-layout-controls.js" in html
    assert "/preview/elk-controller.js" in html


def test_editor_delegates_elk_wiring_to_controller():
    editor = (PREVIEW / "editor.js").read_text(encoding="utf-8")
    assert "ElkPreviewController.init" in editor
    assert "function _isElkLayeredDiagram" not in editor
    assert "window.requestElkRelayout = async function" not in editor
    assert "window.__DG_applyElkLayoutOverrides = function" not in editor
