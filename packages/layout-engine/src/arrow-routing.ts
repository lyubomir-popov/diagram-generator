import type { Arrow } from './frame-model.js';
import { ARROW_COLOR, GRID_GUTTER } from './tokens.js';

export type Side = 'top' | 'bottom' | 'left' | 'right';

type FrameBounds = { x: number; y: number; w: number; h: number };
type Bounds = Record<string, FrameBounds>;

type EndpointRef =
  | { kind: 'frame'; id: string; side: Side | null }
  | { kind: 'arrow'; id: string; side: null };

export interface RoutedArrow {
  points: [number, number][];
  color: string;
  label?: Arrow['label'];
  labelGap: number;
  componentId?: string;
}

interface ParsedArrow {
  arrow: Arrow;
  sourceRef: EndpointRef;
  targetRef: EndpointRef;
  sourceBounds?: FrameBounds;
  targetBounds?: FrameBounds;
}

interface FanPlan {
  sourceSide: Side;
  targetSide: Side;
  branchAxis: number;
}

function arrowComponentId(arrow: Arrow): string {
  return arrow.id ?? `${arrow.source}->${arrow.target}`;
}

function warnSkippedArrow(arrow: Arrow, reason: string): void {
  console.warn(`routeArrows: skipped ${arrowComponentId(arrow)} (${reason})`);
}

