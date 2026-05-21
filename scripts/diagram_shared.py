from __future__ import annotations

import copy
import math
import pathlib
import xml.etree.ElementTree as ET

from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "assets" / "icons"
OUTPUT_DIR = ROOT / "diagrams" / "2.output"
SVG_DIR = OUTPUT_DIR / "svg"
DRAWIO_DIR = OUTPUT_DIR / "draw.io"
LEGACY_OUTPUT_ROOT_SVGS = {"icon-box-48px-prototype.svg"}

# ---------------------------------------------------------------------------
# Font metrics (single load at module init)
# ---------------------------------------------------------------------------

_FONT_PATH = ROOT / "assets" / "UbuntuSans[wdth,wght].ttf"
_font: TTFont | None = None
_cmap: dict[int, str] | None = None
_hmtx: object | None = None
_units_per_em: int = 1000
_SPACE_ADVANCE: float = 0.25  # fallback fraction of em for unknown glyphs


def _ensure_font_loaded() -> None:
    global _font, _cmap, _hmtx, _units_per_em
    if _font is not None:
        return
    _font = TTFont(str(_FONT_PATH))
    _cmap = _font.getBestCmap()
    _hmtx = _font["hmtx"]
    _units_per_em = _font["head"].unitsPerEm


def measure_text_width(text: str, font_size: float) -> float:
    """Measure text width using actual font glyph advance widths.

    Uses the hmtx table from the loaded Ubuntu Sans Variable font.
    This is the single source of truth for text width measurement
    in the build-time pipeline.
    """
    _ensure_font_loaded()
    total_units = 0
    for ch in text:
        glyph_name = _cmap.get(ord(ch))
        if glyph_name and glyph_name in _hmtx.metrics:
            advance, _ = _hmtx.metrics[glyph_name]
            total_units += advance
        else:
            # Fallback: use space advance for unknown characters
            total_units += int(_units_per_em * _SPACE_ADVANCE)
    return total_units * font_size / _units_per_em

BLACK = "#000000"
WHITE = "#FFFFFF"
GREY = "#F3F3F3"
HELPER = "#666666"
ORANGE = "#E95420"

BASELINE_UNIT = 8
GRID_GUTTER = 24          # canonical gutter between components
OUTER_MARGIN = 24

BLOCK_WIDTH = 192
ICON_SIZE = 48
INSET = 8
BOX_MIN_HEIGHT = ICON_SIZE + (INSET * 2)

BODY_SIZE = "18"
HEADING_SIZE = "18"
TITLE_SIZE = "24"

# Legacy alias – kept so existing call sites that reference the pilot name still work.
DIAGRAM_TIER_BODY_SIZE = BODY_SIZE

BODY_LINE_STEP = 24
HEADING_LINE_STEP = 24
TITLE_LINE_STEP = 32
DIAGRAM_TIER_BODY_LINE_STEP = BODY_LINE_STEP

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

def cleanup_legacy_output_root_svgs() -> list[pathlib.Path]:
    """Remove stale root-level SVGs when a canonical svg/ copy exists.

    The canonical output lane is diagrams/2.output/svg/. Older sessions left some
    deliverables and prototypes directly under diagrams/2.output/, which confuses
    humans and tooling that expects a single SVG location.
    """
    removed: list[pathlib.Path] = []
    if not OUTPUT_DIR.exists():
        return removed

    for path in sorted(OUTPUT_DIR.glob("*.svg")):
        if path.name in LEGACY_OUTPUT_ROOT_SVGS:
            path.unlink()
            removed.append(path)
    return removed
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


def terminal_text_top() -> int:
    return TERMINAL_CHROME_HEIGHT + INSET


def terminal_text_box_height(total_height: float = TERMINAL_BAR_HEIGHT) -> float:
    return max(0.0, total_height - terminal_text_top() - INSET)

MATRIX_SIZE = 48
MATRIX_HEADER_HEIGHT = 20
MATRIX_LABEL_SIZE = "12"
MATRIX_COLUMN_DIVIDERS = (16, 32)
MATRIX_ROW_DIVIDERS = (29, 38)

ARROW_HEAD_LENGTH = 10.8408
ARROW_HEAD_HALF_WIDTH = 2.9053

