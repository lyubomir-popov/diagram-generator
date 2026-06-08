"""HTTP smoke tests for force preview discovery and TS-owned save persistence."""

from __future__ import annotations

import contextlib
import json
import os
import pathlib
import urllib.error
import urllib.request

import pytest
import yaml
from playwright.sync_api import sync_playwright
from test_preview_app_harness import preview_app

ROOT = pathlib.Path(__file__).resolve().parent.parent
FORCE_SLUGS = [
    "force-stakeholders",
    "force-juju-landing-pages",
    "force-support-case-lifecycle",
]
DIRTY_DIAGRAM_NAV_CONFIRM = "You have unsaved changes. Leave this diagram without saving?"


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


@contextlib.contextmanager
def _preview_server(*, extra_env: dict[str, str] | None = None) -> str:
    with preview_app(extra_env=extra_env) as base:
        yield base


@pytest.fixture(scope="module")
def preview_base() -> str:
    with _preview_server() as base:
        yield base


def _force_nav_state(page) -> dict:
    return page.evaluate(
        """
        () => {
          const picker = document.getElementById('diagram-picker');
          const activeBrowse = document.querySelector('.dg-browse-link.is-active');
          const nextOption = (
            picker
            && picker.selectedIndex >= 0
            && picker.selectedIndex + 1 < picker.options.length
          ) ? picker.options[picker.selectedIndex + 1] : null;
          return {
            path: window.location.pathname,
            pickerValue: picker ? picker.value : null,
            activeBrowseHref: activeBrowse ? activeBrowse.getAttribute('href') : null,
            nextValue: nextOption ? nextOption.value : null,
          };
        }
        """
    )


def _force_node_position(page, node_id: str) -> dict:
    return page.evaluate(
        """
        (nodeId) => {
          const node = committedSnapshot?.nodes?.find((candidate) => candidate.id === nodeId);
          return node ? { x: node.x, y: node.y, fx: node.fx ?? null, fy: node.fy ?? null } : null;
        }
        """,
        node_id,
    )


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


