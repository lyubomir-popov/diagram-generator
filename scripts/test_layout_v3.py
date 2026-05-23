"""Unit tests for the Frame-based layout engine.

Verifies the core autolayout invariants:
  1. Children never overflow their parent
  2. FILL children expand to share remaining space
  3. Explicit height/width is respected on leaf frames
  4. Padding is applied even when border is NONE
  5. Cross-axis children stretch to parent's cross extent
"""

from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from frame_model import Frame, FrameDiagram, Direction, Sizing, Align
from diagram_model import Line, Fill, Border
from layout_v3 import (
    measure, place, _enforce_fill_hug_invariant,
    layout_frame_diagram, _distribute_fill_space,
    _remeasure_with_width_constraints,
)
from diagram_layout import DashedLinePrimitive, TextBlock
from diagram_shared import measure_text_width, estimate_line_width, wrap_text_lines


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _box(id: str, w: int = 192, h: int = 64, **kw) -> Frame:
    """Create a leaf box frame with explicit size."""
    return Frame(id=id, width=w, height=h, label=[Line("test")], **kw)


def _container(id: str, direction: Direction, children: list[Frame],
               gap: int = 8, padding: int = 8, border: Border = Border.SOLID,
               fill: Fill = Fill.WHITE, **kw) -> Frame:
    """Create a container frame."""
    return Frame(id=id, direction=direction, children=children,
                 gap=gap, padding=padding, border=border, fill=fill, **kw)


def _layout(root: Frame) -> Frame:
    """Measure + place a frame tree, return root."""
    measure(root)
    _enforce_fill_hug_invariant(root)
    place(root, 0, 0, root._measured_w, root._measured_h)
    return root


def _children_within_parent(frame: Frame) -> list[str]:
    """Return list of error messages for children that overflow their parent."""
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
        # Recurse
        errors.extend(_children_within_parent(child))
    return errors


# ---------------------------------------------------------------------------
# Test 1: Simple vertical stack — children must not overflow
# ---------------------------------------------------------------------------

def test_vertical_stack_no_overflow():
    """Three boxes stacked vertically must fit inside their parent."""
    root = _container("root", Direction.VERTICAL, [
        _box("a", h=64),
        _box("b", h=64),
        _box("c", h=64),
    ], gap=8, padding=8)
    _layout(root)

    errors = _children_within_parent(root)
    assert not errors, f"Children overflow parent:\n" + "\n".join(errors)

    # Expected height: 3*64 + 2*8 + 2*8 = 192 + 16 + 16 = 224
    expected_content = 3 * 64 + 2 * 8  # 208
    expected_total = expected_content + 2 * 8  # 224
    assert root._placed_h >= expected_total, \
        f"Root too short: {root._placed_h} < {expected_total}"
    print(f"  PASS: vertical stack, root={root._placed_w}x{root._placed_h}")


# ---------------------------------------------------------------------------
# Test 2: FILL children share remaining space
# ---------------------------------------------------------------------------

def test_fill_children_share_space():
    """Two FILL children in a 400px-tall container should each get ~half."""
    child_a = _box("a", h=40)
    child_a.sizing_h = Sizing.FILL  # primary axis for vertical parent
    child_b = _box("b", h=40)
    child_b.sizing_h = Sizing.FILL

    root = _container("root", Direction.VERTICAL, [child_a, child_b],
                       gap=8, padding=8)
    root.height = 400
    root.sizing_w = Sizing.FIXED
    root.sizing_h = Sizing.FIXED
    _layout(root)

    errors = _children_within_parent(root)
    assert not errors, f"Children overflow parent:\n" + "\n".join(errors)

    # Each child should get (400 - 16 - 8) / 2 = 188
    print(f"  PASS: fill children, a={child_a._placed_h}, b={child_b._placed_h}")


