"""Comprehensive auto-layout test suite.

Covers three areas:
  1. Directional layout — vertical, horizontal, mixed nesting
  2. 9-point alignment grid — all Align enum values on both axes
  3. Sizing model — HUG, FILL, FIXED and edge cases

Run with:  pytest scripts/test_autolayout.py -v
    or:    python scripts/test_autolayout.py
"""

from __future__ import annotations

import sys
import os
import math

sys.path.insert(0, os.path.dirname(__file__))

from frame_model import Frame, FrameDiagram, Direction, Sizing, Align
from diagram_model import Line, Fill, Border
from layout_v3 import measure, place, _align_offset, _enforce_fill_hug_invariant, layout_frame_diagram, _remeasure_with_width_constraints
from diagram_shared import BASELINE_UNIT


# ───────────────────────────────────────────────────────────────────
# Test helpers
# ───────────────────────────────────────────────────────────────────

def _box(id: str, w: int = 192, h: int = 64, **kw) -> Frame:
    """Leaf box with explicit size — bypasses text measurement."""
    return Frame(id=id, width=w, height=h, label=[Line("test")], **kw)


def _container(
    id: str,
    direction: Direction,
    children: list[Frame],
    gap: int = 24,
    padding: int = 8,
    border: Border = Border.SOLID,
    fill: Fill = Fill.WHITE,
    **kw,
) -> Frame:
    """Container frame with children."""
    return Frame(
        id=id,
        direction=direction,
        children=children,
        gap=gap,
        padding=padding,
        border=border,
        fill=fill,
        **kw,
    )


def _layout(root: Frame) -> Frame:
    """Measure + enforce invariants + place a frame tree, return root."""
    measure(root)
    _enforce_fill_hug_invariant(root)
    place(root, 0, 0, root._measured_w, root._measured_h)
    return root


def _layout_fixed(root: Frame, w: int, h: int) -> Frame:
    """Measure + enforce invariants + place into a fixed-size area."""
    measure(root)
    _enforce_fill_hug_invariant(root)
    place(root, 0, 0, w, h)
    return root


def _children_within_parent(frame: Frame) -> list[str]:
    """Return error messages for any child that overflows its parent."""
    errors = []
    px, py = frame._placed_x, frame._placed_y
    pw, ph = frame._placed_w, frame._placed_h
    for child in frame.children:
        cx, cy = child._placed_x, child._placed_y
        cw, ch = child._placed_w, child._placed_h
        if cx < px - 0.5:
            errors.append(f"{child.id}: x={cx} < parent x={px}")
        if cy < py - 0.5:
            errors.append(f"{child.id}: y={cy} < parent y={py}")
        if cx + cw > px + pw + 0.5:
            errors.append(f"{child.id}: right={cx+cw} > parent right={px+pw}")
        if cy + ch > py + ph + 0.5:
            errors.append(f"{child.id}: bottom={cy+ch} > parent bottom={py+ph}")
        errors.extend(_children_within_parent(child))
    return errors


def _on_grid(value: float) -> bool:
    """Check that a value is snapped to the 8px baseline grid."""
    return abs(value - round(value / BASELINE_UNIT) * BASELINE_UNIT) < 0.5


def _dump_tree(frame: Frame, indent: int = 0) -> str:
    """ASCII dump of a laid-out frame tree for debugging."""
    prefix = "  " * indent
    lines = [
        f"{prefix}{frame.id}: "
        f"pos=({frame._placed_x},{frame._placed_y}) "
        f"size={frame._placed_w}x{frame._placed_h} "
        f"measured={frame._measured_w}x{frame._measured_h}"
    ]
    for child in frame.children:
        lines.append(_dump_tree(child, indent + 1))
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# PART 1: DIRECTIONAL LAYOUT
# ═══════════════════════════════════════════════════════════════════

# ── 1A: Vertical direction ──

class TestVerticalDirection:

    def test_single_child(self):
        """One box in vertical container: positioned at (pad, pad)."""
        child = _box("a", w=100, h=50)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8)
        _layout(root)

        assert child._placed_x == 8, f"x={child._placed_x}, expected 8"
        assert child._placed_y == 8, f"y={child._placed_y}, expected 8"
        assert not _children_within_parent(root)

    def test_gap_spacing(self):
        """Three children with gap=24: exact 24px between each pair."""
        a = _box("a", w=100, h=40)
        b = _box("b", w=100, h=40)
        c = _box("c", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [a, b, c],
                          gap=24, padding=8)
        _layout(root)

        gap_ab = b._placed_y - (a._placed_y + a._placed_h)
        gap_bc = c._placed_y - (b._placed_y + b._placed_h)
        assert gap_ab == 24, f"gap a→b = {gap_ab}, expected 24"
        assert gap_bc == 24, f"gap b→c = {gap_bc}, expected 24"
        assert not _children_within_parent(root)

    def test_with_heading(self):
        """Container with heading reserves space before first child."""
        child = _box("a", w=100, h=50)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=24, padding=8,
                          heading=Line("Section heading"))
        _layout(root)

        # Child should start below heading + heading_gap
        assert child._placed_y > 8, \
            f"Child y={child._placed_y}, should be after heading"
        assert not _children_within_parent(root)

    def test_nested_two_levels(self):
        """Vertical container inside vertical container — no overflow."""
        inner_a = _box("inner_a", w=100, h=40)
        inner_b = _box("inner_b", w=100, h=40)
        inner = _container("inner", Direction.VERTICAL, [inner_a, inner_b],
                           gap=8, padding=8)

        outer_a = _box("outer_a", w=150, h=50)
        root = _container("root", Direction.VERTICAL, [outer_a, inner],
                          gap=24, padding=8)
        _layout(root)

        assert not _children_within_parent(root)
        # Inner children must also be within inner
        assert not _children_within_parent(inner)

    def test_zero_gap(self):
        """Gap=0 means children are flush against each other."""
        a = _box("a", w=100, h=40)
        b = _box("b", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=0, padding=0, border=Border.NONE)
        _layout(root)

        gap = b._placed_y - (a._placed_y + a._placed_h)
        assert gap == 0, f"gap={gap}, expected 0"


# ── 1B: Horizontal direction ──

class TestHorizontalDirection:

    def test_single_child(self):
        """One box in horizontal container: positioned at (pad, pad)."""
        child = _box("a", w=100, h=50)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8)
        _layout(root)

        assert child._placed_x == 8, f"x={child._placed_x}, expected 8"
        assert child._placed_y == 8, f"y={child._placed_y}, expected 8"
        assert not _children_within_parent(root)

    def test_three_children_side_by_side(self):
        """Three boxes side-by-side with gap=24."""
        a = _box("a", w=80, h=40)
        b = _box("b", w=80, h=40)
        c = _box("c", w=80, h=40)
        root = _container("root", Direction.HORIZONTAL, [a, b, c],
                          gap=24, padding=8)
        _layout(root)

        gap_ab = b._placed_x - (a._placed_x + a._placed_w)
        gap_bc = c._placed_x - (b._placed_x + b._placed_w)
        assert gap_ab == 24, f"gap a→b = {gap_ab}, expected 24"
        assert gap_bc == 24, f"gap b→c = {gap_bc}, expected 24"
        assert not _children_within_parent(root)

    def test_cross_axis_stretch(self):
        """Children with counter-axis FILL stretch to cross size."""
        short = _box("short", w=80, h=40)
        short.sizing_h = Sizing.FILL  # counter-axis FILL → stretch
        tall = _box("tall", w=80, h=120)
        tall.sizing_h = Sizing.FILL
        root = _container("root", Direction.HORIZONTAL, [short, tall],
                          gap=8, padding=8)
        _layout(root)

        assert short._placed_h == tall._placed_h, \
            f"short h={short._placed_h}, tall h={tall._placed_h}"

    def test_fill_width_distribution(self):
        """FILL children in horizontal layout share remaining width."""
        a = _box("a", w=80, h=40)
        a.sizing_w = Sizing.FILL
        b = _box("b", w=80, h=40)
        b.sizing_w = Sizing.FILL

        root = _container("root", Direction.HORIZONTAL, [a, b],
                          gap=8, padding=8)
        root.width = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 80
        _layout_fixed(root, 400, 80)

        # Both should be wider than measured
        assert a._placed_w >= 80, f"a width={a._placed_w}"
        assert b._placed_w >= 80, f"b width={b._placed_w}"
        # Should be roughly equal (within grid rounding)
        assert abs(a._placed_w - b._placed_w) <= BASELINE_UNIT, \
            f"a={a._placed_w}, b={b._placed_w} differ by > {BASELINE_UNIT}"
        assert not _children_within_parent(root)


# ── 1C: Mixed direction nesting ──

class TestMixedDirections:

    def test_vertical_then_horizontal(self):
        """Vertical root → horizontal child with 2 boxes."""
        h_a = _box("h_a", w=80, h=40)
        h_b = _box("h_b", w=80, h=40)
        h_row = _container("row", Direction.HORIZONTAL, [h_a, h_b],
                           gap=8, padding=0, border=Border.NONE)

        v_box = _box("v_box", w=160, h=60)
        root = _container("root", Direction.VERTICAL, [v_box, h_row],
                          gap=24, padding=8)
        _layout(root)

        # h_a and h_b should be side by side
        assert h_b._placed_x > h_a._placed_x + h_a._placed_w - 1, \
            "Horizontal children should be side by side"
        # h_row should be below v_box
        assert h_row._placed_y > v_box._placed_y + v_box._placed_h - 1, \
            "Horizontal row should be below vertical box"
        assert not _children_within_parent(root)

    def test_horizontal_then_vertical(self):
        """Horizontal root → vertical child with 2 boxes."""
        v_a = _box("v_a", w=80, h=40)
        v_b = _box("v_b", w=80, h=40)
        v_col = _container("col", Direction.VERTICAL, [v_a, v_b],
                           gap=8, padding=0, border=Border.NONE)

        h_box = _box("h_box", w=100, h=80)
        root = _container("root", Direction.HORIZONTAL, [h_box, v_col],
                          gap=24, padding=8)
        _layout(root)

        # v_a and v_b should be stacked vertically
        assert v_b._placed_y > v_a._placed_y + v_a._placed_h - 1, \
            "Vertical children should be stacked"
        # v_col should be to the right of h_box
        assert v_col._placed_x > h_box._placed_x + h_box._placed_w - 1, \
            "Vertical column should be right of horizontal box"
        assert not _children_within_parent(root)

    def test_three_level_nesting(self):
        """root(V) → row(H) → col(V) → leaf: full hierarchy."""
        leaf_a = _box("leaf_a", w=60, h=30)
        leaf_b = _box("leaf_b", w=60, h=30)
        col = _container("col", Direction.VERTICAL, [leaf_a, leaf_b],
                         gap=8, padding=4, border=Border.NONE)

        sibling = _box("sibling", w=80, h=60)
        row = _container("row", Direction.HORIZONTAL, [col, sibling],
                         gap=8, padding=4, border=Border.NONE)

        top = _box("top", w=160, h=40)
        root = _container("root", Direction.VERTICAL, [top, row],
                          gap=24, padding=8)
        _layout(root)

        # No overflow at any level
        assert not _children_within_parent(root), \
            f"Overflow:\n{chr(10).join(_children_within_parent(root))}"

        # Leaves stacked vertically inside col
        assert leaf_b._placed_y > leaf_a._placed_y + leaf_a._placed_h - 1
        # col and sibling side-by-side inside row
        assert sibling._placed_x > col._placed_x + col._placed_w - 1


