import { Border, type Frame } from './frame-model.js';
import { DEFAULT_FRAME_STROKE_WIDTH } from './tokens.js';

/** Stroke width from a frame-class definition (0 when the class has no visible stroke). */
export function strokeWidthForClass(frameClass: FrameClassDefinition): number {
  const stroke = frameClass.stroke;
  if (stroke === 'none' || stroke === 'transparent') {
    return 0;
  }
  return frameClass.strokeWidth ?? DEFAULT_FRAME_STROKE_WIDTH;
}

/**
 * Effective border width after resolveStyles() — used by layout inset and SVG render.
 * Never infer section width from YAML `border`; only from frame-class resolution.
 */
export function effectiveResolvedStrokeWidth(frame: Frame): number {
  // If resolveStyles() has run, trust the resolved values.
  if (frame.resolvedStroke !== undefined) {
    const stroke = frame.resolvedStroke;
    if (stroke === 'none' || stroke === 'transparent') return 0;
    if (frame.resolvedStrokeWidth != null && frame.resolvedStrokeWidth > 0) return frame.resolvedStrokeWidth;
    return DEFAULT_FRAME_STROKE_WIDTH;
  }
  // resolveStyles() hasn't run yet — fall back to the border field.
  return frame.border === Border.SOLID || frame.border === Border.DASHED
    ? DEFAULT_FRAME_STROKE_WIDTH
    : 0;
}

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

export const FRAME_CLASS_DEFS: Record<FrameClassKey, FrameClassDefinition> = {
  hidden: {
    fill: 'transparent',
    stroke: 'none',
    strokeWidth: 0,
  },
  highlight: {
    fill: '#000000',
    stroke: '#000000',
    textFill: '#FFFFFF',
    iconFill: '#FFFFFF',
  },
  annotation: {
    fill: 'transparent',
    stroke: 'none',
    strokeWidth: 0,
    textFill: '#666666',
    iconFill: '#666666',
    headingText: {
      weight: '400',
      smallCaps: false,
    },
    leafLeadText: {
      weight: '400',
      smallCaps: false,
    },
  },
  section: {
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: DEFAULT_FRAME_STROKE_WIDTH,
    textFill: '#000000',
    iconFill: '#000000',
    headingText: {
      weight: '700',
      smallCaps: false,
    },
    leafLeadText: {
      weight: '700',
      smallCaps: false,
    },
  },
  panel: {
    fill: '#F3F3F3',
    stroke: '#F3F3F3',
    strokeWidth: DEFAULT_FRAME_STROKE_WIDTH,
    textFill: '#000000',
    iconFill: '#000000',
    headingText: {
      weight: '700',
      smallCaps: false,
    },
    leafLeadText: {
      weight: '700',
      smallCaps: false,
    },
  },
  leaf: {
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: DEFAULT_FRAME_STROKE_WIDTH,
    textFill: '#000000',
    iconFill: '#000000',
    headingText: {
      weight: '400',
      smallCaps: false,
    },
    leafLeadText: {
      weight: '400',
      smallCaps: false,
    },
  },
};

/** Apply readable text/icon contrast for frames sitting on a highlight parent. */
export function applyHighlightParentContrast(frame: Frame): void {
  const textFill = '#FFFFFF';
  const iconFill = '#FFFFFF';
  frame.resolvedTextFill = textFill;
  frame.resolvedIconFill = iconFill;
  for (const child of frame.children) {
    if (child.role !== 'heading') continue;
    child.resolvedTextFill = textFill;
    child.resolvedIconFill = iconFill;
  }
}

function applyResolvedStyleSnapshot(frame: Frame, frameClass: FrameClassDefinition): void {
  frame.resolvedFill = frameClass.fill;
  frame.resolvedStroke = frameClass.stroke;
  frame.resolvedStrokeWidth = strokeWidthForClass(frameClass);
  frame.resolvedTextFill = frameClass.textFill;
  frame.resolvedIconFill = frameClass.iconFill;
  frame.resolvedHeadingWeight = frameClass.headingText?.weight;
  frame.resolvedHeadingSmallCaps = frameClass.headingText?.smallCaps;
  frame.resolvedHeadingLetterSpacing = frameClass.headingText?.letterSpacing;
  frame.resolvedLeafLeadWeight = frameClass.leafLeadText?.weight;
  frame.resolvedLeafLeadSmallCaps = frameClass.leafLeadText?.smallCaps;
  frame.resolvedLeafLeadLetterSpacing = frameClass.leafLeadText?.letterSpacing;
}

function applyHeadingChildSnapshot(frame: Frame, frameClass: FrameClassDefinition): void {
  frame.resolvedTextFill = frameClass.textFill;
  frame.resolvedIconFill = frameClass.iconFill;
  frame.resolvedHeadingWeight = frameClass.headingText?.weight;
  frame.resolvedHeadingSmallCaps = frameClass.headingText?.smallCaps;
  frame.resolvedHeadingLetterSpacing = frameClass.headingText?.letterSpacing;
}

export function applyFrameClass(frame: Frame, frameClass: FrameClassDefinition): void {
  applyResolvedStyleSnapshot(frame, frameClass);
  for (const child of frame.children) {
    if (child.role === 'heading') {
      applyHeadingChildSnapshot(child, frameClass);
    }
  }
}
