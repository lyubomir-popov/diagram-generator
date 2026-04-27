"""Declarative diagram data model.

A diagram is a tree of typed components.  This module defines pure data
classes — no rendering, no layout computation, no file I/O.

Component types mirror the patterns identified across existing diagrams:
Box, Panel, Bar, Terminal, Arrow, Helper, Matrix, Legend, MemoryWall,
RequestCluster.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Union


# ---------------------------------------------------------------------------
# Text primitives
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Line:
    """Single line of text inside a component."""
    content: str
    size: str = "18"
    weight: str = "400"
    fill: str = "#000000"
    small_caps: bool = False
    line_step: int | None = None       # override default_line_step
    font_family: str | None = None     # override (e.g. mono)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Fill(Enum):
    WHITE = "#FFFFFF"
    GREY = "#F3F3F3"
    BLACK = "#000000"


class ArrowDirection(Enum):
    DOWN = auto()
    RIGHT = auto()
    UP = auto()
    LEFT = auto()


# ---------------------------------------------------------------------------
# Leaf components
# ---------------------------------------------------------------------------

@dataclass
class Box:
    """Labelled box with optional icon — the foundational building block."""
    label: list[Line]
    fill: Fill = Fill.WHITE
    icon: str | None = None            # filename in assets/icons/
    icon_fill: str | None = None
    width: int | None = None           # override col_width
    height: int | None = None          # override computed height
    borderless: bool = False           # no visible border (invisible box)
    # Grid position (col, row) and span for layout grid placement.
    col: int = 0
    row: int = 0
    id: str = ""
    col_span: int = 1
    row_span: int = 1


@dataclass
class BarSegment:
    """One segment in a segmented bar."""
    width_fraction: float | None = None   # proportion of bar width (0–1)
    width_px: int | None = None           # or fixed pixel width
    fill: Fill = Fill.WHITE
    label: Line | None = None


@dataclass
class Bar:
    """Horizontal segmented memory/allocation bar."""
    segments: list[BarSegment]
    height: int = 32


@dataclass
class Terminal:
    """Command bar with terminal chrome."""
    command: str
    width: int | None = None           # override
    font_family: str | None = None     # override (defaults to mono)
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class IconComponent:
    """Standalone icon (no box border)."""
    icon: str                           # filename in assets/icons/
    fill: str = "#000000"
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class MatrixWidget:
    """QKV-style matrix tile."""
    label: str                          # e.g. "Q", "K", "QK"
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class MemoryWall:
    """Jagged-edge memory wall panel — semantic exception."""
    label: list[Line]
    width: int | None = None
    height: int | None = None
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class RequestCluster:
    """Three-icon cluster (Document, Photography, Globe)."""
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class LegendEntry:
    """Single legend marker + label."""
    color: str
    label: str


@dataclass
class Legend:
    """Horizontal row of circle markers with labels."""
    entries: list[LegendEntry]
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class Helper:
    """Free-standing annotation text."""
    lines: list[Line]
    # Positioning relative to a sibling: "below", "right", "left"
    placement: str = "below"
    id: str = ""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1


@dataclass
class Separator:
    """Horizontal dashed line spanning the grid cell width."""
    col: int = 0
    row: int = 0
    col_span: int = 1
    row_span: int = 1
    id: str = ""
    dash: str = "12 8"


# ---------------------------------------------------------------------------
# Connectors
# ---------------------------------------------------------------------------

@dataclass
class Arrow:
    """Connector between two components.

    Source and target are specified as (component_id, side) where side is
    "top", "bottom", "left", "right" and the arrow anchors at the midpoint
    of that side.  For cell references within a panel, use
    "panel_id.col.row.side".
    """
    source: str
    target: str
    color: str = "#E95420"
    waypoints: list[tuple[float, float]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Container components
# ---------------------------------------------------------------------------

@dataclass
class Panel:
    """Grid of child components with heading and uniform row heights."""
    heading: Line | None = None
    children: list = field(default_factory=list)  # Box | Bar | Terminal | Helper | Panel | ...
    # Grid config
    cols: int = 1
    rows: int | None = None            # auto from children if None
    col_width: int | None = None       # override BLOCK_WIDTH
    col_gap: int | None = None         # override COMPACT_GAP
    row_gap: int | None = None         # override COMPACT_GAP
    # Appearance
    fill: Fill = Fill.WHITE
    dashed: bool = False
    frameless: bool = False            # layout-only container (no border/fill)
    icon: str | None = None            # heading icon
    uniform_height: bool = True        # all rows use tallest box height
    # GRID arrangement: span multiple columns/rows
    col_span: int = 1
    row_span: int = 1
    # Grid position (when Panel is a top-level GRID child)
    col: int = 0
    row: int = 0
    # Identity for arrow references
    id: str = ""


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

Component = Union[
    Box, Panel, Bar, Terminal, Arrow, Helper,
    MatrixWidget, MemoryWall, RequestCluster, Legend,
    IconComponent,
]


@dataclass
class Diagram:
    """Root container — a flat list of positioned top-level components.

    Top-level items are laid out by the layout engine according to
    ``arrangement`` (vertical stack, horizontal row, or explicit grid).
    """

    class Arrangement(Enum):
        VERTICAL = auto()     # stack top-to-bottom
        HORIZONTAL = auto()   # place left-to-right
        GRID = auto()         # explicit col/row on each component

    title: str = ""
    components: list[Component] = field(default_factory=list)
    arrangement: Arrangement = Arrangement.VERTICAL
    # Top-level grid config (used when arrangement == GRID)
    cols: int = 1
    col_width: int | None = None       # grid field width (default BLOCK_WIDTH)
    row_height: int | None = None      # grid field height (default BOX_MIN_HEIGHT)
    col_gap: int | None = None
    row_gap: int | None = None
    outer_margin: int | None = None
