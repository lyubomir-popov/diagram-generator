"""Load native Frame YAML definitions into FrameDiagram objects.

Native frame YAML has ``engine: v3`` at the top level and defines a
recursive Frame tree directly — no v2 Diagram intermediary.

Usage::

    from frame_loader import load_frame_yaml
    diagram = load_frame_yaml("diagrams/frames/test-vertical-stack.yaml")
"""

from __future__ import annotations

import pathlib
import yaml

from diagram_model import Arrow, Border, Fill, Line
from frame_model import Align, Direction, Frame, FrameDiagram, Sizing

# ── Enum maps (lowercase YAML strings → Python enums) ──────────────

_DIRECTION = {"vertical": Direction.VERTICAL, "horizontal": Direction.HORIZONTAL}
_SIZING = {"hug": Sizing.HUG, "fill": Sizing.FILL, "fixed": Sizing.FIXED}
_FILL = {"white": Fill.WHITE, "grey": Fill.GREY, "black": Fill.BLACK}
_BORDER = {"solid": Border.SOLID, "none": Border.NONE}  # DASHED gated out of YAML; use programmatically only
_ALIGN = {
    "top-left": Align.TOP_LEFT, "top-center": Align.TOP_CENTER, "top-right": Align.TOP_RIGHT,
    "center-left": Align.CENTER_LEFT, "center": Align.CENTER, "center-right": Align.CENTER_RIGHT,
    "bottom-left": Align.BOTTOM_LEFT, "bottom-center": Align.BOTTOM_CENTER, "bottom-right": Align.BOTTOM_RIGHT,
}


def _parse_line(raw) -> Line:
    """Parse a label line from YAML — string or {text, weight, size, ...}."""
    if isinstance(raw, str):
        return Line(raw)
    if isinstance(raw, dict):
        # Only pass keys that are actually present so Line defaults apply
        kw = {}
        if "weight" in raw:
            kw["weight"] = raw["weight"]
        if "size" in raw:
            kw["size"] = raw["size"]
        if "fill" in raw:
            kw["fill"] = raw["fill"]
        if "small_caps" in raw:
            kw["small_caps"] = raw["small_caps"]
        return Line(raw.get("text", ""), **kw)
    return Line(str(raw))


