import { describe, it, expect } from 'vitest';
import { Frame, createLine, Sizing } from '../src/frame-model.js';
import { layoutFrameTree } from '../src/layout.js';
import { MockTextAdapter } from '../src/text-measure.js';
import { buildComponentTree } from '../src/component-tree.js';
import { applyHeadingAsChild } from '../src/heading-synthesis.js';

describe('buildComponentTree', () => {
  it('includes placed bounds and label text', () => {
    const leaf = new Frame({
      id: 'leaf',
      label: [createLine('Hello')],
      sizingW: Sizing.HUG,
    });
    layoutFrameTree(leaf, new MockTextAdapter());
    const tree = buildComponentTree(leaf);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe('leaf');
    expect(tree[0]!.label_text).toEqual(['Hello']);
    expect(tree[0]!.width).toBeGreaterThan(0);
  });

  it('reads heading from __heading child', () => {
    const panel = new Frame({
      id: 'panel',
      children: [new Frame({ id: 'child', label: [createLine('Body')] })],
    });
    applyHeadingAsChild(panel, createLine('Title', { weight: '700' }));
    layoutFrameTree(panel, new MockTextAdapter());
    const tree = buildComponentTree(panel);
    expect(tree[0]!.heading_text).toBe('Title');
  });

  it('hoists __body children and gap onto authored parent for inspector', () => {
    const section = new Frame({
      id: 'section',
      gap: 8,
      children: [
        new Frame({ id: 'a', label: [createLine('A')] }),
        new Frame({ id: 'b', label: [createLine('B')] }),
      ],
    });
    applyHeadingAsChild(section, createLine('Title', { weight: '700' }));
    layoutFrameTree(section, new MockTextAdapter());
    const tree = buildComponentTree(section);
    expect(tree[0]!.layout_gap).toBe(8);
    expect(tree[0]!.children.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('uses stackGap option for __body gap, independent of frame.gap (title gap)', () => {
    // Mirrors the Python path: stack_gap controls leaf spacing; gap controls heading→body spacing.
    const section = new Frame({
      id: 'sect',
      gap: 0,   // title gap = 0
      children: [
        new Frame({ id: 'x', label: [createLine('X')] }),
        new Frame({ id: 'y', label: [createLine('Y')] }),
      ],
    });
    // Pass explicit stackGap=16 (as if stack_gap: 16 was in YAML)
    applyHeadingAsChild(section, createLine('Heading', { weight: '700' }), { stackGap: 16 });
    layoutFrameTree(section, new MockTextAdapter());
    const tree = buildComponentTree(section);
    expect(tree[0]!.layout_header_gap).toBe(0);   // title gap unchanged
    expect(tree[0]!.layout_gap).toBe(16);          // stack gap = explicit stackGap, not INSET
  });
});
