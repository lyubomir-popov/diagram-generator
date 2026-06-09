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
export function letterSpacingPx(letterSpacing, fontSize) {
    if (!letterSpacing)
        return 0;
    const trimmed = String(letterSpacing).trim();
    if (!trimmed)
        return 0;
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
export function letterSpacingAdvance(text, letterSpacing, fontSize) {
    const perGap = letterSpacingPx(letterSpacing, fontSize);
    if (perGap === 0)
        return 0;
    return Math.max(0, Array.from(text).length - 1) * perGap;
}
export function lineSpecToMeasureRequest(spec) {
    return {
        text: spec.content,
        fontSize: sizeToPx(spec.size ?? BODY_SIZE),
        weight: Number(spec.weight ?? 400),
        smallCaps: spec.smallCaps ?? false,
        letterSpacing: spec.letterSpacing ?? null,
    };
}
// ---------------------------------------------------------------------------
// Adapter-aware helpers (used by the layout engine)
// ---------------------------------------------------------------------------
/** Estimate the pixel width of a single line spec. */
export function estimateLineWidth(spec, adapter) {
    return adapter.measureTextWidth(lineSpecToMeasureRequest(spec));
}
/** Word-wrap lines at max_width using the adapter for measurement. */
export function wrapTextLines(lines, maxWidth, adapter) {
    if (maxWidth <= 0) {
        return lines.map(spec => ({ ...spec }));
    }
    const result = [];
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
            }
            else {
                result.push({ ...spec, content: current });
                current = word;
            }
        }
        if (current) {
            result.push({ ...spec, content: current });
        }
        else if (words.length === 0) {
            result.push({ ...spec });
        }
    }
    return result;
}
export function lineToSpec(line) {
    return {
        content: line.content,
        size: line.size ?? String(BODY_SIZE),
        weight: line.weight ?? '400',
        fill: line.fill ?? '#000000',
        smallCaps: line.smallCaps ?? false,
        letterSpacing: line.letterSpacing ?? null,
        lineStep: line.lineStep != null ? String(line.lineStep) : String(BODY_LINE_STEP),
        fontFamily: line.fontFamily ?? null,
    };
}
export function linesToSpecs(lines) {
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
export class MockTextAdapter {
    factor;
    measurementBackend = 'mock';
    constructor(factor = 0.6) {
        this.factor = factor;
    }
    measureTextWidth(request) {
        let width = request.text.length * request.fontSize * this.factor;
        width += letterSpacingAdvance(request.text, request.letterSpacing, request.fontSize);
        return width;
    }
}
//# sourceMappingURL=text-measure.js.map