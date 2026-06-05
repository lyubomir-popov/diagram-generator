/**
 * Wire ELK layered positions into FrameDiagram using the same measure + render path
 * as box autolayout. ELK supplies coordinates only — styling comes from resolveStyles().
 */
import type { GraphLayoutInput, GraphNodeInput, LayeredCorpusFamily, PlacedEdge, PlacedNode } from '@diagram-generator/graph-layout-core';
import { layoutLayeredForFamily } from '@diagram-generator/graph-layout-elk';

import { Frame, FrameDiagram, Border } from './frame-model.js';
import { measure, type LayoutOutput } from './layout.js';
import { resolveStyles } from './resolve-styles.js';
import type { TextMeasureAdapter } from './text-measure.js';
import { INSET } from './tokens.js';

export interface ElkLayoutOptions {
  diagramType?: LayeredCorpusFamily;
  /** Extra offset applied after ELK (typically root page padding). */
  originX?: number;
  originY?: number;
  /** Session/YAML ELK option overrides (full elk.* keys). */
  elkOptionOverrides?: Record<string, string>;
}

function findFrame(root: Frame, id: string): Frame | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findFrame(child, id);
    if (found) return found;
  }
  return null;
}

function walkFrames(root: Frame, visit: (f: Frame) => void): void {
  visit(root);
  for (const child of root.children) visit(child);
}

function collectEndpointIds(diagram: FrameDiagram): Set<string> {
  const ids = new Set<string>();
  for (const arrow of diagram.arrows) {
    if (arrow.source) ids.add(arrow.source.split('.')[0]!);
    if (arrow.target) ids.add(arrow.target.split('.')[0]!);
  }
  return ids;
}

function descendantLeafIds(frame: Frame): string[] {
  if (frame.isLeaf) return frame.id ? [frame.id] : [];
  const out: string[] = [];
  for (const child of frame.children) out.push(...descendantLeafIds(child));
  return out;
}

/** Semantic ELK compound — section/panel whose direct subtree leaves are all arrow endpoints. */
function isElkCompound(frame: Frame, endpoints: Set<string>): boolean {
  if (frame.isLeaf || frame.children.length === 0) return false;
  const leaves = descendantLeafIds(frame);
  if (leaves.length < 2) return false;
  if (!leaves.every((id) => endpoints.has(id))) return false;
  return frame.level != null || frame.heading != null;
}

function measureSubtree(frame: Frame, adapter: TextMeasureAdapter): void {
  measure(frame, adapter, true);
}

function frameToGraphNode(frame: Frame, adapter: TextMeasureAdapter, endpoints: Set<string>): GraphNodeInput {
  measureSubtree(frame, adapter);
  const node: GraphNodeInput = {
    id: frame.id,
    width: frame._layout.measuredW,
    height: frame._layout.measuredH,
  };
  if (isElkCompound(frame, endpoints)) {
    node.children = frame.children
      .filter((c) => endpoints.has(c.id) || isElkCompound(c, endpoints))
      .map((c) => frameToGraphNode(c, adapter, endpoints));
  }
  return node;
}

function buildElkGraphNodes(root: Frame, adapter: TextMeasureAdapter, endpoints: Set<string>): GraphNodeInput[] {
  const nodes: GraphNodeInput[] = [];

  function walk(frame: Frame, insideCompound: boolean): void {
    if (!insideCompound && isElkCompound(frame, endpoints)) {
      nodes.push(frameToGraphNode(frame, adapter, endpoints));
      return;
    }
    if (frame.isLeaf && endpoints.has(frame.id)) {
      nodes.push(frameToGraphNode(frame, adapter, endpoints));
      return;
    }
    for (const child of frame.children) walk(child, insideCompound);
  }

  for (const child of root.children) walk(child, false);
  return nodes;
}

function indexPlaced(nodes: PlacedNode[], out = new Map<string, PlacedNode>()): Map<string, PlacedNode> {
  for (const n of nodes) {
    out.set(n.id, n);
    if (n.children?.length) indexPlaced(n.children, out);
  }
  return out;
}

function applyPlacedNode(frame: Frame, placed: PlacedNode, originX: number, originY: number): void {
  frame._layout.placedX = placed.x + originX;
  frame._layout.placedY = placed.y + originY;
  frame._layout.placedW = placed.width;
  frame._layout.placedH = placed.height;
  frame._layout.measuredW = placed.width;
  frame._layout.measuredH = placed.height;

  if (placed.children?.length) {
    for (const childPlaced of placed.children) {
      const childFrame = frame.children.find((c) => c.id === childPlaced.id);
      if (childFrame) applyPlacedNode(childFrame, childPlaced, originX, originY);
    }
  }
}

function bboxOfFrames(frames: Frame[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!frames.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of frames) {
    const ls = f._layout;
    minX = Math.min(minX, ls.placedX);
    minY = Math.min(minY, ls.placedY);
    maxX = Math.max(maxX, ls.placedX + ls.placedW);
    maxY = Math.max(maxY, ls.placedY + ls.placedH);
  }
  return { minX, minY, maxX, maxY };
}

function isAnnotationFrame(frame: Frame, endpoints: Set<string>): boolean {
  return frame.isLeaf && frame.border === Border.NONE && !endpoints.has(frame.id);
}

