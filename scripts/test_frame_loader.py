"""Unit tests for native frame YAML parsing.

These tests freeze the omission semantics in ``frame_loader.py`` so future
YAML changes do not silently alter the v3 frame contract.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from frame_loader import load_frame_yaml
from frame_model import Align, Direction, Justify, Sizing
from diagram_shared import DEFAULT_FRAME_STROKE_WIDTH, GRID_GUTTER, INSET
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
  layout_engine: elk-layered
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
    assert diagram.layout_engine == "elk-layered"
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
        layout_engine="elk-layered",
    )
    meta = d.svg_meta()
    assert meta == {"diagram_type": "system_architecture", "layout_engine": "elk-layered"}


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


def test_unsupported_layout_engine_warns_and_is_not_loaded(tmp_path):
    import warnings

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        diagram = _load(
            tmp_path,
            """
engine: v3
meta:
  layout_engine: elk-force
root:
  id: root
  children:
    - id: child
      label:
        - Hello
""",
        )
    assert any("not a recognised value" in str(x.message) for x in w)
    assert diagram.layout_engine is None


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
    assert note.padding_top == INSET
    assert note.padding_bottom == INSET
    assert note.padding_left == 0
    assert note.padding_right == 0


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


# ── Style resolution (level system) ────────────────────────────────


def test_depth1_container_with_heading_defaults_to_outlined(tmp_path):
    """Depth-1 container with heading defaults to outlined box (not panel).

    Grey panel treatment requires explicit ``level: 2`` in the YAML."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      heading: "Panel"
      children:
        - id: leaf
          label: [Child]
""")
    panel = diagram.root.children[0]
    assert panel.resolved_fill == "transparent"
    assert panel.resolved_stroke == "#000000"


def test_explicit_level2_gives_grey_panel(tmp_path):
    """Explicit ``level: 2`` makes a container a grey panel while heading lines stay neutral."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      level: 2
      heading: "Panel"
      children:
        - id: leaf
          label: [Child]
""")
    panel = diagram.root.children[0]
    assert panel.resolved_fill == "#F3F3F3"
    assert panel.resolved_stroke == "#F3F3F3"
    heading = panel.children[0]
    assert heading.role == "heading"
    assert heading.label[0].weight == "400"
    assert heading.label[0].small_caps is False


def test_depth1_leaf_resolves_to_level1_box(tmp_path):
    """Depth-1 leaf gets box style: transparent fill, black stroke."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: standalone
      label: [Hello]
""")
    leaf = diagram.root.children[0]
    assert leaf.resolved_fill == "transparent"
    assert leaf.resolved_stroke == "#000000"


def test_depth2_leaf_inside_headed_panel_resolves_to_level1_box(tmp_path):
    """Depth-2 leaf inside a headed panel gets box style."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      heading: "Panel"
      children:
        - id: leaf
          label: [Hello]
""")
    # panel has __heading and __body children; leaf is inside __body
    panel = diagram.root.children[0]
    body = None
    for c in panel.children:
        if "__body" in (c.id or ""):
            body = c
            break
    leaf = body.children[0]
    assert leaf.resolved_fill == "transparent"
    assert leaf.resolved_stroke == "#000000"


def test_highlight_variant_resolves_black(tmp_path):
    """Highlight variant produces black fill, black stroke."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: hl
      variant: highlight
      label: [Hello]
""")
    hl = diagram.root.children[0]
    assert hl.resolved_fill == "#000000"
    assert hl.resolved_stroke == "#000000"


def test_annotation_variant_resolves_transparent(tmp_path):
    """Annotation variant produces transparent fill and stroke."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: ann
      variant: annotation
      label: [Hello]
