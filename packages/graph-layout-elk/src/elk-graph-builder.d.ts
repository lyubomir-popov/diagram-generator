import type { GraphLayoutInput } from '@diagram-generator/graph-layout-core';
import type { ElkLayoutOptions } from './layered-options.js';
/** Minimal ElkNode shape for building; elkjs types are permissive. */
export interface ElkGraphNode {
    id: string;
    width: number;
    height: number;
    children?: ElkGraphNode[];
    layoutOptions?: ElkLayoutOptions;
    labels?: {
        text: string;
    }[];
}
export interface ElkGraphEdge {
    id: string;
    sources: string[];
    targets: string[];
    labels?: {
        text: string;
        width: number;
        height: number;
    }[];
}
export interface ElkGraphRoot {
    id: string;
    layoutOptions: ElkLayoutOptions;
    children: ElkGraphNode[];
    edges: ElkGraphEdge[];
}
export declare function buildElkGraph(input: GraphLayoutInput, layoutOptions: ElkLayoutOptions): ElkGraphRoot;
export declare function buildElkGraphFromInput(input: GraphLayoutInput): ElkGraphRoot;
//# sourceMappingURL=elk-graph-builder.d.ts.map