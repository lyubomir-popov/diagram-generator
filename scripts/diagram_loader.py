"""Load diagram definitions from YAML or JSON files.

Converts a declarative data structure into the typed ``Diagram`` tree
that the layout engine consumes.  This is the agent-friendly entry point:
an agent generates a YAML/JSON file conforming to ``docs/diagram-schema.json``
and the build pipeline renders it without any Python authoring.

Usage::

    from diagram_loader import load_diagram

    diagram = load_diagram("diagrams/my-diagram.yaml")
    result = layout(diagram)
"""

from __future__ import annotations

import json
import pathlib
from typing import Any

try:
    import yaml
    _HAS_YAML = True
except ImportError:
    _HAS_YAML = False

from diagram_model import (
    Annotation,
    Arrow,
    Bar,
    BarSegment,
    Border,
    Box,
    BoxStyle,
    Diagram,
    Fill,
    IconCluster,
    JaggedPanel,
    Legend,
    LegendEntry,
    Line,
    MatrixWidget,
    Panel,
    Separator,
    Terminal,
)


# ---------------------------------------------------------------------------
# Enum lookups
# ---------------------------------------------------------------------------

_FILL_MAP: dict[str, Fill] = {
    "white": Fill.WHITE,
    "grey": Fill.GREY,
    "gray": Fill.GREY,
    "black": Fill.BLACK,
}

_BORDER_MAP: dict[str, Border] = {
    "solid": Border.SOLID,
    "none": Border.NONE,
    "dashed": Border.DASHED,
}

_BOXSTYLE_MAP: dict[str, BoxStyle] = {
    "default": BoxStyle.DEFAULT,
    "accent": BoxStyle.ACCENT,
    "highlight": BoxStyle.HIGHLIGHT,
}

_ARRANGEMENT_MAP: dict[str, Diagram.Arrangement] = {
    "vertical": Diagram.Arrangement.VERTICAL,
    "horizontal": Diagram.Arrangement.HORIZONTAL,
    "grid": Diagram.Arrangement.GRID,
}


# ---------------------------------------------------------------------------
# Converters
# ---------------------------------------------------------------------------

def _parse_line(raw: str | dict[str, Any]) -> Line:
    """Parse a line from a plain string or a dict with overrides."""
    if isinstance(raw, str):
        return Line(content=raw)
    return Line(
        content=raw["text"],
        size=str(raw.get("size", "18")),
        weight=str(raw.get("weight", "400")),
        fill=raw.get("fill", "#000000"),
        small_caps=raw.get("small_caps", False),
        line_step=raw.get("line_step"),
        font_family=raw.get("font_family"),
    )


def _parse_lines(raw: list) -> list[Line]:
    return [_parse_line(r) for r in raw]


def _grid_pos(d: dict[str, Any]) -> dict[str, Any]:
    """Extract grid-position fields common to most components."""
    out: dict[str, Any] = {}
    for key in ("col", "row", "col_span", "row_span", "id"):
        if key in d:
            out[key] = d[key]
    return out


def _parse_bar_segment(d: dict[str, Any]) -> BarSegment:
    kw: dict[str, Any] = {}
    if "width_fraction" in d:
        kw["width_fraction"] = d["width_fraction"]
    if "width_px" in d:
        kw["width_px"] = d["width_px"]
    if "fill" in d:
        kw["fill"] = _FILL_MAP[d["fill"]]
    if "label" in d:
        kw["label"] = _parse_line(d["label"])
    return BarSegment(**kw)


