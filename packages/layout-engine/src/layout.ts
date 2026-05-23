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

import { Frame, Direction, Sizing, Align, Border, type Line, enforceFillHugInvariant } from './frame-model.js';
import {
  BASELINE_UNIT, BLOCK_WIDTH, BOX_MIN_HEIGHT, INSET, ICON_SIZE,
  BODY_LINE_STEP, BODY_SIZE,
  roundUpToGrid, sizeToPx, steppedLinesHeight, clampToConstraints,
} from './tokens.js';
import {
  type TextMeasureAdapter, type LineSpec,
  estimateLineWidth, wrapTextLines, linesToSpecs, lineToSpec,
} from './text-measure.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headingHeight(heading: Line | undefined, adapter: TextMeasureAdapter, maxWidth?: number): number {
  if (!heading) return 0;
  let specs = linesToSpecs([heading]);
  if (maxWidth && maxWidth > 0) {
    specs = wrapTextLines(specs, maxWidth, adapter);
  }
  const h = steppedLinesHeight(
    specs.map(s => ({ lineStep: s.lineStep != null ? sizeToPx(s.lineStep) : undefined, size: s.size })),
    { topPad: INSET, bottomPad: INSET, minHeight: 0 },
  );
  return Math.max(h, ICON_SIZE + INSET);
}

/** Compute the heading text max_width from a frame's width for text wrapping.
 *  Prefers placedW (set during place), then resolvedW (set during remeasure).
 */
function headingTextMaxW(frame: Frame): number | undefined {
  const rw = frame._layout.placedW || frame._layout.resolvedW;
  if (rw == null || rw === 0) return undefined;
  const padL = frame.border !== Border.NONE ? frame.paddingLeft : 0;
  const padR = frame.border !== Border.NONE ? frame.paddingRight : 0;
  const iconCol = frame.icon ? (ICON_SIZE + INSET) : 0;
  return rw - padL - padR - iconCol;
}

function estimateTextWidth(lines: readonly Line[], adapter: TextMeasureAdapter): number {
  let maxW = 0;
  for (const ln of lines) {
    maxW = Math.max(maxW, estimateLineWidth(lineToSpec(ln), adapter));
  }
  return maxW;
}

function leafAllSpecs(frame: Frame): LineSpec[] {
  const result: LineSpec[] = [];
  if (frame.heading) result.push(...linesToSpecs([frame.heading]));
  if (frame.label.length > 0) result.push(...linesToSpecs(frame.label));
  return result;
}

