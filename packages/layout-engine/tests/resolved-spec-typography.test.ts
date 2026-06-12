import { describe, it, expect } from 'vitest';
import { Frame, createLine } from '../src/frame-model.js';
import {
  resolvedSpecTypography,
  usesLeafLeadStyleSnapshot,
  usesHeadingStyleSnapshot,
} from '../src/resolved-spec-typography.js';
import { lineToSpec } from '../src/text-measure.js';

describe('resolvedSpecTypography', () => {
  it('uses heading snapshot on __heading role even when line spec is stale', () => {
    const heading = new Frame({
      id: '__heading',
      role: 'heading',
      label: [createLine('Section', { weight: '400', smallCaps: false, fill: '#FF00FF' })],
      resolvedHeadingWeight: '700',
      resolvedHeadingSmallCaps: true,
      resolvedTextFill: '#666666',
    });
    const spec = lineToSpec(heading.label[0]!);
    expect(usesHeadingStyleSnapshot(heading, 0)).toBe(true);
    const ty = resolvedSpecTypography(heading, spec, 0);
    expect(ty.weight).toBe('700');
    expect(ty.smallCaps).toBe(false);
    expect(ty.fill).toBe('#666666');
  });

  it('uses lead snapshot for the first body line on leaf frames even when line spec is stale', () => {
    const leaf = new Frame({
      id: 'leaf',
      resolvedLeafLeadWeight: '700',
      resolvedLeafLeadSmallCaps: false,
      label: [createLine('Body', { weight: '400', smallCaps: false, fill: '#FF00FF' })],
      resolvedTextFill: '#666666',
    });
    const spec = lineToSpec(leaf.label[0]!);
    expect(usesHeadingStyleSnapshot(leaf, 0)).toBe(false);
    expect(usesLeafLeadStyleSnapshot(leaf, 0)).toBe(true);
    const ty = resolvedSpecTypography(leaf, spec, 0);
    expect(ty.weight).toBe('700');
    expect(ty.smallCaps).toBe(false);
    expect(ty.fill).toBe('#666666');
  });

  it('uses heading snapshot for first spec when frame carries inline heading', () => {
    const leaf = new Frame({
      id: 'leaf',
      heading: createLine('Title', { weight: '400' }),
      resolvedHeadingWeight: '700',
      resolvedHeadingSmallCaps: false,
    });
    const spec = lineToSpec(leaf.heading!);
    const ty = resolvedSpecTypography(leaf, spec, 0);
    expect(ty.weight).toBe('700');
  });

  it('falls back to plain body typography for non-lead body rows', () => {
    const leaf = new Frame({
      id: 'leaf',
      heading: createLine('Title'),
      label: [
        createLine('Lead', { weight: '900', fill: '#FF00FF' }),
        createLine('Body', { weight: '900', smallCaps: true, fill: '#00FF00' }),
      ],
      resolvedTextFill: '#666666',
      resolvedLeafLeadWeight: '700',
      resolvedLeafLeadSmallCaps: false,
    });
    const spec = lineToSpec(leaf.label[1]!);
    expect(usesHeadingStyleSnapshot(leaf, 2)).toBe(false);
    expect(usesLeafLeadStyleSnapshot(leaf, 2)).toBe(false);
    const ty = resolvedSpecTypography(leaf, spec, 2);
    expect(ty.weight).toBe('400');
    expect(ty.smallCaps).toBe(false);
    expect(ty.fill).toBe('#666666');
  });
});
