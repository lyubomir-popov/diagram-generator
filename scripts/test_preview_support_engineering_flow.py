from __future__ import annotations

import contextlib
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
DIRTY_DIAGRAM_NAV_CONFIRM = "You have unsaved changes. Leave this diagram without saving?"


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
            raise RuntimeError(
                f"Preview server exited with code {process.returncode}.\n{output}"
            )
        try:
            with urllib.request.urlopen(base_url, timeout=1):
                return
        except Exception as exc:  # pragma: no cover - retry loop
            last_error = exc
            time.sleep(0.25)
    raise RuntimeError(f"Preview server did not start at {base_url}: {last_error}")


@contextlib.contextmanager
def _preview_server(*, extra_env: dict[str, str] | None = None) -> str:
    port = _reserve_port()
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
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


def _open_v3_page(
    playwright: object,
    base_url: str,
    slug: str,
    ready_component_id: str,
):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1200})
    page.goto(f"{base_url}/view/v3:{slug}", wait_until="domcontentloaded")
    page.wait_for_function(
        """
        (readyComponentId) => (
          typeof selectedIds !== 'undefined' &&
          typeof applyV3Style === 'function' &&
          typeof getV3RelayoutStatus === 'function' &&
          typeof whenDiagramLoaded === 'function' &&
          typeof __DG_TEST_setLocalRelayoutMode === 'function' &&
          window.__DG_DIAGRAM_LOAD_GENERATION > 0 &&
          document.querySelector('#stage svg') !== null &&
          document.querySelector(`[data-component-id="${readyComponentId}"]`) !== null
        )
        """,
        arg=ready_component_id,
    )
    page.wait_for_timeout(150)
    return browser, page


def _open_v3_support_engineering_page(playwright: object, base_url: str):
    return _open_v3_page(playwright, base_url, "support-engineering-flow", "step_fix")


def _wait_for_diagram_loaded(page, *, slug: str | None = None, component_id: str | None = None) -> None:
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_function("() => typeof whenDiagramLoaded === 'function'")
    if slug is not None:
        page.wait_for_function(
            "(expectedPath) => window.location.pathname === expectedPath",
            arg=f"/view/v3:{slug}",
        )
    page.evaluate("() => whenDiagramLoaded()")
    if component_id is not None:
        page.wait_for_function(
            "(cid) => document.querySelector(`[data-component-id=\"${cid}\"]`) !== null",
            arg=component_id,
        )