def test_force_save_persists_authored_spec_to_yaml(tmp_path: pathlib.Path):
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

    with preview_app(extra_env={"DG_FORCE_DEFINITIONS_DIR": str(force_dir)}) as base:
        authored_spec = {
            "title": "Save probe",
            "reference_image": "force/IMG_3229.jpg",
            "canvas": {"width": 960, "height": 640},
            "render": {
                "curve_handle_ratio": 0.35,
                "curve_handle_min": 24,
                "curve_handle_max": 64,
            },
            "simulation": {
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
                    "style": "highlight",
                }
            ],
            "links": [],
        }

        status, payload = _fetch_json(
            f"{base}/api/force-save/{slug}",
            data=json.dumps(authored_spec).encode("utf-8"),
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

        unpinned_authored_spec = {
            **authored_spec,
            "nodes": [
                {
                    "id": "users",
                    "label": ["Users"],
                    "width": 208,
                    "height": 72,
                    "x": 312,
                    "y": 416,
                    "style": "highlight",
                }
            ],
        }

        status, payload = _fetch_json(
            f"{base}/api/force-save/{slug}",
            data=json.dumps(unpinned_authored_spec).encode("utf-8"),
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

        runtime_snapshot = {
            **authored_spec,
            "simulation": {
                "params": dict(authored_spec["simulation"]),
            },
        }
        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(
                urllib.request.Request(
                    f"{base}/api/force-save/{slug}",
                    data=json.dumps(runtime_snapshot).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
            )
        assert exc_info.value.code == 400

        for route in ("force", "force-reset", "force-node", "force-tick", "force-params", "force-export"):
            with pytest.raises(urllib.error.HTTPError) as exc_info:
                urllib.request.urlopen(f"{base}/api/{route}/{slug}")
            assert exc_info.value.code == 404


def test_force_save_button_tracks_persisted_state(tmp_path: pathlib.Path):
    force_dir = tmp_path / "force"
    force_dir.mkdir()
    slug = "force-dirty-probe"
    force_path = force_dir / f"{slug}.yaml"
    force_path.write_text(
        "\n".join(
            [
                "title: Dirty probe",
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
                "  max_iterations: 1",
                "  charge_strength: -900",
                "  link_distance: 256",
                "  link_strength: 0.08",
                "  collision_padding: 24",
                "  collision_iterations: 1",
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
                "    fx: 240",
                "    fy: 392",
                "links: []",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with _preview_server(extra_env={"DG_FORCE_DEFINITIONS_DIR": str(force_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            try:
                page.goto(f"{base_url}/force/view/{slug}", wait_until="domcontentloaded")
                page.wait_for_function(
                    """
                    () => (
                      typeof updateForceNode === 'function' &&
                      typeof saveForceOverrides === 'function' &&
                      document.querySelector('[data-component-id="users"]') !== null &&
                      document.getElementById('btn-force-save') !== null
                    )
                    """
                )
                page.wait_for_function("() => document.getElementById('btn-force-save').disabled")

                page.evaluate(
                    """
                    () => {
                      const input = document.querySelector('[data-force-param="link_distance"]');
                      input.value = '240';
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    """
                )
                page.wait_for_function("() => !document.getElementById('btn-force-save').disabled")

                page.evaluate(
                    """
                    () => {
                      const input = document.querySelector('[data-force-param="link_distance"]');
                      input.value = '256';
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    """
                )
                page.wait_for_function("() => document.getElementById('btn-force-save').disabled")

                page.evaluate("() => updateForceNode('users', { x: 312, y: 416, pinned: true })")
                page.wait_for_function("() => !document.getElementById('btn-force-save').disabled")

                page.locator("#btn-force-save").click()
                page.wait_for_function(
                    """
                    () => (
                      document.getElementById('btn-force-save').disabled &&
                      document.getElementById('build-status')?.textContent === 'Saved to YAML'
                    )
                    """
                )

                saved_yaml = yaml.safe_load(force_path.read_text(encoding="utf-8"))
                assert saved_yaml["simulation"]["link_distance"] == 256
                assert saved_yaml["simulation"]["ticks_per_frame"] == 1
                assert saved_yaml["nodes"][0]["x"] == 312
                assert saved_yaml["nodes"][0]["y"] == 416
                assert saved_yaml["nodes"][0]["fx"] == 312
                assert saved_yaml["nodes"][0]["fy"] == 416

                page.reload(wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => document.querySelector('[data-component-id=\"users\"]') !== null"
                )
                page.wait_for_function("() => document.getElementById('btn-force-save').disabled")
            finally:
                browser.close()


def test_force_dirty_navigation_cancel_keeps_nav_ui_in_sync(tmp_path: pathlib.Path):
    force_dir = tmp_path / "force"
    force_dir.mkdir()
    for slug in ("force-a", "force-b"):
        (force_dir / f"{slug}.yaml").write_text(
            "\n".join(
                [
                    f"title: {slug}",
                    "reference_image: force/IMG_3229.jpg",
                    "canvas:",
                    "  width: 960",
                    "  height: 640",
                    "simulation:",
                    "  ticks_per_frame: 1",
                    "  max_iterations: 1",
                    "nodes:",
                    "  - id: users",
                    "    label: [Users]",
                    "    width: 192",
                    "    height: 64",
                    "    x: 240",
                    "    y: 392",
                    "    fx: 240",
                    "    fy: 392",
                    "links: []",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    with _preview_server(extra_env={"DG_FORCE_DEFINITIONS_DIR": str(force_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.dismiss()))
            try:
                page.goto(f"{base_url}/force/view/force-a", wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => document.querySelector('[data-component-id=\"users\"]') !== null"
                )
                nav_before = _force_nav_state(page)
                assert nav_before["nextValue"] == "/force/view/force-b"

                page.evaluate("() => updateForceNode('users', { x: 312, y: 416, pinned: true })")
                page.wait_for_function("() => !document.getElementById('btn-force-save').disabled")

                page.locator("#diagram-next").click()
                page.wait_for_timeout(200)

                nav_after = _force_nav_state(page)
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM]
                assert nav_after["path"] == nav_before["path"]
                assert nav_after["pickerValue"] == nav_before["path"]
                assert nav_after["activeBrowseHref"] == nav_before["path"]
                assert _force_node_position(page, "users") == {"x": 312, "y": 416, "fx": 312, "fy": 416}

                page.locator(".dg-browse-link", has_text="force-b").click()
                page.wait_for_timeout(200)

                nav_after_browse = _force_nav_state(page)
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM, DIRTY_DIAGRAM_NAV_CONFIRM]
                assert nav_after_browse["path"] == nav_before["path"]
                assert nav_after_browse["pickerValue"] == nav_before["path"]
                assert nav_after_browse["activeBrowseHref"] == nav_before["path"]
            finally:
                browser.close()


def test_force_unsaved_move_is_restored_after_navigation_back(tmp_path: pathlib.Path):
    force_dir = tmp_path / "force"
    force_dir.mkdir()
    for slug in ("force-a", "force-b"):
        (force_dir / f"{slug}.yaml").write_text(
            "\n".join(
                [
                    f"title: {slug}",
                    "reference_image: force/IMG_3229.jpg",
                    "canvas:",
                    "  width: 960",
                    "  height: 640",
                    "simulation:",
                    "  ticks_per_frame: 1",
                    "  max_iterations: 1",
                    "nodes:",
                    "  - id: users",
                    "    label: [Users]",
                    "    width: 192",
                    "    height: 64",
                    "    x: 240",
                    "    y: 392",
                    "    fx: 240",
                    "    fy: 392",
                    "links: []",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    with _preview_server(extra_env={"DG_FORCE_DEFINITIONS_DIR": str(force_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
            try:
                page.goto(f"{base_url}/force/view/force-a", wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => document.querySelector('[data-component-id=\"users\"]') !== null"
                )

                page.evaluate("() => updateForceNode('users', { x: 312, y: 416, pinned: true })")
                page.wait_for_function("() => !document.getElementById('btn-force-save').disabled")
                assert _force_node_position(page, "users") == {"x": 312, "y": 416, "fx": 312, "fy": 416}

                page.locator("#diagram-next").click()
                page.wait_for_function("() => window.location.pathname === '/force/view/force-b'")
                page.go_back(wait_until="domcontentloaded")
                page.wait_for_function("() => window.location.pathname === '/force/view/force-a'")
                page.wait_for_function(
                    "() => document.querySelector('[data-component-id=\"users\"]') !== null"
                )
                page.wait_for_function("() => document.getElementById('btn-force-save').disabled")
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM]
                assert _force_node_position(page, "users") == {"x": 240, "y": 392, "fx": 240, "fy": 392}
            finally:
                browser.close()
