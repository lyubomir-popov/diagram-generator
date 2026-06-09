/**
 * Text layout defaults — Figma-faithful wrap + hug semantics.
 *
 * All text-bearing frames get a default max measure (66 characters).
 * HUG boxes wrap at that measure and hug the resulting block geometry.
 */
import { BODY_SIZE, DEFAULT_MAX_WIDTH_CHARS, NO_WRAP_MAX_WIDTH_CHARS, roundUpToGrid, } from './tokens.js';
import { estimateLineWidth, } from './text-measure.js';
import { BLOCK_WIDTH, BODY_LINE_STEP } from './tokens.js';
import { leafIconColumnWidth } from './spatial.js';
import { frameOwnedHeadingToSpec, frameOwnedLabelToSpec } from './resolved-spec-typography.js';
export { DEFAULT_MAX_WIDTH_CHARS, NO_WRAP_MAX_WIDTH_CHARS } from './tokens.js';
/** True when the frame carries author-visible text (heading or non-empty label lines). */
export function frameHasTextContent(frame) {
    if (frame.heading?.content.trim())
        return true;
    return frame.label.some((line) => line.content.trim().length > 0);
}
/** Apply default max_width_chars to every text-bearing frame unless explicitly set. */
export function applyTextLayoutDefaults(frame) {
    if (frameHasTextContent(frame)) {
        if (frame.maxWidthChars == null) {
            frame.maxWidthChars = DEFAULT_MAX_WIDTH_CHARS;
        }
    }
    for (const child of frame.children) {
        applyTextLayoutDefaults(child);
    }
}
export function hasCharWrapCap(frame) {
    if (!frameHasTextContent(frame))
        return false;
    const chars = frame.maxWidthChars ?? DEFAULT_MAX_WIDTH_CHARS;
    return chars !== NO_WRAP_MAX_WIDTH_CHARS;
}
function referenceLineSpec(frame) {
    if (frame.heading)
        return frameOwnedHeadingToSpec(frame, frame.heading);
    for (const [labelIndex, line] of frame.label.entries()) {
        if (line.content.trim().length > 0) {
            return frameOwnedLabelToSpec(frame, line, labelIndex);
        }
    }
    return {
        content: 'n',
        size: String(BODY_SIZE),
        weight: '400',
        fill: '#000000',
        smallCaps: false,
        letterSpacing: null,
        lineStep: String(BODY_LINE_STEP),
        fontFamily: null,
    };
}
/**
 * Convert a character count to a pixel max width using HarfBuzz (or test adapter).
 * Uses repeated 'n' as the typographic average-width probe at the frame's body typography.
 */
export function maxWidthPxFromChars(charCount, adapter, reference) {
    if (charCount <= 0)
        return 0;
    const ref = reference ?? { content: 'n', size: String(BODY_SIZE), weight: '400' };
    const sample = reference?.content?.trim()
        ? reference.content.trim().repeat(Math.ceil(charCount / Math.max(1, reference.content.trim().length))).slice(0, charCount)
        : 'n'.repeat(charCount);
    const probe = { ...ref, content: sample || 'n'.repeat(charCount) };
    return roundUpToGrid(estimateLineWidth(probe, adapter));
}
/**
 * Inner text wrap width (px) for a leaf frame's content area.
 * See spec 011 plan for priority order.
 */
export function resolveLeafTextWrapWidth(frame, adapter, constrainedW) {
    const padL = frame.paddingLeft;
    const padR = frame.paddingRight;
    const iconCol = leafIconColumnWidth(frame);
    if (constrainedW != null) {
        return Math.max(0, constrainedW - padL - padR - iconCol);
    }
    if (frame.width != null) {
        return Math.max(0, frame.width - padL - padR - iconCol);
    }
    if (frame.maxWidth != null) {
        return Math.max(0, frame.maxWidth - padL - padR - iconCol);
    }
    if (frameHasTextContent(frame)) {
        const chars = frame.maxWidthChars ?? DEFAULT_MAX_WIDTH_CHARS;
        if (chars === NO_WRAP_MAX_WIDTH_CHARS) {
            return Number.MAX_SAFE_INTEGER / 4;
        }
        const outerPx = maxWidthPxFromChars(chars, adapter, referenceLineSpec(frame));
        return Math.max(0, outerPx - padL - padR - iconCol);
    }
    return Math.max(0, BLOCK_WIDTH - padL - padR - iconCol);
}
//# sourceMappingURL=text-layout.js.map