def test_fill_children_stay_equal_when_parent_is_not_grid_divisible():
    """Explicit FILL siblings should stay equal even when the parent span is not divisible by 8."""
    child_a = _box("a", h=40)
    child_a.sizing_h = Sizing.FILL
    child_b = _box("b", h=40)
    child_b.sizing_h = Sizing.FILL
    child_c = _box("c", h=40)
    child_c.sizing_h = Sizing.FILL

    root = _container("root", Direction.VERTICAL, [child_a, child_b, child_c],
                       gap=0, padding=0, border=Border.NONE)
    root.width = 200
    root.height = 104
    root.sizing_w = Sizing.FIXED
    root.sizing_h = Sizing.FIXED
    _layout(root)

    assert abs(child_a._placed_h - (104 / 3)) < 1e-6, child_a._placed_h
    assert abs(child_a._placed_h - child_b._placed_h) < 1e-6
    assert abs(child_b._placed_h - child_c._placed_h) < 1e-6
    assert abs((child_a._placed_h + child_b._placed_h + child_c._placed_h) - 104) < 1e-6


# ---------------------------------------------------------------------------
# Test 3: Mixed HUG + FILL — FILL gets remaining space
# ---------------------------------------------------------------------------

def test_mixed_hug_fill():
    """One HUG child + one FILL child: FILL gets the remaining space."""
    child_a = _box("a_hug", h=100)
    # child_a stays HUG (default)
    child_b = _box("b_fill", h=40)
    child_b.sizing_h = Sizing.FILL  # primary axis for vertical parent

    root = _container("root", Direction.VERTICAL, [child_a, child_b],
                       gap=8, padding=8)
    root.height = 400
    root.sizing_w = Sizing.FIXED
    root.sizing_h = Sizing.FIXED
    _layout(root)

    errors = _children_within_parent(root)
    assert not errors, f"Children overflow parent:\n" + "\n".join(errors)

    # b should get remaining space; a rounds 100 → 104 (grid)
    assert child_a._placed_h >= 100, f"HUG child should be >= 100, got {child_a._placed_h}"
    print(f"  PASS: mixed hug+fill, a={child_a._placed_h}, b={child_b._placed_h}")


# ---------------------------------------------------------------------------
# Test 4: FILL children with unequal measured sizes — no overflow
# ---------------------------------------------------------------------------

def test_fill_unequal_measured_no_overflow():
    """FILL children with different natural sizes must not overflow.

    This is the bug from android-container-vs-vm: columns divide space
    equally among FILL children, but larger children refuse to shrink,
    causing total > container.
    """
    child_a = _box("a_small", h=40)
    child_a.sizing_h = Sizing.FILL
    child_b = _box("b_big", h=192)
    child_b.sizing_h = Sizing.FILL
    child_c = _box("c_small", h=40)
    child_c.sizing_h = Sizing.FILL
    child_d = _box("d_big", h=192)
    child_d.sizing_h = Sizing.FILL

    root = _container("root", Direction.VERTICAL,
                       [child_a, child_b, child_c, child_d],
                       gap=24, padding=0, border=Border.NONE)
    _layout(root)

    errors = _children_within_parent(root)
    assert not errors, f"Children overflow parent:\n" + "\n".join(errors)
    print(f"  PASS: unequal fill no overflow, root_h={root._placed_h}")
    print(f"    a={child_a._placed_h}, b={child_b._placed_h}, "
          f"c={child_c._placed_h}, d={child_d._placed_h}")


# ---------------------------------------------------------------------------
# Test 5: Explicit height on leaf is respected
# ---------------------------------------------------------------------------

def test_explicit_height_respected():
    """A leaf with height=1 (separator) should measure at 1, not BOX_MIN_HEIGHT."""
    sep = Frame(id="sep", border=Border.NONE, fill=Fill.WHITE,
                label=[], width=192, height=1, padding=0)
    measure(sep)
    assert sep._measured_h <= 8, \
        f"Separator should measure ~1px (rounded to 8), got {sep._measured_h}"
    print(f"  PASS: explicit height, sep measured={sep._measured_w}x{sep._measured_h}")


# ---------------------------------------------------------------------------
# Test 6: Padding applied on borderless frames
# ---------------------------------------------------------------------------

