import type { PlacedNode, Point2, RoutedEdgeSection } from '@diagram-generator/graph-layout-core';
/** ELK returns nested x/y relative to each parent — accumulate to layout-root space. */
export declare function toAbsolutePlacedNodes(nodes: PlacedNode[]): PlacedNode[];
export declare function indexPlacedNodes(nodes: PlacedNode[]): Map<string, PlacedNode>;
export interface NodeRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare function leafNodeRects(nodes: PlacedNode[]): NodeRect[];
/** Distance from point to nearest point on rect boundary (0 if inside). */
export declare function distanceToRectBoundary(p: Point2, r: NodeRect): number;
export declare function nearestLeafBoundaryDistance(p: Point2, leaves: NodeRect[]): number;
export declare function edgeEndpointsTouchLeaves(section: RoutedEdgeSection, leaves: NodeRect[], tolerancePx?: number): boolean;
export declare function edgeEndpointsTouchEndpointNodes(section: RoutedEdgeSection, edge: {
    source: string;
    target: string;
}, nodes: Map<string, PlacedNode>, tolerancePx?: number): boolean;
//# sourceMappingURL=node-bounds.d.ts.map