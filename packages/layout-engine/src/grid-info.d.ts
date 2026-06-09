/**
 * Brockman-style grid overlay metadata — port of layout_v3._build_grid_info.
 */
import { Frame, FrameDiagram } from './frame-model.js';
export interface GridInfo {
    col_xs: number[];
    col_widths: number[];
    row_ys: number[];
    row_heights: number[];
    col_gap: number;
    row_gap: number;
    outer_margin: number;
    resolved_bottom_margin: number;
    resolved_right_margin: number;
    baseline_step: number;
}
export declare function buildGridInfo(diagram: FrameDiagram, root: Frame): GridInfo;
//# sourceMappingURL=grid-info.d.ts.map