def _parse_component(d: dict[str, Any]) -> Any:
    """Dispatch a component dict to the appropriate dataclass constructor."""
    t = d["type"]

    if t == "box":
        kw = _grid_pos(d)
        kw["label"] = _parse_lines(d["label"])
        if "style" in d:
            kw["style"] = _BOXSTYLE_MAP[d["style"]]
        if "fill" in d:
            kw["fill"] = _FILL_MAP[d["fill"]]
        for key in ("icon", "icon_fill", "width", "height"):
            if key in d:
                kw[key] = d[key]
        if "border" in d:
            kw["border"] = _BORDER_MAP[d["border"]]
        return Box(**kw)

    if t == "panel":
        kw = _grid_pos(d)
        if "heading" in d:
            kw["heading"] = _parse_line(d["heading"])
        if "children" in d:
            kw["children"] = [_parse_component(c) for c in d["children"]]
        for key in ("cols", "rows", "col_width", "col_gap", "row_gap"):
            if key in d:
                kw[key] = d[key]
        if "fill" in d:
            kw["fill"] = _FILL_MAP[d["fill"]]
        if "border" in d:
            kw["border"] = _BORDER_MAP[d["border"]]
        for key in ("icon", "uniform_height", "width"):
            if key in d:
                kw[key] = d[key]
        return Panel(**kw)

    if t == "arrow":
        kw: dict[str, Any] = {
            "source": d["source"],
            "target": d["target"],
        }
        if "id" in d:
            kw["id"] = d["id"]
        if "color" in d:
            kw["color"] = d["color"]
        if "waypoints" in d:
            kw["waypoints"] = [tuple(wp) for wp in d["waypoints"]]
        return Arrow(**kw)

    if t == "bar":
        kw = _grid_pos(d)
        kw["segments"] = [_parse_bar_segment(s) for s in d["segments"]]
        if "height" in d:
            kw["height"] = d["height"]
        return Bar(**kw)

    if t == "terminal":
        kw = _grid_pos(d)
        kw["command"] = d["command"]
        for key in ("width", "font_family"):
            if key in d:
                kw[key] = d[key]
        return Terminal(**kw)

    if t == "annotation":
        kw = _grid_pos(d)
        kw["lines"] = _parse_lines(d["lines"])
        if "fill" in d:
            kw["fill"] = _FILL_MAP[d["fill"]]
        if "border" in d:
            kw["border"] = _BORDER_MAP[d["border"]]
        if "placement" in d:
            kw["placement"] = d["placement"]
        return Annotation(**kw)

    if t == "separator":
        kw = _grid_pos(d)
        if "dash" in d:
            kw["dash"] = d["dash"]
        return Separator(**kw)

    if t == "icon_cluster":
        kw = _grid_pos(d)
        kw["icons"] = d["icons"]
        if "fill" in d:
            kw["fill"] = d["fill"]
        return IconCluster(**kw)

    if t == "matrix_widget":
        kw = _grid_pos(d)
        kw["label"] = d["label"]
        return MatrixWidget(**kw)

    if t == "jagged_panel":
        kw = _grid_pos(d)
        kw["label"] = _parse_lines(d["label"])
        for key in ("width", "height"):
            if key in d:
                kw[key] = d[key]
        return JaggedPanel(**kw)

    if t == "legend":
        kw = _grid_pos(d)
        kw["entries"] = [
            LegendEntry(color=e["color"], label=e["label"])
            for e in d["entries"]
        ]
        return Legend(**kw)

    raise ValueError(f"Unknown component type: {t!r}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_diagram_data(data: dict[str, Any]) -> Diagram:
    """Convert a parsed dict (from YAML or JSON) into a ``Diagram``."""
    kw: dict[str, Any] = {}

    if "title" in data:
        kw["title"] = data["title"]
    if "arrangement" in data:
        kw["arrangement"] = _ARRANGEMENT_MAP[data["arrangement"]]
    for key in ("cols", "col_width", "row_height", "col_gap", "row_gap",
                "outer_margin", "canvas_width", "canvas_height"):
        if key in data:
            kw[key] = data[key]
    if "uniform_rows" in data:
        kw["uniform_rows"] = data["uniform_rows"]

    kw["components"] = [_parse_component(c) for c in data.get("components", [])]
    return Diagram(**kw)


def load_diagram(path: str | pathlib.Path) -> Diagram:
    """Load a diagram definition from a YAML or JSON file."""
    p = pathlib.Path(path)
    text = p.read_text(encoding="utf-8")

    if p.suffix in (".yaml", ".yml"):
        if not _HAS_YAML:
            raise ImportError("PyYAML is required to load YAML definitions: pip install pyyaml")
        data = yaml.safe_load(text)
    elif p.suffix == ".json":
        data = json.loads(text)
    else:
        raise ValueError(f"Unsupported file extension: {p.suffix}")

    return load_diagram_data(data)
