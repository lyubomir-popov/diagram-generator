"""Adapter: convert existing Diagram model objects to Frame trees.

This allows all 25 existing diagram definitions to run through the
Frame-based layout engine without rewriting their definitions.
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Bar,
    Border,
    Box,
    Diagram,
    Fill,
    IconCluster,
    JaggedPanel,
    Legend,
    Line,
    MatrixWidget,
    Panel,
    Separator,
    Terminal,
)
from frame_model import Direction, Frame, FrameDiagram, Sizing


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------

def _border(component) -> Border:
    return getattr(component, "border", Border.SOLID)


def _fill(component) -> Fill:
    return getattr(component, "fill", Fill.WHITE)


def _label(component) -> list[Line]:
    return getattr(component, "label", [])


def _icon(component) -> str | None:
    return getattr(component, "icon", None)


def _icon_fill(component) -> str | None:
    return getattr(component, "icon_fill", None)


# ---------------------------------------------------------------------------
# Component → Frame conversion
# ---------------------------------------------------------------------------

def _box_to_frame(box: Box) -> Frame:
    """Convert a Box to a leaf Frame."""
    return Frame(
        id=box.id,
        border=_border(box),
        fill=_fill(box),
        label=_label(box),
        icon=_icon(box),
        icon_fill=_icon_fill(box),
        width=getattr(box, "width", None),
        height=getattr(box, "height", None),
        padding=8,
    )


def _panel_to_frame(panel: Panel, col_width: int | None = None) -> Frame:
    """Convert a Panel to a container Frame with child Frames."""
    children: list[Frame] = []
    for child in panel.children:
        if isinstance(child, Box):
            children.append(_box_to_frame(child))
        elif isinstance(child, Panel):
            children.append(_panel_to_frame(child, col_width=panel.col_width))
        # Other child types (Separator, etc.) could be added here

    # Panel direction: if cols > 1, horizontal grid-like; else vertical
    cols = panel.cols or 1
    if cols > 1:
        direction = Direction.HORIZONTAL
    else:
        direction = Direction.VERTICAL

    gap = panel.row_gap if panel.row_gap else 8

    heading = None
    if panel.heading:
        heading = panel.heading if isinstance(panel.heading, Line) else Line(panel.heading)

    frame = Frame(
        id=panel.id,
        direction=direction,
        gap=gap,
        padding=8,
        border=_border(panel),
        fill=_fill(panel),
        heading=heading,
        icon=_icon(panel),
        icon_fill=_icon_fill(panel),
        children=children,
        width=col_width or panel.col_width,
    )
    return frame


# ---------------------------------------------------------------------------
# Diagram → FrameDiagram
# ---------------------------------------------------------------------------

def diagram_to_frame(diagram: Diagram) -> FrameDiagram:
    """Convert an existing Diagram model to a FrameDiagram.

    Handles:
    - GRID arrangement: top-level grid of components
    - VERTICAL arrangement: single column stack
    - HORIZONTAL arrangement: single row
    """
    # Collect arrows separately
    arrows = [c for c in diagram.components if isinstance(c, Arrow)]
    components = [c for c in diagram.components if not isinstance(c, Arrow)]

    # Determine root direction
    if diagram.arrangement == Diagram.Arrangement.GRID:
        # Build a grid of columns
        direction = Direction.HORIZONTAL
        gap = diagram.col_gap if diagram.col_gap else 24
    elif diagram.arrangement == Diagram.Arrangement.HORIZONTAL:
        direction = Direction.HORIZONTAL
        gap = diagram.col_gap if diagram.col_gap else 24
    else:  # VERTICAL
        direction = Direction.VERTICAL
        gap = diagram.row_gap if diagram.row_gap else 24

    # For GRID arrangement, arrange components into columns
    if diagram.arrangement == Diagram.Arrangement.GRID:
        children = _grid_to_columns(components, diagram)
    else:
        children = _flat_to_frames(components, diagram)

    root = Frame(
        id="__root__",
        direction=direction,
        gap=gap,
        padding=diagram.outer_margin or 24,
        border=Border.NONE,
        fill=Fill.WHITE,
        children=children,
    )

    return FrameDiagram(
        title=diagram.title or "",
        root=root,
        arrows=arrows,
    )


def _grid_to_columns(components: list, diagram: Diagram) -> list[Frame]:
    """Organize grid components into column Frames.

    Groups components by their `col` attribute into vertical column Frames,
    then within each column places them vertically by `row`.
    """
    cols: int = diagram.cols or 1
    col_map: dict[int, list] = {i: [] for i in range(cols)}

    for comp in components:
        c = getattr(comp, "col", 0) or 0
        if c not in col_map:
            col_map[c] = []
        col_map[c].append(comp)

    # Sort each column by row
    for col_list in col_map.values():
        col_list.sort(key=lambda x: getattr(x, "row", 0) or 0)

    # Build column Frames
    col_frames: list[Frame] = []
    row_gap = diagram.row_gap or 24
    col_width = diagram.col_width or 192

    for col_idx in range(cols):
        col_children = []
        for comp in col_map.get(col_idx, []):
            frame = _component_to_frame(comp, col_width=col_width)
            if frame:
                col_children.append(frame)

        if col_children:
            col_frame = Frame(
                id=f"__col_{col_idx}__",
                direction=Direction.VERTICAL,
                gap=row_gap,
                padding=0,
                border=Border.NONE,
                fill=Fill.WHITE,
                children=col_children,
            )
            col_frames.append(col_frame)

    return col_frames


def _flat_to_frames(components: list, diagram: Diagram) -> list[Frame]:
    """Convert a flat list of components to Frames."""
    col_width = diagram.col_width or 192
    frames = []
    for comp in components:
        frame = _component_to_frame(comp, col_width=col_width)
        if frame:
            frames.append(frame)
    return frames


def _component_to_frame(comp, col_width: int = 192) -> Frame | None:
    """Convert any diagram component to a Frame."""
    if isinstance(comp, Box):
        f = _box_to_frame(comp)
        if not f.width:
            f.width = col_width
        return f
    elif isinstance(comp, Panel):
        f = _panel_to_frame(comp, col_width=col_width)
        if not f.width:
            f.width = col_width
        return f
    elif isinstance(comp, JaggedPanel):
        # Treat as a leaf with special styling (renderer handles jagged edge)
        return Frame(
            id=comp.id,
            border=Border.SOLID,
            fill=Fill.GREY,
            label=_label(comp),
            icon=_icon(comp),
            width=col_width,
            padding=8,
        )
    elif isinstance(comp, IconCluster):
        # Simplified: treat as a leaf placeholder
        return Frame(
            id=comp.id,
            border=Border.NONE,
            fill=Fill.WHITE,
            label=[],
            width=col_width,
            padding=0,
        )
    elif isinstance(comp, Annotation):
        return Frame(
            id=comp.id or f"__ann_{id(comp)}__",
            border=Border.NONE,
            fill=Fill.WHITE,
            label=comp.label if hasattr(comp, "label") else [],
            width=col_width,
            padding=0,
        )
    elif isinstance(comp, Separator):
        # A thin separator line - model as zero-height leaf
        return Frame(
            id=comp.id or f"__sep_{id(comp)}__",
            border=Border.NONE,
            fill=Fill.WHITE,
            label=[],
            width=col_width,
            height=1,
            padding=0,
        )
    else:
        # Unknown component type - skip
        return None
