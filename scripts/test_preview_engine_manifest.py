"""Regression coverage for TS-owned preview-engine manifest discovery."""

from __future__ import annotations

import json
import pathlib
import subprocess
import urllib.error
import urllib.request

import pytest
from test_preview_app_harness import preview_app

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load_manifest_from_source() -> list[dict[str, object]]:
    process = subprocess.run(
        [
            "node",
            "--import",
            "tsx",
            "--eval",
            (
                "import { serializePreviewEngineManifest } "
                "from '../../packages/layout-engine/src/index.ts'; "
                "console.log(JSON.stringify(serializePreviewEngineManifest()));"
            ),
        ],
        cwd=str(ROOT / "apps" / "preview"),
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(process.stdout)


def _fetch_json(url: str) -> object:
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.loads(resp.read().decode())


def _fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read().decode()


def _manifest_contract(payload: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        {
            "id": entry["id"],
            "shellMode": entry["shellMode"],
            "layoutEngineKey": entry.get("layoutEngineKey"),
            "scripts": entry.get("scripts", []),
            "apiRoutes": entry.get("apiRoutes"),
            "compatibility": entry.get("compatibility"),
            "capabilities": entry.get("capabilities"),
            "controlKeys": [spec["key"] for spec in entry.get("controlSpecs", [])],
        }
        for entry in payload
    ]


@pytest.fixture(scope="module")
def preview_base() -> str:
    with preview_app() as base:
        yield base


def test_preview_engine_manifest_json_exists_and_lists_hostable_preview_lanes():
    payload = _load_manifest_from_source()
    assert isinstance(payload, list)
    ids = [entry["id"] for entry in payload]
    assert ids == ["v3", "elk-layered", "force", "sequence"]

    native = payload[0]
    assert native["layoutEngineKey"] == "v3"
    assert native["shellMode"] == "grid"
    assert native["capabilities"]["localRelayout"] is True
    assert native["capabilities"]["gridEditing"] is True
    assert native["compatibility"]["documentKinds"] == ["frame-diagram"]

    elk = payload[1]
    assert elk["layoutEngineKey"] == "elk-layered"
    assert elk["shellMode"] == "grid"
    assert elk["capabilities"]["layoutControls"] is True
    assert any(spec["key"] == "elk.direction" for spec in elk["controlSpecs"])
    assert elk["compatibility"]["documentKinds"] == ["frame-diagram"]
    assert elk["compatibility"]["requiredLayoutEngineKey"] == "elk-layered"

    force = payload[2]
    assert force["shellMode"] == "force"
    assert force["capabilities"]["simulationControls"] is True
    assert force["apiRoutes"]["save"] == "/api/force-save/{slug}"
    assert force["apiRoutes"]["spec"] == "/api/force-spec/{slug}"
    assert "params" not in force["apiRoutes"]
    assert force["compatibility"]["documentKinds"] == ["force-spec"]

    sequence = payload[3]
    assert sequence["layoutEngineKey"] == "sequence"
    assert sequence["compatibility"]["documentKinds"] == ["sequence"]


def test_preview_engines_route_matches_built_manifest(preview_base: str):
    from_route = _fetch_json(f"{preview_base}/api/preview-engines")
    assert _manifest_contract(from_route) == _manifest_contract(_load_manifest_from_source())


def test_frame_diagram_view_injects_resolved_native_v3_engine(preview_base: str):
    html = _fetch_text(f"{preview_base}/view/v3:preview-smoke")

    assert '"layout_engine":"v3"' in html
    assert '"compatible_engines":["v3","elk-layered"]' in html


def test_runtime_identity_reports_node_preview_app(preview_base: str):
    payload = _fetch_json(f"{preview_base}/api/runtime-identity")
    assert payload["ok"] is True
    assert payload["app"] == "@diagram-generator/preview-app"
    assert payload["repoRoot"] == str(ROOT)
    assert payload["appRoot"].endswith(str(pathlib.Path("apps") / "preview"))
    assert payload["framesDir"].endswith(str(pathlib.Path("scripts") / "diagrams" / "frames"))
    assert isinstance(payload["pid"], int)
    assert isinstance(payload["port"], int)
    assert payload["node"].startswith("v")


def test_overrides_post_returns_canonical_state(tmp_path: pathlib.Path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    slug = "preview-smoke"
    source = ROOT / "scripts" / "diagrams" / "frames" / f"{slug}.yaml"
    target = frames_dir / f"{slug}.yaml"
    target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    with preview_app(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base:
        request = urllib.request.Request(
            f"{base}/api/overrides/{slug}",
            data=json.dumps({"overrides": {}, "grid_overrides": {}}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=60) as resp:
            payload = json.loads(resp.read().decode())

    assert payload["ok"] is True
    assert payload["canonicalState"]["slug"] == slug
    assert payload["canonicalState"]["previewDocument"] == {
        "kind": "frame-diagram",
        "slug": slug,
        "title": "Preview smoke",
        "layoutEngine": None,
        "shellMode": "grid",
        "frameTree": payload["canonicalState"]["frameTree"],
    }
    assert payload["canonicalState"]["componentTree"][0]["id"] == "page"
    assert payload["canonicalState"]["gridInfo"]["col_gap"] == 24


def test_frame_diagram_view_omits_elk_for_arrowless_docs(tmp_path: pathlib.Path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    slug = "arrowless"
    (frames_dir / f"{slug}.yaml").write_text(
        "\n".join(
            [
                "engine: v3",
                "title: Arrowless",
                "root:",
                "  id: page",
                "  direction: vertical",
                "  children:",
                "    - id: only_box",
                "      label: [Only box]",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with preview_app(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base:
        html = _fetch_text(f"{base}/view/v3:{slug}")

    assert '"layout_engine":"v3"' in html
    assert '"compatible_engines":["v3"]' in html


def test_frame_diagram_view_falls_back_from_stale_elk_on_arrowless_doc(tmp_path: pathlib.Path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    slug = "arrowless-stale-elk"
    (frames_dir / f"{slug}.yaml").write_text(
        "\n".join(
            [
                "engine: v3",
                "title: Arrowless stale elk",
                "meta:",
                "  layout_engine: elk-layered",
                "root:",
                "  id: page",
                "  direction: vertical",
                "  children:",
                "    - id: only_box",
                "      label: [Only box]",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with preview_app(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base:
        html = _fetch_text(f"{base}/view/v3:{slug}")

    assert '"layout_engine":"v3"' in html
    assert '"compatible_engines":["v3"]' in html


def test_overrides_rejects_elk_for_arrowless_docs_over_http(tmp_path: pathlib.Path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    slug = "arrowless"
    (frames_dir / f"{slug}.yaml").write_text(
        "\n".join(
            [
                "engine: v3",
                "title: Arrowless",
                "root:",
                "  id: page",
                "  direction: vertical",
                "  children:",
                "    - id: only_box",
                "      label: [Only box]",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with preview_app(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base:
        request = urllib.request.Request(
            f"{base}/api/overrides/{slug}",
            data=json.dumps({"layout_engine": "elk-layered"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(request, timeout=60)

    assert exc_info.value.code == 400
    body = exc_info.value.read().decode()
    assert "Cannot use engine 'elk-layered'" in body
    assert "requires at least one authored arrow" in body
