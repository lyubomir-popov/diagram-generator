/**
 * SVG string renderer for batch export (Node + browser).
 * Mirrors scripts/preview/layout-bridge.js DOM renderer.
 */

import {
  Frame,
  FrameDiagram,
  Border,
  type Arrow,
} from './frame-model.js';
import {
  ICON_SIZE,
  INSET,
  BODY_SIZE,
  BODY_LINE_STEP,
  sizeToPx,
} from './tokens.js';
import {
  type LineSpec,
  type TextMeasureAdapter,
  lineToSpec,
  linesToSpecs,
  wrapTextLines,
} from './text-measure.js';
import type { LayoutOutput } from './layout.js';

const ASCENT_RATIO = 0.94;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function lineTopToBaseline(top: number, size: string): number {
  return top + sizeToPx(size) * ASCENT_RATIO;
}

interface FrameRenderState {
  fill: string;
  stroke: string;
  dashed: boolean;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  specs: LineSpec[];
  iconFill: string;
}

function frameRenderState(frame: Frame, adapter: TextMeasureAdapter): FrameRenderState {
  const fill = frame.resolvedFill ?? 'transparent';
  const stroke = frame.resolvedStroke ?? 'none';
  const padTop = frame.paddingTop;
  const padRight = frame.paddingRight;
  const padBottom = frame.paddingBottom;
  const padLeft = frame.paddingLeft;
  const iconCol = frame.icon ? ICON_SIZE + INSET : 0;
  const textMaxWidth = frame._layout.placedW - padLeft - padRight - iconCol;

  let specs: LineSpec[] = [];
  if (frame.children.length === 0) {
    if (frame.heading) specs.push(lineToSpec(frame.heading));
    if (frame.label.length > 0) specs.push(...linesToSpecs(frame.label));
  } else if (frame.heading) {
    specs = linesToSpecs([frame.heading]);
  }
  if (specs.length > 0 && textMaxWidth > 0) {
    specs = wrapTextLines(specs, textMaxWidth, adapter);
  }

  return {
    fill,
    stroke,
    dashed: frame.border === Border.DASHED,
    padTop,
    padRight,
    padBottom,
    padLeft,
    specs,
    iconFill: frame.iconFill ?? '#000000',
  };
}

function renderFrameText(frame: Frame, rs: FrameRenderState): string {
  if (!rs.specs.length) return '';
  const parts: string[] = [];
  let top = frame._layout.placedY + rs.padTop;
  const x = frame._layout.placedX + rs.padLeft;
  for (const spec of rs.specs) {
    const size = String(spec.size ?? BODY_SIZE);
    const weight = spec.weight ?? '400';
    const fill = spec.fill ?? '#000000';
    const lineStep = sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
    const attrs = [
      `x="${fmt(x)}"`,
      `y="${fmt(lineTopToBaseline(top, size))}"`,
      `font-size="${esc(size)}"`,
      `font-weight="${esc(String(weight))}"`,
      `fill="${esc(fill)}"`,
    ];
    if (spec.letterSpacing) attrs.push(`letter-spacing="${esc(String(spec.letterSpacing))}"`);
    if (spec.fontFamily) attrs.push(`font-family="${esc(spec.fontFamily)}"`);
    if (spec.smallCaps) attrs.push('font-variant-caps="small-caps"');
    parts.push(`<tspan ${attrs.join(' ')}>${esc(spec.content)}</tspan>`);
    top += lineStep;
  }
  return `<text font-family="Ubuntu Sans">${parts.join('')}</text>`;
}

function renderIconPlaceholder(frame: Frame, rs: FrameRenderState): string {
  if (!frame.icon) return '';
  const iconX = frame._layout.placedX + frame._layout.placedW - rs.padRight - ICON_SIZE;
  const iconY = frame._layout.placedY + rs.padTop;
  return `<rect class="dg-icon" x="${fmt(iconX)}" y="${fmt(iconY)}" width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${esc(rs.iconFill)}" opacity="0.15"/>`;
}

