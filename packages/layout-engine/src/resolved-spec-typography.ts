/**
 * Renderer typography — consume resolved style snapshots, not raw line specs alone.
 */

import type { Frame, Line } from './frame-model.js';
import { FRAME_CLASS_DEFS } from './frame-classes.js';
import type { LineSpec } from './text-measure.js';
import { BODY_LINE_STEP, BODY_SIZE, defaultLineStep, sizeToPx } from './tokens.js';

const DEFAULT_WEIGHT = '400';
const DEFAULT_TEXT_FILL = '#000000';

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
export function usesHeadingStyleSnapshot(frame: Frame, specIndex: number): boolean {
  return frame.role === 'heading' || (frame.heading != null && specIndex === 0);
}

export function usesLeafLeadStyleSnapshot(frame: Frame, specIndex: number): boolean {
  if (!frame.isLeaf) return false;
  const leadIndex = frame.heading != null ? 1 : 0;
  return specIndex === leadIndex;
}

export function resolvedSpecTypography(
  frame: Frame,
  _spec: LineSpec,
  specIndex: number,
): ResolvedSpecTypography {
  const headingRow = usesHeadingStyleSnapshot(frame, specIndex);
  const leadRow = !headingRow && usesLeafLeadStyleSnapshot(frame, specIndex);
  return {
    weight: headingRow
      ? (frame.resolvedHeadingWeight ?? DEFAULT_WEIGHT)
      : (leadRow ? (frame.resolvedLeafLeadWeight ?? DEFAULT_WEIGHT) : DEFAULT_WEIGHT),
    smallCaps: false,
    fill: headingRow
      ? (frame.resolvedTextFill ?? DEFAULT_TEXT_FILL)
      : (frame.resolvedTextFill ?? DEFAULT_TEXT_FILL),
  };
}

function resolvedFrameOwnedTypography(
  frame: Frame,
  source: 'heading' | 'label',
  labelIndex = 0,
): ResolvedFrameOwnedTypography {
  const isHeading = source === 'heading' || (source === 'label' && frame.role === 'heading' && labelIndex === 0);
  if (isHeading) {
    return {
      weight: frame.resolvedHeadingWeight ?? DEFAULT_WEIGHT,
      smallCaps: false,
      fill: frame.resolvedTextFill ?? DEFAULT_TEXT_FILL,
      letterSpacing: frame.resolvedHeadingLetterSpacing ?? null,
      fontFamily: null,
    };
  }
  if (frame.isLeaf && frame.heading == null && labelIndex === 0) {
    return {
      weight: frame.resolvedLeafLeadWeight ?? DEFAULT_WEIGHT,
      smallCaps: false,
      fill: frame.resolvedTextFill ?? DEFAULT_TEXT_FILL,
      letterSpacing: frame.resolvedLeafLeadLetterSpacing ?? null,
      fontFamily: null,
    };
  }
  return {
    weight: DEFAULT_WEIGHT,
    smallCaps: false,
    fill: frame.resolvedTextFill ?? DEFAULT_TEXT_FILL,
    letterSpacing: null,
    fontFamily: null,
  };
}

export function frameOwnedHeadingToSpec(frame: Frame, line: Line): LineSpec {
  const resolved = resolvedFrameOwnedTypography(frame, 'heading');
  const headingSize = sizeToPx(line.size ?? BODY_SIZE);
  return {
    content: line.content,
    size: line.size,
    weight: resolved.weight,
    fill: resolved.fill,
    smallCaps: resolved.smallCaps,
    letterSpacing: resolved.letterSpacing,
    lineStep: line.lineStep != null ? String(line.lineStep) : String(defaultLineStep(headingSize)),
    fontFamily: resolved.fontFamily,
  };
}

export function frameOwnedLabelToSpec(frame: Frame, line: Line, labelIndex: number): LineSpec {
  const resolved = resolvedFrameOwnedTypography(frame, 'label', labelIndex);
  return {
    content: line.content,
    size: line.size,
    weight: resolved.weight,
    fill: resolved.fill,
    smallCaps: resolved.smallCaps,
    letterSpacing: resolved.letterSpacing,
    lineStep: line.lineStep != null ? String(line.lineStep) : String(BODY_LINE_STEP),
    fontFamily: resolved.fontFamily,
  };
}

export function frameOwnedTextBlocks(frame: Frame): FrameOwnedTextBlock[] {
  const blocks: FrameOwnedTextBlock[] = [];

  if (frame.heading) {
    blocks.push([frameOwnedHeadingToSpec(frame, frame.heading)]);
  }

  if (frame.children.length === 0 && frame.label.length > 0) {
    blocks.push(frame.label.map((line, labelIndex) => frameOwnedLabelToSpec(frame, line, labelIndex)));
  }

  return blocks.filter(block => block.length > 0);
}

export function frameOwnedTextBlockGap(frame: Frame, blockIndex: number, blockCount: number): number {
  const hasSeparateBodyBlock = frame.isLeaf && frame.heading != null && blockCount > 1;
  if (hasSeparateBodyBlock && blockIndex === 0) {
    return BODY_LINE_STEP;
  }
  return 0;
}

export function annotationTextToSpec(line: Line): LineSpec {
  const annotation = FRAME_CLASS_DEFS.annotation;
  return {
    content: line.content,
    size: line.size,
    weight: annotation.leafLeadText?.weight ?? DEFAULT_WEIGHT,
    fill: annotation.textFill ?? DEFAULT_TEXT_FILL,
    smallCaps: false,
    letterSpacing: annotation.leafLeadText?.letterSpacing ?? null,
    lineStep: line.lineStep != null ? String(line.lineStep) : String(BODY_LINE_STEP),
    fontFamily: null,
  };
}