# Arrow clearance tokens — enforce visible shaft between box edges and
# arrowheads so arrows never visually overlap boxes.
#
#   ARROW_CLEARANCE:      minimum visible shaft on the approach to the target
#                         (box edge → arrowhead base).  Must be ≥ head length.
#   MIN_ARROW_SEGMENT:    minimum last-segment length (clearance + head),
#                         snapped to the 8px baseline.
#   ARROW_EXIT_CLEARANCE: minimum first segment leaving the source box
#                         (no arrowhead, just enough to see the shaft depart).
#   ARROW_GAP:            minimum gap between rows/columns where arrows route.
#                         = MIN_ARROW_SEGMENT + ARROW_EXIT_CLEARANCE.
ARROW_CLEARANCE = 8
MIN_ARROW_SEGMENT = 16          # ARROW_CLEARANCE + ceil(ARROW_HEAD_LENGTH) on the 8px baseline
ARROW_EXIT_CLEARANCE = 8
ARROW_GAP = 24                  # MIN_ARROW_SEGMENT + ARROW_EXIT_CLEARANCE


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
    font_family: str | None = None,
) -> dict[str, object]:
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
    """Legacy alias – now identical to make_line() since 16px/20px is the default."""
    return make_line(
        content,
        weight=weight,
        fill=fill,
        small_caps=small_caps,
    )


def estimate_line_width(spec: dict[str, object]) -> float:
    text = str(spec["content"])
    size = size_to_px(spec.get("size", BODY_SIZE))
    width = measure_text_width(text, size)
    if bool(spec.get("small_caps", False)):
        width *= 1.05
    return width


def wrap_text_lines(lines: list[dict[str, object]], max_width: float) -> list[dict[str, object]]:
    """Wrap text lines at word boundaries using real font metrics."""
    if max_width <= 0:
        return [dict(spec) for spec in lines]

    result: list[dict[str, object]] = []
    for spec in lines:
        text = str(spec["content"])
        line_w = estimate_line_width(spec)
        if line_w <= max_width:
            result.append(dict(spec))
            continue

        size = size_to_px(spec.get("size", BODY_SIZE))
        small_caps = bool(spec.get("small_caps", False))

        words = text.split()
        current = ""
        for word in words:
            test = (current + " " + word) if current else word
            test_w = measure_text_width(test, size)
            if small_caps:
                test_w *= 1.05
            if test_w <= max_width or not current:
                current = test
            else:
                result.append({**spec, "content": current})
                current = word
        if current:
            result.append({**spec, "content": current})
        elif not words:
            result.append(dict(spec))
    return result


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


def stepped_lines_height(
    lines: list[dict[str, object]],
    *,
    top_pad: int = 0,
    bottom_pad: int = 0,
    min_height: int = 0,
) -> int:
    """Height from stacked line-step allotments rather than glyph bounds."""
    total = float(top_pad + bottom_pad)
    if lines:
        total += sum(int(spec.get("line_step", default_line_step(spec.get("size", BODY_SIZE)))) for spec in lines)
    return max(min_height, round_up_to_grid(total))


def lines_required_height(lines: list[dict[str, object]]) -> int:
    return stack_required_height(lines, top_pad=INSET, bottom_pad=INSET, min_height=BOX_MIN_HEIGHT)


# ---------------------------------------------------------------------------
# Grid engine – output-agnostic layout computation
# ---------------------------------------------------------------------------

COMPACT_GAP = 8
GROUP_GAP = 16
ROW_GAP = 24


def tight_box_height(
    lines: list[dict[str, object]],
    *,
    has_icon: bool = False,
) -> int:
    """Compute box height from content using the inside-out model.

    Text-only:  INSET + (line_count * line_step) + INSET  →  snapped to the 8px baseline.
    With icon:  max(text_height, INSET + ICON_SIZE + INSET).
    """
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
    """Compute panel layout geometry from its content grid.

    Returns {"width", "height", "col_xs", "row_ys"} – all values on the
    baseline grid.  The panel dimensions are the *output*, never the input.
    """
    col_xs = [inset + i * (col_width + col_gap) for i in range(cols)]
    panel_width = round_up_to_grid(col_xs[-1] + col_width + inset) if cols else round_up_to_grid(2 * inset)

    # Resolve per-row heights
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
    # Panel height = last row bottom + inset
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
    if text_bottom > container_bottom + 0.5:  # 0.5 tolerance for float math
        raise ValueError(
            f"Text overflows container: text bottom {text_bottom} > "
            f"container bottom {container_bottom} "
            f"(container_y={container_y}, height={container_height}, inset={inset})"
        )


def icon_column_width() -> int:
    return ICON_SIZE + (INSET * 2)


def box_text_width(width: float, *, has_icon: bool) -> float:
    return width - (INSET * 2) - (icon_column_width() if has_icon else 0)