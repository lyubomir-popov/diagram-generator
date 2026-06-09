/**
 * Brockman-style grid overlay metadata — port of layout_v3._build_grid_info.
 */
import { BASELINE_UNIT } from './tokens.js';
export function buildGridInfo(diagram, root) {
    const cols = Math.max(1, diagram.gridCols || 2);
    const colGap = diagram.gridColGap ?? root.gap;
    const rowGap = diagram.gridRowGap ?? root.gap;
    const outerMargin = diagram.gridOuterMargin ??
        (root.paddingTop ?? root.padding ?? 0);
    const svgW = root._layout.placedW;
    const svgH = root._layout.placedH;
    const contentW = Math.max(0, svgW - 2 * outerMargin);
    const contentH = Math.max(0, svgH - 2 * outerMargin);
    const colWRaw = cols > 1 ? (contentW - (cols - 1) * colGap) / cols : contentW;
    const colW = colWRaw >= BASELINE_UNIT
        ? Math.floor(colWRaw / BASELINE_UNIT) * BASELINE_UNIT
        : Math.max(BASELINE_UNIT, Math.floor(colWRaw));
    const colXs = Array.from({ length: cols }, (_, c) => outerMargin + c * (colW + colGap));
    const lastColW = cols > 1 ? Math.max(colW, contentW - (cols - 1) * (colW + colGap)) : contentW;
    const colWidths = cols > 1 ? [...Array(cols - 1).fill(colW), lastColW] : [contentW];
    const resolvedRightMargin = colXs.length
        ? svgW - (colXs[colXs.length - 1] + colWidths[colWidths.length - 1])
        : outerMargin;
    const rowGapSnapped = Math.floor(Math.max(0, rowGap) / BASELINE_UNIT) * BASELINE_UNIT;
    let rowCount = 1;
    let rowH = contentH > 0 ? Math.floor(contentH / BASELINE_UNIT) * BASELINE_UNIT : 0;
    if (rowH > 0) {
        const targetRowH = Math.max(BASELINE_UNIT * 10, 80);
        rowCount = Math.max(1, Math.floor((contentH + rowGapSnapped) / (targetRowH + rowGapSnapped)));
        const available = Math.max(0, contentH - rowGapSnapped * Math.max(0, rowCount - 1));
        const maxRowH = rowCount > 0
            ? Math.floor(available / rowCount / BASELINE_UNIT) * BASELINE_UNIT
            : 0;
        rowH = Math.max(BASELINE_UNIT, maxRowH);
    }
    const rowYs = Array.from({ length: rowCount }, (_, r) => outerMargin + r * (rowH + rowGapSnapped));
    const rowHeights = Array(rowCount).fill(rowH);
    const resolvedBottomMargin = rowYs.length
        ? svgH - (rowYs[rowYs.length - 1] + rowH)
        : svgH - outerMargin;
    return {
        col_xs: colXs,
        col_widths: colWidths,
        row_ys: rowYs,
        row_heights: rowHeights,
        col_gap: colGap,
        row_gap: rowGapSnapped,
        outer_margin: outerMargin,
        resolved_bottom_margin: Math.max(0, Math.round(resolvedBottomMargin)),
        resolved_right_margin: Math.max(0, Math.round(resolvedRightMargin)),
        baseline_step: BASELINE_UNIT,
    };
}
//# sourceMappingURL=grid-info.js.map