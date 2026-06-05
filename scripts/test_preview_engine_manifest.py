"""Regression coverage for TS-owned preview-engine manifest discovery (spec 025 T003)."""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
from http import HTTPStatus
from unittest.mock import MagicMock

import preview_server

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "packages" / "layout-engine" / "dist" / "preview-engine-manifest.json"


def _ensure_manifest_built() -> None:
    npm_executable = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run(
        [npm_executable, "run", "build:browser"],
        cwd=str(ROOT / "packages" / "layout-engine"),
        check=True,
        capture_output=True,
        text=True,
    )


def test_preview_engine_manifest_json_exists_and_lists_elk_and_force():
    _ensure_manifest_built()
    payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, list)
    ids = [entry["id"] for entry in payload]
    assert ids == ["elk-layered", "force"]

    elk = payload[0]
    assert elk["layoutEngineKey"] == "elk-layered"
    assert elk["shellMode"] == "grid"
    assert elk["capabilities"]["layoutControls"] is True
    assert any(spec["key"] == "elk.direction" for spec in elk["controlSpecs"])

    force = payload[1]
    assert force["shellMode"] == "force"
    assert force["capabilities"]["simulationControls"] is True
    assert force["apiRoutes"]["save"] == "/api/force-save/{slug}"
    assert force["apiRoutes"]["params"] == "/api/force-params/{slug}"


def test_load_preview_engine_manifest_helper_matches_json_file():
    _ensure_manifest_built()
    from_file = preview_server._load_preview_engine_manifest()
    from_disk = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert from_file == from_disk


def test_serve_preview_engines_returns_ts_manifest_json():
    _ensure_manifest_built()

    handler = object.__new__(preview_server.PreviewHandler)
    handler._respond = MagicMock()

    handler._serve_preview_engines()

    handler._respond.assert_called_once()
    status, content_type, body = handler._respond.call_args[0]
    assert status == HTTPStatus.OK
    assert content_type == "application/json"
    payload = json.loads(body.decode())
    assert [entry["id"] for entry in payload] == ["elk-layered", "force"]


def test_overrides_post_returns_canonical_state(monkeypatch):
    handler = object.__new__(preview_server.PreviewHandler)
    body = json.dumps({"overrides": {}, "grid_overrides": {}}).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = __import__("io").BytesIO(body)
    handler._respond = MagicMock()

    monkeypatch.setattr(preview_server, "_save_overrides", lambda slug, data: None)
    monkeypatch.setattr(preview_server._ts_layout_pool, "frame_tree_json", lambda slug: {"root": {"id": "root"}})
    monkeypatch.setattr(preview_server, "_get_component_tree", lambda slug: [{"id": "root"}])
    monkeypatch.setattr(preview_server, "_get_grid_info", lambda slug: {"col_gap": 24})

    handler._serve_overrides_post("preview-smoke")

    handler._respond.assert_called_once()
    status, content_type, response_body = handler._respond.call_args[0]
    assert status == HTTPStatus.OK
    assert content_type == "application/json"
    payload = json.loads(response_body.decode())
    assert payload["ok"] is True
    assert payload["canonicalState"]["slug"] == "preview-smoke"
    assert payload["canonicalState"]["frameTree"] == {"root": {"id": "root"}}
    assert payload["canonicalState"]["componentTree"] == [{"id": "root"}]
    assert payload["canonicalState"]["gridInfo"] == {"col_gap": 24}
