/**
 * SVG string renderer for batch export (Node + browser).
 * Mirrors scripts/preview/layout-bridge.js DOM renderer.
 */

import {
  Frame,
  FrameDiagram,
  Border,
  type Arrow,
  type DiagramOverlay,
} from './frame-model.js';
import { leafIconColumnWidth } from './spatial.js';
import {
  ICON_SIZE,
  BODY_SIZE,
  BODY_LINE_STEP,
  GRID_GUTTER,
  ARROW_HEAD_LENGTH,
  ARROW_HEAD_HALF_WIDTH,
  ARROW_COLOR,
  sizeToPx,
} from './tokens.js';
import {
  type LineSpec,
  type TextMeasureAdapter,
  wrapTextLines,
} from './text-measure.js';
import { effectiveResolvedStrokeWidth } from './frame-classes.js';
import {
  annotationTextToSpec,
  frameOwnedTextBlocks,
  frameOwnedTextBlockGap,
} from './resolved-spec-typography.js';
import type { LayoutOutput } from './layout.js';
import { tintIconInnerMarkup } from './icon-embed.js';
import { routeArrows, type RoutedArrow } from './arrow-routing.js';

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
  strokeWidth: number;
  dashed: boolean;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  textBlocks: LineSpec[][];
  iconFill: string;
}

function frameRenderState(frame: Frame, adapter: TextMeasureAdapter): FrameRenderState {
  const fill = frame.resolvedFill ?? 'transparent';
  const stroke = frame.resolvedStroke ?? 'none';
  const padTop = frame.paddingTop;
  const padRight = frame.paddingRight;
  const padBottom = frame.paddingBottom;
  const padLeft = frame.paddingLeft;
  const iconCol = leafIconColumnWidth(frame);
  const textMaxWidth = frame._layout.placedW - padLeft - padRight - iconCol;

  let textBlocks = frameOwnedTextBlocks(frame);
  if (textBlocks.length > 0 && textMaxWidth > 0) {
    textBlocks = textBlocks
      .map(block => wrapTextLines(block, textMaxWidth, adapter))
      .filter(block => block.length > 0);
  }

  const strokeWidth = effectiveResolvedStrokeWidth(frame);

  return {
    fill,
    stroke,
    strokeWidth,
    dashed: frame.border === Border.DASHED,
    padTop,
    padRight,
    padBottom,
    padLeft,
    textBlocks,
    iconFill: frame.resolvedIconFill ?? '#000000',
  };
}

function renderFrameText(frame: Frame, rs: FrameRenderState): string {
  if (!rs.textBlocks.length) return '';
  const parts: string[] = [];
  let top = frame._layout.placedY + rs.padTop;
  const x = frame._layout.placedX + rs.padLeft;
  for (const [blockIndex, block] of rs.textBlocks.entries()) {
    const blockParts: string[] = [];
    for (const spec of block) {
      const size = String(spec.size ?? BODY_SIZE);
      const weight = spec.weight ?? '400';
      const smallCaps = spec.smallCaps ?? false;
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
      if (smallCaps) attrs.push('font-variant-caps="small-caps"');
      blockParts.push(`<tspan ${attrs.join(' ')}>${esc(spec.content)}</tspan>`);
      top += lineStep;
    }
    parts.push(`<text font-family="Ubuntu Sans">${blockParts.join('')}</text>`);
    top += frameOwnedTextBlockGap(frame, blockIndex, rs.textBlocks.length);
  }
  return parts.join('');
}

function renderIconPlaceholder(frame: Frame, rs: FrameRenderState): string {
  if (!frame.icon) return '';
  const iconX = frame._layout.placedX + frame._layout.placedW - rs.padRight - ICON_SIZE;
  const iconY = frame._layout.placedY + rs.padTop;
  return `<rect class="dg-icon" x="${fmt(iconX)}" y="${fmt(iconY)}" width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${esc(rs.iconFill)}" opacity="0.15"/>`;
}

