"""Frame-based layout model.

A diagram is a tree of Frames. Each Frame is an auto-layout container
(like Figma's auto-layout) that positions its children sequentially with
a consistent gap between their rendered edges.

Layout is a two-pass tree walk:
  1. Measure (bottom-up): compute each node's natural size from content.
  2. Place (top-down): distribute space to children, assign positions.

This replaces the old grid-based layout with its outset hack.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto

from diagram_model import Line, Fill, Border


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Direction(Enum):
    HORIZONTAL = auto()
    VERTICAL = auto()


class Sizing(Enum):
    HUG = auto()       # shrink-wrap to content
    FILL = auto()      # expand to share remaining space equally with peers
    FIXED = auto()     # use explicit width/height


class Align(Enum):
    """Content alignment within a frame (Figma 9-point model).

    Combines main-axis and cross-axis positions.
    """
    TOP_LEFT = auto()
    TOP_CENTER = auto()
    TOP_RIGHT = auto()
    CENTER_LEFT = auto()
    CENTER = auto()
    CENTER_RIGHT = auto()
    BOTTOM_LEFT = auto()
    BOTTOM_CENTER = auto()
    BOTTOM_RIGHT = auto()


# ---------------------------------------------------------------------------
# Frame node
# ---------------------------------------------------------------------------

@dataclass
class Frame:
    """A layout node — either a container (has children) or a leaf (has label).

    When children is non-empty, this is a container that lays out its
    children according to direction/gap/padding.
    When children is empty, this is a leaf box with text/icon content.
    """
    id: str = ""

    # ── Layout properties ──
    direction: Direction = Direction.VERTICAL
    gap: int = 24               # px between rendered child edges
    padding: int = 8            # px inside this frame (all sides)
    sizing: Sizing = Sizing.HUG  # how this node sizes itself
    child_sizing: Sizing = Sizing.HUG  # how parent should size this child
    align: Align = Align.TOP_LEFT  # content alignment (Figma 9-point)
    width: int | None = None    # explicit width (when sizing=FIXED or constraint)
    height: int | None = None   # explicit height

    # ── Appearance ──
    fill: Fill = Fill.WHITE
    border: Border = Border.SOLID
    heading: Line | None = None
    icon: str | None = None
    icon_fill: str | None = None

    # ── Content (leaf) ──
    label: list[Line] = field(default_factory=list)

    # ── Children (container) ──
    children: list[Frame] = field(default_factory=list)

    # ── Computed during layout (not user-set) ──
    _measured_w: float = field(default=0, init=False, repr=False)
    _measured_h: float = field(default=0, init=False, repr=False)
    _placed_x: float = field(default=0, init=False, repr=False)
    _placed_y: float = field(default=0, init=False, repr=False)
    _placed_w: float = field(default=0, init=False, repr=False)
    _placed_h: float = field(default=0, init=False, repr=False)

    @property
    def is_leaf(self) -> bool:
        return len(self.children) == 0

    @property
    def is_container(self) -> bool:
        return len(self.children) > 0


# ---------------------------------------------------------------------------
# Diagram root (Frame + arrows + metadata)
# ---------------------------------------------------------------------------

@dataclass
class FrameDiagram:
    """Root of a diagram: a Frame tree plus connectors and metadata."""
    title: str = ""
    root: Frame = field(default_factory=Frame)
    arrows: list = field(default_factory=list)  # list of Arrow from diagram_model