# ═══════════════════════════════════════════════════════════════════
# PART 2: 9-POINT ALIGNMENT GRID
# ═══════════════════════════════════════════════════════════════════

# ── 2A: _align_offset unit tests ──

class TestAlignOffset:
    """Direct tests of the _align_offset() helper."""

    def test_x_left(self):
        assert _align_offset(Align.TOP_LEFT, 200, 100, "x") == 0
        assert _align_offset(Align.CENTER_LEFT, 200, 100, "x") == 0
        assert _align_offset(Align.BOTTOM_LEFT, 200, 100, "x") == 0

    def test_x_center(self):
        assert _align_offset(Align.TOP_CENTER, 200, 100, "x") == 50
        assert _align_offset(Align.CENTER, 200, 100, "x") == 50
        assert _align_offset(Align.BOTTOM_CENTER, 200, 100, "x") == 50

    def test_x_right(self):
        assert _align_offset(Align.TOP_RIGHT, 200, 100, "x") == 100
        assert _align_offset(Align.CENTER_RIGHT, 200, 100, "x") == 100
        assert _align_offset(Align.BOTTOM_RIGHT, 200, 100, "x") == 100

    def test_y_top(self):
        assert _align_offset(Align.TOP_LEFT, 200, 100, "y") == 0
        assert _align_offset(Align.TOP_CENTER, 200, 100, "y") == 0
        assert _align_offset(Align.TOP_RIGHT, 200, 100, "y") == 0

    def test_y_center(self):
        assert _align_offset(Align.CENTER_LEFT, 200, 100, "y") == 50
        assert _align_offset(Align.CENTER, 200, 100, "y") == 50
        assert _align_offset(Align.CENTER_RIGHT, 200, 100, "y") == 50

    def test_y_bottom(self):
        assert _align_offset(Align.BOTTOM_LEFT, 200, 100, "y") == 100
        assert _align_offset(Align.BOTTOM_CENTER, 200, 100, "y") == 100
        assert _align_offset(Align.BOTTOM_RIGHT, 200, 100, "y") == 100

    def test_no_slack(self):
        """When content == available, offset is always 0."""
        for align in Align:
            assert _align_offset(align, 100, 100, "x") == 0
            assert _align_offset(align, 100, 100, "y") == 0

    def test_content_larger_than_available(self):
        """When content > available, offset is 0 (no negative offset)."""
        for align in Align:
            assert _align_offset(align, 50, 100, "x") == 0
            assert _align_offset(align, 50, 100, "y") == 0


# ── 2B: Main-axis alignment integration tests ──

class TestMainAxisAlignment:
    """Alignment shifts children along the main axis."""

    def test_vertical_top_left_default(self):
        """TOP_LEFT: children start at the top."""
        child = _box("a", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.TOP_LEFT)
        root.height = 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 200)

        # Child at top
        assert child._placed_y == 8, f"y={child._placed_y}"

    def test_vertical_bottom_left(self):
        """BOTTOM_LEFT: children pushed to the bottom of the container."""
        child = _box("a", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.BOTTOM_LEFT)
        root.height = 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 200)

        # Child pushed down: y = pad + (inner_h - content_h)
        inner_h = 200 - 16  # 184
        content_h = child._placed_h
        expected_y = 8 + (inner_h - content_h)
        assert child._placed_y == expected_y, \
            f"y={child._placed_y}, expected {expected_y}"

    def test_vertical_center(self):
        """CENTER: children centered along main axis (vertical)."""
        child = _box("a", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.CENTER)
        root.height = 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 200)

        inner_h = 200 - 16
        content_h = child._placed_h
        expected_y = 8 + (inner_h - content_h) / 2
        assert abs(child._placed_y - expected_y) <= 1, \
            f"y={child._placed_y}, expected ~{expected_y}"

    def test_horizontal_center_left(self):
        """CENTER_LEFT in horizontal: children centered along x-axis."""
        child = _box("a", w=80, h=40)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.CENTER_LEFT)
        root.width = 300
        root.height = 80
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, 80)

        # Main axis is X for horizontal; CENTER_LEFT → x-offset = 0 (LEFT)
        assert child._placed_x == 8, f"x={child._placed_x}, expected 8"

    def test_horizontal_top_center(self):
        """TOP_CENTER in horizontal: children centered along x-axis."""
        child = _box("a", w=80, h=40)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.TOP_CENTER)
        root.width = 300
        root.height = 80
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, 80)

        inner_w = 300 - 16  # 284
        content_w = child._placed_w  # may be rounded up to grid
        expected_x = 8 + (inner_w - content_w) / 2
        # Allow grid-rounding tolerance
        assert abs(child._placed_x - expected_x) <= BASELINE_UNIT, \
            f"x={child._placed_x}, expected ~{expected_x} (child_w={content_w})"

    def test_horizontal_top_right(self):
        """TOP_RIGHT in horizontal: children pushed to the right."""
        child = _box("a", w=80, h=40)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.TOP_RIGHT)
        root.width = 300
        root.height = 80
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, 80)

        inner_w = 300 - 16
        content_w = child._placed_w  # may be rounded up
        expected_x = 8 + (inner_w - content_w)
        # Allow grid-rounding tolerance
        assert abs(child._placed_x - expected_x) <= BASELINE_UNIT, \
            f"x={child._placed_x}, expected ~{expected_x} (child_w={content_w})"

    def test_fill_ignores_main_alignment(self):
        """FILL children consume all space → main-axis alignment has no effect."""
        a = _box("a", w=80, h=40)
        a.sizing_h = Sizing.FILL  # primary axis for vertical parent
        b = _box("b", w=80, h=40)
        b.sizing_h = Sizing.FILL

        # With BOTTOM_RIGHT: main axis offset should be 0 or near-zero
        # because fill children consume (almost) all available space.
        # Any residual comes from grid-rounding fill_extra DOWN.
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=8, padding=8, align=Align.BOTTOM_RIGHT)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        # fill_extra is rounded DOWN to BASELINE_UNIT, so there may be
        # a small residual offset. The key invariant: no overflow.
        assert not _children_within_parent(root), \
            f"Children overflow parent"
        # Both FILL children should get expanded sizes
        assert a._placed_h > a._measured_h, \
            f"FILL child a should expand: {a._placed_h} <= {a._measured_h}"
        assert b._placed_h > b._measured_h, \
            f"FILL child b should expand: {b._placed_h} <= {b._measured_h}"

    def test_multiple_children_centered(self):
        """Three children centered vertically in a tall container."""
        a = _box("a", w=100, h=40)
        b = _box("b", w=100, h=40)
        c = _box("c", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [a, b, c],
                          gap=8, padding=8, align=Align.CENTER)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        inner_h = 400 - 16
        content_h = a._placed_h + b._placed_h + c._placed_h + 2 * 8
        expected_offset = (inner_h - content_h) / 2
        expected_a_y = 8 + expected_offset

        assert abs(a._placed_y - expected_a_y) <= 1, \
            f"First child y={a._placed_y}, expected ~{expected_a_y}"
        assert not _children_within_parent(root)


# ── 2B2: Cross-axis alignment ──

