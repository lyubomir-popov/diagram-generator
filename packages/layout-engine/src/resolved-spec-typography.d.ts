/**
 * Renderer typography — consume resolved style snapshots, not raw line specs alone.
 */
import type { Frame, Line } from './frame-model.js';
import type { LineSpec } from './text-measure.js';
export interface ResolvedSpecTypography {
    weight: string;
    smallCaps: boolean;
    fill: string;
}
export interface ResolvedFrameOwnedTypography extends ResolvedSpecTypography {
    letterSpacing: string | null;
    fontFamily: string | null;
}
export type FrameOwnedTextBlock = LineSpec[];
/** True when this spec row should use heading snapshot fields on the frame. */
export declare function usesHeadingStyleSnapshot(frame: Frame, specIndex: number): boolean;
export declare function usesLeafLeadStyleSnapshot(frame: Frame, specIndex: number): boolean;
export declare function resolvedSpecTypography(frame: Frame, _spec: LineSpec, specIndex: number): ResolvedSpecTypography;
export declare function frameOwnedHeadingToSpec(frame: Frame, line: Line): LineSpec;
export declare function frameOwnedLabelToSpec(frame: Frame, line: Line, labelIndex: number): LineSpec;
export declare function frameOwnedTextBlocks(frame: Frame): FrameOwnedTextBlock[];
export declare function frameOwnedTextBlockGap(frame: Frame, blockIndex: number, blockCount: number): number;
export declare function annotationTextToSpec(line: Line): LineSpec;
//# sourceMappingURL=resolved-spec-typography.d.ts.map