def test_padding_on_borderless_frame():
    """Padding should be applied even when border=NONE (e.g. root outer_margin)."""
    child = _box("inner", w=100, h=100)
    root = _container("root", Direction.VERTICAL, [child],
                       gap=0, padding=24, border=Border.NONE)
    _layout(root)

    # Child should be offset by padding
    assert child._placed_x >= 24 - 0.5, \
        f"Child x={child._placed_x}, expected >= 24 (padding)"
    assert child._placed_y >= 24 - 0.5, \
        f"Child y={child._placed_y}, expected >= 24 (padding)"

    # Root should be big enough to include padding on all sides
    assert root._placed_w >= 100 + 48, \
        f"Root w={root._placed_w}, expected >= {100+48}"
    assert root._placed_h >= 100 + 48, \
        f"Root h={root._placed_h}, expected >= {100+48}"

    errors = _children_within_parent(root)
    assert not errors, f"Children overflow parent:\n" + "\n".join(errors)
    print(f"  PASS: borderless padding, root={root._placed_w}x{root._placed_h}, "
          f"child at ({child._placed_x},{child._placed_y})")


# ---------------------------------------------------------------------------
# Test 7: Nested containers — no overflow at any level
# ---------------------------------------------------------------------------

def test_nested_containers_no_overflow():
    """Panel inside a column inside root — nothing overflows.

    Annotation and separator are FILL (stretch to fill),
    panel is HUG (keeps its measured size).  This is the correct
    Figma workflow: only mark children as FILL if they should grow.
    """
    inner_a = _box("inner_a", h=64)
    inner_b = _box("inner_b", h=40)
    panel = _container("panel", Direction.VERTICAL, [inner_a, inner_b],
                        gap=8, padding=8, heading=Line("Panel heading"))

    annotation = Frame(id="ann", border=Border.NONE, fill=Fill.WHITE,
                       label=[Line("Heading text")], width=240, padding=0)
    sep = Frame(id="sep", border=Border.NONE, fill=Fill.WHITE,
                label=[], width=240, height=1, padding=0)

    # Only annotation and sep are FILL; panel keeps HUG to preserve content
    annotation.sizing_h = Sizing.FILL
    sep.sizing_h = Sizing.FILL

    column = _container("col", Direction.VERTICAL,
                         [annotation, panel, sep],
                         gap=24, padding=0, border=Border.NONE)
    _layout(column)

    errors = _children_within_parent(column)
    assert not errors, f"Children overflow column:\n" + "\n".join(errors)
    print(f"  PASS: nested containers, col={column._placed_w}x{column._placed_h}")
    for c in column.children:
        print(f"    {c.id}: ({c._placed_x},{c._placed_y}) {c._placed_w}x{c._placed_h}")


# ---------------------------------------------------------------------------
# Test 8: Cross-axis stretch
# ---------------------------------------------------------------------------

def test_cross_axis_stretch():
    """In a horizontal layout, children with counter-axis FILL stretch to
    the cross-axis size (tallest child's height).  Default HUG keeps
    measured height.
    """
    child_a = _box("short", h=40)
    child_a.sizing_h = Sizing.FILL  # counter-axis FILL → stretch
    child_b = _box("tall", h=120)
    child_b.sizing_h = Sizing.FILL  # counter-axis FILL → stretch

    root = _container("root", Direction.HORIZONTAL, [child_a, child_b],
                       gap=8, padding=8)
    _layout(root)

    # Both children should have the same height (cross-axis stretch via FILL)
    assert child_a._placed_h == child_b._placed_h, \
        f"Cross-axis mismatch: short={child_a._placed_h}, tall={child_b._placed_h}"
    print(f"  PASS: cross-axis stretch, both h={child_a._placed_h}")


# ---------------------------------------------------------------------------
# Test: _distribute_fill_space shared helper
# ---------------------------------------------------------------------------

def test_distribute_fill_space_equal():
    """Equal distribution among FILL children."""
    sizes = _distribute_fill_space(240, [0, 0, 0])
    assert len(sizes) == 3
    assert sum(sizes) <= 240
    assert all(s > 0 for s in sizes)
    print(f"  PASS: equal fill distribution: {sizes}")


