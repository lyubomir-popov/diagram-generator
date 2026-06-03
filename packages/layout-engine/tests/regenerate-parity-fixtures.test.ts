/**
 * Run once to refresh parity-fixtures.json after text-layout measure changes:
 *   $env:REGENERATE_PARITY_FIXTURES='1'; npm test -- regenerate-parity-fixtures
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutFrameTree } from '../src/layout.js';
import { MockTextAdapter } from '../src/text-measure.js';
import { buildFrame, collectBounds } from './parity-fixture-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(__dirname, 'fixtures', 'parity-fixtures.json');

describe('regenerate parity fixtures', () => {
  it('writes updated expected coordinates when REGENERATE_PARITY_FIXTURES=1', () => {
    if (process.env.REGENERATE_PARITY_FIXTURES !== '1') {
      expect(true).toBe(true);
      return;
    }
    const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));
    const adapter = new MockTextAdapter();
    const updated = fixtures.map((fixture: { root: Record<string, unknown> }) => {
      const root = buildFrame(fixture.root);
      const result = layoutFrameTree(root, adapter);
      const bounds = collectBounds(root);
      return {
        ...fixture,
        expected: {
          width: result.width,
          height: result.height,
          bounds,
        },
      };
    });
    writeFileSync(fixturesPath, `${JSON.stringify(updated, null, 2)}\n`);
    expect(updated.length).toBeGreaterThan(0);
  });
});
