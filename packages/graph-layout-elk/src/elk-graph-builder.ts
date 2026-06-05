import type { GraphEdgeInput, GraphLayoutInput, GraphNodeInput } from '@diagram-generator/graph-layout-core';
import type { ElkLayoutOptions } from './layered-options.js';
import { buildLayeredLayoutOptions } from './layered-options.js';

/** Minimal ElkNode shape for building; elkjs types are permissive. */
export interface ElkGraphNode {
  id: string;
  width: number;
  height: number;
  children?: ElkGraphNode[];
  layoutOptions?: ElkLayoutOptions;
  labels?: { text: string }[];
}

export interface ElkGraphEdge {
  id: string;
  sources: string[];
  targets: string[];
}

export interface ElkGraphRoot {
  id: string;
  layoutOptions: ElkLayoutOptions;
  children: ElkGraphNode[];
  edges: ElkGraphEdge[];
}

function mapNode(node: GraphNodeInput): ElkGraphNode {
  return {
    id: node.id,
    width: node.width,
    height: node.height,
    ...(node.children?.length
      ? { children: node.children.map(mapNode) }
      : {}),
  };
}

export function buildElkGraph(
  input: GraphLayoutInput,
  layoutOptions: ElkLayoutOptions,
): ElkGraphRoot {
  const edges: ElkGraphEdge[] = input.edges.map((edge: GraphEdgeInput) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  return {
    id: input.id,
    layoutOptions,
    children: input.nodes.map(mapNode),
    edges,
  };
}

export function buildElkGraphFromInput(input: GraphLayoutInput): ElkGraphRoot {
  const layoutOptions = buildLayeredLayoutOptions({
    direction: input.direction,
    spacingProfile: input.spacingProfile ?? 'normal',
  });
  return buildElkGraph(input, layoutOptions);
}