class TestCrossAxisAlignment:
    """Cross-axis alignment: children keep measured size when not stretching."""

    def test_horizontal_center_left_cross_center(self):
        """CENTER_LEFT in horizontal: cross-axis (Y) centers children.

        Child measured_h=64, cross_size=128 → child keeps 64, offset=32.
        """
        child = _box("a", w=80, h=64)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.CENTER_LEFT)
        root.height = 64 + 64 + 16  # cross_size = 128 after padding
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, root.height)

        # Child should keep measured height
        assert child._placed_h == 64, \
            f"Child should keep measured height 64, got {child._placed_h}"
        # Child should be vertically centered
        cross_size = root._placed_h - 16  # minus 2*pad
        expected_y = 8 + (cross_size - 64) / 2
        assert abs(child._placed_y - expected_y) <= 1, \
            f"y={child._placed_y}, expected ~{expected_y}"

    def test_vertical_top_right_cross_right(self):
        """TOP_RIGHT in vertical: cross-axis (X) pushes children right.

        Child measured_w=96, cross_size=192 → child keeps 96, offset=96.
        """
        child = _box("a", w=96, h=64)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.TOP_RIGHT)
        root.width = 96 + 96 + 16  # cross_size = 192 after padding
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width, root.height or 200)

        # Child keeps measured width
        assert child._placed_w == 96, \
            f"Child should keep measured width 96, got {child._placed_w}"
        # Child should be right-aligned
        cross_size = root._placed_w - 16
        expected_x = 8 + (cross_size - 96)
        assert abs(child._placed_x - expected_x) <= 1, \
            f"x={child._placed_x}, expected ~{expected_x}"

    def test_top_left_fill_stretches(self):
        """TOP_LEFT + counter-axis FILL: child stretches to cross-axis size."""
        child = _box("a", w=80, h=64)
        child.sizing_h = Sizing.FILL  # counter-axis FILL → stretch
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.TOP_LEFT)
        root.height = 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 200)

        cross_size = 200 - 16  # 184
        # Child should stretch to fill cross-axis
        assert child._placed_h == round_up(cross_size), \
            f"Child should stretch to {round_up(cross_size)}, got {child._placed_h}"
        assert child._placed_y == 8, \
            f"Child should start at pad=8, got {child._placed_y}"

    def test_vertical_center_cross_center(self):
        """CENTER in vertical: cross-axis (X) centers children."""
        child = _box("a", w=96, h=64)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.CENTER)
        root.width = 224  # cross_size = 224 - 16 = 208
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 224, root.height or 200)

        assert child._placed_w == 96, \
            f"Child should keep measured width 96, got {child._placed_w}"
        cross_size = 224 - 16
        expected_x = 8 + (cross_size - 96) / 2
        assert abs(child._placed_x - expected_x) <= 1, \
            f"x={child._placed_x}, expected ~{expected_x}"

    def test_no_overflow_cross_smaller_than_child(self):
        """When cross_size < child measured, child keeps measured size, no negatives.

        The child WILL overflow the parent — this is expected behavior
        (same as Figma). We verify no negative dimensions or positions.
        """
        child = _box("a", w=200, h=200)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.CENTER_LEFT)
        root.height = 100  # cross_size = 84, less than child's 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 300, 100)

        # Child should keep measured height, no negative offset
        assert child._placed_h == 200, \
            f"Child should keep measured height 200, got {child._placed_h}"
        assert child._placed_y >= 8, \
            f"Child y should be >= pad, got {child._placed_y}"
        assert child._placed_w > 0, "Child width must be positive"
        assert child._placed_h > 0, "Child height must be positive"

    def test_fill_child_with_cross_center(self):
        """FILL child on main axis + CENTER on cross axis.

        Child should expand on main-axis (FILL) and keep measured cross-axis.
        """
        child = _box("a", w=80, h=64)
        child.sizing_w = Sizing.FILL
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=0, padding=8, align=Align.CENTER_LEFT)
        root.width = 300
        root.height = 200  # cross_size = 184
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, 200)

        # Main-axis: FILL should expand
        assert child._placed_w > child._measured_w, \
            f"FILL child should expand: {child._placed_w} <= {child._measured_w}"
        # Cross-axis: CENTER_LEFT → keep measured height, center
        assert child._placed_h == 64, \
            f"Cross-axis should keep measured height 64, got {child._placed_h}"
        cross_size = 200 - 16
        expected_y = 8 + (cross_size - 64) / 2
        assert abs(child._placed_y - expected_y) <= 1, \
            f"y={child._placed_y}, expected ~{expected_y}"

    def test_heading_with_cross_center(self):
        """Heading + CENTER_LEFT cross alignment in horizontal container.

        Heading reserves space at top; cross-axis centering uses the
        remaining space after heading.
        """
        child = _box("a", w=80, h=64)
        root = _container("root", Direction.HORIZONTAL, [child],
                          gap=24, padding=8, align=Align.CENTER_LEFT,
                          heading=Line("Header"))
        root.height = 300
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 300, 300)

        # Child should be below heading, centered in remaining cross-space
        assert child._placed_h == 64, \
            f"Cross-axis should keep measured height, got {child._placed_h}"
        # Heading takes space, so child y > pad + heading
        assert child._placed_y > 8, \
            f"Child should be below heading, y={child._placed_y}"
        # No negative dimensions
        assert child._placed_w > 0 and child._placed_h > 0

    def test_vertical_top_left_fill_stretches(self):
        """TOP_LEFT in VERTICAL + counter-axis FILL: child stretches on X."""
        child = _box("a", w=80, h=64)
        child.sizing_w = Sizing.FILL  # counter-axis FILL in vertical → stretch W
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8, align=Align.TOP_LEFT)
        root.width = 300
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, root.height or 200)

        cross_size = 300 - 16  # 284
        # Child should stretch to fill cross-axis
        assert child._placed_w == round_up(cross_size), \
            f"Child should stretch to {round_up(cross_size)}, got {child._placed_w}"
        assert child._placed_x == 8, \
            f"Child should start at pad=8, got {child._placed_x}"

    def test_nested_container_cross_center(self):
        """Nested container with CENTER cross-axis alignment.

        Inner container should keep its measured width and be centered.
        """
        inner_child = _box("ic", w=80, h=40)
        inner = _container("inner", Direction.VERTICAL, [inner_child],
                           gap=0, padding=4)
        outer = _container("outer", Direction.VERTICAL, [inner],
                           gap=0, padding=8, align=Align.CENTER)
        outer.width = 300
        outer.sizing_w = Sizing.FIXED
        outer.sizing_h = Sizing.FIXED
        _layout_fixed(outer, 300, outer.height or 200)

        # Inner should keep measured width, centered on cross-axis
        assert inner._placed_w <= inner._measured_w + BASELINE_UNIT, \
            f"Inner should keep ~measured width, got {inner._placed_w} vs measured {inner._measured_w}"
        cross_size = 300 - 16
        expected_x = 8 + (cross_size - inner._placed_w) / 2
        assert abs(inner._placed_x - expected_x) <= BASELINE_UNIT, \
            f"Inner x={inner._placed_x}, expected ~{expected_x}"
        # Inner child should be correctly positioned inside inner
        assert inner_child._placed_x >= inner._placed_x


# ── 2C: Grid-snap under alignment ──

class TestAlignmentGridSnap:

    def test_all_positions_on_grid(self):
        """Every frame position should be snapped to the 8px grid.

        NOTE: This test currently documents that alignment offsets are NOT
        grid-snapped. The engine rounds sizes to grid but computes alignment
        offsets from the rounded sizes without re-snapping. This is a known
        gap — Milestone 5 should add grid-snapping to alignment offsets.
        For now, we verify sizes are on grid and positions are on grid
        when alignment is TOP_LEFT (no offset).
        """
        a = _box("a", w=104, h=40)  # already on grid
        b = _box("b", w=104, h=40)
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=24, padding=8, align=Align.TOP_LEFT)
        root.height = 304  # on grid
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 304)

        for frame in [root, a, b]:
            assert _on_grid(frame._placed_x), \
                f"{frame.id} x={frame._placed_x} not on grid"
            assert _on_grid(frame._placed_y), \
                f"{frame.id} y={frame._placed_y} not on grid"
            assert _on_grid(frame._placed_w), \
                f"{frame.id} w={frame._placed_w} not on grid"
            assert _on_grid(frame._placed_h), \
                f"{frame.id} h={frame._placed_h} not on grid"

    def test_alignment_offset_not_yet_snapped(self):
        """Document that CENTER alignment can produce off-grid positions.

        This is the known gap. When Milestone 5 adds grid-snapping to
        alignment offsets, change this test to assert ON-grid.
        """
        a = _box("a", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [a],
                          gap=0, padding=8, align=Align.CENTER)
        root.height = 300
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 300)

        # Alignment offset = (inner_h - content_h) / 2 which may be fractional
        # Sizes should still be on grid even if positions aren't
        assert _on_grid(a._placed_w), f"w={a._placed_w} not on grid"
        assert _on_grid(a._placed_h), f"h={a._placed_h} not on grid"


# ═══════════════════════════════════════════════════════════════════
# PART 3: SIZING MODEL
# ═══════════════════════════════════════════════════════════════════

# ── 3A: HUG sizing ──

class TestHugSizing:

    def test_container_shrinks_to_content(self):
        """HUG container = sum(children) + gaps + padding, no more."""
        # Bordered boxes enforce 64px min height (icon-height parity)
        a = _box("a", w=100, h=64)
        b = _box("b", w=100, h=64)
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=24, padding=8)
        _layout(root)

        expected_h = 8 + 64 + 24 + 64 + 8  # pad + a + gap + b + pad = 168
        assert root._placed_h == round_up(expected_h), \
            f"root h={root._placed_h}, expected {round_up(expected_h)}"

    def test_nested_hug(self):
        """HUG inside HUG: both shrink correctly."""
        inner_child = _box("ic", w=60, h=30)
        inner = _container("inner", Direction.VERTICAL, [inner_child],
                           gap=0, padding=4, border=Border.NONE)
        outer = _container("outer", Direction.VERTICAL, [inner],
                           gap=0, padding=8)
        _layout(outer)

        # inner = 4 + 32 + 4 = 40 (rounded 30→32)
        # outer = 8 + 40 + 8 = 56
        assert inner._placed_h >= 30 + 8  # child + 2*pad
        assert outer._placed_h >= inner._placed_h + 16  # inner + 2*pad
        assert not _children_within_parent(outer)


# ── 3B: FILL sizing ──

class TestFillSizing:

    def test_two_equal_fill(self):
        """Two FILL children in fixed container get equal shares."""
        a = _box("a", w=100, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=100, h=40)
        b.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=8, padding=8)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        assert abs(a._placed_h - b._placed_h) <= BASELINE_UNIT
        assert not _children_within_parent(root)

    def test_three_unequal_measured(self):
        """Three FILL with different measured sizes → all get equal share."""
        a = _box("a", w=100, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=100, h=80)
        b.sizing_h = Sizing.FILL
        c = _box("c", w=100, h=120)
        c.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [a, b, c],
                          gap=8, padding=8)
        root.height = 500
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 500)

        # FILL children share available space equally
        assert abs(a._placed_h - b._placed_h) <= BASELINE_UNIT, \
            f"a={a._placed_h}, b={b._placed_h}"
        assert abs(b._placed_h - c._placed_h) <= BASELINE_UNIT, \
            f"b={b._placed_h}, c={c._placed_h}"
        assert not _children_within_parent(root)

    def test_fill_with_hug_siblings(self):
        """1 HUG + 2 FILL: HUG takes measured, FILL splits remainder."""
        hug = _box("hug", w=100, h=60)
        hug.sizing_h = Sizing.HUG

        fill_a = _box("fill_a", w=100, h=40)
        fill_a.sizing_h = Sizing.FILL
        fill_b = _box("fill_b", w=100, h=40)
        fill_b.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [hug, fill_a, fill_b],
                          gap=8, padding=8)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        # HUG child keeps its measured height
        assert hug._placed_h == hug._measured_h, \
            f"HUG h={hug._placed_h}, measured={hug._measured_h}"
        # FILL children share the remainder equally
        assert abs(fill_a._placed_h - fill_b._placed_h) <= BASELINE_UNIT
        assert not _children_within_parent(root)

    def test_fill_in_hug_container_keeps_measured(self):
        """FILL child in HUG container keeps measured size (container fits)."""
        big = _box("big", w=100, h=200)
        big.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [big],
                          gap=0, padding=8)
        # Don't force a smaller container — let HUG size it
        _layout(root)

        # HUG container sizes to fit, so FILL child gets exactly its measured size
        assert big._placed_h == big._measured_h, \
            f"FILL h={big._placed_h}, measured={big._measured_h}"

    def test_fill_rounds_down_to_grid(self):
        """FILL sizes are grid-aligned and never overflow the parent."""
        a = _box("a", w=100, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=100, h=40)
        b.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=8, padding=8)
        root.height = 304  # on 8px grid (304/8=38)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 304)

        total_children = a._placed_h + b._placed_h + 8  # + gap
        available = root._placed_h - 16  # actual placed parent - 2*pad
        assert total_children <= available + 0.5, \
            f"total={total_children} > available={available}"
        # FILL children should consume all available space (zero slack)
        assert total_children >= available - BASELINE_UNIT, \
            f"total={total_children} leaves too much slack (available={available})"
        assert not _children_within_parent(root)


