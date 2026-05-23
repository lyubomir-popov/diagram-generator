import { describe, it, expect, beforeEach } from 'vitest';
import {
  distributeFillSpace,
  alignOffset,
  measure,
  place,
  remeasureWithWidthConstraints,
  layoutFrameTree,
} from '../src/layout.js';
import {
  Frame, Direction, Sizing, Align, Border, Fill,
  enforceFillHugInvariant, createLine,
} from '../src/frame-model.js';
import { BASELINE_UNIT, BLOCK_WIDTH, roundUpToGrid } from '../src/tokens.js';
import { MockTextAdapter } from '../src/text-measure.js';

const adapter = new MockTextAdapter();

// ---------------------------------------------------------------------------
// distributeFillSpace
// ---------------------------------------------------------------------------

describe('distributeFillSpace', () => {
  it('equal split among two children', () => {
    const sizes = distributeFillSpace(160, [50, 50]);
    expect(sizes[0]).toBe(80);
    expect(sizes[1]).toBe(80);
  });

  it('returns empty for no children', () => {
    expect(distributeFillSpace(100, [])).toEqual([]);
  });

  it('single child gets all available space', () => {
    const sizes = distributeFillSpace(200, [50]);
    expect(sizes[0]).toBe(200);
  });

  it('preserves exact available space for unconstrained shares', () => {
    const sizes = distributeFillSpace(100, [0, 0]);
    expect(sizes[0]).toBeCloseTo(50, 6);
    expect(sizes[1]).toBeCloseTo(50, 6);
    expect(sizes[0]! + sizes[1]!).toBeCloseTo(100, 6);
  });

  it('min constraint floors the child size', () => {
    // 2 children, 80 available, child 0 has min 60 → child 0 gets 64 (rounded up), child 1 gets rest
    const sizes = distributeFillSpace(80, [0, 0], [60, undefined]);
    expect(sizes[0]).toBeGreaterThanOrEqual(60);
    expect(sizes[0]! + sizes[1]!).toBeLessThanOrEqual(80);
  });

  it('max constraint caps the child size', () => {
    // 2 children, 200 available, child 0 has max 40
    const sizes = distributeFillSpace(200, [0, 0], undefined, [40, undefined]);
    expect(sizes[0]).toBeLessThanOrEqual(40);
    expect(sizes[1]).toBeGreaterThan(40); // gets the remainder
  });

  it('FILL children shrink below measured content size', () => {
    // Parent is smaller than children's measured sizes → children must shrink
    const sizes = distributeFillSpace(80, [100, 100]);
    expect(sizes[0]).toBe(40);
    expect(sizes[1]).toBe(40);
    expect(sizes[0]! + sizes[1]!).toBeLessThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// alignOffset
// ---------------------------------------------------------------------------

describe('alignOffset', () => {
  it('LEFT alignment returns 0 on x-axis', () => {
    expect(alignOffset(Align.TOP_LEFT, 200, 100, 'x')).toBe(0);
    expect(alignOffset(Align.CENTER_LEFT, 200, 100, 'x')).toBe(0);
  });

  it('CENTER alignment returns half slack on x-axis', () => {
    expect(alignOffset(Align.TOP_CENTER, 200, 100, 'x')).toBe(50);
  });

  it('RIGHT alignment returns full slack on x-axis', () => {
    expect(alignOffset(Align.TOP_RIGHT, 200, 100, 'x')).toBe(100);
  });

  it('TOP alignment returns 0 on y-axis', () => {
    expect(alignOffset(Align.TOP_LEFT, 200, 100, 'y')).toBe(0);
  });

  it('BOTTOM alignment returns full slack on y-axis', () => {
    expect(alignOffset(Align.BOTTOM_LEFT, 200, 100, 'y')).toBe(100);
  });

  it('no slack returns 0', () => {
    expect(alignOffset(Align.CENTER, 100, 100, 'x')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// measure
// ---------------------------------------------------------------------------

describe('measure', () => {
  it('measures a leaf at BLOCK_WIDTH and grid-aligned height', () => {
    const leaf = new Frame({
      id: 'leaf',
      label: [createLine('Hello')],
      border: Border.SOLID,
    });
    measure(leaf, adapter);
    expect(leaf._layout.measuredW).toBe(BLOCK_WIDTH);
    expect(leaf._layout.measuredH).toBeGreaterThan(0);
    expect(leaf._layout.measuredH % BASELINE_UNIT).toBe(0);
  });

  it('measures a container as sum of children plus padding and gaps', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FIXED, sizingH: Sizing.FIXED, width: 96, height: 48 });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.FIXED, sizingH: Sizing.FIXED, width: 96, height: 48 });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      padding: 8,
      gap: 24,
      children: [c1, c2],
    });
    measure(parent, adapter);
    // Width: max(96, 96) + 2*8 = 112 → already grid-aligned
    expect(parent._layout.measuredW).toBe(112);
    // Height: 48 + 24 + 48 + 2*8 = 136 → already grid-aligned
    expect(parent._layout.measuredH).toBe(136);
  });

  it('FIXED leaf uses explicit dimensions', () => {
    const leaf = new Frame({
      id: 'fixed',
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 300,
      height: 200,
    });
    measure(leaf, adapter);
    expect(leaf._layout.measuredW).toBe(roundUpToGrid(300));
    expect(leaf._layout.measuredH).toBe(roundUpToGrid(200));
  });
});

// ---------------------------------------------------------------------------
// place
// ---------------------------------------------------------------------------

describe('place', () => {
  it('places a FILL leaf at available size', () => {
    const leaf = new Frame({
      id: 'fill-leaf',
      sizingW: Sizing.FILL,
      sizingH: Sizing.FILL,
    });
    measure(leaf, adapter);
    place(leaf, 10, 20, 200, 100, adapter);
    expect(leaf._layout.placedX).toBe(10);
    expect(leaf._layout.placedY).toBe(20);
    expect(leaf._layout.placedW).toBe(200);
    expect(leaf._layout.placedH).toBe(100);
  });

  it('places children sequentially in vertical container', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL, sizingH: Sizing.FIXED, height: 40 });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.FILL, sizingH: Sizing.FIXED, height: 40 });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 200,
      height: 200,
      padding: 8,
      gap: 16,
      children: [c1, c2],
    });
    measure(parent, adapter);
    place(parent, 0, 0, 200, 200, adapter);

    // c1 starts at padding offset
    expect(c1._layout.placedX).toBe(8);
    expect(c1._layout.placedY).toBe(8);
    expect(c1._layout.placedH).toBe(40);

    // c2 starts after c1 + gap
    expect(c2._layout.placedX).toBe(8);
    expect(c2._layout.placedY).toBe(8 + 40 + 16);
    expect(c2._layout.placedH).toBe(40);
  });

  it('FILL children share space equally in vertical container', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL, sizingH: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.FILL, sizingH: Sizing.FILL });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 200,
      height: 200,
      padding: 8,
      gap: 8,
      children: [c1, c2],
    });
    measure(parent, adapter);
    place(parent, 0, 0, 200, 200, adapter);

    // Available for children: 200 - 8 - 8 - 8 (gap) = 176
    // Each FILL child gets 176/2 = 88
    const totalChildH = c1._layout.placedH + c2._layout.placedH;
    expect(c1._layout.placedH).toBe(c2._layout.placedH);
    expect(totalChildH + 8).toBeLessThanOrEqual(200 - 16); // gap + padding fits
  });

  it('keeps explicit FILL siblings equal when the parent is not grid-divisible', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL, sizingH: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.FILL, sizingH: Sizing.FILL });
    const c3 = new Frame({ id: 'c3', sizingW: Sizing.FILL, sizingH: Sizing.FILL });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 200,
      height: 104,
      padding: 0,
      gap: 0,
      border: Border.NONE,
      children: [c1, c2, c3],
    });

    measure(parent, adapter);
    place(parent, 0, 0, 200, 104, adapter);

    expect(c1._layout.placedH).toBeCloseTo(104 / 3, 6);
    expect(c1._layout.placedH).toBeCloseTo(c2._layout.placedH, 6);
    expect(c2._layout.placedH).toBeCloseTo(c3._layout.placedH, 6);
    expect(c1._layout.placedH + c2._layout.placedH + c3._layout.placedH).toBeCloseTo(104, 6);
  });

  it('cross-axis FILL stretches to parent width', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL, sizingH: Sizing.FIXED, height: 40 });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 300,
      height: 200,
      padding: 8,
      children: [c1],
    });
    measure(parent, adapter);
    place(parent, 0, 0, 300, 200, adapter);

    // Cross-axis (W): FILL child should stretch to parent width minus padding
    expect(c1._layout.placedW).toBe(roundUpToGrid(300 - 16));
  });
});

