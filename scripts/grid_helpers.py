"""Grid helpers — layout computation utilities.

Higher-level helpers that compose design tokens and text metrics to
compute grid positions, box heights, and text placement.
"""

from __future__ import annotations

import copy
import pathlib
import xml.etree.ElementTree as ET

from design_tokens import (
    ASCENT_RATIO,
    BASELINE_UNIT,
    BLACK,
    BLOCK_WIDTH,
    BODY_SIZE,
    BOX_MIN_HEIGHT,
    COMPACT_GAP,
    DESCENT_RATIO,
    ICON_SIZE,
    INSET,
    round_up_to_grid,
)
from text_metrics import (
    default_line_step,
    measure_text_width,
    size_to_px,
)


ROOT = pathlib.Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "assets" / "icons"
OUTPUT_DIR = ROOT / "diagrams" / "2.output"
SVG_DIR = OUTPUT_DIR / "svg"
DRAWIO_DIR = OUTPUT_DIR / "draw.io"
LEGACY_OUTPUT_ROOT_SVGS = {"icon-box-48px-prototype.svg"}


def cleanup_legacy_output_root_svgs() -> list[pathlib.Path]:
    """Remove stale root-level SVGs when a canonical svg/ copy exists."""
    removed: list[pathlib.Path] = []
    if not OUTPUT_DIR.exists():
        return removed
    for path in sorted(OUTPUT_DIR.glob("*.svg")):
        if path.name in LEGACY_OUTPUT_ROOT_SVGS:
            path.unlink()
            removed.append(path)
    return removed


def load_icon(name: str, fill: str = BLACK) -> str:
    """Load an SVG icon file and return its inner elements with fill recolored."""
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
    font_family: str | None = None,
) -> dict[str, object]:
    """Create a line spec dictionary."""
    d: dict[str, object] = {
        "content": content,
        "size": size,
        "weight": weight,
        "fill": fill,
        "small_caps": small_caps,
        "line_step": line_step or default_line_step(size),
    }
    if font_family:
        d["font_family"] = font_family
    return d


def make_diagram_line(
    content: str,
    *,
    weight: str = "400",
    fill: str = BLACK,
    small_caps: bool = False,
) -> dict[str, object]:
    """Legacy alias – now identical to make_line()."""
    return make_line(content, weight=weight, fill=fill, small_caps=small_caps)


def terminal_text_top() -> int:
    from design_tokens import TERMINAL_CHROME_HEIGHT
    return TERMINAL_CHROME_HEIGHT + INSET


def terminal_text_box_height(total_height: float = BOX_MIN_HEIGHT) -> float:
    return max(0.0, total_height - terminal_text_top() - INSET)


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


def stepped_lines_height(
    lines: list[dict[str, object]],
    *,
    top_pad: int = 0,
    bottom_pad: int = 0,
    min_height: int = 0,
) -> int:
    """Height from stacked line-step allotments."""
    total = float(top_pad + bottom_pad)
    if lines:
        total += sum(int(spec.get("line_step", default_line_step(spec.get("size", BODY_SIZE)))) for spec in lines)
    return max(min_height, round_up_to_grid(total))


def lines_required_height(lines: list[dict[str, object]]) -> int:
    return stack_required_height(lines, top_pad=INSET, bottom_pad=INSET, min_height=BOX_MIN_HEIGHT)


def equal_split_cell(available: float, count: int, step: int = BASELINE_UNIT) -> int:
    """Compute the snapped cell size when dividing available space equally."""
    if count <= 0:
        return 0
    return int(round(available / count / step) * step)


def span_size(cell_size: int, span: int, gap: int) -> int:
    """Compute the total size of span consecutive cells with gap gutters."""
    if span <= 0:
        return 0
    return span * cell_size + (span - 1) * gap


def tight_box_height(
    lines: list[dict[str, object]],
    *,
    has_icon: bool = False,
) -> int:
    """Compute box height from content using the inside-out model."""
    min_height = INSET + ICON_SIZE + INSET if has_icon else 0
    return stepped_lines_height(lines, top_pad=INSET, bottom_pad=INSET, min_height=min_height)


def panel_grid(
    *,
    cols: int,
    rows: int,
    col_width: int = BLOCK_WIDTH,
    row_heights: list[int] | int | None = None,
    col_gap: int = COMPACT_GAP,
    row_gap: int = COMPACT_GAP,
    heading_height: int = 0,
    heading_gap: int = COMPACT_GAP,
    inset: int = INSET,
) -> dict:
    """Compute panel layout geometry from its content grid."""
    col_xs = [inset + i * (col_width + col_gap) for i in range(cols)]
    panel_width = round_up_to_grid(col_xs[-1] + col_width + inset) if cols else round_up_to_grid(2 * inset)

    if row_heights is None:
        rh = [BOX_MIN_HEIGHT] * rows
    elif isinstance(row_heights, int):
        rh = [row_heights] * rows
    else:
        rh = list(row_heights)
        while len(rh) < rows:
            rh.append(rh[-1] if rh else BOX_MIN_HEIGHT)

    first_row_y = inset + (heading_height + heading_gap if heading_height else 0)
    row_ys: list[int] = []
    y = first_row_y
    for i in range(rows):
        row_ys.append(round_up_to_grid(y))
        y += rh[i] + row_gap
    panel_height = round_up_to_grid(row_ys[-1] + rh[-1] + inset) if rows else round_up_to_grid(first_row_y + inset)

    return {
        "width": panel_width,
        "height": panel_height,
        "col_xs": col_xs,
        "row_ys": row_ys,
    }


def assert_text_fits(
    text_y: float,
    line_count: int,
    line_step: int,
    container_y: float,
    container_height: float,
    inset: int = INSET,
) -> None:
    """Raise if text would overflow its container."""
    text_bottom = text_y + line_count * line_step
    container_bottom = container_y + container_height - inset
    if text_bottom > container_bottom + 0.5:
        raise ValueError(
            f"Text overflows container: text bottom {text_bottom} > "
            f"container bottom {container_bottom} "
            f"(container_y={container_y}, height={container_height}, inset={inset})"
        )


def icon_column_width() -> int:
    return ICON_SIZE + (INSET * 2)


def box_text_width(width: float, *, has_icon: bool) -> float:
    return width - (INSET * 2) - (icon_column_width() if has_icon else 0)
