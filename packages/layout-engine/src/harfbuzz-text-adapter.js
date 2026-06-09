/// <reference lib="dom" />
import * as hb from 'harfbuzzjs';
import { letterSpacingAdvance, } from './text-measure.js';
export class HarfBuzzTextAdapter {
    measurementBackend = 'harfbuzz';
    blob;
    face;
    upem;
    defaultWeight;
    widthAxis;
    fontUri;
    fonts = new Map();
    constructor(options) {
        this.defaultWeight = options.defaultWeight ?? 400;
        this.widthAxis = options.widthAxis ?? 100;
        this.fontUri = options.fontUri ?? 'diagram-generator:ubuntu-sans';
        this.blob = new hb.Blob(options.fontData);
        this.face = new hb.Face(this.blob, 0);
        this.upem = this.face.upem;
    }
    getFont(weight) {
        const cached = this.fonts.get(weight);
        if (cached)
            return cached;
        const font = new hb.Font(this.face);
        font.setVariations([
            new hb.Variation('wght', weight),
            new hb.Variation('wdth', this.widthAxis),
        ]);
        this.fonts.set(weight, font);
        return font;
    }
    measureTextWidth(request) {
        if (!request.text)
            return 0;
        const weight = request.weight ?? this.defaultWeight;
        const font = this.getFont(weight);
        const buffer = new hb.Buffer();
        buffer.addText(request.text);
        buffer.guessSegmentProperties();
        const features = request.smallCaps
            ? [new hb.Feature('smcp', 1), new hb.Feature('c2sc', 1)]
            : undefined;
        hb.shape(font, buffer, features);
        const positions = buffer.getGlyphInfosAndPositions();
        let width = positions.reduce((sum, glyph) => sum + (glyph.xAdvance ?? 0), 0);
        width = (width * request.fontSize) / this.upem;
        width += letterSpacingAdvance(request.text, request.letterSpacing, request.fontSize);
        return width;
    }
    shapeTextRun(request) {
        const weight = request.weight ?? this.defaultWeight;
        const font = this.getFont(weight);
        const buffer = new hb.Buffer();
        buffer.addText(request.text);
        buffer.guessSegmentProperties();
        const features = request.smallCaps
            ? [new hb.Feature('smcp', 1), new hb.Feature('c2sc', 1)]
            : undefined;
        hb.shape(font, buffer, features);
        const positions = buffer.getGlyphInfosAndPositions();
        const glyphs = positions.map((glyph) => ({
            glyphId: glyph.codepoint,
            cluster: glyph.cluster,
            xAdvance: ((glyph.xAdvance ?? 0) * request.fontSize) / this.upem,
            yAdvance: ((glyph.yAdvance ?? 0) * request.fontSize) / this.upem,
            xOffset: ((glyph.xOffset ?? 0) * request.fontSize) / this.upem,
            yOffset: ((glyph.yOffset ?? 0) * request.fontSize) / this.upem,
        }));
        return {
            fontRef: {
                kind: 'font',
                uri: this.fontUri,
            },
            fontSize: request.fontSize,
            glyphs,
            text: request.text,
            fontFamily: request.fontFamily ?? 'Ubuntu Sans',
            fontWeight: weight,
            letterSpacing: request.letterSpacing ?? null,
            smallCaps: request.smallCaps ?? false,
        };
    }
}
export async function createHarfBuzzTextAdapter(options) {
    if ('fontData' in options) {
        return new HarfBuzzTextAdapter(options);
    }
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(options.fontUrl);
    if (!response.ok) {
        throw new Error(`Failed to load HarfBuzz font: ${response.status} ${response.statusText}`);
    }
    const fontData = await response.arrayBuffer();
    return new HarfBuzzTextAdapter({
        fontData,
        defaultWeight: options.defaultWeight,
        widthAxis: options.widthAxis,
        fontUri: options.fontUri ?? options.fontUrl,
    });
}
export async function createDefaultHarfBuzzTextAdapter(options) {
    return createHarfBuzzTextAdapter({
        fontUrl: options?.fontUrl ?? '/preview/layout-font.ttf',
        defaultWeight: options?.defaultWeight,
        widthAxis: options?.widthAxis,
        fetchImpl: options?.fetchImpl,
        fontUri: options?.fontUri,
    });
}
//# sourceMappingURL=harfbuzz-text-adapter.js.map