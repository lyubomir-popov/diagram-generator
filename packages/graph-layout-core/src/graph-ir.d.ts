/** Canonical graph layout input/output IR (engine-agnostic). */
export type LayoutDirection = 'TB' | 'LR';
export type SpacingProfile = 'compact' | 'normal' | 'loose';
/** Matches planning `layout_mapping.py` layered families. */
export type LayeredCorpusFamily = 'deployment_and_runtime_topology' | 'process_and_workflow' | 'data_flow_and_integration';
/** Matches planning `layout_mapping.py` ELK force-directed families. */
export type ForceCorpusFamily = 'system_architecture' | 'infrastructure_and_network_topology' | 'data_model_and_relationships' | 'concept_and_relationship_mapping';
export interface GraphNodeInput {
    id: string;
    width: number;
    height: number;
    /** Nested compound nodes (ELK hierarchy). */
    children?: GraphNodeInput[];
}
export interface GraphEdgeLabelInput {
    text: string;
    width: number;
    height: number;
}
export interface GraphEdgeInput {
    id: string;
    source: string;
    target: string;
    /** Pre-measured label boxes — ELK places these; we must supply dimensions. */
    labels?: GraphEdgeLabelInput[];
}
export interface GraphLayoutInput {
    id: string;
    direction: LayoutDirection;
    spacingProfile?: SpacingProfile;
    nodes: GraphNodeInput[];
    edges: GraphEdgeInput[];
}
export interface Point2 {
    x: number;
    y: number;
}
export interface PlacedNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    children?: PlacedNode[];
}
export interface RoutedEdgeSection {
    startPoint: Point2;
    endPoint: Point2;
    bendPoints?: Point2[];
}
export interface PlacedEdgeLabel {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PlacedEdge {
    id: string;
    source: string;
    target: string;
    sections: RoutedEdgeSection[];
    /** Label geometry returned by ELK (absolute, after normalisation). */
    labels?: PlacedEdgeLabel[];
}
export interface GraphLayoutResult {
    width: number;
    height: number;
    nodes: PlacedNode[];
    edges: PlacedEdge[];
    engine: 'elk-layered' | 'elk-force';
    direction: LayoutDirection;
}
/** 8px baseline grid — aligns with diagram-generator `BASELINE_UNIT`. */
export declare const GRID_BASELINE_PX = 8;
export declare function roundToGrid(value: number, baseline?: number): number;
//# sourceMappingURL=graph-ir.d.ts.map