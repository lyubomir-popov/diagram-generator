/** Canonical graph layout input/output IR (engine-agnostic). */

export type LayoutDirection = 'TB' | 'LR';

export type SpacingProfile = 'compact' | 'normal' | 'loose';

/** Matches planning `layout_mapping.py` layered families. */
export type LayeredCorpusFamily =
  | 'deployment_and_runtime_topology'
  | 'process_and_workflow'
  | 'data_flow_and_integration';

export interface GraphNodeInput {
  id: string;
  width: number;
  height: number;
  /** Nested compound nodes (ELK hierarchy). */
  children?: GraphNodeInput[];
}

export interface GraphEdgeInput {
  id: string;
  source: string;
  target: string;
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

export interface PlacedEdge {
  id: string;
  source: string;
  target: string;
  sections: RoutedEdgeSection[];
}

export interface GraphLayoutResult {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  engine: 'elk-layered';
  direction: LayoutDirection;
}

/** 8px baseline grid — aligns with diagram-generator `BASELINE_UNIT`. */
export const GRID_BASELINE_PX = 8;

export function roundToGrid(value: number, baseline = GRID_BASELINE_PX): number {
  return Math.round(value / baseline) * baseline;
}