function leafNaturalSize(
  frame: Frame,
  adapter: TextMeasureAdapter,
  constrainedW?: number,
): [number, number] {
  const hasIcon = frame.icon != null;
  const allSpecs = leafAllSpecs(frame);

  let w: number;
  let h: number;
  let textMaxW = BLOCK_WIDTH - 2 * INSET;

  if (allSpecs.length > 0) {
    const iconCol = hasIcon ? (ICON_SIZE + INSET) : 0;
    if (constrainedW != null) {
      textMaxW = constrainedW - 2 * INSET - iconCol;
    } else if (frame.width != null) {
      textMaxW = frame.width - 2 * INSET - iconCol;
    } else {
      textMaxW = BLOCK_WIDTH - 2 * INSET - iconCol;
    }

    const wrappedSpecs = wrapTextLines(allSpecs, textMaxW, adapter);
    const textH = steppedLinesHeight(
      wrappedSpecs.map(s => ({ lineStep: s.lineStep != null ? sizeToPx(s.lineStep) : undefined, size: s.size })),
      { topPad: INSET, bottomPad: INSET, minHeight: 0 },
    );

    if (frame.border !== Border.NONE) {
      const iconH = INSET + ICON_SIZE + INSET; // 64
      h = Math.max(textH, iconH);
    } else {
      h = textH;
    }
  } else {
    h = frame.height ?? BOX_MIN_HEIGHT;
  }

  // Explicit height overrides computed height if larger
  if (frame.height != null) {
    h = Math.max(h, frame.height);
  }

  // Width
  if (frame.width != null) {
    w = frame.width;
  } else if (allSpecs.length > 0) {
    const textLines = [...(frame.heading ? [frame.heading] : []), ...frame.label];
    let textW = estimateTextWidth(textLines, adapter);
    textW = Math.min(textW, textMaxW);
    const iconCol = hasIcon ? (ICON_SIZE + INSET) : 0;
    const contentW = INSET + textW + INSET + iconCol;
    w = Math.max(roundUpToGrid(contentW), BLOCK_WIDTH);
  } else {
    w = BLOCK_WIDTH;
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
export function distributeFillSpace(
  available: number,
  fillMeasured: readonly number[],
  fillMins?: readonly (number | undefined)[],
  fillMaxes?: readonly (number | undefined)[],
): number[] {
  const n = fillMeasured.length;
  if (n === 0) return [];

  const sizes = new Array<number>(n).fill(0);
  let remaining = Math.max(0, available);
  const unclamped = Array.from({ length: n }, (_, i) => i);

  // Effective min/max
  const effMins = new Array<number>(n).fill(0);
  const effMaxes = new Array<number>(n).fill(Infinity);
  if (fillMins) {
    for (let i = 0; i < Math.min(n, fillMins.length); i++) {
      if (fillMins[i] != null) effMins[i] = fillMins[i]!;
    }
  }
  if (fillMaxes) {
    for (let i = 0; i < Math.min(n, fillMaxes.length); i++) {
      if (fillMaxes[i] != null) effMaxes[i] = fillMaxes[i]!;
    }
  }

  // Iterative clamping
  while (unclamped.length > 0) {
    const share = remaining / unclamped.length;
    let clampedAny = false;

    for (let j = 0; j < unclamped.length; j++) {
      const idx = unclamped[j]!;
      if (share < effMins[idx]!) {
        sizes[idx] = roundUpToGrid(effMins[idx]!);
        remaining -= sizes[idx]!;
        unclamped.splice(j, 1);
        clampedAny = true;
        break;
      }
      if (share > effMaxes[idx]!) {
        sizes[idx] = Math.floor(effMaxes[idx]! / BASELINE_UNIT) * BASELINE_UNIT;
        remaining -= sizes[idx]!;
        unclamped.splice(j, 1);
        clampedAny = true;
        break;
      }
    }

    if (!clampedAny) {
      const nUnc = unclamped.length;
      for (let j = 0; j < unclamped.length; j++) {
        const idx = unclamped[j]!;
        sizes[idx] = remaining / nUnc;
      }
      break;
    }
  }

  return sizes;
}


// ---------------------------------------------------------------------------
// Alignment helper
// ---------------------------------------------------------------------------

export function alignOffset(align: Align, available: number, content: number, axis: 'x' | 'y'): number {
  const slack = Math.max(0, available - content);
  if (axis === 'x') {
    if (align === Align.TOP_LEFT || align === Align.CENTER_LEFT || align === Align.BOTTOM_LEFT) return 0;
    if (align === Align.TOP_CENTER || align === Align.CENTER || align === Align.BOTTOM_CENTER) return slack / 2;
    return slack; // RIGHT
  } else {
    if (align === Align.TOP_LEFT || align === Align.TOP_CENTER || align === Align.TOP_RIGHT) return 0;
    if (align === Align.CENTER_LEFT || align === Align.CENTER || align === Align.CENTER_RIGHT) return slack / 2;
    return slack; // BOTTOM
  }
}


// ---------------------------------------------------------------------------
// Pass 1: Measure (bottom-up)
// ---------------------------------------------------------------------------

export function measure(frame: Frame, adapter: TextMeasureAdapter, isRoot = false): void {
  if (frame.isLeaf) {
    const [w, h] = leafNaturalSize(frame, adapter);
    let finalW = w;
    let finalH = h;
    if (frame.sizingW === Sizing.FIXED && frame.width != null) finalW = frame.width;
    if (frame.sizingH === Sizing.FIXED && frame.height != null) finalH = frame.height;
    frame._layout.measuredW = roundUpToGrid(finalW);
    frame._layout.measuredH = roundUpToGrid(finalH);
    return;
  }

  // Measure children first
  for (const child of frame.children) {
    measure(child, adapter);
  }

  const padH = frame.paddingLeft + frame.paddingRight;
  const padV = frame.paddingTop + frame.paddingBottom;
  const hh = headingHeight(frame.heading, adapter);
  const hGap = hh > 0 ? frame.gap : 0;
  const n = frame.children.length;
  const totalGap = frame.gap * Math.max(0, n - 1);

  let contentW: number;
  let contentH: number;

  if (frame.direction === Direction.HORIZONTAL) {
    // Primary axis (W)
    if (!isRoot) {
      const fillW = frame.children.filter(c => c.sizingW === Sizing.FILL).map(c => c._layout.measuredW);
      const nonFillW = frame.children.filter(c => c.sizingW !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredW, 0);
      if (fillW.length > 0) {
        contentW = Math.max(...fillW) * fillW.length + nonFillW + totalGap;
      } else {
        contentW = frame.children.reduce((s, c) => s + c._layout.measuredW, 0) + totalGap;
      }
    } else {
      contentW = frame.children.reduce((s, c) => s + c._layout.measuredW, 0) + totalGap;
    }
    // Cross axis (H): max
    contentH = frame.children.length > 0 ? Math.max(...frame.children.map(c => c._layout.measuredH)) : 0;
  } else {
    // Cross axis (W): max
    contentW = frame.children.length > 0 ? Math.max(...frame.children.map(c => c._layout.measuredW)) : 0;
    // Primary axis (H)
    if (!isRoot) {
      const fillH = frame.children.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
      const nonFillH = frame.children.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
      if (fillH.length > 0) {
        contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
      } else {
        contentH = frame.children.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
      }
    } else {
      contentH = frame.children.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
    }
  }

  const contentBasedW = roundUpToGrid(contentW + padH);
  const contentBasedH = roundUpToGrid(contentH + padV + hh + hGap);

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

function resolveChildWidths(frame: Frame, frameW: number, adapter: TextMeasureAdapter): number[] {
  if (frame.isLeaf) return [];

  const padL = frame.paddingLeft;
  const padR = frame.paddingRight;
  const n = frame.children.length;
  const totalGap = frame.gap * Math.max(0, n - 1);

  if (frame.direction === Direction.HORIZONTAL) {
    const available = Math.max(0, frameW - padL - padR - totalGap);
    let hugTotal = 0;
    const fillMeasured: number[] = [];
    const fillMins: (number | undefined)[] = [];
    const fillMaxes: (number | undefined)[] = [];

    for (const child of frame.children) {
      if (child.sizingW === Sizing.FILL) {
        fillMeasured.push(child._layout.measuredW);
        fillMins.push(child.minWidth);
        fillMaxes.push(child.maxWidth);
      } else {
        let w = child._layout.measuredW;
        w = clampToConstraints(w, child.minWidth, child.maxWidth);
        hugTotal += w;
      }
    }

    const fillSizes = distributeFillSpace(available - hugTotal, fillMeasured, fillMins, fillMaxes);

    const widths: number[] = [];
    let fillIdx = 0;
    for (const child of frame.children) {
      let w: number;
      if (child.sizingW === Sizing.FILL) {
        w = roundUpToGrid(fillSizes[fillIdx++]!);
      } else if (child.sizingW === Sizing.FIXED && child.width != null) {
        w = roundUpToGrid(child.width);
      } else {
        w = roundUpToGrid(child._layout.measuredW);
      }
      w = clampToConstraints(w, child.minWidth, child.maxWidth);
      widths.push(w);
    }
    return widths;
  } else {
    // Vertical: cross-axis is W
    const crossW = Math.max(0, frameW - padL - padR);
    const widths: number[] = [];
    for (const child of frame.children) {
      let w: number;
      if (child.sizingW === Sizing.FILL) {
        w = roundUpToGrid(crossW);
      } else if (child.sizingW === Sizing.FIXED && child.width != null) {
        w = roundUpToGrid(child.width);
      } else {
        w = roundUpToGrid(child._layout.measuredW);
      }
      w = clampToConstraints(w, child.minWidth, child.maxWidth);
      widths.push(w);
    }
    return widths;
  }
}

function propagateWidthAndRemeasure(frame: Frame, resolvedW: number, adapter: TextMeasureAdapter): void {
  if (frame.isLeaf) {
    if (frame.sizingH === Sizing.FIXED && frame.height != null) return;
    const allSpecs = leafAllSpecs(frame);
    if (allSpecs.length === 0) return;
    const [, newH] = leafNaturalSize(frame, adapter, resolvedW);
    const snappedH = roundUpToGrid(newH);
    if (snappedH !== frame._layout.measuredH) {
      frame._layout.measuredH = snappedH;
    }
    return;
  }

  frame._layout.resolvedW = resolvedW;
  const childWidths = resolveChildWidths(frame, resolvedW, adapter);
  for (let i = 0; i < frame.children.length; i++) {
    propagateWidthAndRemeasure(frame.children[i]!, childWidths[i]!, adapter);
  }
}

function propagateHeightChanges(frame: Frame, adapter: TextMeasureAdapter): void {
  if (frame.isLeaf) return;
  for (const child of frame.children) {
    propagateHeightChanges(child, adapter);
  }
  if (frame.sizingH !== Sizing.HUG) return;

  const padV = frame.paddingTop + frame.paddingBottom;
  const hh = headingHeight(frame.heading, adapter, headingTextMaxW(frame));
  const hGap = hh > 0 ? frame.gap : 0;
  const n = frame.children.length;
  const totalGap = frame.gap * Math.max(0, n - 1);

  let contentH: number;
  if (frame.direction === Direction.HORIZONTAL) {
    contentH = frame.children.length > 0 ? Math.max(...frame.children.map(c => c._layout.measuredH)) : 0;
  } else {
    const fillH = frame.children.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
    const nonFillH = frame.children.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
    if (fillH.length > 0) {
      contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
    } else {
      contentH = frame.children.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
    }
  }

  frame._layout.measuredH = roundUpToGrid(contentH + padV + hh + hGap);
}

function refreshCoercedHeights(frame: Frame, adapter: TextMeasureAdapter, coercedIds: Set<string>): void {
  if (frame.isLeaf) return;
  for (const child of frame.children) {
    refreshCoercedHeights(child, adapter, coercedIds);
  }

  // Only refresh containers that were actually coerced by
  // enforceFillHugInvariant (originally HUG, now FIXED).
  // Skip containers that were originally FIXED (user-set height/width).
  if (!frame.id || !coercedIds.has(frame.id)) return;

  const padV = frame.paddingTop + frame.paddingBottom;
  const hh = headingHeight(frame.heading, adapter, headingTextMaxW(frame));
  const hGap = hh > 0 ? frame.gap : 0;
  const n = frame.children.length;
  const totalGap = frame.gap * Math.max(0, n - 1);

  if (frame.direction === Direction.HORIZONTAL) {
    const contentH = frame.children.length > 0 ? Math.max(...frame.children.map(c => c._layout.measuredH)) : 0;
    const newH = roundUpToGrid(contentH + padV + hh + hGap);
    frame._layout.measuredH = newH;
    frame.height = newH;
  } else {
    const fillH = frame.children.filter(c => c.sizingH === Sizing.FILL).map(c => c._layout.measuredH);
    const nonFillH = frame.children.filter(c => c.sizingH !== Sizing.FILL).reduce((s, c) => s + c._layout.measuredH, 0);
    let contentH: number;
    if (fillH.length > 0) {
      contentH = Math.max(...fillH) * fillH.length + nonFillH + totalGap;
    } else {
      contentH = frame.children.reduce((s, c) => s + c._layout.measuredH, 0) + totalGap;
    }
    const newH = roundUpToGrid(contentH + padV + hh + hGap);
    frame._layout.measuredH = newH;
    frame.height = newH;
  }
}

export function remeasureWithWidthConstraints(
  root: Frame,
  rootW: number,
  adapter: TextMeasureAdapter,
  coercedIds?: Set<string>,
): void {
  propagateWidthAndRemeasure(root, rootW, adapter);
  propagateHeightChanges(root, adapter);
  refreshCoercedHeights(root, adapter, coercedIds ?? new Set());
}


// ---------------------------------------------------------------------------
// Pass 2: Place (top-down)
// ---------------------------------------------------------------------------

function childPrimarySizing(child: Frame, direction: Direction): Sizing {
  return direction === Direction.HORIZONTAL ? child.sizingW : child.sizingH;
}

function childCounterSizing(child: Frame, direction: Direction): Sizing {
  return direction === Direction.HORIZONTAL ? child.sizingH : child.sizingW;
}

export function place(
  frame: Frame,
  x: number, y: number,
  availableW: number, availableH: number,
  adapter: TextMeasureAdapter,
): void {
  // Final size per-axis
  if (frame.sizingW === Sizing.FILL) {
    frame._layout.placedW = availableW;
  } else if (frame.sizingW === Sizing.FIXED && frame.width != null) {
    frame._layout.placedW = roundUpToGrid(frame.width);
  } else {
    frame._layout.placedW = roundUpToGrid(frame._layout.measuredW);
  }
  frame._layout.placedW = clampToConstraints(frame._layout.placedW, frame.minWidth, frame.maxWidth);

  if (frame.sizingH === Sizing.FILL) {
    frame._layout.placedH = availableH;
  } else if (frame.sizingH === Sizing.FIXED && frame.height != null) {
    frame._layout.placedH = roundUpToGrid(frame.height);
  } else {
    frame._layout.placedH = roundUpToGrid(frame._layout.measuredH);
  }
  frame._layout.placedH = clampToConstraints(frame._layout.placedH, frame.minHeight, frame.maxHeight);

  frame._layout.placedX = x;
  frame._layout.placedY = y;

  if (frame.isLeaf) return;

  // Distribute space to children
  const padL = frame.paddingLeft;
  const padR = frame.paddingRight;
  const padT = frame.paddingTop;

  // Heading height with placed width to account for text wrapping
  let textMaxW = headingTextMaxW(frame);
  if (textMaxW == null) {
    // Fallback when resolvedW wasn't set
    const effectivePadL = frame.border !== Border.NONE ? padL : 0;
    const effectivePadR = frame.border !== Border.NONE ? padR : 0;
    const iconCol = frame.icon ? (ICON_SIZE + INSET) : 0;
    textMaxW = frame._layout.placedW - effectivePadL - effectivePadR - iconCol;
  }
  const hh = headingHeight(frame.heading, adapter, textMaxW);
  const hGap = hh > 0 ? frame.gap : 0;
  const n = frame.children.length;
  const totalGap = frame.gap * Math.max(0, n - 1);

  let availableForChildren: number;
  let crossSize: number;

  if (frame.direction === Direction.HORIZONTAL) {
    availableForChildren = Math.max(0, frame._layout.placedW - padL - padR - totalGap);
    crossSize = Math.max(0, frame._layout.placedH - padT - frame.paddingBottom - hh - hGap);
  } else {
    availableForChildren = Math.max(0, frame._layout.placedH - padT - frame.paddingBottom - hh - hGap - totalGap);
    crossSize = Math.max(0, frame._layout.placedW - padL - padR);
  }

  // Primary-axis FILL distribution
  let hugTotal = 0;
  const fillMeasured: number[] = [];
  const fillMins: (number | undefined)[] = [];
  const fillMaxes: (number | undefined)[] = [];

  for (const child of frame.children) {
    const pSizing = childPrimarySizing(child, frame.direction);
    if (pSizing === Sizing.FILL) {
      const m = frame.direction === Direction.HORIZONTAL ? child._layout.measuredW : child._layout.measuredH;
      fillMeasured.push(m);
      if (frame.direction === Direction.HORIZONTAL) {
        fillMins.push(child.minWidth);
        fillMaxes.push(child.maxWidth);
      } else {
        fillMins.push(child.minHeight);
        fillMaxes.push(child.maxHeight);
      }
    } else {
      let mainSize = frame.direction === Direction.HORIZONTAL ? child._layout.measuredW : child._layout.measuredH;
      if (frame.direction === Direction.HORIZONTAL) {
        mainSize = clampToConstraints(mainSize, child.minWidth, child.maxWidth);
      } else {
        mainSize = clampToConstraints(mainSize, child.minHeight, child.maxHeight);
      }
      hugTotal += mainSize;
    }
  }

  const fillSizes = distributeFillSpace(availableForChildren - hugTotal, fillMeasured, fillMins, fillMaxes);
  const totalFillPlaced = fillSizes.reduce((s, v) => s + v, 0);
  const contentMain = hugTotal + totalFillPlaced + totalGap;

  // Main-axis alignment offset
  const innerW = frame._layout.placedW - padL - padR;
  const innerH = frame._layout.placedH - padT - frame.paddingBottom - hh - hGap;

  const mainOffset = frame.direction === Direction.HORIZONTAL
    ? alignOffset(frame.align, innerW, contentMain, 'x')
    : alignOffset(frame.align, innerH, contentMain, 'y');

  // Place children sequentially
  let fillIdx = 0;

  if (frame.direction === Direction.HORIZONTAL) {
    let cursorX = x + padL + mainOffset;
    for (const child of frame.children) {
      const pSizing = childPrimarySizing(child, frame.direction);
      const cSizing = childCounterSizing(child, frame.direction);

      // Primary (W)
      const childW = pSizing === Sizing.FILL ? fillSizes[fillIdx++]! : child._layout.measuredW;

      // Counter (H)
      let childH: number;
      let childY: number;
      if (cSizing === Sizing.FILL) {
        childH = crossSize;
        childY = y + padT + hh + hGap;
      } else {
        childH = child._layout.measuredH;
        const crossOffset = alignOffset(frame.align, crossSize, child._layout.measuredH, 'y');
        childY = y + padT + hh + hGap + crossOffset;
      }

      place(child, cursorX, childY, childW, childH, adapter);
      cursorX += child._layout.placedW + frame.gap;
    }
  } else {
    let cursorY = y + padT + hh + hGap + mainOffset;
    for (const child of frame.children) {
      const pSizing = childPrimarySizing(child, frame.direction);
      const cSizing = childCounterSizing(child, frame.direction);

      // Primary (H)
      const childH = pSizing === Sizing.FILL ? fillSizes[fillIdx++]! : child._layout.measuredH;

      // Counter (W)
      let childW: number;
      let childX: number;
      if (cSizing === Sizing.FILL) {
        childW = crossSize;
        childX = x + padL;
      } else {
        childW = child._layout.measuredW;
        const crossOffset = alignOffset(frame.align, crossSize, child._layout.measuredW, 'x');
        childX = x + padL + crossOffset;
      }

      place(child, childX, cursorY, childW, childH, adapter);
      cursorY += child._layout.placedH + frame.gap;
    }
  }
}


// ---------------------------------------------------------------------------
// Public API: full layout pipeline
// ---------------------------------------------------------------------------

export interface LayoutOutput {
  width: number;
  height: number;
  coerced: Map<string, import('./frame-model.js').CoercedOverride>;
}

/**
 * Run the full layout pipeline: measure → coerce → remeasure → place.
 *
 * This produces identical coordinates to Python's layout_frame_diagram()
 * for the same input (given the same text measurement adapter).
 */
export function layoutFrameTree(
  root: Frame,
  adapter: TextMeasureAdapter,
): LayoutOutput {
  // Pass 1: measure (root uses sum-based sizing)
  measure(root, adapter, true);

  // Coerce: HUG parent + FILL child → parent freezes to FIXED
  const coerced = enforceFillHugInvariant(root);

  // Root gets its measured size (or fixed if set)
  const rootW = root.width ?? root._layout.measuredW;

  // Pass 1.5: constrained re-measurement
  remeasureWithWidthConstraints(root, rootW, adapter, new Set(coerced.keys()));

  const rootH = root.height ?? root._layout.measuredH;

  // Pass 2: place
  place(root, 0, 0, rootW, rootH, adapter);

  return {
    width: Math.round(root._layout.placedW),
    height: Math.round(root._layout.placedH),
    coerced,
  };
}
