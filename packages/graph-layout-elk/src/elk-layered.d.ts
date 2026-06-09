import type { GraphLayoutInput, GraphLayoutResult, LayeredCorpusFamily } from '@diagram-generator/graph-layout-core';
import { buildElkGraphFromInput } from './elk-graph-builder.js';
import { buildLayeredLayoutOptions, layeredConfigForFamily, resolvedElkOptionsForFamily, elkParamGroups, type LayeredLayoutConfig } from './layered-options.js';
export interface LayoutLayeredOptions {
    /** Override direction/spacing instead of input fields. */
    config?: LayeredLayoutConfig;
    /** Shorthand: merge into config.optionOverrides */
    optionOverrides?: Record<string, string>;
}
/**
 * Run ELK Layered (Sugiyama) on a graph IR document.
 * Does not touch frame autolayout or preview — integration is a separate phase.
 */
export declare function layoutLayered(input: GraphLayoutInput, options?: LayoutLayeredOptions): Promise<GraphLayoutResult>;
export declare function layoutLayeredForFamily(family: LayeredCorpusFamily, input: Omit<GraphLayoutInput, 'direction' | 'spacingProfile'>, optionOverrides?: Record<string, string>): Promise<GraphLayoutResult>;
export { buildElkGraphFromInput, layeredConfigForFamily, buildLayeredLayoutOptions, resolvedElkOptionsForFamily, elkParamGroups };
//# sourceMappingURL=elk-layered.d.ts.map