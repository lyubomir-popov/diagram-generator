/**
 * ELK Layered (Sugiyama) layout options aligned with planning `layout_mapping.py`.
 *
 * Reference: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
 * elkjs uses the same option keys as Eclipse ELK (prefix `elk.`).
 */
import { ELK_LAYERED_PARAM_SPECS, elkParamDefaults, resolveElkLayoutOptions, } from './elk-param-registry.js';
export { ELK_LAYERED_PARAM_SPECS, elkParamDefaults, elkParamSpecByKey, resolveElkLayoutOptions, } from './elk-param-registry.js';
const DIRECTION = {
    TB: 'DOWN',
    LR: 'RIGHT',
};
/** Between-layer spacing (nodeNodeBetweenLayers) in px. */
const BETWEEN_LAYERS = {
    compact: '16',
    normal: '24',
    loose: '48',
};
/** Same-layer node spacing (nodeNode) in px. */
const SAME_LAYER = {
    compact: '16',
    normal: '24',
    loose: '32',
};
function unreachableLayeredFamily(family) {
    throw new Error(`Unhandled layered corpus family: ${family}`);
}
export function layeredConfigForFamily(family) {
    switch (family) {
        case 'data_flow_and_integration':
            return { direction: 'LR', spacingProfile: 'normal' };
        case 'deployment_and_runtime_topology':
            return { direction: 'TB', spacingProfile: 'normal' };
        case 'process_and_workflow':
            return {
                direction: 'TB',
                spacingProfile: 'normal',
                optionOverrides: {
                    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
                    'elk.padding': '[top=0,left=0,bottom=0,right=0]',
                },
            };
        default:
            return unreachableLayeredFamily(family);
    }
}
/**
 * Build ELK layoutOptions for org.eclipse.elk.layered (Sugiyama pipeline).
 */
export function buildLayeredLayoutOptions(config) {
    const { direction, spacingProfile } = config;
    const overrides = config.optionOverrides ?? {};
    const defaultDirection = DIRECTION[direction];
    const defaultBetweenLayers = BETWEEN_LAYERS[spacingProfile];
    const defaultSameLayer = SAME_LAYER[spacingProfile];
    const base = elkParamDefaults();
    base['elk.direction'] = defaultDirection;
    // YAML/session overrides must win — never let family betweenLayersPx clobber saved meta.elk.
    base['elk.layered.spacing.nodeNodeBetweenLayers'] = String(overrides['elk.layered.spacing.nodeNodeBetweenLayers']
        ?? config.betweenLayersPx
        ?? defaultBetweenLayers);
    base['elk.spacing.nodeNode'] = String(overrides['elk.spacing.nodeNode']
        ?? config.sameLayerPx
        ?? defaultSameLayer);
    base['elk.edgeLabels.inline'] = 'true';
    return resolveElkLayoutOptions(base, config.optionOverrides);
}
/** Resolved defaults for preview UI (family + optional YAML/session overrides). */
export function resolvedElkOptionsForFamily(family, optionOverrides) {
    const config = layeredConfigForFamily(family);
    config.optionOverrides = {
        ...(config.optionOverrides ?? {}),
        ...(optionOverrides ?? {}),
    };
    return buildLayeredLayoutOptions(config);
}
/** Param catalog grouped for sidebar rendering. */
export function elkParamGroups() {
    const order = ['Graph', 'Spacing', 'Edges', 'Layering', 'Compound'];
    const buckets = new Map();
    for (const spec of ELK_LAYERED_PARAM_SPECS) {
        const list = buckets.get(spec.group) ?? [];
        list.push(spec);
        buckets.set(spec.group, list);
    }
    return order
        .filter((g) => buckets.has(g))
        .map((group) => ({ group, specs: buckets.get(group) }));
}
//# sourceMappingURL=layered-options.js.map