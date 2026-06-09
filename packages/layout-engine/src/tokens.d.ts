/**
 * Design tokens — TypeScript port of diagram_shared.py constants.
 *
 * These are the spatial constants that govern the layout grid.
 * Values must match the Python originals exactly.
 */
/** Grid snap unit in pixels. Intrinsic and authored sizes use this step; explicit FILL allocation may remain continuous. */
export declare const BASELINE_UNIT = 8;
/** Set the active grid step for the current layout pass. */
export declare function setActiveGridStep(step: number): void;
/** Get the active grid step. */
export declare function getActiveGridStep(): number;
/** Default typographic measure (Bringhurst ~45–75ch; canonical 66). */
export declare const DEFAULT_MAX_WIDTH_CHARS = 66;
/** Explicit opt-out: no character-based wrap cap (unbounded HUG line). */
export declare const NO_WRAP_MAX_WIDTH_CHARS = 0;
/** Default component (box) width in pixels. Not a HUG floor – HUG boxes shrink to content. */
export declare const BLOCK_WIDTH = 192;
/** Icon dimension in pixels. */
export declare const ICON_SIZE = 48;
/** Internal padding (inset) in pixels. */
export declare const INSET = 8;
/** Canonical gutter between layout columns and rows. */
export declare const GRID_GUTTER = 24;
/** Arrow head length in pixels. Frozen-sample — measured from initial SVG arrowhead. DIAGRAM.md: arrowHeadLength */
export declare const ARROW_HEAD_LENGTH = 10.8408;
/** Arrow head half-width in pixels. Frozen-sample — measured from initial SVG arrowhead. DIAGRAM.md: arrowHeadHalfWidth */
export declare const ARROW_HEAD_HALF_WIDTH = 2.9053;
/** Default arrow shaft and head color. */
export declare const ARROW_COLOR = "#E95420";
/** Frame border stroke width (leaf/panel/section/highlight). DIAGRAM.md: spacing.frame-stroke-width */
export declare const DEFAULT_FRAME_STROKE_WIDTH = 1;
/** Minimum box height = ICON_SIZE + 2 * INSET. */
export declare const BOX_MIN_HEIGHT = 64;
/** Default body text line step (vertical spacing per line). */
export declare const BODY_LINE_STEP = 24;
/** Default body text size. */
export declare const BODY_SIZE = 18;
/**
 * Line-height lookup by font size (matches Python LINE_HEIGHTS_BY_SIZE).
 * Maps font size → line step in pixels.
 */
export declare const LINE_HEIGHTS_BY_SIZE: Record<number, number>;
/** Get the default line step for a given font size. */
export declare function defaultLineStep(size: number): number;
/** Snap a value UP to the nearest grid-step multiple. */
export declare function roundUpToGrid(value: number, step?: number): number;
/** Convert size strings ("18px", "18pt", "18") to numeric pixel values. */
export declare function sizeToPx(value: string | number): number;
/**
 * Compute height from stacked line-step allotments.
 *
 * Uses the line-step model (predefined heights per font size), not glyph bounds.
 */
export declare function steppedLinesHeight(lines: ReadonlyArray<{
    readonly lineStep?: number;
    readonly size?: string | number;
}>, opts?: {
    topPad?: number;
    bottomPad?: number;
    minHeight?: number;
}): number;
/** Clamp value to [min, max], grid-aligning the result. */
export declare function clampToConstraints(value: number, minVal: number | undefined, maxVal: number | undefined): number;
//# sourceMappingURL=tokens.d.ts.map