def _parse_frame(data: dict, *, is_root: bool = False) -> Frame:
    """Recursively parse a Frame dict from YAML.

    Sizing accepts three forms:
      sizing: fill           → sets both sizing_w and sizing_h
      sizing_w: fill         → sets width-axis only
      sizing_h: hug          → sets height-axis only
    Per-axis keys override the uniform ``sizing`` key.

    Padding accepts two forms:
      padding: 8             → sets all four sides
      padding_top/right/bottom/left: N  → per-side overrides
    """
    children_data = data.get("children", [])
    children = [_parse_frame(c) for c in children_data]
    is_container = len(children) > 0

    # Label: list of strings/dicts → list of Line
    label_raw = data.get("label", [])
    label = [_parse_line(l) for l in label_raw]

    # Heading: string or dict → Line
    heading = None
    if "heading" in data:
        h = data["heading"]
        heading = Line(h, weight="700") if isinstance(h, str) else _parse_line(h)

    # Sensible defaults differ for leaf vs container
    default_border = Border.NONE if is_container else Border.SOLID
    default_gap = 24 if is_container else 0
    border = _BORDER.get(data.get("border", ""), default_border)

    # Per-axis sizing: uniform `sizing` as base, then per-axis overrides.
    # Root stays FILL/FILL. Otherwise omitted sizing defaults to HUG height
    # so boxes and containers size to content vertically. Width defaults are:
    #   - container or bordered leaf: FILL
    #   - borderless leaf text: HUG
    if "sizing" in data:
        uniform_sizing = _SIZING.get(data.get("sizing", "fill"), Sizing.FILL)
        sizing_w = _SIZING.get(data.get("sizing_w"), None) or uniform_sizing
        sizing_h = _SIZING.get(data.get("sizing_h"), None) or uniform_sizing
    else:
        if is_root:
            default_sizing_w = Sizing.FILL
            default_sizing_h = Sizing.FILL
        else:
            default_sizing_w = Sizing.FILL if (is_container or border != Border.NONE) else Sizing.HUG
            default_sizing_h = Sizing.HUG
        sizing_w = _SIZING.get(data.get("sizing_w"), None) or default_sizing_w
        sizing_h = _SIZING.get(data.get("sizing_h"), None) or default_sizing_h

    # Infer FIXED sizing when an explicit dimension is set but no sizing override
    if "width" in data and "sizing_w" not in data and "sizing" not in data:
        sizing_w = Sizing.FIXED
    if "height" in data and "sizing_h" not in data and "sizing" not in data:
        sizing_h = Sizing.FIXED

    # Padding: default is 8 for bordered nodes, 0 for borderless containers.
    # Borderless wrappers are pure layout groups — padding would misalign
    # their children relative to siblings at the same nesting level.
    default_padding = 0 if (is_container and border == Border.NONE) else 8
    uniform_padding = int(data.get("padding", default_padding))
    pad_t = int(data["padding_top"]) if "padding_top" in data else None
    pad_r = int(data["padding_right"]) if "padding_right" in data else None
    pad_b = int(data["padding_bottom"]) if "padding_bottom" in data else None
    pad_l = int(data["padding_left"]) if "padding_left" in data else None

    return Frame(
        id=data.get("id", ""),
        direction=_DIRECTION.get(data.get("direction", "vertical"), Direction.VERTICAL),
        gap=int(data.get("gap", default_gap)),
        padding=uniform_padding,
        padding_top=pad_t,
        padding_right=pad_r,
        padding_bottom=pad_b,
        padding_left=pad_l,
        sizing_w=sizing_w,
        sizing_h=sizing_h,
        align=_ALIGN.get(data.get("align", "top-left"), Align.TOP_LEFT),
        width=int(data["width"]) if "width" in data else None,
        height=int(data["height"]) if "height" in data else None,
        min_width=int(data["min_width"]) if "min_width" in data else None,
        max_width=int(data["max_width"]) if "max_width" in data else None,
        min_height=int(data["min_height"]) if "min_height" in data else None,
        max_height=int(data["max_height"]) if "max_height" in data else None,
        fill=_FILL.get(data.get("fill", "white"), Fill.WHITE),
        border=border,
        heading=heading,
        icon=data.get("icon"),
        icon_fill=data.get("icon_fill"),
        label=label,
        role=data.get("role", ""),
        children=children,
    )


def _parse_arrow(data: dict) -> Arrow:
    """Parse an arrow from YAML."""
    return Arrow(
        source=data.get("source", ""),
        target=data.get("target", ""),
        label=data.get("label"),
    )


def load_frame_yaml(path: str | pathlib.Path) -> FrameDiagram:
    """Load a native Frame YAML file into a FrameDiagram.

    The file must have ``engine: v3`` at the top level.
    """
    p = pathlib.Path(path)
    data = yaml.safe_load(p.read_text(encoding="utf-8"))

    if data.get("engine") != "v3":
        raise ValueError(f"{p}: not a native frame YAML (missing engine: v3)")

    root_data = data.get("root", {})
    root = _parse_frame(root_data, is_root=True)

    arrows = [_parse_arrow(a) for a in data.get("arrows", [])]
    grid = data.get("grid", {}) if isinstance(data.get("grid", {}), dict) else {}

    return FrameDiagram(
        title=data.get("title", ""),
        root=root,
        arrows=arrows,
        grid_cols=int(grid.get("cols", 2)),
        grid_col_gap=int(grid["col_gap"]) if "col_gap" in grid else None,
        grid_row_gap=int(grid["row_gap"]) if "row_gap" in grid else None,
        grid_outer_margin=int(grid["outer_margin"]) if "outer_margin" in grid else None,
    )


def is_frame_yaml(path: str | pathlib.Path) -> bool:
    """Check if a YAML file is a native frame definition (has engine: v3)."""
    try:
        p = pathlib.Path(path)
        data = yaml.safe_load(p.read_text(encoding="utf-8"))
        return isinstance(data, dict) and data.get("engine") == "v3"
    except Exception:
        return False
