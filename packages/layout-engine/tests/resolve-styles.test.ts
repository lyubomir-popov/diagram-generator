import { describe, it, expect } from 'vitest';
import { Frame, Fill, Border, Direction, createLine } from '../src/frame-model.js';
import { computeLevel, resolveStyles } from '../src/resolve-styles.js';
import { DEFAULT_FRAME_STROKE_WIDTH } from '../src/tokens.js';

describe('computeLevel', () => {
  it('returns 0 for depth 0 (root)', () => {
    const f = new Frame({ id: 'root' });
    expect(computeLevel(f, 0)).toBe(0);
  });

  it('returns explicit level when set', () => {
    const f = new Frame({ id: 'panel', level: 2 });
    expect(computeLevel(f, 1)).toBe(2);
  });

  it('returns 0 for headingless container', () => {
    const child = new Frame({ id: 'child' });
    const f = new Frame({ id: 'wrapper', children: [child] });
    expect(computeLevel(f, 1)).toBe(0);
  });

  it('returns 1 for container with __body but no heading child', () => {
    const body = new Frame({ id: 'panel__body' });
    const f = new Frame({ id: 'panel', children: [body] });
    expect(computeLevel(f, 1)).toBe(1);
  });

  it('returns 1 for container with heading', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('Title')] });
    const body = new Frame({ id: '__body' });
    const f = new Frame({ id: 'box', children: [heading, body] });
    expect(computeLevel(f, 1)).toBe(1);
  });

  it('returns 1 for leaf node', () => {
    const f = new Frame({ id: 'leaf', label: [createLine('text')] });
    expect(computeLevel(f, 2)).toBe(1);
  });
});

