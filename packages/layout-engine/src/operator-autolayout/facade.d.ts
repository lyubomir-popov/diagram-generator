import { type ComponentInfo } from "../component-tree.js";
import { type AutolayoutDocument } from "../document-model/schema.js";
import { type GridInfo } from "../grid-info.js";
import { type LayoutOptions, type LayoutOutput } from "../layout.js";
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
export interface AutolayoutOperatorParams extends LayoutOptions {
}
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
export declare function evaluateAutolayoutOperator(document: AutolayoutDocument, textAdapter: TextMeasureAdapter, params?: AutolayoutOperatorParams): AutolayoutOperatorOutputs;
export declare const AUTOLAYOUT_OPERATOR_FACADE: {
    key: string;
    version: string;
    inputs: {
        key: string;
        kind: string;
        required: true;
    }[];
    outputs: {
        key: string;
        kind: string;
    }[];
    parameters: ({
        key: string;
        type: "integer";
        defaultValue: number;
    } | {
        key: string;
        type: "integer";
        defaultValue?: undefined;
    })[];
    evaluate(ctx: EvaluateContext<AutolayoutOperatorInputs, AutolayoutOperatorParams>): AutolayoutOperatorOutputs;
};
//# sourceMappingURL=facade.d.ts.map