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
  labels?: { text: string; width: number; height: number }[];
}

export interface ElkGraphRoot {
  id: string;
  layoutOptions: ElkLayoutOptions;
  children: ElkGraphNode[];
  edges: ElkGraphEdge[];
}

function mapNode(node: GraphNodeInput, compoundPadding?: string): ElkGraphNode {
  const hasChildren = Boolean(node.children?.length);
  return {
    id: node.id,
    width: node.width,
    height: node.height,
    ...(hasChildren
      ? {
          children: node.children!.map((child) => mapNode(child, compoundPadding)),
          ...(compoundPadding
            ? { layoutOptions: { 'elk.padding': compoundPadding } }
            : {}),
        }
      : {}),
  };
}

export function buildElkGraph(
  input: GraphLayoutInput,
  layoutOptions: ElkLayoutOptions,
): ElkGraphRoot {
  const rootOptions = { ...layoutOptions };
  const compoundPadding = rootOptions['elk.padding'];
  delete rootOptions['elk.padding'];

  const edges: ElkGraphEdge[] = input.edges.map((edge: GraphEdgeInput) => ({
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

export function buildElkGraphFromInput(input: GraphLayoutInput): ElkGraphRoot {
  const layoutOptions = buildLayeredLayoutOptions({
    direction: input.direction,
    spacingProfile: input.spacingProfile ?? 'normal',
  });
  return buildElkGraph(input, layoutOptions);
}