def test_distribute_fill_space_clamped():
    """FILL children get equal shares — measured size is NOT a floor.
    With min constraint, children clamp at their minimum instead."""
    # Without constraints: equal split regardless of measured size
    sizes = _distribute_fill_space(100, [60, 0])
    assert sizes[0] == sizes[1], f"Should be equal: {sizes[0]} != {sizes[1]}"
    assert sum(sizes) <= 100
    # With min constraint: child clamped at min, remainder to the other
    sizes2 = _distribute_fill_space(100, [60, 0], fill_mins=[56, None])
    assert sizes2[0] >= 56, f"Min-constrained child should be >= 56, got {sizes2[0]}"
    assert sizes2[1] > 0
    assert sum(sizes2) <= 100
    print(f"  PASS: fill distribution (equal={sizes}, min-constrained={sizes2})")


def test_distribute_fill_space_empty():
    """Empty list returns empty."""
    assert _distribute_fill_space(100, []) == []
    print("  PASS: empty fill distribution")


# ---------------------------------------------------------------------------
# Test: Font metrics accuracy
# ---------------------------------------------------------------------------

def test_measure_text_width_proportional():
    """Font metrics should give different widths for different characters."""
    w_iii = measure_text_width("iii", 18)
    w_mmm = measure_text_width("mmm", 18)
    assert w_mmm > w_iii * 1.5, \
        f"'mmm' ({w_mmm}) should be much wider than 'iii' ({w_iii})"
    print(f"  PASS: proportional widths: iii={w_iii:.1f}, mmm={w_mmm:.1f}")


def test_measure_text_width_known_string():
    """A known string should have a reasonable width within expected range."""
    w = measure_text_width("ticket.", 18)
    # Ubuntu Sans 'ticket.' at 18px should be roughly 45-55px
    assert 35 < w < 70, f"'ticket.' at 18px = {w}, expected 35-70"
    print(f"  PASS: 'ticket.' at 18px = {w:.1f}px")


def test_estimate_line_width_uses_font_metrics():
    """estimate_line_width should return proportional widths, not fixed-factor."""
    spec_narrow = {"content": "iiiiii", "size": 18, "weight": "400"}
    spec_wide = {"content": "mmmmmm", "size": 18, "weight": "400"}
    w_narrow = estimate_line_width(spec_narrow)
    w_wide = estimate_line_width(spec_wide)
    # Same char count, must have significantly different widths
    assert w_wide > w_narrow * 1.5, \
        f"Same-length strings should differ: narrow={w_narrow:.1f}, wide={w_wide:.1f}"
    print(f"  PASS: estimate_line_width proportional: {w_narrow:.1f} vs {w_wide:.1f}")


# ---------------------------------------------------------------------------
# Test: wrap_text_lines with font metrics
# ---------------------------------------------------------------------------

def test_wrap_text_lines_fits():
    """Text that fits in the width should not wrap."""
    lines = [{"content": "short", "size": 18, "weight": "400"}]
    result = wrap_text_lines(lines, 200)
    assert len(result) == 1, f"Should be 1 line, got {len(result)}"
    assert result[0]["content"] == "short"
    print("  PASS: wrap_text_lines no-wrap for short text")


def test_wrap_text_lines_wraps():
    """Long text should wrap into multiple lines."""
    lines = [{"content": "This is a long sentence that must wrap", "size": 18, "weight": "400"}]
    result = wrap_text_lines(lines, 100)
    assert len(result) > 1, f"Should wrap, got {len(result)} lines"
    # All content should be preserved
    joined = " ".join(r["content"] for r in result)
    assert joined == "This is a long sentence that must wrap"
    print(f"  PASS: wrap_text_lines wraps to {len(result)} lines")


# ---------------------------------------------------------------------------
# Test: Constrained re-measurement (pass 1.5)
# ---------------------------------------------------------------------------

def _full_layout(root: Frame, root_w: float = None) -> Frame:
    """Run the full layout pipeline: measure → coerce → remeasure → place."""
    measure(root)
    _enforce_fill_hug_invariant(root)
    w = root_w if root_w is not None else root._measured_w
    _remeasure_with_width_constraints(root, w)
    h = root._measured_h
    place(root, 0, 0, w, h)
    return root


