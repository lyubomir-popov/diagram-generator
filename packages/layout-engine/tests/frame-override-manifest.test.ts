import { describe, it, expect } from 'vitest';

import {
  PERSIST_FRAME_KEYS,
  RELAYOUT_FRAME_KEYS,
  UNDO_RELAYOUT_FRAME_KEYS,
  hasV3FrameOverride,
  filterRelayoutOverrideEntry,
} from '../src/preview-shell/frame-override-manifest.js';

describe('frame override manifest', () => {
  it('relayout keys are persist keys minus style', () => {
    expect(RELAYOUT_FRAME_KEYS).toEqual(PERSIST_FRAME_KEYS.filter((key) => key !== 'style'));
  });

  it('undo relayout keys stay within relayout keys', () => {
    for (const key of UNDO_RELAYOUT_FRAME_KEYS) {
      expect(RELAYOUT_FRAME_KEYS).toContain(key);
    }
  });

  it('detects gap_delta-only overrides for undo relayout', () => {
    expect(hasV3FrameOverride({ gap_delta: 16 })).toBe(true);
    expect(hasV3FrameOverride({})).toBe(false);
  });

  it('filterRelayoutOverrideEntry forwards gap_delta null sentinel', () => {
    expect(filterRelayoutOverrideEntry({ gap_delta: null, style: 'parent' })).toEqual({
      gap_delta: null,
    });
  });
});
