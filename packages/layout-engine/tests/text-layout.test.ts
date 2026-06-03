import { describe, it, expect } from 'vitest';
import { Frame, createLine } from '../src/frame-model.js';
import {
  DEFAULT_MAX_WIDTH_CHARS,
  NO_WRAP_MAX_WIDTH_CHARS,
  applyTextLayoutDefaults,
  frameHasTextContent,
  maxWidthPxFromChars,
  resolveLeafTextWrapWidth,
} from '../src/text-layout.js';
import { MockTextAdapter } from '../src/text-measure.js';
import { measure } from '../src/layout.js';
import { Sizing, Border } from '../src/frame-model.js';
import { BLOCK_WIDTH } from '../src/tokens.js';

const adapter = new MockTextAdapter();

describe('text-layout defaults', () => {
  it('detects text-bearing frames', () => {
    const empty = new Frame({ id: 'e', label: [createLine('')] });
    const withText = new Frame({ id: 't', label: [createLine('Hello')] });
    expect(frameHasTextContent(empty)).toBe(false);
    expect(frameHasTextContent(withText)).toBe(true);
  });

  it('applies default max_width_chars to text frames', () => {
    const leaf = new Frame({ id: 'leaf', label: [createLine('Hello')] });
    applyTextLayoutDefaults(leaf);
    expect(leaf.maxWidthChars).toBe(DEFAULT_MAX_WIDTH_CHARS);
  });

  it('does not apply max_width_chars to icon-only boxes', () => {
    const icon = new Frame({ id: 'icon', icon: 'Chip.svg' });
    applyTextLayoutDefaults(icon);
    expect(icon.maxWidthChars).toBeUndefined();
  });

  it('derives wrap width from char count via adapter', () => {
    const px = maxWidthPxFromChars(66, adapter);
    expect(px).toBeGreaterThan(BLOCK_WIDTH);
    expect(px % 8).toBe(0);
  });

  it('HUG leaf with short text is narrower than BLOCK_WIDTH wrap legacy', () => {
    const leaf = new Frame({
      id: 'leaf',
      label: [createLine('Hi')],
      sizingW: Sizing.HUG,
      border: Border.SOLID,
    });
    applyTextLayoutDefaults(leaf);
    measure(leaf, adapter);
    expect(leaf._layout.measuredW).toBeLessThan(BLOCK_WIDTH);
  });

  it('max_width_chars 0 opts out of char wrap cap', () => {
    const leaf = new Frame({
      id: 'leaf',
      label: [createLine('Short')],
      sizingW: Sizing.HUG,
      maxWidthChars: NO_WRAP_MAX_WIDTH_CHARS,
    });
    applyTextLayoutDefaults(leaf);
    expect(leaf.maxWidthChars).toBe(NO_WRAP_MAX_WIDTH_CHARS);
    const inner = resolveLeafTextWrapWidth(leaf, adapter);
    expect(inner).toBeGreaterThan(10000);
  });

  it('long text wraps within 66ch measure for HUG', () => {
    const longText = 'Canonical Support engineers fix the code in a 12-year-old repo, upstreaming the fix for all.';
    const leaf = new Frame({
      id: 'leaf',
      label: [createLine(longText)],
      sizingW: Sizing.HUG,
      border: Border.SOLID,
    });
    applyTextLayoutDefaults(leaf);
    const innerWrap = resolveLeafTextWrapWidth(leaf, adapter);
    measure(leaf, adapter);
    expect(innerWrap).toBeGreaterThan(BLOCK_WIDTH);
    expect(leaf._layout.measuredW).toBeLessThanOrEqual(innerWrap + 16 + 2);
  });
});
