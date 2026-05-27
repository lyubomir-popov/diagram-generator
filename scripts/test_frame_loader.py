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
from diagram_model import Border, Fill
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


# ── Variant overlays ───────────────────────────────────────────────


def test_variant_highlight_sets_black_fill(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: a
      variant: highlight
      label: [Hello]
""",
    )
    a = diagram.root.children[0]
    assert a.fill == Fill.BLACK
    assert a.icon_fill == "#FFFFFF"


def test_variant_annotation_removes_border(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: note
      variant: annotation
      label: [Some note]
""",
    )
    note = diagram.root.children[0]
    assert note.border == Border.NONE


def test_explicit_yaml_overrides_variant(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: a
      variant: highlight
      fill: grey
      label: [Hello]
""",
    )
    a = diagram.root.children[0]
    assert a.fill == Fill.GREY  # explicit override wins over variant


def test_no_variant_works_as_before(tmp_path):
    """Existing raw YAMLs without variant: continue to work unchanged."""
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: a
      border: solid
      fill: grey
      label: [Hello]
""",
    )
    a = diagram.root.children[0]
    assert a.border == Border.SOLID
    assert a.fill == Fill.GREY


# ── Column span ─────────────────────────────────────────────────────


def test_col_span_parsed_into_frame(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
grid:
  cols: 3
  col_gap: 24
  outer_margin: 24
root:
  id: page
  direction: horizontal
  children:
    - id: a
      col_span: 2
      label: [Wide]
    - id: b
      label: [Narrow]
""",
    )
    a = diagram.root.children[0]
    assert a.col_span == 2


def test_col_span_resolves_to_fixed_width(tmp_path):
    from layout_v3 import layout_frame_diagram
    diagram = _load(
        tmp_path,
        """
engine: v3
grid:
  cols: 4
  col_gap: 24
  outer_margin: 24
root:
  id: page
  direction: horizontal
  padding: 24
  children:
    - id: wide
      col_span: 2
      label: [Wide box]
    - id: narrow
      label: [Narrow]
""",
    )
    result = layout_frame_diagram(diagram)
    wide = diagram.root.children[0]
    assert wide.sizing_w == Sizing.FIXED
    # col_span=2 means 2*col_w + 1*col_gap
    assert wide.width is not None
    assert wide.width > 0


def test_highlighted_section_heading_inherits_black_fill(tmp_path):
    """variant: highlight on a parent propagates fill to the heading child."""
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: panel
      variant: highlight
      heading: Services
      children:
        - id: b
          label: [Hello]
""",
    )
    panel = diagram.root.children[0]
    assert panel.fill == Fill.BLACK
    # The synthetic heading child should also be black
    heading_child = panel.children[0]
    assert heading_child.role == "heading"
    assert heading_child.fill == Fill.BLACK
    assert heading_child.icon_fill == "#FFFFFF"


# ── Overlays ────────────────────────────────────────────────────────


def test_overlays_parsed_from_yaml(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
overlays:
  - id: devteam
    label: "Dev team"
    members: [a, b]
root:
  id: page
  direction: horizontal
  children:
    - id: a
      label: [Alice]
    - id: b
      label: [Bob]
""",
    )
    assert len(diagram.overlays) == 1
    ov = diagram.overlays[0]
    assert ov.id == "devteam"
    assert ov.label == "Dev team"
    assert ov.members == ["a", "b"]


def test_overlay_renders_bounding_rect(tmp_path):
    from layout_v3 import layout_frame_diagram
    from diagram_layout import Rect
    diagram = _load(
        tmp_path,
        """
engine: v3
overlays:
  - id: team
    label: "Team"
    members: [a, b]
root:
  id: page
  direction: horizontal
  children:
    - id: a
      label: [Alice]
    - id: b
      label: [Bob]
    - id: c
      label: [Charlie]
""",
    )
    result = layout_frame_diagram(diagram)
    overlay_rects = [p for p in result.foreground if isinstance(p, Rect) and p.stroke_dasharray]
    assert len(overlay_rects) == 1
    assert overlay_rects[0].component_id == "team"
    assert overlay_rects[0].stroke_dasharray == "2 4"


def test_no_overlays_when_absent(tmp_path):
    diagram = _load(
        tmp_path,
        """
engine: v3
root:
  id: page
  children:
    - id: a
      label: [Hello]
""",
    )
    assert diagram.overlays == []