# ── 3C: FIXED sizing ──

class TestFixedSizing:

    def test_fixed_container_explicit_size(self):
        """FIXED container uses declared width/height."""
        child = _box("a", w=80, h=40)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=0, padding=8)
        root.width = 300
        root.height = 200
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 300, 200)

        assert root._placed_w == round_up(300), f"w={root._placed_w}"
        assert root._placed_h == round_up(200), f"h={root._placed_h}"

    def test_fixed_leaf_explicit_size(self):
        """Leaf with explicit height uses that height, not BOX_MIN_HEIGHT."""
        sep = Frame(id="sep", border=Border.NONE, fill=Fill.WHITE,
                    label=[], width=192, height=1, padding=0)
        measure(sep)
        assert sep._measured_h <= BASELINE_UNIT, \
            f"Separator measured_h={sep._measured_h}, expected ≤ {BASELINE_UNIT}"

    def test_fixed_container_children_fill(self):
        """FILL children inside FIXED container fill the declared space."""
        a = _box("a", w=100, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=100, h=40)
        b.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=8, padding=8)
        root.width = 250
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, 250, 400)

        total = a._placed_h + b._placed_h + 8
        available = 400 - 16
        # Children should fill most of the space (within grid rounding)
        assert total >= available - BASELINE_UNIT, \
            f"total={total} should fill ~{available}"
        assert not _children_within_parent(root)


# ── 3D: Edge cases ──

class TestSizingEdgeCases:

    def test_fixed_width_zero_honored(self):
        """FIXED with width=0 should produce a 0-width frame, not fallback to measured."""
        leaf = Frame(id="zero", border=Border.NONE, fill=Fill.WHITE,
                     label=[], width=0, height=0, padding=0)
        leaf.sizing_w = Sizing.FIXED
        leaf.sizing_h = Sizing.FIXED
        measure(leaf)
        place(leaf, 0, 0, 0, 0)
        assert leaf._placed_w == 0, f"Expected 0, got {leaf._placed_w}"
        assert leaf._placed_h == 0, f"Expected 0, got {leaf._placed_h}"

    def test_empty_container(self):
        """Container with 0 children is treated as a leaf by the engine.

        Because Frame.is_leaf checks len(children)==0, an empty container
        gets leaf sizing (BLOCK_WIDTH x BOX_MIN_HEIGHT). This is acceptable:
        real diagrams never have empty containers.
        """
        root = _container("root", Direction.VERTICAL, [],
                          gap=0, padding=8)
        _layout(root)

        # Empty container = leaf, so it gets default leaf size
        assert root._placed_w > 0, f"w={root._placed_w}"
        assert root._placed_h > 0, f"h={root._placed_h}"

    def test_single_fill_child_gets_all_space(self):
        """One FILL child gets all remaining space."""
        a = _box("a", w=100, h=40)
        a.sizing_h = Sizing.FILL

        root = _container("root", Direction.VERTICAL, [a],
                          gap=0, padding=8)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        expected_h = 400 - 16  # all available minus padding
        # Should be close to full available (within grid rounding)
        assert a._placed_h >= expected_h - BASELINE_UNIT, \
            f"a h={a._placed_h}, expected ~{expected_h}"
        assert not _children_within_parent(root)

    def test_all_hug_in_fixed_container(self):
        """All HUG children in FIXED container: extra space is unused."""
        a = _box("a", w=100, h=40)
        b = _box("b", w=100, h=40)

        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=8, padding=8, align=Align.TOP_LEFT)
        root.height = 400
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        _layout_fixed(root, root.width or 200, 400)

        # Children keep their measured sizes
        assert a._placed_h == a._measured_h, \
            f"a h={a._placed_h}, measured={a._measured_h}"
        assert b._placed_h == b._measured_h, \
            f"b h={b._placed_h}, measured={b._measured_h}"
        # Extra space at the bottom
        bottom_of_b = b._placed_y + b._placed_h
        assert bottom_of_b < 400 - 8, \
            "Should have unused space at bottom"


# ═══════════════════════════════════════════════════════════════════
# PART 4: INVARIANT CHECKS
# ═══════════════════════════════════════════════════════════════════

class TestInvariants:
    """Cross-cutting invariants that must hold for any layout."""

    def test_grid_snap_vertical(self):
        """All positions and sizes snap to 8px grid (vertical layout)."""
        a = _box("a", w=100, h=50)
        b = _box("b", w=120, h=70)
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=24, padding=8)
        _layout(root)

        for f in [root, a, b]:
            assert _on_grid(f._placed_x), f"{f.id} x={f._placed_x} off grid"
            assert _on_grid(f._placed_y), f"{f.id} y={f._placed_y} off grid"
            assert _on_grid(f._placed_w), f"{f.id} w={f._placed_w} off grid"
            assert _on_grid(f._placed_h), f"{f.id} h={f._placed_h} off grid"

    def test_grid_snap_horizontal(self):
        """All positions and sizes snap to 8px grid (horizontal layout)."""
        a = _box("a", w=100, h=50)
        b = _box("b", w=120, h=70)
        root = _container("root", Direction.HORIZONTAL, [a, b],
                          gap=24, padding=8)
        _layout(root)

        for f in [root, a, b]:
            assert _on_grid(f._placed_x), f"{f.id} x={f._placed_x} off grid"
            assert _on_grid(f._placed_y), f"{f.id} y={f._placed_y} off grid"
            assert _on_grid(f._placed_w), f"{f.id} w={f._placed_w} off grid"
            assert _on_grid(f._placed_h), f"{f.id} h={f._placed_h} off grid"

    def test_no_negative_positions(self):
        """No frame should have negative coordinates."""
        a = _box("a", w=100, h=50)
        b = _box("b", w=80, h=40)
        inner = _container("inner", Direction.HORIZONTAL, [a, b],
                           gap=8, padding=4, border=Border.NONE)
        root = _container("root", Direction.VERTICAL, [inner],
                          gap=0, padding=8)
        _layout(root)

        def check_positive(f: Frame):
            assert f._placed_x >= 0, f"{f.id} x={f._placed_x} < 0"
            assert f._placed_y >= 0, f"{f.id} y={f._placed_y} < 0"
            for c in f.children:
                check_positive(c)

        check_positive(root)

    def test_measured_leq_placed(self):
        """Placed size is always >= measured size (no shrinking)."""
        a = _box("a", w=100, h=50)
        b = _box("b", w=80, h=40)
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=24, padding=8)
        _layout(root)

        def check_sizes(f: Frame):
            assert f._placed_w >= f._measured_w - 0.5, \
                f"{f.id} placed_w={f._placed_w} < measured_w={f._measured_w}"
            assert f._placed_h >= f._measured_h - 0.5, \
                f"{f.id} placed_h={f._placed_h} < measured_h={f._measured_h}"
            for c in f.children:
                check_sizes(c)

        check_sizes(root)


# ═══════════════════════════════════════════════════════════════════
# Part 5: FILL-in-HUG invariant
# ═══════════════════════════════════════════════════════════════════

class TestFillInHugInvariant:
    """Figma rule: HUG parent + FILL children → parent freezes to FIXED,
    children stay FILL and divide space equally."""

    def test_fill_children_get_equal_shares_in_hug_parent(self):
        """FILL children in a HUG parent: parent freezes, children
        get equal shares of available space."""
        a = _box("a", w=192, h=64)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=80)
        b.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a, b], gap=8, padding=8)
        # root.sizing_h defaults to HUG
        _layout(root)

        # Parent freezes at measured size.  Measure inflates to max*count:
        # content_h = max(64,80)*2 + 8(gap) = 168.  With padding: 184.
        # Place: available = 184 - 16 - 8 = 160.  Equal share = 80 each.
        diff = abs(a._placed_h - b._placed_h)
        assert diff <= BASELINE_UNIT, \
            f"FILL children should be equal (±{BASELINE_UNIT}): a={a._placed_h}, b={b._placed_h}"

    def test_fill_children_expand_in_fixed_parent(self):
        """FILL children in a FIXED parent should divide space equally."""
        a = _box("a", w=192, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=40)
        b.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a, b], gap=8, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 400
        root.width = 200
        _layout_fixed(root, 200, 400)

        # In FIXED parent, FILL children should get roughly equal shares.
        # available = 400 - 16 - 8 = 376.  Per child: 376/2 = 188.
        # Grid-rounded: base_fill = 184, leftover = 8, extra_fills = 1.
        # First child: 184, last child: 192.
        total_placed = a._placed_h + b._placed_h
        available = 400 - 16 - 8  # padding * 2 + gap
        assert total_placed <= available + 0.5, \
            f"FILL children total {total_placed} exceeds available {available}"
        diff = abs(a._placed_h - b._placed_h)
        assert diff <= BASELINE_UNIT, \
            f"FILL children differ by {diff}px (max {BASELINE_UNIT}): a={a._placed_h}, b={b._placed_h}"

    def test_nested_fill_in_hug_parent_freezes(self):
        """Panel with content + siblings all FILL in HUG column:
        parent freezes to FIXED, children get equal shares."""
        inner_a = _box("inner_a", h=64)
        inner_b = _box("inner_b", h=40)
        panel = _container("panel", Direction.VERTICAL, [inner_a, inner_b],
                           gap=8, padding=8)
        ann = _box("ann", w=240, h=40)
        ann.sizing_h = Sizing.FILL
        panel.sizing_h = Sizing.FILL

        column = _container("col", Direction.VERTICAL, [ann, panel],
                            gap=24, padding=0, border=Border.NONE)
        _layout(column)

        # Children should have positive sizes and fit within the parent
        assert ann._placed_h > 0, f"ann height must be positive"
        assert panel._placed_h > 0, f"panel height must be positive"
        # Total should fit within the frozen parent
        total = ann._placed_h + panel._placed_h + 24  # + gap
        assert total <= column._placed_h + 0.5, \
            f"Children total {total} exceeds parent {column._placed_h}"


# ═══════════════════════════════════════════════════════════════════
# Part 6: Heading overflow guard
# ═══════════════════════════════════════════════════════════════════

