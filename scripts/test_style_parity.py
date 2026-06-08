"""Shared style parity fixtures for Python and TypeScript.

These fixtures express semantic inputs only: level, variant, heading,
label, role, and nesting. Both runtimes must resolve them to the same
effective fill/stroke and first-line typography.
"""

from __future__ import annotations

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from diagram_model import Border, Fill, Line
from frame_loader import resolve_styles
from frame_model import Align, Direction, Frame, Justify, Sizing

FIXTURES_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "packages"
    / "layout-engine"
    / "tests"
    / "fixtures"
    / "style-parity-fixtures.json"
)

_DIRECTION = {"VERTICAL": Direction.VERTICAL, "HORIZONTAL": Direction.HORIZONTAL}
_SIZING = {"HUG": Sizing.HUG, "FILL": Sizing.FILL, "FIXED": Sizing.FIXED}
_ALIGN = {a.name: a for a in Align}
_JUSTIFY = {j.name: j for j in Justify}
_FILL = {"#FFFFFF": Fill.WHITE, "#F3F3F3": Fill.GREY, "#000000": Fill.BLACK}
_BORDER = {"SOLID": Border.SOLID, "NONE": Border.NONE, "DASHED": Border.DASHED, "FILL": Border.FILL}


def _apply_variant(raw: dict) -> dict:
    if raw.get("variant") == "highlight":
        merged = {"fill": "#000000", "iconFill": "#FFFFFF"}
        merged.update(raw)
        return merged
    if raw.get("variant") == "annotation":
        merged = {"border": "NONE"}
        merged.update(raw)
        return merged
    return raw


def _build_line(content: str) -> Line:
    return Line(content)


def _build_frame(raw_input: dict) -> Frame:
    raw = _apply_variant(raw_input)
    children = [_build_frame(child) for child in raw.get("children", [])]
    label = [_build_line(text) for text in raw.get("label", [])]
    heading_line = _build_line(raw["heading"]) if raw.get("heading") else None
    original_direction = _DIRECTION.get(raw.get("direction", "VERTICAL"), Direction.VERTICAL)

    frame = Frame(
        id=raw.get("id", ""),
        direction=original_direction,
        gap=raw.get("gap", 24),
        padding=raw.get("padding", 8),
        padding_top=raw.get("paddingTop"),
        padding_right=raw.get("paddingRight"),
        padding_bottom=raw.get("paddingBottom"),
        padding_left=raw.get("paddingLeft"),
        align=_ALIGN.get(raw.get("align", "TOP_LEFT"), Align.TOP_LEFT),
        justify=_JUSTIFY.get(raw.get("justify", "PACKED"), Justify.PACKED),
        wrap=raw.get("wrap", False),
        sizing_w=_SIZING.get(raw.get("sizingW", "HUG"), Sizing.HUG),
        sizing_h=_SIZING.get(raw.get("sizingH", "HUG"), Sizing.HUG),
        fill_weight=raw.get("fillWeight", 1),
        width=raw.get("width"),
        height=raw.get("height"),
        min_width=raw.get("minWidth"),
        max_width=raw.get("maxWidth"),
        min_height=raw.get("minHeight"),
        max_height=raw.get("maxHeight"),
        fill=_FILL.get(raw.get("fill", "#FFFFFF"), Fill.WHITE),
        border=_BORDER.get(raw.get("border", "SOLID"), Border.SOLID),
        heading=heading_line,
        icon=raw.get("icon"),
        icon_fill=raw.get("iconFill"),
        level=raw.get("level"),
        label=label,
        role=raw.get("role", ""),
        children=children,
        position_type=raw.get("positionType", "AUTO"),
        x=raw.get("x", 0),
        y=raw.get("y", 0),
    )

    if heading_line and frame.is_container:
        heading_child = Frame(
            id=f"{frame.id}__heading" if frame.id else "__heading",
            role="heading",
            direction=Direction.VERTICAL,
            sizing_w=Sizing.FILL,
            sizing_h=Sizing.HUG,
            border=Border.NONE,
            fill=frame.fill,
            padding=0,
            label=[heading_line],
            icon=raw.get("icon"),
            icon_fill=raw.get("iconFill"),
        )
        body = Frame(
            id=f"{frame.id}__body" if frame.id else "__body",
            direction=original_direction,
            gap=frame.gap,
            align=frame.align,
            sizing_w=Sizing.FILL,
            sizing_h=Sizing.HUG,
            border=Border.NONE,
            padding=0,
            children=list(frame.children),
        )
        frame.children = [heading_child, body]
        frame.direction = Direction.VERTICAL
        frame.heading = None
        frame.icon = None

    return frame


