import type { PlacedNode, Point2, RoutedEdgeSection } from '@diagram-generator/graph-layout-core';

/** ELK returns nested x/y relative to each parent — accumulate to layout-root space. */
export function toAbsolutePlacedNodes(nodes: PlacedNode[]): PlacedNode[] {
  function mapNode(node: PlacedNode, parentX: number, parentY: number): PlacedNode {
    const x = node.x + parentX;
    const y = node.y + parentY;
    return {
      ...node,
      x,
      y,
      ...(node.children?.length
        ? { children: node.children.map((c) => mapNode(c, x, y)) }
        : {}),
    };
  }
  return nodes.map((n) => mapNode(n, 0, 0));
}

export function indexPlacedNodes(nodes: PlacedNode[]): Map<string, PlacedNode> {
  const map = new Map<string, PlacedNode>();
  function walk(list: PlacedNode[]): void {
    for (const node of list) {
      map.set(node.id, node);
      if (node.children?.length) walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function leafNodeRects(nodes: PlacedNode[]): NodeRect[] {
  const out: NodeRect[] = [];
  function walk(list: PlacedNode[]): void {
    for (const node of list) {
      if (node.children?.length) {
        walk(node.children);
      } else {
        out.push({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height });
      }
    }
  }
  walk(nodes);
  return out;
}

/** Distance from point to nearest point on rect boundary (0 if inside). */
export function distanceToRectBoundary(p: Point2, r: NodeRect): number {
  const inside =
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  if (inside) return 0;

  const dx = p.x < r.x ? r.x - p.x : p.x > r.x + r.width ? p.x - (r.x + r.width) : 0;
  const dy = p.y < r.y ? r.y - p.y : p.y > r.y + r.height ? p.y - (r.y + r.height) : 0;
  return Math.hypot(dx, dy);
}

export function nearestLeafBoundaryDistance(p: Point2, leaves: NodeRect[]): number {
  if (!leaves.length) return Infinity;
  return Math.min(...leaves.map((r) => distanceToRectBoundary(p, r)));
}

export function edgeEndpointsTouchLeaves(
  section: RoutedEdgeSection,
  leaves: NodeRect[],
  tolerancePx = 2,
): boolean {
  const startOk = nearestLeafBoundaryDistance(section.startPoint, leaves) <= tolerancePx;
  const endOk = nearestLeafBoundaryDistance(section.endPoint, leaves) <= tolerancePx;
  return startOk && endOk;
}

export function edgeEndpointsTouchEndpointNodes(
  section: RoutedEdgeSection,
  edge: { source: string; target: string },
  nodes: Map<string, PlacedNode>,
  tolerancePx = 3,
): boolean {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  if (!source || !target) return false;

  const sourceRect: NodeRect = {
    id: source.id,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
  };
  const targetRect: NodeRect = {
    id: target.id,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
  };

  return (
    distanceToRectBoundary(section.startPoint, sourceRect) <= tolerancePx &&
    distanceToRectBoundary(section.endPoint, targetRect) <= tolerancePx
  );
}
