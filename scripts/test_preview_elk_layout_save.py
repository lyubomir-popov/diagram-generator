"""Playwright regression: ELK sidebar save round-trip on juju-bootstrap-machines-process."""

from __future__ import annotations

import contextlib
import json
import os
import pathlib
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
import yaml
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
FRAMES = SCRIPTS / "diagrams" / "frames"
SLUG = "juju-bootstrap-machines-process"
SAME_LAYER_INPUT = "#elk-elk-spacing-nodeNode"
SAME_LAYER_KEY = "elk.spacing.nodeNode"
SCREENSHOT_DIR = ROOT / "tmp" / "elk-save-playwright"


def _reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(base_url: str, process: subprocess.Popen[str], timeout: float = 120.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Preview server exited ({process.returncode}).\n{output}")
        try:
            with urllib.request.urlopen(base_url, timeout=1):
                return
        except Exception as exc:
            last_error = exc
            time.sleep(0.25)
    raise RuntimeError(f"Preview server did not start at {base_url}: {last_error}")


@contextlib.contextmanager
def _preview_server(frames_dir: pathlib.Path):
    port = _reserve_port()
    env = os.environ.copy()
    env["DG_FRAMES_DIR"] = str(frames_dir)
    process = subprocess.Popen(
        [sys.executable, str(SCRIPTS / "preview_server.py"), "--port", str(port), "--no-watch"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        _wait_for_server(base_url, process)
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def _wait_juju_ready(page) -> None:
    page.wait_for_function(
        """
        () => (
          typeof whenDiagramLoaded === 'function' &&
          window.__DG_DIAGRAM_LOAD_GENERATION > 0 &&
          document.querySelector('#stage svg') !== null &&
          document.querySelector('[data-component-id="client"]') !== null &&
          document.querySelector('#elk-layout-section:not([hidden])') !== null
        )
        """
    )
    page.evaluate("() => whenDiagramLoaded()")
    page.wait_for_selector(SAME_LAYER_INPUT, state="visible", timeout=60_000)


def _read_same_layer_value(page) -> str:
    return page.locator(SAME_LAYER_INPUT).input_value()


def _fetch_frame_tree_elk(base_url: str, slug: str) -> dict[str, str]:
    with urllib.request.urlopen(f"{base_url}/api/frame-tree/{slug}?t={time.time()}", timeout=30) as resp:
        data = json.loads(resp.read())
    elk = data.get("elkLayout") or {}
    return {str(k): str(v) for k, v in elk.items()}


def _screenshot(page, name: str) -> pathlib.Path:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOT_DIR / f"{name}.png"
    page.locator("#elk-layout-section").screenshot(path=str(path))
    return path


@pytest.fixture()
def isolated_juju_frame(tmp_path: pathlib.Path) -> pathlib.Path:
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    dest = frames_dir / f"{SLUG}.yaml"
    shutil.copy2(FRAMES / f"{SLUG}.yaml", dest)
    document = yaml.safe_load(dest.read_text(encoding="utf-8"))
    meta = document.setdefault("meta", {})
    elk = meta.setdefault("elk", {})
    elk[SAME_LAYER_KEY] = "24"
    dest.write_text(yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")
    return frames_dir


def test_elk_same_layer_gap_save_round_trip(isolated_juju_frame: pathlib.Path):
    """Change same-layer gap 24→48, Save, reload — value must stay 48 in UI, API, and YAML."""
    target_value = "48"
    yaml_path = isolated_juju_frame / f"{SLUG}.yaml"

    with _preview_server(isolated_juju_frame) as base_url:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            url = f"{base_url}/view/v3:{SLUG}"
            page.goto(url, wait_until="domcontentloaded")
            _wait_juju_ready(page)

            before = _read_same_layer_value(page)
            _screenshot(page, "01-before-change")
            assert before == "24", f"expected baseline 24, got {before!r}"

            page.locator(SAME_LAYER_INPUT).click()
            page.locator(SAME_LAYER_INPUT).fill(target_value)
            page.keyboard.press("Tab")
            page.wait_for_timeout(600)

            after_edit = _read_same_layer_value(page)
            _screenshot(page, "02-after-edit")
            assert after_edit == target_value, f"edit failed: {after_edit!r}"

            model_val = page.evaluate(
                """() => (typeof model !== 'undefined' && model.elkLayoutOverrides)
                  ? model.elkLayoutOverrides['elk.spacing.nodeNode'] : null"""
            )
            assert model_val == target_value, f"model not updated after edit: {model_val!r}"

            save_btn = page.locator("#btn-save")
            page.wait_for_function("() => !document.getElementById('btn-save').disabled")
            save_btn.click()

            page.wait_for_function(
                """() => (
                  document.getElementById('btn-save').disabled &&
                  !document.getElementById('btn-save').classList.contains('dirty')
                )""",
                timeout=120_000,
            )
            _wait_juju_ready(page)

            after_save_reload = _read_same_layer_value(page)
            _screenshot(page, "03-after-save-reload")
            api_after_save = _fetch_frame_tree_elk(base_url, SLUG)
            yaml_after_save = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            yaml_elk_after_save = (yaml_after_save.get("meta") or {}).get("elk") or {}

            page.reload(wait_until="domcontentloaded")
            _wait_juju_ready(page)
            after_hard_reload = _read_same_layer_value(page)
            _screenshot(page, "04-after-hard-reload")
            api_after_hard = _fetch_frame_tree_elk(base_url, SLUG)

            browser.close()

    failures: list[str] = []
    if after_save_reload != target_value:
        failures.append(f"sidebar after save reload: {after_save_reload!r}")
    if api_after_save.get(SAME_LAYER_KEY) != target_value:
        failures.append(f"frame-tree after save: {api_after_save.get(SAME_LAYER_KEY)!r}")
    if yaml_elk_after_save.get(SAME_LAYER_KEY) != target_value:
        failures.append(f"yaml on disk after save: {yaml_elk_after_save.get(SAME_LAYER_KEY)!r}")
    if after_hard_reload != target_value:
        failures.append(f"sidebar after hard reload: {after_hard_reload!r}")
    if api_after_hard.get(SAME_LAYER_KEY) != target_value:
        failures.append(f"frame-tree after hard reload: {api_after_hard.get(SAME_LAYER_KEY)!r}")

    if failures:
        pytest.fail(
            "ELK save round-trip failed:\n  - "
            + "\n  - ".join(failures)
            + f"\nScreenshots: {SCREENSHOT_DIR}"
        )