class TestHeadingOverflow:
    """Guard against negative child sizes from oversized headings."""

    def test_heading_does_not_cause_negative_child_height(self):
        """Container smaller than heading should not give children negative height."""
        child = _box("child", w=100, h=40)
        root = _container("root", Direction.VERTICAL, [child],
                          gap=8, padding=8)
        # Force a very small container
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.width = 120
        root.height = 40  # way too small for heading + child + padding
        root.heading = Line("Heading")
        _layout(root)

        # Child dimensions should never be negative
        assert child._placed_h >= 0, \
            f"Child got negative height: {child._placed_h}"
        assert child._placed_w >= 0, \
            f"Child got negative width: {child._placed_w}"

    def test_leaf_mixed_line_steps_use_each_line_step(self):
        """Leaf height should sum wrapped line steps, not reuse the first line's step."""
        leaf = Frame(
            id="leaf",
            heading=Line("Heading", weight="700", line_step=24),
            label=[Line("Body", size="24", line_step=32)],
        )

        measure(leaf)

        assert leaf._measured_h == 72, f"Expected 72px, got {leaf._measured_h}"


# ═══════════════════════════════════════════════════════════════════
# Part 7: FILL distribution fairness
# ═══════════════════════════════════════════════════════════════════

class TestFillDistributionFairness:
    """Explicit FILL distribution should stay equal even off the baseline grid."""

    def test_three_fill_children_stay_equal_off_grid(self):
        """3 FILL children remain equal even when the parent height is not grid-divisible."""
        a = _box("a", w=192, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=40)
        b.sizing_h = Sizing.FILL
        c = _box("c", w=192, h=40)
        c.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a, b, c],
                          gap=0, padding=0, border=Border.NONE)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 104  # not evenly divisible by 3
        root.width = 200
        _layout(root)

        sizes = [a._placed_h, b._placed_h, c._placed_h]
        expected = 104 / 3
        assert all(abs(size - expected) < 1e-6 for size in sizes), \
            f"Expected equal sizes near {expected}, got {sizes}"

    def test_two_fill_children_keep_exact_assigned_size(self):
        """2 FILL children keep the exact assigned size instead of snapping to the baseline grid."""
        a = _box("a", w=192, h=40)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=40)
        b.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a, b],
                          gap=0, padding=0, border=Border.NONE)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 104
        root.width = 200
        _layout(root)

        assert abs(a._placed_h - 52) < 1e-6, a._placed_h
        assert abs(b._placed_h - 52) < 1e-6, b._placed_h


class TestV3GridInfo:
    """Brockman grid metadata should come from the v3 engine, not the preview."""

    def test_layout_frame_diagram_returns_default_grid_info(self):
        root = _container(
            "root",
            Direction.HORIZONTAL,
            [_box("a"), _box("b")],
            gap=48,
            padding=24,
            border=Border.NONE,
        )
        result = layout_frame_diagram(FrameDiagram(root=root))

        assert result.grid_info is not None
        assert len(result.grid_info.col_xs) == 2
        assert result.grid_info.col_gap == 48
        assert result.grid_info.row_gap == 48
        assert result.grid_info.outer_margin == 24
        assert result.grid_info.baseline_step == BASELINE_UNIT

    def test_layout_frame_diagram_honours_explicit_grid_overrides(self):
        root = _container(
            "root",
            Direction.HORIZONTAL,
            [_box("a"), _box("b")],
            gap=48,
            padding=24,
            border=Border.NONE,
        )
        diagram = FrameDiagram(
            root=root,
            grid_cols=4,
            grid_col_gap=32,
            grid_row_gap=24,
            grid_outer_margin=40,
        )

        result = layout_frame_diagram(diagram)

        assert result.grid_info is not None
        assert len(result.grid_info.col_xs) == 4
        assert result.grid_info.col_gap == 32
        assert result.grid_info.row_gap == 24
        assert result.grid_info.outer_margin == 40


# ═══════════════════════════════════════════════════════════════════
# PART 8: NESTED AUTOLAYOUT STRESS TESTING
# ═══════════════════════════════════════════════════════════════════

class TestTwoLevelNesting:
    """2-level nesting: V→V, V→H, H→V, H→H with real content."""

    def test_v_v_nesting(self):
        """V→V: outer vertical with inner vertical children.

        Each inner container has 2 leaf boxes. All positions grid-snapped,
        no overflow.
        """
        inner1 = _container("inner1", Direction.VERTICAL,
                            [_box("a", h=64), _box("b", h=64)],
                            gap=8, padding=8)
        inner2 = _container("inner2", Direction.VERTICAL,
                            [_box("c", h=64), _box("d", h=64)],
                            gap=8, padding=8)
        outer = _container("outer", Direction.VERTICAL, [inner1, inner2],
                           gap=24, padding=8)
        _layout(outer)

        # All positions on grid
        for f in [outer, inner1, inner2]:
            assert _on_grid(f._placed_x) and _on_grid(f._placed_y), \
                f"{f.id} off grid: ({f._placed_x}, {f._placed_y})"
            assert _on_grid(f._placed_w) and _on_grid(f._placed_h), \
                f"{f.id} size off grid: ({f._placed_w}, {f._placed_h})"
        # No overflow
        assert not _children_within_parent(outer), \
            f"Outer overflow: {_children_within_parent(outer)}"
        assert not _children_within_parent(inner1), \
            f"Inner1 overflow: {_children_within_parent(inner1)}"
        assert not _children_within_parent(inner2), \
            f"Inner2 overflow: {_children_within_parent(inner2)}"

    def test_v_h_nesting(self):
        """V→H: outer vertical, inner containers horizontal.

        Inner containers lay out children side by side.
        """
        row1 = _container("row1", Direction.HORIZONTAL,
                          [_box("a", w=80, h=64), _box("b", w=80, h=64)],
                          gap=8, padding=8)
        row2 = _container("row2", Direction.HORIZONTAL,
                          [_box("c", w=80, h=64), _box("d", w=80, h=64)],
                          gap=8, padding=8)
        outer = _container("outer", Direction.VERTICAL, [row1, row2],
                           gap=24, padding=8)
        _layout(outer)

        assert not _children_within_parent(outer)
        assert not _children_within_parent(row1)
        assert not _children_within_parent(row2)
        # Rows should be stacked vertically
        assert row2._placed_y > row1._placed_y + row1._placed_h - 1

    def test_h_v_nesting(self):
        """H→V: outer horizontal, inner containers vertical."""
        col1 = _container("col1", Direction.VERTICAL,
                          [_box("a", h=40), _box("b", h=40)],
                          gap=8, padding=8)
        col2 = _container("col2", Direction.VERTICAL,
                          [_box("c", h=40), _box("d", h=40)],
                          gap=8, padding=8)
        outer = _container("outer", Direction.HORIZONTAL, [col1, col2],
                           gap=24, padding=8)
        _layout(outer)

        assert not _children_within_parent(outer)
        assert not _children_within_parent(col1)
        assert not _children_within_parent(col2)
        # Columns should be side by side
        assert col2._placed_x > col1._placed_x + col1._placed_w - 1

    def test_h_h_nesting(self):
        """H→H: outer horizontal, inner containers also horizontal."""
        inner1 = _container("inner1", Direction.HORIZONTAL,
                            [_box("a", w=60, h=40), _box("b", w=60, h=40)],
                            gap=8, padding=8)
        inner2 = _container("inner2", Direction.HORIZONTAL,
                            [_box("c", w=60, h=40), _box("d", w=60, h=40)],
                            gap=8, padding=8)
        outer = _container("outer", Direction.HORIZONTAL, [inner1, inner2],
                           gap=24, padding=8)
        _layout(outer)

        assert not _children_within_parent(outer)
        assert not _children_within_parent(inner1)
        assert not _children_within_parent(inner2)


