"""Tests for preview_server hot-reload of TS preview pools."""

from __future__ import annotations

import importlib

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


def test_watch_paths_include_ts_layout_and_node_clis():
    watched = {str(p) for p in preview_server.WATCH_PATHS}
    assert str(preview_server.SCRIPTS / "preview_ts_layout.py") in watched
    assert str(preview_server._TS_LAYOUT_SCRIPT) in watched
    assert str(preview_server._TS_EMIT_SCRIPT) in watched
    assert str(preview_server._LAYOUT_ENGINE_DIST) in watched
