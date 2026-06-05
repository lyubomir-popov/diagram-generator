#!/usr/bin/env python3
"""One-off Playwright check against live preview server (default :8100)."""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLUG = "juju-bootstrap-machines-process"
INPUT = "#elk-elk-spacing-nodeNode"
KEY = "elk.spacing.nodeNode"
TARGET = "48"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8100")
    parser.add_argument("--target", default=TARGET)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    screen_dir = ROOT / "tmp" / "elk-save-playwright-live"
    screen_dir.mkdir(parents=True, exist_ok=True)

    try:
        urllib.request.urlopen(base, timeout=3)
    except urllib.error.URLError as exc:
        print(f"Preview server not reachable at {base}: {exc}", file=sys.stderr)
        return 1

    result: dict[str, object] = {"base_url": base, "screenshots": str(screen_dir)}
    save_capture: dict[str, object] = {}

    def on_response(response):
        if "/api/overrides/" in response.url and response.request.method == "POST":
            save_capture["status"] = response.status
            try:
                save_capture["body"] = response.text()
            except Exception as exc:
                save_capture["body_error"] = str(exc)
            try:
                save_capture["post_data"] = response.request.post_data
            except Exception as exc:
                save_capture["post_data_error"] = str(exc)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200})
        page.on("response", on_response)
        page.goto(f"{base}/view/v3:{SLUG}", wait_until="domcontentloaded")
        page.wait_for_function(
            "() => window.__DG_DIAGRAM_LOAD_GENERATION > 0 && document.querySelector('#elk-elk-spacing-nodeNode')",
            timeout=120_000,
        )
        page.wait_for_selector(INPUT, state="visible")

        result["before"] = page.locator(INPUT).input_value()
        page.locator("#elk-layout-section").screenshot(path=str(screen_dir / "live-01-before.png"))

        page.locator(INPUT).click()
        page.locator(INPUT).fill(args.target)
        page.keyboard.press("Tab")
        page.wait_for_timeout(600)
        result["after_edit_dom"] = page.locator(INPUT).input_value()
        result["model_after_edit"] = page.evaluate(
            """() => (typeof model !== 'undefined' && model.elkLayoutOverrides)
              ? model.elkLayoutOverrides['elk.spacing.nodeNode'] : null"""
        )
        page.locator("#elk-layout-section").screenshot(path=str(screen_dir / "live-02-edited.png"))

        page.wait_for_function(
            "() => !document.getElementById('btn-save').disabled",
            timeout=30_000,
        )
        page.locator("#btn-save").click()
        page.wait_for_function(
            """() => document.getElementById('btn-save').disabled
              && !document.getElementById('btn-save').classList.contains('dirty')""",
            timeout=120_000,
        )
        page.wait_for_function(
            "() => window.__DG_DIAGRAM_LOAD_GENERATION > 0",
            timeout=120_000,
        )
        result["after_save_reload"] = page.locator(INPUT).input_value()
        page.locator("#elk-layout-section").screenshot(path=str(screen_dir / "live-03-after-save.png"))

        page.reload(wait_until="domcontentloaded")
        page.wait_for_function(
            "() => window.__DG_DIAGRAM_LOAD_GENERATION > 0 && document.querySelector('#elk-elk-spacing-nodeNode')",
            timeout=120_000,
        )
        result["after_hard_reload"] = page.locator(INPUT).input_value()
        page.locator("#elk-layout-section").screenshot(path=str(screen_dir / "live-04-hard-reload.png"))

        with urllib.request.urlopen(f"{base}/api/frame-tree/{SLUG}?t={time.time()}") as resp:
            api_elk = json.loads(resp.read()).get("elkLayout") or {}
        result["api_after_hard_reload"] = api_elk.get(KEY)

        browser.close()

    yaml_path = ROOT / "scripts" / "diagrams" / "frames" / f"{SLUG}.yaml"
    if yaml_path.is_file():
        import yaml

        meta_elk = (yaml.safe_load(yaml_path.read_text(encoding="utf-8")).get("meta") or {}).get("elk") or {}
        result["yaml_on_disk"] = meta_elk.get(KEY)
    result["save_response"] = save_capture

    result["ok"] = (
        result.get("after_save_reload") == args.target
        and result.get("after_hard_reload") == args.target
        and result.get("api_after_hard_reload") == args.target
    )
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
