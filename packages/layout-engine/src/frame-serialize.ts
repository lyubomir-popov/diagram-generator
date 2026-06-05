/**
 * Serialize FrameDiagram to JSON DTO for preview wire transport.
 * Field names match preview_server / layout-bridge deserializeFrame.
 */

import { Frame, FrameDiagram, type Line, type Arrow } from './frame-model.js';

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
