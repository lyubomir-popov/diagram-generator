import type { ForceCorpusFamily, GraphLayoutInput, GraphLayoutResult } from '@diagram-generator/graph-layout-core';
import { buildForceLayoutOptions, forceConfigForFamily, resolvedElkForceOptionsForFamily, type ForceLayoutConfig } from './force-options.js';
export interface LayoutForceOptions {
    config?: ForceLayoutConfig;
    optionOverrides?: Record<string, string>;
}
export declare function layoutForce(input: GraphLayoutInput, options?: LayoutForceOptions): Promise<GraphLayoutResult>;
export declare function layoutForceForFamily(family: ForceCorpusFamily, input: Omit<GraphLayoutInput, 'direction' | 'spacingProfile'>, optionOverrides?: Record<string, string>): Promise<GraphLayoutResult>;
export { buildForceLayoutOptions, forceConfigForFamily, resolvedElkForceOptionsForFamily };
//# sourceMappingURL=elk-force.d.ts.map