def _collect_actual_styles(frame: Frame, out: dict[str, dict] | None = None) -> dict[str, dict]:
    if out is None:
        out = {}
    if frame.id:
        snapshot = {
            "resolvedFill": frame.resolved_fill,
            "resolvedStroke": frame.resolved_stroke,
        }
        if frame.role == "heading" and frame.label:
            snapshot["firstLine"] = {
                "weight": frame.resolved_heading_weight or "400",
                "smallCaps": bool(frame.resolved_heading_small_caps),
                "letterSpacing": frame.resolved_heading_letter_spacing,
                "fill": frame.resolved_text_fill or "#000000",
            }
        elif frame.label:
            is_leaf_lead = frame.is_leaf
            snapshot["firstLine"] = {
                "weight": (frame.resolved_leaf_lead_weight if is_leaf_lead else None) or "400",
                "smallCaps": bool(frame.resolved_leaf_lead_small_caps) if is_leaf_lead else False,
                "letterSpacing": frame.resolved_leaf_lead_letter_spacing if is_leaf_lead else None,
                "fill": frame.resolved_text_fill or "#000000",
            }
        out[frame.id] = snapshot
    for child in frame.children:
        _collect_actual_styles(child, out)
    return out


def _assert_no_resolved_white_fill(frame: Frame) -> None:
    assert frame.resolved_fill != "#FFFFFF", f"{frame.id}: resolved white fill is forbidden"
    for child in frame.children:
        _assert_no_resolved_white_fill(child)


class StyleParityFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(FIXTURES_PATH, encoding="utf-8") as handle:
            cls.fixtures = json.load(handle)

    def _run_fixture(self, fixture: dict) -> None:
        root = _build_frame(fixture["root"])
        resolve_styles(root)
        _assert_no_resolved_white_fill(root)
        actual = _collect_actual_styles(root)
        for frame_id, expected in fixture["expected"]["styles"].items():
            with self.subTest(frame_id=frame_id):
                self.assertIn(frame_id, actual)
                # smallCaps is intentionally divergent: TS uses true for
                # section headings, Python stays false.  Each runtime has
                # its own dedicated test, so skip it in the shared parity
                # comparison.
                actual_snap = dict(actual[frame_id])
                expected_snap = dict(expected)
                if "firstLine" in actual_snap:
                    actual_snap["firstLine"] = {k: v for k, v in actual_snap["firstLine"].items() if k != "smallCaps"}
                if "firstLine" in expected_snap:
                    expected_snap["firstLine"] = {k: v for k, v in expected_snap["firstLine"].items() if k != "smallCaps"}
                self.assertEqual(actual_snap, expected_snap)


def _make_test(fixture: dict):
    def test(self):
        self._run_fixture(fixture)

    test.__doc__ = f"style parity: {fixture['name']}"
    return test


with open(FIXTURES_PATH, encoding="utf-8") as _handle:
    _fixtures = json.load(_handle)
for _fixture in _fixtures:
    setattr(
        StyleParityFixtureTests,
        f"test_{_fixture['name'].replace('-', '_')}",
        _make_test(_fixture),
    )


if __name__ == "__main__":
    unittest.main()
