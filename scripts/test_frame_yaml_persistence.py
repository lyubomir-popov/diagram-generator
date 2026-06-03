from __future__ import annotations

import pathlib

import yaml

from frame_yaml_persistence import persist_override_payload_to_yaml


ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAME_FIXTURE = ROOT / "scripts" / "diagrams" / "frames" / "support-engineering-flow.yaml"


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


def test_persist_override_payload_writes_canonical_yaml_fields(tmp_path):
    frame_path = tmp_path / "support-engineering-flow.yaml"
    frame_path.write_text(FRAME_FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")

    persist_override_payload_to_yaml(
        frame_path,
        {
            "overrides": {
                "step_fix": {
                    "style": "parent",
                    "text": {
                        "heading": "The updated fix",
                        "label": ["", "Canonical YAML save path."],
                    },
                }
            }
        },
    )

    saved_text = frame_path.read_text(encoding="utf-8")
    saved_yaml = yaml.safe_load(saved_text)
    step_fix = _find_frame(saved_yaml["root"], "step_fix")

    assert step_fix is not None
    assert step_fix["level"] == 2
    assert step_fix["fill"] == "grey"
    assert step_fix["border"] == "solid"
    assert step_fix["heading"] == "The updated fix"
    assert step_fix["label"] == ["", "Canonical YAML save path."]
    assert "style:" not in saved_text
    assert "overrideRole" not in saved_text
    assert "grid_overrides:" not in saved_text


def test_persist_removed_ids_prunes_frames_and_arrows(tmp_path):
    frame_path = tmp_path / "demo.yaml"
    frame_path.write_text(
        """
engine: v3
title: Demo
arrows:
  - source: leaf_a
    target: leaf_b
root:
  id: page
  direction: horizontal
  children:
    - id: panel
      direction: vertical
      children:
        - id: leaf_a
          label: [A]
        - id: leaf_b
          label: [B]
""".strip()
        + "\n",
        encoding="utf-8",
    )

    persist_override_payload_to_yaml(
        frame_path,
        {"overrides": {}, "removed_ids": ["leaf_a"]},
    )

    saved = yaml.safe_load(frame_path.read_text(encoding="utf-8"))
    panel = _find_frame(saved["root"], "panel")
    assert panel is not None
    assert _find_frame(saved["root"], "leaf_a") is None
    assert _find_frame(saved["root"], "leaf_b") is not None
    assert saved["arrows"] == []


def test_empty_payload_is_a_no_op_without_rewriting_yaml(tmp_path):
    frame_path = tmp_path / "support-engineering-flow.yaml"
    baseline_text = FRAME_FIXTURE.read_text(encoding="utf-8")
    frame_path.write_text(baseline_text, encoding="utf-8")
    persist_override_payload_to_yaml(frame_path, {"overrides": {}, "grid_overrides": {}})

    assert frame_path.read_text(encoding="utf-8") == baseline_text
