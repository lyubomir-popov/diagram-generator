/**
 * Browser Canvas text measurement adapter.
 *
 * Uses Canvas.measureText() with Ubuntu Sans Variable for real glyph-width
 * measurement in the browser.  Mirrors the measurement pattern already used
 * in editor.js but packaged as a TextMeasureAdapter for the layout engine.
 *
 * The font must be loaded (via CSS @font-face or the FontFace API) before
 * measurements are accurate.  Call `await adapter.ensureFontsReady()` once
 * after construction, or rely on the page's own font-loading guarantee.
 */
import { type TextMeasureAdapter, type TextMeasureRequest } from './text-measure.js';
export interface CanvasTextAdapterOptions {
    /** CSS font-family string.  Default: `"'Ubuntu Sans', sans-serif"`. */
    fontFamily?: string;
    /** Font weight for measurement.  Default: `400`. */
    weight?: number;
    /** Provide an existing 2D context to reuse.  Otherwise one is created. */
    ctx?: CanvasRenderingContext2D;
}
export declare class CanvasTextAdapter implements TextMeasureAdapter {
    readonly measurementBackend = "canvas";
    private readonly ctx;
    private readonly fontFamily;
    private readonly weight;
    constructor(options?: CanvasTextAdapterOptions);
    measureTextWidth(request: TextMeasureRequest): number;
    /**
     * Wait for the configured font family to finish loading.
     * Call once after construction to guarantee accurate measurements.
     * Safe to call multiple times or skip if the page already loads fonts.
     */
    ensureFontsReady(): Promise<void>;
}
//# sourceMappingURL=canvas-text-adapter.d.ts.map