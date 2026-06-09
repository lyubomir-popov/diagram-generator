import { type TextMeasureAdapter, type TextMeasureRequest } from './text-measure.js';
import type { ShapedRun } from './render-ir.js';
export interface HarfBuzzTextAdapterOptions {
    fontData: ArrayBuffer;
    defaultWeight?: number;
    widthAxis?: number;
    fontUri?: string;
}
export interface HarfBuzzTextAdapterFetchOptions {
    fontUrl: string;
    defaultWeight?: number;
    widthAxis?: number;
    fetchImpl?: typeof fetch;
    fontUri?: string;
}
export declare class HarfBuzzTextAdapter implements TextMeasureAdapter {
    readonly measurementBackend = "harfbuzz";
    private readonly blob;
    private readonly face;
    private readonly upem;
    private readonly defaultWeight;
    private readonly widthAxis;
    private readonly fontUri;
    private readonly fonts;
    constructor(options: HarfBuzzTextAdapterOptions);
    private getFont;
    measureTextWidth(request: TextMeasureRequest): number;
    shapeTextRun(request: TextMeasureRequest & {
        fontFamily?: string | null;
    }): ShapedRun;
}
export declare function createHarfBuzzTextAdapter(options: HarfBuzzTextAdapterOptions | HarfBuzzTextAdapterFetchOptions): Promise<HarfBuzzTextAdapter>;
export declare function createDefaultHarfBuzzTextAdapter(options?: Partial<HarfBuzzTextAdapterFetchOptions>): Promise<HarfBuzzTextAdapter>;
//# sourceMappingURL=harfbuzz-text-adapter.d.ts.map