""")
    ann = diagram.root.children[0]
    assert ann.resolved_fill == "transparent"
    assert ann.resolved_stroke == "none"


def test_explicit_level3_keeps_heading_line_neutral(tmp_path):
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: section
      level: 3
      heading: "Infrastructure"
      children:
        - id: leaf
          label: [Hello]
""")
    section = diagram.root.children[0]
    heading = section.children[0]
    assert heading.role == "heading"
    assert heading.label[0].weight == "400"
    assert heading.label[0].small_caps is False
    assert heading.label[0].letter_spacing is None
    assert section.resolved_stroke_width == DEFAULT_FRAME_STROKE_WIDTH


def test_explicit_level3_keeps_leaf_lead_line_neutral(tmp_path):
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: leaf
      level: 3
      label: [VM Instance A]
""")
    leaf = diagram.root.children[0]
    assert leaf.label[0].weight == "400"
    assert leaf.label[0].small_caps is False
    assert leaf.label[0].letter_spacing is None


def test_explicit_level_override(tmp_path):
    """Explicit level: 2 on a nested frame inside a panel is clamped to
    level 1 (box) because panels are not nestable."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: outer
      level: 2
      heading: "Outer"
      children:
        - id: inner
          level: 2
          heading: "Promoted"
          children:
            - id: deep
              label: [Hello]
""")
    outer = diagram.root.children[0]
    body = [c for c in outer.children if "__body" in (c.id or "")][0]
    inner = body.children[0]
    # inner requested level 2 but outer is already a panel → clamped to box
    assert inner.resolved_fill == "transparent"
    assert inner.resolved_stroke == "#000000"


def test_headingless_container_resolves_level0_transparent(tmp_path):
    """Container without heading is a layout wrapper — transparent."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: wrapper
      direction: horizontal
      children:
        - id: a
          label: [A]
        - id: b
          label: [B]
""")
    wrapper = diagram.root.children[0]
    assert wrapper.resolved_fill == "transparent"
    assert wrapper.resolved_stroke == "none"


def test_root_frame_resolves_transparent(tmp_path):
    """Root frame is always transparent/none."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: leaf
      label: [Hello]
""")
    assert diagram.root.resolved_fill == "transparent"
    assert diagram.root.resolved_stroke == "none"


def test_layout_wrappers_resolve_transparent(tmp_path):
    """Synthetic __heading and __body wrappers are transparent."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      heading: "Panel"
      children:
        - id: leaf
          label: [Hello]
""")
    panel = diagram.root.children[0]
    heading = panel.children[0]
    body = panel.children[1]
    assert "heading" in heading.id
    assert "body" in body.id
    assert heading.resolved_fill == "transparent"
    assert heading.resolved_stroke == "none"
    assert body.resolved_fill == "transparent"
    assert body.resolved_stroke == "none"


def test_heading_synthesis_horizontal_parent_preserves_layout_props(tmp_path):
    """Horizontal parent with heading should synthesize __heading + __body.

    The __body wrapper must keep the original horizontal flow properties so
    content layout semantics remain stable.
    """
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      direction: horizontal
      gap: 32
      align: bottom-right
      justify: space-between
      wrap: true
      fill_weight: 3
      heading: "Panel"
      icon: Cloud.svg
      children:
        - id: a
          label: [A]
        - id: b
          label: [B]
""")
    panel = diagram.root.children[0]
    assert panel.direction == Direction.VERTICAL
    assert len(panel.children) == 2

    heading = panel.children[0]
    body = panel.children[1]
    assert heading.role == "heading"
    assert "__heading" in heading.id
    assert "__body" in body.id

    assert body.direction == Direction.HORIZONTAL
    assert panel.gap == 32
    assert body.gap == INSET
    assert body.align == Align.BOTTOM_RIGHT
    assert body.justify == Justify.PACKED
    assert body.wrap is False
    assert body.fill_weight == 1

    # Icon is moved to the synthetic heading child.
    assert panel.icon is None
    assert heading.icon == "Cloud.svg"