function renderFrameGroup(frame: Frame, adapter: TextMeasureAdapter): string {
  const rs = frameRenderState(frame, adapter);
  const parts: string[] = [];
  const cid = frame.id && !frame.id.startsWith('__') ? ` data-component-id="${esc(frame.id)}"` : '';

  if (frame.role === 'separator') {
    parts.push(
      `<line class="dg-separator" x1="${fmt(frame._layout.placedX)}" y1="${fmt(frame._layout.placedY)}"` +
      ` x2="${fmt(frame._layout.placedX + frame._layout.placedW)}" y2="${fmt(frame._layout.placedY)}"` +
      ` fill="none" stroke="#000000" stroke-width="1" stroke-miterlimit="10" stroke-dasharray="8 8"/>`,
    );
  }

  const rectAttrs = [
    `x="${fmt(frame._layout.placedX)}"`,
    `y="${fmt(frame._layout.placedY)}"`,
    `width="${fmt(frame._layout.placedW)}"`,
    `height="${fmt(frame._layout.placedH)}"`,
    `fill="${esc(rs.fill)}"`,
    `stroke="${esc(rs.stroke)}"`,
    'stroke-width="1"',
    'stroke-miterlimit="10"',
  ];
  if (rs.dashed) rectAttrs.push('stroke-dasharray="8 8"');
  parts.push(`<rect ${rectAttrs.join(' ')}/>`);

  const text = renderFrameText(frame, rs);
  if (text) parts.push(text);
  parts.push(renderIconPlaceholder(frame, rs));

  let inner = parts.join('');
  for (const child of frame.children) {
    inner += renderFrameGroup(child, adapter);
  }
  return `<g${cid}>${inner}</g>`;
}

function frameIdFromRef(ref: string): string {
  const parts = ref.split('.');
  const last = parts[parts.length - 1];
  if (['top', 'bottom', 'left', 'right'].includes(last ?? '') && parts.length > 1) {
    return parts.slice(0, -1).join('.');
  }
  return ref;
}

function routeArrows(arrows: Arrow[], bounds: Record<string, { x: number; y: number; w: number; h: number }>): string {
  const lines: string[] = [];
  for (const arrow of arrows) {
    const s = bounds[frameIdFromRef(arrow.source)];
    const t = bounds[frameIdFromRef(arrow.target)];
    if (!s || !t) continue;
    const sx = s.x + s.w;
    const sy = s.y + s.h / 2;
    const tx = t.x;
    const ty = t.y + t.h / 2;
    const midX = (sx + tx) / 2;
    lines.push(
      `<polyline fill="none" stroke="#000000" stroke-width="1" points="${fmt(sx)},${fmt(sy)} ${fmt(midX)},${fmt(sy)} ${fmt(midX)},${fmt(ty)} ${fmt(tx)},${fmt(ty)}"/>`,
    );
  }
  return lines.join('');
}

function collectBounds(frame: Frame, out: Record<string, { x: number; y: number; w: number; h: number }> = {}) {
  if (frame.id && !frame.id.startsWith('__')) {
    out[frame.id] = {
      x: frame._layout.placedX,
      y: frame._layout.placedY,
      w: frame._layout.placedW,
      h: frame._layout.placedH,
    };
  }
  for (const child of frame.children) collectBounds(child, out);
  return out;
}

export function renderFrameDiagramToSvg(
  diagram: FrameDiagram,
  result: LayoutOutput,
  adapter: TextMeasureAdapter,
): string {
  const w = result.width || 400;
  const h = result.height || 200;
  const body = renderFrameGroup(diagram.root, adapter);
  const bounds = collectBounds(diagram.root);
  const arrows = routeArrows(diagram.arrows, bounds);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xml:space="preserve">` +
    `<rect width="${w}" height="${h}" fill="#FFFFFF"/>` +
    body +
    arrows +
    `</svg>\n`
  );
}
