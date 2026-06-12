"""Design tokens — colors, sizes, spacing constants, arrow dimensions.

This is the single source of truth for visual constants used across the
diagram generation pipeline.  Corresponds to packages/layout-engine/src/tokens.ts
in the TypeScript port.
"""

from __future__ import annotations

import math

# ── Colors ────────────────────────────────────────────────────────────

BLACK = "#000000"
WHITE = "#FFFFFF"
GREY = "#F3F3F3"
HELPER = "#666666"
ORANGE = "#E95420"

# ── Spacing and sizing ────────────────────────────────────────────────

BASELINE_UNIT = 8
GRID_GUTTER = 24          # canonical gutter between components
OUTER_MARGIN = 24

BLOCK_WIDTH = 192         # default box width; not a HUG floor
ICON_SIZE = 48
INSET = 8
BOX_MIN_HEIGHT = ICON_SIZE + (INSET * 2)

# ── Typography ────────────────────────────────────────────────────────

BODY_SIZE = "18"

BODY_LINE_STEP = 24

LINE_HEIGHTS_BY_SIZE = {
    6: 8,
    7: 8,
    8: 8,
    9: 12,
    10: 12,
    12: 16,
    14: 20,
    16: 20,
    18: 24,
    21: 28,
    24: 32,
    28: 36,
    32: 40,
    36: 44,
    42: 48,
    48: 56,
    55: 64,
    63: 72,
    73: 80,
    84: 92,
    96: 104,
}

SORTED_LINE_HEIGHT_SIZES = tuple(sorted(LINE_HEIGHTS_BY_SIZE))

ASCENT_RATIO = 0.94
DESCENT_RATIO = 0.26

TERMINAL_FONT_FAMILY = "Ubuntu Sans Mono, Ubuntu Mono, monospace"
TERMINAL_CHROME_HEIGHT = 20
TERMINAL_DOT_RADIUS = 4
TERMINAL_BAR_HEIGHT = BOX_MIN_HEIGHT
TERMINAL_DOT_CENTERS = tuple(
    TERMINAL_CHROME_HEIGHT + i * (TERMINAL_DOT_RADIUS * 4)
    for i in range(3)
)

MATRIX_SIZE = 48
MATRIX_HEADER_HEIGHT = 20
MATRIX_LABEL_SIZE = "12"
MATRIX_COLUMN_DIVIDERS = (16, 32)
MATRIX_ROW_DIVIDERS = (29, 38)

# ── Arrow geometry ────────────────────────────────────────────────────

ARROW_HEAD_LENGTH = 10.8408
ARROW_HEAD_HALF_WIDTH = 2.9053

ARROW_CLEARANCE = 8
MIN_ARROW_SEGMENT = 16          # ARROW_CLEARANCE + ceil(ARROW_HEAD_LENGTH) on the 8px baseline
ARROW_EXIT_CLEARANCE = 8
ARROW_GAP = 24                  # MIN_ARROW_SEGMENT + ARROW_EXIT_CLEARANCE

# ── Grid engine gaps ──────────────────────────────────────────────────

COMPACT_GAP = 8
GROUP_GAP = 16
ROW_GAP = 24


# ── Utility ───────────────────────────────────────────────────────────

def round_up_to_grid(value: float, step: int = BASELINE_UNIT) -> int:
    """Round value up to the nearest grid step multiple."""
    if step <= 0:
        raise ValueError("Grid step must be greater than zero.")
    return int(math.ceil(value / step) * step)


def fmt(value: float) -> str:
    """Format a numeric value for SVG output — integer if whole, else trimmed float."""
    if abs(value - round(value)) < 1e-6:
        return str(int(round(value)))
    return f"{value:.4f}".rstrip("0").rstrip(".")
