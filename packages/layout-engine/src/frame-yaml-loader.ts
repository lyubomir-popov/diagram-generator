/**
 * Native frame YAML → FrameDiagram (v3).
 * TypeScript source of truth for batch export; mirrors scripts/frame_loader.py.
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  Frame,
  FrameDiagram,
  Direction,
  Sizing,
  Align,
  Border,
  Fill,
  Justify,
  createLine,
  createArrow,
  type Line,
  type DiagramOverlay,
} from './frame-model.js';
import { INSET, GRID_GUTTER } from './tokens.js';
import { resolveStyles } from './resolve-styles.js';
import { applyHeadingAsChild, deriveContentGap } from './heading-synthesis.js';

const DIRECTION: Record<string, Direction> = {
  vertical: Direction.VERTICAL,
  horizontal: Direction.HORIZONTAL,
};

const SIZING: Record<string, Sizing> = {
  hug: Sizing.HUG,
  fill: Sizing.FILL,
  fixed: Sizing.FIXED,
};

const FILL: Record<string, Fill> = {
  white: Fill.WHITE,
  grey: Fill.GREY,
  black: Fill.BLACK,
};

const BORDER: Record<string, Border> = {
  solid: Border.SOLID,
  none: Border.NONE,
  dashed: Border.DASHED,
  dotted: Border.DASHED,
  fill: Border.FILL,
};

const ALIGN: Record<string, Align> = {
  'top-left': Align.TOP_LEFT,
  'top-center': Align.TOP_CENTER,
  'top-right': Align.TOP_RIGHT,
  'center-left': Align.CENTER_LEFT,
  center: Align.CENTER,
  'center-right': Align.CENTER_RIGHT,
  'bottom-left': Align.BOTTOM_LEFT,
  'bottom-center': Align.BOTTOM_CENTER,
  'bottom-right': Align.BOTTOM_RIGHT,
};

const JUSTIFY: Record<string, Justify> = {
  packed: Justify.PACKED,
  'space-between': Justify.SPACE_BETWEEN,
  'space-around': Justify.SPACE_AROUND,
  'space-evenly': Justify.SPACE_EVENLY,
};

const VARIANT_OVERLAYS: Record<string, Record<string, unknown>> = {
  highlight: { fill: 'black', icon_fill: '#FFFFFF' },
  annotation: { border: 'none' },
};

function parseLine(raw: unknown): Line {
  if (typeof raw === 'string') return createLine(raw);
  if (raw && typeof raw === 'object') {
    const d = raw as Record<string, unknown>;
    return createLine(String(d.text ?? ''));
  }
  return createLine(String(raw ?? ''));
}

function applyVariant(data: Record<string, unknown>): Record<string, unknown> {
  const variant = data.variant as string | undefined;
  if (!variant || !VARIANT_OVERLAYS[variant]) return data;
  return { ...VARIANT_OVERLAYS[variant], ...data };
}

function parseFrame(data: Record<string, unknown>, isRoot = false): Frame {
  data = applyVariant(data);
  const childrenData = (data.children as Record<string, unknown>[]) ?? [];
  const children = childrenData.map(c => parseFrame(c));
  const isContainer = children.length > 0;

  let labelRaw = data.label;
  if (typeof labelRaw === 'string') labelRaw = [labelRaw];
  const label = ((labelRaw as unknown[]) ?? []).map(parseLine);

  let headingLine: Line | undefined;
  if ('heading' in data) {
    const h = data.heading;
    headingLine =
      typeof h === 'string'
        ? createLine(h)
        : parseLine(h);
  }

  const defaultBorder = isContainer ? Border.NONE : Border.SOLID;
  const hasHeading = 'heading' in data;
  const borderKey = String(data.border ?? '');
  const border = BORDER[borderKey] ?? defaultBorder;
  const isPanel = border !== Border.NONE || hasHeading;
  const defaultGap = hasHeading ? 0 : deriveContentGap(children, { isRoot });

  let sizingW: Sizing;
  let sizingH: Sizing;
  if ('sizing' in data) {
    const uniform = SIZING[String(data.sizing)] ?? Sizing.FILL;
    sizingW = data.sizing_w ? SIZING[String(data.sizing_w)] ?? uniform : uniform;
    sizingH = data.sizing_h ? SIZING[String(data.sizing_h)] ?? uniform : uniform;
  } else if (isRoot) {
    sizingW = SIZING[String(data.sizing_w ?? 'hug')] ?? Sizing.HUG;
    sizingH = SIZING[String(data.sizing_h ?? 'hug')] ?? Sizing.HUG;
  } else {
    sizingW = SIZING[String(data.sizing_w ?? 'fill')] ?? Sizing.FILL;
    sizingH = SIZING[String(data.sizing_h ?? 'hug')] ?? Sizing.HUG;
  }

  if ('width' in data && !('sizing_w' in data) && !('sizing' in data)) sizingW = Sizing.FIXED;
  if ('height' in data && !('sizing_h' in data) && !('sizing' in data)) sizingH = Sizing.FIXED;

  const isAnnotation = border === Border.NONE && !isContainer;
  const defaultPadding = isRoot ? 0 : INSET;
  const uniformPadding = Number(data.padding ?? defaultPadding);

  const frame = new Frame({
    id: String(data.id ?? ''),
    direction: DIRECTION[String(data.direction ?? 'vertical')] ?? Direction.VERTICAL,
    gap: Number(data.gap ?? defaultGap),
    padding: uniformPadding,
    paddingTop: data.padding_top != null ? Number(data.padding_top) : undefined,
    paddingRight:
      data.padding_right != null
        ? Number(data.padding_right)
        : isAnnotation
          ? 0
          : undefined,
    paddingBottom: data.padding_bottom != null ? Number(data.padding_bottom) : undefined,
    paddingLeft:
      data.padding_left != null
        ? Number(data.padding_left)
        : isAnnotation
          ? 0
          : undefined,
    sizingW,
    sizingH,
    fillWeight: Number(data.fill_weight ?? 1),
    colSpan: data.col_span != null ? Number(data.col_span) : undefined,
    align: ALIGN[String(data.align ?? 'top-left')] ?? Align.TOP_LEFT,
    justify: JUSTIFY[String(data.justify ?? 'packed')] ?? Justify.PACKED,
    wrap: Boolean(data.wrap ?? false),
    width: data.width != null ? Number(data.width) : undefined,
    height: data.height != null ? Number(data.height) : undefined,
    minWidth: data.min_width != null ? Number(data.min_width) : undefined,
    maxWidth: data.max_width != null ? Number(data.max_width) : undefined,
    maxWidthChars: data.max_width_chars != null ? Number(data.max_width_chars) : undefined,
    minHeight: data.min_height != null ? Number(data.min_height) : undefined,
    maxHeight: data.max_height != null ? Number(data.max_height) : undefined,
    fill: FILL[String(data.fill ?? 'white')] ?? Fill.WHITE,
    border,
    icon: headingLine && isContainer ? undefined : (data.icon as string | undefined),
    iconFill: data.icon_fill as string | undefined,
    label,
    role: String(data.role ?? ''),
    level: data.level != null ? Number(data.level) : undefined,
    children,
    positionType: String(data.position ?? 'AUTO').toUpperCase() as 'AUTO' | 'ABSOLUTE',
    x: data.x != null ? Number(data.x) : 0,
    y: data.y != null ? Number(data.y) : 0,
  });

  if (headingLine && frame.isContainer) {
    applyHeadingAsChild(frame, headingLine, {
      icon: data.icon as string | undefined,
      iconFill: data.icon_fill as string | undefined,
    });
  }

  return frame;
}

export function loadFrameYaml(path: string): FrameDiagram {
  const raw = readFileSync(path, 'utf-8');
  const data = parseYaml(raw) as Record<string, unknown>;
  if (data.engine !== 'v3') {
    throw new Error(`${path}: not a native frame YAML (missing engine: v3)`);
  }

  const root = parseFrame((data.root as Record<string, unknown>) ?? {}, true);
  resolveStyles(root);

  const arrows = ((data.arrows as Record<string, unknown>[]) ?? []).map(a => {
    const labelRaw = a.label;
    const label =
      typeof labelRaw === 'string'
        ? [createLine(labelRaw)]
        : Array.isArray(labelRaw)
          ? labelRaw.map(parseLine)
          : undefined;
    const waypointsRaw = a.waypoints as unknown;
    const waypoints = Array.isArray(waypointsRaw)
      ? (waypointsRaw as unknown[]).map(wp => {
          const pair = wp as unknown[];
          return [Number(pair[0]), Number(pair[1])] as [number, number];
        })
      : undefined;
    return createArrow(String(a.source ?? ''), String(a.target ?? ''), {
      label,
      labelGap: a.label_gap != null ? Number(a.label_gap) : undefined,
      waypoints,
      color: a.color != null ? String(a.color) : undefined,
      id: a.id != null ? String(a.id) : undefined,
    });
  });

  const overlays: DiagramOverlay[] = ((data.overlays as Record<string, unknown>[]) ?? []).map(o => ({
    id: o.id != null ? String(o.id) : undefined,
    label: o.label != null ? String(o.label) : undefined,
    members: ((o.members as unknown[]) ?? []).map(m => String(m)),
  }));

  const grid = (data.grid as Record<string, unknown>) ?? {};
  const meta = (data.meta as Record<string, unknown>) ?? {};
  const elkRaw = meta.elk as Record<string, unknown> | undefined;
  const elkLayout: Record<string, string> | undefined = elkRaw
    ? Object.fromEntries(
        Object.entries(elkRaw).map(([k, v]) => [k, String(v)]),
      )
    : undefined;
  return new FrameDiagram({
    title: String(data.title ?? ''),
    root,
    arrows,
    overlays,
    gridCols: Number(grid.cols ?? 2),
    gridColGap: grid.col_gap != null ? Number(grid.col_gap) : GRID_GUTTER,
    gridRowGap: grid.row_gap != null ? Number(grid.row_gap) : GRID_GUTTER,
    gridOuterMargin: grid.outer_margin != null ? Number(grid.outer_margin) : GRID_GUTTER,
    layoutEngine: meta.layout_engine != null ? String(meta.layout_engine) : undefined,
    diagramType: meta.diagram_type != null ? String(meta.diagram_type) : undefined,
    sourceImage: meta.source_image != null ? String(meta.source_image) : undefined,
    elkLayout,
  });
}
