import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HarfBuzzTextAdapter } from '../src/harfbuzz-text-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FONT_PATH = path.join(ROOT, 'assets', 'UbuntuSans[wdth,wght].ttf');

let adapter: HarfBuzzTextAdapter;

beforeAll(async () => {
  const fontBuffer = await readFile(FONT_PATH);
  const fontData = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
  adapter = new HarfBuzzTextAdapter({ fontData });
});

describe('HarfBuzzTextAdapter', () => {
  it('reports the harfbuzz backend', () => {
    expect(adapter.measurementBackend).toBe('harfbuzz');
  });

  it('ignores unsupported smallCaps requests', () => {
    const plain = adapter.measureTextWidth({
      text: 'Infrastructure',
      fontSize: 18,
      weight: 400,
    });
    const flagged = adapter.measureTextWidth({
      text: 'Infrastructure',
      fontSize: 18,
      weight: 400,
      smallCaps: true,
    });

    expect(plain).toBeCloseTo(112.248, 3);
    expect(flagged).toBeCloseTo(plain, 6);
  });

  it('treats explicit letter spacing as a real layout input', () => {
    const base = adapter.measureTextWidth({
      text: 'INFRASTRUCTURE',
      fontSize: 15,
      weight: 700,
    });
    const spaced = adapter.measureTextWidth({
      text: 'INFRASTRUCTURE',
      fontSize: 15,
      weight: 700,
      letterSpacing: '0.05em',
    });

    expect(spaced).toBeGreaterThan(base);
    expect(spaced - base).toBeCloseTo(9.75, 6);
  });
});
