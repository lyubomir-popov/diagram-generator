import ELK from 'elkjs/lib/elk.bundled.js';
import { buildElkGraph } from './elk-graph-builder.js';
import { buildForceLayoutOptions, forceConfigForFamily, resolvedElkForceOptionsForFamily, } from './force-options.js';
import { normalizeElkLayoutResult } from './result-normalizer.js';
let sharedElk = null;
function getElk() {
    if (!sharedElk) {
        sharedElk = new ELK();
    }
    return sharedElk;
}
export async function layoutForce(input, options = {}) {
    const baseConfig = options.config ?? {
        spacingProfile: input.spacingProfile === 'loose' ? 'loose' : 'normal',
        optionOverrides: options.optionOverrides,
    };
    if (options.optionOverrides) {
        baseConfig.optionOverrides = {
            ...baseConfig.optionOverrides,
            ...options.optionOverrides,
        };
    }
    const layoutOptions = buildForceLayoutOptions(baseConfig);
    const elkGraph = buildElkGraph(input, layoutOptions);
    const laidOut = await getElk().layout(elkGraph);
    return normalizeElkLayoutResult(input, laidOut, 'elk-force');
}
export async function layoutForceForFamily(family, input, optionOverrides) {
    const config = forceConfigForFamily(family);
    if (optionOverrides) {
        config.optionOverrides = {
            ...config.optionOverrides,
            ...optionOverrides,
        };
    }
    return layoutForce({
        ...input,
        direction: 'TB',
        spacingProfile: config.spacingProfile,
    }, { config });
}
export { buildForceLayoutOptions, forceConfigForFamily, resolvedElkForceOptionsForFamily };
//# sourceMappingURL=elk-force.js.map