function unreachableForceFamily(family) {
    throw new Error(`Unhandled force corpus family: ${family}`);
}
export function forceConfigForFamily(family) {
    switch (family) {
        case 'system_architecture':
        case 'concept_and_relationship_mapping':
            return { spacingProfile: 'loose' };
        case 'infrastructure_and_network_topology':
        case 'data_model_and_relationships':
            return { spacingProfile: 'normal' };
        default:
            return unreachableForceFamily(family);
    }
}
export function buildForceLayoutOptions(config) {
    const spacing = config.spacingProfile === 'loose' ? 96 : 72;
    return {
        'elk.algorithm': 'force',
        'elk.spacing.nodeNode': String(spacing),
        'elk.separateConnectedComponents': 'false',
        'elk.randomSeed': '0',
        ...(config.optionOverrides ?? {}),
    };
}
export function resolvedElkForceOptionsForFamily(family, optionOverrides) {
    const config = forceConfigForFamily(family);
    if (optionOverrides) {
        config.optionOverrides = {
            ...config.optionOverrides,
            ...optionOverrides,
        };
    }
    return buildForceLayoutOptions(config);
}
//# sourceMappingURL=force-options.js.map