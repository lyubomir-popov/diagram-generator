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
import { Direction, Sizing, Align, Border, Justify, enforceFillHugInvariant, } from './frame-model.js';
import { BASELINE_UNIT, BLOCK_WIDTH, BOX_MIN_HEIGHT, ICON_SIZE, roundUpToGrid, sizeToPx, steppedLinesHeight, clampToConstraints, setActiveGridStep, getActiveGridStep, } from './tokens.js';
import { estimateLineWidth, wrapTextLines, } from './text-measure.js';
import { effectiveResolvedStrokeWidth } from './frame-classes.js';
import { applyTextLayoutDefaults, resolveLeafTextWrapWidth, } from './text-layout.js';
import { leafIconColumnWidth } from './spatial.js';
import { frameOwnedTextBlocks, frameOwnedTextBlockGap, } from './resolved-spec-typography.js';
function captureSemanticState(frame, state) {
    state.set(frame, {
        width: frame.width,
        height: frame.height,
        sizingW: frame.sizingW,
        sizingH: frame.sizingH,
    });
    for (const child of frame.children) {
        captureSemanticState(child, state);
    }
}
function restoreSemanticState(frame, state) {
    const snap = state.get(frame);
    if (snap) {
        frame.width = snap.width;
        frame.height = snap.height;
        frame.sizingW = snap.sizingW;
        frame.sizingH = snap.sizingH;
    }
    for (const child of frame.children) {
        restoreSemanticState(child, state);
    }
}
function resolveColSpans(frame, colW, colGap) {
    if (frame.colSpan != null && frame.colSpan >= 1) {
        const n = frame.colSpan;
        frame.width = n * colW + Math.max(0, n - 1) * colGap;
        frame.sizingW = Sizing.FIXED;
    }
    for (const child of frame.children) {
        resolveColSpans(child, colW, colGap);
    }
}
function equalizeGridColumns(root) {
    for (const child of root.children) {
        if (child.positionType === 'ABSOLUTE')
            continue;
        if (child.sizingH === Sizing.HUG) {
            child.sizingH = Sizing.FILL;
        }
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function strokeInsetPerSide(frame) {
    return effectiveResolvedStrokeWidth(frame);
}
function strokeSpaceTotal(frame) {
    return strokeInsetPerSide(frame) * 2;
}
function expandRootWidthForSnappedFillColumns(root, requestedW) {
    // When grid step is 1 (no snapping), skip expansion — pure Figma-style layout.
    const step = getActiveGridStep();
    if (step <= 1)
        return requestedW;
    if (requestedW <= 0 || root.isLeaf || root.direction !== Direction.HORIZONTAL)
        return requestedW;
    if (root.justify !== Justify.PACKED)
        return requestedW;
    const fillChildren = root.children.filter((child) => childPrimarySizing(child, root.direction) === Sizing.FILL);
    if (fillChildren.length === 0)
        return requestedW;
    const padL = root.paddingLeft;
    const padR = root.paddingRight;
    const strokeSpace = strokeSpaceTotal(root);
    const totalGap = root.gap * Math.max(0, root.children.length - 1);
    let nonFillTotal = 0;
    for (const child of root.children) {
        if (childPrimarySizing(child, root.direction) === Sizing.FILL)
            continue;
        const childW = child.sizingW === Sizing.FIXED && child.width != null
            ? roundUpToGrid(child.width)
            : roundUpToGrid(child._layout.measuredW);
        nonFillTotal += clampToConstraints(childW, child.minWidth, child.maxWidth);
    }
    const availableForFill = Math.max(0, requestedW - padL - padR - strokeSpace - totalGap - nonFillTotal);
    let snappedShare = fillChildren.length > 0 ? roundUpToGrid(availableForFill / fillChildren.length) : 0;
    const minFillShare = fillChildren.reduce((maxWidth, child) => {
        const childMin = child.minWidth != null ? roundUpToGrid(child.minWidth) : 0;
        return Math.max(maxWidth, childMin);
    }, 0);
    snappedShare = Math.max(snappedShare, minFillShare);
    const compatibleW = padL + padR + strokeSpace + totalGap + nonFillTotal + fillChildren.length * snappedShare;
    return Math.max(requestedW, compatibleW);
}
function leafAllSpecs(frame) {
    return frameOwnedTextBlocks(frame).flat();
}
function wrapLeafTextBlocks(frame, textMaxW, adapter) {
    return frameOwnedTextBlocks(frame)
        .map(block => (textMaxW > 0 ? wrapTextLines(block, textMaxW, adapter) : block))
        .filter(block => block.length > 0);
}
function leafTextHeight(frame, blocks, padT, padB) {
    let total = padT + padB;
    for (const [blockIndex, block] of blocks.entries()) {
        total += steppedLinesHeight(block.map(spec => ({
            lineStep: spec.lineStep != null ? sizeToPx(spec.lineStep) : undefined,
            size: spec.size,
        })), { topPad: 0, bottomPad: 0, minHeight: 0 });
        total += frameOwnedTextBlockGap(frame, blockIndex, blocks.length);
    }
    return roundUpToGrid(total);
}
function leafNaturalSize(frame, adapter, constrainedW) {
    const hasIcon = frame.icon != null;
    const allSpecs = leafAllSpecs(frame);
    const padL = frame.paddingLeft;
    const padR = frame.paddingRight;
    const padT = frame.paddingTop;
    const padB = frame.paddingBottom;
    const iconCol = leafIconColumnWidth(frame);
    let w;
    let h;
    if (allSpecs.length > 0) {
        const textMaxW = resolveLeafTextWrapWidth(frame, adapter, constrainedW);
        const wrappedBlocks = wrapLeafTextBlocks(frame, textMaxW, adapter);
        const wrappedSpecs = wrappedBlocks.flat();
        const textH = leafTextHeight(frame, wrappedBlocks, padT, padB);
        if (frame.border !== Border.NONE) {
            const iconH = padT + ICON_SIZE + padB;
            h = Math.max(textH, iconH);
        }
        else {
            h = textH;
        }
        if (frame.height != null) {
            h = Math.max(h, frame.height);
        }
        if (frame.width != null) {
            w = frame.width;
        }
        else {
            let textW = 0;
            for (const spec of wrappedSpecs) {
                textW = Math.max(textW, estimateLineWidth(spec, adapter));
            }
            w = roundUpToGrid(padL + textW + padR + iconCol);
        }
    }
    else {
        h = frame.height ?? BOX_MIN_HEIGHT;
        w = frame.width ?? BLOCK_WIDTH;
    }
    return [w, h];
}
// ---------------------------------------------------------------------------
// FILL distribution (single source of truth)
// ---------------------------------------------------------------------------
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
export function distributeFillSpace(available, fillMeasured, fillMins, fillMaxes, fillWeights) {
    const n = fillMeasured.length;
    if (n === 0)
        return [];
    const sizes = new Array(n).fill(0);
    let remaining = Math.max(0, available);
    const unclamped = Array.from({ length: n }, (_, i) => i);
    // Effective min/max
    const effMins = new Array(n).fill(0);
    const effMaxes = new Array(n).fill(Infinity);
    const weights = new Array(n).fill(1);
    if (fillMins) {
        for (let i = 0; i < Math.min(n, fillMins.length); i++) {
            if (fillMins[i] != null)
                effMins[i] = fillMins[i];
        }
    }
    if (fillMaxes) {
        for (let i = 0; i < Math.min(n, fillMaxes.length); i++) {
            if (fillMaxes[i] != null)
                effMaxes[i] = fillMaxes[i];
        }
    }
    if (fillWeights) {
        for (let i = 0; i < Math.min(n, fillWeights.length); i++) {
            weights[i] = Math.max(0, fillWeights[i]);
        }
    }
    // Iterative clamping
    while (unclamped.length > 0) {
        const totalWeight = unclamped.reduce((s, i) => s + weights[i], 0);
        let clampedAny = false;
        for (let j = 0; j < unclamped.length; j++) {
            const idx = unclamped[j];
            const share = totalWeight > 0 ? remaining * (weights[idx] / totalWeight) : remaining / unclamped.length;
            if (share < effMins[idx]) {
                sizes[idx] = roundUpToGrid(effMins[idx]);
                remaining -= sizes[idx];
                unclamped.splice(j, 1);
                clampedAny = true;
                break;
            }
            if (share > effMaxes[idx]) {
                const step = getActiveGridStep();
                sizes[idx] = Math.floor(effMaxes[idx] / step) * step;
                remaining -= sizes[idx];
                unclamped.splice(j, 1);
                clampedAny = true;
                break;
            }
        }
        if (!clampedAny) {
            const tw = unclamped.reduce((s, i) => s + weights[i], 0);
            for (let j = 0; j < unclamped.length; j++) {
                const idx = unclamped[j];
                sizes[idx] = tw > 0 ? remaining * (weights[idx] / tw) : remaining / unclamped.length;
            }
            break;
        }
    }
    return sizes;
}
/**
 * Break a list of auto-layout children into rows that fit within `availW`.
 * Each child's measured width is used for row-breaking decisions.
 * A single child that exceeds `availW` gets its own row (never split).
 */
function breakIntoRows(children, availW, gap) {
    if (children.length === 0)
        return [];
    const rows = [];
    let currentRow = [];
    let currentRowW = 0;
    for (const child of children) {
        const childW = child._layout.measuredW;
        const wouldBeW = currentRow.length === 0 ? childW : currentRowW + gap + childW;
        if (currentRow.length > 0 && wouldBeW > availW) {
            // Start a new row
            rows.push({
                children: currentRow,
                width: currentRowW,
                height: Math.max(...currentRow.map(c => c._layout.measuredH)),
            });
            currentRow = [child];
            currentRowW = childW;
        }
        else {
            currentRow.push(child);
            currentRowW = wouldBeW;
        }
    }
    // Push the last row
    if (currentRow.length > 0) {
        rows.push({
            children: currentRow,
            width: currentRowW,
            height: Math.max(...currentRow.map(c => c._layout.measuredH)),
        });
    }
    return rows;
}
// ---------------------------------------------------------------------------
// Alignment helper
// ---------------------------------------------------------------------------
export function alignOffset(align, available, content, axis) {
    const slack = Math.max(0, available - content);
    if (axis === 'x') {
        if (align === Align.TOP_LEFT || align === Align.CENTER_LEFT || align === Align.BOTTOM_LEFT)
            return 0;
        if (align === Align.TOP_CENTER || align === Align.CENTER || align === Align.BOTTOM_CENTER)
            return slack / 2;
        return slack; // RIGHT
    }
    else {
        if (align === Align.TOP_LEFT || align === Align.TOP_CENTER || align === Align.TOP_RIGHT)
            return 0;
        if (align === Align.CENTER_LEFT || align === Align.CENTER || align === Align.CENTER_RIGHT)
            return slack / 2;
        return slack; // BOTTOM
    }
}
// ---------------------------------------------------------------------------
// Pass 1: Measure (bottom-up)
// ---------------------------------------------------------------------------
export function measure(frame, adapter, isRoot = false) {
    if (frame.isLeaf) {
        const [w, h] = leafNaturalSize(frame, adapter);
        let finalW = w;
        let finalH = h;
        if (frame.sizingW === Sizing.FIXED && frame.width != null)
            finalW = frame.width;
        if (frame.sizingH === Sizing.FIXED && frame.height != null)
            finalH = frame.height;
        finalW = clampToConstraints(finalW, frame.minWidth, frame.maxWidth);
        finalH = clampToConstraints(finalH, frame.minHeight, frame.maxHeight);
        frame._layout.measuredW = roundUpToGrid(finalW);
        frame._layout.measuredH = roundUpToGrid(finalH);
        return;
    }
    // Measure children first (all children, including absolute-positioned)
    for (const child of frame.children) {
        measure(child, adapter);
    }
    // Only auto (in-flow) children contribute to parent's content size
    const autoChildren = frame.children.filter(c => c.positionType !== 'ABSOLUTE');
    const padH = frame.paddingLeft + frame.paddingRight;
    const padV = frame.paddingTop + frame.paddingBottom;
    const n = autoChildren.length;
    const totalGap = frame.gap * Math.max(0, n - 1);
    let contentW;
    let contentH;
    if (frame.direction === Direction.HORIZONTAL && frame.wrap && frame.sizingW === Sizing.FIXED && frame.width != null) {
        // Wrap mode with known width: break children into rows.
        // FILL children are treated as their measured width for row-breaking.
        const availW = Math.max(0, roundUpToGrid(frame.width) - padH - strokeSpaceTotal(frame));
        const rows = breakIntoRows(autoChildren, availW, frame.gap);
        contentW = availW;
        contentH = rows.reduce((s, row) => s + row.height, 0) + frame.gap * Math.max(0, rows.length - 1);
    }
    else if (frame.direction === Direction.HORIZONTAL) {
        // Primary axis (W)
        if (!isRoot) {
            const fillW = autoChildren.filter(c => c.sizingW === Sizing.FILL).map(c => c._layout.measuredW);
            const nonFillW = autoChildren.filter(c => c.sizingW !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredW, 0);
            if (fillW.length > 0) {
                contentW = Math.max(...fillW) * fillW.length + nonFillW + totalGap;
            }
            else {
                contentW = autoChildren.reduce((s, c) => s + c._layout.measuredW, 0) + totalGap;
            }
        }
        else {
            contentW = autoChildren.reduce((s, c) => s + c._layout.measuredW, 0) + totalGap;
        }
        // Cross axis (H): max
        contentH = autoChildren.length > 0 ? Math.max(...autoChildren.map(c => c._layout.measuredH)) : 0;
    }
    else {
        // Cross axis (W): max
        contentW = autoChildren.length > 0 ? Math.max(...autoChildren.map(c => c._layout.measuredW)) : 0;
        // Primary axis (H)
        if (!isRoot) {
            const fillH = autoChildren.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
            const nonFillH = autoChildren.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
            if (fillH.length > 0) {
                contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
            }
            else {
                contentH = autoChildren.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
            }
        }
        else {
            contentH = autoChildren.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
        }
    }
    const contentBasedW = roundUpToGrid(contentW + padH);
    const contentBasedH = roundUpToGrid(contentH + padV);
    // Per-axis sizing for containers
    frame._layout.measuredW = (frame.sizingW === Sizing.FIXED && frame.width != null)
        ? roundUpToGrid(frame.width)
        : contentBasedW;
    frame._layout.measuredH = (frame.sizingH === Sizing.FIXED && frame.height != null)
        ? roundUpToGrid(frame.height)
        : contentBasedH;
}
// ---------------------------------------------------------------------------
// Pass 1.5: Constrained re-measurement
// ---------------------------------------------------------------------------
function resolveChildWidths(frame, frameW, adapter) {
    if (frame.isLeaf)
        return [];
    const padL = frame.paddingLeft;
    const padR = frame.paddingRight;
    const strokeSpace = strokeSpaceTotal(frame);
    const autoChildren = frame.children.filter(c => c.positionType !== 'ABSOLUTE');
    const n = autoChildren.length;
    const totalGap = frame.gap * Math.max(0, n - 1);
    // Pre-compute absolute children's widths (they don't participate in flow)
    const absWidthMap = new Map();
    for (const child of frame.children) {
        if (child.positionType === 'ABSOLUTE') {
            let w;
            const contentW = Math.max(0, frameW - padL - padR - strokeSpace);
            if (child.sizingW === Sizing.FILL) {
                w = roundUpToGrid(contentW);
            }
            else if (child.sizingW === Sizing.FIXED && child.width != null) {
                w = roundUpToGrid(child.width);
            }
            else {
                w = roundUpToGrid(child._layout.measuredW);
            }
            w = clampToConstraints(w, child.minWidth, child.maxWidth);
            absWidthMap.set(child, w);
        }
    }
    if (frame.direction === Direction.HORIZONTAL) {
        const available = Math.max(0, frameW - padL - padR - strokeSpace - totalGap);
        let hugTotal = 0;
        const fillMeasured = [];
        const fillMins = [];
        const fillMaxes = [];
        const fillWeights = [];
        for (const child of autoChildren) {
            if (child.sizingW === Sizing.FILL) {
                fillMeasured.push(child._layout.measuredW);
                fillMins.push(child.minWidth);
                fillMaxes.push(child.maxWidth);
                fillWeights.push(child.fillWeight);
            }
            else {
                let w = child._layout.measuredW;
                w = clampToConstraints(w, child.minWidth, child.maxWidth);
                hugTotal += w;
            }
        }
        const fillSizes = distributeFillSpace(available - hugTotal, fillMeasured, fillMins, fillMaxes, fillWeights);
        const widths = [];
        let fillIdx = 0;
        for (const child of frame.children) {
            if (child.positionType === 'ABSOLUTE') {
                widths.push(absWidthMap.get(child));
                continue;
            }
            let w;
            if (child.sizingW === Sizing.FILL) {
                w = roundUpToGrid(fillSizes[fillIdx++]);
            }
            else if (child.sizingW === Sizing.FIXED && child.width != null) {
                w = roundUpToGrid(child.width);
            }
            else {
                w = roundUpToGrid(child._layout.measuredW);
            }
            w = clampToConstraints(w, child.minWidth, child.maxWidth);
            widths.push(w);
        }
        return widths;
    }
    else {
        // Vertical: cross-axis is W
        const crossW = Math.max(0, frameW - padL - padR - strokeSpace);
        const widths = [];
        for (const child of frame.children) {
            if (child.positionType === 'ABSOLUTE') {
                widths.push(absWidthMap.get(child));
                continue;
            }
            let w;
            if (child.sizingW === Sizing.FILL) {
                w = roundUpToGrid(crossW);
            }
            else if (child.sizingW === Sizing.FIXED && child.width != null) {
                w = roundUpToGrid(child.width);
            }
            else {
                w = roundUpToGrid(child._layout.measuredW);
            }
            w = clampToConstraints(w, child.minWidth, child.maxWidth);
            widths.push(w);
        }
        return widths;
    }
}
function propagateWidthAndRemeasure(frame, resolvedW, adapter) {
    if (frame.isLeaf) {
        if (frame.sizingH === Sizing.FIXED && frame.height != null)
            return;
        const allSpecs = leafAllSpecs(frame);
        if (allSpecs.length === 0)
            return;
        const [, newH] = leafNaturalSize(frame, adapter, resolvedW);
        const clampedH = clampToConstraints(newH, frame.minHeight, frame.maxHeight);
        const snappedH = roundUpToGrid(clampedH);
        if (snappedH !== frame._layout.measuredH) {
            frame._layout.measuredH = snappedH;
        }
        return;
    }
    frame._layout.resolvedW = resolvedW;
    const childWidths = resolveChildWidths(frame, resolvedW, adapter);
    for (let i = 0; i < frame.children.length; i++) {
        propagateWidthAndRemeasure(frame.children[i], childWidths[i], adapter);
    }
}
function propagateHeightChanges(frame, adapter) {
    if (frame.isLeaf)
        return;
    for (const child of frame.children) {
        propagateHeightChanges(child, adapter);
    }
    if (frame.sizingH !== Sizing.HUG)
        return;
    const autoChildren = frame.children.filter(c => c.positionType !== 'ABSOLUTE');
    const padV = frame.paddingTop + frame.paddingBottom;
    const n = autoChildren.length;
    const totalGap = frame.gap * Math.max(0, n - 1);
    let contentH;
    if (frame.direction === Direction.HORIZONTAL && frame.wrap && frame.sizingW === Sizing.FIXED && frame.width != null) {
        const availW = Math.max(0, roundUpToGrid(frame.width) - frame.paddingLeft - frame.paddingRight - strokeSpaceTotal(frame));
        const rows = breakIntoRows(autoChildren, availW, frame.gap);
        contentH = rows.reduce((s, row) => s + row.height, 0) + frame.gap * Math.max(0, rows.length - 1);
    }
    else if (frame.direction === Direction.HORIZONTAL) {
        contentH = autoChildren.length > 0 ? Math.max(...autoChildren.map(c => c._layout.measuredH)) : 0;
    }
    else {
        const fillH = autoChildren.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
        const nonFillH = autoChildren.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
        if (fillH.length > 0) {
            contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
        }
        else {
            contentH = autoChildren.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
        }
    }
    frame._layout.measuredH = roundUpToGrid(contentH + padV);
}
function refreshCoercedHeights(frame, adapter, coerced) {
    if (frame.isLeaf)
        return;
    for (const child of frame.children) {
        refreshCoercedHeights(child, adapter, coerced);
    }
    // Only refresh containers that were actually coerced by
    // enforceFillHugInvariant (originally HUG, now FIXED).
    // Skip containers that were originally FIXED (user-set height/width).
    if (!frame.id)
        return;
    const override = coerced.get(frame.id);
    if (!override)
        return;
    const autoChildren = frame.children.filter(c => c.positionType !== 'ABSOLUTE');
    const padV = frame.paddingTop + frame.paddingBottom;
    const n = autoChildren.length;
    const totalGap = frame.gap * Math.max(0, n - 1);
    if (frame.direction === Direction.HORIZONTAL && frame.wrap && frame.sizingW === Sizing.FIXED && frame.width != null) {
        const availW = Math.max(0, roundUpToGrid(frame.width) - frame.paddingLeft - frame.paddingRight - strokeSpaceTotal(frame));
        const rows = breakIntoRows(autoChildren, availW, frame.gap);
        const contentH = rows.reduce((s, row) => s + row.height, 0) + frame.gap * Math.max(0, rows.length - 1);
        const newH = roundUpToGrid(contentH + padV);
        frame._layout.measuredH = newH;
        if (override.sizingH === 'FIXED')
            override.height = newH;
    }
    else if (frame.direction === Direction.HORIZONTAL) {
        const contentH = autoChildren.length > 0 ? Math.max(...autoChildren.map(c => c._layout.measuredH)) : 0;
        const newH = roundUpToGrid(contentH + padV);
        frame._layout.measuredH = newH;
        if (override.sizingH === 'FIXED')
            override.height = newH;
    }
    else {
        const fillH = autoChildren.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
        const nonFillH = autoChildren.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
        let contentH;
        if (fillH.length > 0) {
            contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
        }
        else {
            contentH = autoChildren.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
        }
        const newH = roundUpToGrid(contentH + padV);
        frame._layout.measuredH = newH;
        if (override.sizingH === 'FIXED')
            override.height = newH;
    }
}
export function remeasureWithWidthConstraints(root, rootW, adapter, coerced) {
    propagateWidthAndRemeasure(root, rootW, adapter);
    propagateHeightChanges(root, adapter);
    refreshCoercedHeights(root, adapter, coerced ?? new Map());
}
// ---------------------------------------------------------------------------
// Pass 2: Place (top-down)
// ---------------------------------------------------------------------------
function childPrimarySizing(child, direction) {
    return direction === Direction.HORIZONTAL ? child.sizingW : child.sizingH;
}
function childCounterSizing(child, direction) {
    return direction === Direction.HORIZONTAL ? child.sizingH : child.sizingW;
}
export function place(frame, x, y, availableW, availableH, adapter) {
    // Final size per-axis
    if (frame.sizingW === Sizing.FILL) {
        frame._layout.placedW = availableW;
    }
    else if (frame.sizingW === Sizing.FIXED && frame.width != null) {
        frame._layout.placedW = roundUpToGrid(frame.width);
    }
    else {
        frame._layout.placedW = roundUpToGrid(frame._layout.measuredW);
    }
    frame._layout.placedW = clampToConstraints(frame._layout.placedW, frame.minWidth, frame.maxWidth);
    if (frame.sizingH === Sizing.FILL) {
        frame._layout.placedH = availableH;
    }
    else if (frame.sizingH === Sizing.FIXED && frame.height != null) {
        frame._layout.placedH = roundUpToGrid(frame.height);
    }
    else {
        frame._layout.placedH = roundUpToGrid(frame._layout.measuredH);
    }
    frame._layout.placedH = clampToConstraints(frame._layout.placedH, frame.minHeight, frame.maxHeight);
    frame._layout.placedX = x;
    frame._layout.placedY = y;
    if (frame.isLeaf)
        return;
    // Distribute space to children
    const padL = frame.paddingLeft;
    const padR = frame.paddingRight;
    const padT = frame.paddingTop;
    const padB = frame.paddingBottom;
    const strokeSpace = strokeSpaceTotal(frame);
    // Children layout
    const autoChildren = frame.children.filter(c => c.positionType !== 'ABSOLUTE');
    const n = autoChildren.length;
    // For justify modes other than PACKED, gap is replaced by computed
    // spacing — all inner space is available for children + distribution.
    const useJustify = frame.justify !== Justify.PACKED && n > 0;
    const effectiveGap = useJustify ? 0 : frame.gap;
    const totalGap = effectiveGap * Math.max(0, n - 1);
    let availableForChildren;
    let crossSize;
    if (frame.direction === Direction.HORIZONTAL) {
        availableForChildren = Math.max(0, frame._layout.placedW - padL - padR - strokeSpace - totalGap);
        crossSize = Math.max(0, frame._layout.placedH - padT - padB - strokeSpace);
    }
    else {
        availableForChildren = Math.max(0, frame._layout.placedH - padT - padB - strokeSpace - totalGap);
        crossSize = Math.max(0, frame._layout.placedW - padL - padR - strokeSpace);
    }
    // Primary-axis FILL distribution
    let hugTotal = 0;
    const fillMeasured = [];
    const fillMins = [];
    const fillMaxes = [];
    const fillWeights = [];
    for (const child of autoChildren) {
        const pSizing = childPrimarySizing(child, frame.direction);
        if (pSizing === Sizing.FILL) {
            const m = frame.direction === Direction.HORIZONTAL ? child._layout.measuredW : child._layout.measuredH;
            fillMeasured.push(m);
            fillWeights.push(child.fillWeight);
            if (frame.direction === Direction.HORIZONTAL) {
                fillMins.push(child.minWidth);
                fillMaxes.push(child.maxWidth);
            }
            else {
                fillMins.push(child.minHeight);
                fillMaxes.push(child.maxHeight);
            }
        }
        else {
            let mainSize = frame.direction === Direction.HORIZONTAL ? child._layout.measuredW : child._layout.measuredH;
            if (frame.direction === Direction.HORIZONTAL) {
                mainSize = clampToConstraints(mainSize, child.minWidth, child.maxWidth);
            }
            else {
                mainSize = clampToConstraints(mainSize, child.minHeight, child.maxHeight);
            }
            hugTotal += mainSize;
        }
    }
    const fillSizes = distributeFillSpace(availableForChildren - hugTotal, fillMeasured, fillMins, fillMaxes, fillWeights);
    const totalFillPlaced = fillSizes.reduce((s, v) => s + v, 0);
    const contentMain = hugTotal + totalFillPlaced + totalGap;
    // Compute main-axis positioning: offset before first child and gap between children.
    // For PACKED mode, use alignment + fixed gap.
    // For justify modes, use computed spacing derived from remaining space.
    const innerW = frame._layout.placedW - padL - padR - strokeSpace;
    const innerH = frame._layout.placedH - padT - padB - strokeSpace;
    const innerMain = frame.direction === Direction.HORIZONTAL ? innerW : innerH;
    let mainOffset;
    let childGap;
    if (!useJustify) {
        // PACKED: alignment positions the content group, fixed gap between children
        mainOffset = frame.direction === Direction.HORIZONTAL
            ? alignOffset(frame.align, innerW, contentMain, 'x')
            : alignOffset(frame.align, innerH, contentMain, 'y');
        childGap = frame.gap;
    }
    else {
        const remaining = Math.max(0, innerMain - contentMain);
        switch (frame.justify) {
            case Justify.SPACE_BETWEEN:
                mainOffset = 0;
                childGap = n > 1 ? remaining / (n - 1) : 0;
                break;
            case Justify.SPACE_AROUND:
                childGap = n > 0 ? remaining / n : 0;
                mainOffset = childGap / 2;
                break;
            case Justify.SPACE_EVENLY:
                childGap = remaining / (n + 1);
                mainOffset = childGap;
                break;
            default:
                mainOffset = 0;
                childGap = frame.gap;
        }
    }
    // Place auto children sequentially
    let fillIdx = 0;
    if (frame.wrap && frame.direction === Direction.HORIZONTAL) {
        // Wrap mode: break children into rows, place each row
        const innerW = frame._layout.placedW - padL - padR - strokeSpace;
        const rows = breakIntoRows(autoChildren, innerW, frame.gap);
        let cursorY = y + padT;
        for (const row of rows) {
            // Place children in this row horizontally
            let cursorX = x + padL;
            for (const child of row.children) {
                // Width: use measured (FILL children get their measured width in wrap mode —
                // FILL across the full row would require per-row FILL distribution which we skip for now)
                const childW = child._layout.measuredW;
                // Height: FILL children stretch to row height
                let childH;
                let childY;
                if (child.sizingH === Sizing.FILL) {
                    childH = row.height;
                    childY = cursorY;
                }
                else {
                    childH = child._layout.measuredH;
                    const crossOffset = alignOffset(frame.align, row.height, child._layout.measuredH, 'y');
                    childY = cursorY + crossOffset;
                }
                place(child, cursorX, childY, childW, childH, adapter);
                cursorX += child._layout.placedW + frame.gap;
            }
            cursorY += row.height + frame.gap;
        }
    }
    else if (frame.direction === Direction.HORIZONTAL) {
        let cursorX = x + padL + mainOffset;
        for (const child of autoChildren) {
            const pSizing = childPrimarySizing(child, frame.direction);
            const cSizing = childCounterSizing(child, frame.direction);
            // Primary (W)
            const childW = pSizing === Sizing.FILL ? fillSizes[fillIdx++] : child._layout.measuredW;
            // Counter (H)
            let childH;
            let childY;
            if (cSizing === Sizing.FILL) {
                childH = crossSize;
                childY = y + padT;
            }
            else {
                childH = child._layout.measuredH;
                const crossOffset = alignOffset(frame.align, crossSize, child._layout.measuredH, 'y');
                childY = y + padT + crossOffset;
            }
            place(child, cursorX, childY, childW, childH, adapter);
            cursorX += child._layout.placedW + childGap;
        }
    }
    else {
        let cursorY = y + padT + mainOffset;
        for (const child of autoChildren) {
            const pSizing = childPrimarySizing(child, frame.direction);
            const cSizing = childCounterSizing(child, frame.direction);
            // Primary (H)
            const childH = pSizing === Sizing.FILL ? fillSizes[fillIdx++] : child._layout.measuredH;
            // Counter (W)
            let childW;
            let childX;
            if (cSizing === Sizing.FILL) {
                childW = crossSize;
                childX = x + padL;
            }
            else {
                childW = child._layout.measuredW;
                const crossOffset = alignOffset(frame.align, crossSize, child._layout.measuredW, 'x');
                childX = x + padL + crossOffset;
            }
            place(child, childX, cursorY, childW, childH, adapter);
            cursorY += child._layout.placedH + childGap;
        }
    }
    // Place absolute children at their explicit x/y offsets relative to parent content area
    const contentX = x + padL;
    const contentY = y + padT;
    const contentW = Math.max(0, frame._layout.placedW - padL - padR - strokeSpace);
    const contentH = Math.max(0, frame._layout.placedH - padT - padB - strokeSpace);
    for (const child of frame.children) {
        if (child.positionType !== 'ABSOLUTE')
            continue;
        const absW = child.sizingW === Sizing.FILL ? contentW : (child.sizingW === Sizing.FIXED && child.width != null ? roundUpToGrid(child.width) : child._layout.measuredW);
        const absH = child.sizingH === Sizing.FILL ? contentH : (child.sizingH === Sizing.FIXED && child.height != null ? roundUpToGrid(child.height) : child._layout.measuredH);
        place(child, contentX + child.x, contentY + child.y, absW, absH, adapter);
    }
}
/**
 * Run the full layout pipeline: measure → coerce → remeasure → place.
 *
 * This produces identical coordinates to Python's layout_frame_diagram()
 * for the same input (given the same text measurement adapter).
 */
export function layoutFrameTree(root, adapter, options) {
    // Scope the active grid step for this layout pass.
    const prevStep = getActiveGridStep();
    const step = options?.gridStep ?? BASELINE_UNIT;
    setActiveGridStep(step);
    try {
        return _layoutFrameTreeInner(root, adapter, options);
    }
    finally {
        setActiveGridStep(prevStep);
    }
}
function _layoutFrameTreeInner(root, adapter, options) {
    const semanticState = new Map();
    captureSemanticState(root, semanticState);
    try {
        applyTextLayoutDefaults(root);
        // Pass 1: measure (root uses sum-based sizing)
        measure(root, adapter, true);
        // Coerce: HUG parent + FILL child → parent freezes to FIXED
        const coerced = enforceFillHugInvariant(root);
        // Root gets its measured size (or fixed if set)
        const requestedRootW = root.width ?? root._layout.measuredW;
        const rootW = expandRootWidthForSnappedFillColumns(root, requestedRootW);
        if (root.width != null && rootW !== root.width) {
            root.width = rootW;
        }
        // Pass 1.5: constrained re-measurement
        remeasureWithWidthConstraints(root, rootW, adapter, coerced);
        const rootH = root.height ?? root._layout.measuredH;
        const gridCols = options?.gridCols ?? 0;
        let colW = 0;
        let colGapG = 0;
        if (gridCols > 1 && options?.gridColGap != null) {
            const outerMargin = options.gridOuterMargin
                ?? root.paddingTop
                ?? root.padding;
            colGapG = options.gridColGap;
            const contentW = Math.max(0, rootW - 2 * outerMargin);
            const colWRaw = (contentW - (gridCols - 1) * colGapG) / gridCols;
            colW = Math.floor(colWRaw / BASELINE_UNIT) * BASELINE_UNIT;
        }
        if (colW > 0) {
            resolveColSpans(root, colW, colGapG);
        }
        if (gridCols > 1 && root.direction === Direction.HORIZONTAL) {
            equalizeGridColumns(root);
        }
        // Pass 2: place
        place(root, 0, 0, rootW, rootH, adapter);
        return {
            width: Math.round(root._layout.placedW),
            height: Math.round(root._layout.placedH),
            coerced,
        };
    }
    finally {
        restoreSemanticState(root, semanticState);
    }
}
//# sourceMappingURL=layout.js.map