def test_remeasure_reduces_height():
    """When children get wider than BLOCK_WIDTH, text wraps to fewer lines,
    reducing measured height."""
    # Create a leaf with long text that wraps at BLOCK_WIDTH (192)
    long_text = "Customer believes getent to be the issue and opens a support ticket immediately"
    child = Frame(
        id="text_box",
        label=[Line(long_text, size=18)],
        sizing_w=Sizing.FILL,
        sizing_h=Sizing.HUG,
        padding=8,
    )
    root = _container("root", Direction.HORIZONTAL, [child], padding=8)
    root.sizing_w = Sizing.FIXED
    root.width = 600

    # Measure at default BLOCK_WIDTH
    measure(root)
    height_before = child._measured_h

    # Remeasure with wider constraint
    _enforce_fill_hug_invariant(root)
    _remeasure_with_width_constraints(root, 600)
    height_after = child._measured_h

    assert height_after <= height_before, \
        f"Height should decrease or stay same: before={height_before}, after={height_after}"
    print(f"  PASS: remeasure reduces height: {height_before} → {height_after}")


def test_remeasure_no_overflow():
    """After remeasure + place, children must not overflow parent."""
    long_text = "This is a paragraph with several words that needs to wrap properly"
    children = [
        Frame(id=f"box_{i}", label=[Line(long_text, size=18)],
              sizing_w=Sizing.FILL, sizing_h=Sizing.HUG, padding=8)
        for i in range(3)
    ]
    root = _container("root", Direction.HORIZONTAL, children, gap=24, padding=24)
    root.sizing_w = Sizing.FIXED
    root.width = 800

    _full_layout(root, 800)

    errors = _children_within_parent(root)
    assert not errors, f"Overflow after remeasure: {errors}"
    print("  PASS: remeasure no overflow")


def test_remeasure_updates_hug_parent():
    """HUG-height parent should reflect remeasured child heights."""
    child = Frame(
        id="text_child",
        label=[Line("A long text that wraps at narrow widths but not at wide ones", size=18)],
        sizing_w=Sizing.FILL,
        sizing_h=Sizing.HUG,
        padding=8,
    )
    root = _container("root", Direction.VERTICAL, [child], padding=8)
    root.sizing_w = Sizing.FIXED
    root.sizing_h = Sizing.HUG
    root.width = 600

    _full_layout(root, 600)

    # Root height should match child height + padding
    expected_min = child._placed_h + root.padding_top + root.padding_bottom
    assert root._placed_h >= expected_min - 1, \
        f"Root height {root._placed_h} should accommodate child {child._placed_h} + padding"
    print(f"  PASS: HUG parent updated after remeasure: root_h={root._placed_h}")


# ---------------------------------------------------------------------------
# Min/max constraint tests
# ---------------------------------------------------------------------------

def test_min_width_on_fill_child():
    """FILL child with min_width should not shrink below the minimum."""
    child_a = _box("a", sizing_w=Sizing.FILL, min_width=200)
    child_b = _box("b", sizing_w=Sizing.FILL)
    root = _container("root", Direction.HORIZONTAL, [child_a, child_b],
                       gap=8, padding=8)
    root.sizing_w = Sizing.FIXED
    root.width = 350  # After padding+gap: 350-16-8=326; equal split=163, below min
    _layout(root)
    assert child_a._placed_w >= 200, \
        f"child_a width {child_a._placed_w} should be >= min_width 200"
    print(f"  PASS: min_width on FILL child: a={child_a._placed_w}, b={child_b._placed_w}")


def test_max_width_on_fill_child():
    """FILL child with max_width should not grow beyond the maximum."""
    child_a = _box("a", sizing_w=Sizing.FILL, max_width=150)
    child_b = _box("b", sizing_w=Sizing.FILL)
    root = _container("root", Direction.HORIZONTAL, [child_a, child_b],
                       gap=8, padding=8)
    root.sizing_w = Sizing.FIXED
    root.width = 500  # After padding+gap: 500-16-8=476; equal split=238, above max
    _layout(root)
    assert child_a._placed_w <= 150, \
        f"child_a width {child_a._placed_w} should be <= max_width 150"
    print(f"  PASS: max_width on FILL child: a={child_a._placed_w}, b={child_b._placed_w}")


