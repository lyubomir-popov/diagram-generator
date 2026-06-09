/**
 * Catalog of ELK layered layout options exposed to preview UI and YAML meta.elk.
 * Keys match elkjs / Eclipse ELK (prefix `elk.`).
 */
/** All layered options we wire today — defaults match buildLayeredLayoutOptions(). */
export const ELK_LAYERED_PARAM_SPECS = [
    {
        key: 'elk.direction',
        label: 'Direction',
        group: 'Graph',
        kind: 'enum',
        defaultValue: 'DOWN',
        enumValues: [
            { value: 'DOWN', label: 'Top → bottom (TB)' },
            { value: 'RIGHT', label: 'Left → right (LR)' },
            { value: 'UP', label: 'Bottom → top' },
            { value: 'LEFT', label: 'Right → left' },
        ],
        description: 'Primary flow direction for layered layout.',
    },
    {
        key: 'elk.layered.spacing.nodeNodeBetweenLayers',
        label: 'Layer gap',
        group: 'Spacing',
        kind: 'number',
        defaultValue: '24',
        min: 8,
        max: 512,
        step: 8,
        description: 'Vertical gap between layers — main control for arrow length (TB).',
    },
    {
        key: 'elk.spacing.nodeNode',
        label: 'Same-layer gap',
        group: 'Spacing',
        kind: 'number',
        defaultValue: '24',
        min: 8,
        max: 256,
        step: 8,
        description: 'Horizontal gap between nodes in the same layer.',
    },
    {
        key: 'elk.spacing.edgeNode',
        label: 'Edge ↔ node',
        group: 'Spacing',
        kind: 'number',
        defaultValue: '24',
        min: 0,
        max: 128,
        step: 4,
        description: 'Clearance between edge routes and node boxes during ELK routing (does not move step labels).',
    },
    {
        key: 'elk.spacing.edgeEdge',
        label: 'Edge ↔ edge',
        group: 'Spacing',
        kind: 'number',
        defaultValue: '24',
        min: 0,
        max: 128,
        step: 4,
        description: 'Gap between parallel edges — reduces overlap.',
    },
    {
        key: 'elk.layered.spacing.edgeEdgeBetweenLayers',
        label: 'Edge gap (layers)',
        group: 'Spacing',
        kind: 'number',
        defaultValue: '24',
        min: 0,
        max: 128,
        step: 4,
        description: 'Gap between edges that span adjacent layers.',
    },
    {
        key: 'elk.edgeRouting',
        label: 'Edge routing',
        group: 'Edges',
        kind: 'enum',
        defaultValue: 'ORTHOGONAL',
        enumValues: [
            { value: 'ORTHOGONAL', label: 'Orthogonal' },
            { value: 'POLYLINE', label: 'Polyline' },
            { value: 'SPLINES', label: 'Splines' },
        ],
    },
    {
        key: 'elk.layered.unnecessaryBendpoints',
        label: 'Remove extra bends',
        group: 'Edges',
        kind: 'boolean',
        defaultValue: 'true',
        description: 'Drop bend points that do not change routing.',
    },
    {
        key: 'elk.layered.nodePlacement.favorStraightEdges',
        label: 'Favor straight edges',
        group: 'Edges',
        kind: 'boolean',
        defaultValue: 'true',
    },
    {
        key: 'elk.layered.layering.strategy',
        label: 'Layering strategy',
        group: 'Layering',
        kind: 'enum',
        defaultValue: 'NETWORK_SIMPLEX',
        enumValues: [
            { value: 'NETWORK_SIMPLEX', label: 'Network simplex' },
            { value: 'LONGEST_PATH', label: 'Longest path' },
            { value: 'INTERACTIVE', label: 'Interactive (needs layer hints)' },
        ],
        description: 'Batch layout only. INTERACTIVE reuses prior layer positions / layerChoiceConstraint — not drag-to-move nodes in this preview.',
    },
    {
        key: 'elk.layered.crossingMinimization.strategy',
        label: 'Crossing minimization',
        group: 'Layering',
        kind: 'enum',
        defaultValue: 'LAYER_SWEEP',
        enumValues: [
            { value: 'LAYER_SWEEP', label: 'Layer sweep' },
            { value: 'INTERACTIVE', label: 'Interactive (needs order hints)' },
        ],
        description: 'INTERACTIVE preserves prior in-layer order; requires constraints from an interactive editor run.',
    },
    {
        key: 'elk.layered.nodePlacement.strategy',
        label: 'Node placement',
        group: 'Layering',
        kind: 'enum',
        defaultValue: 'BRANDES_KOEPF',
        enumValues: [
            { value: 'NETWORK_SIMPLEX', label: 'Network simplex' },
            { value: 'BRANDES_KOEPF', label: 'Brandes-Köpf' },
            { value: 'LINEAR_SEGMENTS', label: 'Linear segments' },
            { value: 'SIMPLE', label: 'Simple' },
        ],
    },
    {
        key: 'elk.hierarchyHandling',
        label: 'Hierarchy handling',
        group: 'Compound',
        kind: 'enum',
        defaultValue: 'INCLUDE_CHILDREN',
        enumValues: [
            { value: 'INCLUDE_CHILDREN', label: 'Include children' },
            { value: 'SEPARATE_CHILDREN', label: 'Separate children' },
            { value: 'CHILDREN_ON', label: 'Children on' },
        ],
        description: 'Affects ELK compound nodes only. This corpus has few compounds — changes may be subtle unless sections are nested.',
    },
    {
        key: 'elk.portConstraints',
        label: 'Port constraints',
        group: 'Compound',
        kind: 'enum',
        defaultValue: 'FREE',
        enumValues: [
            { value: 'FREE', label: 'Free' },
            { value: 'FIXED_SIDE', label: 'Fixed side' },
            { value: 'FIXED_ORDER', label: 'Fixed order' },
            { value: 'FIXED_RATIO', label: 'Fixed ratio' },
        ],
    },
    {
        key: 'elk.padding',
        label: 'Compound padding',
        group: 'Compound',
        kind: 'text',
        defaultValue: '[top=0,left=0,bottom=0,right=0]',
        description: 'ELK padding inside compound (section) nodes — applied per compound, not the page root.',
    },
];
export function elkParamDefaults() {
    const out = { 'elk.algorithm': 'layered' };
    for (const spec of ELK_LAYERED_PARAM_SPECS) {
        out[spec.key] = spec.defaultValue;
    }
    return out;
}
export function elkParamSpecByKey() {
    return new Map(ELK_LAYERED_PARAM_SPECS.map((s) => [s.key, s]));
}
/** Merge family defaults + YAML/session overrides into ELK layoutOptions map. */
export function resolveElkLayoutOptions(baseOptions, userOverrides) {
    const merged = { ...baseOptions };
    if (!userOverrides)
        return merged;
    for (const [key, raw] of Object.entries(userOverrides)) {
        if (raw == null || raw === '') {
            delete merged[key];
            continue;
        }
        merged[key] = String(raw);
    }
    return merged;
}
//# sourceMappingURL=elk-param-registry.js.map