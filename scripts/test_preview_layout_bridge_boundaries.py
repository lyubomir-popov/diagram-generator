"""Regression: layout-bridge stays runtime-focused after shell extraction (spec 026 T031)."""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "scripts" / "preview"
BOUNDARIES = (
    ROOT / "specs" / "026-preview-shell-decomposition-ts-migration" / "boundaries.md"
)


def test_layout_bridge_does_not_depend_on_shell_modules():
    text = (PREVIEW / "layout-bridge.js").read_text(encoding="utf-8")
    forbidden = [
        "PreviewSaveClient",
        "EditorState",
        "ElkPreviewController",
        "save-client.js",
        "editor-state.js",
        "elk-controller.js",
    ]
    for name in forbidden:
        assert name not in text, f"layout-bridge must not reference shell module: {name}"


def test_layout_bridge_exports_runtime_surface():
    text = (PREVIEW / "layout-bridge.js").read_text(encoding="utf-8")
    required_symbols = [
        "function performLocalRelayout",
        "window.renderFreshSvg",
        "window.getFrameTreeJson",
        "window.setFrameTreeJson",
        "window.isLocalRelayoutReady",
    ]
    for symbol in required_symbols:
        assert symbol in text, f"missing runtime symbol: {symbol}"


def test_shell_modules_do_not_reimplement_layout_bridge():
    save_client = (PREVIEW / "save-client.js").read_text(encoding="utf-8")
    editor_state = (PREVIEW / "editor-state.js").read_text(encoding="utf-8")
    elk_controller = (PREVIEW / "elk-controller.js").read_text(encoding="utf-8")
    for label, text in [
        ("save-client.js", save_client),
        ("editor-state.js", editor_state),
        ("elk-controller.js", elk_controller),
    ]:
        assert "function performLocalRelayout" not in text, label
        assert "function renderFreshSvg" not in text, label
        assert "applyOverridesToFrameTree" not in text, label


def test_boundary_doc_exists():
    assert BOUNDARIES.is_file()
    text = BOUNDARIES.read_text(encoding="utf-8")
    assert "`layout-bridge.js` reassessment" in text
    assert "editor.js extraction map" in text.lower().replace("`", "")
