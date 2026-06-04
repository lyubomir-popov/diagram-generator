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
from frame_model import Align, Direction, Frame, FrameDiagram, Justify, Overlay, Sizing
from frame_style_classes import FRAME_CLASS_DEFS, apply_frame_class, apply_highlight_parent_contrast
from diagram_shared import BLACK, GREY, GRID_GUTTER, ICON_SIZE, INSET

# ── Enum maps (lowercase YAML strings → Python enums) ──────────────

_DIRECTION = {"vertical": Direction.VERTICAL, "horizontal": Direction.HORIZONTAL}
_SIZING = {"hug": Sizing.HUG, "fill": Sizing.FILL, "fixed": Sizing.FIXED}
_FILL = {"white": Fill.WHITE, "grey": Fill.GREY, "black": Fill.BLACK}
_BORDER = {"solid": Border.SOLID, "none": Border.NONE, "dashed": Border.DASHED, "dotted": Border.DASHED, "fill": Border.FILL}
_ALIGN = {
    "top-left": Align.TOP_LEFT, "top-center": Align.TOP_CENTER, "top-right": Align.TOP_RIGHT,
    "center-left": Align.CENTER_LEFT, "center": Align.CENTER, "center-right": Align.CENTER_RIGHT,
    "bottom-left": Align.BOTTOM_LEFT, "bottom-center": Align.BOTTOM_CENTER, "bottom-right": Align.BOTTOM_RIGHT,
}
_JUSTIFY = {
    "packed": Justify.PACKED, "space-between": Justify.SPACE_BETWEEN,
    "space-around": Justify.SPACE_AROUND, "space-evenly": Justify.SPACE_EVENLY,
}


# Named text styles.  Use ``style: <name>`` in label-line dicts
# instead of raw ``fill:`` or ``weight:`` overrides.
_LINE_STYLES: dict[str, dict] = {
    "muted": {"fill": "#666666"},
}


def _parse_line(raw) -> Line:
    """Parse a label line from YAML — string or {text, style, ...}.

    Accepts plain strings or dicts.  Dict keys:
      text        — the text content
      style       — named text style (e.g. ``muted``)
      small_caps  — boolean flag

    Raw ``weight:``, ``fill:``, and ``size:`` are not allowed in YAML.
    Use ``heading:`` on the frame for bold, ``style: muted`` for grey,
    and the class system (``level:``, ``variant:``) for everything else.
    """
    if isinstance(raw, str):
        return Line(raw)
    if isinstance(raw, dict):
        kw = {}
        # Named style overrides
        style_name = raw.get("style")
        if style_name:
            style = _LINE_STYLES.get(style_name, {})
            kw.update(style)
        if "small_caps" in raw:
            kw["small_caps"] = raw["small_caps"]
        return Line(raw.get("text", ""), **kw)
    return Line(str(raw))


# ── Variant overlays ────────────────────────────────────────────────
#
# Variants are visual treatments applied to any box (leaf or parent).
# They merge UNDER explicit YAML — explicit keys always win.
#
# The engine already auto-detects leaf vs parent from the presence of
# children and applies the correct defaults (leaf: solid border, white
# fill; parent: no border, grey fill, bold heading).  Variants only
# override color, not structure or font weight.
#
#   highlight  — black fill, white text/icon.  Applies to leaf or parent.
#   annotation — borderless leaf.  Same padding and text as a regular
#                leaf, just no visible border or fill.

_VARIANT_OVERLAYS: dict[str, dict] = {
    "highlight": {
        "fill": "black",
        "icon_fill": "#FFFFFF",
    },
    "annotation": {
        "border": "none",
    },
}


def _apply_variant(data: dict) -> dict:
    """Merge variant overlay under explicit YAML fields.

    Returns a new dict with variant defaults filled in.  Explicit YAML
    keys always take priority over variant values.
    """
    variant = data.get("variant")
    if not variant or variant not in _VARIANT_OVERLAYS:
        return data

    merged = dict(_VARIANT_OVERLAYS[variant])
    merged.update(data)
    return merged


