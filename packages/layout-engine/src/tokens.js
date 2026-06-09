/**
 * Design tokens — TypeScript port of diagram_shared.py constants.
 *
 * These are the spatial constants that govern the layout grid.
 * Values must match the Python originals exactly.
 */
/** Grid snap unit in pixels. Intrinsic and authored sizes use this step; explicit FILL allocation may remain continuous. */
export const BASELINE_UNIT = 8;
/**
 * Active grid step for the current layout pass.
 * Set by layoutFrameTree() for the duration of a layout run.
 * Defaults to BASELINE_UNIT for backward compatibility.
 */
let _activeGridStep = BASELINE_UNIT;
/** Set the active grid step for the current layout pass. */
export function setActiveGridStep(step) {
    if (step <= 0)
        throw new Error('Grid step must be greater than zero.');
    _activeGridStep = step;
}
/** Get the active grid step. */
export function getActiveGridStep() {
    return _activeGridStep;
}
/** Default typographic measure (Bringhurst ~45–75ch; canonical 66). */
export const DEFAULT_MAX_WIDTH_CHARS = 66;
/** Explicit opt-out: no character-based wrap cap (unbounded HUG line). */
export const NO_WRAP_MAX_WIDTH_CHARS = 0;
/** Default component (box) width in pixels. Not a HUG floor – HUG boxes shrink to content. */
export const BLOCK_WIDTH = 192;
/** Icon dimension in pixels. */
export const ICON_SIZE = 48;
/** Internal padding (inset) in pixels. */
export const INSET = 8;
/** Canonical gutter between layout columns and rows. */
export const GRID_GUTTER = 24;
/** Arrow head length in pixels. Frozen-sample — measured from initial SVG arrowhead. DIAGRAM.md: arrowHeadLength */
export const ARROW_HEAD_LENGTH = 10.8408;
/** Arrow head half-width in pixels. Frozen-sample — measured from initial SVG arrowhead. DIAGRAM.md: arrowHeadHalfWidth */
export const ARROW_HEAD_HALF_WIDTH = 2.9053;
/** Default arrow shaft and head color. */
export const ARROW_COLOR = '#E95420';
/** Frame border stroke width (leaf/panel/section/highlight). DIAGRAM.md: spacing.frame-stroke-width */
export const DEFAULT_FRAME_STROKE_WIDTH = 1;
/** Minimum box height = ICON_SIZE + 2 * INSET. */
export const BOX_MIN_HEIGHT = 64;
/** Default body text line step (vertical spacing per line). */
export const BODY_LINE_STEP = 24;
/** Default body text size. */
export const BODY_SIZE = 18;
/**
 * Line-height lookup by font size (matches Python LINE_HEIGHTS_BY_SIZE).
 * Maps font size → line step in pixels.
 */
export const LINE_HEIGHTS_BY_SIZE = {
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
};
/** Get the default line step for a given font size. */
export function defaultLineStep(size) {
    // Direct lookup
    if (size in LINE_HEIGHTS_BY_SIZE) {
        return LINE_HEIGHTS_BY_SIZE[size];
    }
    // Nearest smaller size
    const sizes = Object.keys(LINE_HEIGHTS_BY_SIZE).map(Number).sort((a, b) => a - b);
    for (let i = sizes.length - 1; i >= 0; i--) {
        if (sizes[i] <= size) {
            return LINE_HEIGHTS_BY_SIZE[sizes[i]];
        }
    }
    return BODY_LINE_STEP;
}
/** Snap a value UP to the nearest grid-step multiple. */
export function roundUpToGrid(value, step = _activeGridStep) {
    if (step <= 0)
        throw new Error('Grid step must be greater than zero.');
    return Math.ceil(value / step) * step;
}
/** Convert size strings ("18px", "18pt", "18") to numeric pixel values. */
export function sizeToPx(value) {
    if (typeof value === 'number')
        return value;
    const stripped = value.trim().toLowerCase();
    if (stripped.endsWith('px') || stripped.endsWith('pt')) {
        return parseFloat(stripped.slice(0, -2));
    }
    return parseFloat(stripped);
}
/**
 * Compute height from stacked line-step allotments.
 *
 * Uses the line-step model (predefined heights per font size), not glyph bounds.
 */
export function steppedLinesHeight(lines, opts) {
    const topPad = opts?.topPad ?? 0;
    const bottomPad = opts?.bottomPad ?? 0;
    const minHeight = opts?.minHeight ?? 0;
    let total = topPad + bottomPad;
    for (const spec of lines) {
        const step = spec.lineStep ?? defaultLineStep(sizeToPx(spec.size ?? BODY_SIZE));
        total += step;
    }
    return Math.max(minHeight, roundUpToGrid(total));
}
/** Clamp value to [min, max], grid-aligning the result. */
export function clampToConstraints(value, minVal, maxVal) {
    if (minVal !== undefined && value < minVal) {
        value = roundUpToGrid(minVal);
    }
    if (maxVal !== undefined && value > maxVal) {
        value = Math.floor(maxVal / _activeGridStep) * _activeGridStep;
    }
    return value;
}
//# sourceMappingURL=tokens.js.map