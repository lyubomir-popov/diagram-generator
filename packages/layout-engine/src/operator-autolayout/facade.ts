import { buildComponentTree, type ComponentInfo } from "../component-tree.js";
import {
  AUTOLAYOUT_DOCUMENT_KIND,
  type AutolayoutDocument,
  toFrameDiagram,
} from "../document-model/schema.js";
import { buildGridInfo, type GridInfo } from "../grid-info.js";
import { layoutFrameTree, type LayoutOptions, type LayoutOutput } from "../layout.js";
import { emitFrameDiagramDisplayList } from "../render-adapter/display-list.js";
import type { DisplayList, DisplayListItem, Viewport } from "../render-ir.js";
import type { TextMeasureAdapter } from "../text-measure.js";

export interface InputPort {
  readonly key: string;
  readonly kind: string;
  readonly required?: boolean;
}

export interface OutputPort {
  readonly key: string;
  readonly kind: string;
}

export type ParameterType = "number" | "integer" | "boolean";

export interface ParameterField {
  readonly key: string;
  readonly type: ParameterType;
  readonly defaultValue?: unknown;
}

export interface EvaluateContext<TInputs extends object, TParams> {
  readonly nodeId: string;
  readonly params: TParams;
  readonly inputs: Readonly<TInputs>;
}

export interface OperatorDefinition<TInputs extends object, TOutputs extends object, TParams> {
  readonly key: string;
  readonly version: string;
  readonly inputs: readonly InputPort[];
  readonly outputs: readonly OutputPort[];
  readonly parameters?: readonly ParameterField[];
  evaluate(ctx: EvaluateContext<TInputs, TParams>): TOutputs;
}

export interface AutolayoutOperatorParams extends LayoutOptions {}

export interface AutolayoutOperatorInputs {
  readonly document: AutolayoutDocument;
  readonly textAdapter: TextMeasureAdapter;
}

export interface AutolayoutOperatorOutputs {
  readonly layout: LayoutOutput;
  readonly viewport: Viewport;
  readonly displayList: readonly DisplayListItem[];
  readonly displayListDocument: DisplayList;
  readonly componentTree: ComponentInfo[];
  readonly gridInfo: GridInfo;
}

export function evaluateAutolayoutOperator(
  document: AutolayoutDocument,
  textAdapter: TextMeasureAdapter,
  params: AutolayoutOperatorParams = {},
): AutolayoutOperatorOutputs {
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
  evaluate(ctx: EvaluateContext<AutolayoutOperatorInputs, AutolayoutOperatorParams>): AutolayoutOperatorOutputs {
    return evaluateAutolayoutOperator(ctx.inputs.document, ctx.inputs.textAdapter, ctx.params);
  },
} satisfies OperatorDefinition<AutolayoutOperatorInputs, AutolayoutOperatorOutputs, AutolayoutOperatorParams>;
