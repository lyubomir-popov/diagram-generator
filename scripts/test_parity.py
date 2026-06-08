"""M5: Shared parity test — Python side.

Loads the same fixture JSON used by the TypeScript parity tests and verifies
that the Python engine (with mock text measurement) produces identical
coordinates.  This ensures the two engines stay in sync.

Run:  python -m pytest test_parity.py -q
"""
import json
import pathlib
import sys
import unittest

# Ensure scripts/ is importable
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import diagram_shared
from diagram_shared import GRID_GUTTER, ICON_SIZE, INSET
from frame_model import (
    Align, Border, Direction, Fill, Frame, Justify, Line, Sizing,
)
from layout_v3 import layout_frame_diagram


def _mock_measure(text: str, font_size: float, weight: int = 400, *, features: dict | None = None) -> float:
    """Match TS MockTextAdapter: text.length * fontSize * 0.6"""
    return len(text) * font_size * 0.6

# ---------------------------------------------------------------------------
# Fixture loading
# ---------------------------------------------------------------------------

FIXTURES_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "packages" / "layout-engine" / "tests" / "fixtures"
    / "parity-fixtures.json"
)

_DIRECTION = {"VERTICAL": Direction.VERTICAL, "HORIZONTAL": Direction.HORIZONTAL}
_SIZING = {"HUG": Sizing.HUG, "FILL": Sizing.FILL, "FIXED": Sizing.FIXED}
_ALIGN = {a.name: a for a in Align}
_FILL = {"#FFFFFF": Fill.WHITE, "#F3F3F3": Fill.GREY, "#000000": Fill.BLACK}
_BORDER = {"SOLID": Border.SOLID, "NONE": Border.NONE, "DASHED": Border.DASHED, "FILL": Border.FILL}


def _derive_content_gap(children: list[Frame]) -> int:
    if not children:
        return 0
    return GRID_GUTTER if any(child.is_container for child in children) else INSET


def _build_frame(data: dict) -> Frame:
    """Reconstruct a Frame tree from fixture JSON."""
    children = [_build_frame(c) for c in data.get("children", [])]

    heading = None
    if data.get("heading"):
        h = data["heading"]
        heading = Line(h["content"], weight=h.get("weight", "700"), size=h.get("size", "18"))

    label = []
    for ln in data.get("label", []):
        label.append(Line(ln["content"], weight=ln.get("weight", "400"), size=ln.get("size", "18")))

    frame = Frame(
        id=data.get("id", ""),
        direction=_DIRECTION.get(data.get("direction", "VERTICAL"), Direction.VERTICAL),
        gap=data.get("gap", 24),
        padding=data.get("padding", 8),
        padding_top=data.get("paddingTop"),
        padding_right=data.get("paddingRight"),
        padding_bottom=data.get("paddingBottom"),
        padding_left=data.get("paddingLeft"),
        sizing_w=_SIZING.get(data.get("sizingW", "HUG"), Sizing.HUG),
        sizing_h=_SIZING.get(data.get("sizingH", "HUG"), Sizing.HUG),
        fill_weight=data.get("fillWeight", 1),
        align=_ALIGN.get(data.get("align", "TOP_LEFT"), Align.TOP_LEFT),
        wrap=data.get("wrap", False),
        width=data.get("width"),
        height=data.get("height"),
        min_width=data.get("minWidth"),
        max_width=data.get("maxWidth"),
        min_height=data.get("minHeight"),
        max_height=data.get("maxHeight"),
        fill=_FILL.get(data.get("fill", "#FFFFFF"), Fill.WHITE),
        border=_BORDER.get(data.get("border", "SOLID"), Border.SOLID),
        heading=None,
        icon=data.get("icon") if not heading else None,
        icon_fill=data.get("iconFill"),
        label=label,
        role=data.get("role", ""),
        children=children,
        position_type=data.get("positionType", "AUTO"),
        x=data.get("x", 0),
        y=data.get("y", 0),
    )

    # Heading-as-child transformation mirrors the current TS fixture builder.
    if heading and frame.is_container:
        heading_child = Frame(
            id=f"{frame.id}__heading" if frame.id else "__heading",
            role="heading",
            sizing_w=Sizing.FILL, sizing_h=Sizing.HUG,
            min_height=ICON_SIZE,
            border=Border.NONE, padding=0,
            label=[heading],
            icon=data.get("icon"),
            icon_fill=data.get("iconFill"),
        )
        body = Frame(
            id=f"{frame.id}__body" if frame.id else "__body",
            direction=Direction.HORIZONTAL if frame.direction == Direction.HORIZONTAL else Direction.VERTICAL,
            gap=_derive_content_gap(frame.children),
            align=frame.align,
            sizing_w=Sizing.FILL,
            sizing_h=Sizing.HUG,
            border=Border.NONE,
            padding=0,
            children=list(frame.children),
        )
        frame.children = [heading_child, body]
        if frame.direction == Direction.HORIZONTAL:
            frame.direction = Direction.VERTICAL
        frame.icon = None

    return frame


