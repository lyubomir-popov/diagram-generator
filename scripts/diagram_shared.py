from __future__ import annotations

import copy
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

BLOCK_WIDTH = 192
ICON_SIZE = 48
INSET = 8
BODY_SIZE = "16"
TITLE_SIZE = "24"

BODY_LINE_STEP = 18
TITLE_LINE_STEP = 28

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
        "line_step": line_step or (BODY_LINE_STEP if size == BODY_SIZE else TITLE_LINE_STEP),
    }


def size_to_px(value: str | int | float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    stripped = value.strip().lower()
    if stripped.endswith("px") or stripped.endswith("pt"):
        return float(stripped[:-2])
    return float(stripped)


def round_up_to_grid(value: float, step: int = 8) -> int:
    return int(((value + step - 1) // step) * step)


def line_top_to_baseline(top_y: float, size: str | int | float) -> float:
    return top_y + size_to_px(size) * ASCENT_RATIO


def centered_band_text_top(band_height: float, size: str | int | float) -> float:
    text_height = size_to_px(size) * (ASCENT_RATIO + DESCENT_RATIO)
    return max(0.0, (band_height - text_height) / 2)


def lines_required_height(lines: list[dict[str, object]]) -> int:
    if not lines:
        return 64
    current_top = INSET
    max_bottom = 0.0
    for spec in lines:
        size_px = size_to_px(spec["size"])
        max_bottom = max(max_bottom, current_top + size_px * (ASCENT_RATIO + DESCENT_RATIO))
        current_top += int(spec["line_step"])
    return max(64, round_up_to_grid(max_bottom + INSET))