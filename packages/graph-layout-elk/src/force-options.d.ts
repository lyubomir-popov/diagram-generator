import type { ForceCorpusFamily } from '@diagram-generator/graph-layout-core';
export interface ForceLayoutConfig {
    spacingProfile: 'normal' | 'loose';
    optionOverrides?: Record<string, string>;
}
export type ElkForceLayoutOptions = Record<string, string>;
export declare function forceConfigForFamily(family: ForceCorpusFamily): ForceLayoutConfig;
export declare function buildForceLayoutOptions(config: ForceLayoutConfig): ElkForceLayoutOptions;
export declare function resolvedElkForceOptionsForFamily(family: ForceCorpusFamily, optionOverrides?: Record<string, string>): ElkForceLayoutOptions;
//# sourceMappingURL=force-options.d.ts.map