def _parse_frame(data: dict, *, is_root: bool = False) -> Frame:
    """Recursively parse a Frame dict from YAML.

    Variants (``variant: highlight``, ``variant: annotation``) apply
    visual overlays that can be overridden by explicit YAML keys.
    The engine auto-detects leaf vs parent from children.

    Sizing accepts three forms:
      sizing: fill           → sets both sizing_w and sizing_h
      sizing_w: fill         → sets width-axis only
      sizing_h: hug          → sets height-axis only
    Per-axis keys override the uniform ``sizing`` key.

    Padding accepts two forms:
      padding: 8             → sets all four sides
      padding_top/right/bottom/left: N  → per-side overrides
    """
    # Apply variant overlay before parsing
    data = _apply_variant(data)
    children_data = data.get("children", [])
    children = [_parse_frame(c) for c in children_data]
    is_container = len(children) > 0

    # Label: list of strings/dicts → list of Line
    label_raw = data.get("label", [])
    if isinstance(label_raw, str):
        label_raw = [label_raw]
    label = [_parse_line(l) for l in label_raw]

    # Heading: string or dict → Line
    heading_line = None
    if "heading" in data:
        h = data["heading"]
        heading_line = Line(h, weight="700") if isinstance(h, str) else _parse_line(h)

    # Sensible defaults differ for leaf vs container
    default_border = Border.NONE if is_container else Border.SOLID
    # Gap: panels (bordered or headed) use tight INSET spacing;
    # layout wrappers (borderless, headingless) use GRID_GUTTER.
    has_heading = "heading" in data
    border = _BORDER.get(data.get("border", ""), default_border)
    is_panel = (border != Border.NONE) or has_heading
    default_gap = INSET if (is_container and is_panel) else GRID_GUTTER if is_container else 0

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

    # Padding: default is INSET for bordered nodes and containers with headings,
    # 0 for borderless containers without headings (pure layout wrappers).
    default_padding = 0 if (is_container and not is_panel) else INSET
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
        col_span=int(data["col_span"]) if "col_span" in data else None,
        align=_ALIGN.get(data.get("align", "top-left"), Align.TOP_LEFT),
        justify=_JUSTIFY.get(data.get("justify", "packed"), Justify.PACKED),
        wrap=bool(data.get("wrap", False)),
        width=int(data["width"]) if "width" in data else None,
        height=int(data["height"]) if "height" in data else None,
        min_width=int(data["min_width"]) if "min_width" in data else None,
        max_width=int(data["max_width"]) if "max_width" in data else None,
        max_width_chars=int(data["max_width_chars"]) if "max_width_chars" in data else None,
        min_height=int(data["min_height"]) if "min_height" in data else None,
        max_height=int(data["max_height"]) if "max_height" in data else None,
        fill=_FILL.get(data.get("fill", "white"), Fill.WHITE),
        border=border,
        heading=heading_line if not is_container else None,
        icon=data.get("icon") if (not heading_line or not is_container) else None,
        icon_fill=data.get("icon_fill"),
        label=label,
        role=data.get("role", ""),
        level=int(data["level"]) if "level" in data else None,
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
        heading_fill = frame.fill if frame.fill == Fill.BLACK else Fill.WHITE
        heading_icon_fill = data.get("icon_fill")
        if frame.fill == Fill.BLACK and not heading_icon_fill:
            heading_icon_fill = "#FFFFFF"
        heading_child = Frame(
            id=f"{frame.id}__heading" if frame.id else "__heading",
            role="heading",
            sizing_w=Sizing.FILL,
            sizing_h=Sizing.HUG,
            min_height=ICON_SIZE,
            border=Border.NONE,
            fill=heading_fill,
            padding=0,
            label=[heading_line],
            icon=data.get("icon"),
            icon_fill=heading_icon_fill,
        )
        if frame.direction == Direction.HORIZONTAL:
            # Wrap original children in a body sub-frame that preserves the
            # horizontal direction, gap, align, justify, wrap, and
            # fill_weight of the original.
            stack_gap = int(data["stack_gap"]) if "stack_gap" in data else INSET
            body = Frame(
                id=f"{frame.id}__body" if frame.id else "__body",
                direction=Direction.HORIZONTAL,
                gap=stack_gap,
                align=frame.align,
                justify=frame.justify,
                wrap=frame.wrap,
                fill_weight=frame.fill_weight,
                sizing_w=Sizing.FILL,
                sizing_h=Sizing.HUG,
                border=Border.NONE,
                padding=0,
                children=list(frame.children),
            )
            frame.children = [heading_child, body]
            frame.direction = Direction.VERTICAL
        else:
            # Wrap original children in a body sub-frame so the heading is
            # separate from the content group.  This lets justify modes
            # (e.g. space-between) distribute space between heading and
            # content without spreading individual content children apart.
            stack_gap = int(data["stack_gap"]) if "stack_gap" in data else INSET
            body = Frame(
                id=f"{frame.id}__body" if frame.id else "__body",
                direction=Direction.VERTICAL,
                gap=stack_gap,
                align=frame.align,
                justify=frame.justify,
                wrap=frame.wrap,
                fill_weight=frame.fill_weight,
                sizing_w=Sizing.FILL,
                sizing_h=Sizing.HUG,
                border=Border.NONE,
                padding=0,
                children=list(frame.children),
            )
            frame.children = [heading_child, body]
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