describe('resolveStyles', () => {
  it('root is always transparent/none', () => {
    const root = new Frame({ id: 'root' });
    resolveStyles(root);
    expect(root.resolvedFill).toBe('transparent');
    expect(root.resolvedStroke).toBe('none');
  });

  it('highlight (fill=BLACK) gets black fill and stroke', () => {
    const child = new Frame({ id: 'hl', fill: Fill.BLACK, label: [createLine('Alert')] });
    const root = new Frame({ id: 'root', children: [child] });
    resolveStyles(root);
    expect(child.resolvedFill).toBe('#000000');
    expect(child.resolvedStroke).toBe('#000000');
    expect(child.resolvedTextFill).toBe('#FFFFFF');
  });

  it('panel (level=2) gets grey fill and stroke', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('Panel')] });
    const body = new Frame({ id: '__body' });
    const panel = new Frame({ id: 'p', level: 2, children: [heading, body] });
    const root = new Frame({ id: 'root', children: [panel] });
    resolveStyles(root);
    expect(panel.resolvedFill).toBe('#F3F3F3');
    expect(panel.resolvedStroke).toBe('#F3F3F3');
    expect(heading.resolvedHeadingWeight).toBe('700');
    expect(heading.resolvedHeadingSmallCaps).toBe(false);
  });

  it('panel (level=2) with cleared heading text stays visible (not level 0)', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('')] });
    const body = new Frame({ id: '__body', children: [new Frame({ id: 'leaf', label: [createLine('body')] })] });
    const panel = new Frame({ id: 'p', level: 2, children: [heading, body] });
    const root = new Frame({ id: 'root', children: [panel] });
    resolveStyles(root);
    expect(panel.resolvedStroke).not.toBe('none');
    expect(panel.resolvedFill).toBe('#F3F3F3');
  });

  it('leaf (level=1) gets transparent fill and black stroke', () => {
    const leaf = new Frame({ id: 'leaf', label: [createLine('text')] });
    const root = new Frame({ id: 'root', children: [leaf] });
    resolveStyles(root);
    expect(leaf.resolvedFill).toBe('transparent');
    expect(leaf.resolvedStroke).toBe('#000000');
  });

  it('section (level=3) gets transparent fill and black stroke', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('Section', { weight: '700' })] });
    const body = new Frame({ id: '__body' });
    const section = new Frame({ id: 's', level: 3, children: [heading, body] });
    const root = new Frame({ id: 'root', children: [section] });
    resolveStyles(root);
    expect(section.resolvedFill).toBe('transparent');
    expect(section.resolvedStroke).toBe('#000000');
    expect(section.resolvedStrokeWidth).toBe(DEFAULT_FRAME_STROKE_WIDTH);
    expect(heading.resolvedHeadingWeight).toBe('700');
    expect(heading.resolvedHeadingSmallCaps).toBe(false);
    expect(heading.resolvedHeadingLetterSpacing).toBeUndefined();
  });

  it('annotation (borderless leaf) gets transparent fill and stroke none', () => {
    const leaf = new Frame({ id: 'ann', border: Border.NONE, label: [createLine('note')] });
    const root = new Frame({ id: 'root', children: [leaf] });
    resolveStyles(root);
    expect(leaf.resolvedFill).toBe('transparent');
    expect(leaf.resolvedStroke).toBe('none');
    expect(leaf.resolvedTextFill).toBe('#666666');
  });

  it('layout wrappers (__body) get transparent/none', () => {
    const body = new Frame({ id: '__body' });
    const panel = new Frame({ id: 'p', level: 2, children: [body] });
    const root = new Frame({ id: 'root', children: [panel] });
    resolveStyles(root);
    expect(body.resolvedFill).toBe('transparent');
    expect(body.resolvedStroke).toBe('none');
  });

  it('nesting constraint: panel inside panel demotes to leaf', () => {
    const innerChild = new Frame({ id: 'inner_leaf', label: [createLine('inner')] });
    const innerHeading = new Frame({ id: '__heading2', role: 'heading', label: [createLine('Inner')] });
    const inner = new Frame({ id: 'inner', level: 2, children: [innerHeading, innerChild] });
    const outerHeading = new Frame({ id: '__heading1', role: 'heading', label: [createLine('Outer')] });
    const outer = new Frame({ id: 'outer', level: 2, children: [outerHeading, inner] });
    const root = new Frame({ id: 'root', children: [outer] });
    resolveStyles(root);
    // Outer should be panel
    expect(outer.resolvedFill).toBe('#F3F3F3');
    // Inner should be demoted to leaf (level 1) — no grey-on-grey
    expect(inner.resolvedFill).toBe('transparent');
    expect(inner.resolvedStroke).toBe('#000000');
  });

  it('children inside highlight parent get white text for contrast', () => {
    const child = new Frame({ id: 'child', label: [createLine('Inside highlight')] });
    const panel = new Frame({
      id: 'panel',
      fill: Fill.BLACK,
      level: 2,
      heading: createLine('Highlight panel'),
      children: [child],
    });
    const root = new Frame({ id: 'root', children: [panel] });
    resolveStyles(root);
    expect(child.resolvedTextFill).toBe('#FFFFFF');
    expect(child.resolvedFill).toBe('transparent');
    expect(child.resolvedStroke).toBe('#000000');
  });

  it('separator gets transparent/none', () => {
    const sep = new Frame({ id: 'sep', role: 'separator' });
    const root = new Frame({ id: 'root', children: [sep] });
    resolveStyles(root);
    expect(sep.resolvedFill).toBe('transparent');
    expect(sep.resolvedStroke).toBe('none');
  });

  it('leaf heading weight is demoted in the snapshot without rewriting authored text', () => {
    const leaf = new Frame({
      id: 'leaf',
      heading: createLine('Title', { weight: '700' }),
    });
    const root = new Frame({ id: 'root', children: [leaf] });
    resolveStyles(root);
    expect(leaf.heading!.weight).toBe('700');
    expect(leaf.resolvedHeadingWeight).toBe('400');
  });

  it('section promotes leaf lead text in the snapshot without rewriting authored lines', () => {
    const leaf = new Frame({
      id: 'leaf',
      level: 3,
      label: [createLine('Title')],
    });
    const root = new Frame({ id: 'root', children: [leaf] });
    resolveStyles(root);
    expect(leaf.label[0]!.weight).toBe('400');
    expect(leaf.resolvedLeafLeadWeight).toBe('700');
    expect(leaf.resolvedLeafLeadSmallCaps).toBe(false);
    expect(leaf.resolvedLeafLeadLetterSpacing).toBeUndefined();
  });

  it('populates resolved text/icon snapshot on highlight', () => {
    const child = new Frame({ id: 'hl', fill: Fill.BLACK, label: [createLine('Alert')] });
    const root = new Frame({ id: 'root', children: [child] });
    resolveStyles(root);
    expect(child.resolvedTextFill).toBe('#FFFFFF');
    expect(child.resolvedIconFill).toBe('#FFFFFF');
  });

  it('populates resolved heading snapshot on panel __heading child', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('Panel')] });
    const body = new Frame({ id: '__body' });
    const panel = new Frame({ id: 'p', level: 2, children: [heading, body] });
    const root = new Frame({ id: 'root', children: [panel] });
    resolveStyles(root);
    expect(heading.resolvedTextFill).toBe('#000000');
    expect(heading.resolvedHeadingWeight).toBe('700');
    expect(heading.resolvedHeadingSmallCaps).toBe(false);
  });

  it('populates section heading snapshot without small caps', () => {
    const heading = new Frame({ id: '__heading', role: 'heading', label: [createLine('Section')] });
    const body = new Frame({ id: '__body' });
    const section = new Frame({ id: 's', level: 3, children: [heading, body] });
    const root = new Frame({ id: 'root', children: [section] });
    resolveStyles(root);
    expect(heading.resolvedHeadingSmallCaps).toBe(false);
    expect(heading.resolvedHeadingWeight).toBe('700');
  });

  it('annotation snapshot uses muted text fill', () => {
    const leaf = new Frame({ id: 'ann', border: Border.NONE, label: [createLine('note')] });
    const root = new Frame({ id: 'root', children: [leaf] });
    resolveStyles(root);
    expect(leaf.resolvedTextFill).toBe('#666666');
    expect(leaf.resolvedIconFill).toBe('#666666');
  });
});
