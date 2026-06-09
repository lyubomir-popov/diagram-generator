import { type Frame } from './frame-model.js';
/** Stroke width from a frame-class definition (0 when the class has no visible stroke). */
export declare function strokeWidthForClass(frameClass: FrameClassDefinition): number;
/**
 * Effective border width after resolveStyles() — used by layout inset and SVG render.
 * Never infer section width from YAML `border`; only from frame-class resolution.
 */
export declare function effectiveResolvedStrokeWidth(frame: Frame): number;
export interface FrameTextStyle {
    weight: string;
    smallCaps: boolean;
    letterSpacing?: string;
}
export interface FrameClassDefinition {
    fill: string;
    stroke: string;
    strokeWidth?: number;
    textFill?: string;
    iconFill?: string;
    headingText?: FrameTextStyle;
    leafLeadText?: FrameTextStyle;
}
type FrameClassKey = 'hidden' | 'highlight' | 'annotation' | 'section' | 'panel' | 'leaf';
export declare const FRAME_CLASS_DEFS: Record<FrameClassKey, FrameClassDefinition>;
/** Apply readable text/icon contrast for frames sitting on a highlight parent. */
export declare function applyHighlightParentContrast(frame: Frame): void;
export declare function applyFrameClass(frame: Frame, frameClass: FrameClassDefinition): void;
export {};
//# sourceMappingURL=frame-classes.d.ts.map