function renderIcon(
  frame: Frame,
  rs: FrameRenderState,
  iconMarkupByName: Map<string, string> | undefined,
): string {
  if (!frame.icon) return '';
  const iconX = frame._layout.placedX + frame._layout.placedW - rs.padRight - ICON_SIZE;
  const iconY = frame._layout.placedY + rs.padTop;
  const inner = iconMarkupByName?.get(frame.icon);
  if (!inner) return renderIconPlaceholder(frame, rs);
  const tinted = tintIconInnerMarkup(inner, rs.iconFill);
  return `<g class="dg-icon" transform="translate(${fmt(iconX)} ${fmt(iconY)})">${tinted}</g>`;
}

export interface SvgRenderOptions {
  /** Inner SVG markup per icon file name (from assets/icons). */
  iconMarkupByName?: Map<string, string>;
}

function renderFrameGroup(
  frame: Frame,
  adapter: TextMeasureAdapter,
  iconMarkupByName?: Map<string, string>,
): string {
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
    `stroke-width="${rs.strokeWidth}"`,
    'stroke-miterlimit="10"',
  ];
  if (rs.dashed) rectAttrs.push('stroke-dasharray="8 8"');
  parts.push(`<rect ${rectAttrs.join(' ')}/>`);

  const text = renderFrameText(frame, rs);
  if (text) parts.push(text);
  parts.push(renderIcon(frame, rs, iconMarkupByName));

  let inner = parts.join('');
  for (const child of frame.children) {
    inner += renderFrameGroup(child, adapter, iconMarkupByName);
  }
  return `<g${cid}>${inner}</g>`;
}

function _arrowheadPoints(
  tipX: number, tipY: number,
  prevX: number, prevY: number,
): { base: [number, number]; polyPoints: string } | null {
  const dx = tipX - prevX;
  const dy = tipY - prevY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const bx = tipX - ux * ARROW_HEAD_LENGTH;
  const by = tipY - uy * ARROW_HEAD_LENGTH;
  const nx = -uy * ARROW_HEAD_HALF_WIDTH;
  const ny = ux * ARROW_HEAD_HALF_WIDTH;
  const pts = [
    `${fmt(bx + nx)},${fmt(by + ny)}`,
    `${fmt(tipX)},${fmt(tipY)}`,
    `${fmt(bx - nx)},${fmt(by - ny)}`,
  ].join(' ');
  return { base: [bx, by], polyPoints: pts };
}

function labelAnchorForSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  labelGap: number,
): { lx: number; ly: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { lx: mx + nx * labelGap, ly: my + ny * labelGap };
}

