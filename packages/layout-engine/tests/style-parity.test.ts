import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Align,
  Border,
  Direction,
  Fill,
  Frame,
  Justify,
  Sizing,
  createLine,
  type Line,
} from '../src/frame-model.js';
import { resolveStyles } from '../src/resolve-styles.js';
import { frameOwnedHeadingToSpec, frameOwnedLabelToSpec } from '../src/resolved-spec-typography.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(__dirname, 'fixtures', 'style-parity-fixtures.json');

type RawVariant = 'highlight' | 'annotation';

interface RawFrame {
  id: string;
  level?: number;
  role?: string;
  heading?: string;
  label?: string[];
  variant?: RawVariant;
  fill?: string;
  border?: string;
  direction?: string;
  gap?: number;
  padding?: number;
  align?: string;
  justify?: string;
  wrap?: boolean;
  sizingW?: string;
  sizingH?: string;
  fillWeight?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  positionType?: 'AUTO' | 'ABSOLUTE';
  x?: number;
  y?: number;
  icon?: string;
  iconFill?: string;
  children?: RawFrame[];
}

interface ExpectedLineStyle {
  weight: string;
  smallCaps: boolean;
  letterSpacing: string | null;
  fill: string;
}

interface ExpectedStyleSnapshot {
  resolvedFill: string;
  resolvedStroke: string;
  firstLine?: ExpectedLineStyle;
}

interface Fixture {
  name: string;
  description: string;
  root: RawFrame;
  expected: {
    styles: Record<string, ExpectedStyleSnapshot>;
  };
}

const fixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

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

const JUSTIFY_MAP: Record<string, Justify> = {
  PACKED: Justify.PACKED,
  SPACE_BETWEEN: Justify.SPACE_BETWEEN,
  SPACE_AROUND: Justify.SPACE_AROUND,
  SPACE_EVENLY: Justify.SPACE_EVENLY,
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

function applyVariant(raw: RawFrame): RawFrame {
  if (raw.variant === 'highlight') {
    return {
      fill: '#000000',
      iconFill: '#FFFFFF',
      ...raw,
    };
  }
  if (raw.variant === 'annotation') {
    return {
      border: 'NONE',
      ...raw,
    };
  }
  return raw;
}

function buildLine(content: string): Line {
  return createLine(content);
}

function buildFrame(rawInput: RawFrame): Frame {
  const raw = applyVariant(rawInput);
  const children = (raw.children ?? []).map(buildFrame);
  const label = (raw.label ?? []).map(buildLine);

  const headingLine = raw.heading ? buildLine(raw.heading) : undefined;
  const originalDirection =
    DIRECTION_MAP[raw.direction ?? 'VERTICAL'] ?? Direction.VERTICAL;

  const frame = new Frame({
    id: raw.id,
    direction: originalDirection,
    gap: raw.gap,
    padding: raw.padding,
    paddingTop: raw.paddingTop,
    paddingRight: raw.paddingRight,
    paddingBottom: raw.paddingBottom,
    paddingLeft: raw.paddingLeft,
    align: raw.align ? ALIGN_MAP[raw.align] : undefined,
    justify: raw.justify ? JUSTIFY_MAP[raw.justify] : undefined,
    wrap: raw.wrap,
    sizingW: raw.sizingW ? SIZING_MAP[raw.sizingW] : undefined,
    sizingH: raw.sizingH ? SIZING_MAP[raw.sizingH] : undefined,
    fillWeight: raw.fillWeight,
    width: raw.width,
    height: raw.height,
    minWidth: raw.minWidth,
    maxWidth: raw.maxWidth,
    minHeight: raw.minHeight,
    maxHeight: raw.maxHeight,
    fill: raw.fill ? FILL_MAP[raw.fill] : undefined,
    border: raw.border ? BORDER_MAP[raw.border] : undefined,
    heading: headingLine,
    icon: raw.icon,
    iconFill: raw.iconFill,
    level: raw.level,
    label,
    role: raw.role,
    children,
    positionType: raw.positionType,
    x: raw.x,
    y: raw.y,
  });

  if (headingLine && frame.isContainer) {
    const headingChild = new Frame({
      id: frame.id ? `${frame.id}__heading` : '__heading',
      role: 'heading',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FILL,
      sizingH: Sizing.HUG,
      border: Border.NONE,
      fill: frame.fill,
      padding: 0,
      label: [headingLine],
      icon: raw.icon,
      iconFill: raw.iconFill,
    });
    const body = new Frame({
      id: frame.id ? `${frame.id}__body` : '__body',
      direction: originalDirection,
      gap: frame.gap,
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
    frame.children = [headingChild, body];
    frame.direction = Direction.VERTICAL;
    frame.heading = undefined;
    frame.icon = undefined;
  }

  return frame;
}

function collectActualStyles(frame: Frame, out: Record<string, ExpectedStyleSnapshot> = {}): Record<string, ExpectedStyleSnapshot> {
  if (frame.id) {
    const snapshot: ExpectedStyleSnapshot = {
      resolvedFill: frame.resolvedFill ?? '',
      resolvedStroke: frame.resolvedStroke ?? '',
    };
    const firstLine = frame.heading
      ? frameOwnedHeadingToSpec(frame, frame.heading)
      : (frame.label[0] ? frameOwnedLabelToSpec(frame, frame.label[0], 0) : null);
    if (firstLine) {
      snapshot.firstLine = {
        weight: firstLine.weight ?? '400',
        smallCaps: firstLine.smallCaps ?? false,
        letterSpacing: firstLine.letterSpacing ?? null,
        fill: firstLine.fill ?? '#000000',
      };
    }
    out[frame.id] = snapshot;
  }
  for (const child of frame.children) {
    collectActualStyles(child, out);
  }
  return out;
}

function assertNoResolvedWhiteFill(frame: Frame): void {
  expect(frame.resolvedFill).not.toBe('#FFFFFF');
  for (const child of frame.children) {
    assertNoResolvedWhiteFill(child);
  }
}

describe('style parity fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const root = buildFrame(fixture.root);
      resolveStyles(root);

      const actual = collectActualStyles(root);
      assertNoResolvedWhiteFill(root);

      for (const [frameId, expected] of Object.entries(fixture.expected.styles)) {
        const actualSnap = { ...actual[frameId] };
        const expectedSnap = { ...expected };
        expect(actualSnap, `style snapshot mismatch for ${frameId}`).toEqual(expectedSnap);
      }
    });
  }
});
