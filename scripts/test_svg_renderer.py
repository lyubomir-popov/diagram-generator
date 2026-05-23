"""SVG renderer golden-file snapshot tests.

Renders small deterministic diagrams and compares to stored golden files.
Update golden files with:  pytest scripts/test_svg_renderer.py --update-golden

Run with:  pytest scripts/test_svg_renderer.py -v
"""

from __future__ import annotations

import os
import sys
import pathlib

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from diagram_model import Arrow, Border, Box, BoxStyle, Diagram, Fill, Line, Panel
from diagram_layout import layout
from diagram_render_svg import render_svg

GOLDEN_DIR = pathlib.Path(__file__).parent / "test_fixtures" / "svg_golden"


def _render_diagram(diagram: Diagram) -> str:
    """Layout and render a diagram to SVG string."""
    result = layout(diagram)
    return render_svg(result)


# ─── Fixture diagrams ────────────────────────────────────────────────


def _two_box_vertical() -> Diagram:
    """Minimal vertical 2-box diagram."""
    return Diagram(
        title="two-box",
        arrangement=Diagram.Arrangement.GRID,
        cols=1,
        col_width=192,
        col_gap=24,
        row_gap=24,
        outer_margin=24,
        components=[
            Box(id="a", label=[Line("Alpha")], col=0, row=0),
            Box(id="b", label=[Line("Beta")], col=0, row=1),
            Arrow(source="a.bottom", target="b.top"),
        ],
    )


def _panel_with_children() -> Diagram:
    """Panel containing two boxes with styles."""
    return Diagram(
        title="panel-children",
        arrangement=Diagram.Arrangement.GRID,
        cols=2,
        col_width=192,
        col_gap=24,
        row_gap=24,
        outer_margin=24,
        components=[
            Panel(
                id="p",
                cols=2,
                col_gap=8,
                row_gap=8,
                fill=Fill.GREY,
                border=Border.FILL,
                heading=Line("Panel heading", weight="700"),
                col=0, row=0, col_span=2,
                children=[
                    Box(
                        id="c1",
                        label=[Line("Child One")],
                        icon="Document.svg",
                        col=0, row=0,
                    ),
                    Box(
                        id="c2",
                        label=[Line("Child Two")],
                        style=BoxStyle.HIGHLIGHT,
                        col=1, row=0,
                    ),
                ],
            ),
        ],
    )


def _horizontal_arrow() -> Diagram:
    """Horizontal arrow between two boxes."""
    return Diagram(
        title="horizontal-arrow",
        arrangement=Diagram.Arrangement.GRID,
        cols=2,
        col_width=192,
        col_gap=32,
        row_gap=24,
        outer_margin=24,
        components=[
            Box(id="left", label=[Line("Left")], col=0, row=0),
            Box(id="right", label=[Line("Right")], col=1, row=0),
            Arrow(source="left.right", target="right.left"),
        ],
    )


# ─── Test cases ──────────────────────────────────────────────────────

DIAGRAMS = {
    "two_box_vertical": _two_box_vertical,
    "panel_with_children": _panel_with_children,
    "horizontal_arrow": _horizontal_arrow,
}


@pytest.fixture(params=DIAGRAMS.keys())
def diagram_case(request):
    return request.param


def test_svg_golden(diagram_case, request):
    """Compare rendered SVG against stored golden file."""
    golden_path = GOLDEN_DIR / f"{diagram_case}.svg"
    diagram = DIAGRAMS[diagram_case]()
    actual = _render_diagram(diagram)

    if request.config.getoption("--update-golden", default=False):
        GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
        golden_path.write_text(actual, encoding="utf-8")
        pytest.skip("Golden file updated")
        return

    if not golden_path.exists():
        GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
        golden_path.write_text(actual, encoding="utf-8")
        pytest.skip(f"Golden file created: {golden_path.name}")
        return

    expected = golden_path.read_text(encoding="utf-8")
    assert actual == expected, (
        f"SVG output differs from golden file {golden_path.name}.\n"
        f"Run with --update-golden to accept changes."
    )


def conftest_hook():
    """Provide --update-golden CLI option."""
    pass


def pytest_addoption(parser):
    parser.addoption(
        "--update-golden",
        action="store_true",
        default=False,
        help="Update SVG golden files instead of comparing.",
    )