function renderArrows(routed: RoutedArrow[], adapter: TextMeasureAdapter): string {
  const parts: string[] = [];
  for (const arrow of routed) {
    const { points, color, label, labelGap, componentId } = arrow;
    if (points.length < 2) continue;

    const [tx, ty] = points[points.length - 1]!;
    const [px, py] = points[points.length - 2]!;
    const head = _arrowheadPoints(tx, ty, px, py);

    // Shaft: all segments, last one shortened to arrowhead base
    const shaftPoints = [...points] as [number, number][];
    if (head) shaftPoints[shaftPoints.length - 1] = head.base;

    const cid = componentId ? ` data-component-id="${esc(componentId)}"` : '';
    const inner: string[] = [];
    for (let i = 0; i < shaftPoints.length - 1; i++) {
      const [x1, y1] = shaftPoints[i]!;
      const [x2, y2] = shaftPoints[i + 1]!;
      inner.push(
        `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"` +
        ` fill="none" stroke="${esc(color)}" stroke-width="1" stroke-miterlimit="10"/>`,
      );
    }
    if (head) inner.push(`<polygon points="${head.polyPoints}" fill="${esc(color)}"/>`);

    // Arrow label on longest shaft segment — annotation typography, offset from line.
    if (label && label.length > 0) {
      let bestIdx = 0;
      let bestLen = 0;
      for (let i = 0; i < shaftPoints.length - 1; i++) {
        const [x1, y1] = shaftPoints[i]!;
        const [x2, y2] = shaftPoints[i + 1]!;
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len > bestLen) {
          bestLen = len;
          bestIdx = i;
        }
      }
      const [mx1, my1] = shaftPoints[bestIdx]!;
      const [mx2, my2] = shaftPoints[bestIdx + 1]!;
      const { lx, ly } = labelAnchorForSegment(mx1, my1, mx2, my2, labelGap);
      const specs = label.map(annotationTextToSpec);
      if (specs.length > 0) {
        const totalHeight = specs.reduce((sum, spec, index) => {
          const lineStep = sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
          return sum + (index === 0 ? 0 : lineStep);
        }, 0);
        let top = ly - totalHeight / 2;
        const tspans: string[] = [];
        for (const spec of specs) {
          const size = String(spec.size ?? BODY_SIZE);
          const weight = spec.weight ?? '400';
          const fill = spec.fill ?? '#666666';
          const lineStep = sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
          const attrs = [
            `x="${fmt(lx)}"`,
            `y="${fmt(lineTopToBaseline(top, size))}"`,
            `font-size="${esc(size)}"`,
            `font-weight="${esc(String(weight))}"`,
            `fill="${esc(fill)}"`,
          ];
          if (spec.letterSpacing) attrs.push(`letter-spacing="${esc(String(spec.letterSpacing))}"`);
          if (spec.smallCaps) attrs.push('font-variant-caps="small-caps"');
          tspans.push(`<tspan ${attrs.join(' ')}>${esc(spec.content)}</tspan>`);
          top += lineStep;
        }
        inner.push(
          `<text font-family="Ubuntu Sans" text-anchor="middle" dominant-baseline="middle">${tspans.join('')}</text>`,
        );
      }
    }

    parts.push(`<g${cid}>${inner.join('')}</g>`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Overlay rendering (port from layout-bridge.js renderOverlaysSvg)
// ---------------------------------------------------------------------------

function renderOverlays(
  overlays: DiagramOverlay[],
  bounds: Record<string, { x: number; y: number; w: number; h: number }>,
): string {
  const OVERLAY_PAD = 8;
  const parts: string[] = [];
  for (const ov of overlays) {
    const memberBounds = ov.members.filter(m => bounds[m]).map(m => bounds[m]!);
    if (memberBounds.length === 0) continue;

    const minX = Math.min(...memberBounds.map(b => b.x));
    const minY = Math.min(...memberBounds.map(b => b.y));
    const maxX = Math.max(...memberBounds.map(b => b.x + b.w));
    const maxY = Math.max(...memberBounds.map(b => b.y + b.h));

    const rx = minX - OVERLAY_PAD;
    const ry = minY - OVERLAY_PAD;
    const rw = (maxX - minX) + 2 * OVERLAY_PAD;
    const rh = (maxY - minY) + 2 * OVERLAY_PAD;

    const cid = ov.id ? ` data-component-id="${esc(ov.id)}"` : '';
    const inner: string[] = [
      `<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rw)}" height="${fmt(rh)}"` +
      ` fill="transparent" stroke="#000000" stroke-width="1" stroke-dasharray="2 4"/>`,
    ];
    if (ov.label) {
      inner.push(
        `<text font-family="Ubuntu Sans" font-size="14" font-weight="400" fill="#000000">` +
        `<tspan x="${fmt(rx + OVERLAY_PAD)}" y="${fmt(ry - 4)}">${esc(ov.label)}</tspan></text>`,
      );
    }
    parts.push(`<g${cid}>${inner.join('')}</g>`);
  }
  return parts.join('');
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
  options?: SvgRenderOptions,
): string {
  const w = result.width || 400;
  const h = result.height || 200;
  const body = renderFrameGroup(diagram.root, adapter, options?.iconMarkupByName);
  const bounds = collectBounds(diagram.root);
  const routed = routeArrows(diagram.arrows, bounds);
  const arrows = renderArrows(routed, adapter);
  const overlays = renderOverlays(diagram.overlays, bounds);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xml:space="preserve">` +
    `<rect width="${w}" height="${h}" fill="#FFFFFF"/>` +
    body +
    arrows +
    overlays +
    `</svg>\n`
  );
}