class TestThreeLevelNesting:
    """3-level nesting with mixed directions and sizing."""

    def test_v_h_v_hierarchy(self):
        """V→H→V: page → row → column with mixed HUG/FILL.

        Outer=HUG, row=HUG, columns=HUG. All children should fit.
        """
        col1 = _container("col1", Direction.VERTICAL,
                          [_box("a", h=40), _box("b", h=40)],
                          gap=8, padding=4)
        col2 = _container("col2", Direction.VERTICAL,
                          [_box("c", h=40), _box("d", h=40), _box("e", h=40)],
                          gap=8, padding=4)
        row = _container("row", Direction.HORIZONTAL, [col1, col2],
                         gap=16, padding=4)
        page = _container("page", Direction.VERTICAL, [row],
                          gap=0, padding=8)
        _layout(page)

        # No overflow at any level
        for parent in [page, row, col1, col2]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"
        # All positions on grid
        for f in [page, row, col1, col2]:
            assert _on_grid(f._placed_w) and _on_grid(f._placed_h), \
                f"{f.id} size off grid"

    def test_h_v_h_hierarchy(self):
        """H→V→H: sidebar layout pattern.

        Outer horizontal holds a narrow sidebar and a wide main area,
        each vertical, each containing horizontal child rows.
        """
        sidebar_items = _container("si", Direction.HORIZONTAL,
                                   [_box("s1", w=40, h=32), _box("s2", w=40, h=32)],
                                   gap=4, padding=4)
        sidebar = _container("sidebar", Direction.VERTICAL,
                             [sidebar_items, _box("s3", w=80, h=40)],
                             gap=8, padding=4)
        main_row = _container("mr", Direction.HORIZONTAL,
                              [_box("m1", w=80, h=40), _box("m2", w=80, h=40)],
                              gap=8, padding=4)
        main = _container("main", Direction.VERTICAL,
                          [main_row, _box("m3", h=64)],
                          gap=8, padding=4)
        outer = _container("outer", Direction.HORIZONTAL, [sidebar, main],
                           gap=16, padding=8)
        _layout(outer)

        for parent in [outer, sidebar, main, sidebar_items, main_row]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_v_v_v_with_mixed_sizing(self):
        """V→V→V: 3-level vertical nesting with FILL at level 2.

        Level 1 (page): FIXED size. Level 2: FILL children split space.
        Level 3: HUG children inside FILL parents.
        """
        deep1 = _container("deep1", Direction.VERTICAL,
                           [_box("a", w=120, h=32), _box("b", w=120, h=32)],
                           gap=4, padding=4)
        deep2 = _container("deep2", Direction.VERTICAL,
                           [_box("c", w=120, h=32)],
                           gap=0, padding=4)
        mid1 = _container("mid1", Direction.VERTICAL, [deep1],
                          gap=0, padding=4)
        mid1.sizing_h = Sizing.FILL
        mid2 = _container("mid2", Direction.VERTICAL, [deep2],
                          gap=0, padding=4)
        mid2.sizing_h = Sizing.FILL
        page = _container("page", Direction.VERTICAL, [mid1, mid2],
                          gap=8, padding=8)
        page.sizing_w = Sizing.FIXED
        page.sizing_h = Sizing.FIXED
        page.height = 400
        page.width = 200
        _layout_fixed(page, 200, 400)

        # FILL children should expand
        assert mid1._placed_h > mid1._measured_h, \
            f"mid1 should expand: {mid1._placed_h} <= {mid1._measured_h}"
        assert mid2._placed_h > mid2._measured_h, \
            f"mid2 should expand: {mid2._placed_h} <= {mid2._measured_h}"
        # FILL children equalize when parent has extra space
        assert mid1._placed_h >= mid1._measured_h, \
            f"mid1 should be >= measured: {mid1._placed_h} < {mid1._measured_h}"
        assert mid2._placed_h >= mid2._measured_h, \
            f"mid2 should be >= measured: {mid2._placed_h} < {mid2._measured_h}"
        # No overflow at any level
        for parent in [page, mid1, mid2, deep1, deep2]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"
        # The fixed root stays on grid, but explicit FILL descendants can now
        # keep exact assigned sizes even when that lands off the baseline.
        assert _on_grid(page._placed_h), f"{page.id} height off grid"
        assert abs(mid1._placed_h - mid2._placed_h) < 1e-6, \
            f"FILL siblings should stay equal: mid1={mid1._placed_h}, mid2={mid2._placed_h}"

    def test_fill_cascade_three_levels(self):
        """FIXED root → FILL child → FILL grandchild.

        FILL should cascade: grandchild expands through its FILL parent.
        """
        leaf = _box("leaf", w=100, h=32)
        leaf.sizing_h = Sizing.FILL
        mid = _container("mid", Direction.VERTICAL, [leaf],
                         gap=0, padding=4)
        mid.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [mid],
                          gap=0, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 400
        root.width = 200
        _layout_fixed(root, 200, 400)

        # Both mid and leaf should have expanded
        assert mid._placed_h > mid._measured_h, \
            f"mid should expand: {mid._placed_h} <= {mid._measured_h}"
        assert leaf._placed_h > 32, \
            f"leaf should expand through FILL cascade: {leaf._placed_h}"
        # No overflow
        assert not _children_within_parent(root)
        assert not _children_within_parent(mid)

    def test_fixed_container_in_hug_parent(self):
        """FIXED inner container inside HUG parent.

        Parent should measure to at least the FIXED child's explicit size.
        """
        inner = _container("inner", Direction.VERTICAL,
                           [_box("a", w=80, h=40)],
                           gap=0, padding=4)
        inner.sizing_w = Sizing.FIXED
        inner.sizing_h = Sizing.FIXED
        inner.width = 200
        inner.height = 160
        outer = _container("outer", Direction.VERTICAL, [inner],
                           gap=0, padding=8)
        _layout(outer)

        # Parent should have reserved enough space for the FIXED child
        assert outer._placed_w >= 200 + 16, \
            f"Outer too narrow: {outer._placed_w}, inner needs 200+padding"
        assert outer._placed_h >= 160 + 16, \
            f"Outer too short: {outer._placed_h}, inner needs 160+padding"
        # Inner should be at its fixed size
        assert inner._placed_w == round_up(200), \
            f"Inner w={inner._placed_w}, expected {round_up(200)}"
        assert inner._placed_h == round_up(160), \
            f"Inner h={inner._placed_h}, expected {round_up(160)}"


class TestTextOverflowResilience:
    """Text overflow and edge cases that stress the layout engine."""

    def test_wide_content_in_narrow_fixed_container(self):
        """A wide child in a narrow FIXED container: child keeps its size.

        This tests the engine doesn't produce negative dimensions.
        """
        wide_child = _box("wide", w=400, h=64)
        narrow = _container("narrow", Direction.VERTICAL, [wide_child],
                            gap=0, padding=8)
        narrow.sizing_w = Sizing.FIXED
        narrow.sizing_h = Sizing.FIXED
        narrow.width = 100
        narrow.height = 100
        _layout_fixed(narrow, 100, 100)

        # Child keeps measured width (overflow is allowed)
        assert wide_child._placed_w >= 400, \
            f"Wide child should keep width: {wide_child._placed_w}"
        assert wide_child._placed_h > 0, "Height must be positive"

    def test_tall_content_in_short_fixed_container(self):
        """Tall children in short FIXED container: no negative dimensions."""
        tall = _box("tall", w=100, h=300)
        short = _container("short", Direction.VERTICAL, [tall],
                           gap=0, padding=8)
        short.sizing_w = Sizing.FIXED
        short.sizing_h = Sizing.FIXED
        short.width = 200
        short.height = 80  # way too short
        _layout_fixed(short, 200, 80)

        assert tall._placed_h >= 300, "Tall child should keep height"
        assert tall._placed_w > 0, "Width must be positive"
        assert tall._placed_y >= 0, "Y must not be negative"

    def test_many_children_in_small_container(self):
        """10 children in a container too small for them all.

        No negative dimensions, positions must be monotonically increasing.
        """
        children = [_box(f"c{i}", w=80, h=40) for i in range(10)]
        small = _container("small", Direction.VERTICAL, children,
                           gap=8, padding=8)
        small.sizing_w = Sizing.FIXED
        small.sizing_h = Sizing.FIXED
        small.width = 200
        small.height = 100  # needs ~488px for 10 children
        _layout_fixed(small, 200, 100)

        for child in children:
            assert child._placed_w > 0, f"{child.id} width <= 0"
            assert child._placed_h > 0, f"{child.id} height <= 0"
            assert child._placed_x >= 0, f"{child.id} x < 0"
            assert child._placed_y >= 0, f"{child.id} y < 0"
        # Children must be in increasing y order (no stacking on top)
        for i in range(len(children) - 1):
            assert children[i + 1]._placed_y > children[i]._placed_y, \
                f"c{i+1} y not after c{i}: {children[i+1]._placed_y} <= {children[i]._placed_y}"

    def test_fill_child_shrinks_below_measured(self):
        """FILL child in tiny container: accepts small size gracefully."""
        child = _box("fill_child", w=192, h=200)
        child.sizing_h = Sizing.FILL
        tiny = _container("tiny", Direction.VERTICAL, [child],
                          gap=0, padding=8)
        tiny.sizing_w = Sizing.FIXED
        tiny.sizing_h = Sizing.FIXED
        tiny.width = 200
        tiny.height = 40
        _layout_fixed(tiny, 200, 40)

        # FILL child accepts whatever parent gives, even if < measured
        assert child._placed_h >= 0, "FILL child height must not be negative"
        assert child._placed_w > 0, "FILL child width must be positive"

    def test_fill_children_preserve_padding(self):
        """FILL children must not overflow into parent padding.

        Regression test for the bug where _distribute_fill_space() treated
        measured content size as a hard floor, causing FILL children to eat
        the parent's padding when their measured sizes exceeded available space.
        """
        a = _box("a", w=192, h=64)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=64)
        b.sizing_h = Sizing.FILL
        parent = _container("parent", Direction.VERTICAL, [a, b],
                            gap=8, padding=8)
        parent.sizing_w = Sizing.FIXED
        parent.sizing_h = Sizing.FIXED
        parent.width = 208
        # Parent height smaller than children need:
        # children want 64+64+8(gap) = 136, plus padding 16 = 152
        # Give only 120 — children MUST shrink to respect padding.
        parent.height = 120
        _layout_fixed(parent, 208, 120)

        parent_bottom = parent._placed_y + parent._placed_h
        last_child_bottom = b._placed_y + b._placed_h
        # Bottom padding must be preserved
        assert last_child_bottom <= parent_bottom - parent.padding_bottom, \
            (f"Last child bottom ({last_child_bottom}) must be >= {parent.padding_bottom}px "
             f"above parent bottom ({parent_bottom}). "
             f"Padding eaten: {last_child_bottom - parent_bottom + parent.padding_bottom}px")

        # Both children should have equal height (FILL = equal share)
        diff = abs(a._placed_h - b._placed_h)
        assert diff <= BASELINE_UNIT, \
            f"FILL children should be equal: a={a._placed_h}, b={b._placed_h}"

    def test_fill_children_preserve_padding_with_heading(self):
        """Padding preserved even when heading consumes space.

        The android-container-vs-vm bug: heading + padding + FILL children
        in a frozen HUG parent — children must not eat the bottom padding.
        """
        a = _box("a", w=192, h=64)
        a.sizing_h = Sizing.FILL
        b = _box("b", w=192, h=64)
        b.sizing_h = Sizing.FILL
        parent = _container("parent", Direction.VERTICAL, [a, b],
                            gap=8, padding=8)
        parent.heading = Line(content="Section Heading", size=16)
        _layout(parent)

        parent_bottom = parent._placed_y + parent._placed_h
        last_child_bottom = b._placed_y + b._placed_h
        # Bottom padding must be preserved
        assert last_child_bottom <= parent_bottom - parent.padding_bottom, \
            (f"Last child bottom ({last_child_bottom}) must be >= {parent.padding_bottom}px "
             f"above parent bottom ({parent_bottom})")

    def test_heading_height_consistent_at_narrow_width(self):
        """Heading that wraps at narrow width must not cause child overflow.

        The bug: measure() computes heading height without max_width,
        but place() recomputes with max_width from the placed width.
        If heading wraps differently, children get wrong available space.
        The remeasure pass fixes this by caching heading height at the
        resolved width.
        """
        child = _box("leaf", w=100, h=32)
        parent = _container("parent", Direction.VERTICAL, [child],
                            gap=8, padding=8)
        parent.border = Border.SOLID
        parent.heading = Line(
            content="This is a very long heading that will definitely "
                    "wrap at narrow widths because it is many characters wide",
            size=16,
        )
        parent.sizing_w = Sizing.FIXED
        parent.sizing_h = Sizing.HUG
        parent.width = 120
        # Use full pipeline: measure → coerce → remeasure → place
        measure(parent)
        coerced = _enforce_fill_hug_invariant(parent)
        _remeasure_with_width_constraints(parent, 120,
                                          coerced_ids=set(coerced.keys()))
        place(parent, 0, 0, 120, parent._measured_h)

        child_bottom = child._placed_y + child._placed_h
        parent_bottom = parent._placed_y + parent._placed_h - parent.padding_bottom
        assert child_bottom <= parent_bottom, \
            (f"Child bottom ({child_bottom}) overflows parent inner edge "
             f"({parent_bottom}). Heading height likely inconsistent "
             f"between measure and place.")


