import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFrameYaml } from '../src/frame-yaml-loader.js';
import { layoutElkFrameDiagram } from '../src/elk-layout.js';
import { MockTextAdapter } from '../src/text-measure.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FRAMES_DIR = join(__dirname, '../../..', 'scripts/diagrams/frames');

function findFrameById(frame: { id: string; children: Array<{ id: string; children: unknown[] }> }, id: string): { id: string; children: Array<{ id: string; children: unknown[] }>; _layout: { placedW: number; placedH: number } } | null {
  if (frame.id === id) {
    return frame as { id: string; children: Array<{ id: string; children: unknown[] }>; _layout: { placedW: number; placedH: number } };
  }
  for (const child of frame.children) {
    const found = findFrameById(child as { id: string; children: Array<{ id: string; children: unknown[] }> }, id);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('layoutElkFrameDiagram', () => {
  it('lays out frame diagrams whose arrows target container panels', async () => {
    const diagram = loadFrameYaml(join(FRAMES_DIR, 'request-to-hardware-stack.yaml'));
    const adapter = new MockTextAdapter();

    await expect(layoutElkFrameDiagram(diagram, adapter)).resolves.toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    });

    const orch = findFrameById(diagram.root as unknown as { id: string; children: Array<{ id: string; children: unknown[] }> }, 'orch');
    expect(orch?._layout.placedW).toBeGreaterThan(0);
    expect(orch?._layout.placedH).toBeGreaterThan(0);
    expect(diagram.arrows[0]?.layoutPath?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});