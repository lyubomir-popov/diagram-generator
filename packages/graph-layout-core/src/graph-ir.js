/** Canonical graph layout input/output IR (engine-agnostic). */
/** 8px baseline grid — aligns with diagram-generator `BASELINE_UNIT`. */
export const GRID_BASELINE_PX = 8;
export function roundToGrid(value, baseline = GRID_BASELINE_PX) {
    return Math.round(value / baseline) * baseline;
}
//# sourceMappingURL=graph-ir.js.map