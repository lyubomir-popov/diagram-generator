"""Text metrics — font loading and text measurement.

Provides build-time text width measurement using the actual Ubuntu Sans
Variable font via fontTools.  This is the Python equivalent of the
Canvas.measureText() adapter in the TypeScript port.
"""

from __future__ import annotations

import pathlib

from fontTools.ttLib import TTFont

from design_tokens import (
    BASELINE_UNIT,
    BODY_SIZE,
    LINE_HEIGHTS_BY_SIZE,
    SORTED_LINE_HEIGHT_SIZES,
    round_up_to_grid,
)


ROOT = pathlib.Path(__file__).resolve().parents[1]

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
            total_units += int(_units_per_em * _SPACE_ADVANCE)
    return total_units * font_size / _units_per_em


def size_to_px(value: str | int | float) -> float:
    """Convert a size value (string like '18' or '18px', or numeric) to float px."""
    if isinstance(value, (int, float)):
        return float(value)
    stripped = value.strip().lower()
    if stripped.endswith("px") or stripped.endswith("pt"):
        return float(stripped[:-2])
    return float(stripped)


def default_line_step(value: str | int | float) -> int:
    """Look up the canonical line height for a given font size."""
    size_px = int(round(size_to_px(value)))
    if size_px in LINE_HEIGHTS_BY_SIZE:
        return LINE_HEIGHTS_BY_SIZE[size_px]
    for candidate in SORTED_LINE_HEIGHT_SIZES:
        if size_px <= candidate:
            return LINE_HEIGHTS_BY_SIZE[candidate]
    return round_up_to_grid(size_px * 1.1, BASELINE_UNIT)


def estimate_line_width(spec: dict[str, object]) -> float:
    """Estimate the rendered width of a single line spec."""
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
