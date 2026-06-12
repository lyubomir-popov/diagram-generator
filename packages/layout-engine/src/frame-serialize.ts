/**
 * Serialize FrameDiagram to JSON DTO for preview wire transport.
 * Field names match preview_server / layout-bridge deserializeFrame.
 */

import { applyHeadingAsChild } from './heading-synthesis.js';
import {
  Frame,
  FrameDiagram,
  createArrow,
  createLine,
  type Arrow,
  type Fill,
  type Line,
} from './frame-model.js';

function serializeLine(line: Line): Record<string, unknown> {
  return {
    content: line.content,
  };
}

export function serializeFrame(frame: Frame): Record<string, unknown> {
  return {
    id: frame.id,
    direction: frame.direction,
    gap: frame.gap,
    gapDelta: frame.gapDelta,
    padding: frame.padding,
    paddingTop: frame.paddingTop,
    paddingRight: frame.paddingRight,
    paddingBottom: frame.paddingBottom,
    paddingLeft: frame.paddingLeft,
    align: frame.align,
    wrap: frame.wrap,
    sizingW: frame.sizingW,
    sizingH: frame.sizingH,
    fillWeight: frame.fillWeight,
    width: frame.width,
    height: frame.height,
    minWidth: frame.minWidth,
    maxWidth: frame.maxWidth,
    maxWidthChars: frame.maxWidthChars,
    minHeight: frame.minHeight,
    maxHeight: frame.maxHeight,
    fill: frame.fill,
    border: frame.border,
    heading: frame.heading ? serializeLine(frame.heading) : null,
    icon: frame.icon,
    iconFill: frame.iconFill,
    label: frame.label.map(serializeLine),
    role: frame.role,
    level: frame.level,
    colSpan: frame.colSpan,
    children: frame.children.map(serializeFrame),
    positionType: frame.positionType,
    x: frame.x,
    y: frame.y,
  };
}

function serializeArrow(arrow: Arrow): Record<string, unknown> {
  return {
    source: arrow.source,
    target: arrow.target,
    id: arrow.id,
    color: arrow.color ?? '#E95420',
    waypoints: arrow.waypoints ?? [],
    ...(arrow.label && arrow.label.length > 0
      ? { label: arrow.label.map(serializeLine) }
      : {}),
    ...(arrow.labelGap != null ? { labelGap: arrow.labelGap } : {}),
  };
}

export function serializeFrameDiagram(diagram: FrameDiagram): Record<string, unknown> {
  return {
    title: diagram.title,
    root: serializeFrame(diagram.root),
    arrows: diagram.arrows.map(serializeArrow),
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridRowGap: diagram.gridRowGap,
    gridOuterMargin: diagram.gridOuterMargin,
    layoutEngine: diagram.layoutEngine,
    diagramType: diagram.diagramType,
    sourceImage: diagram.sourceImage,
    ...(diagram.elkLayout && Object.keys(diagram.elkLayout).length > 0
      ? { elkLayout: diagram.elkLayout }
      : {}),
    overlays: [],
  };
}

function wireLine(content: unknown): Line {
  if (typeof content === 'string') return createLine(content);
  if (content && typeof content === 'object' && 'content' in content) {
    return createLine(String((content as { content: unknown }).content));
  }
  return createLine('');
}