function simplifyPath(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;
  const result: [number, number][] = [points[0]!];
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index - 1]!;
    const [cx, cy] = points[index]!;
    const [nx, ny] = points[index + 1]!;
    if (!((px === cx && cx === nx) || (py === cy && cy === ny))) {
      result.push(points[index]!);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

function inferSides(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): [Side, Side] {
  const dx = tx + tw / 2 - (sx + sw / 2);
  const dy = ty + th / 2 - (sy + sh / 2);
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
}

function parseRef(ref: string): EndpointRef {
  if (ref.startsWith('arrow:')) {
    return { kind: 'arrow', id: ref.slice('arrow:'.length), side: null };
  }
  if (ref.startsWith('@')) {
    return { kind: 'arrow', id: ref.slice(1), side: null };
  }
  if (ref.includes('.')) {
    const parts = ref.split('.');
    const side = parts[parts.length - 1];
    if (side === 'top' || side === 'bottom' || side === 'left' || side === 'right') {
      return { kind: 'frame', id: parts.slice(0, -1).join('.'), side };
    }
  }
  return { kind: 'frame', id: ref, side: null };
}

function edgePoint(x: number, y: number, w: number, h: number, side: Side): [number, number] {
  switch (side) {
    case 'left':
      return [x, y + h / 2];
    case 'right':
      return [x + w, y + h / 2];
    case 'top':
      return [x + w / 2, y];
    case 'bottom':
      return [x + w / 2, y + h];
  }
}

function orthogonalWaypoints(
  start: [number, number],
  end: [number, number],
  srcSide: Side,
  tgtSide: Side,
): [number, number][] {
  const [sx, sy] = start;
  const [ex, ey] = end;
  if ((srcSide === 'right' && tgtSide === 'left') || (srcSide === 'left' && tgtSide === 'right')) {
    const midX = (sx + ex) / 2;
    return [[midX, sy], [midX, ey]];
  }
  if ((srcSide === 'bottom' && tgtSide === 'top') || (srcSide === 'top' && tgtSide === 'bottom')) {
    const midY = (sy + ey) / 2;
    return [[sx, midY], [ex, midY]];
  }
  return [[ex, sy]];
}

function oppositeSide(side: Side): Side {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

function dominantSourceSide(source: FrameBounds, target: FrameBounds): Side {
  if (target.y >= source.y + source.h) return 'bottom';
  if (target.y + target.h <= source.y) return 'top';
  if (target.x >= source.x + source.w) return 'right';
  if (target.x + target.w <= source.x) return 'left';
  return inferSides(source.x, source.y, source.w, source.h, target.x, target.y, target.w, target.h)[0];
}

function buildFanPlans(entries: ParsedArrow[]): Map<Arrow, FanPlan> {
  const bySourceAndSide = new Map<string, ParsedArrow[]>();

  for (const entry of entries) {
    if (entry.sourceRef.kind !== 'frame' || entry.targetRef.kind !== 'frame') continue;
    if (!entry.sourceBounds || !entry.targetBounds) continue;
    if (entry.arrow.layoutPath?.length) continue;
    if (entry.arrow.waypoints?.length) continue;
    if (entry.sourceRef.side || entry.targetRef.side) continue;

    const sourceSide = dominantSourceSide(entry.sourceBounds, entry.targetBounds);
    const key = `${entry.sourceRef.id}::${sourceSide}`;
    const bucket = bySourceAndSide.get(key);
    if (bucket) bucket.push(entry);
    else bySourceAndSide.set(key, [entry]);
  }

  const plans = new Map<Arrow, FanPlan>();
  for (const [key, bucket] of bySourceAndSide) {
    if (bucket.length < 2) continue;

    const [, sourceSideValue] = key.split('::');
    const sourceSide = sourceSideValue as Side;
    const source = bucket[0]!.sourceBounds!;
    const targetSide = oppositeSide(sourceSide);

    let branchAxis = 0;
    switch (sourceSide) {
      case 'bottom': {
        const minTargetTop = Math.min(...bucket.map(entry => entry.targetBounds!.y));
        branchAxis = (source.y + source.h + minTargetTop) / 2;
        break;
      }
      case 'top': {
        const maxTargetBottom = Math.max(...bucket.map(entry => entry.targetBounds!.y + entry.targetBounds!.h));
        branchAxis = (source.y + maxTargetBottom) / 2;
        break;
      }
      case 'right': {
        const minTargetLeft = Math.min(...bucket.map(entry => entry.targetBounds!.x));
        branchAxis = (source.x + source.w + minTargetLeft) / 2;
        break;
      }
      case 'left': {
        const maxTargetRight = Math.max(...bucket.map(entry => entry.targetBounds!.x + entry.targetBounds!.w));
        branchAxis = (source.x + maxTargetRight) / 2;
        break;
      }
    }

    for (const entry of bucket) {
      plans.set(entry.arrow, {
        sourceSide,
        targetSide,
        branchAxis,
      });
    }
  }

  return plans;
}

function fanWaypoints(start: [number, number], end: [number, number], plan: FanPlan): [number, number][] {
  if (plan.sourceSide === 'top' || plan.sourceSide === 'bottom') {
    return [[start[0], plan.branchAxis], [end[0], plan.branchAxis]];
  }
  return [[plan.branchAxis, start[1]], [plan.branchAxis, end[1]]];
}

function centerPoint(bounds: FrameBounds): [number, number] {
  return [bounds.x + bounds.w / 2, bounds.y + bounds.h / 2];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function nearestAttachmentPoint(points: [number, number][] | undefined, toward?: [number, number]): [number, number] | null {
  if (!points || points.length === 0) return null;
  if (!toward) return points[points.length - 1]!;

  let bestPoint = points[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    let candidate: [number, number];
    if (start[0] === end[0]) {
      candidate = [start[0], clamp(toward[1], Math.min(start[1], end[1]), Math.max(start[1], end[1]))];
    } else if (start[1] === end[1]) {
      candidate = [clamp(toward[0], Math.min(start[0], end[0]), Math.max(start[0], end[0])), start[1]];
    } else {
      const startDistance = (start[0] - toward[0]) ** 2 + (start[1] - toward[1]) ** 2;
      const endDistance = (end[0] - toward[0]) ** 2 + (end[1] - toward[1]) ** 2;
      candidate = startDistance <= endDistance ? start : end;
    }

    const distance = (candidate[0] - toward[0]) ** 2 + (candidate[1] - toward[1]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

function inferSidesBetweenEndpoints(
  sourceBounds: FrameBounds | undefined,
  sourcePoint: [number, number] | null,
  targetBounds: FrameBounds | undefined,
  targetPoint: [number, number] | null,
): [Side | null, Side | null] {
  if (sourceBounds && targetBounds) {
    return inferSides(
      sourceBounds.x,
      sourceBounds.y,
      sourceBounds.w,
      sourceBounds.h,
      targetBounds.x,
      targetBounds.y,
      targetBounds.w,
      targetBounds.h,
    );
  }
  if (sourceBounds && targetPoint) {
    return inferSides(
      sourceBounds.x,
      sourceBounds.y,
      sourceBounds.w,
      sourceBounds.h,
      targetPoint[0],
      targetPoint[1],
      0,
      0,
    );
  }
  if (sourcePoint && targetBounds) {
    return inferSides(
      sourcePoint[0],
      sourcePoint[1],
      0,
      0,
      targetBounds.x,
      targetBounds.y,
      targetBounds.w,
      targetBounds.h,
    );
  }
  if (sourcePoint && targetPoint) {
    return inferSides(sourcePoint[0], sourcePoint[1], 0, 0, targetPoint[0], targetPoint[1], 0, 0);
  }
  return [null, null];
}

export function routeArrows(arrows: Arrow[], bounds: Bounds): RoutedArrow[] {
  const entries: ParsedArrow[] = arrows.map((arrow) => {
    const sourceRef = parseRef(arrow.source);
    const targetRef = parseRef(arrow.target);
    return {
      arrow,
      sourceRef,
      targetRef,
      sourceBounds: sourceRef.kind === 'frame' ? bounds[sourceRef.id] : undefined,
      targetBounds: targetRef.kind === 'frame' ? bounds[targetRef.id] : undefined,
    };
  });

  const fanPlans = buildFanPlans(entries);
  const routedById = new Map<string, RoutedArrow>();
  const routed: RoutedArrow[] = [];

  for (const entry of entries) {
    const { arrow, sourceBounds, targetBounds } = entry;

    if (arrow.layoutPath && arrow.layoutPath.length >= 2) {
      const routedArrow = {
        points: simplifyPath(arrow.layoutPath.map((point) => [point[0], point[1]] as [number, number])),
        color: arrow.color ?? ARROW_COLOR,
        label: arrow.label && arrow.label.length > 0 ? arrow.label : undefined,
        labelGap: arrow.labelGap ?? GRID_GUTTER,
        componentId: arrowComponentId(arrow),
      };
      routed.push(routedArrow);
      if (arrow.id) routedById.set(arrow.id, routedArrow);
      continue;
    }

    const sourceAttachment = entry.sourceRef.kind === 'arrow'
      ? nearestAttachmentPoint(routedById.get(entry.sourceRef.id)?.points, targetBounds ? centerPoint(targetBounds) : undefined)
      : null;
    const targetAttachment = entry.targetRef.kind === 'arrow'
      ? nearestAttachmentPoint(routedById.get(entry.targetRef.id)?.points, sourceBounds ? centerPoint(sourceBounds) : undefined)
      : null;

    if (entry.sourceRef.kind === 'frame' && !sourceBounds) {
      warnSkippedArrow(arrow, `missing source bounds for ${entry.sourceRef.id}`);
      continue;
    }
    if (entry.targetRef.kind === 'frame' && !targetBounds) {
      warnSkippedArrow(arrow, `missing target bounds for ${entry.targetRef.id}`);
      continue;
    }
    if (entry.sourceRef.kind === 'arrow' && !sourceAttachment) {
      warnSkippedArrow(arrow, `unresolved source arrow attachment ${entry.sourceRef.id}`);
      continue;
    }
    if (entry.targetRef.kind === 'arrow' && !targetAttachment) {
      warnSkippedArrow(arrow, `unresolved target arrow attachment ${entry.targetRef.id}`);
      continue;
    }

    const fanPlan = fanPlans.get(arrow);
    let sourceSide: Side | null = entry.sourceRef.kind === 'frame' ? entry.sourceRef.side : null;
    let targetSide: Side | null = entry.targetRef.kind === 'frame' ? entry.targetRef.side : null;
    if (fanPlan && entry.sourceRef.kind === 'frame' && entry.targetRef.kind === 'frame') {
      sourceSide ??= fanPlan.sourceSide;
      targetSide ??= fanPlan.targetSide;
    }

    if (!sourceSide || !targetSide) {
      const [inferredSource, inferredTarget] = inferSidesBetweenEndpoints(
        sourceBounds,
        sourceAttachment,
        targetBounds,
        targetAttachment,
      );
      sourceSide ??= inferredSource;
      targetSide ??= inferredTarget;
    }
    if (!sourceSide) sourceSide = 'right';
    if (!targetSide) targetSide = 'left';

    const start = sourceAttachment ?? edgePoint(sourceBounds!.x, sourceBounds!.y, sourceBounds!.w, sourceBounds!.h, sourceSide);
    const end = targetAttachment ?? edgePoint(targetBounds!.x, targetBounds!.y, targetBounds!.w, targetBounds!.h, targetSide);
    const rawWaypoints = arrow.waypoints && arrow.waypoints.length > 0
      ? arrow.waypoints
      : fanPlan && !sourceAttachment && !targetAttachment
        ? fanWaypoints(start, end, fanPlan)
        : orthogonalWaypoints(start, end, sourceSide, targetSide);

    const routedArrow = {
      points: simplifyPath([start, ...rawWaypoints, end]),
      color: arrow.color ?? ARROW_COLOR,
      label: arrow.label && arrow.label.length > 0 ? arrow.label : undefined,
      labelGap: arrow.labelGap ?? GRID_GUTTER,
        componentId: arrowComponentId(arrow),
    };
    routed.push(routedArrow);
    if (arrow.id) routedById.set(arrow.id, routedArrow);
  }

  return routed;
}