def _parse_overlay(data: dict) -> Overlay:
    """Parse an overlay (cross-cutting visual group) from YAML."""
    return Overlay(
        id=data.get("id", ""),
        label=data.get("label", ""),
        members=list(data.get("members", [])),
    )


# Allowed meta field values (from docs/diagram-schema.json)
_META_ENUMS: dict[str, set[str]] = {
    "diagram_type": {
        "system_architecture", "infrastructure_and_network_topology",
        "deployment_and_runtime_topology",
        "layered_stack", "interaction_and_sequence",
        "process_and_workflow", "data_flow_and_integration",
        "state_and_lifecycle", "data_model_and_relationships",
        "concept_and_relationship_mapping", "matrix_and_comparison",
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


# ── Style resolution ────────────────────────────────────────────────
#
# resolve_styles() walks the Frame tree after parsing and sets
# resolved_fill and resolved_stroke based on the level system:
#
#   Level 1 (box):   transparent fill, #000000 stroke  (default for depth 2+)
#   Level 2 (panel): #F3F3F3 fill, #F3F3F3 stroke      (default for depth 1)
#
# Variants override the level-derived style:
#   annotation: transparent fill, transparent stroke
#   highlight:  black fill/stroke with white text/icon overlay
#
# Layout wrappers (__heading, __body) stay transparent / no stroke.


def _compute_level(frame: Frame, depth: int) -> int:
    """Return the effective prominence level for a frame.

    If ``frame.level`` is explicitly set (``level: 2`` in YAML), use it.
    Otherwise apply safe defaults:
      depth 0                              → 0 (root, invisible)
      container without heading            → 0 (layout wrapper, invisible)
      everything else                      → 1 (outlined box)

    Grey panel treatment (level 2) is never guessed from depth or
    structure — it must be opted into via ``level: 2`` in the YAML.
    """
    if frame.level is not None:
        return frame.level
    if depth == 0:
        return 0
    # Headingless containers are layout wrappers — invisible.
    # __body means heading synthesis ran; keep panel chrome when heading text is cleared.
    has_heading_structure = (
        any(c.role == "heading" for c in frame.children)
        or frame.heading is not None
        or any((c.id or "").endswith("__body") for c in frame.children)
    )
    if frame.is_container and not has_heading_structure:
        return 0
    return 1


def resolve_styles(root: Frame, *, _depth: int = 0, _parent_is_panel: bool = False, _parent_is_section: bool = False, _parent_is_highlight: bool = False) -> None:
    """Walk the tree and set resolved_fill / resolved_stroke on every frame.

    Implements the four-class hierarchy from ``docs/frame-classes.md``:
      Section (level 3): bold heading token, transparent, black border
      Panel   (level 2): bold heading, grey fill, grey border
      Leaf    (level 1): regular heading, transparent, black border
      Annotation:        regular lighter-grey text, transparent, no border
    """
    _is_layout_wrapper = "__" in (root.id or "")
    _this_is_panel = False
    _this_is_section = False
    _this_is_highlight = False

    if _depth == 0:
        # Root frame: invisible
        apply_frame_class(root, FRAME_CLASS_DEFS["hidden"])
    elif _is_layout_wrapper:
        # Synthetic __heading / __body frames: transparent
        apply_frame_class(root, FRAME_CLASS_DEFS["hidden"])
        # But __heading with a black-fill parent keeps its fill for contrast
        if root.fill == Fill.BLACK:
            root.resolved_fill = BLACK
        elif root.fill == Fill.WHITE and root.role == "heading":
            root.resolved_fill = "transparent"
    elif root.role == "separator":
        apply_frame_class(root, FRAME_CLASS_DEFS["hidden"])
    else:
        is_highlight = root.fill == Fill.BLACK
        _this_is_highlight = is_highlight
        # Normal frame: resolve from level
        level = _compute_level(root, _depth)

        # Nesting constraints: grey-on-grey has no visible boundary,
        # and section-in-section is not meaningful.
        if level >= 2 and _parent_is_panel:
            level = 1
        if level >= 3 and _parent_is_section:
            level = min(level, 2)

        if level == 0:
            # Level 0: headingless container / layout wrapper — invisible
            apply_frame_class(root, FRAME_CLASS_DEFS["hidden"])
        elif root.border == Border.NONE and not root.is_container and not _is_layout_wrapper:
            # Annotation: borderless leaf — no fill, no stroke
            apply_frame_class(root, FRAME_CLASS_DEFS["annotation"])
        elif level >= 3:
            # Section: small-caps bold heading, transparent fill, black border.
            # Visually wraps panels/leaves with a visible outline.
            apply_frame_class(root, FRAME_CLASS_DEFS["section"])
            _this_is_section = True
        elif level >= 2:
            # Panel: grey fill, grey border (invisible against fill)
            apply_frame_class(root, FRAME_CLASS_DEFS["panel"])
            _this_is_panel = True
        else:
            # Leaf (level 1): outlined box, regular-weight heading
            apply_frame_class(root, FRAME_CLASS_DEFS["leaf"])

        if is_highlight:
            apply_frame_class(root, FRAME_CLASS_DEFS["highlight"])
        elif _parent_is_highlight:
            apply_highlight_parent_contrast(root)

    for child in root.children:
        # Layout wrappers pass through the parent's panel/section status
        if _is_layout_wrapper:
            child_parent_panel = _parent_is_panel
            child_parent_section = _parent_is_section
            child_parent_highlight = _parent_is_highlight
        else:
            child_parent_panel = _this_is_panel
            child_parent_section = _this_is_section
            child_parent_highlight = _parent_is_highlight or _this_is_highlight
        resolve_styles(child, _depth=_depth + 1,
                       _parent_is_panel=child_parent_panel,
                       _parent_is_section=child_parent_section,
                       _parent_is_highlight=child_parent_highlight)


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

    # Resolve visual styles from levels + variants after full tree is built
    resolve_styles(root)

    arrows = [_parse_arrow(a) for a in data.get("arrows", [])]
    overlays = [_parse_overlay(o) for o in data.get("overlays", [])]
    grid = data.get("grid", {}) if isinstance(data.get("grid", {}), dict) else {}

    # Ontology metadata (optional)
    meta = data.get("meta", {}) if isinstance(data.get("meta"), dict) else {}
    _validate_meta(meta, str(p))

    return FrameDiagram(
        title=data.get("title", ""),
        root=root,
        arrows=arrows,
        overlays=overlays,
        grid_cols=int(grid.get("cols", 2)),
        grid_col_gap=int(grid.get("col_gap", GRID_GUTTER)) if grid else None,
        grid_row_gap=int(grid.get("row_gap", GRID_GUTTER)) if grid else None,
        grid_outer_margin=int(grid.get("outer_margin", GRID_GUTTER)) if grid else None,
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
