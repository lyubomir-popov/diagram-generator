import type {
  GraphLayoutInput,
  GraphLayoutResult,
  PlacedEdge,
  PlacedNode,
  Point2,
  RoutedEdgeSection,
} from '@diagram-generator/graph-layout-core';
import { roundToGrid as snap } from '@diagram-generator/graph-layout-core';
import { indexPlacedNodes, toAbsolutePlacedNodes } from './node-bounds.js';

interface ElkLayoutPoint {
  x?: number;
  y?: number;
}

interface ElkLayoutSection {
  startPoint?: ElkLayoutPoint;
  endPoint?: ElkLayoutPoint;
  bendPoints?: ElkLayoutPoint[];
}

interface ElkLayoutEdge {
  id: string;
  sources?: string[];
  targets?: string[];
  sections?: ElkLayoutSection[];
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

function snapPoint(p: Point2): Point2 {
  return { x: snap(p.x), y: snap(p.y) };
}

function mapSection(section: ElkLayoutSection): RoutedEdgeSection | null {
  if (section.startPoint?.x == null || section.startPoint?.y == null) return null;
  if (section.endPoint?.x == null || section.endPoint?.y == null) return null;

  const bendPoints = section.bendPoints
    ?.filter((bp) => bp.x != null && bp.y != null)
    .map((bp) => snapPoint({ x: bp.x!, y: bp.y! }));

  return {
    startPoint: snapPoint({ x: section.startPoint.x, y: section.startPoint.y }),
    endPoint: snapPoint({ x: section.endPoint.x, y: section.endPoint.y }),
    ...(bendPoints?.length ? { bendPoints } : {}),
  };
}

function mapPlacedNode(node: ElkLayoutNode): PlacedNode {
  return {
    id: node.id,
    x: snap(node.x ?? 0),
    y: snap(node.y ?? 0),
    width: node.width ?? 0,
    height: node.height ?? 0,
    ...(node.children?.length
      ? { children: node.children.map(mapPlacedNode) }
      : {}),
  };
}

function collectEdges(root: ElkLayoutNode): ElkLayoutEdge[] {
  const out: ElkLayoutEdge[] = [...(root.edges ?? [])];
  for (const child of root.children ?? []) {
    out.push(...collectEdges(child));
  }
  return out;
}

function offsetSection(section: RoutedEdgeSection, dx: number, dy: number): RoutedEdgeSection {
  if (dx === 0 && dy === 0) return section;
  return {
    startPoint: snapPoint({ x: section.startPoint.x + dx, y: section.startPoint.y + dy }),
    endPoint: snapPoint({ x: section.endPoint.x + dx, y: section.endPoint.y + dy }),
    ...(section.bendPoints?.length
      ? {
          bendPoints: section.bendPoints.map((bp) =>
            snapPoint({ x: bp.x + dx, y: bp.y + dy }),
          ),
        }
      : {}),
  };
}

function containerOffset(
  containerId: string | undefined,
  rootId: string,
  nodesById: Map<string, PlacedNode>,
): Point2 {
  if (!containerId || containerId === rootId) return { x: 0, y: 0 };
  const node = nodesById.get(containerId);
  if (!node) return { x: 0, y: 0 };
  return { x: node.x, y: node.y };
}

function normalizeEdges(
  edges: ElkLayoutEdge[],
  rootId: string,
  nodesById: Map<string, PlacedNode>,
): PlacedEdge[] {
  return edges.map((edge) => {
    const offset = containerOffset(edge.container, rootId, nodesById);
    const sections = (edge.sections ?? [])
      .map(mapSection)
      .filter((s): s is RoutedEdgeSection => s != null)
      .map((section) => offsetSection(section, offset.x, offset.y));

    return {
      id: edge.id,
      source: edge.sources?.[0] ?? '',
      target: edge.targets?.[0] ?? '',
      sections,
    };
  });
}

export function normalizeElkLayoutResult(
  input: GraphLayoutInput,
  elkRoot: ElkLayoutNode,
): GraphLayoutResult {
  const width = snap(elkRoot.width ?? 0);
  const height = snap(elkRoot.height ?? 0);
  const nodes = toAbsolutePlacedNodes((elkRoot.children ?? []).map(mapPlacedNode));
  const nodesById = indexPlacedNodes(nodes);
  const edges = normalizeEdges(collectEdges(elkRoot), input.id, nodesById);

  return {
    width,
    height,
    nodes,
    edges,
    engine: 'elk-layered',
    direction: input.direction,
  };
}

/** Flat index of placed nodes by id (includes nested). Re-export from node-bounds. */
export { indexPlacedNodes } from './node-bounds.js';
