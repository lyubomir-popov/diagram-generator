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
from frame_model import Align, Direction, Frame, FrameDiagram, Justify, Sizing
from diagram_shared import ICON_SIZE, INSET

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
_JUSTIFY = {
    "packed": Justify.PACKED, "space-between": Justify.SPACE_BETWEEN,
    "space-around": Justify.SPACE_AROUND, "space-evenly": Justify.SPACE_EVENLY,
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
    heading_line = None
    if "heading" in data:
        h = data["heading"]
        heading_line = Line(h, weight="700") if isinstance(h, str) else _parse_line(h)

    # Sensible defaults differ for leaf vs container
    default_border = Border.NONE if is_container else Border.SOLID
    default_gap = 24 if is_container else 0
    border = _BORDER.get(data.get("border", ""), default_border)

    # Per-axis sizing: uniform `sizing` as base, then per-axis overrides.
    # Root defaults to HUG/HUG — there is no parent to FILL into. Use
    # explicit ``sizing: fixed`` with a ``width`` for fixed-canvas layouts.
    # Non-root children default to FILL width (stretch to parent) and HUG
    # height (wrap content). Borderless annotations that should hug their
    # text must opt into ``sizing_w: hug`` explicitly.
    if "sizing" in data:
        uniform_sizing = _SIZING.get(data.get("sizing", "fill"), Sizing.FILL)
        sizing_w = _SIZING.get(data.get("sizing_w"), None) or uniform_sizing
        sizing_h = _SIZING.get(data.get("sizing_h"), None) or uniform_sizing
    else:
        if is_root:
            default_sizing_w = Sizing.HUG
            default_sizing_h = Sizing.HUG
        else:
            default_sizing_w = Sizing.FILL
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

    frame = Frame(
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
        fill_weight=float(data.get("fill_weight", 1)),
        align=_ALIGN.get(data.get("align", "top-left"), Align.TOP_LEFT),
        justify=_JUSTIFY.get(data.get("justify", "packed"), Justify.PACKED),
        wrap=bool(data.get("wrap", False)),
        width=int(data["width"]) if "width" in data else None,
        height=int(data["height"]) if "height" in data else None,
        min_width=int(data["min_width"]) if "min_width" in data else None,
        max_width=int(data["max_width"]) if "max_width" in data else None,
        min_height=int(data["min_height"]) if "min_height" in data else None,
        max_height=int(data["max_height"]) if "max_height" in data else None,
        fill=_FILL.get(data.get("fill", "white"), Fill.WHITE),
        border=border,
        heading=None,
        icon=data.get("icon") if not heading_line else None,
        icon_fill=data.get("icon_fill"),
        label=label,
        role=data.get("role", ""),
        children=children,
        position_type=data.get("position", "AUTO").upper(),
        x=int(data["x"]) if "x" in data else 0,
        y=int(data["y"]) if "y" in data else 0,
    )

    # ── Phase 2: Heading as child ──
    # Convert `heading:` from a magic field to a synthetic first child with
    # role="heading".  For horizontal containers the existing children are
    # wrapped in a ``__body`` sub-frame so the heading spans the full width.
    if heading_line and frame.is_container:
        heading_child = Frame(
            id=f"{frame.id}__heading" if frame.id else "__heading",
            role="heading",
            sizing_w=Sizing.FILL,
            sizing_h=Sizing.HUG,
            min_height=ICON_SIZE + INSET,
            border=Border.NONE,
            padding=INSET,
            label=[heading_line],
            icon=data.get("icon"),
            icon_fill=data.get("icon_fill"),
        )
        if frame.direction == Direction.HORIZONTAL:
            # Wrap original children in a body sub-frame that preserves the
            # horizontal direction, gap, align, and justify of the original.
            body = Frame(
                id=f"{frame.id}__body" if frame.id else "__body",
                direction=Direction.HORIZONTAL,
                gap=frame.gap,
                align=frame.align,
                justify=frame.justify,
                sizing_w=Sizing.FILL,
                sizing_h=Sizing.HUG,
                border=Border.NONE,
                padding=0,
                children=list(frame.children),
            )
            frame.children = [heading_child, body]
            frame.direction = Direction.VERTICAL
        else:
            frame.children = [heading_child] + list(frame.children)
        # Icon moved to heading child; clear from parent
        frame.icon = None

    return frame


def _parse_arrow(data: dict) -> Arrow:
    """Parse an arrow from YAML."""
    return Arrow(
        source=data.get("source", ""),
        target=data.get("target", ""),
        label=data.get("label"),
    )


# Allowed meta field values (from docs/diagram-schema.json)
_META_ENUMS: dict[str, set[str]] = {
    "diagram_type": {
        "system_architecture", "infrastructure_and_network_topology",
        "layered_stack", "interaction_and_sequence",
        "process_and_workflow", "data_flow_and_integration",
        "state_and_lifecycle", "data_model_and_relationships",
    },
    "abstraction_level": {"context", "container", "component", "code"},
    "layout_engine": {
        "elk-layered", "elk-force", "vertical-stack",
        "sequence", "state-machine", "grid-matrix",
    },
    "presentation_form": {"matrix", "swimlane", "tree"},
}


def _validate_meta(meta: dict, source: str) -> None:
    """Warn on unknown meta field names or values."""
    import warnings
    for key, value in meta.items():
        if key not in _META_ENUMS:
            warnings.warn(f"{source}: unknown meta field '{key}'")
        elif value not in _META_ENUMS[key]:
            warnings.warn(
                f"{source}: meta.{key} = '{value}' is not a recognised value "
                f"(expected one of: {', '.join(sorted(_META_ENUMS[key]))})"
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

    # Ontology metadata (optional)
    meta = data.get("meta", {}) if isinstance(data.get("meta"), dict) else {}
    _validate_meta(meta, str(p))

    return FrameDiagram(
        title=data.get("title", ""),
        root=root,
        arrows=arrows,
        grid_cols=int(grid.get("cols", 2)),
        grid_col_gap=int(grid["col_gap"]) if "col_gap" in grid else None,
        grid_row_gap=int(grid["row_gap"]) if "row_gap" in grid else None,
        grid_outer_margin=int(grid["outer_margin"]) if "outer_margin" in grid else None,
        diagram_type=meta.get("diagram_type"),
        abstraction_level=meta.get("abstraction_level"),
        layout_engine=meta.get("layout_engine"),
        presentation_form=meta.get("presentation_form"),
    )


def is_frame_yaml(path: str | pathlib.Path) -> bool:
    """Check if a YAML file is a native frame definition (has engine: v3)."""
    try:
        p = pathlib.Path(path)
        data = yaml.safe_load(p.read_text(encoding="utf-8"))
        return isinstance(data, dict) and data.get("engine") == "v3"
    except Exception:
        return False
