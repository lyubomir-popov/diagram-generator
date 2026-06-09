/**
 * ELK Layered (Sugiyama) layout options aligned with planning `layout_mapping.py`.
 *
 * Reference: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
 * elkjs uses the same option keys as Eclipse ELK (prefix `elk.`).
 */
import type { LayeredCorpusFamily, LayoutDirection, SpacingProfile } from '@diagram-generator/graph-layout-core';
import { ELK_LAYERED_PARAM_SPECS } from './elk-param-registry.js';
export type ElkLayoutOptions = Record<string, string>;
export type { ElkParamSpec, ElkParamKind } from './elk-param-registry.js';
export { ELK_LAYERED_PARAM_SPECS, elkParamDefaults, elkParamSpecByKey, resolveElkLayoutOptions, } from './elk-param-registry.js';
export interface LayeredLayoutConfig {
    direction: LayoutDirection;
    spacingProfile: SpacingProfile;
    /** Override `elk.layered.spacing.nodeNodeBetweenLayers` (px). */
    betweenLayersPx?: number;
    /** Override `elk.spacing.nodeNode` (px). */
    sameLayerPx?: number;
    /** Session/YAML overrides keyed by full ELK option id. */
    optionOverrides?: Record<string, string>;
}
export declare function layeredConfigForFamily(family: LayeredCorpusFamily): LayeredLayoutConfig;
/**
 * Build ELK layoutOptions for org.eclipse.elk.layered (Sugiyama pipeline).
 */
export declare function buildLayeredLayoutOptions(config: LayeredLayoutConfig): ElkLayoutOptions;
/** Resolved defaults for preview UI (family + optional YAML/session overrides). */
export declare function resolvedElkOptionsForFamily(family: LayeredCorpusFamily, optionOverrides?: Record<string, string>): ElkLayoutOptions;
/** Param catalog grouped for sidebar rendering. */
export declare function elkParamGroups(): {
    group: string;
    specs: typeof ELK_LAYERED_PARAM_SPECS;
}[];
//# sourceMappingURL=layered-options.d.ts.map