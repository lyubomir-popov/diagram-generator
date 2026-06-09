import type { GraphLayoutInput, GraphLayoutResult } from '@diagram-generator/graph-layout-core';
interface ElkLayoutPoint {
    x?: number;
    y?: number;
}
interface ElkLayoutSection {
    startPoint?: ElkLayoutPoint;
    endPoint?: ElkLayoutPoint;
    bendPoints?: ElkLayoutPoint[];
}
interface ElkLayoutLabel {
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
interface ElkLayoutEdge {
    id: string;
    sources?: string[];
    targets?: string[];
    sections?: ElkLayoutSection[];
    labels?: ElkLayoutLabel[];
    /** ELK: edge path coordinates are relative to this compound node (or root graph id). */
    container?: string;
}
interface ElkLayoutNode {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkLayoutNode[];
    edges?: ElkLayoutEdge[];
}
export declare function normalizeElkLayoutResult(input: GraphLayoutInput, elkRoot: ElkLayoutNode, engine?: GraphLayoutResult['engine']): GraphLayoutResult;
/** Flat index of placed nodes by id (includes nested). Re-export from node-bounds. */
export { indexPlacedNodes } from './node-bounds.js';
//# sourceMappingURL=result-normalizer.d.ts.map