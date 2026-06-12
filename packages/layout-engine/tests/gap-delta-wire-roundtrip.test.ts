import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createArrow, createLine, Frame, FrameDiagram } from '../src/frame-model.js';
import {
  deserializeFrameDiagramWire,
  serializeFrameDiagram,
} from '../src/frame-serialize.js';
import { loadFrameYaml } from '../src/frame-yaml-loader.js';
import { layoutFrameTree } from '../src/layout.js';
import { MockTextAdapter } from '../src/text-measure.js';

describe('gap_delta wire round-trip (canonicalState path)', () => {
  it('YAML → layout → serialize → deserialize preserves gapDelta on page root', () => {
    const yaml = [
      'engine: v3',
      'title: Wire round-trip',
      'root:',
      '  id: page',
      '  direction: vertical',
      '  gap_delta: 16',
      '  children:',
      '    - id: leaf',
      '      label: [Leaf]',
      '',
    ].join('\n');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-gap-delta-wire-'));
    const yamlPath = path.join(tempDir, 'wire.yaml');
    fs.writeFileSync(yamlPath, yaml, 'utf8');

    const diagram = loadFrameYaml(yamlPath);
    layoutFrameTree(diagram.root, new MockTextAdapter());
    const wire = serializeFrameDiagram(diagram);
    const reloaded = deserializeFrameDiagramWire(wire);

    expect(reloaded.root.gapDelta).toBe(16);
  });

  it('serialize → deserialize preserves gapDelta on dense leaf stacks', () => {
    const stack = new Frame({
      id: 'flow',
      gap: 8,
      gapDelta: 16,
      direction: 'VERTICAL',
      children: [
        new Frame({ id: 'a', label: [createLine('A')] }),
        new Frame({ id: 'b', label: [createLine('B')] }),
      ],
    });
    const diagram = new FrameDiagram({
      title: 'Promotion',
      root: stack,
      arrows: [createArrow('a', 'b')],
      gridCols: 1,
    });
    layoutFrameTree(stack, new MockTextAdapter(), { arrows: diagram.arrows });

    const wire = serializeFrameDiagram(diagram);
    const reloaded = deserializeFrameDiagramWire(wire);

    expect(reloaded.root.gapDelta).toBe(16);
  });
});