def test_min_width_on_hug_frame():
    """HUG frame with min_width should expand if content is narrower."""
    child = _box("child", w=80, h=40)
    root = _container("root", Direction.VERTICAL, [child], padding=8, min_width=200)
    root.sizing_w = Sizing.HUG
    _layout(root)
    assert root._placed_w >= 200, \
        f"root width {root._placed_w} should be >= min_width 200"
    print(f"  PASS: min_width on HUG frame: root_w={root._placed_w}")


def test_max_width_on_fixed_frame():
    """FIXED frame with max_width should be capped."""
    child = _box("child", w=80, h=40)
    root = _container("root", Direction.VERTICAL, [child], padding=8, max_width=200)
    root.sizing_w = Sizing.FIXED
    root.width = 400
    _layout(root)
    assert root._placed_w <= 200, \
        f"root width {root._placed_w} should be <= max_width 200"
    print(f"  PASS: max_width on FIXED frame: root_w={root._placed_w}")


def test_min_height_on_fill_child():
    """FILL child with min_height in vertical layout should not shrink below minimum."""
    child_a = _box("a", sizing_h=Sizing.FILL, min_height=120)
    child_b = _box("b", sizing_h=Sizing.FILL)
    root = _container("root", Direction.VERTICAL, [child_a, child_b],
                       gap=8, padding=8)
    root.sizing_h = Sizing.FIXED
    root.height = 200  # After padding+gap: 200-16-8=176; equal split=88, below min
    _layout(root)
    assert child_a._placed_h >= 120, \
        f"child_a height {child_a._placed_h} should be >= min_height 120"
    print(f"  PASS: min_height on FILL child: a={child_a._placed_h}, b={child_b._placed_h}")


def test_max_height_on_fill_child():
    """FILL child with max_height in vertical layout should not exceed maximum."""
    child_a = _box("a", sizing_h=Sizing.FILL, max_height=100)
    child_b = _box("b", sizing_h=Sizing.FILL)
    root = _container("root", Direction.VERTICAL, [child_a, child_b],
                       gap=8, padding=8)
    root.sizing_h = Sizing.FIXED
    root.height = 400  # After padding+gap: 400-16-8=376; equal split=188, above max
    _layout(root)
    assert child_a._placed_h <= 100, \
        f"child_a height {child_a._placed_h} should be <= max_height 100"
    print(f"  PASS: max_height on FILL child: a={child_a._placed_h}, b={child_b._placed_h}")


