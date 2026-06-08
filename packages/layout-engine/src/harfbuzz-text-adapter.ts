/// <reference lib="dom" />

import * as hb from 'harfbuzzjs';

import {
  letterSpacingAdvance,
  type TextMeasureAdapter,
  type TextMeasureRequest,
} from './text-measure.js';
import type { ShapedGlyph, ShapedRun } from './render-ir.js';

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

export class HarfBuzzTextAdapter implements TextMeasureAdapter {
  readonly measurementBackend = 'harfbuzz';

  private readonly blob: hb.Blob;
  private readonly face: hb.Face;
  private readonly upem: number;
  private readonly defaultWeight: number;
  private readonly widthAxis: number;
  private readonly fontUri: string;
  private readonly fonts = new Map<number, hb.Font>();

  constructor(options: HarfBuzzTextAdapterOptions) {
    this.defaultWeight = options.defaultWeight ?? 400;
    this.widthAxis = options.widthAxis ?? 100;
    this.fontUri = options.fontUri ?? 'diagram-generator:ubuntu-sans';
    this.blob = new hb.Blob(options.fontData);
    this.face = new hb.Face(this.blob, 0);
    this.upem = this.face.upem;
  }

  private getFont(weight: number): hb.Font {
    const cached = this.fonts.get(weight);
    if (cached) return cached;

    const font = new hb.Font(this.face);
    font.setVariations([
      new hb.Variation('wght', weight),
      new hb.Variation('wdth', this.widthAxis),
    ]);
    this.fonts.set(weight, font);
    return font;
  }

  measureTextWidth(request: TextMeasureRequest): number {
    if (!request.text) return 0;

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

  shapeTextRun(
    request: TextMeasureRequest & { fontFamily?: string | null },
  ): ShapedRun {
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
    const glyphs: ShapedGlyph[] = positions.map((glyph) => ({
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

export async function createHarfBuzzTextAdapter(
  options: HarfBuzzTextAdapterOptions | HarfBuzzTextAdapterFetchOptions,
): Promise<HarfBuzzTextAdapter> {
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

export async function createDefaultHarfBuzzTextAdapter(
  options?: Partial<HarfBuzzTextAdapterFetchOptions>,
): Promise<HarfBuzzTextAdapter> {
  return createHarfBuzzTextAdapter({
    fontUrl: options?.fontUrl ?? '/preview/layout-font.ttf',
    defaultWeight: options?.defaultWeight,
    widthAxis: options?.widthAxis,
    fetchImpl: options?.fetchImpl,
    fontUri: options?.fontUri,
  });
}
