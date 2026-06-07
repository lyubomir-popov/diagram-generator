"""HTTP smoke tests for force preview discovery and TS-local save persistence."""

from __future__ import annotations

import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
FORCE_SLUGS = [
    "force-stakeholders",
    "force-juju-landing-pages",
    "force-support-case-lifecycle",
]


def _reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(base_url: str, process: subprocess.Popen[str], timeout: float = 90.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(
                f"Preview server exited with code {process.returncode}.\n{output}"
            )
        try:
            with urllib.request.urlopen(base_url, timeout=1):
                return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Preview server did not start at {base_url}")


def _fetch_json(url: str, data: bytes | None = None) -> tuple[int, object]:
    request = urllib.request.Request(url, data=data)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else ""
        try:
            payload = json.loads(body) if body else None
        except json.JSONDecodeError:
            payload = body
        return exc.code, payload


def _fetch_text(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else ""
        return exc.code, body


@pytest.fixture(scope="module")
def preview_base() -> str:
    port = _reserve_port()
    env = os.environ.copy()
    env["DG_DISABLE_TS_EXPORT"] = "1"
    process = subprocess.Popen(
        [
            sys.executable,
            str(SCRIPTS / "preview_server.py"),
            "--port",
            str(port),
            "--no-watch",
        ],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        _wait_for_server(base, process)
        yield base
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def test_force_demo_routes_are_discoverable(preview_base: str):
    status, index_html = _fetch_text(f"{preview_base}/")
    assert status == 200
    for slug in FORCE_SLUGS:
        assert f'/force/view/{slug}' in index_html

    status, force_index_html = _fetch_text(f"{preview_base}/force")
    assert status == 200
    for slug in FORCE_SLUGS:
        assert f'/force/view/{slug}' in force_index_html

    for slug in FORCE_SLUGS:
        status, viewer_html = _fetch_text(f"{preview_base}/force/view/{slug}")
        assert status == 200
        assert f'"slug":"{slug}"' in viewer_html
        assert "/preview/force.js" in viewer_html

        status, spec = _fetch_json(f"{preview_base}/api/force-spec/{slug}")
        assert status == 200
        assert isinstance(spec, dict)
        assert spec.get("title")
        assert isinstance(spec.get("nodes"), list)
        assert isinstance(spec.get("links"), list)


def test_force_save_persists_ts_snapshot_to_yaml(tmp_path: pathlib.Path):
    force_dir = tmp_path / "force"
    force_dir.mkdir()
    slug = "force-save-probe"
    force_path = force_dir / f"{slug}.yaml"
    force_path.write_text(
        "\n".join(
            [
                "title: Save probe",
                "reference_image: force/IMG_3229.jpg",
                "canvas:",
                "  width: 960",
                "  height: 640",
                "render:",
                "  curve_handle_ratio: 0.35",
                "  curve_handle_min: 24",
                "  curve_handle_max: 64",
                "simulation:",
                "  ticks_per_frame: 1",
                "  max_iterations: 220",
                "  charge_strength: -900",
                "  link_distance: 256",
                "  link_strength: 0.08",
                "  collision_padding: 24",
                "  collision_iterations: 4",
                "  velocity_decay: 0.34",
                "  alpha_min: 0.006",
                "  center: [480, 320]",
                "nodes:",
                "  - id: users",
                "    label: [Users]",
                "    width: 192",
                "    height: 64",
                "    x: 240",
                "    y: 392",
                "links: []",
                "",
            ]
        ),
        encoding="utf-8",
    )

    port = _reserve_port()
    env = os.environ.copy()
    env["DG_DISABLE_TS_EXPORT"] = "1"
    env["DG_FORCE_DEFINITIONS_DIR"] = str(force_dir)
    process = subprocess.Popen(
        [
            sys.executable,
            str(SCRIPTS / "preview_server.py"),
            "--port",
            str(port),
            "--no-watch",
        ],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        _wait_for_server(base, process)
        snapshot = {
            "title": "Save probe",
            "reference_image": "force/IMG_3229.jpg",
            "canvas": {"width": 960, "height": 640},
            "render": {
                "curve_handle_ratio": 0.35,
                "curve_handle_min": 24,
                "curve_handle_max": 64,
            },
            "simulation": {
                "params": {
                    "ticks_per_frame": 2,
                    "max_iterations": 180,
                    "charge_strength": -840,
                    "link_distance": 200,
                    "link_strength": 0.12,
                    "collision_padding": 16,
                    "collision_iterations": 2,
                    "velocity_decay": 0.31,
                    "alpha_min": 0.004,
                    "center": [480, 320],
                }
            },
            "nodes": [
                {
                    "id": "users",
                    "label": ["Users"],
                    "width": 208,
                    "height": 72,
                    "x": 312,
                    "y": 416,
                    "fx": 312,
                    "fy": 416,
                    "style_override": "highlight",
                }
            ],
            "links": [],
        }

        status, payload = _fetch_json(
            f"{base}/api/force-save/{slug}",
            data=json.dumps(snapshot).encode("utf-8"),
        )
        assert status == 200
        assert payload["ok"] is True
        assert payload["canonicalState"]["slug"] == slug
        assert payload["canonicalState"]["authoredSpec"]["simulation"]["ticks_per_frame"] == 2

        saved_yaml = yaml.safe_load(force_path.read_text(encoding="utf-8"))
        assert saved_yaml["simulation"]["ticks_per_frame"] == 2
        assert saved_yaml["simulation"]["link_distance"] == 200
        assert saved_yaml["nodes"][0]["x"] == 312
        assert saved_yaml["nodes"][0]["y"] == 416
        assert saved_yaml["nodes"][0]["fx"] == 312
        assert saved_yaml["nodes"][0]["fy"] == 416
        assert saved_yaml["nodes"][0]["style"] == "highlight"

        unpinned_snapshot = {
            **snapshot,
            "nodes": [
                {
                    "id": "users",
                    "label": ["Users"],
                    "width": 208,
                    "height": 72,
                    "x": 312,
                    "y": 416,
                    "style_override": "highlight",
                }
            ],
        }

        status, payload = _fetch_json(
            f"{base}/api/force-save/{slug}",
            data=json.dumps(unpinned_snapshot).encode("utf-8"),
        )
        assert status == 200
        assert payload["ok"] is True
        assert payload["canonicalState"]["authoredSpec"]["nodes"][0]["style"] == "highlight"

        saved_yaml = yaml.safe_load(force_path.read_text(encoding="utf-8"))
        assert "fx" not in saved_yaml["nodes"][0]
        assert "fy" not in saved_yaml["nodes"][0]

        status, spec = _fetch_json(f"{base}/api/force-spec/{slug}")
        assert status == 200
        assert "fx" not in spec["nodes"][0]
        assert "fy" not in spec["nodes"][0]
        assert spec["nodes"][0]["x"] == 312
        assert spec["nodes"][0]["y"] == 416
        assert spec["nodes"][0]["style"] == "highlight"
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
