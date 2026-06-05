#!/usr/bin/env python3
"""Playwright QA: ELK layered diagrams in the existing preview editor (not demo HTML)."""
from __future__ import annotations

import contextlib
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"

ELK_SLUG = "juju-bootstrap-machines-process"


def _reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(base_url: str, process: subprocess.Popen[str], timeout: float = 90.0) -> None:
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
def _preview_server(port: int):
    process = subprocess.Popen(
        [sys.executable, str(SCRIPTS / "preview_server.py"), "--port", str(port), "--no-watch"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, "DG_USE_TS_LAYOUT": "1"},
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


def _assert_editor_qa(page: Page) -> None:
    page.wait_for_selector("#stage svg", timeout=30_000)
    page.wait_for_selector("#reference-img", state="attached", timeout=10_000)

    ref_src = page.locator("#reference-img").get_attribute("src") or ""
    assert f"/reference/{ELK_SLUG}" in ref_src, "corpus source image should be wired in input pane"

    result = page.evaluate(
        """() => {
          const svg = document.querySelector('#stage svg');
          if (!svg) return { error: 'no stage svg' };
          const rects = [...svg.querySelectorAll('[data-component-id] rect')];
          const lines = [...svg.querySelectorAll('line')].filter(l => l.getAttribute('stroke') && l.getAttribute('stroke') !== 'transparent');
          const thick = lines.filter(l => parseFloat(l.getAttribute('stroke-width') || '0') > 1);
          const orange = lines.filter(l => {
            const s = (l.getAttribute('stroke') || '').toLowerCase();
            return s === '#e95420';
          });
          return {
            rectCount: rects.length,
            lineCount: lines.length,
            thickEdges: thick.length,
            orangeEdges: orange.length,
            hasPanelFill: [...rects].some(r => r.getAttribute('fill') === '#F3F3F3'),
          };
        }"""
    )
    assert "error" not in result, result.get("error")
    assert result["rectCount"] >= 5, "expected frame rects from resolveStyles renderer"
    assert result["lineCount"] >= 1, "expected routed arrow line segments"
    assert result["thickEdges"] == 0, "edges must use 1px stroke from frame renderer"
    assert result["orangeEdges"] >= 1, "expected canonical orange arrows"


@pytest.fixture(scope="module")
def preview_server():
    port = _reserve_port()
    with _preview_server(port) as base_url:
        yield base_url


def test_elk_diagram_in_preview_editor(preview_server: str) -> None:
    url = f"{preview_server}/view/v3:{ELK_SLUG}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(url, wait_until="domcontentloaded")
        _assert_editor_qa(page)
        browser.close()


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, *sys.argv[1:]]))