import type { SequenceDiagramSpec } from './model.js';
import type { SequenceLayoutResult } from './layout.js';
import { FRAME_CLASS_DEFS } from '../frame-classes.js';
import {
  ARROW_COLOR,
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  BODY_LINE_STEP,
  BODY_SIZE,
  DEFAULT_FRAME_STROKE_WIDTH,
  defaultLineStep,
} from '../tokens.js';

export interface SequenceSvgRenderOptions {
  title?: string;
}

interface SequenceTextStyle {
  fill: string;
  weight: string;
  size: number;
  lineStep: number;
  letterSpacing?: string | null;
  textAnchor?: 'start' | 'middle' | 'end';
}

const ASCENT_RATIO = 0.94;
const participantFrameClass = FRAME_CLASS_DEFS.leaf;
const annotationFrameClass = FRAME_CLASS_DEFS.annotation;

const participantTextStyle: SequenceTextStyle = {
  fill: participantFrameClass.textFill ?? '#000000',
  weight: participantFrameClass.headingText?.weight ?? '400',
  size: BODY_SIZE,
  lineStep: BODY_LINE_STEP,
  letterSpacing: participantFrameClass.headingText?.letterSpacing ?? null,
  textAnchor: 'start',
};

const annotationTextStyle: SequenceTextStyle = {
  fill: annotationFrameClass.textFill ?? '#666666',
  weight: annotationFrameClass.leafLeadText?.weight ?? '400',
  size: 14,
  lineStep: defaultLineStep(14),
  letterSpacing: annotationFrameClass.leafLeadText?.letterSpacing ?? null,
  textAnchor: 'start',
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function baselineForTop(top: number, fontSize: number): number {
  return top + fontSize * ASCENT_RATIO;
}

function renderTextLines(lines: { text: string }[], x: number, top: number, style: SequenceTextStyle): string {
  if (lines.length === 0) return '';
  const attrs = [
    `x="${fmt(x)}"`,
    `y="${fmt(baselineForTop(top, style.size))}"`,
    `font-size="${style.size}"`,
    `font-weight="${escapeXml(style.weight)}"`,
    `fill="${escapeXml(style.fill)}"`,
    `text-anchor="${style.textAnchor ?? 'start'}"`,
  ];
  if (style.letterSpacing) attrs.push(`letter-spacing="${escapeXml(style.letterSpacing)}"`);
  return (
    `<text font-family="Ubuntu Sans" ${attrs.join(' ')}>` +
    lines
      .map((line, index) => {
        const dy = index === 0 ? 0 : style.lineStep;
        return `<tspan x="${fmt(x)}" dy="${dy}">${escapeXml(line.text)}</tspan>`;
      })
      .join('') +
    `</text>`
  );
}

function arrowheadPoints(fromX: number, toX: number, y: number): string {
  if (toX >= fromX) {
    return `${fmt(toX)},${fmt(y)} ${fmt(toX - ARROW_HEAD_LENGTH)},${fmt(y - ARROW_HEAD_HALF_WIDTH)} ${fmt(toX - ARROW_HEAD_LENGTH)},${fmt(y + ARROW_HEAD_HALF_WIDTH)}`;
  }
  return `${fmt(toX)},${fmt(y)} ${fmt(toX + ARROW_HEAD_LENGTH)},${fmt(y - ARROW_HEAD_HALF_WIDTH)} ${fmt(toX + ARROW_HEAD_LENGTH)},${fmt(y + ARROW_HEAD_HALF_WIDTH)}`;
}

export function renderSequenceDiagramToSvg(
  spec: SequenceDiagramSpec,
  layout: SequenceLayoutResult,
  options: SequenceSvgRenderOptions = {},
): string {
  const title = options.title ?? 'Sequence diagram';
  const participantSvg = layout.participants.map((participant) => {
    const centerX = participant.x + participant.width / 2;
    return (
      `<g data-sequence-participant-id="${escapeXml(participant.id)}">` +
      `<rect x="${fmt(participant.x)}" y="${fmt(participant.y)}" width="${fmt(participant.width)}" height="${fmt(participant.height)}" fill="${participantFrameClass.fill}" stroke="${participantFrameClass.stroke}" stroke-width="${participantFrameClass.strokeWidth ?? DEFAULT_FRAME_STROKE_WIDTH}" stroke-miterlimit="10"/>` +
      renderTextLines(
        participant.participant.label,
        participant.x + 16,
        participant.y + 16,
        participantTextStyle,
      ) +
      `<line x1="${fmt(centerX)}" y1="${fmt(participant.y + participant.height)}" x2="${fmt(centerX)}" y2="${fmt(layout.height - 32)}" stroke="${annotationTextStyle.fill}" stroke-width="${DEFAULT_FRAME_STROKE_WIDTH}" stroke-dasharray="8 8"/>` +
      `</g>`
    );
  }).join('');

  const messageSvg = layout.messages.map((message) => (
    `<g data-sequence-message-id="${escapeXml(message.id)}">` +
    `<line x1="${fmt(message.fromX)}" y1="${fmt(message.y)}" x2="${fmt(message.toX)}" y2="${fmt(message.y)}" stroke="${ARROW_COLOR}" stroke-width="${DEFAULT_FRAME_STROKE_WIDTH}"/>` +
    `<polygon points="${arrowheadPoints(message.fromX, message.toX, message.y)}" fill="${ARROW_COLOR}"/>` +
    renderTextLines(
      message.message.label,
      Math.min(message.fromX, message.toX) + 12,
      message.y - annotationTextStyle.lineStep,
      annotationTextStyle,
    ) +
    `</g>`
  )).join('');

  const noteSvg = layout.notes.map((note) => (
    `<g data-sequence-note-id="${escapeXml(note.id)}">` +
    renderTextLines(
      note.note.label,
      note.x,
      note.y,
      annotationTextStyle,
    ) +
    `</g>`
  )).join('');

  const groupSvg = layout.groups.map((group) => (
    `<g data-sequence-group-id="${escapeXml(group.id)}">` +
    `<line x1="32" y1="${fmt(group.y - annotationTextStyle.lineStep)}" x2="${fmt(layout.width - 32)}" y2="${fmt(group.y - annotationTextStyle.lineStep)}" stroke="${annotationTextStyle.fill}" stroke-width="${DEFAULT_FRAME_STROKE_WIDTH}" stroke-dasharray="8 8"/>` +
    renderTextLines(
      group.group.label,
      40,
      group.y - annotationTextStyle.lineStep - 20,
      annotationTextStyle,
    ) +
    `</g>`
  )).join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xml:space="preserve" aria-label="${escapeXml(title)}">` +
    `<rect width="${layout.width}" height="${layout.height}" fill="#FFFFFF"/>` +
    participantSvg +
    groupSvg +
    messageSvg +
    noteSvg +
    `</svg>\n`
  );
}
