/**
 * Frame-based two-pass layout engine — TypeScript port of layout_v3.py.
 *
 * Pass 1 — measure(): bottom-up, computes natural size of each Frame.
 * Pass 1.5 — constrained re-measurement: re-wraps text at resolved widths.
 * Pass 2 — place(): top-down, assigns positions and distributes fill space.
 *
 * This is a faithful port. The TS layout engine must produce identical
 * coordinates to the Python engine for the same input.
 */
import { Frame, Align, type CoercedOverride } from './frame-model.js';
import { type TextMeasureAdapter } from './text-measure.js';
/**
 * Distribute available space among FILL children.
 *
 * FILL means "accept whatever space the parent gives me."
 * 1. Try equal split among all FILL children.
 * 2. Clamp at min/max constraints and redistribute.
 * 3. Repeat until stable.
 *
 * Measured content size is NOT a floor — FILL children shrink below
 * their content when the parent is too small. Only explicit min/max
 * constraints act as floor/ceiling. This matches Figma's model.
 *
 * Unconstrained shares stay continuous rather than snapping each child
 * independently to the baseline grid. That keeps explicit FILL siblings
 * visually equal even when the parent span is not divisible by 8.
 */
export declare function distributeFillSpace(available: number, fillMeasured: readonly number[], fillMins?: readonly (number | undefined)[], fillMaxes?: readonly (number | undefined)[], fillWeights?: readonly number[]): number[];
export declare function alignOffset(align: Align, available: number, content: number, axis: 'x' | 'y'): number;
export declare function measure(frame: Frame, adapter: TextMeasureAdapter, isRoot?: boolean): void;
export declare function remeasureWithWidthConstraints(root: Frame, rootW: number, adapter: TextMeasureAdapter, coerced?: Map<string, CoercedOverride>): void;
export declare function place(frame: Frame, x: number, y: number, availableW: number, availableH: number, adapter: TextMeasureAdapter): void;
export interface LayoutOutput {
    width: number;
    height: number;
    coerced: Map<string, CoercedOverride>;
}
/** Options for the layout pipeline. */
export interface LayoutOptions {
    /**
     * Grid snap step in pixels.
     * When set to 1, all snapping is disabled — pure Figma-style autolayout.
     * Defaults to BASELINE_UNIT (8) for backward compatibility.
     */
    gridStep?: number;
    /** Explicit grid column count from diagram YAML (enables col_span resolution). */
    gridCols?: number;
    gridColGap?: number;
    gridOuterMargin?: number;
}
/**
 * Run the full layout pipeline: measure → coerce → remeasure → place.
 *
 * This produces identical coordinates to Python's layout_frame_diagram()
 * for the same input (given the same text measurement adapter).
 */
export declare function layoutFrameTree(root: Frame, adapter: TextMeasureAdapter, options?: LayoutOptions): LayoutOutput;
//# sourceMappingURL=layout.d.ts.map