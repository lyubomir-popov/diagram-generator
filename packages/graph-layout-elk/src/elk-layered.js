import ELK from 'elkjs/lib/elk.bundled.js';
import { buildElkGraphFromInput, buildElkGraph } from './elk-graph-builder.js';
import { buildLayeredLayoutOptions, layeredConfigForFamily, resolvedElkOptionsForFamily, elkParamGroups, } from './layered-options.js';
import { normalizeElkLayoutResult } from './result-normalizer.js';
let sharedElk = null;
function getElk() {
    if (!sharedElk) {
        // Bundled build runs ELK in-process (no Web Worker). Same algorithm as Eclipse ELK Java.
        sharedElk = new ELK();
    }
    return sharedElk;
}
/**
 * Run ELK Layered (Sugiyama) on a graph IR document.
 * Does not touch frame autolayout or preview — integration is a separate phase.
 */
export async function layoutLayered(input, options = {}) {
    const familyDirection = input.direction;
    const baseConfig = options.config ?? {
        direction: familyDirection,
        spacingProfile: input.spacingProfile ?? 'normal',
        optionOverrides: options.optionOverrides,
    };
    if (options.optionOverrides) {
        baseConfig.optionOverrides = {
            ...baseConfig.optionOverrides,
            ...options.optionOverrides,
        };
    }
    const layoutOptions = buildLayeredLayoutOptions(baseConfig);
    const elkGraph = buildElkGraph(input, layoutOptions);
    const elk = getElk();
    const laidOut = await elk.layout(elkGraph);
    return normalizeElkLayoutResult(input, laidOut);
}
export async function layoutLayeredForFamily(family, input, optionOverrides) {
    const config = layeredConfigForFamily(family);
    if (optionOverrides) {
        config.optionOverrides = {
            ...config.optionOverrides,
            ...optionOverrides,
        };
    }
    return layoutLayered({
        ...input,
        direction: config.direction,
        spacingProfile: config.spacingProfile,
    }, { config });
}
export { buildElkGraphFromInput, layeredConfigForFamily, buildLayeredLayoutOptions, resolvedElkOptionsForFamily, elkParamGroups };
//# sourceMappingURL=elk-layered.js.map