def _collect_bounds(frame: Frame, out: dict | None = None) -> dict:
    if out is None:
        out = {}
    if frame.id and not frame.id.startswith("__"):
        out[frame.id] = {
            "x": round(frame._placed_x, 1),
            "y": round(frame._placed_y, 1),
            "w": round(frame._placed_w, 1),
            "h": round(frame._placed_h, 1),
        }
    for child in frame.children:
        _collect_bounds(child, out)
    return out


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class ParityFixtureTests(unittest.TestCase):
    """Verify Python engine matches fixture expectations (same as TS tests)."""

    @classmethod
    def setUpClass(cls):
        with open(FIXTURES_PATH, encoding="utf-8") as f:
            cls.fixtures = json.load(f)
        # Monkey-patch text measurement to match TS MockTextAdapter
        cls._original_measure = diagram_shared.measure_text_width
        diagram_shared.measure_text_width = _mock_measure

    @classmethod
    def tearDownClass(cls):
        # Restore original text measurement so other tests are unaffected
        diagram_shared.measure_text_width = cls._original_measure

    def _run_fixture(self, fixture: dict):
        root = _build_frame(fixture["root"])
        from frame_model import FrameDiagram
        diagram = FrameDiagram(title=fixture.get("description", ""), root=root)
        result = layout_frame_diagram(diagram)
        bounds = _collect_bounds(root)

        expected = fixture["expected"]
        self.assertEqual(result.width, expected["width"],
                         f"Overall width mismatch for {fixture['name']}")
        self.assertEqual(result.height, expected["height"],
                         f"Overall height mismatch for {fixture['name']}")

        for frame_id, exp_b in expected["bounds"].items():
            with self.subTest(frame_id=frame_id):
                self.assertIn(frame_id, bounds,
                              f"Frame '{frame_id}' not in layout output")
                actual = bounds[frame_id]
                self.assertAlmostEqual(actual["x"], exp_b["x"], places=0,
                                       msg=f"{frame_id}.x")
                self.assertAlmostEqual(actual["y"], exp_b["y"], places=0,
                                       msg=f"{frame_id}.y")
                self.assertAlmostEqual(actual["w"], exp_b["w"], places=0,
                                       msg=f"{frame_id}.w")
                self.assertAlmostEqual(actual["h"], exp_b["h"], places=0,
                                       msg=f"{frame_id}.h")


def _make_test(fixture):
    """Create a test method for a single fixture."""
    def test(self):
        self._run_fixture(fixture)
    test.__doc__ = f"parity: {fixture['name']}"
    return test


# Dynamically add a test method per fixture
with open(FIXTURES_PATH, encoding="utf-8") as _f:
    _all = json.load(_f)
for _fix in _all:
    setattr(ParityFixtureTests, f"test_{_fix['name'].replace('-', '_')}", _make_test(_fix))


if __name__ == "__main__":
    unittest.main()
