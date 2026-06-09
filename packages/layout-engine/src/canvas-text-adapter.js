/// <reference lib="dom" />
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
import { letterSpacingAdvance, } from './text-measure.js';
export class CanvasTextAdapter {
    measurementBackend = 'canvas';
    ctx;
    fontFamily;
    weight;
    constructor(options) {
        this.fontFamily = options?.fontFamily ?? "'Ubuntu Sans', sans-serif";
        this.weight = options?.weight ?? 400;
        if (options?.ctx) {
            this.ctx = options.ctx;
        }
        else {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Canvas 2D context not available');
            }
            this.ctx = ctx;
        }
    }
    measureTextWidth(request) {
        const w = request.weight ?? this.weight;
        this.ctx.font = `${w} ${request.fontSize}px ${this.fontFamily}`;
        let width = this.ctx.measureText(request.text).width;
        width += letterSpacingAdvance(request.text, request.letterSpacing, request.fontSize);
        return width;
    }
    /**
     * Wait for the configured font family to finish loading.
     * Call once after construction to guarantee accurate measurements.
     * Safe to call multiple times or skip if the page already loads fonts.
     */
    async ensureFontsReady() {
        await document.fonts.ready;
    }
}
//# sourceMappingURL=canvas-text-adapter.js.map