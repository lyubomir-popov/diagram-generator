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
export interface TextMeasureAdapter {
    /** Identifier for the measurement backend, used to enforce runtime invariants. */
    readonly measurementBackend: string;
    /** Measure pixel width of text for the full resolved text style. */
    measureTextWidth(request: TextMeasureRequest): number;
}
export declare function letterSpacingPx(letterSpacing: string | null | undefined, fontSize: number): number;
export declare function letterSpacingAdvance(text: string, letterSpacing: string | null | undefined, fontSize: number): number;
export declare function lineSpecToMeasureRequest(spec: LineSpec): TextMeasureRequest;
/** Estimate the pixel width of a single line spec. */
export declare function estimateLineWidth(spec: LineSpec, adapter: TextMeasureAdapter): number;
/** Word-wrap lines at max_width using the adapter for measurement. */
export declare function wrapTextLines(lines: readonly LineSpec[], maxWidth: number, adapter: TextMeasureAdapter): LineSpec[];
import type { Line } from './frame-model.js';
export declare function lineToSpec(line: Line): LineSpec;
export declare function linesToSpecs(lines: readonly Line[]): LineSpec[];
/**
 * A deterministic text measurement adapter for unit tests.
 * Uses a fixed character width factor: width = text.length * fontSize * factor.
 * Default factor 0.6 approximates average glyph width for proportional fonts.
 */
export declare class MockTextAdapter implements TextMeasureAdapter {
    private readonly factor;
    readonly measurementBackend = "mock";
    constructor(factor?: number);
    measureTextWidth(request: TextMeasureRequest): number;
}
//# sourceMappingURL=text-measure.d.ts.map