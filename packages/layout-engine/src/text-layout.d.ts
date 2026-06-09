/**
 * Text layout defaults — Figma-faithful wrap + hug semantics.
 *
 * All text-bearing frames get a default max measure (66 characters).
 * HUG boxes wrap at that measure and hug the resulting block geometry.
 */
import { Frame } from './frame-model.js';
import { type LineSpec, type TextMeasureAdapter } from './text-measure.js';
export { DEFAULT_MAX_WIDTH_CHARS, NO_WRAP_MAX_WIDTH_CHARS } from './tokens.js';
/** True when the frame carries author-visible text (heading or non-empty label lines). */
export declare function frameHasTextContent(frame: Frame): boolean;
/** Apply default max_width_chars to every text-bearing frame unless explicitly set. */
export declare function applyTextLayoutDefaults(frame: Frame): void;
export declare function hasCharWrapCap(frame: Frame): boolean;
/**
 * Convert a character count to a pixel max width using HarfBuzz (or test adapter).
 * Uses repeated 'n' as the typographic average-width probe at the frame's body typography.
 */
export declare function maxWidthPxFromChars(charCount: number, adapter: TextMeasureAdapter, reference?: LineSpec): number;
/**
 * Inner text wrap width (px) for a leaf frame's content area.
 * See spec 011 plan for priority order.
 */
export declare function resolveLeafTextWrapWidth(frame: Frame, adapter: TextMeasureAdapter, constrainedW?: number): number;
//# sourceMappingURL=text-layout.d.ts.map