"""Unit tests for native frame YAML parsing.

These tests freeze the omission semantics in ``frame_loader.py`` so future
YAML changes do not silently alter the v3 frame contract.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from frame_loader import load_frame_yaml
from frame_model import Sizing
from diagram_model import Border


def _load(tmp_path, content: str):
    path = tmp_path / "diagram.yaml"
    path.write_text(content, encoding="utf-8")
    return load_frame_yaml(path)


def test_omitted_sizing_defaults_leaf_nodes_to_fill_width_hug_height(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
    )

    assert diagram.root.sizing_w == Sizing.FILL
    assert diagram.root.sizing_h == Sizing.FILL
    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.FILL
    assert child.sizing_h == Sizing.HUG


def test_explicit_width_without_sizing_infers_fixed_width_only(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      width: 240
      label:
        - Hello
""",
    )

    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.FIXED
    assert child.sizing_h == Sizing.HUG


def test_explicit_height_without_sizing_infers_fixed_height_only(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      height: 96
      label:
        - Hello
""",
    )

    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.FILL
    assert child.sizing_h == Sizing.FIXED


def test_container_children_still_default_to_fill_on_both_axes(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      children:
        - id: leaf
          label:
            - Hello
""",
    )

    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.FILL
    assert child.sizing_h == Sizing.HUG


def test_borderless_leaf_text_defaults_to_hug_on_both_axes(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: note
      border: none
      label:
        - Hello
""",
    )

    note = diagram.root.children[0]
    assert note.sizing_w == Sizing.HUG
    assert note.sizing_h == Sizing.HUG


def test_explicit_sizing_prevents_fixed_inference(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      sizing: hug
      width: 240
      label:
        - Hello
""",
    )

    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.HUG
    assert child.sizing_h == Sizing.HUG


def test_per_axis_sizing_overrides_uniform_sizing(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      sizing: hug
      sizing_h: fill
      label:
        - Hello
""",
    )

    child = diagram.root.children[0]
    assert child.sizing_w == Sizing.HUG
    assert child.sizing_h == Sizing.FILL


def test_padding_defaults_follow_border_semantics(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
    )

    assert diagram.root.border == Border.NONE
    assert diagram.root.padding == 0
    child = diagram.root.children[0]
    assert child.border == Border.SOLID
    assert child.padding == 8


def test_grid_block_parses_into_frame_diagram_metadata(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
grid:
  cols: 4
  col_gap: 32
  row_gap: 24
  outer_margin: 40
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
    )

    assert diagram.grid_cols == 4
    assert diagram.grid_col_gap == 32
    assert diagram.grid_row_gap == 24
    assert diagram.grid_outer_margin == 40