import {
  Frame, Direction, Sizing, Align, Border, Fill,
  createLine,
} from '../src/frame-model.js';
import { applyHeadingAsChild } from '../src/heading-synthesis.js';

export interface FixtureBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DIRECTION_MAP: Record<string, Direction> = {
  VERTICAL: Direction.VERTICAL,
  HORIZONTAL: Direction.HORIZONTAL,
};

const SIZING_MAP: Record<string, Sizing> = {
  HUG: Sizing.HUG,
  FILL: Sizing.FILL,
  FIXED: Sizing.FIXED,
};

const ALIGN_MAP: Record<string, Align> = {
  TOP_LEFT: Align.TOP_LEFT,
  TOP_CENTER: Align.TOP_CENTER,
  TOP_RIGHT: Align.TOP_RIGHT,
  CENTER_LEFT: Align.CENTER_LEFT,
  CENTER: Align.CENTER,
  CENTER_RIGHT: Align.CENTER_RIGHT,
  BOTTOM_LEFT: Align.BOTTOM_LEFT,
  BOTTOM_CENTER: Align.BOTTOM_CENTER,
  BOTTOM_RIGHT: Align.BOTTOM_RIGHT,
};

const BORDER_MAP: Record<string, Border> = {
  SOLID: Border.SOLID,
  NONE: Border.NONE,
  DASHED: Border.DASHED,
  FILL: Border.FILL,
};

const FILL_MAP: Record<string, Fill> = {
  '#FFFFFF': Fill.WHITE,
  '#F3F3F3': Fill.GREY,
  '#000000': Fill.BLACK,
};

export function buildFrame(json: Record<string, unknown>): Frame {
  const childrenJson = (json.children ?? []) as Record<string, unknown>[];
  const children = childrenJson.map(buildFrame);

  const headingJson = json.heading as Record<string, string> | undefined;
  const heading = headingJson
    ? createLine(headingJson.content, {
        weight: headingJson.weight,
        size: headingJson.size,
      })
    : undefined;

  const labelJson = (json.label ?? []) as Record<string, string>[];
  const label = labelJson.map(ln =>
    createLine(ln.content, { size: ln.size, weight: ln.weight }),
  );

  const frame = new Frame({
    id: json.id as string,
    direction: DIRECTION_MAP[json.direction as string] ?? Direction.VERTICAL,
    gap: (json.gap as number) ?? 24,
    padding: (json.padding as number) ?? 8,
    paddingTop: json.paddingTop as number | undefined,
    paddingRight: json.paddingRight as number | undefined,
    paddingBottom: json.paddingBottom as number | undefined,
    paddingLeft: json.paddingLeft as number | undefined,
    align: ALIGN_MAP[json.align as string] ?? Align.TOP_LEFT,
    wrap: (json.wrap as boolean) ?? false,
    sizingW: SIZING_MAP[json.sizingW as string] ?? Sizing.HUG,
    sizingH: SIZING_MAP[json.sizingH as string] ?? Sizing.HUG,
    fillWeight: (json.fillWeight as number) ?? 1,
    width: json.width as number | undefined,
    height: json.height as number | undefined,
    minWidth: json.minWidth as number | undefined,
    maxWidth: json.maxWidth as number | undefined,
    minHeight: json.minHeight as number | undefined,
    maxHeight: json.maxHeight as number | undefined,
    fill: FILL_MAP[json.fill as string] ?? Fill.WHITE,
    border: BORDER_MAP[json.border as string] ?? Border.SOLID,
    heading: undefined,
    icon: heading ? undefined : json.icon as string | undefined,
    iconFill: json.iconFill as string | undefined,
    label,
    role: (json.role as string) ?? '',
    children,
    positionType: (json.positionType as 'AUTO' | 'ABSOLUTE') ?? 'AUTO',
    x: (json.x as number) ?? 0,
    y: (json.y as number) ?? 0,
  });

  if (heading && frame.isContainer) {
    applyHeadingAsChild(frame, heading, {
      icon: json.icon as string | undefined,
      iconFill: json.iconFill as string | undefined,
    });
  }

  return frame;
}

export function collectBounds(
  frame: Frame,
  out: Record<string, FixtureBounds> = {},
): Record<string, FixtureBounds> {
  if (frame.id && !frame.id.startsWith('__')) {
    out[frame.id] = {
      x: Math.round(frame._layout.placedX * 10) / 10,
      y: Math.round(frame._layout.placedY * 10) / 10,
      w: Math.round(frame._layout.placedW * 10) / 10,
      h: Math.round(frame._layout.placedH * 10) / 10,
    };
  }
  for (const child of frame.children) {
    collectBounds(child, out);
  }
  return out;
}