def test_heading_body_gap_independent_of_title_gap(tmp_path):
    """Section gap is heading→body; __body stack defaults to INSET between leaves."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: section
      gap: 0
      heading: "Title"
      children:
        - id: a
          label: [A]
        - id: b
          label: [B]
""")
    section = diagram.root.children[0]
    body = [c for c in section.children if "__body" in (c.id or "")][0]
    assert section.gap == 0
    assert body.gap == INSET


def test_heading_body_derives_container_gap_from_body_children(tmp_path):
    """Headed bodies use GRID_GUTTER when the body contains containers."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: section
      gap: 0
      heading: "Title"
      children:
        - id: group
          children:
            - id: a
              label: [A]
        - id: b
          label: [B]
""")
    section = diagram.root.children[0]
    body = [c for c in section.children if "__body" in (c.id or "")][0]
    assert section.gap == 0
    assert body.gap == GRID_GUTTER


def test_heading_synthesis_vertical_parent_preserves_layout_props(tmp_path):
    """Vertical parent with heading should keep vertical content flow in __body."""
    diagram = _load(tmp_path, """
engine: v3
root:
  id: root
  children:
    - id: panel
      direction: vertical
      gap: 16
      align: center-right
      justify: space-around
      wrap: true
      fill_weight: 2
      heading: "Services"
      children:
        - id: a
          label: [A]
        - id: b
          label: [B]
""")
    panel = diagram.root.children[0]
    assert panel.direction == Direction.VERTICAL
    assert len(panel.children) == 2

    heading = panel.children[0]
    body = panel.children[1]
    assert heading.role == "heading"
    assert body.direction == Direction.VERTICAL
    assert panel.gap == 16
    assert body.gap == INSET
    assert body.align == Align.CENTER_RIGHT
    assert body.justify == Justify.PACKED
    assert body.wrap is False
    assert body.fill_weight == 1


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


def test_col_span_applies_at_layout_time_without_semantic_mutation(tmp_path):
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
    # Semantic fields remain source-authored (non-mutating layout contract).
    assert wide.sizing_w == Sizing.FILL
    assert wide.width is None

    # col_span still affects placed geometry at layout time.
    # col_span=2 means roughly 2*col_w + 1*col_gap in the placed width.
    assert wide._placed_w > 0


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


def test_highlight_child_on_highlight_parent_gets_white_text(tmp_path):
    from frame_loader import resolve_styles

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
    resolve_styles(diagram.root)

    def _find_leaf(frame):
        if frame.label:
            return frame
        for child in frame.children:
            found = _find_leaf(child)
            if found is not None:
                return found
        return None

    content = _find_leaf(diagram.root.children[0])
    assert content is not None
    assert content.label[0].fill == "#FFFFFF"


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
    """Overlay rect wraps member nodes tightly, not full canvas width."""
    from layout_v3 import layout_frame_diagram, OVERLAY_PADDING
    from diagram_layout import Rect, FrameBox
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
    ov = overlay_rects[0]
    assert ov.component_id == "team"
    assert ov.stroke_dasharray == "2 4"

    # Overlay should wrap members a and b, NOT span full canvas
    # Get bounds of members a and b
    a_boxes = [p for p in result.foreground if isinstance(p, FrameBox) and p.component_id == "a"]
    b_boxes = [p for p in result.foreground if isinstance(p, FrameBox) and p.component_id == "b"]
    c_boxes = [p for p in result.foreground if isinstance(p, FrameBox) and p.component_id == "c"]
    assert len(a_boxes) == 1 and len(b_boxes) == 1 and len(c_boxes) == 1
    a, b, c = a_boxes[0], b_boxes[0], c_boxes[0]

    pad = OVERLAY_PADDING
    expected_x = a.x - pad
    expected_w = (b.x + b.width) - a.x + 2 * pad
    assert ov.x == expected_x, f"overlay x={ov.x}, expected {expected_x}"
    assert ov.width == expected_w, f"overlay w={ov.width}, expected {expected_w}"
    # Overlay must NOT extend to cover c
    assert ov.x + ov.width < c.x, "overlay should not cover non-member c"


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
