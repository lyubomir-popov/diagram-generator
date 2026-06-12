import {
  type LineSpec,
  type TextMeasureAdapter,
  type TextMeasureRequest,
  lineSpecToMeasureRequest,
} from "../text-measure.js";
import type { ShapedRun } from "../render-ir.js";

export interface ShapeTextRunRequest extends TextMeasureRequest {
  readonly fontFamily?: string | null;
}

export interface TextShapeCompatibleAdapter extends TextMeasureAdapter {
  shapeTextRun(request: ShapeTextRunRequest): ShapedRun;
}

export function isTextShapeCompatibleAdapter(
  adapter: TextMeasureAdapter,
): adapter is TextShapeCompatibleAdapter {
  return typeof (adapter as Partial<TextShapeCompatibleAdapter>).shapeTextRun === "function";
}

export function shapeLineSpec(adapter: TextMeasureAdapter, spec: LineSpec): ShapedRun {
  const request: ShapeTextRunRequest = {
    ...lineSpecToMeasureRequest(spec),
    fontFamily: spec.fontFamily ?? null,
  };
  if (isTextShapeCompatibleAdapter(adapter)) {
    return adapter.shapeTextRun(request);
  }
  return {
    fontRef: {
      kind: "font",
      uri: `diagram-generator:${adapter.measurementBackend}`,
    },
    fontSize: request.fontSize,
    glyphs: [],
    text: request.text,
    fontFamily: request.fontFamily ?? "Ubuntu Sans",
    fontWeight: request.weight ?? 400,
    letterSpacing: request.letterSpacing ?? null,
    smallCaps: false,
  };
}