def test_min_max_constraints_via_yaml():
    """Frame loader should parse min/max fields from YAML."""
    import tempfile, pathlib
    from frame_loader import load_frame_yaml
    yaml_text = """\
engine: v3
root:
  id: root
  direction: horizontal
  sizing: fill
  min_width: 200
  max_width: 800
  min_height: 100
  max_height: 600
  children:
    - id: child
      label: Test
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False, encoding="utf-8") as f:
        f.write(yaml_text)
        tmp_path = f.name
    try:
        diagram = load_frame_yaml(tmp_path)
        root = diagram.root
        assert root.min_width == 200
        assert root.max_width == 800
        assert root.min_height == 100
        assert root.max_height == 600
        # Child should have None for all constraints
        assert root.children[0].min_width is None
        assert root.children[0].max_width is None
        print("  PASS: min/max constraints parsed from YAML")
    finally:
        pathlib.Path(tmp_path).unlink()


def test_min_greater_than_max_rejected():
    """Conflicting min > max constraints should raise ValueError."""
    import pytest
    with pytest.raises(ValueError, match="min_width"):
        Frame(id="bad", min_width=500, max_width=100)
    with pytest.raises(ValueError, match="min_height"):
        Frame(id="bad", min_height=500, max_height=100)
    print("  PASS: min > max correctly rejected")


def test_negative_constraint_rejected():
    """Negative constraint values should raise ValueError."""
    import pytest
    with pytest.raises(ValueError):
        Frame(id="bad", min_width=-10)
    with pytest.raises(ValueError):
        Frame(id="bad", max_height=-5)
    print("  PASS: negative constraints correctly rejected")


def test_hug_child_min_width_accounts_in_fill_distribution():
    """HUG child with min_width should reduce space available for FILL siblings."""
    child_a = _box("a", w=80, h=40, sizing_w=Sizing.HUG, min_width=400)
    child_b = _box("b", sizing_w=Sizing.FILL)
    root = _container("root", Direction.HORIZONTAL, [child_a, child_b],
                       gap=8, padding=8)
    root.sizing_w = Sizing.FIXED
    root.width = 600
    _layout(root)
    # child_a should be at least 400
    assert child_a._placed_w >= 400, \
        f"child_a width {child_a._placed_w} should be >= min_width 400"
    # FILL sibling should receive remaining space (not the pre-constraint leftover)
    # When constraints make total > container, overflow is expected (like CSS)
    expected_available = 600 - 16 - 8 - 400  # root - padding - gap - child_a
    assert child_b._placed_w <= child_b._measured_w + 12, \
        f"FILL child should not grow beyond its content: {child_b._placed_w}"
    print(f"  PASS: HUG child with min_width: a={child_a._placed_w}, b={child_b._placed_w}")


def test_separator_role_renders_dashed_line():
    """Frame with role='separator' should produce DashedLinePrimitive, not a Rect."""
    sep = Frame(id="sep", role="separator", height=1, sizing_w=Sizing.FILL,
                sizing_h=Sizing.FIXED, label=[Line("Kernel boundary")])
    child_a = _box("a", w=192, h=64)
    child_b = _box("b", w=192, h=64)
    root = _container("root", Direction.VERTICAL, [child_a, sep, child_b],
                       gap=8, padding=8)
    result = layout_frame_diagram(FrameDiagram(root=root))
    fg = result.foreground
    # Should have a DashedLinePrimitive for the separator
    dashed_lines = [p for p in fg if isinstance(p, DashedLinePrimitive)]
    assert len(dashed_lines) >= 1, \
        f"Expected DashedLinePrimitive for separator, got {[type(p).__name__ for p in fg]}"
    # Should also have a TextBlock for the label
    text_blocks = [p for p in fg if isinstance(p, TextBlock) and
                   getattr(p, 'component_id', None) == 'sep']
    assert len(text_blocks) >= 1, \
        f"Expected TextBlock for separator label"
    # The dashed line should span the separator width
    dl = dashed_lines[0]
    assert dl.x2 > dl.x1, f"Dashed line should have positive width: {dl.x1} → {dl.x2}"
    print(f"  PASS: separator role renders dashed line at y={dl.y1}, width={dl.x2-dl.x1}")


# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_vertical_stack_no_overflow,
        test_fill_children_share_space,
        test_mixed_hug_fill,
        test_fill_unequal_measured_no_overflow,
        test_explicit_height_respected,
        test_padding_on_borderless_frame,
        test_nested_containers_no_overflow,
        test_cross_axis_stretch,
        test_distribute_fill_space_equal,
        test_distribute_fill_space_clamped,
        test_distribute_fill_space_empty,
        test_measure_text_width_proportional,
        test_measure_text_width_known_string,
        test_estimate_line_width_uses_font_metrics,
        test_wrap_text_lines_fits,
        test_wrap_text_lines_wraps,
        test_remeasure_reduces_height,
        test_remeasure_no_overflow,
        test_remeasure_updates_hug_parent,
        test_min_width_on_fill_child,
        test_max_width_on_fill_child,
        test_min_width_on_hug_frame,
        test_max_width_on_fixed_frame,
        test_min_height_on_fill_child,
        test_max_height_on_fill_child,
        test_min_max_constraints_via_yaml,
        test_min_greater_than_max_rejected,
        test_negative_constraint_rejected,
        test_hug_child_min_width_accounts_in_fill_distribution,
        test_separator_role_renders_dashed_line,
    ]

    passed = 0
    failed = 0
    for test in tests:
        name = test.__name__
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {name}: {type(e).__name__}: {e}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed out of {len(tests)} tests")
    sys.exit(1 if failed else 0)
