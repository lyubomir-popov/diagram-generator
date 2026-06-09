import { lineSpecToMeasureRequest, } from "../text-measure.js";
export function isTextShapeCompatibleAdapter(adapter) {
    return typeof adapter.shapeTextRun === "function";
}
export function shapeLineSpec(adapter, spec) {
    const request = {
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
        smallCaps: request.smallCaps ?? false,
    };
}
//# sourceMappingURL=shape-compatible.js.map