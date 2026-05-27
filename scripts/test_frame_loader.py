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

    # Root defaults to HUG/HUG — no parent to FILL into
    assert diagram.root.sizing_w == Sizing.HUG
    assert diagram.root.sizing_h == Sizing.HUG
    # Non-root children default to FILL width, HUG height
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


def test_borderless_leaf_text_defaults_to_fill_width_hug_height(tmp_path):
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
    assert note.sizing_w == Sizing.FILL
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


def test_meta_block_parses_into_ontology_fields(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
meta:
  diagram_type: system_architecture
  abstraction_level: container
  layout_engine: elk-force
  presentation_form: swimlane
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
    )

    assert diagram.diagram_type == "system_architecture"
    assert diagram.abstraction_level == "container"
    assert diagram.layout_engine == "elk-force"
    assert diagram.presentation_form == "swimlane"


def test_meta_block_defaults_to_none_when_absent(tmp_path):
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

    assert diagram.diagram_type is None
    assert diagram.abstraction_level is None
    assert diagram.layout_engine is None
    assert diagram.presentation_form is None


def test_partial_meta_block_leaves_missing_fields_none(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
meta:
  diagram_type: layered_stack
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
    )

    assert diagram.diagram_type == "layered_stack"
    assert diagram.abstraction_level is None
    assert diagram.layout_engine is None
    assert diagram.presentation_form is None


def test_svg_meta_filters_none_values():
    from frame_model import FrameDiagram

    d = FrameDiagram(
        diagram_type="system_architecture",
        layout_engine="elk-force",
    )
    meta = d.svg_meta()
    assert meta == {"diagram_type": "system_architecture", "layout_engine": "elk-force"}


def test_svg_meta_returns_none_when_all_fields_empty():
    from frame_model import FrameDiagram

    d = FrameDiagram()
    assert d.svg_meta() is None


def test_meta_unknown_field_warns(tmp_path):
    import warnings

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        _load(
            tmp_path,
            """
engine: v3
meta:
  diagram_type: system_architecture
  bogus_field: hello
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
        )
    assert any("unknown meta field 'bogus_field'" in str(x.message) for x in w)


def test_meta_unknown_value_warns(tmp_path):
    import warnings

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        _load(
            tmp_path,
            """
engine: v3
meta:
  diagram_type: not_a_real_type
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
        )
    assert any("not a recognised value" in str(x.message) for x in w)