def _preview_nav_state(page) -> dict:
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
            nextLabel: nextOption ? nextOption.textContent : null,
          };
        }
        """
    )


def _select_component(page, component_id: str) -> None:
    page.locator(f'[data-component-id="{component_id}"] rect').click()
    page.wait_for_function(
        "(cid) => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === cid",
        arg=component_id,
    )


def _capture_component_state(page, component_id: str) -> dict:
    return page.evaluate(
        """
        (cid) => {
          const group = document.querySelector(`[data-component-id="${cid}"]`);
          const rect = group.querySelector(':scope > rect');
          const firstTspan = group.querySelector(':scope > text tspan');
          const text = group.querySelector(':scope > text');
          const stylePicker = document.querySelector('#inspector .style-picker');
          const bbox = text ? text.getBBox() : null;
          const rectBottom = Number(rect.getAttribute('y') || '0') + Number(rect.getAttribute('height') || '0');
          return {
            rectFill: rect.getAttribute('fill'),
            rectStroke: rect.getAttribute('stroke'),
            textFill: firstTspan?.getAttribute('fill') || null,
            rectWidth: Number(rect.getAttribute('width') || '0'),
            rectHeight: Number(rect.getAttribute('height') || '0'),
            overflow: bbox ? (bbox.y + bbox.height > rectBottom + 0.5) : false,
            selected: Array.from(selectedIds),
            override: JSON.parse(JSON.stringify(overrides[cid] || null)),
            overrideSummary: document.getElementById('override-summary')?.textContent || '',
            stylePickerValue: stylePicker ? stylePicker.value : null,
            stylePickerLabel: stylePicker ? stylePicker.selectedOptions[0]?.textContent || '' : null,
            buildStatusText: document.getElementById('build-status')?.textContent || '',
            buildStatusClass: document.getElementById('build-status')?.className || '',
            relayout: getV3RelayoutStatus(),
          };
        }
        """,
        component_id,
    )


def _apply_v3_style_and_capture(page, component_id: str, style_name: str) -> dict:
    page.evaluate(
        """
        ({ cid, styleName }) => {
          applyV3Style(cid, styleName);
        }
        """,
        {"cid": component_id, "styleName": style_name},
    )
    page.wait_for_timeout(450)
    return _capture_component_state(page, component_id)


def _find_frame(frame_data: dict, frame_id: str) -> dict | None:
    if frame_data.get("id") == frame_id:
        return frame_data
    for child in frame_data.get("children", []):
        if not isinstance(child, dict):
            continue
        found = _find_frame(child, frame_id)
        if found is not None:
            return found
    return None


def _component_rect_origin(page, component_id: str) -> dict:
    return page.evaluate(
        """
        (cid) => {
          const rect = document.querySelector(`[data-component-id="${cid}"] rect`);
          const box = rect.getBoundingClientRect();
          return {
            x: box.left,
            y: box.top,
          };
        }
        """,
        component_id,
    )


def _component_model_x(page, component_id: str) -> float:
    return page.evaluate("(cid) => model.get(cid).data.x", component_id)


def _capture_group_tspans(page, component_id: str) -> list[dict[str, str | None]]:
    return page.evaluate(
        """
        (cid) => Array.from(
          document.querySelectorAll(`[data-component-id="${cid}"] text tspan`)
        ).map((tspan) => ({
          text: tspan.textContent,
          x: tspan.getAttribute('x'),
          y: tspan.getAttribute('y'),
          size: tspan.getAttribute('font-size'),
          weight: tspan.getAttribute('font-weight'),
          fill: tspan.getAttribute('fill'),
          ls: tspan.getAttribute('letter-spacing'),
        }))
        """,
        component_id,
    )


def test_v3_style_changes_use_single_local_executor():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                _select_component(page, "step_fix")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                style_matrix = {
                    "default": _apply_v3_style_and_capture(page, "step_fix", "default"),
                    "parent": _apply_v3_style_and_capture(page, "step_fix", "parent"),
                    "section": _apply_v3_style_and_capture(page, "step_fix", "section"),
                    "annotation": _apply_v3_style_and_capture(page, "step_fix", "annotation"),
                    "highlight": _apply_v3_style_and_capture(page, "step_fix", "highlight"),
                }

                assert style_matrix["default"]["rectFill"] == "transparent"
                assert style_matrix["default"]["textFill"] == "#000000"
                assert style_matrix["parent"]["rectFill"] == "#F3F3F3"
                assert style_matrix["parent"]["textFill"] == "#000000"
                assert style_matrix["section"]["rectFill"] == "transparent"
                assert style_matrix["section"]["textFill"] == "#000000"
                assert style_matrix["annotation"]["rectFill"] == "transparent"
                assert style_matrix["annotation"]["textFill"] == "#666666"
                assert style_matrix["highlight"]["rectFill"] == "#000000"
                assert style_matrix["highlight"]["textFill"] == "#FFFFFF"
                baseline_width = style_matrix["default"]["rectWidth"]
                baseline_height = style_matrix["default"]["rectHeight"]
                for state in style_matrix.values():
                    assert state["selected"] == ["step_fix"]
                    assert state["relayout"]["interactiveExecutor"] == "local-only"
                    assert state["relayout"]["interactiveFallbackAvailable"] is False
                    assert state["relayout"]["lastMode"] == "local"
                    assert state["relayout"]["lastReason"] == "ready"
                    assert state["relayout"]["fallbackActive"] is False
                    assert state["relayout"]["local"]["reason"] == "ready"
                    assert state["relayout"]["local"]["textAdapterBackend"] == "harfbuzz"
                    assert state["relayout"]["local"]["textAdapterError"] is None
                    assert state["overrideSummary"] != "No overrides."
                    assert state["rectWidth"] == baseline_width
                    assert state["rectHeight"] == baseline_height
                    assert state["overflow"] is False
                    assert state["buildStatusText"] == "Ready"
                    assert "build-ok" in state["buildStatusClass"]

                assert style_matrix["parent"]["override"]["style"] == "parent"
                assert style_matrix["parent"]["override"]["level"] == 2
                assert style_matrix["section"]["override"]["style"] == "section"
                assert style_matrix["section"]["override"]["level"] == 3
                assert style_matrix["annotation"]["override"]["style"] == "annotation"
                assert style_matrix["annotation"]["override"].get("level") is None
                assert style_matrix["highlight"]["override"]["style"] == "highlight"
                assert style_matrix["highlight"]["override"].get("level") is None
            finally:
                browser.close()


def test_v3_initial_style_picker_uses_semantic_panel_style():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "planning")
            try:
                page.evaluate("() => selectComponent('planning', false)")
                page.wait_for_function(
                    "() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'planning'"
                )
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                state = _capture_component_state(page, "planning")

                assert state["selected"] == ["planning"]
                assert state["override"] is None
                assert state["stylePickerValue"] == "parent"
                assert state["stylePickerLabel"] == "Parent (grey)"
                assert state["rectFill"] == "#F3F3F3"
                assert state["rectStroke"] == "#F3F3F3"
                assert state["relayout"]["interactiveExecutor"] == "local-only"
                assert state["relayout"]["local"]["textAdapterBackend"] == "harfbuzz"
                assert state["relayout"]["local"]["textAdapterError"] is None
                assert state["buildStatusText"] == "Ready"
            finally:
                browser.close()


def test_v3_style_change_does_not_shift_untouched_heading_wrappers():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "diagram-intake-workflow", "workflow")
            try:
                _select_component(page, "workflow")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                before_state = _capture_component_state(page, "workflow")
                before_heading = _capture_group_tspans(page, "sources__heading")

                assert before_state["stylePickerValue"] == "parent"
                assert before_heading == [
                    {
                        "text": "Rough initial diagram sources",
                        "x": "32",
                        "y": "48.92",
                        "size": "18",
                        "weight": "700",
                        "fill": "#000000",
                        "ls": None,
                    }
                ]

                same_style_state = _apply_v3_style_and_capture(page, "workflow", "parent")
                assert same_style_state["stylePickerValue"] == "parent"
                assert same_style_state["override"]["style"] == "parent"
                assert _capture_group_tspans(page, "sources__heading") == before_heading

                section_state = _apply_v3_style_and_capture(page, "workflow", "section")
                assert section_state["stylePickerValue"] == "section"
                assert section_state["override"]["style"] == "section"
                assert _capture_group_tspans(page, "sources__heading") == before_heading
            finally:
                browser.close()


def test_v3_section_style_uses_bold_fallback_for_container_and_leaf():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "test-deep-nesting", "main_panel")
            try:
                page.evaluate("() => selectComponent('main_panel', false)")
                page.wait_for_function(
                    "() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'main_panel'"
                )
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                panel_before = _capture_group_tspans(page, "main_panel__heading")
                assert panel_before == [
                    {
                        "text": "Infrastructure",
                        "x": "32",
                        "y": "136.92",
                        "size": "18",
                        "weight": "400",
                        "fill": "#000000",
                        "ls": None,
                    }
                ]

                panel_state = _apply_v3_style_and_capture(page, "main_panel", "section")
                panel_after = _capture_group_tspans(page, "main_panel__heading")
                assert panel_state["stylePickerValue"] == "section"
                assert panel_state["override"]["style"] == "section"
                assert len(panel_after) == 1
                assert panel_after[0]["text"] == "Infrastructure"
                assert panel_after[0]["size"] == "18"
                assert panel_after[0]["weight"] == "700"
                assert panel_after[0]["fill"] == "#000000"
                assert panel_after[0]["ls"] is None

                page.evaluate("() => selectComponent('vm_1', false)")
                page.wait_for_function(
                    "() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'vm_1'"
                )
                leaf_state = _apply_v3_style_and_capture(page, "vm_1", "section")
                leaf_after = _capture_group_tspans(page, "vm_1")
                assert leaf_state["stylePickerValue"] == "section"
                assert leaf_state["override"]["style"] == "section"
                assert " ".join(line["text"] for line in leaf_after) == "VM Instance A"
                assert all(line["x"] == "48" for line in leaf_after)
                y_values = [float(line["y"]) for line in leaf_after]
                assert y_values == sorted(y_values)
                if len(y_values) > 1:
                    assert all(abs((y_values[i] - y_values[i - 1]) - 24.0) < 0.01 for i in range(1, len(y_values)))
                assert all(line["size"] == "18" for line in leaf_after)
                assert all(line["weight"] == "700" for line in leaf_after)
                assert all(line["fill"] == "#000000" for line in leaf_after)
                assert all(line["ls"] is None for line in leaf_after)
            finally:
                browser.close()


def test_v3_relayout_unready_or_failed_state_is_explicit_without_fallback():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                _select_component(page, "step_fix")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                ready_state = _apply_v3_style_and_capture(page, "step_fix", "highlight")
                baseline_width = ready_state["rectWidth"]
                baseline_height = ready_state["rectHeight"]
                assert ready_state["rectFill"] == "#000000"
                assert ready_state["textFill"] == "#FFFFFF"
                assert ready_state["selected"] == ["step_fix"]
                assert ready_state["relayout"]["lastMode"] == "local"
                assert ready_state["relayout"]["lastReason"] == "ready"
                assert ready_state["relayout"]["interactiveExecutor"] == "local-only"
                assert ready_state["relayout"]["interactiveFallbackAvailable"] is False
                assert ready_state["relayout"]["local"]["textAdapterBackend"] == "harfbuzz"
                assert ready_state["relayout"]["local"]["textAdapterError"] is None
                assert ready_state["override"]["style"] == "highlight"
                assert ready_state["override"].get("level") is None
                assert ready_state["overflow"] is False
                assert ready_state["buildStatusText"] == "Ready"
                assert all(ready_state["override"].get(key) is None for key in ("dx", "dy", "dw", "dh"))

                page.evaluate("() => __DG_TEST_setLocalRelayoutMode('unready')")
                page.wait_for_function("() => !getV3RelayoutStatus().localReady")
                blocked_state = _apply_v3_style_and_capture(page, "step_fix", "parent")
                assert blocked_state["rectFill"] == ready_state["rectFill"]
                assert blocked_state["textFill"] == ready_state["textFill"]
                assert blocked_state["selected"] == ["step_fix"]
                assert blocked_state["relayout"]["lastMode"] == "local-error"
                assert blocked_state["relayout"]["lastReason"] == "forced-unready"
                assert blocked_state["relayout"]["local"]["reason"] == "forced-unready"
                assert blocked_state["relayout"]["interactiveExecutor"] == "local-only"
                assert blocked_state["relayout"]["interactiveFallbackAvailable"] is False
                assert blocked_state["override"]["style"] == "parent"
                assert blocked_state["override"]["level"] == 2
                assert blocked_state["overflow"] is False
                assert blocked_state["rectWidth"] == baseline_width
                assert blocked_state["rectHeight"] == baseline_height
                assert blocked_state["buildStatusText"] == "Local relayout intentionally disabled"
                assert "build-err" in blocked_state["buildStatusClass"]
                assert all(blocked_state["override"].get(key) is None for key in ("dx", "dy", "dw", "dh"))

                page.evaluate("() => __DG_TEST_setLocalRelayoutMode('auto')")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                recovered_state = _apply_v3_style_and_capture(page, "step_fix", "section")
                assert recovered_state["rectFill"] == "transparent"
                assert recovered_state["textFill"] == "#000000"
                assert recovered_state["selected"] == ["step_fix"]
                assert recovered_state["relayout"]["lastMode"] == "local"
                assert recovered_state["relayout"]["lastReason"] == "ready"
                assert recovered_state["override"]["style"] == "section"
                assert recovered_state["override"]["level"] == 3
                assert recovered_state["overflow"] is False
                assert recovered_state["rectWidth"] == baseline_width
                assert recovered_state["rectHeight"] == baseline_height
                assert recovered_state["buildStatusText"] == "Ready"
                assert all(recovered_state["override"].get(key) is None for key in ("dx", "dy", "dw", "dh"))

                page.evaluate(
                    """
                    () => {
                      const original = window.performLocalRelayout;
                      window.performLocalRelayout = function(...args) {
                        window.performLocalRelayout = original;
                        return null;
                      };
                    }
                    """
                )
                failed_local_state = _apply_v3_style_and_capture(page, "step_fix", "highlight")
                assert failed_local_state["rectFill"] == recovered_state["rectFill"]
                assert failed_local_state["textFill"] == recovered_state["textFill"]
                assert failed_local_state["selected"] == ["step_fix"]
                assert failed_local_state["relayout"]["lastMode"] == "local-error"
                assert failed_local_state["relayout"]["lastReason"] == "local-failure"
                assert failed_local_state["override"]["style"] == "highlight"
                assert failed_local_state["override"].get("level") is None
                assert failed_local_state["overflow"] is False
                assert failed_local_state["rectWidth"] == baseline_width
                assert failed_local_state["rectHeight"] == baseline_height
                assert failed_local_state["buildStatusText"] == "Local relayout failed"
                assert "build-err" in failed_local_state["buildStatusClass"]
                assert all(failed_local_state["override"].get(key) is None for key in ("dx", "dy", "dw", "dh"))

                final_state = _apply_v3_style_and_capture(page, "step_fix", "default")
                assert final_state["rectFill"] == "transparent"
                assert final_state["textFill"] == "#000000"
                assert final_state["selected"] == ["step_fix"]
                assert final_state["relayout"]["lastMode"] == "local"
                assert final_state["relayout"]["lastReason"] == "ready"
                assert final_state["override"]["style"] == "default"
                assert final_state["override"]["level"] == 1
                assert final_state["overflow"] is False
                assert final_state["rectWidth"] == baseline_width
                assert final_state["rectHeight"] == baseline_height
                assert final_state["buildStatusText"] == "Ready"
                assert all(final_state["override"].get(key) is None for key in ("dx", "dy", "dw", "dh"))
            finally:
                browser.close()


def test_v3_style_save_roundtrip_uses_yaml_baseline(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                _select_component(page, "step_fix")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")

                saved_state = _apply_v3_style_and_capture(page, "step_fix", "parent")
                assert saved_state["override"]["style"] == "parent"
                assert saved_state["rectFill"] == "#F3F3F3"

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(500)

                saved_text = saved_frame.read_text(encoding="utf-8")
                saved_yaml = yaml.safe_load(saved_text)
                step_fix = _find_frame(saved_yaml["root"], "step_fix")
                assert step_fix is not None
                assert step_fix["level"] == 2
                assert step_fix["fill"] == "grey"
                assert step_fix["border"] == "solid"
                assert "style:" not in saved_text
                assert "overrideRole" not in saved_text
                assert "grid_overrides:" not in saved_text

                same_session_state = _capture_component_state(page, "step_fix")
                assert same_session_state["override"] is None
                assert same_session_state["rectFill"] == "#F3F3F3"
                assert same_session_state["stylePickerValue"] == "parent"

                page.evaluate("() => applyV3Style('step_result', 'highlight')")
                page.wait_for_timeout(450)
                persisted_state = _capture_component_state(page, "step_fix")
                assert persisted_state["override"] is None
                assert persisted_state["rectFill"] == "#F3F3F3"

                page.reload(wait_until="domcontentloaded")
                page.wait_for_function(
                    """
                    () => (
                      typeof selectedIds !== 'undefined' &&
                      typeof applyV3Style === 'function' &&
                      typeof getV3RelayoutStatus === 'function' &&
                      document.querySelector('[data-component-id="step_fix"]') !== null
                    )
                    """
                )
                page.wait_for_timeout(150)

                _select_component(page, "step_fix")
                reloaded_state = _capture_component_state(page, "step_fix")
                assert reloaded_state["override"] is None
                assert reloaded_state["rectFill"] == "#F3F3F3"
                assert reloaded_state["textFill"] == "#000000"
                assert reloaded_state["stylePickerValue"] == "parent"
                assert reloaded_state["relayout"]["interactiveExecutor"] == "local-only"
                assert reloaded_state["buildStatusText"] == "Ready"
            finally:
                browser.close()


def test_v3_empty_save_is_a_yaml_no_op(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    baseline_text = saved_frame.read_text(encoding="utf-8")

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                _select_component(page, "step_fix")
                state = _capture_component_state(page, "step_fix")
                assert state["override"] is None
                assert state["rectFill"] == "transparent"
                assert state["overrideSummary"] == "No overrides."

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(500)

                assert saved_frame.read_text(encoding="utf-8") == baseline_text
            finally:
                browser.close()


def test_v3_grid_gap_save_strips_transient_grid_fields(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.evaluate(
                    """
                    () => {
                      document.getElementById('grid-row-gap').value = '64';
                      onGridControlChange();
                    }
                    """
                )
                page.wait_for_timeout(400)

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(500)

                assert dialogs == []
                saved_text = saved_frame.read_text(encoding="utf-8")
                saved_yaml = yaml.safe_load(saved_text)
                assert saved_yaml["grid"]["row_gap"] == 64
                assert "rows" not in saved_yaml["grid"]
                assert "slack_absorption" not in saved_yaml["grid"]
                assert "link_to_root" not in saved_yaml["grid"]
            finally:
                browser.close()


def test_v3_runtime_width_coercion_does_not_overwrite_hug_save(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                candidate = page.evaluate(
                    """
                    () => {
                      function effectiveSizingW(node) {
                        const ovr = overrides[node.id] || {};
                        return ovr.sizing_w || node.sizing_w || '';
                      }

                      for (const id of model.allIds) {
                        const node = model.get(id);
                        if (!node || !node.children || node.children.length === 0) continue;
                        if (node.layout !== 'horizontal') continue;
                        if (effectiveSizingW(node) !== 'FIXED') continue;
                        const fillChildren = node.children
                          .filter((child) => effectiveSizingW(child) === 'FILL')
                          .map((child) => child.id);
                        if (fillChildren.length === 0) continue;
                        return { id, fillChildren, width: node.data.width };
                      }

                      return null;
                    }
                    """
                )
                assert candidate is not None

                page.evaluate("(cid) => setFrameProp(cid, 'sizing_w', 'HUG')", candidate["id"])
                page.wait_for_timeout(450)

                override_state = page.evaluate(
                    "(cid) => JSON.parse(JSON.stringify(overrides[cid] || null))",
                    candidate["id"],
                )
                assert override_state is not None
                assert override_state["sizing_w"] == "HUG"
                assert "width" not in override_state

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(300)

                saved_yaml = yaml.safe_load(saved_frame.read_text(encoding="utf-8"))
                saved_node = _find_frame(saved_yaml["root"], candidate["id"])
                assert saved_node is not None
                assert str(saved_node["sizing_w"]).lower() == "hug"
            finally:
                browser.close()


def test_v3_per_side_padding_updates_live_and_persists(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                assert _component_model_x(page, "step_problem") == 24

                page.evaluate("() => setFrameProp('page', 'padding_left', 80)")
                page.wait_for_timeout(500)
                after_x = _component_model_x(page, "step_problem")
                assert after_x == 80

                page.evaluate("() => saveOverrides()")
                page.wait_for_function(
                  "(targetX) => model.get('step_problem')?.data?.x === targetX",
                  arg=after_x,
                )

                saved_yaml = yaml.safe_load(saved_frame.read_text(encoding='utf-8'))
                assert saved_yaml["root"]["padding_left"] == 80
                assert _component_model_x(page, "step_problem") == after_x
            finally:
                browser.close()


def test_v3_keyboard_delete_removes_frame_persists_and_undo(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "simple-testcase.yaml"
    saved_frame = frames_dir / "simple-testcase.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "define")
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.locator('[data-component-id="define"] rect').click()
                page.wait_for_function(
                    "() => selectedIds.size === 1 && selectedIds.has('define')",
                )
                page.keyboard.press("Delete")
                page.wait_for_function("() => model.get('define') === null")
                page.wait_for_function("() => !__DG_TEST_treeHasFrameId('define')")

                page.evaluate("() => performUndo()")
                page.wait_for_function("() => model.get('define') !== null")
                page.wait_for_function("() => __DG_TEST_treeHasFrameId('define')")

                page.evaluate("() => performRedo()")
                page.wait_for_function("() => model.get('define') === null")

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(500)
                saved_yaml = yaml.safe_load(saved_frame.read_text(encoding="utf-8"))
                assert _find_frame(saved_yaml["root"], "define") is None
                arrows = saved_yaml.get("arrows") or []
                assert not any(
                    a.get("source") == "define" or a.get("target") == "define"
                    for a in arrows
                    if isinstance(a, dict)
                )
            finally:
                browser.close()


def test_v3_clear_panel_heading_keeps_parent_stroke(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "simple-testcase.yaml"
    shutil.copyfile(source_frame, frames_dir / "simple-testcase.yaml")

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "planning")
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.evaluate(
                    """
                    async () => {
                      setOverride('planning', {
                        text: {
                          heading: '',
                          label: ['Define ingress, pipeline', 'Measure current, performance'],
                        },
                      });
                      await requestV3Relayout('planning');
                    }
                    """
                )
                page.wait_for_function(
                    """
                    () => {
                      const rect = document.querySelector('[data-component-id="planning"] rect');
                      const stroke = rect && rect.getAttribute('stroke');
                      return stroke && stroke !== 'none';
                    }
                    """
                )
            finally:
                browser.close()


def test_v3_dirty_diagram_next_cancel_keeps_nav_ui_in_sync(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    for name in ("simple-testcase.yaml", "support-engineering-flow.yaml"):
        shutil.copyfile(SCRIPTS / "diagrams" / "frames" / name, frames_dir / name)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "define")
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.dismiss()))
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                nav_before = _preview_nav_state(page)
                assert nav_before["nextValue"] == "/view/v3:support-engineering-flow"

                page.locator('[data-component-id="define"] rect').click()
                page.keyboard.press("Delete")
                page.wait_for_function("() => model.get('define') === null")

                page.locator("#diagram-next").click()
                page.wait_for_timeout(200)

                nav_after = _preview_nav_state(page)
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM]
                assert nav_after["path"] == nav_before["path"]
                assert nav_after["pickerValue"] == nav_before["path"]
                assert nav_after["activeBrowseHref"] == nav_before["path"]
                assert page.evaluate("() => model.get('define') === null")
            finally:
                browser.close()


def test_v3_dirty_browse_link_cancel_keeps_nav_ui_in_sync(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    for name in ("simple-testcase.yaml", "support-engineering-flow.yaml"):
        shutil.copyfile(SCRIPTS / "diagrams" / "frames" / name, frames_dir / name)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "define")
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.dismiss()))
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                nav_before = _preview_nav_state(page)

                page.locator('[data-component-id="define"] rect').click()
                page.keyboard.press("Delete")
                page.wait_for_function("() => model.get('define') === null")

                page.locator(".dg-browse-link", has_text="support-engineering-flow").click()
                page.wait_for_timeout(200)

                nav_after = _preview_nav_state(page)
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM]
                assert nav_after["path"] == nav_before["path"]
                assert nav_after["pickerValue"] == nav_before["path"]
                assert nav_after["activeBrowseHref"] == nav_before["path"]
                assert page.evaluate("() => model.get('define') === null")
            finally:
                browser.close()


def test_v3_unsaved_delete_restored_after_diagram_next_and_back(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    for name in ("simple-testcase.yaml", "support-engineering-flow.yaml"):
        shutil.copyfile(SCRIPTS / "diagrams" / "frames" / name, frames_dir / name)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "define")
            try:
                dialogs: list[str] = []
                page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                nav_before = _preview_nav_state(page)
                assert nav_before["nextValue"] == "/view/v3:support-engineering-flow"
                page.locator('[data-component-id="define"] rect').click()
                page.keyboard.press("Delete")
                page.wait_for_function("() => model.get('define') === null")

                page.locator("#diagram-next").click()
                _wait_for_diagram_loaded(page, slug="support-engineering-flow", component_id="step_fix")
                assert dialogs == [DIRTY_DIAGRAM_NAV_CONFIRM]

                page.go_back(wait_until="domcontentloaded")
                _wait_for_diagram_loaded(page, slug="simple-testcase", component_id="define")
                page.wait_for_function("() => model.get('define') !== null")
                page.wait_for_function("() => __DG_TEST_treeHasFrameId('define')")
            finally:
                browser.close()


def test_v3_delete_without_save_restored_on_reload(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "simple-testcase.yaml"
    saved_frame = frames_dir / "simple-testcase.yaml"
    shutil.copyfile(source_frame, saved_frame)
    yaml_before = yaml.safe_load(saved_frame.read_text(encoding="utf-8"))

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "define")
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.locator('[data-component-id="define"] rect').click()
                page.keyboard.press("Delete")
                page.wait_for_function("() => model.get('define') === null")

                yaml_after_delete = yaml.safe_load(saved_frame.read_text(encoding="utf-8"))
                assert _find_frame(yaml_after_delete["root"], "define") is not None

                page.reload()
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.wait_for_function("() => model.get('define') !== null")
                page.wait_for_function("() => __DG_TEST_treeHasFrameId('define')")
                assert page.evaluate("() => canUndo()") is False

                yaml_after_reload = yaml.safe_load(saved_frame.read_text(encoding="utf-8"))
                assert yaml_after_reload == yaml_before
            finally:
                browser.close()


def test_v3_tree_context_menu_delete_removes_frame(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "simple-testcase.yaml"
    saved_frame = frames_dir / "simple-testcase.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(playwright, base_url, "simple-testcase", "measure")
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.evaluate(
                    """
                    () => {
                      const el = [...document.querySelectorAll('#tree .tree-item')]
                        .find((node) => node.textContent === 'measure');
                      if (!el) throw new Error('measure tree row missing');
                      el.dispatchEvent(new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: 20,
                        clientY: 20,
                      }));
                    }
                    """
                )
                page.locator("#dg-tree-context-menu button", has_text="Delete frame").click()
                page.wait_for_function("() => model.get('measure') === null")
                page.wait_for_function("() => !__DG_TEST_treeHasFrameId('measure')")
            finally:
                browser.close()


def test_v3_undo_redo_relayouts_padding_override(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            try:
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                assert _component_model_x(page, "step_problem") == 24

                page.evaluate("() => setFrameProp('page', 'padding_left', 80)")
                page.wait_for_function("() => model.get('step_problem')?.data?.x === 80")

                page.evaluate("() => performUndo()")
                page.wait_for_function("() => model.get('step_problem')?.data?.x === 24")

                page.evaluate("() => performRedo()")
                page.wait_for_function("() => model.get('step_problem')?.data?.x === 80")
            finally:
                browser.close()


def test_v3_save_is_blocked_while_local_relayout_is_in_error(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    source_frame = SCRIPTS / "diagrams" / "frames" / "support-engineering-flow.yaml"
    saved_frame = frames_dir / "support-engineering-flow.yaml"
    shutil.copyfile(source_frame, saved_frame)
    baseline_text = saved_frame.read_text(encoding="utf-8")

    with _preview_server(extra_env={"DG_FRAMES_DIR": str(frames_dir)}) as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_support_engineering_page(playwright, base_url)
            dialogs: list[str] = []
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))
            try:
                _select_component(page, "step_fix")
                page.wait_for_function("() => getV3RelayoutStatus().localReady")
                page.evaluate("() => __DG_TEST_setLocalRelayoutMode('unready')")
                page.wait_for_function("() => !getV3RelayoutStatus().localReady")

                blocked_state = _apply_v3_style_and_capture(page, "step_fix", "parent")
                assert blocked_state["relayout"]["lastMode"] == "local-error"
                assert blocked_state["override"]["style"] == "parent"

                page.evaluate("() => saveOverrides()")
                page.wait_for_timeout(300)

                assert dialogs
                assert "Cannot save while local relayout is in an error state" in dialogs[-1]
                assert saved_frame.read_text(encoding="utf-8") == baseline_text
            finally:
                browser.close()


def test_support_engineering_flow_preview_regression():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            try:
                page.goto(f"{base_url}/view/v3:support-engineering-flow", wait_until="domcontentloaded")
                page.wait_for_function(
                    """
                    () => (
                      typeof selectedIds !== 'undefined' &&
                      typeof setFrameProp === 'function' &&
                      typeof applyAllOverrides === 'function' &&
                      typeof applyV3Style === 'function' &&
                      document.querySelector('[data-component-id="page"]') !== null &&
                      document.querySelector('[data-component-id="step_analysis"]') !== null &&
                      document.querySelector('[data-component-id="step_fix"]') !== null
                    )
                    """
                )
                page.wait_for_timeout(150)

                baseline = page.evaluate(
                    """
                    () => ({
                      geometry: (() => {
                        const pageRect = document
                          .querySelector('[data-component-id="page"]')
                          .querySelector(':scope > rect');
                        const svg = document.querySelector('#stage svg');
                        return {
                          page: {
                            x: pageRect.getAttribute('x'),
                            y: pageRect.getAttribute('y'),
                            width: pageRect.getAttribute('width'),
                            height: pageRect.getAttribute('height'),
                          },
                          svg: {
                            width: svg.getAttribute('width'),
                            height: svg.getAttribute('height'),
                            viewBox: svg.getAttribute('viewBox'),
                          },
                        };
                      })(),
                      coords: (() => {
                        const pageBox = document
                          .querySelector('[data-component-id="page"]')
                          .getBoundingClientRect();
                        const childBox = document
                          .querySelector('[data-component-id="step_analysis"] rect')
                          .getBoundingClientRect();
                        return {
                          childX: childBox.left + childBox.width / 2,
                          childY: childBox.top + childBox.height / 2,
                          pageMarginX: childBox.left + childBox.width / 2,
                          pageMarginY: Math.min(pageBox.bottom - 8, childBox.bottom + 24),
                        };
                      })(),
                    })
                    """
                )

                page.locator('[data-component-id="step_analysis"] rect').click()
                page.wait_for_function("() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'step_analysis'")
                child_click = page.evaluate(
                    """
                    () => ({
                      selected: Array.from(selectedIds),
                      handleCount: document.querySelectorAll('.dg-handle').length,
                      outlineCount: document.querySelectorAll('.dg-handle-outline').length,
                      geometry: (() => {
                        const pageRect = document
                          .querySelector('[data-component-id="page"]')
                          .querySelector(':scope > rect');
                        const svg = document.querySelector('#stage svg');
                        return {
                          page: {
                            x: pageRect.getAttribute('x'),
                            y: pageRect.getAttribute('y'),
                            width: pageRect.getAttribute('width'),
                            height: pageRect.getAttribute('height'),
                          },
                          svg: {
                            width: svg.getAttribute('width'),
                            height: svg.getAttribute('height'),
                            viewBox: svg.getAttribute('viewBox'),
                          },
                        };
                      })(),
                    })
                    """
                )
                assert child_click["selected"] == ["step_analysis"]
                assert child_click["handleCount"] == 8
                assert child_click["outlineCount"] == 1
                assert child_click["geometry"] == baseline["geometry"]

                blank_coords = page.evaluate(
                    """
                    () => {
                      const pageBox = document
                        .querySelector('[data-component-id="page"]')
                        .getBoundingClientRect();
                      const childBox = document
                        .querySelector('[data-component-id="step_analysis"] rect')
                        .getBoundingClientRect();
                      return {
                        x: childBox.left + childBox.width / 2,
                        y: Math.min(pageBox.bottom - 8, childBox.bottom + 24),
                      };
                    }
                    """
                )
                page.mouse.click(blank_coords["x"], blank_coords["y"])
                page.wait_for_function("() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'page'")
                page_click = page.evaluate(
                    """
                    () => ({
                      selected: Array.from(selectedIds),
                      handleCount: document.querySelectorAll('.dg-handle').length,
                      outlineCount: document.querySelectorAll('.dg-handle-outline').length,
                      rootSelectedClass: document
                        .querySelector('[data-component-id="page"]')
                        .classList.contains('dg-selected'),
                      geometry: (() => {
                        const pageRect = document
                          .querySelector('[data-component-id="page"]')
                          .querySelector(':scope > rect');
                        const svg = document.querySelector('#stage svg');
                        return {
                          page: {
                            x: pageRect.getAttribute('x'),
                            y: pageRect.getAttribute('y'),
                            width: pageRect.getAttribute('width'),
                            height: pageRect.getAttribute('height'),
                          },
                          svg: {
                            width: svg.getAttribute('width'),
                            height: svg.getAttribute('height'),
                            viewBox: svg.getAttribute('viewBox'),
                          },
                        };
                      })(),
                    })
                    """
                )
                assert page_click["selected"] == ["page"]
                assert page_click["handleCount"] == 8
                assert page_click["outlineCount"] == 1
                assert page_click["rootSelectedClass"] is True
                assert page_click["geometry"] == baseline["geometry"]

                metrics = page.evaluate(
                    """
                    async () => {
                      function sleep(ms) {
                        return new Promise((resolve) => setTimeout(resolve, ms));
                      }

                      function componentMetrics(id) {
                        const group = document.querySelector(`[data-component-id="${id}"]`);
                        const rect = group.querySelector(':scope > rect');
                        const text = group.querySelector(':scope > text');
                        const bbox = text.getBBox();
                        const rectBottom = Number(rect.getAttribute('y') || '0') + Number(rect.getAttribute('height') || '0');
                        return {
                          rectFill: rect.getAttribute('fill'),
                          textFill: text.querySelector('tspan')?.getAttribute('fill') || null,
                          rectWidth: Number(rect.getAttribute('width') || '0'),
                          rectHeight: Number(rect.getAttribute('height') || '0'),
                          overflow: bbox.y + bbox.height > rectBottom + 0.5,
                        };
                      }

                      function textSignature(id) {
                        const group = document.querySelector(`[data-component-id="${id}"]`);
                        const text = group.querySelector(':scope > text') || group.querySelector('text');
                        return Array.from(text.querySelectorAll('tspan'))
                          .map((tspan) => tspan.textContent || '')
                          .join('|');
                      }

                      function arrowMetrics(id, sourceId, targetId) {
                        const arrow = document.querySelector(`[data-component-id="${id}"]`);
                        const lines = Array.from(arrow.querySelectorAll('line'));
                        const shaft = lines[lines.length - 1];
                        const polygon = arrow.querySelector('polygon');
                        const points = (polygon.getAttribute('points') || '')
                          .trim()
                          .split(/ +/)
                          .map((pair) => pair.split(',').map(Number));
                        const base = {
                          x: (points[0][0] + points[2][0]) / 2,
                          y: (points[0][1] + points[2][1]) / 2,
                        };
                        const tip = { x: points[1][0], y: points[1][1] };
                        const sourceRect = document
                          .querySelector(`[data-component-id="${sourceId}"]`)
                          .querySelector(':scope > rect');
                        const targetRect = document
                          .querySelector(`[data-component-id="${targetId}"]`)
                          .querySelector(':scope > rect');
                        const source = {
                          x: Number(sourceRect.getAttribute('x') || '0'),
                          y: Number(sourceRect.getAttribute('y') || '0'),
                          width: Number(sourceRect.getAttribute('width') || '0'),
                          height: Number(sourceRect.getAttribute('height') || '0'),
                        };
                        const target = {
                          x: Number(targetRect.getAttribute('x') || '0'),
                          y: Number(targetRect.getAttribute('y') || '0'),
                          width: Number(targetRect.getAttribute('width') || '0'),
                          height: Number(targetRect.getAttribute('height') || '0'),
                        };
                        return {
                          shaftEnd: {
                            x: Number(shaft.getAttribute('x2') || '0'),
                            y: Number(shaft.getAttribute('y2') || '0'),
                          },
                          base,
                          tip,
                          expectedSource: {
                            x: source.x + source.width,
                            y: source.y + source.height / 2,
                          },
                          expectedTarget: {
                            x: target.x,
                            y: target.y + target.height / 2,
                          },
                          endpoints: lines.flatMap((line) => [
                            {
                              x: Number(line.getAttribute('x1') || '0'),
                              y: Number(line.getAttribute('y1') || '0'),
                            },
                            {
                              x: Number(line.getAttribute('x2') || '0'),
                              y: Number(line.getAttribute('y2') || '0'),
                            },
                          ]),
                        };
                      }

                      function gridSpacingMetrics() {
                        const firstRect = document
                          .querySelector('[data-component-id="step_problem"]')
                          .querySelector(':scope > rect');
                        const secondRect = document
                          .querySelector('[data-component-id="step_investigation"]')
                          .querySelector(':scope > rect');
                        const pageRect = document
                          .querySelector('[data-component-id="page"]')
                          .querySelector(':scope > rect');
                        const overlay = document.querySelector('#stage svg #dg-grid-overlay');
                        const colBands = overlay
                          ? Array.from(overlay.querySelectorAll('rect'))
                              .map((rect) => ({
                                x: Number(rect.getAttribute('x') || '0'),
                                width: Number(rect.getAttribute('width') || '0'),
                                fill: rect.getAttribute('fill') || '',
                              }))
                              .filter((rect) => rect.fill === 'rgba(100,160,255,0.04)')
                          : [];
                        const firstX = Number(firstRect.getAttribute('x') || '0');
                        const firstW = Number(firstRect.getAttribute('width') || '0');
                        const secondX = Number(secondRect.getAttribute('x') || '0');
                        return {
                          pageWidth: Number(pageRect.getAttribute('width') || '0'),
                          colGapInput: Number(document.getElementById('grid-col-gap').value || '0'),
                          marginTopInput: Number(document.getElementById('grid-margin-top').value || '0'),
                          marginRightInput: Number(document.getElementById('grid-margin-right').value || '0'),
                          marginBottomInput: Number(document.getElementById('grid-margin-bottom').value || '0'),
                          marginLeftInput: Number(document.getElementById('grid-margin-left').value || '0'),
                          gridColGap: Number(gridInfo?.col_gap || 0),
                          gridOuterMargin: Number(gridInfo?.outer_margin || 0),
                          firstBandX: colBands[0]?.x ?? null,
                          firstBandWidth: colBands[0]?.width ?? null,
                          secondBandX: colBands[1]?.x ?? null,
                          bandCount: colBands.length,
                          pageOverride: JSON.parse(JSON.stringify(overrides.page || null)),
                          pageGap: firstX,
                          firstWidth: firstW,
                          secondX,
                          gutter: secondX - (firstX + firstW),
                        };
                      }

                      cycleGuideMode();
                      await sleep(50);
                      const expectedText = textSignature('step_fix');
                      const linkedBefore = gridSpacingMetrics();

                      document.getElementById('grid-col-gap').value = '32';
                      onGridControlChange();
                      await sleep(400);
                      const linkedAfterExpand = gridSpacingMetrics();

                      document.getElementById('grid-col-gap').value = String(linkedBefore.colGapInput);
                      onGridControlChange();
                      await sleep(400);
                      const linkedAfterReset = gridSpacingMetrics();

                      setFrameProp('page', 'padding', 48);
                      await sleep(350);
                      setFrameProp('page', 'padding', 24);
                      await sleep(350);
                      setFrameProp('page', 'direction', 'VERTICAL');
                      await sleep(350);
                      setFrameProp('page', 'direction', 'HORIZONTAL');
                      await sleep(350);
                      const roundTrip = componentMetrics('step_fix');
                      const roundTripText = textSignature('step_fix');

                      const managedText = document
                        .querySelector('[data-component-id="step_fix"]')
                        .querySelector(':scope > text');
                      managedText.setAttribute('data-orig-inner', '<tspan x="0" y="0">stale snapshot</tspan>');
                      applyAllOverrides();
                      await sleep(50);
                      const staleProbeText = textSignature('step_fix');
                      const arrow = arrowMetrics('step_analysis->step_fix', 'step_analysis', 'step_fix');

                      applyV3Style('step_fix', 'highlight');
                      await sleep(350);
                      const highlight = componentMetrics('step_fix');
                      const highlightText = textSignature('step_fix');

                      async function captureStyle(styleName) {
                        applyV3Style('step_fix', styleName);
                        await sleep(350);
                        const m = componentMetrics('step_fix');
                        return {
                          rectFill: m.rectFill,
                          textFill: m.textFill,
                          overflow: m.overflow,
                        };
                      }

                      const styleMatrix = {
                        default: await captureStyle('default'),
                        parent: await captureStyle('parent'),
                        section: await captureStyle('section'),
                        annotation: await captureStyle('annotation'),
                        highlight: await captureStyle('highlight'),
                      };

                      applyV3Style('step_fix', '');
                      await sleep(350);
                      const reset = componentMetrics('step_fix');
                      const resetText = textSignature('step_fix');

                      return {
                        arrow,
                        expectedText,
                        linkedBefore,
                        linkedAfterExpand,
                        linkedAfterReset,
                        roundTrip,
                        roundTripText,
                        staleProbeText,
                        highlight,
                        highlightText,
                        styleMatrix,
                        reset,
                        resetText,
                      };
                    }
                    """
                )

                assert metrics["expectedText"] == metrics["roundTripText"]
                assert metrics["expectedText"] == metrics["staleProbeText"]
                assert metrics["expectedText"] == metrics["highlightText"]
                assert metrics["expectedText"] == metrics["resetText"]
                assert metrics["linkedBefore"]["pageWidth"] == 1464
                assert metrics["linkedBefore"]["marginTopInput"] == 24
                assert metrics["linkedBefore"]["marginRightInput"] == 24
                assert metrics["linkedBefore"]["marginBottomInput"] == 24
                assert metrics["linkedBefore"]["marginLeftInput"] == 24
                assert abs(metrics["linkedBefore"]["pageGap"] - metrics["linkedBefore"]["gutter"]) < 0.75
                assert metrics["linkedBefore"]["gridOuterMargin"] == metrics["linkedBefore"]["gridColGap"]
                assert metrics["linkedBefore"]["bandCount"] == 5
                assert abs(metrics["linkedBefore"]["firstBandX"] - metrics["linkedBefore"]["pageGap"]) < 0.75
                assert abs(metrics["linkedBefore"]["firstBandWidth"] - metrics["linkedBefore"]["firstWidth"]) < 0.75
                assert abs(metrics["linkedBefore"]["secondBandX"] - metrics["linkedBefore"]["secondX"]) < 0.75
                assert metrics["linkedBefore"]["pageOverride"] in (None, {})
                assert metrics["linkedAfterExpand"]["colGapInput"] == 32
                assert metrics["linkedAfterExpand"]["marginTopInput"] == 24
                assert metrics["linkedAfterExpand"]["marginRightInput"] == 24
                assert metrics["linkedAfterExpand"]["marginBottomInput"] == 24
                assert metrics["linkedAfterExpand"]["marginLeftInput"] == 24
                assert metrics["linkedAfterExpand"]["gridColGap"] == 32
                assert metrics["linkedAfterExpand"]["gridOuterMargin"] == 24
                assert metrics["linkedAfterExpand"]["pageWidth"] == 1456
                assert metrics["linkedAfterExpand"]["bandCount"] == 5
                assert metrics["linkedAfterExpand"]["pageOverride"] in (None, {})
                assert abs(metrics["linkedAfterExpand"]["firstBandX"] - metrics["linkedAfterExpand"]["pageGap"]) < 0.75
                assert abs(metrics["linkedAfterExpand"]["firstBandWidth"] - metrics["linkedAfterExpand"]["firstWidth"]) < 0.75
                assert abs(metrics["linkedAfterExpand"]["secondBandX"] - metrics["linkedAfterExpand"]["secondX"]) < 0.75
                assert abs(metrics["linkedAfterExpand"]["pageGap"] - 24) < 0.75
                assert abs(metrics["linkedAfterExpand"]["gutter"]) < 32.75 and abs(metrics["linkedAfterExpand"]["gutter"] - 32) < 0.75
                assert metrics["linkedAfterReset"]["marginTopInput"] == metrics["linkedBefore"]["marginTopInput"]
                assert metrics["linkedAfterReset"]["marginRightInput"] == metrics["linkedBefore"]["marginRightInput"]
                assert metrics["linkedAfterReset"]["marginBottomInput"] == metrics["linkedBefore"]["marginBottomInput"]
                assert metrics["linkedAfterReset"]["marginLeftInput"] == metrics["linkedBefore"]["marginLeftInput"]
                assert metrics["linkedAfterReset"]["gridOuterMargin"] == metrics["linkedBefore"]["gridOuterMargin"]
                assert metrics["linkedAfterReset"]["pageOverride"] in (None, {})
                assert metrics["linkedAfterReset"]["pageWidth"] == metrics["linkedBefore"]["pageWidth"]
                assert abs(metrics["linkedAfterReset"]["firstBandX"] - metrics["linkedAfterReset"]["pageGap"]) < 0.75
                assert abs(metrics["linkedAfterReset"]["firstBandWidth"] - metrics["linkedAfterReset"]["firstWidth"]) < 0.75
                assert abs(metrics["linkedAfterReset"]["secondBandX"] - metrics["linkedAfterReset"]["secondX"]) < 0.75
                assert abs(metrics["linkedAfterReset"]["pageGap"] - metrics["linkedBefore"]["pageGap"]) < 0.75
                assert abs(metrics["linkedAfterReset"]["gutter"] - metrics["linkedBefore"]["gutter"]) < 0.75
                assert not metrics["roundTrip"]["overflow"]
                assert metrics["roundTrip"]["rectWidth"] > 0
                assert metrics["roundTrip"]["rectHeight"] > 0
                assert abs(metrics["arrow"]["shaftEnd"]["x"] - metrics["arrow"]["base"]["x"]) < 0.75
                assert abs(metrics["arrow"]["shaftEnd"]["y"] - metrics["arrow"]["base"]["y"]) < 0.75
                assert any(
                  abs(point["x"] - metrics["arrow"]["expectedSource"]["x"]) < 0.75
                  and abs(point["y"] - metrics["arrow"]["expectedSource"]["y"]) < 0.75
                  for point in metrics["arrow"]["endpoints"]
                )
                assert abs(metrics["arrow"]["tip"]["x"] - metrics["arrow"]["expectedTarget"]["x"]) < 0.75
                assert abs(metrics["arrow"]["tip"]["y"] - metrics["arrow"]["expectedTarget"]["y"]) < 0.75
                assert metrics["highlight"]["rectFill"] == "#000000"
                assert metrics["highlight"]["textFill"] == "#FFFFFF"
                assert not metrics["highlight"]["overflow"]
                assert metrics["styleMatrix"]["default"]["rectFill"] == "transparent"
                assert metrics["styleMatrix"]["default"]["textFill"] == "#000000"
                assert metrics["styleMatrix"]["parent"]["rectFill"] == "#F3F3F3"
                assert metrics["styleMatrix"]["parent"]["textFill"] == "#000000"
                assert metrics["styleMatrix"]["section"]["rectFill"] == "transparent"
                assert metrics["styleMatrix"]["section"]["textFill"] == "#000000"
                assert metrics["styleMatrix"]["annotation"]["rectFill"] == "transparent"
                assert metrics["styleMatrix"]["annotation"]["textFill"] == "#666666"
                assert metrics["styleMatrix"]["highlight"]["rectFill"] == "#000000"
                assert metrics["styleMatrix"]["highlight"]["textFill"] == "#FFFFFF"
                assert all(not entry["overflow"] for entry in metrics["styleMatrix"].values())
                assert metrics["reset"]["rectFill"] == "transparent"
                assert metrics["reset"]["textFill"] == "#000000"
                assert not metrics["reset"]["overflow"]
            finally:
                browser.close()


def test_android_graphics_stack_click_selection_prefers_leaf_box():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            try:
                page.goto(f"{base_url}/view/v3:android-graphics-stack", wait_until="domcontentloaded")
                page.wait_for_function(
                    """
                    () => (
                      typeof selectedIds !== 'undefined' &&
                      document.querySelector('[data-component-id="page"]') !== null &&
                      document.querySelector('[data-component-id="apps"]') !== null &&
                      document.querySelector('[data-component-id="row_apps"]') !== null
                    )
                    """
                )

                baseline = page.evaluate(
                    """
                    () => {
                      const pageRect = document
                        .querySelector('[data-component-id="page"]')
                        .querySelector(':scope > rect');
                      const svg = document.querySelector('#stage svg');
                      const appsRect = document
                        .querySelector('[data-component-id="apps"] rect')
                        .getBoundingClientRect();
                      return {
                        pageGeometry: {
                          x: pageRect.getAttribute('x'),
                          y: pageRect.getAttribute('y'),
                          width: pageRect.getAttribute('width'),
                          height: pageRect.getAttribute('height'),
                        },
                        svgGeometry: {
                          width: svg.getAttribute('width'),
                          height: svg.getAttribute('height'),
                          viewBox: svg.getAttribute('viewBox'),
                        },
                      };
                    }
                    """
                )

                page.locator('[data-component-id="apps"] rect').click()
                page.wait_for_function(
                    "() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'apps'"
                )

                after_apps = page.evaluate(
                    """
                    () => {
                      const pageRect = document
                        .querySelector('[data-component-id="page"]')
                        .querySelector(':scope > rect');
                      const rowRect = document
                        .querySelector('[data-component-id="row_apps"] rect')
                        .getBoundingClientRect();
                      const pageBounds = document
                        .querySelector('[data-component-id="page"]')
                        .getBoundingClientRect();
                      return {
                        selected: Array.from(selectedIds),
                        handleCount: document.querySelectorAll('.dg-handle').length,
                        outlineCount: document.querySelectorAll('.dg-handle-outline').length,
                        pageGeometry: {
                          x: pageRect.getAttribute('x'),
                          y: pageRect.getAttribute('y'),
                          width: pageRect.getAttribute('width'),
                          height: pageRect.getAttribute('height'),
                        },
                        svgGeometry: {
                          width: document.querySelector('#stage svg').getAttribute('width'),
                          height: document.querySelector('#stage svg').getAttribute('height'),
                          viewBox: document.querySelector('#stage svg').getAttribute('viewBox'),
                        },
                        blankClick: {
                          x: rowRect.left + rowRect.width / 2,
                          y: Math.min(pageBounds.bottom - 12, rowRect.bottom + 16),
                        },
                      };
                    }
                    """
                )

                assert after_apps["selected"] == ["apps"]
                assert after_apps["handleCount"] == 8
                assert after_apps["outlineCount"] == 1
                assert after_apps["pageGeometry"] == baseline["pageGeometry"]
                assert after_apps["svgGeometry"] == baseline["svgGeometry"]

                page.mouse.click(after_apps["blankClick"]["x"], after_apps["blankClick"]["y"])
                page.wait_for_function(
                    "() => Array.from(selectedIds).length === 1 && Array.from(selectedIds)[0] === 'page'"
                )

                after_blank = page.evaluate(
                    """
                    () => {
                      const pageRect = document
                        .querySelector('[data-component-id="page"]')
                        .querySelector(':scope > rect');
                      return {
                        selected: Array.from(selectedIds),
                        handleCount: document.querySelectorAll('.dg-handle').length,
                        outlineCount: document.querySelectorAll('.dg-handle-outline').length,
                        rootSelectedClass: document
                          .querySelector('[data-component-id="page"]')
                          .classList.contains('dg-selected'),
                        pageGeometry: {
                          x: pageRect.getAttribute('x'),
                          y: pageRect.getAttribute('y'),
                          width: pageRect.getAttribute('width'),
                          height: pageRect.getAttribute('height'),
                        },
                        svgGeometry: {
                          width: document.querySelector('#stage svg').getAttribute('width'),
                          height: document.querySelector('#stage svg').getAttribute('height'),
                          viewBox: document.querySelector('#stage svg').getAttribute('viewBox'),
                        },
                      };
                    }
                    """
                )

                assert after_blank["selected"] == ["page"]
                assert after_blank["handleCount"] == 8
                assert after_blank["outlineCount"] == 1
                assert after_blank["rootSelectedClass"] is True
                assert after_blank["pageGeometry"] == baseline["pageGeometry"]
                assert after_blank["svgGeometry"] == baseline["svgGeometry"]
            finally:
                browser.close()


def test_android_custom_to_cloud_arrow_dblclick_adds_first_waypoint():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(
                playwright,
                base_url,
                "android-custom-to-cloud",
                "custom_files->host_tools",
            )
            try:
                state = page.evaluate(
                    """
                    () => {
                      const arrowId = 'custom_files->host_tools';
                      const target =
                        document.querySelector(`[data-component-id="${arrowId}"] line[stroke="transparent"]`)
                        || document.querySelector(`[data-component-id="${arrowId}"] line`);
                      if (!target) return { error: 'missing-target' };
                      const rect = target.getBoundingClientRect();
                      const x = rect.left + rect.width / 2;
                      const y = rect.top + rect.height / 2;
                      selectedIds.clear();
                      renderSelectionInspector();
                      target.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        button: 0,
                      }));
                      const afterSelect = {
                        selected: Array.from(selectedIds),
                        inspector: (document.getElementById('inspector')?.innerText || '').replace(/\\s+/g, ' ').trim(),
                        waypoints: JSON.parse(JSON.stringify(model.get(arrowId)?.data?.waypoints || [])),
                      };
                      target.dispatchEvent(new MouseEvent('dblclick', {
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        button: 0,
                      }));
                      return {
                        afterSelect,
                        afterDblClick: {
                          selected: Array.from(selectedIds),
                          inspector: (document.getElementById('inspector')?.innerText || '').replace(/\\s+/g, ' ').trim(),
                          waypoints: JSON.parse(JSON.stringify(model.get(arrowId)?.data?.waypoints || [])),
                          overrideWaypoints: JSON.parse(JSON.stringify(overrides[arrowId]?.waypoints || [])),
                          visibleLines: Array.from(document.querySelectorAll(`[data-component-id="${arrowId}"] line`)).filter((ln) => ln.getAttribute('stroke') !== 'transparent').length,
                          waypointHandles: document.querySelectorAll('.dg-wp-handle').length,
                        },
                      };
                    }
                    """
                )

                assert state.get("error") is None
                assert state["afterSelect"]["selected"] == ["custom_files->host_tools"]
                assert state["afterSelect"]["waypoints"] == []
                assert state["afterDblClick"]["selected"] == ["custom_files->host_tools"]
                assert len(state["afterDblClick"]["waypoints"]) == 1
                assert state["afterDblClick"]["overrideWaypoints"] == state["afterDblClick"]["waypoints"]
                assert state["afterDblClick"]["visibleLines"] == 2
                assert state["afterDblClick"]["waypointHandles"] == 1
                assert "WAYPOINTS 1 (overridden)" in state["afterDblClick"]["inspector"]
            finally:
                browser.close()


def test_complex_routing_clear_override_restores_routed_arrow_segments():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser, page = _open_v3_page(
                playwright,
                base_url,
                "complex-routing-usecase",
                "define->implement",
            )
            try:
                state = page.evaluate(
                    """
                    async () => {
                      const arrowId = 'define->implement';
                      const visibleLines = () => Array.from(
                        document.querySelectorAll(`[data-component-id="${arrowId}"] line`)
                      ).filter((ln) => ln.getAttribute('stroke') !== 'transparent').map((ln) => ({
                        x1: ln.getAttribute('x1'),
                        y1: ln.getAttribute('y1'),
                        x2: ln.getAttribute('x2'),
                        y2: ln.getAttribute('y2'),
                      }));
                      const before = {
                        waypoints: JSON.parse(JSON.stringify(model.get(arrowId)?.data?.waypoints || [])),
                        visibleLines: visibleLines(),
                      };
                      model.setWaypointOverride(arrowId, [[999, 999]]);
                      model.get(arrowId).data.waypoints = [[999, 999]];
                      rebuildArrowSVG(arrowId);
                      clearOverride(arrowId);
                      await new Promise((resolve) => setTimeout(resolve, 700));
                      return {
                        before,
                        after: {
                          waypoints: JSON.parse(JSON.stringify(model.get(arrowId)?.data?.waypoints || [])),
                          visibleLines: visibleLines(),
                        },
                      };
                    }
                    """
                )

                assert len(state["before"]["waypoints"]) == 2
                assert len(state["before"]["visibleLines"]) == 3
                assert state["after"]["waypoints"] == state["before"]["waypoints"]
                assert state["after"]["visibleLines"] == state["before"]["visibleLines"]
            finally:
                browser.close()


def test_grid_gap_typing_replaces_value_and_per_side_margins_remain_stable():
    with _preview_server() as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1600, "height": 1200})
            try:
                page.goto(f"{base_url}/view/v3:android-container-vs-vm", wait_until="domcontentloaded")
                page.wait_for_function(
                    """
                    () => (
                      document.getElementById('grid-col-gap') !== null &&
                      document.getElementById('grid-row-gap') !== null &&
                      document.getElementById('grid-margin-top') !== null &&
                      document.getElementById('grid-margin-right') !== null &&
                      document.getElementById('grid-margin-bottom') !== null &&
                      document.getElementById('grid-margin-left') !== null &&
                      document.querySelector('#stage svg') !== null
                    )
                    """
                )
                page.wait_for_timeout(150)

                row_gap = page.locator('#grid-row-gap')
                row_gap.click()
                row_gap.type('32', delay=50)
                page.wait_for_timeout(300)

                metrics = page.evaluate(
                    """
                    () => ({
                      rowGapValue: document.getElementById('grid-row-gap').value,
                      rowGapReadOnly: document.getElementById('grid-row-gap').readOnly,
                      marginTopValue: document.getElementById('grid-margin-top').value,
                      marginRightValue: document.getElementById('grid-margin-right').value,
                      marginBottomValue: document.getElementById('grid-margin-bottom').value,
                      marginLeftValue: document.getElementById('grid-margin-left').value,
                      marginTopReadOnly: document.getElementById('grid-margin-top').readOnly,
                      rows: document.getElementById('grid-rows').value,
                    })
                    """
                )

                assert metrics['rowGapValue'] == '32'
                assert metrics['rowGapReadOnly'] is False
                assert metrics['marginTopValue'] == '24'
                assert metrics['marginRightValue'] == '24'
                assert metrics['marginBottomValue'] == '24'
                assert metrics['marginLeftValue'] == '24'
                assert metrics['marginTopReadOnly'] is False
                assert metrics['rows'] == '6'
            finally:
                browser.close()