// ---------------------------------------------------------------------------
// layoutFrameTree (full pipeline)
// ---------------------------------------------------------------------------

describe('layoutFrameTree', () => {
  it('runs the full pipeline and returns dimensions', () => {
    const child = new Frame({
      id: 'child',
      sizingW: Sizing.FILL,
      sizingH: Sizing.FILL,
      label: [createLine('Content')],
    });
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      padding: 8,
      children: [child],
    });

    const result = layoutFrameTree(root, adapter);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width % BASELINE_UNIT).toBe(0);
    expect(result.height % BASELINE_UNIT).toBe(0);
  });

  it('coerces HUG parent with FILL child', () => {
    const child = new Frame({
      id: 'child',
      sizingW: Sizing.FILL,
      sizingH: Sizing.FILL,
    });
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingW: Sizing.HUG,
      sizingH: Sizing.HUG,
      padding: 8,
      children: [child],
    });

    const result = layoutFrameTree(root, adapter);
    // Parent should have been coerced to FIXED on primary axis
    expect(root.sizingH).toBe(Sizing.FIXED);
    expect(result.coerced.has('root')).toBe(true);
  });

  it('preserves padding with FILL children (the original bug scenario)', () => {
    // Two FILL children in a FIXED parent — children should NOT overflow padding
    const c1 = new Frame({ id: 'c1', sizingH: Sizing.FILL, sizingW: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingH: Sizing.FILL, sizingW: Sizing.FILL });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 200,
      height: 200,
      padding: 8,
      gap: 8,
      children: [c1, c2],
    });

    layoutFrameTree(parent, adapter);

    // Bottom of last child + padding should not exceed parent bottom
    const parentBottom = parent._layout.placedY + parent._layout.placedH;
    const lastChildBottom = c2._layout.placedY + c2._layout.placedH;
    expect(lastChildBottom + 8).toBeLessThanOrEqual(parentBottom);
  });

  it('nested containers produce consistent coordinates', () => {
    const leaf1 = new Frame({ id: 'leaf1', sizingW: Sizing.FILL, sizingH: Sizing.FIXED, height: 40 });
    const leaf2 = new Frame({ id: 'leaf2', sizingW: Sizing.FILL, sizingH: Sizing.FIXED, height: 40 });
    const inner = new Frame({
      id: 'inner',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FILL,
      sizingH: Sizing.FILL,
      padding: 4,
      gap: 4,
      children: [leaf1, leaf2],
    });
    const outer = new Frame({
      id: 'outer',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 300,
      height: 300,
      padding: 8,
      children: [inner],
    });

    layoutFrameTree(outer, adapter);

    // Inner should be inside outer's padding
    expect(inner._layout.placedX).toBeGreaterThanOrEqual(outer._layout.placedX + 8);
    expect(inner._layout.placedY).toBeGreaterThanOrEqual(outer._layout.placedY + 8);

    // Leaves should be inside inner's padding
    expect(leaf1._layout.placedX).toBeGreaterThanOrEqual(inner._layout.placedX + 4);
    expect(leaf1._layout.placedY).toBeGreaterThanOrEqual(inner._layout.placedY + 4);
  });
});

