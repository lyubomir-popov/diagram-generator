/**
 * Text measurement adapter — abstracts font-metric access.
 *
 * The layout engine needs two operations from text measurement:
 * 1. measureTextWidth: pixel width of a string at a given font size
 * 2. wrapTextLines: word-wrap lines at a max pixel width
 *
 * The Python engine uses fontTools (glyph advance widths from Ubuntu Sans).
 * The browser can use Canvas.measureText. Tests use a simple mock.
 *
 * The adapter is injected into layout functions so the engine stays pure.
 */

import { sizeToPx, BODY_SIZE, BODY_LINE_STEP } from './tokens.js';

// ---------------------------------------------------------------------------
// Line spec: the dict-like format used throughout the layout engine
// ---------------------------------------------------------------------------

export interface LineSpec {
  content: string;
  size?: string | number;
  weight?: string | number;
  fill?: string;
  smallCaps?: boolean;
  letterSpacing?: string | null;
  lineStep?: string | number;
  fontFamily?: string | null;
}

export interface TextMeasureRequest {
  text: string;
  fontSize: number;
  weight?: number;
  smallCaps?: boolean;
  letterSpacing?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface TextMeasureAdapter {
  /** Identifier for the measurement backend, used to enforce runtime invariants. */
  readonly measurementBackend: string;
  /** Measure pixel width of text for the full resolved text style. */
  measureTextWidth(request: TextMeasureRequest): number;
}

export function letterSpacingPx(letterSpacing: string | null | undefined, fontSize: number): number {
  if (!letterSpacing) return 0;
  const trimmed = String(letterSpacing).trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('em')) {
    const value = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(value) ? value * fontSize : 0;
  }
  if (trimmed.endsWith('px')) {
    const value = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(value) ? value : 0;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : 0;
}

export function letterSpacingAdvance(text: string, letterSpacing: string | null | undefined, fontSize: number): number {
  const perGap = letterSpacingPx(letterSpacing, fontSize);
  if (perGap === 0) return 0;
  return Math.max(0, Array.from(text).length - 1) * perGap;
}

export function lineSpecToMeasureRequest(spec: LineSpec): TextMeasureRequest {
  return {
    text: spec.content,
    fontSize: sizeToPx(spec.size ?? BODY_SIZE),
    weight: Number(spec.weight ?? 400),
    smallCaps: false,
    letterSpacing: spec.letterSpacing ?? null,
  };
}

// ---------------------------------------------------------------------------
// Adapter-aware helpers (used by the layout engine)
// ---------------------------------------------------------------------------

/** Estimate the pixel width of a single line spec. */
export function estimateLineWidth(spec: LineSpec, adapter: TextMeasureAdapter): number {
  return adapter.measureTextWidth(lineSpecToMeasureRequest(spec));
}

/** Word-wrap lines at max_width using the adapter for measurement. */
export function wrapTextLines(
  lines: readonly LineSpec[],
  maxWidth: number,
  adapter: TextMeasureAdapter,
): LineSpec[] {
  if (maxWidth <= 0) {
    return lines.map(spec => ({ ...spec }));
  }

  const result: LineSpec[] = [];
  for (const spec of lines) {
    const lineW = estimateLineWidth(spec, adapter);
    if (lineW <= maxWidth) {
      result.push({ ...spec });
      continue;
    }

    const words = spec.content.split(/\s+/);
    let current = '';

    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      const testW = adapter.measureTextWidth({
        ...lineSpecToMeasureRequest(spec),
        text: test,
      });
      if (testW <= maxWidth || !current) {
        current = test;
      } else {
        result.push({ ...spec, content: current });
        current = word;
      }
    }
    if (current) {
      result.push({ ...spec, content: current });
    } else if (words.length === 0) {
      result.push({ ...spec });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convert Line (from frame-model) to LineSpec (engine internal format)
// ---------------------------------------------------------------------------

import type { Line } from './frame-model.js';

export function lineToSpec(line: Line): LineSpec {
  return {
    content: line.content,
    size: line.size ?? String(BODY_SIZE),
    weight: line.weight ?? '400',
    fill: line.fill ?? '#000000',
    smallCaps: false,
    letterSpacing: line.letterSpacing ?? null,
    lineStep: line.lineStep != null ? String(line.lineStep) : String(BODY_LINE_STEP),
    fontFamily: line.fontFamily ?? null,
  };
}

export function linesToSpecs(lines: readonly Line[]): LineSpec[] {
  return lines.map(lineToSpec);
}

// ---------------------------------------------------------------------------
// Simple mock adapter for testing (fixed width per character)
// ---------------------------------------------------------------------------

/**
 * A deterministic text measurement adapter for unit tests.
 * Uses a fixed character width factor: width = text.length * fontSize * factor.
 * Default factor 0.6 approximates average glyph width for proportional fonts.
 */
export class MockTextAdapter implements TextMeasureAdapter {
  readonly measurementBackend = 'mock';

  constructor(private readonly factor = 0.6) {}

  measureTextWidth(request: TextMeasureRequest): number {
    let width = request.text.length * request.fontSize * this.factor;
    width += letterSpacingAdvance(request.text, request.letterSpacing, request.fontSize);
    return width;
  }
}
