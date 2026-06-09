import { buildLayeredLayoutOptions } from './layered-options.js';
function mapNode(node, compoundPadding) {
    const hasChildren = Boolean(node.children?.length);
    return {
        id: node.id,
        width: node.width,
        height: node.height,
        ...(hasChildren
            ? {
                children: node.children.map((child) => mapNode(child, compoundPadding)),
                ...(compoundPadding
                    ? { layoutOptions: { 'elk.padding': compoundPadding } }
                    : {}),
            }
            : {}),
    };
}
export function buildElkGraph(input, layoutOptions) {
    const rootOptions = { ...layoutOptions };
    const compoundPadding = rootOptions['elk.padding'];
    delete rootOptions['elk.padding'];
    const edges = input.edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        ...(edge.labels?.length
            ? {
                labels: edge.labels.map((label) => ({
                    text: label.text,
                    width: label.width,
                    height: label.height,
                })),
            }
            : {}),
    }));
    return {
        id: input.id,
        layoutOptions: rootOptions,
        children: input.nodes.map((node) => mapNode(node, compoundPadding)),
        edges,
    };
}
export function buildElkGraphFromInput(input) {
    const layoutOptions = buildLayeredLayoutOptions({
        direction: input.direction,
        spacingProfile: input.spacingProfile ?? 'normal',
    });
    return buildElkGraph(input, layoutOptions);
}
//# sourceMappingURL=elk-graph-builder.js.map