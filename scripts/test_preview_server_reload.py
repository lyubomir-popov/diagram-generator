"""Tests for preview_server TS pool wiring and TS-only SVG paths."""

from __future__ import annotations

import io
from http import HTTPStatus
from unittest.mock import MagicMock

import preview_server


def test_recreate_ts_preview_pools_replaces_instances():
    old_svg = preview_server._ts_svg_pool
    old_layout = preview_server._ts_layout_pool
    preview_server._recreate_ts_preview_pools()
    assert preview_server._ts_svg_pool is not old_svg
    assert preview_server._ts_layout_pool is not old_layout


def test_rebuild_recreates_ts_pools():
    old_svg = preview_server._ts_svg_pool
    assert preview_server._rebuild() is True
    assert preview_server._ts_svg_pool is not old_svg


def test_recreate_ts_preview_pools_calls_pool_from_env_on_imported_modules(monkeypatch):
    import types

    calls: list[str] = []
    fake_export = types.ModuleType("preview_ts_export")
    fake_layout = types.ModuleType("preview_ts_layout")
    fake_export.pool_from_env = lambda **_kw: calls.append("svg") or object()
    fake_layout.pool_from_env = lambda **_kw: calls.append("layout") or object()

    def fake_import(name: str):
        return {"preview_ts_export": fake_export, "preview_ts_layout": fake_layout}[name]

    monkeypatch.setattr(preview_server, "_import_ts_preview_module", fake_import)
    preview_server._recreate_ts_preview_pools()
    assert calls == ["svg", "layout"]


def test_watch_paths_include_ts_layout_and_node_clis():
    watched = {str(p) for p in preview_server.WATCH_PATHS}
    assert str(preview_server.SCRIPTS / "preview_ts_layout.py") in watched
    assert str(preview_server._TS_LAYOUT_SCRIPT) in watched
    assert str(preview_server._TS_EMIT_SCRIPT) in watched
    assert str(preview_server._LAYOUT_ENGINE_DIST) in watched
    assert str(preview_server.SCRIPTS / "layout_v3.py") not in watched
    assert str(preview_server.SCRIPTS / "diagram_render_svg.py") not in watched


def test_serve_v3_svg_bytes_ts_only_no_python_fallback(monkeypatch):
    monkeypatch.setattr(preview_server, "_render_svg_via_ts", lambda _slug: None)
    assert preview_server._serve_v3_svg_bytes("preview-smoke") is None


def test_serve_svg_v3_frame_yaml_ts_failure_returns_404(monkeypatch, tmp_path):
    slug = "preview-smoke"
    frame_yaml = tmp_path / f"{slug}.yaml"
    frame_yaml.write_text("engine: v3\nroot:\n  id: page\n", encoding="utf-8")
    monkeypatch.setattr(preview_server, "FRAMES_DIR", tmp_path)
    monkeypatch.setattr(preview_server, "_render_svg_via_ts", lambda _slug: None)

    handler = object.__new__(preview_server.PreviewHandler)
    handler.send_error = MagicMock()
    handler._respond = MagicMock()

    handler._serve_svg(f"v3:{slug}-onbrand-v3.svg")

    handler.send_error.assert_called_once()
    assert handler.send_error.call_args[0][0] == HTTPStatus.NOT_FOUND
    handler._respond.assert_not_called()


def test_preview_runtime_identity_reports_repo_branch_frames_and_port(monkeypatch):
    monkeypatch.setattr(preview_server, "_current_git_branch", lambda: "feat/runtime-identity")

    identity = preview_server._preview_runtime_identity(server_port=8123)

    assert identity == {
        "repoRoot": str(preview_server.ROOT),
        "branch": "feat/runtime-identity",
        "framesDir": str(preview_server.FRAMES_DIR),
        "pid": preview_server.os.getpid(),
        "port": 8123,
    }


def test_serve_runtime_identity_returns_json(monkeypatch):
    monkeypatch.setattr(preview_server, "_current_git_branch", lambda: "main")

    handler = object.__new__(preview_server.PreviewHandler)
    handler.server = type("Server", (), {"server_port": 8100})()
    handler._respond = MagicMock()

    handler._serve_runtime_identity()

    handler._respond.assert_called_once()
    status, content_type, body = handler._respond.call_args[0]
    assert status == HTTPStatus.OK
    assert content_type == "application/json"
    assert b'"branch": "main"' in body
    assert b'"port": 8100' in body
