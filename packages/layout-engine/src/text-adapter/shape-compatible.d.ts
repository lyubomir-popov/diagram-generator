import { type LineSpec, type TextMeasureAdapter, type TextMeasureRequest } from "../text-measure.js";
import type { ShapedRun } from "../render-ir.js";
export interface ShapeTextRunRequest extends TextMeasureRequest {
    readonly fontFamily?: string | null;
}
export interface TextShapeCompatibleAdapter extends TextMeasureAdapter {
    shapeTextRun(request: ShapeTextRunRequest): ShapedRun;
}
export declare function isTextShapeCompatibleAdapter(adapter: TextMeasureAdapter): adapter is TextShapeCompatibleAdapter;
export declare function shapeLineSpec(adapter: TextMeasureAdapter, spec: LineSpec): ShapedRun;
//# sourceMappingURL=shape-compatible.d.ts.map