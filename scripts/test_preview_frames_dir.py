"""Regression: Node preview CLIs honor DG_FRAMES_DIR (adversarial review P1)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
EMIT_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "emit-preview-document-json.mjs"
EXPORT_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "export-frame-svg.mjs"
REPO_FRAMES = ROOT / "scripts" / "diagrams" / "frames"


@pytest.mark.skipif(not EMIT_SCRIPT.is_file(), reason="emit script missing")
def test_emit_frame_diagram_json_honors_dg_frames_dir(tmp_path: Path):
    alt_frames = tmp_path / "frames"
    alt_frames.mkdir()
    slug = "dg-frames-probe"
    unique_title = "DG_FRAMES_DIR_PROBE_TITLE_XYZ"
    (alt_frames / f"{slug}.yaml").write_text(
        f'engine: v3\ntitle: "{unique_title}"\nroot:\n  id: page\n  direction: horizontal\n  children: []\n',
        encoding="utf-8",
    )
    assert not (REPO_FRAMES / f"{slug}.yaml").is_file()

    proc = subprocess.run(
        ["node", str(EMIT_SCRIPT), "--slug", slug],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "DG_FRAMES_DIR": str(alt_frames)},
    )
    assert proc.returncode == 0, proc.stderr
    data = json.loads(proc.stdout)
    assert data.get("title") == unique_title


@pytest.mark.skipif(not EMIT_SCRIPT.is_file(), reason="emit script missing")
def test_emit_frame_diagram_json_strips_line_style_fields_runtime(tmp_path: Path):
    alt_frames = tmp_path / "frames"
    alt_frames.mkdir()
    slug = "runtime-style-strip"
    (alt_frames / f"{slug}.yaml").write_text(
        "\n".join(
            [
                "engine: v3",
                'title: "Runtime strip probe"',
                "root:",
                "  id: page",
                "  direction: horizontal",
                "  children:",
                "    - id: panel",
                "      heading:",
                "        text: Styled heading",
                '        fill: "#FF00FF"',
                '        weight: "900"',
                "      children: []",
                "    - id: note",
                "      variant: annotation",
                "      label:",
                "        - text: Styled label",
                '          fill: "#00FF00"',
                '          weight: "800"',
                "",
            ]
        ),
        encoding="utf-8",
    )

    proc = subprocess.run(
        ["node", str(EMIT_SCRIPT), "--slug", slug],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
        env={**os.environ, "DG_FRAMES_DIR": str(alt_frames)},
    )
    assert proc.returncode == 0, proc.stderr

    data = json.loads(proc.stdout)
    note = data["frameTree"]["root"]["children"][1]
    assert note["label"] == [{"content": "Styled label"}]


@pytest.mark.skipif(not EXPORT_SCRIPT.is_file(), reason="export script missing")
def test_export_frame_svg_runtime_ignores_frame_owned_line_style_fields(tmp_path: Path):
    alt_frames = tmp_path / "frames"
    alt_frames.mkdir()
    slug = "runtime-export-strip"
    (alt_frames / f"{slug}.yaml").write_text(
        "\n".join(
            [
                "engine: v3",
                'title: "Runtime export strip probe"',
                "root:",
                "  id: page",
                "  direction: horizontal",
                "  children:",
                "    - id: note",
                "      variant: annotation",
                "      label:",
                "        - text: Semantic export note",
                '          fill: "#FF00FF"',
                '          weight: "900"',
                "",
            ]
        ),
        encoding="utf-8",
    )

    proc = subprocess.run(
        ["node", str(EXPORT_SCRIPT), "--slug", slug],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
        env={**os.environ, "DG_FRAMES_DIR": str(alt_frames)},
    )
    assert proc.returncode == 0, proc.stderr
    assert "Semantic export note" in proc.stdout
    assert "#FF00FF" not in proc.stdout
    assert 'font-weight="900"' not in proc.stdout
    assert 'fill="#666666"' in proc.stdout