function layoutAnnotationsBelow(
  root: Frame,
  adapter: TextMeasureAdapter,
  elkBottom: number,
  originX: number,
  originY: number,
  endpoints: Set<string>,
): void {
  const gap = root.gap ?? 24;
  let cursorY = originY + elkBottom + gap;

  function placeAnnotation(frame: Frame): void {
    if (isAnnotationFrame(frame, endpoints)) {
      measureSubtree(frame, adapter);
      frame._layout.placedX = originX + frame.paddingLeft;
      frame._layout.placedY = cursorY;
      frame._layout.placedW = frame._layout.measuredW;
      frame._layout.placedH = frame._layout.measuredH;
      cursorY += frame._layout.placedH + gap;
    }
    for (const child of frame.children) placeAnnotation(child);
  }

  for (const child of root.children) placeAnnotation(child);
}

function familyFromDiagram(diagram: FrameDiagram): LayeredCorpusFamily {
  const t = diagram.diagramType;
  if (t === 'data_flow_and_integration' || t === 'process_and_workflow' || t === 'deployment_and_runtime_topology') {
    return t;
  }
  return 'process_and_workflow';
}

/** Full absolute canvas path from ELK edge sections (ports + bend points). */
function elkEdgeToLayoutPath(edge: PlacedEdge, originX: number, originY: number): [number, number][] {
  const points: [number, number][] = [];
  for (const section of edge.sections) {
    const start: [number, number] = [
      section.startPoint.x + originX,
      section.startPoint.y + originY,
    ];
    const last = points[points.length - 1];
    if (!last || last[0] !== start[0] || last[1] !== start[1]) {
      points.push(start);
    }
    for (const bp of section.bendPoints ?? []) {
      points.push([bp.x + originX, bp.y + originY]);
    }
    points.push([section.endPoint.x + originX, section.endPoint.y + originY]);
  }
  return points;
}

function simplifyOrthogonalPath(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const collinearH = prev[1] === cur[1] && cur[1] === next[1];
    const collinearV = prev[0] === cur[0] && cur[0] === next[0];
    if (!collinearH && !collinearV) out.push(cur);
  }
  out.push(points[points.length - 1]!);
  return out;
}

function applyElkEdgeRoutes(
  diagram: FrameDiagram,
  edges: PlacedEdge[],
  originX: number,
  originY: number,
): void {
  const byId = new Map<string, PlacedEdge>();
  const byEndpoints = new Map<string, PlacedEdge>();
  for (const edge of edges) {
    byId.set(edge.id, edge);
    byEndpoints.set(`${edge.source}->${edge.target}`, edge);
  }

  for (const arrow of diagram.arrows) {
    const src = arrow.source.split('.')[0]!;
    const tgt = arrow.target.split('.')[0]!;
    const edge = (arrow.id ? byId.get(arrow.id) : undefined) ?? byEndpoints.get(`${src}->${tgt}`);
    if (!edge) continue;
    const layoutPath = simplifyOrthogonalPath(elkEdgeToLayoutPath(edge, originX, originY));
    if (layoutPath.length >= 2) {
      arrow.layoutPath = layoutPath;
      arrow.waypoints = layoutPath.slice(1, -1);
    }
  }
}

/**
 * Measure frames, run ELK layered, write absolute placed bounds on endpoint frames.
 * Returns layout output sized to ELK canvas + annotations.
 */
export async function layoutElkFrameDiagram(
  diagram: FrameDiagram,
  adapter: TextMeasureAdapter,
  options: ElkLayoutOptions = {},
): Promise<LayoutOutput> {
  resolveStyles(diagram.root);

  const endpoints = collectEndpointIds(diagram);
  const originX = options.originX ?? diagram.root.paddingLeft;
  const originY = options.originY ?? diagram.root.paddingTop;

  const nodes = buildElkGraphNodes(diagram.root, adapter, endpoints);
  const input: GraphLayoutInput = {
    id: diagram.title || 'diagram',
    direction: 'TB',
    spacingProfile: 'normal',
    nodes,
    edges: diagram.arrows.map((a, i) => ({
      id: a.id ?? `edge-${i}`,
      source: a.source.split('.')[0]!,
      target: a.target.split('.')[0]!,
    })),
  };

  const family = options.diagramType ?? familyFromDiagram(diagram);
  const elkOverrides = {
    ...(diagram.elkLayout ?? {}),
    ...(options.elkOptionOverrides ?? {}),
  };
  const elk = await layoutLayeredForFamily(
    family,
    input,
    Object.keys(elkOverrides).length > 0 ? elkOverrides : undefined,
  );
  const placedById = indexPlaced(elk.nodes);
  applyElkEdgeRoutes(diagram, elk.edges, originX, originY);

  const placedFrames: Frame[] = [];
  for (const [id, placed] of placedById) {
    const frame = findFrame(diagram.root, id);
    if (!frame) continue;
    applyPlacedNode(frame, placed, originX, originY);
    placedFrames.push(frame);
  }

  layoutAnnotationsBelow(diagram.root, adapter, elk.height, originX, originY, endpoints);

  const entityBox = bboxOfFrames(placedFrames);
  const rootW = diagram.root.width ?? Math.max(elk.width + originX * 2, entityBox?.maxX ?? elk.width);
  let rootH = elk.height + originY * 2;
  walkFrames(diagram.root, (f) => {
    if (isAnnotationFrame(f, endpoints)) {
      rootH = Math.max(rootH, f._layout.placedY + f._layout.placedH + INSET);
    }
  });

  diagram.root._layout.placedX = 0;
  diagram.root._layout.placedY = 0;
  diagram.root._layout.placedW = rootW;
  diagram.root._layout.placedH = rootH;
  diagram.root._layout.measuredW = rootW;
  diagram.root._layout.measuredH = rootH;

  return { width: rootW, height: rootH, coerced: new Map() };
}
