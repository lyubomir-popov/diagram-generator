from __future__ import annotations

import copy
import math
import pathlib
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "assets" / "icons"
OUTPUT_DIR = ROOT / "diagrams" / "2.output"
SVG_DIR = OUTPUT_DIR / "svg"
DRAWIO_DIR = OUTPUT_DIR / "draw.io"

BLACK = "#000000"
WHITE = "#FFFFFF"
GREY = "#F3F3F3"
HELPER = "#666666"
ORANGE = "#E95420"

BASELINE_UNIT = 4
RHYTHM_STEP = 8
GRID_GUTTER = 24
OUTER_MARGIN = 32

BLOCK_WIDTH = 192
ICON_SIZE = 48
INSET = 8
BOX_MIN_HEIGHT = ICON_SIZE + (INSET * 2)

BODY_SIZE = "14"
HEADING_SIZE = "18"
TITLE_SIZE = "24"

BODY_LINE_STEP = 20
HEADING_LINE_STEP = 24
TITLE_LINE_STEP = 32

LINE_HEIGHTS_BY_SIZE = {
    6: 8,
    7: 8,
    8: 8,
    9: 12,
    10: 12,
    12: 16,
    14: 20,
    16: 24,
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

MATRIX_SIZE = 48
MATRIX_HEADER_HEIGHT = 20
MATRIX_LABEL_SIZE = "12"
MATRIX_COLUMN_DIVIDERS = (16, 32)
MATRIX_ROW_DIVIDERS = (29, 38)

ARROW_HEAD_LENGTH = 10.8408
ARROW_HEAD_HALF_WIDTH = 2.9053


def fmt(value: float) -> str:
    if abs(value - round(value)) < 1e-6:
        return str(int(round(value)))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def load_icon(name: str, fill: str = BLACK) -> str:
    root = ET.parse(ICON_DIR / name).getroot()
    cloned_children: list[str] = []
    for child in root:
        clone = copy.deepcopy(child)
        for node in clone.iter():
            for attr_name, attr_value in list(node.attrib.items()):
                if attr_name in {"fill", "stroke"} and attr_value.lower() in {
                    "black",
                    "#000",
                    "#000000",
                    "currentcolor",
                }:
                    node.set(attr_name, fill)
        raw = ET.tostring(clone, encoding="unicode")
        raw = raw.replace(' xmlns:ns0="http://www.w3.org/2000/svg"', "")
        raw = raw.replace("<ns0:", "<")
        raw = raw.replace("</ns0:", "</")
        cloned_children.append(raw)
    return "\n".join(cloned_children)


def make_line(
    content: str,
    *,
    size: str = BODY_SIZE,
    weight: str = "400",
    fill: str = BLACK,
    small_caps: bool = False,
    line_step: int | None = None,
) -> dict[str, object]:
    return {
        "content": content,
        "size": size,
        "weight": weight,
        "fill": fill,
        "small_caps": small_caps,
        "line_step": line_step or default_line_step(size),
    }


def size_to_px(value: str | int | float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    stripped = value.strip().lower()
    if stripped.endswith("px") or stripped.endswith("pt"):
        return float(stripped[:-2])
    return float(stripped)


def default_line_step(value: str | int | float) -> int:
    size_px = int(round(size_to_px(value)))
    if size_px in LINE_HEIGHTS_BY_SIZE:
        return LINE_HEIGHTS_BY_SIZE[size_px]
    for candidate in SORTED_LINE_HEIGHT_SIZES:
        if size_px <= candidate:
            return LINE_HEIGHTS_BY_SIZE[candidate]
    return round_up_to_grid(size_px * 1.1, BASELINE_UNIT)


def round_up_to_grid(value: float, step: int = BASELINE_UNIT) -> int:
    if step <= 0:
        raise ValueError("Grid step must be greater than zero.")
    return int(math.ceil(value / step) * step)


def line_top_to_baseline(top_y: float, size: str | int | float) -> float:
    return top_y + size_to_px(size) * ASCENT_RATIO


def centered_band_text_top(band_height: float, size: str | int | float) -> float:
    text_height = size_to_px(size) * (ASCENT_RATIO + DESCENT_RATIO)
    return max(0.0, (band_height - text_height) / 2)


def stack_required_height(
    lines: list[dict[str, object]],
    *,
    top_pad: int = 0,
    bottom_pad: int = 0,
    min_height: int = 0,
) -> int:
    if not lines:
        return min_height
    current_top = float(top_pad)
    max_bottom = 0.0
    for spec in lines:
        size_px = size_to_px(spec["size"])
        max_bottom = max(max_bottom, current_top + size_px * (ASCENT_RATIO + DESCENT_RATIO))
        current_top += int(spec["line_step"])
    return max(min_height, round_up_to_grid(max_bottom + bottom_pad))


def lines_required_height(lines: list[dict[str, object]]) -> int:
    return stack_required_height(lines, top_pad=INSET, bottom_pad=INSET, min_height=BOX_MIN_HEIGHT)


def icon_column_width() -> int:
    return ICON_SIZE + (INSET * 2)


def box_text_width(width: float, *, has_icon: bool) -> float:
    return width - (INSET * 2) - (icon_column_width() if has_icon else 0)