/**
 * Convert frame `heading:` into synthetic __heading / __body children.
 * Mirrors scripts/frame_loader.py Phase 2.
 */

import {
  Frame,
  Direction,
  Sizing,
  Border,
  Fill,
  type Line,
} from './frame-model.js';
import { ICON_SIZE, INSET } from './tokens.js';

export function applyHeadingAsChild(
  frame: Frame,
  heading: Line,
  options?: { icon?: string; iconFill?: string; stackGap?: number },
): void {
  if (!frame.isContainer) return;

  const headingFill = frame.fill === Fill.BLACK ? Fill.BLACK : Fill.WHITE;
  let headingIconFill = options?.iconFill;
  if (frame.fill === Fill.BLACK && !headingIconFill) {
    headingIconFill = '#FFFFFF';
  }

  const headingChild = new Frame({
    id: frame.id ? `${frame.id}__heading` : '__heading',
    role: 'heading',
    sizingW: Sizing.FILL,
    sizingH: Sizing.HUG,
    minHeight: ICON_SIZE,
    border: Border.NONE,
    fill: headingFill,
    padding: 0,
    label: [heading],
    icon: options?.icon,
    iconFill: headingIconFill,
  });

  const bodyDirection =
    frame.direction === Direction.HORIZONTAL
      ? Direction.HORIZONTAL
      : Direction.VERTICAL;

  const body = new Frame({
    id: frame.id ? `${frame.id}__body` : '__body',
    direction: bodyDirection,
    gap: options?.stackGap ?? INSET,
    align: frame.align,
    justify: frame.justify,
    wrap: frame.wrap,
    fillWeight: frame.fillWeight,
    sizingW: Sizing.FILL,
    sizingH: Sizing.HUG,
    border: Border.NONE,
    padding: 0,
    children: [...frame.children],
  });

  if (frame.direction === Direction.HORIZONTAL) {
    frame.children = [headingChild, body];
    frame.direction = Direction.VERTICAL;
  } else {
    frame.children = [headingChild, body];
  }
  frame.icon = undefined;
}