// ---------------------------------------------------------------------------
// Coercion lifecycle
// ---------------------------------------------------------------------------

describe('coercion lifecycle', () => {
  it('coerces HUG parent when child becomes FILL, reverts when child set back to HUG', () => {
    const c1 = new Frame({ id: 'c1', sizingH: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingH: Sizing.HUG });
    c1.text = 'hello';
    c2.text = 'world';
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingH: Sizing.HUG,
      sizingW: Sizing.FIXED,
      width: 200,
      children: [c1, c2],
    });

    // Layout 1: c1 is FILL → root coerced to FIXED
    const r1 = layoutFrameTree(root, adapter);
    expect(r1.coerced.has('root')).toBe(true);
    expect(root.sizingH).toBe(Sizing.FIXED);
    const coercedHeight = root.height;
    expect(coercedHeight).toBeGreaterThan(0);

    // Layout 2: reset root to HUG, change c1 to HUG → no coercion
    root.sizingH = Sizing.HUG;
    root.height = 0;
    c1.sizingH = Sizing.HUG;
    const r2 = layoutFrameTree(root, adapter);
    expect(r2.coerced.has('root')).toBe(false);
    expect(r2.coerced.size).toBe(0);
    expect(root.sizingH).toBe(Sizing.HUG);
  });

  it('coercion persists when only some FILL children are removed', () => {
    const c1 = new Frame({ id: 'c1', sizingH: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingH: Sizing.FILL });
    const c3 = new Frame({ id: 'c3', sizingH: Sizing.HUG });
    c1.text = 'a';
    c2.text = 'b';
    c3.text = 'c';
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingH: Sizing.HUG,
      sizingW: Sizing.FIXED,
      width: 200,
      children: [c1, c2, c3],
    });

    // Layout 1: two FILL children → coerced
    const r1 = layoutFrameTree(root, adapter);
    expect(r1.coerced.has('root')).toBe(true);

    // Layout 2: remove one FILL child (set to HUG), one FILL remains → still coerced
    root.sizingH = Sizing.HUG;
    root.height = 0;
    c1.sizingH = Sizing.HUG;
    const r2 = layoutFrameTree(root, adapter);
    expect(r2.coerced.has('root')).toBe(true);
    expect(root.sizingH).toBe(Sizing.FIXED);

    // Layout 3: remove last FILL child → no coercion
    root.sizingH = Sizing.HUG;
    root.height = 0;
    c2.sizingH = Sizing.HUG;
    const r3 = layoutFrameTree(root, adapter);
    expect(r3.coerced.has('root')).toBe(false);
    expect(root.sizingH).toBe(Sizing.HUG);
  });

  it('coercion map includes correct override values', () => {
    const child = new Frame({ id: 'child', sizingH: Sizing.FILL });
    child.text = 'some text here';
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingH: Sizing.HUG,
      sizingW: Sizing.FIXED,
      width: 200,
      children: [child],
    });

    const result = layoutFrameTree(root, adapter);
    expect(result.coerced.has('root')).toBe(true);
    const override = result.coerced.get('root')!;
    expect(override.sizingH).toBe('FIXED');
    expect(override.height).toBe(root.height);
    // Width should not be in the override (not coerced)
    expect(override.sizingW).toBeUndefined();
    expect(override.width).toBeUndefined();
  });

  it('horizontal coercion lifecycle on width axis', () => {
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.HUG });
    c1.text = 'x';
    c2.text = 'y';
    const root = new Frame({
      id: 'root',
      direction: Direction.HORIZONTAL,
      sizingW: Sizing.HUG,
      sizingH: Sizing.FIXED,
      height: 100,
      children: [c1, c2],
    });

    // Layout 1: c1 FILL on primary (W) → coerced
    const r1 = layoutFrameTree(root, adapter);
    expect(r1.coerced.has('root')).toBe(true);
    expect(root.sizingW).toBe(Sizing.FIXED);

    // Layout 2: reset and remove FILL → no coercion
    root.sizingW = Sizing.HUG;
    root.width = 0;
    c1.sizingW = Sizing.HUG;
    const r2 = layoutFrameTree(root, adapter);
    expect(r2.coerced.has('root')).toBe(false);
    expect(root.sizingW).toBe(Sizing.HUG);
  });

  it('nested coercion: inner and outer both coerce and revert independently', () => {
    const leaf = new Frame({ id: 'leaf', sizingH: Sizing.FILL });
    leaf.text = 'leaf';
    const inner = new Frame({
      id: 'inner',
      direction: Direction.VERTICAL,
      sizingH: Sizing.HUG,
      sizingW: Sizing.FIXED,
      width: 150,
      children: [leaf],
    });
    const sibling = new Frame({ id: 'sibling', sizingH: Sizing.FILL });
    sibling.text = 'sib';
    const outer = new Frame({
      id: 'outer',
      direction: Direction.VERTICAL,
      sizingH: Sizing.HUG,
      sizingW: Sizing.FIXED,
      width: 200,
      children: [inner, sibling],
    });

    // Layout 1: both inner and outer coerced
    const r1 = layoutFrameTree(outer, adapter);
    expect(r1.coerced.has('inner')).toBe(true);
    expect(r1.coerced.has('outer')).toBe(true);

    // Layout 2: remove leaf's FILL → inner reverts, outer still coerced (sibling is FILL)
    outer.sizingH = Sizing.HUG;
    outer.height = 0;
    inner.sizingH = Sizing.HUG;
    inner.height = 0;
    leaf.sizingH = Sizing.HUG;
    const r2 = layoutFrameTree(outer, adapter);
    expect(r2.coerced.has('inner')).toBe(false);
    expect(r2.coerced.has('outer')).toBe(true);

    // Layout 3: also remove sibling's FILL → both revert
    outer.sizingH = Sizing.HUG;
    outer.height = 0;
    sibling.sizingH = Sizing.HUG;
    const r3 = layoutFrameTree(outer, adapter);
    expect(r3.coerced.has('inner')).toBe(false);
    expect(r3.coerced.has('outer')).toBe(false);
  });

  it('cross-axis FILL does not coerce parent', () => {
    // Vertical container: FILL-width children should stretch to parent width
    // WITHOUT coercing the parent's sizingW to FIXED.
    const c1 = new Frame({ id: 'c1', sizingW: Sizing.FILL, sizingH: Sizing.HUG });
    const c2 = new Frame({ id: 'c2', sizingW: Sizing.FILL, sizingH: Sizing.HUG });
    c1.text = 'hello';
    c2.text = 'world';
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingW: Sizing.HUG,
      sizingH: Sizing.HUG,
      children: [c1, c2],
    });

    const result = layoutFrameTree(root, adapter);
    // Width stays HUG (cross-axis FILL is not coerced)
    expect(root.sizingW).toBe(Sizing.HUG);
    // Height stays HUG (no FILL on primary axis)
    expect(root.sizingH).toBe(Sizing.HUG);
    expect(result.coerced.size).toBe(0);
  });

  it('mixed FILL/HUG children: HUG children take natural size, FILL splits remainder', () => {
    const hugChild = new Frame({ id: 'hug', sizingH: Sizing.HUG });
    hugChild.text = 'hug';
    const fillChild1 = new Frame({ id: 'fill1', sizingH: Sizing.FILL });
    fillChild1.text = 'f1';
    const fillChild2 = new Frame({ id: 'fill2', sizingH: Sizing.FILL });
    fillChild2.text = 'f2';
    const root = new Frame({
      id: 'root',
      direction: Direction.VERTICAL,
      sizingW: Sizing.FIXED,
      sizingH: Sizing.FIXED,
      width: 200,
      height: 300,
      gap: 0,
      padding: 0,
      children: [hugChild, fillChild1, fillChild2],
    });

    layoutFrameTree(root, adapter);

    // HUG child should have its natural measured height
    const hugH = hugChild._layout.placedH;
    expect(hugH).toBeGreaterThan(0);

    // FILL children should split the remaining space equally
    const totalAvail = 300; // parent height, no padding, no gap
    const remaining = totalAvail - hugH;
    const expectedFillH = remaining / 2;
    // Allow ±4px for baseline grid snapping
    expect(Math.abs(fillChild1._layout.placedH - expectedFillH)).toBeLessThanOrEqual(4);
    expect(Math.abs(fillChild2._layout.placedH - expectedFillH)).toBeLessThanOrEqual(4);
    // Both FILL children should be the same height
    expect(fillChild1._layout.placedH).toBe(fillChild2._layout.placedH);
  });
});