/** Reconstruct a Frame from preview wire JSON (canonicalState.frameTree). */
export function deserializeFrameWire(json: Record<string, unknown>): Frame {
  const children = ((json.children as Record<string, unknown>[] | undefined) ?? []).map(deserializeFrameWire);
  const headingJson = json.heading as { content?: unknown } | null | undefined;
  const headingLine = headingJson ? wireLine(headingJson) : undefined;
  const frame = new Frame({
    id: String(json.id ?? ''),
    direction: (json.direction as Frame['direction']) ?? 'VERTICAL',
    gap: json.gap != null ? Number(json.gap) : 24,
    gapDelta: json.gapDelta != null ? Number(json.gapDelta) : undefined,
    padding: json.padding != null ? Number(json.padding) : 8,
    paddingTop: json.paddingTop != null ? Number(json.paddingTop) : undefined,
    paddingRight: json.paddingRight != null ? Number(json.paddingRight) : undefined,
    paddingBottom: json.paddingBottom != null ? Number(json.paddingBottom) : undefined,
    paddingLeft: json.paddingLeft != null ? Number(json.paddingLeft) : undefined,
    align: (json.align as Frame['align']) ?? 'TOP_LEFT',
    wrap: Boolean(json.wrap ?? false),
    sizingW: (json.sizingW as Frame['sizingW']) ?? 'HUG',
    sizingH: (json.sizingH as Frame['sizingH']) ?? 'HUG',
    fillWeight: json.fillWeight != null ? Number(json.fillWeight) : 1,
    width: json.width != null ? Number(json.width) : undefined,
    height: json.height != null ? Number(json.height) : undefined,
    minWidth: json.minWidth != null ? Number(json.minWidth) : undefined,
    maxWidth: json.maxWidth != null ? Number(json.maxWidth) : undefined,
    maxWidthChars:
      json.maxWidthChars != null
        ? Number(json.maxWidthChars)
        : json.max_width_chars != null
          ? Number(json.max_width_chars)
          : undefined,
    minHeight: json.minHeight != null ? Number(json.minHeight) : undefined,
    maxHeight: json.maxHeight != null ? Number(json.maxHeight) : undefined,
    fill: (json.fill as Fill | undefined) ?? '#FFFFFF',
    border: (json.border as Frame['border']) ?? 'SOLID',
    heading: headingLine && children.length === 0 ? headingLine : undefined,
    icon: headingLine && children.length > 0 ? undefined : (json.icon as string | undefined),
    iconFill: json.iconFill as string | undefined,
    level: json.level != null ? Number(json.level) : undefined,
    colSpan:
      json.colSpan != null
        ? Number(json.colSpan)
        : json.col_span != null
          ? Number(json.col_span)
          : undefined,
    label: ((json.label as Array<{ content?: unknown } | string> | undefined) ?? []).map((line) =>
      wireLine(line),
    ),
    role: String(json.role ?? ''),
    children,
    positionType: (json.positionType as Frame['positionType']) ?? 'AUTO',
    x: json.x != null ? Number(json.x) : 0,
    y: json.y != null ? Number(json.y) : 0,
  });
  if (headingLine && frame.isContainer) {
    applyHeadingAsChild(frame, headingLine, {
      icon: json.icon as string | undefined,
      iconFill: json.iconFill as string | undefined,
    });
  }
  return frame;
}

/** Reconstruct a FrameDiagram from preview wire JSON. */
export function deserializeFrameDiagramWire(json: Record<string, unknown>): FrameDiagram {
  const rootJson = json.root;
  if (!rootJson || typeof rootJson !== 'object') {
    throw new Error('deserializeFrameDiagramWire: root must be an object');
  }
  const root = deserializeFrameWire(rootJson as Record<string, unknown>);
  const arrows = ((json.arrows as Record<string, unknown>[] | undefined) ?? []).map((arrow) =>
    createArrow(String(arrow.source), String(arrow.target), arrow),
  );
  return new FrameDiagram({
    title: String(json.title ?? ''),
    root,
    arrows,
    gridCols: json.gridCols != null ? Number(json.gridCols) : 2,
    gridColGap: json.gridColGap != null ? Number(json.gridColGap) : undefined,
    gridRowGap: json.gridRowGap != null ? Number(json.gridRowGap) : undefined,
    gridOuterMargin: json.gridOuterMargin != null ? Number(json.gridOuterMargin) : undefined,
    layoutEngine: json.layoutEngine as string | undefined,
    diagramType: json.diagramType as string | undefined,
    sourceImage: json.sourceImage as string | undefined,
    elkLayout: json.elkLayout as Record<string, string> | undefined,
  });
}
