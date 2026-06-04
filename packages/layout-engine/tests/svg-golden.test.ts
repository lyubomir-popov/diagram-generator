/**
 * Golden SVG regression tests (spec 012 T050).
 *
 * Refresh fixtures after intentional renderer changes:
 *   $env:UPDATE_SVG_GOLDEN='1'; npm test -- svg-golden
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SVG_GOLDEN_CASES,
  SVG_GOLDEN_DIR,
  assertSvgMarkers,
  normalizeSvg,
  renderSlugToSvg,
} from './svg-golden-harness.js';

describe('svg golden corpus subset', () => {
  for (const testCase of SVG_GOLDEN_CASES) {
    describe(testCase.slug, () => {
      it('passes structural markers', async () => {
        const svg = normalizeSvg(await renderSlugToSvg(testCase.slug));
        expect(() => assertSvgMarkers(svg, testCase.markers)).not.toThrow();
        expect(svg).toMatch(/^<\?xml version="1.0"/);
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
        expect(svg).not.toContain('<use ');
        expect(svg).not.toMatch(/<image[^>]+href="https?:/i);
      });

      it('matches golden SVG file', async () => {
        const svg = normalizeSvg(await renderSlugToSvg(testCase.slug));
        const goldenPath = join(SVG_GOLDEN_DIR, `${testCase.slug}.svg`);

        if (process.env.UPDATE_SVG_GOLDEN === '1') {
          mkdirSync(SVG_GOLDEN_DIR, { recursive: true });
          writeFileSync(goldenPath, svg, 'utf8');
          expect(true).toBe(true);
          return;
        }

        expect(existsSync(goldenPath), `missing golden file: ${goldenPath}`).toBe(true);
        const expected = readFileSync(goldenPath, 'utf8');
        expect(svg).toBe(expected);
      });
    });
  }
});
