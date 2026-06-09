import { buildComponentTree } from "../component-tree.js";
import { AUTOLAYOUT_DOCUMENT_KIND, toFrameDiagram, } from "../document-model/schema.js";
import { buildGridInfo } from "../grid-info.js";
import { layoutFrameTree } from "../layout.js";
import { emitFrameDiagramDisplayList } from "../render-adapter/display-list.js";
export function evaluateAutolayoutOperator(document, textAdapter, params = {}) {
    if (document.kind !== AUTOLAYOUT_DOCUMENT_KIND) {
        throw new Error(`Unsupported autolayout document kind: ${document.kind}`);
    }
    const diagram = toFrameDiagram(document);
    const layout = layoutFrameTree(diagram.root, textAdapter, params);
    const displayListDocument = emitFrameDiagramDisplayList(diagram, layout, textAdapter);
    return {
        layout,
        viewport: displayListDocument.viewport,
        displayList: displayListDocument.items,
        displayListDocument,
        componentTree: buildComponentTree(diagram.root),
        gridInfo: buildGridInfo(diagram, diagram.root),
    };
}
export const AUTOLAYOUT_OPERATOR_FACADE = {
    key: "@diagram-generator/operator-autolayout",
    version: "0.1.0",
    inputs: [
        { key: "document", kind: AUTOLAYOUT_DOCUMENT_KIND, required: true },
        { key: "textAdapter", kind: "text-measure-adapter", required: true },
    ],
    outputs: [
        { key: "layout", kind: "layout-output" },
        { key: "viewport", kind: "viewport" },
        { key: "displayList", kind: "display-list" },
        { key: "componentTree", kind: "component-tree" },
        { key: "gridInfo", kind: "grid-info" },
    ],
    parameters: [
        { key: "gridStep", type: "integer", defaultValue: 8 },
        { key: "gridCols", type: "integer" },
        { key: "gridColGap", type: "integer" },
        { key: "gridOuterMargin", type: "integer" },
    ],
    evaluate(ctx) {
        return evaluateAutolayoutOperator(ctx.inputs.document, ctx.inputs.textAdapter, ctx.params);
    },
};
//# sourceMappingURL=facade.js.map