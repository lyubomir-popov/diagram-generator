import { describe, expect, it } from 'vitest';
import { roundToGrid, GRID_BASELINE_PX } from '../src/index.js';

describe('graph-layout-core', () => {
  it('snaps to 8px grid', () => {
    expect(GRID_BASELINE_PX).toBe(8);
    expect(roundToGrid(10)).toBe(8);
    expect(roundToGrid(12)).toBe(16);
  });
});