// ---------------------------------------------------------------------------
// Heading height consistency
// ---------------------------------------------------------------------------

describe('heading height consistency', () => {
  it('heading wraps at narrow width and children get correct available space', () => {
    // A container with a long heading placed at a narrow width.
    // The heading text is long enough to wrap at the placed width but
    // not at the unconstrained measure width. If heading height is
    // inconsistent between measure and place, children will overflow.
    const longHeading = createLine(
      'This is a very long heading that will definitely wrap at narrow widths because it is many characters wide',
    );
    const child = new Frame({
      id: 'leaf',
      sizingH: Sizing.HUG,
      label: [createLine('child')],
    });
    const parent = new Frame({
      id: 'parent',
      direction: Direction.VERTICAL,
      padding: 8,
      border: Border.SOLID,
      heading: longHeading,
      children: [child],
    });

    // Layout at a narrow available width to force heading wrapping
    layoutFrameTree(parent, adapter, 120);

    // The child should not overflow the parent's bottom padding.
    // childBottom = child.placedY + child.placedH
    // parentBottom = parent.placedY + parent.placedH - padding_bottom
    const childBottom = child._layout.placedY + child._layout.placedH;
    const parentBottom = parent._layout.placedY + parent._layout.placedH - 8;
    expect(childBottom).toBeLessThanOrEqual(parentBottom);
  });
});
