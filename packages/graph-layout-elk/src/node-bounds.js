/** ELK returns nested x/y relative to each parent — accumulate to layout-root space. */
export function toAbsolutePlacedNodes(nodes) {
    function mapNode(node, parentX, parentY) {
        const x = node.x + parentX;
        const y = node.y + parentY;
        return {
            ...node,
            x,
            y,
            ...(node.children?.length
                ? { children: node.children.map((child) => mapNode(child, x, y)) }
                : {}),
        };
    }
    return nodes.map((n) => mapNode(n, 0, 0));
}
export function indexPlacedNodes(nodes) {
    const map = new Map();
    function walk(list) {
        for (const node of list) {
            map.set(node.id, node);
            if (node.children?.length)
                walk(node.children);
        }
    }
    walk(nodes);
    return map;
}
export function leafNodeRects(nodes) {
    const out = [];
    function walk(list) {
        for (const node of list) {
            if (node.children?.length) {
                walk(node.children);
            }
            else {
                out.push({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height });
            }
        }
    }
    walk(nodes);
    return out;
}
/** Distance from point to nearest point on rect boundary (0 if inside). */
export function distanceToRectBoundary(p, r) {
    const inside = p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
    if (inside)
        return 0;
    const dx = p.x < r.x ? r.x - p.x : p.x > r.x + r.width ? p.x - (r.x + r.width) : 0;
    const dy = p.y < r.y ? r.y - p.y : p.y > r.y + r.height ? p.y - (r.y + r.height) : 0;
    return Math.hypot(dx, dy);
}
export function nearestLeafBoundaryDistance(p, leaves) {
    if (!leaves.length)
        return Infinity;
    return Math.min(...leaves.map((r) => distanceToRectBoundary(p, r)));
}
export function edgeEndpointsTouchLeaves(section, leaves, tolerancePx = 2) {
    const startOk = nearestLeafBoundaryDistance(section.startPoint, leaves) <= tolerancePx;
    const endOk = nearestLeafBoundaryDistance(section.endPoint, leaves) <= tolerancePx;
    return startOk && endOk;
}
export function edgeEndpointsTouchEndpointNodes(section, edge, nodes, tolerancePx = 3) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target)
        return false;
    const sourceRect = {
        id: source.id,
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
    };
    const targetRect = {
        id: target.id,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
    };
    return (distanceToRectBoundary(section.startPoint, sourceRect) <= tolerancePx &&
        distanceToRectBoundary(section.endPoint, targetRect) <= tolerancePx);
}
//# sourceMappingURL=node-bounds.js.map