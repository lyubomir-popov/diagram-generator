"""HTTP smoke tests for TS preview API (frame-tree, grid, component tree)."""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import urllib.error
import urllib.request

import pytest
from test_preview_app_harness import preview_app

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLUG = "preview-smoke"


def _fetch_json(url: str) -> tuple[int, object]:
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else ""
        try:
            payload = json.loads(body) if body else None
        except json.JSONDecodeError:
            payload = body
        return exc.code, payload


@pytest.fixture(scope="module")
def preview_base() -> str:
    with preview_app() as base:
        yield base


def test_frame_tree_from_ts(preview_base: str):
    status, data = _fetch_json(f"{preview_base}/api/frame-tree/{SLUG}")
    assert status == 200
    assert isinstance(data, dict)
    assert data.get("title")
    assert isinstance(data.get("root"), dict)


def test_grid_from_ts(preview_base: str):
    status, data = _fetch_json(f"{preview_base}/api/grid/{SLUG}")
    assert status == 200
    assert isinstance(data, dict)
    assert "col_xs" in data
    assert "baseline_step" in data


def test_component_tree_from_ts(preview_base: str):
    status, data = _fetch_json(f"{preview_base}/api/tree/{SLUG}")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0].get("id") == "page"


def test_frame_tree_404_unknown_slug(preview_base: str):
    status, _ = _fetch_json(f"{preview_base}/api/frame-tree/no-such-diagram-xyz")
    assert status == 404