class TestContainerTooSmall:
    """Behavior when FIXED container is smaller than children need."""

    def test_fixed_smaller_than_children_total(self):
        """FIXED container smaller than sum of children.

        Children overflow but dimensions stay positive.
        """
        a = _box("a", w=100, h=80)
        b = _box("b", w=100, h=80)
        c = _box("c", w=100, h=80)
        root = _container("root", Direction.VERTICAL, [a, b, c],
                          gap=8, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.width = 150
        root.height = 100  # needs 80*3 + 8*2 + 16 = 272
        _layout_fixed(root, 150, 100)

        # Children overflow but all have positive dimensions
        for child in [a, b, c]:
            assert child._placed_w > 0, f"{child.id} width <= 0"
            assert child._placed_h > 0, f"{child.id} height <= 0"
        # Children are sequentially placed (not on top of each other)
        assert b._placed_y > a._placed_y
        assert c._placed_y > b._placed_y

    def test_zero_available_for_fill(self):
        """HUG sibling consumes all space, FILL child gets 0 or near-0.

        FILL child should get at least 0, never negative.
        """
        big = _box("big", w=100, h=200)
        fill_child = _box("fill", w=100, h=40)
        fill_child.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [big, fill_child],
                          gap=8, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.height = 224  # big=200 + gap=8 + pad=16 = exactly 224, zero left
        root.width = 200
        _layout_fixed(root, 200, 224)

        assert fill_child._placed_h >= 0, \
            f"FILL child height negative: {fill_child._placed_h}"


# ═══════════════════════════════════════════════════════════════════
# Part 11: Figma parent-coercion correctness
# ═══════════════════════════════════════════════════════════════════

class TestParentCoercion:
    """Verify Figma-correct parent coercion: HUG→FIXED when children are FILL."""

    def test_parent_becomes_fixed_on_primary_axis(self):
        """HUG parent with FILL child: parent.sizing becomes FIXED."""
        a = _box("a", w=100, h=64)
        a.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a], gap=0, padding=8)
        measure(root)
        _enforce_fill_hug_invariant(root)
        assert root.sizing_h == Sizing.FIXED, \
            f"Parent should be FIXED, got {root.sizing_h}"
        assert root.height == root._measured_h, \
            f"Parent height should freeze at measured={root._measured_h}, got {root.height}"

    def test_parent_stays_hug_on_cross_axis(self):
        """HUG parent with FILL child: cross-axis sizing stays HUG."""
        a = _box("a", w=100, h=64)
        a.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [a], gap=0, padding=8)
        measure(root)
        _enforce_fill_hug_invariant(root)
        # Cross-axis (W) should stay HUG
        assert root.sizing_w == Sizing.HUG, \
            f"Cross-axis should stay HUG, got {root.sizing_w}"

    def test_unequal_fill_children_get_equal_shares(self):
        """FILL children with different measured sizes get equal shares
        in frozen HUG parent.  Measured size is not a floor."""
        small = _box("small", w=100, h=40)
        small.sizing_h = Sizing.FILL
        large = _box("large", w=100, h=120)
        large.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [small, large],
                          gap=8, padding=8)
        _layout(root)

        # In frozen HUG: measure inflates to max(40,120)*2 + 8 = 248.
        # With padding: round_up(248+16) = 264.
        # Place: available = 264-16-8 = 240.  Equal share = 120 each.
        diff = abs(small._placed_h - large._placed_h)
        assert diff <= BASELINE_UNIT, \
            f"FILL children should be equal (±{BASELINE_UNIT}): small={small._placed_h}, large={large._placed_h}"
        # Total should fit
        total = small._placed_h + large._placed_h + 8
        assert total <= root._placed_h - 16 + 0.5

    def test_mixed_fill_and_hug_in_frozen_parent(self):
        """1 HUG + 1 FILL in HUG parent: parent freezes, FILL gets remainder."""
        hug = _box("hug", w=100, h=64)
        fill = _box("fill", w=100, h=40)
        fill.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [hug, fill],
                          gap=8, padding=8)
        _layout(root)

        # Parent should have frozen to FIXED
        assert root.sizing_h == Sizing.FIXED
        # HUG child keeps measured size
        assert hug._placed_h == hug._measured_h
        # FILL child gets the remainder
        expected_avail = root._placed_h - 16 - 8  # padding + gap
        fill_expected = expected_avail - hug._placed_h
        assert abs(fill._placed_h - fill_expected) <= BASELINE_UNIT, \
            f"FILL should get remainder={fill_expected}, got {fill._placed_h}"

    def test_cross_axis_fill_in_hug_parent_stretches(self):
        """Cross-axis FILL in HUG parent: child stretches to tallest sibling."""
        short = _box("short", w=80, h=40)
        short.sizing_h = Sizing.FILL  # cross-axis FILL in H parent
        tall = _box("tall", w=80, h=120)
        root = _container("root", Direction.HORIZONTAL, [short, tall],
                          gap=8, padding=8)
        _layout(root)

        # short should stretch to match tall's height on the cross axis
        assert short._placed_h == tall._placed_h, \
            f"Cross-axis FILL should stretch: short={short._placed_h}, tall={tall._placed_h}"

    def test_cross_axis_fill_hug_parent_no_coercion(self):
        """Cross-axis FILL: parent stays HUG on cross axis, child stretches."""
        a = _box("a", w=80, h=40)
        a.sizing_h = Sizing.FILL  # H in horizontal parent = cross axis
        b = _box("b", w=80, h=80)
        root = _container("root", Direction.HORIZONTAL, [a, b],
                          gap=8, padding=8)
        measure(root)
        _enforce_fill_hug_invariant(root)
        # Cross-axis (H) should stay HUG — not coerced
        assert root.sizing_h == Sizing.HUG, \
            f"Cross-axis sizing should stay HUG, got {root.sizing_h}"

    # ── 3-level nesting ──

    def test_three_level_fill_cascades_through_frozen_parents(self):
        """FIXED → FILL → FILL: grandchild fills through frozen intermediate.

        Level 1: FIXED root (400px tall)
        Level 2: FILL mid (expands to fill root)
        Level 3: FILL leaf (expands to fill mid)
        """
        leaf = _box("leaf", w=100, h=32)
        leaf.sizing_h = Sizing.FILL
        mid = _container("mid", Direction.VERTICAL, [leaf], gap=0, padding=4)
        mid.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [mid], gap=0, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.width = 200
        root.height = 400
        _layout_fixed(root, 200, 400)

        # Both mid and leaf should have expanded
        assert mid._placed_h > mid._measured_h
        assert leaf._placed_h > 32
        # leaf should fill almost all of mid's interior
        mid_inner = mid._placed_h - 8  # padding_top + padding_bottom
        assert abs(leaf._placed_h - mid_inner) <= BASELINE_UNIT

    def test_three_level_hug_chain_freezes_at_bottom(self):
        """HUG → HUG → HUG(children FILL): only the innermost parent freezes.

        Level 1: page (HUG)
        Level 2: section (HUG)
        Level 3: row with FILL children
        """
        a = _box("a", w=80, h=40)
        a.sizing_w = Sizing.FILL
        b = _box("b", w=80, h=40)
        b.sizing_w = Sizing.FILL
        row = _container("row", Direction.HORIZONTAL, [a, b], gap=8, padding=4)
        section = _container("section", Direction.VERTICAL, [row], gap=0, padding=4)
        page = _container("page", Direction.VERTICAL, [section], gap=0, padding=8)
        measure(page)
        _enforce_fill_hug_invariant(page)

        # Only row should be frozen (it has FILL children on primary W axis)
        assert row.sizing_w == Sizing.FIXED, "Row should freeze to FIXED"
        # Section and page should stay HUG (no FILL children on their primary axis)
        assert section.sizing_h == Sizing.HUG, "Section should stay HUG"
        assert page.sizing_h == Sizing.HUG, "Page should stay HUG"
        # Layout should work without overflow
        _layout(page)
        for parent in [page, section, row]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_three_level_mixed_v_h_v_fill(self):
        """V(FIXED) → H(FILL) → V(FILL) with leaves.

        Root is FIXED, horizontal row fills vertically, vertical columns
        fill horizontally.
        """
        col1_a = _box("c1a", w=80, h=40)
        col1_b = _box("c1b", w=80, h=40)
        col1 = _container("col1", Direction.VERTICAL, [col1_a, col1_b],
                          gap=4, padding=4)
        col1.sizing_w = Sizing.FILL  # cross-axis FILL in H parent → stretch

        col2_a = _box("c2a", w=80, h=60)
        col2 = _container("col2", Direction.VERTICAL, [col2_a],
                          gap=0, padding=4)
        col2.sizing_w = Sizing.FILL

        row = _container("row", Direction.HORIZONTAL, [col1, col2],
                         gap=8, padding=4)
        row.sizing_h = Sizing.FILL  # primary-axis FILL in V parent

        footer = _box("footer", w=200, h=32)
        root = _container("root", Direction.VERTICAL, [row, footer],
                          gap=8, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.width = 400
        root.height = 300
        _layout_fixed(root, 400, 300)

        # Row should have expanded (FILL in FIXED parent)
        assert row._placed_h > row._measured_h, \
            f"Row should expand: {row._placed_h} <= {row._measured_h}"
        # Columns should have equal widths (cross-axis FILL)
        assert abs(col1._placed_w - col2._placed_w) <= BASELINE_UNIT, \
            f"Columns should be equal width: col1={col1._placed_w}, col2={col2._placed_w}"
        # No overflow
        for parent in [root, row, col1, col2]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_three_level_all_hug_no_fill(self):
        """V → H → V all HUG: no coercion needed, everything fits content."""
        leaf = _box("leaf", w=60, h=30)
        inner = _container("inner", Direction.VERTICAL, [leaf], gap=0, padding=4)
        mid = _container("mid", Direction.HORIZONTAL, [inner], gap=0, padding=4)
        outer = _container("outer", Direction.VERTICAL, [mid], gap=0, padding=8)
        _layout(outer)

        # Everything should be at measured size (no expansion)
        assert inner._placed_w == inner._measured_w
        assert inner._placed_h == inner._measured_h
        # No overflow
        for parent in [outer, mid, inner]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_three_level_deep_fill_in_hug_chain(self):
        """HUG → HUG → children(FILL): deepest parent freezes, others stay HUG.

        Grandchildren are FILL, so the innermost container freezes.
        The middle and outer containers have no FILL children themselves
        (their child is the frozen inner), so they stay HUG.
        """
        ga = _box("ga", w=100, h=48)
        ga.sizing_h = Sizing.FILL
        gb = _box("gb", w=100, h=80)
        gb.sizing_h = Sizing.FILL
        inner = _container("inner", Direction.VERTICAL, [ga, gb], gap=8, padding=4)
        mid = _container("mid", Direction.VERTICAL, [inner], gap=0, padding=4)
        outer = _container("outer", Direction.VERTICAL, [mid], gap=0, padding=8)
        _layout(outer)

        # inner should be frozen (FILL children on primary axis)
        assert inner.sizing_h == Sizing.FIXED
        # mid and outer should stay HUG
        assert mid.sizing_h == Sizing.HUG
        assert outer.sizing_h == Sizing.HUG
        # FILL grandchildren keep content minimum (no extra in frozen parent)
        assert ga._placed_h >= ga._measured_h, \
            f"ga should keep measured: {ga._placed_h} < {ga._measured_h}"
        assert gb._placed_h >= gb._measured_h, \
            f"gb should keep measured: {gb._placed_h} < {gb._measured_h}"
        # No overflow
        for parent in [outer, mid, inner]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_per_axis_mixed_sizing(self):
        """Width=FILL, Height=HUG on the same node in a FIXED parent."""
        child = _box("child", w=80, h=40)
        child.sizing_w = Sizing.FILL
        child.sizing_h = Sizing.HUG
        root = _container("root", Direction.HORIZONTAL, [child], gap=0, padding=8)
        root.sizing_w = Sizing.FIXED
        root.sizing_h = Sizing.FIXED
        root.width = 400
        root.height = 300
        _layout_fixed(root, 400, 300)

        # Width should expand (FILL on primary axis of H parent)
        assert child._placed_w > child._measured_w, \
            f"Width should expand: {child._placed_w} <= {child._measured_w}"
        # Height should stay at measured (HUG on cross axis)
        assert child._placed_h == child._measured_h, \
            f"Height should stay measured: {child._placed_h} != {child._measured_h}"

    def test_per_axis_mixed_sizing_triggers_coercion(self):
        """Width=FILL in HUG horizontal parent: parent freezes W, keeps H as HUG."""
        child = _box("child", w=80, h=40)
        child.sizing_w = Sizing.FILL
        child.sizing_h = Sizing.HUG
        root = _container("root", Direction.HORIZONTAL, [child], gap=0, padding=8)
        measure(root)
        _enforce_fill_hug_invariant(root)

        assert root.sizing_w == Sizing.FIXED, \
            f"Primary axis should freeze: got {root.sizing_w}"
        assert root.sizing_h == Sizing.HUG, \
            f"Cross axis should stay HUG: got {root.sizing_h}"

    def test_both_axes_fill_in_hug_horizontal_parent(self):
        """Children FILL on both W and H in HUG horizontal parent.

        Primary (W) triggers coercion; cross (H) stays HUG + stretches.
        """
        a = _box("a", w=80, h=40)
        b = _box("b", w=80, h=120)
        for child in (a, b):
            child.sizing_w = Sizing.FILL
            child.sizing_h = Sizing.FILL
        root = _container("root", Direction.HORIZONTAL, [a, b], gap=8, padding=8)
        measure(root)
        _enforce_fill_hug_invariant(root)

        assert root.sizing_w == Sizing.FIXED, "Primary W should freeze"
        assert root.sizing_h == Sizing.HUG, "Cross H should stay HUG"

        _layout(root)
        # Cross-axis FILL: both stretch to same height
        assert a._placed_h == b._placed_h, \
            f"Cross-axis FILL should stretch equally: a={a._placed_h}, b={b._placed_h}"
        # Primary FILL: equal width share
        diff = abs(a._placed_w - b._placed_w)
        assert diff <= BASELINE_UNIT, \
            f"Primary FILL should split equally: a={a._placed_w}, b={b._placed_w}"

    def test_double_freeze_hug_parent_with_fill_and_hug_children(self):
        """HUG parent with FILL child + HUG child that has FILL grandchildren.

        Both the inner HUG container and the outer HUG container should freeze.
        """
        ga = _box("ga", w=80, h=40)
        ga.sizing_h = Sizing.FILL
        gb = _box("gb", w=80, h=60)
        gb.sizing_h = Sizing.FILL
        inner_hug = _container("inner_hug", Direction.VERTICAL, [ga, gb],
                               gap=8, padding=4)

        fill_sibling = _box("fill_sib", w=80, h=40)
        fill_sibling.sizing_h = Sizing.FILL

        outer = _container("outer", Direction.VERTICAL, [fill_sibling, inner_hug],
                           gap=8, padding=8)
        measure(outer)
        _enforce_fill_hug_invariant(outer)

        # Both HUG containers should freeze
        assert inner_hug.sizing_h == Sizing.FIXED, "Inner HUG should freeze"
        assert outer.sizing_h == Sizing.FIXED, "Outer HUG should freeze"

        # Layout should work
        place(outer, 0, 0, outer._measured_w, outer._measured_h)
        for parent in [outer, inner_hug]:
            errors = _children_within_parent(parent)
            assert not errors, f"{parent.id}: {errors}"

    def test_coerced_overrides_returned(self):
        """_enforce_fill_hug_invariant returns a dict of coerced frame IDs."""
        child = _box("child", w=80, h=40)
        child.sizing_h = Sizing.FILL
        root = _container("root", Direction.VERTICAL, [child], gap=0, padding=8)
        measure(root)
        coerced = _enforce_fill_hug_invariant(root)

        assert "root" in coerced, f"Expected 'root' in coerced, got {coerced}"
        assert coerced["root"]["sizing_h"] == "FIXED"
        assert coerced["root"]["height"] == int(root._measured_h)
        assert "sizing_w" not in coerced["root"], "Cross-axis should not be coerced"

    def test_coerced_overrides_empty_when_no_fill(self):
        """No coercion when children are all HUG."""
        child = _box("child", w=80, h=40)
        root = _container("root", Direction.VERTICAL, [child], gap=0, padding=8)
        measure(root)
        coerced = _enforce_fill_hug_invariant(root)
        assert len(coerced) == 0, f"Expected empty, got {coerced}"

    def test_coerced_overrides_nested(self):
        """Nested coercion returns both inner and outer frame IDs."""
        inner_child = _box("ic", w=60, h=30)
        inner_child.sizing_h = Sizing.FILL
        inner = _container("inner", Direction.VERTICAL, [inner_child], gap=0, padding=4)

        outer_fill = _box("of", w=60, h=30)
        outer_fill.sizing_h = Sizing.FILL
        outer = _container("outer", Direction.VERTICAL, [outer_fill, inner], gap=8, padding=8)
        measure(outer)
        coerced = _enforce_fill_hug_invariant(outer)

        assert "inner" in coerced, f"inner should be coerced: {coerced}"
        assert "outer" in coerced, f"outer should be coerced: {coerced}"


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def round_up(v: float) -> int:
    """Round up to nearest BASELINE_UNIT."""
    return math.ceil(v / BASELINE_UNIT) * BASELINE_UNIT


# ═══════════════════════════════════════════════════════════════════
# Shared grid formula tests (cross-language contract)
# ═══════════════════════════════════════════════════════════════════

class TestSharedGridFormulas:
    """Verify equal_split_cell and span_size from diagram_shared.

    These formulas are mirrored in editor-base.js.  Any change to the
    Python or JS version must keep these tests green.
    """

    def test_equal_split_divides_evenly(self):
        from diagram_shared import equal_split_cell
        assert equal_split_cell(192, 1) == 192
        assert equal_split_cell(192, 2) == 96
        assert equal_split_cell(192, 3) == 64

    def test_equal_split_rounds_to_nearest_step(self):
        from diagram_shared import equal_split_cell
        # 200 / 3 = 66.67 → 66.67/8 = 8.33 → round(8.33)=8 → 8*8=64
        assert equal_split_cell(200, 3) == 64
        # 100 / 3 = 33.33 → 33.33/8 = 4.17 → round(4.17)=4 → 4*8=32
        assert equal_split_cell(100, 3) == 32
        # 208 / 3 = 69.33 → 69.33/8 = 8.67 → round(8.67)=9 → 9*8=72
        assert equal_split_cell(208, 3) == 72

    def test_equal_split_zero_count(self):
        from diagram_shared import equal_split_cell
        assert equal_split_cell(192, 0) == 0

    def test_span_size_single(self):
        from diagram_shared import span_size
        assert span_size(192, 1, 24) == 192

    def test_span_size_multi(self):
        from diagram_shared import span_size
        assert span_size(192, 2, 24) == 408  # 2*192 + 1*24
        assert span_size(192, 3, 24) == 624  # 3*192 + 2*24

    def test_span_size_zero_span(self):
        from diagram_shared import span_size
        assert span_size(192, 0, 24) == 0

    def test_span_size_zero_gap(self):
        from diagram_shared import span_size
        assert span_size(100, 3, 0) == 300


# ═══════════════════════════════════════════════════════════════════
# Standalone runner (works without pytest too)
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import traceback

    # Collect all test classes and methods
    test_classes = [
        TestVerticalDirection,
        TestHorizontalDirection,
        TestMixedDirections,
        TestAlignOffset,
        TestMainAxisAlignment,
        TestCrossAxisAlignment,
        TestAlignmentGridSnap,
        TestHugSizing,
        TestFillSizing,
        TestFixedSizing,
        TestSizingEdgeCases,
        TestInvariants,
        TestFillInHugInvariant,
        TestHeadingOverflow,
        TestFillDistributionFairness,
        TestTwoLevelNesting,
        TestThreeLevelNesting,
        TestTextOverflowResilience,
        TestContainerTooSmall,
        TestParentCoercion,
        TestSharedGridFormulas,
    ]

    passed = 0
    failed = 0
    errors = []

    for cls in test_classes:
        instance = cls()
        methods = [m for m in dir(instance) if m.startswith("test_")]
        for method_name in sorted(methods):
            full_name = f"{cls.__name__}.{method_name}"
            try:
                getattr(instance, method_name)()
                passed += 1
                print(f"  PASS: {full_name}")
            except AssertionError as e:
                failed += 1
                errors.append(f"  FAIL: {full_name}: {e}")
                print(f"  FAIL: {full_name}: {e}")
            except Exception as e:
                failed += 1
                errors.append(f"  ERROR: {full_name}: {type(e).__name__}: {e}")
                print(f"  ERROR: {full_name}: {type(e).__name__}: {e}")
                traceback.print_exc()

    print(f"\n{passed} passed, {failed} failed out of {passed + failed} tests")
    if errors:
        print("\nFailures:")
        for e in errors:
            print(e)
    sys.exit(1 if failed else 0)
